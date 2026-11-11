// Snowflakes that drift into a snowbank along the bottom of the viewport, and
// a little snowman who shovels it away.
//
// Two canvases: falling snow draws on one behind the content, so it never
// crosses text, and the snowbank and snowman draw on one in front of the
// content, along the bottom edge of the screen.
//
// The snowbank is a height map (one value per few pixels of width). Each flake
// that lands adds a small bump of snow where it lands and disappears. Every
// frame, snow on slopes steeper than the angle of repose slides down to its
// neighbors, which smooths the bumps into drifts. Drawing the bank is one
// filled path, so the cost doesn't grow with the amount of snow.
//
// The snowman peeks out from the left edge of the screen. Clicking it (a real
// <button> over the drawing) sends it across the bottom of the screen,
// pushing the snow off the right side with a shovel. It also goes on its own
// once the snow averages 10% of the viewport height or peaks at 15%.
// Afterwards it slides back to its spot on the left.
//
// The snowbank is saved to sessionStorage so it carries across page
// navigations.

const COLUMN_WIDTH = 4;
const STORAGE_KEY = "snow-pile";
/** Snowbank heights saved per page width, resampled to fit on load. */
const STORED_SAMPLES = 160;
/** Shovel when the snow's average depth reaches this fraction of the viewport. */
const SHOVEL_AVERAGE = 0.1;
/** Shovel when the snow's deepest point reaches this fraction of the viewport. */
const SHOVEL_PEAK = 0.15;
/** Roughly how long the snow takes to get deep enough to shovel. */
const FILL_SECONDS = 150;
/** Steepest slope (rise over run) snow holds before sliding. */
const MAX_SLOPE = 0.45;
/** How quickly drifts soften, as a share of each step traded per second. */
const SMOOTHING = 1.5;
/** Half the width of the bump of snow one flake adds. */
const BUMP_RADIUS = 20;
/** How far ahead of the snowman the shovel blade reaches. */
const BLADE_REACH = 34;
/** Tallest the heap pushed in front of the shovel is drawn. */
const MAX_HEAP_HEIGHT = 56;
/** Snowman center while peeking, in CSS pixels from the left edge. */
const PEEK_X = 4;
/** Snowman center while hidden off the left edge. */
const HIDDEN_X = -32;
/** Extra lean while the snowman button is hovered or focused. */
const PEEK_LEAN = 10;
/** Pause before the snowman comes back after shoveling, and how long it takes. */
const RETURN_DELAY = 1.5;
const RETURN_SECONDS = 1;

const SNOW_TOP = "#ffffff";
const SNOW_BOTTOM = "#c3d4e8";
const SNOW_SHADE = "rgba(120, 155, 195, 0.55)";

interface Flake {
	x: number;
	y: number;
	radius: number;
	fallSpeed: number;
	swayAmount: number;
	swaySpeed: number;
	phase: number;
	/** Larger flakes draw as six-armed crystals instead of dots. */
	crystal: boolean;
	rotation: number;
	spin: number;
}

/** A clump of snow thrown up off the shovel blade. */
interface Spray {
	x: number;
	y: number;
	vx: number;
	vy: number;
	radius: number;
	life: number;
}

interface Shovel {
	/** Snowman center, in CSS pixels. Moves left to right. */
	x: number;
	speed: number;
	/** Area of snow pushed so far, in square CSS pixels. */
	carried: number;
	/** Columns at or left of this index have been cleared. */
	cleared: number;
	spray: Spray[];
	sprayTimer: number;
}

const random = (min: number, max: number) => min + Math.random() * (max - min);
const easeOut = (t: number) => 1 - (1 - t) ** 3;

/** Linearly resample `values` to `length` points across the same span. */
function resample(values: ArrayLike<number>, length: number) {
	const out = new Float32Array(length);
	if (values.length === 0) return out;
	const scale = (values.length - 1) / Math.max(1, length - 1);
	for (let i = 0; i < length; i++) {
		const at = i * scale;
		const from = Math.floor(at);
		const to = Math.min(values.length - 1, from + 1);
		const t = at - from;
		out[i] = values[from]! * (1 - t) + values[to]! * t;
	}
	return out;
}

/** One six-armed snowflake, 2 units across, centered on the origin. */
function crystalPath() {
	const path = new Path2D();
	for (let arm = 0; arm < 6; arm++) {
		const angle = (arm * Math.PI) / 3;
		const cos = Math.cos(angle);
		const sin = Math.sin(angle);
		const point = (along: number, across: number) =>
			[along * cos - across * sin, along * sin + across * cos] as const;
		path.moveTo(0, 0);
		path.lineTo(...point(1, 0));
		// A pair of little branches partway out each arm.
		for (const side of [-1, 1]) {
			path.moveTo(...point(0.55, 0));
			path.lineTo(...point(0.8, side * 0.22));
		}
	}
	return path;
}

export class SnowPile {
	#back: CanvasRenderingContext2D;
	#front: CanvasRenderingContext2D;
	#button: HTMLButtonElement;
	#crystal = crystalPath();
	#flakes: Flake[] = [];
	#heights: Float32Array = new Float32Array(0);
	/** Scratch space for `#settle`, one entry per pair of columns. */
	#flux = new Float32Array(0);
	#shovel: Shovel | undefined;
	/** 0 when the snowman is out of sight on the left, 1 when it is peeking. */
	#peek = 0;
	/** Seconds to wait before the snowman starts sliding back into view. */
	#peekDelay = 0;
	#hovered = false;
	/** Keyboard focus on the snowman button; drawn as a glow. */
	#focusVisible = false;
	/** Whether the snowman button had focus when the snowman left to shovel. */
	#refocus = false;
	#wantsShovel = false;
	#time = 0;
	#width = 0;
	#height = 0;
	#dpr = 1;
	#frame = 0;
	#lastTime = 0;
	#dirty = false;
	#onPeek: (peeking: boolean) => void;

	/**
	 * `onPeek` is called with `true` when the snowman settles into its peeking
	 * spot, and `false` when it leaves (to shovel, or because the animation
	 * stopped).
	 */
	constructor(
		back: HTMLCanvasElement,
		front: HTMLCanvasElement,
		button: HTMLButtonElement,
		onPeek: (peeking: boolean) => void = () => {},
	) {
		this.#back = back.getContext("2d")!;
		this.#front = front.getContext("2d")!;
		this.#button = button;
		this.#onPeek = onPeek;
		this.#heights = load();

		button.addEventListener("click", () => this.shovel());
		button.addEventListener("pointerenter", () => (this.#hovered = true));
		button.addEventListener("pointerleave", () => (this.#hovered = false));
		button.addEventListener(
			"focus",
			() => (this.#focusVisible = button.matches(":focus-visible")),
		);
		button.addEventListener("blur", () => (this.#focusVisible = false));
	}

	get running() {
		return this.#frame !== 0;
	}

	start() {
		if (this.running) return;
		this.#resize();
		addEventListener("resize", this.#resize);
		addEventListener("pagehide", this.#save);
		// Seed the screen so it doesn't start empty.
		const target = this.#targetCount();
		this.#flakes = Array.from({ length: target }, () =>
			this.#spawn(random(-this.#height * 0.2, this.#height)),
		);
		// The snowman slides in shortly after the page loads. Snow carried over
		// from another page may already be deep; it shovels once it arrives.
		if (!this.#shovel) {
			this.#peek = 0;
			this.#peekDelay = 1;
		}
		this.#wantsShovel = this.#isFull();
		this.#lastTime = performance.now();
		this.#frame = requestAnimationFrame(this.#tick);
	}

	stop() {
		if (!this.running) return;
		cancelAnimationFrame(this.#frame);
		this.#frame = 0;
		removeEventListener("resize", this.#resize);
		removeEventListener("pagehide", this.#save);
		this.#save();
		this.#setPeeking(false);
		for (const ctx of [this.#back, this.#front]) {
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
		}
	}

	/** Send the snowman out to shovel, if it is peeking and not already out. */
	shovel() {
		if (!this.running || this.#shovel || this.#peek < 1) return;
		this.#startShovel();
	}

	#targetCount() {
		return Math.round(Math.min(110, Math.max(30, this.#width / 14)));
	}

	#spawn(y = random(-40, -10)): Flake {
		const crystal = Math.random() < 0.15;
		const radius = crystal ? random(4, 7) : random(1.2, 3.2);
		return {
			x: random(0, this.#width),
			y,
			radius,
			// Bigger flakes are closer, so they fall a little faster.
			fallSpeed: random(22, 34) + radius * 5,
			swayAmount: random(8, 24),
			swaySpeed: random(0.6, 1.6),
			phase: random(0, Math.PI * 2),
			crystal,
			rotation: random(0, Math.PI),
			spin: random(-0.8, 0.8),
		};
	}

	#resize = () => {
		const width = innerWidth;
		const height = innerHeight;
		const dpr = Math.min(devicePixelRatio || 1, 2);
		if (width === this.#width && height === this.#height && dpr === this.#dpr) {
			return;
		}
		this.#width = width;
		this.#height = height;
		this.#dpr = dpr;
		for (const canvas of [this.#back.canvas, this.#front.canvas]) {
			canvas.width = Math.round(width * dpr);
			canvas.height = Math.round(height * dpr);
		}
		// Keep the snowbank's shape, stretched to the new width.
		const columns = Math.ceil(width / COLUMN_WIDTH) + 1;
		if (this.#heights.length !== columns) {
			this.#heights = resample(this.#heights, columns);
		}
		const limit = this.#peakLimit();
		for (let i = 0; i < columns; i++) {
			this.#heights[i] = Math.min(this.#heights[i]!, limit);
		}
	};

	#peakLimit() {
		return this.#height * SHOVEL_PEAK;
	}

	/** Snow depth at x, in CSS pixels. */
	#depth(x: number) {
		const at = Math.min(
			this.#heights.length - 1,
			Math.max(0, x / COLUMN_WIDTH),
		);
		const from = Math.floor(at);
		const to = Math.min(this.#heights.length - 1, from + 1);
		const t = at - from;
		return this.#heights[from]! * (1 - t) + this.#heights[to]! * t;
	}

	/** Add the snow from one landed flake: a smooth bump centered on x. */
	#deposit(flake: Flake) {
		if (this.#depth(flake.x) >= this.#peakLimit()) return;
		// Size each bump so the bank reaches the shoveling depth in about
		// FILL_SECONDS whatever the viewport size. Flakes land at about
		// count * average speed / height per second.
		const landingRate = (this.#flakes.length * 38) / this.#height;
		const area =
			(SHOVEL_AVERAGE * this.#height * this.#width) /
			(FILL_SECONDS * landingRate);
		const peak = (area / BUMP_RADIUS) * (flake.radius / 3);
		const from = Math.max(0, Math.ceil((flake.x - BUMP_RADIUS) / COLUMN_WIDTH));
		const to = Math.min(
			this.#heights.length - 1,
			Math.floor((flake.x + BUMP_RADIUS) / COLUMN_WIDTH),
		);
		const wall = this.#shovel ? this.#shovel.cleared : -1;
		for (let i = from; i <= to; i++) {
			// Snow behind the shovel blade stays put; ahead of it piles on.
			if (i <= wall && flake.x / COLUMN_WIDTH > wall) continue;
			const offset = (i * COLUMN_WIDTH - flake.x) / BUMP_RADIUS;
			this.#heights[i]! += (peak * (1 + Math.cos(Math.PI * offset))) / 2;
		}
		this.#dirty = true;
		if (!this.#wantsShovel) this.#wantsShovel = this.#isFull();
	}

	/**
	 * Let snow on slopes steeper than MAX_SLOPE slide to its neighbors, and
	 * soften the rest a little so drifts round off instead of forming peaks.
	 */
	#settle(dt: number) {
		const heights = this.#heights;
		const max = MAX_SLOPE * COLUMN_WIDTH;
		// The shovel blade is a wall: snow ahead of it can't slide behind it.
		const wall = this.#shovel ? this.#shovel.cleared : -1;

		// Each pair of columns trades a share of their difference. Fluxes come
		// from this frame's heights so the smoothing doesn't lean either way.
		const share = Math.min(0.2, SMOOTHING * dt);
		if (this.#flux.length !== heights.length) {
			this.#flux = new Float32Array(heights.length);
		}
		const flux = this.#flux;
		for (let i = 0; i < heights.length - 1; i++) {
			flux[i] = i === wall ? 0 : (heights[i]! - heights[i + 1]!) * share;
		}
		for (let i = 0; i < heights.length - 1; i++) {
			heights[i]! -= flux[i]!;
			heights[i + 1]! += flux[i]!;
		}

		for (let pass = 0; pass < 2; pass++) {
			// Alternate directions so snow doesn't drift one way.
			const forward = pass % 2 === 0;
			for (let n = 0; n < heights.length - 1; n++) {
				const i = forward ? n : heights.length - 2 - n;
				if (i === wall) continue;
				const diff = heights[i]! - heights[i + 1]!;
				if (Math.abs(diff) <= max) continue;
				const move = ((Math.abs(diff) - max) / 2) * Math.sign(diff);
				heights[i]! -= move;
				heights[i + 1]! += move;
			}
		}
	}

	#isFull() {
		let sum = 0;
		let peak = 0;
		for (const height of this.#heights) {
			sum += height;
			peak = Math.max(peak, height);
		}
		return (
			sum / this.#heights.length >= this.#height * SHOVEL_AVERAGE ||
			peak >= this.#peakLimit() * 0.98
		);
	}

	/** Where the snowman stands while peeking, easing in as it arrives. */
	#peekX() {
		const lean =
			this.#hovered || this.#focusVisible
				? PEEK_LEAN
				: Math.max(0, Math.sin(this.#time * 0.6)) * 3;
		return HIDDEN_X + (PEEK_X - HIDDEN_X + lean) * easeOut(this.#peek);
	}

	#startShovel() {
		this.#shovel = {
			x: this.#peekX(),
			speed: Math.min(200, Math.max(100, this.#width / 8)),
			carried: 0,
			cleared: -1,
			spray: [],
			sprayTimer: 0,
		};
		this.#wantsShovel = false;
		this.#peek = 0;
		this.#peekDelay = RETURN_DELAY;
		this.#hovered = false;
		// Only hand focus back to keyboard users; a mouse click shouldn't leave
		// the snowman focused.
		this.#refocus = this.#focusVisible;
		this.#setPeeking(false);
	}

	/** Show or hide the snowman button and tell the listener. */
	#setPeeking(peeking: boolean) {
		this.#button.hidden = !peeking;
		this.#onPeek(peeking);
	}

	/** Move the snowman and scoop up the snow the blade has passed over. */
	#updateShovel(shovel: Shovel, dt: number) {
		shovel.x += shovel.speed * dt;
		const bladeX = shovel.x + BLADE_REACH;
		const reached = Math.min(
			this.#heights.length - 1,
			Math.floor(bladeX / COLUMN_WIDTH),
		);
		for (let i = shovel.cleared + 1; i <= reached; i++) {
			shovel.carried += this.#heights[i]! * COLUMN_WIDTH;
			this.#heights[i] = 0;
		}
		if (reached > shovel.cleared) {
			shovel.cleared = reached;
			this.#dirty = true;
		}

		// Clumps of snow fly up off the blade while there's snow to push.
		shovel.sprayTimer -= dt;
		if (shovel.carried > 200 && shovel.sprayTimer <= 0) {
			shovel.sprayTimer = random(0.03, 0.08);
			const top = this.#height - this.#heapHeight(shovel);
			shovel.spray.push({
				x: bladeX + random(0, 10),
				y: top + random(-2, 4),
				vx: shovel.speed + random(10, 70),
				vy: random(-140, -60),
				radius: random(1.5, 3.5),
				life: random(0.5, 0.9),
			});
		}
		for (const clump of shovel.spray) {
			clump.life -= dt;
			clump.vy += 360 * dt;
			clump.x += clump.vx * dt;
			clump.y += clump.vy * dt;
		}
		shovel.spray = shovel.spray.filter(
			(clump) => clump.life > 0 && clump.y < this.#height,
		);

		if (shovel.x - 40 > this.#width + this.#heapHeight(shovel) * 2.8) {
			this.#shovel = undefined;
		}
	}

	/** Height of the heap pushed in front of the blade. */
	#heapHeight(shovel: Shovel) {
		// Half an ellipse 2.8 times as wide as it is tall holds 0.7 * PI * h^2.
		return Math.min(
			MAX_HEAP_HEIGHT,
			Math.sqrt(shovel.carried / (0.7 * Math.PI)),
		);
	}

	/** Bring the snowman back to its peeking spot after shoveling. */
	#updatePeek(dt: number) {
		if (this.#peekDelay > 0) {
			this.#peekDelay -= dt;
			return;
		}
		if (this.#peek < 1) {
			this.#peek = Math.min(1, this.#peek + dt / RETURN_SECONDS);
			if (this.#peek === 1) {
				this.#setPeeking(true);
				if (this.#refocus) this.#button.focus({ preventScroll: true });
				this.#refocus = false;
			}
		}
	}

	#tick = (now: number) => {
		// Clamp so a background tab doesn't teleport every flake on return.
		const dt = Math.min((now - this.#lastTime) / 1000, 0.05);
		this.#lastTime = now;
		this.#time += dt;
		const floor = this.#height;
		// A slow, shifting breeze that every flake drifts with.
		const wind =
			Math.sin(this.#time * 0.13) * 14 + Math.sin(this.#time * 0.41) * 6;

		const back = this.#back;
		back.setTransform(1, 0, 0, 1, 0, 0);
		back.clearRect(0, 0, back.canvas.width, back.canvas.height);
		back.setTransform(this.#dpr, 0, 0, this.#dpr, 0, 0);

		const near = new Path2D();
		const far = new Path2D();
		for (const flake of this.#flakes) {
			flake.phase += dt * flake.swaySpeed;
			flake.x += (Math.cos(flake.phase) * flake.swayAmount + wind) * dt;
			flake.y += flake.fallSpeed * dt;
			flake.rotation += flake.spin * dt;
			// Drift off one side, come back on the other.
			if (flake.x < -10) flake.x += this.#width + 20;
			else if (flake.x > this.#width + 10) flake.x -= this.#width + 20;
			if (flake.y + flake.radius * 0.5 >= floor - this.#depth(flake.x)) {
				this.#deposit(flake);
				Object.assign(flake, this.#spawn());
			}
			if (flake.crystal) continue;
			const path = flake.radius < 2 ? far : near;
			path.moveTo(flake.x + flake.radius, flake.y);
			path.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2);
		}
		back.globalAlpha = 1;
		back.fillStyle = "rgba(255, 255, 255, 0.45)";
		back.fill(far);
		back.fillStyle = "rgba(255, 255, 255, 0.8)";
		back.fill(near);
		back.strokeStyle = "rgba(255, 255, 255, 0.85)";
		back.lineCap = "round";
		for (const flake of this.#flakes) {
			if (!flake.crystal) continue;
			back.setTransform(this.#dpr, 0, 0, this.#dpr, 0, 0);
			back.translate(flake.x, flake.y);
			back.rotate(flake.rotation);
			back.scale(flake.radius, flake.radius);
			back.lineWidth = 1.2 / flake.radius;
			back.stroke(this.#crystal);
		}

		// Adjust the count after resizes.
		const target = this.#targetCount();
		while (this.#flakes.length < target) this.#flakes.push(this.#spawn());
		if (this.#flakes.length > target) this.#flakes.length = target;

		if (this.#shovel) this.#updateShovel(this.#shovel, dt);
		else {
			this.#updatePeek(dt);
			if (this.#wantsShovel && this.#peek === 1) this.#startShovel();
		}
		this.#settle(dt);

		const front = this.#front;
		front.setTransform(1, 0, 0, 1, 0, 0);
		front.globalAlpha = 1;
		front.clearRect(0, 0, front.canvas.width, front.canvas.height);
		this.#paintBank(floor);
		if (this.#shovel) this.#paintShovel(this.#shovel, floor);
		else if (this.#peek > 0) {
			this.#paintSnowman(this.#peekX(), floor, 0, this.#focusVisible, false);
		}

		this.#frame = requestAnimationFrame(this.#tick);
	};

	#paintBank(floor: number) {
		const heights = this.#heights;
		let peak = 0;
		for (const height of heights) peak = Math.max(peak, height);
		if (peak < 0.5) return;

		const ctx = this.#front;
		ctx.setTransform(this.#dpr, 0, 0, this.#dpr, 0, 0);
		ctx.globalAlpha = 1;
		const surface = new Path2D();
		surface.moveTo(0, floor - heights[0]!);
		for (let i = 1; i < heights.length; i++) {
			surface.lineTo(i * COLUMN_WIDTH, floor - heights[i]!);
		}
		// Trace the bank as one closed shape: along the floor's left edge, over
		// the surface, and back along the floor.
		const bank = new Path2D();
		bank.moveTo(0, floor);
		for (let i = 0; i < heights.length; i++) {
			bank.lineTo(i * COLUMN_WIDTH, floor - heights[i]!);
		}
		bank.lineTo((heights.length - 1) * COLUMN_WIDTH, floor);
		bank.closePath();

		const gradient = ctx.createLinearGradient(0, floor - peak, 0, floor);
		gradient.addColorStop(0, SNOW_TOP);
		gradient.addColorStop(1, SNOW_BOTTOM);
		ctx.fillStyle = gradient;
		ctx.fill(bank);
		// A soft blue line along the top gives the edge some shape.
		ctx.strokeStyle = SNOW_SHADE;
		ctx.lineWidth = 1;
		ctx.stroke(surface);

		// A few glints twinkle on the surface. Their spots are fixed per column
		// so they don't jump around between frames.
		ctx.fillStyle = "#ffffff";
		for (let i = 7; i < heights.length; i += 23) {
			const depth = heights[i]!;
			if (depth < 6) continue;
			const twinkle = Math.sin(this.#time * 2.3 + i * 1.7);
			if (twinkle < 0.6) continue;
			const size = (twinkle - 0.6) * 5;
			const x = i * COLUMN_WIDTH;
			const y = floor - depth + 3 + (i % 5);
			ctx.globalAlpha = 0.9;
			ctx.fillStyle = "#e9f6ff";
			ctx.beginPath();
			ctx.moveTo(x, y - size);
			ctx.lineTo(x + size * 0.3, y);
			ctx.lineTo(x, y + size);
			ctx.lineTo(x - size * 0.3, y);
			ctx.closePath();
			ctx.moveTo(x - size, y);
			ctx.lineTo(x, y + size * 0.3);
			ctx.lineTo(x + size, y);
			ctx.lineTo(x, y - size * 0.3);
			ctx.closePath();
			ctx.fill();
		}
		ctx.globalAlpha = 1;
	}

	#paintShovel(shovel: Shovel, floor: number) {
		const ctx = this.#front;
		const bladeX = shovel.x + BLADE_REACH;
		const heap = this.#heapHeight(shovel);

		// The heap of snow pushed along in front of the blade.
		if (heap > 1) {
			ctx.setTransform(this.#dpr, 0, 0, this.#dpr, 0, 0);
			ctx.globalAlpha = 1;
			const gradient = ctx.createLinearGradient(0, floor - heap, 0, floor);
			gradient.addColorStop(0, SNOW_TOP);
			gradient.addColorStop(1, SNOW_BOTTOM);
			ctx.fillStyle = gradient;
			ctx.strokeStyle = SNOW_SHADE;
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(bladeX, floor);
			ctx.lineTo(bladeX, floor - heap * 0.8);
			ctx.quadraticCurveTo(
				bladeX + heap * 0.3,
				floor - heap * 1.15,
				bladeX + heap * 1.1,
				floor - heap * 0.9,
			);
			ctx.quadraticCurveTo(
				bladeX + heap * 2.2,
				floor - heap * 0.6,
				bladeX + heap * 2.8,
				floor,
			);
			ctx.closePath();
			ctx.fill();
			ctx.stroke();
		}

		ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
		for (const clump of shovel.spray) {
			ctx.beginPath();
			ctx.arc(clump.x, clump.y, clump.radius, 0, Math.PI * 2);
			ctx.fill();
		}

		// The snowman scoots along in little hops, leaning into the shovel.
		const hop = Math.abs(Math.sin(this.#time * 9)) * 3;
		this.#paintSnowman(shovel.x, floor - hop, 0.12, false, true);
	}

	/**
	 * A small snowman facing right, standing at x with its base at y. `lean`
	 * tilts it forward, in radians. While `shoveling`, it holds a shovel whose
	 * blade rests on the ground BLADE_REACH ahead.
	 */
	#paintSnowman(
		x: number,
		y: number,
		lean: number,
		glow: boolean,
		shoveling: boolean,
	) {
		const ctx = this.#front;
		const floor = this.#height;
		ctx.setTransform(this.#dpr, 0, 0, this.#dpr, 0, 0);
		ctx.globalAlpha = 1;
		ctx.lineCap = "round";
		ctx.lineJoin = "round";

		const bladeX = x + BLADE_REACH;

		if (shoveling) {
			// Shovel: a handle from behind the hands down to a blade on the
			// ground, drawn first so the snowman's arms go over it.
			const gripX = x + 2;
			const gripY = y - 44;
			ctx.strokeStyle = "#9a6a3a";
			ctx.lineWidth = 3;
			ctx.beginPath();
			ctx.moveTo(gripX, gripY);
			ctx.lineTo(bladeX - 2, floor - 8);
			ctx.stroke();
			// T-grip at the top of the handle.
			ctx.beginPath();
			ctx.moveTo(gripX - 3, gripY - 3);
			ctx.lineTo(gripX + 3, gripY + 3);
			ctx.stroke();
			// Blade.
			ctx.fillStyle = "#b9c6d6";
			ctx.strokeStyle = "#7d8da3";
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(bladeX - 3, floor - 16);
			ctx.quadraticCurveTo(bladeX + 2, floor - 8, bladeX - 1, floor);
			ctx.lineTo(bladeX + 3, floor);
			ctx.quadraticCurveTo(bladeX + 6, floor - 8, bladeX + 1, floor - 16);
			ctx.closePath();
			ctx.fill();
			ctx.stroke();
		}

		ctx.translate(x, y);
		ctx.rotate(lean);

		// Body: three stacked snowballs. A glow doubles as the focus indicator.
		ctx.shadowColor = glow
			? "rgba(190, 228, 255, 1)"
			: "rgba(170, 210, 245, 0.45)";
		ctx.fillStyle = "#f6f9fd";
		ctx.strokeStyle = "rgba(120, 155, 195, 0.7)";
		ctx.lineWidth = 1;
		const balls = [
			[0, -15, 15],
			[0, -36, 11],
			[0, -52, 8],
		] as const;
		// Each ball covers the outline of the one below it.
		for (const [bx, by, r] of balls) {
			ctx.beginPath();
			ctx.arc(bx, by, r, 0, Math.PI * 2);
			ctx.shadowBlur = glow ? 26 : 10;
			ctx.fill();
			// A second pass stacks the shadow so the focus glow is clearly visible.
			if (glow) ctx.fill();
			ctx.shadowBlur = 0;
			ctx.stroke();
		}

		// Stick arms. Reaching for the shovel, or one waving while peeking.
		ctx.strokeStyle = "#7a5230";
		ctx.lineWidth = 2;
		ctx.beginPath();
		if (shoveling) {
			ctx.moveTo(8, -38);
			ctx.lineTo(15, -33);
			ctx.moveTo(-6, -40);
			ctx.lineTo(3, -47);
		} else {
			const wave = Math.sin(this.#time * 4) * 3;
			ctx.moveTo(9, -38);
			ctx.lineTo(20, -47 + wave);
			ctx.moveTo(16, -44 + wave * 0.6);
			ctx.lineTo(18, -50 + wave * 0.6);
		}
		ctx.stroke();

		// Coal buttons.
		ctx.fillStyle = "#1c1f26";
		for (const by of [-39, -32]) {
			ctx.beginPath();
			ctx.arc(4, by, 1.4, 0, Math.PI * 2);
			ctx.fill();
		}

		// Scarf, with a tail that flaps behind.
		const flap = Math.sin(this.#time * (shoveling ? 12 : 3)) * 2;
		ctx.fillStyle = "#d6453d";
		ctx.beginPath();
		ctx.roundRect(-8, -46, 16, 4, 2);
		ctx.fill();
		ctx.beginPath();
		ctx.moveTo(-5, -45);
		ctx.quadraticCurveTo(-11, -42 + flap, -14 - flap, -36);
		ctx.lineTo(-10 - flap, -35);
		ctx.quadraticCurveTo(-7, -40, -2, -43);
		ctx.closePath();
		ctx.fill();

		// Face, looking right: coal eyes, a carrot nose, and a smile.
		ctx.fillStyle = "#1c1f26";
		for (const ex of [1, 5.5]) {
			ctx.beginPath();
			ctx.arc(ex, -54, 1.3, 0, Math.PI * 2);
			ctx.fill();
		}
		for (const [mx, my] of [
			[1, -48.5],
			[3, -47.6],
			[5, -48],
		]) {
			ctx.beginPath();
			ctx.arc(mx!, my!, 0.7, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.fillStyle = "#f08a24";
		ctx.beginPath();
		ctx.moveTo(6, -52.5);
		ctx.lineTo(17, -51);
		ctx.lineTo(6, -49.5);
		ctx.closePath();
		ctx.fill();

		// Knit hat with a pom-pom.
		ctx.fillStyle = "#d6453d";
		ctx.beginPath();
		ctx.arc(0, -55, 8.2, Math.PI * 1.05, Math.PI * 1.95);
		ctx.closePath();
		ctx.fill();
		ctx.fillStyle = "#b8352f";
		ctx.beginPath();
		ctx.roundRect(-8.5, -58, 17, 3, 1.5);
		ctx.fill();
		ctx.fillStyle = "#f6f9fd";
		ctx.beginPath();
		ctx.arc(-1, -64, 2.6, 0, Math.PI * 2);
		ctx.fill();
	}

	#save = () => {
		if (!this.#dirty) return;
		this.#dirty = false;
		try {
			sessionStorage.setItem(
				STORAGE_KEY,
				JSON.stringify(
					Array.from(resample(this.#heights, STORED_SAMPLES), (height) =>
						Math.round(height),
					),
				),
			);
		} catch {
			// Storage full or blocked; the snow just won't persist.
		}
	};
}

function load(): Float32Array {
	try {
		const raw = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "[]");
		if (
			!Array.isArray(raw) ||
			!raw.every((value) => typeof value === "number" && value >= 0)
		) {
			return new Float32Array(0);
		}
		return Float32Array.from(raw);
	} catch {
		return new Float32Array(0);
	}
}
