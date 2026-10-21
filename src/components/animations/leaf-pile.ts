// Falling leaves that collect into a pile along the bottom of the viewport,
// and a little ghost who rakes them away.
//
// Two canvases: falling leaves draw on one behind the content, so they never
// cross text, and the pile and ghost draw on one in front of the content,
// along the bottom edge of the screen.
//
// Falling leaves are simulated and drawn every frame. Once a leaf lands it is
// painted onto an offscreen "pile" canvas and removed from the simulation, so
// the per-frame cost depends only on the number of falling leaves, not on the
// size of the pile. A height map (one value per few pixels of width) tracks the
// pile surface so new leaves land on top of earlier ones and slide off steep
// spots, which shapes the pile into mounds.
//
// The ghost peeks out from the left edge of the screen. Clicking it (a real
// <button> over the drawing) sends it across the bottom of the screen to rake
// the pile off the right side. It also goes on its own once the pile averages
// 10% of the viewport height or peaks at 15%. Afterwards it floats back to its
// spot on the left.
//
// The pile is saved to sessionStorage so it carries across page navigations.

import { LEAF_COLORS, LEAF_SHAPES, LEAF_SHAPE_NAMES } from "./leaves";

const COLUMN_WIDTH = 4;
const STORAGE_KEY = "leaf-pile";
const MAX_SETTLED = 900;
const FALLING_ALPHA = 0.6;
const PILE_ALPHA = 0.85;
const FADE_SECONDS = 2;
/** Rake when the pile's average height reaches this fraction of the viewport. */
const RAKE_AVERAGE = 0.1;
/** Rake when the pile's tallest point reaches this fraction of the viewport. */
const RAKE_PEAK = 0.15;
/** Room above the tallest pile for leaves resting on top. */
const PILE_CANVAS_MARGIN = 40;
/** How far ahead of the ghost the rake reaches. */
const RAKE_REACH = 46;
/** Most raked leaves drawn in the heap in front of the rake. */
const MAX_HEAP_LEAVES = 80;
/** Ghost center while peeking, in CSS pixels from the left edge. */
const PEEK_X = 4;
/** How far the peeking ghost floats above the bottom of the viewport. */
const PEEK_LIFT = 26;
/** Extra lean while the ghost button is hovered or focused. */
const PEEK_LEAN = 12;
/** Pause before the ghost comes back after raking, and how long it takes. */
const RETURN_DELAY = 1.5;
const RETURN_SECONDS = 1;

interface FallingLeaf {
	x: number;
	y: number;
	size: number;
	color: number;
	shape: number;
	fallSpeed: number;
	swayAmount: number;
	swaySpeed: number;
	phase: number;
	rotation: number;
	spin: number;
	/** Seconds left before a leaf that landed on a full pile disappears. */
	fading: number | undefined;
}

/** A leaf resting in the pile. Stored relative to the floor and page width. */
interface SettledLeaf {
	/** Horizontal position as a fraction of the viewport width. */
	x: number;
	/** Height of the leaf's center above the floor, in CSS pixels. */
	h: number;
	size: number;
	rotation: number;
	/** Vertical squash, so leaves look like they are lying down. */
	squash: number;
	color: number;
	shape: number;
}

/** A raked leaf, carried in the heap in front of the rake. */
interface HeapLeaf {
	/** Distance ahead of the rake, as a fraction of the heap width. */
	ahead: number;
	/** Height above the floor, as a fraction of the heap height. */
	up: number;
	size: number;
	rotation: number;
	color: number;
	shape: number;
}

interface Rake {
	/** Ghost center, in CSS pixels. Moves left to right. */
	x: number;
	speed: number;
	heap: HeapLeaf[];
	raked: number;
}

const random = (min: number, max: number) => min + Math.random() * (max - min);
const randomIndex = (length: number) => Math.floor(Math.random() * length);
const easeOut = (t: number) => 1 - (1 - t) ** 3;

export class LeafPile {
	#back: CanvasRenderingContext2D;
	#front: CanvasRenderingContext2D;
	#button: HTMLButtonElement;
	#pile = document.createElement("canvas");
	#pileCtx = this.#pile.getContext("2d")!;
	#shapes = LEAF_SHAPE_NAMES.map((name) => new Path2D(LEAF_SHAPES[name]));
	#falling: FallingLeaf[] = [];
	#settled: SettledLeaf[] = [];
	#heights = new Float32Array(0);
	#rake: Rake | undefined;
	/** 0 when the ghost is out of sight on the left, 1 when it is peeking. */
	#peek = 0;
	/** Seconds to wait before the ghost starts floating back into view. */
	#peekDelay = 0;
	#leaning = false;
	/** Whether the ghost button had focus when the ghost left to rake. */
	#refocus = false;
	#wantsRake = false;
	#time = 0;
	#width = 0;
	#height = 0;
	#dpr = 1;
	#frame = 0;
	#lastTime = 0;
	#dirty = false;

	constructor(
		back: HTMLCanvasElement,
		front: HTMLCanvasElement,
		button: HTMLButtonElement,
	) {
		this.#back = back.getContext("2d")!;
		this.#front = front.getContext("2d")!;
		this.#button = button;
		this.#settled = load();

		button.addEventListener("click", () => this.rake());
		const lean = (leaning: boolean) => () => (this.#leaning = leaning);
		button.addEventListener("pointerenter", lean(true));
		button.addEventListener("pointerleave", lean(false));
		button.addEventListener("focus", lean(true));
		button.addEventListener("blur", lean(false));
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
		this.#falling = Array.from({ length: target }, () =>
			this.#spawn(random(-this.#height, this.#height * 0.8)),
		);
		// The ghost floats in shortly after the page loads. A pile carried over
		// from another page may already be full; it rakes once it arrives.
		if (!this.#rake) {
			this.#peek = 0;
			this.#peekDelay = 1;
		}
		this.#wantsRake = this.#isFull();
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
		this.#button.hidden = true;
		for (const ctx of [this.#back, this.#front]) {
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
		}
	}

	/** Send the ghost out to rake, if it is peeking and not already raking. */
	rake() {
		if (!this.running || this.#rake || this.#peek < 1) return;
		this.#startRake();
	}

	#targetCount() {
		return Math.round(Math.min(40, Math.max(12, this.#width / 45)));
	}

	#pileCanvasHeight() {
		return Math.ceil(this.#height * RAKE_PEAK + PILE_CANVAS_MARGIN);
	}

	#spawn(y = random(-80, -20)): FallingLeaf {
		return {
			x: random(0, this.#width),
			y,
			size: random(14, 30),
			color: randomIndex(LEAF_COLORS.length),
			shape: randomIndex(this.#shapes.length),
			fallSpeed: random(35, 70),
			swayAmount: random(20, 60),
			swaySpeed: random(1, 2.2),
			phase: random(0, Math.PI * 2),
			rotation: random(0, Math.PI * 2),
			spin: random(-1.5, 1.5),
			fading: undefined,
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
		this.#pile.width = Math.round(width * dpr);
		this.#pile.height = Math.round(this.#pileCanvasHeight() * dpr);
		this.#rebuildPile();
	};

	/** Recompute the height map and repaint the pile from the settled leaves. */
	#rebuildPile() {
		this.#heights = new Float32Array(Math.ceil(this.#width / COLUMN_WIDTH) + 1);
		const ctx = this.#pileCtx;
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, this.#pile.width, this.#pile.height);
		for (const leaf of this.#settled) {
			this.#raise(leaf.x * this.#width, leaf.size, leaf.h);
			this.#paintSettled(leaf);
		}
	}

	#columns(x: number, size: number) {
		const half = size / 2;
		return [
			Math.max(0, Math.floor((x - half) / COLUMN_WIDTH)),
			Math.min(this.#heights.length - 1, Math.floor((x + half) / COLUMN_WIDTH)),
		] as const;
	}

	/** Highest point of the pile under a leaf of this size centered at x. */
	#surface(x: number, size: number) {
		const [from, to] = this.#columns(x, size);
		let max = 0;
		for (let i = from; i <= to; i++) max = Math.max(max, this.#heights[i]!);
		return max;
	}

	#raise(x: number, size: number, center: number) {
		const [from, to] = this.#columns(x, size);
		const mid = (from + to) / 2;
		const span = Math.max(1, (to - from) / 2);
		for (let i = from; i <= to; i++) {
			// Thickest in the middle of the leaf, thinner at the edges. Real leaves
			// are flat, but piles are loose, so each leaf adds more height than
			// its thickness would.
			const top = center + size * 0.45 * (1 - 0.5 * (Math.abs(i - mid) / span));
			this.#heights[i] = Math.max(this.#heights[i]!, top);
		}
	}

	/** Let a landing leaf slide down steep slopes before it comes to rest. */
	#findRestingSpot(x: number, size: number) {
		for (let step = 0; step < 8; step++) {
			const here = this.#surface(x, size);
			const left = this.#surface(x - size, size);
			const right = this.#surface(x + size, size);
			const drop = size * 0.5;
			if (here - left > drop && left <= right) x -= size / 2;
			else if (here - right > drop) x += size / 2;
			else break;
			x = Math.min(Math.max(x, 0), this.#width);
		}
		return x;
	}

	#land(leaf: FallingLeaf) {
		const x = this.#findRestingSpot(leaf.x, leaf.size);
		const surface = this.#surface(x, leaf.size);
		if (
			surface >= this.#height * RAKE_PEAK ||
			this.#settled.length >= MAX_SETTLED
		) {
			// The pile is full and the ghost is on its way; let this leaf rest
			// briefly, then fade away.
			leaf.fading = FADE_SECONDS;
			return;
		}
		const settled: SettledLeaf = {
			x: x / this.#width,
			h: surface + leaf.size * 0.2,
			size: leaf.size,
			rotation: random(-0.6, 0.6) + (Math.random() < 0.5 ? 0 : Math.PI),
			squash: random(0.45, 0.75),
			color: leaf.color,
			shape: leaf.shape,
		};
		this.#settled.push(settled);
		this.#raise(x, leaf.size, settled.h);
		this.#paintSettled(settled);
		this.#dirty = true;
		Object.assign(leaf, this.#spawn());
		if (!this.#wantsRake) this.#wantsRake = this.#isFull();
	}

	#isFull() {
		let sum = 0;
		let peak = 0;
		for (const height of this.#heights) {
			sum += height;
			peak = Math.max(peak, height);
		}
		return (
			sum / this.#heights.length >= this.#height * RAKE_AVERAGE ||
			peak >= this.#height * RAKE_PEAK
		);
	}

	/** Where the ghost floats while peeking, easing in as it arrives. */
	#peekX() {
		const lean = this.#leaning ? PEEK_LEAN : Math.sin(this.#time * 0.7) * 3;
		return -40 + (PEEK_X + 40 + lean) * easeOut(this.#peek);
	}

	#startRake() {
		this.#rake = {
			x: this.#peekX(),
			speed: Math.min(220, Math.max(110, this.#width / 7)),
			heap: [],
			raked: 0,
		};
		this.#wantsRake = false;
		this.#peek = 0;
		this.#peekDelay = RETURN_DELAY;
		this.#leaning = false;
		this.#refocus = document.activeElement === this.#button;
		this.#button.hidden = true;
	}

	/** Move the ghost and sweep up every leaf behind the rake. */
	#updateRake(rake: Rake, dt: number) {
		rake.x += rake.speed * dt;
		const rakeX = rake.x + RAKE_REACH;

		const remaining: SettledLeaf[] = [];
		for (const leaf of this.#settled) {
			if (leaf.x * this.#width > rakeX) {
				remaining.push(leaf);
				continue;
			}
			rake.raked++;
			rake.heap.push({
				ahead: Math.random(),
				up: Math.random() * Math.random(),
				size: leaf.size,
				rotation: random(0, Math.PI * 2),
				color: leaf.color,
				shape: leaf.shape,
			});
			if (rake.heap.length > MAX_HEAP_LEAVES) rake.heap.shift();
		}
		if (remaining.length !== this.#settled.length) {
			this.#settled = remaining;
			this.#dirty = true;
		}

		// Clear the swept ground: the height map and the painted pile.
		const cleared = Math.max(0, rakeX);
		this.#heights.fill(0, 0, Math.floor(cleared / COLUMN_WIDTH) + 1);
		const ctx = this.#pileCtx;
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, cleared * this.#dpr, this.#pile.height);

		if (rake.x > this.#width + 160) this.#rake = undefined;
	}

	/** Bring the ghost back to its peeking spot after a rake. */
	#updatePeek(dt: number) {
		if (this.#peekDelay > 0) {
			this.#peekDelay -= dt;
			return;
		}
		if (this.#peek < 1) {
			this.#peek = Math.min(1, this.#peek + dt / RETURN_SECONDS);
			if (this.#peek === 1) {
				this.#button.hidden = false;
				if (this.#refocus) this.#button.focus({ preventScroll: true });
				this.#refocus = false;
			}
		}
	}

	#paintLeaf(
		ctx: CanvasRenderingContext2D,
		x: number,
		y: number,
		size: number,
		rotation: number,
		scaleX: number,
		scaleY: number,
		alpha: number,
		color: number,
		shape: number,
	) {
		const scale = size / 100;
		ctx.setTransform(this.#dpr, 0, 0, this.#dpr, 0, 0);
		ctx.translate(x, y);
		ctx.rotate(rotation);
		ctx.scale(scale * scaleX, scale * scaleY);
		ctx.translate(-50, -50);
		ctx.globalAlpha = alpha;
		ctx.fillStyle = LEAF_COLORS[color]!;
		ctx.fill(this.#shapes[shape]!);
	}

	#paintSettled(leaf: SettledLeaf) {
		this.#paintLeaf(
			this.#pileCtx,
			leaf.x * this.#width,
			this.#pileCanvasHeight() - leaf.h,
			leaf.size,
			leaf.rotation,
			1,
			leaf.squash,
			PILE_ALPHA,
			leaf.color,
			leaf.shape,
		);
	}

	#tick = (now: number) => {
		// Clamp so a background tab doesn't teleport every leaf on return.
		const dt = Math.min((now - this.#lastTime) / 1000, 0.05);
		this.#lastTime = now;
		this.#time += dt;
		const floor = this.#height;

		const back = this.#back;
		back.setTransform(1, 0, 0, 1, 0, 0);
		back.clearRect(0, 0, back.canvas.width, back.canvas.height);

		for (const leaf of this.#falling) {
			if (leaf.fading !== undefined) {
				leaf.fading -= dt;
				if (leaf.fading <= 0) Object.assign(leaf, this.#spawn());
			} else {
				leaf.phase += dt * leaf.swaySpeed;
				leaf.x += Math.cos(leaf.phase) * leaf.swayAmount * dt;
				leaf.y += leaf.fallSpeed * dt;
				leaf.rotation += leaf.spin * dt;
				const surface = floor - this.#surface(leaf.x, leaf.size);
				if (leaf.y + leaf.size * 0.3 >= surface) this.#land(leaf);
				else if (leaf.x < -40 || leaf.x > this.#width + 40) {
					Object.assign(leaf, this.#spawn());
				}
			}
			// Flipping the x scale makes the leaf look like it tumbles in 3D.
			this.#paintLeaf(
				back,
				leaf.x,
				leaf.y,
				leaf.size,
				leaf.rotation,
				Math.cos(leaf.phase * 1.7),
				1,
				leaf.fading === undefined
					? FALLING_ALPHA
					: (FALLING_ALPHA * leaf.fading) / FADE_SECONDS,
				leaf.color,
				leaf.shape,
			);
		}

		// Adjust the count after resizes.
		const target = this.#targetCount();
		while (this.#falling.length < target) this.#falling.push(this.#spawn());
		if (this.#falling.length > target) this.#falling.length = target;

		if (this.#rake) this.#updateRake(this.#rake, dt);
		else {
			this.#updatePeek(dt);
			if (this.#wantsRake && this.#peek === 1) this.#startRake();
		}

		const front = this.#front;
		front.setTransform(1, 0, 0, 1, 0, 0);
		front.globalAlpha = 1;
		front.clearRect(0, 0, front.canvas.width, front.canvas.height);
		front.drawImage(
			this.#pile,
			0,
			(floor - this.#pileCanvasHeight()) * this.#dpr,
		);
		if (this.#rake) this.#paintRake(this.#rake, floor);
		else if (this.#peek > 0) {
			const bob = Math.sin(this.#time * 2) * 3;
			this.#paintGhost(this.#peekX(), floor - PEEK_LIFT + bob);
		}

		this.#frame = requestAnimationFrame(this.#tick);
	};

	#paintRake(rake: Rake, floor: number) {
		const ctx = this.#front;
		const time = this.#time;
		const rakeX = rake.x + RAKE_REACH;

		// The heap of raked leaves, pushed along in front of the rake.
		const heapWidth = Math.min(90, 10 + Math.sqrt(rake.raked) * 5);
		const heapHeight = Math.min(46, 6 + Math.sqrt(rake.raked) * 2.5);
		for (const leaf of rake.heap) {
			this.#paintLeaf(
				ctx,
				rakeX + 4 + leaf.ahead * heapWidth,
				floor - 4 - leaf.up * heapHeight * (1 - leaf.ahead * 0.6),
				leaf.size,
				leaf.rotation + time * 0.6,
				1,
				0.7,
				PILE_ALPHA,
				leaf.color,
				leaf.shape,
			);
		}

		// Ghost, floating and bobbing just above the floor.
		const baseY = floor - 14 + Math.sin(time * 3) * 4;

		// Rake: handle from the ghost's hand down to a toothed head on the ground.
		const headX = rakeX + Math.sin(time * 9) * 3;
		ctx.setTransform(this.#dpr, 0, 0, this.#dpr, 0, 0);
		ctx.globalAlpha = 1;
		ctx.lineCap = "round";
		ctx.strokeStyle = "#8b5a2b";
		ctx.lineWidth = 3;
		ctx.beginPath();
		ctx.moveTo(rake.x + 20, baseY - 26);
		ctx.lineTo(headX, floor - 6);
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(headX, floor - 16);
		ctx.lineTo(headX, floor - 1);
		ctx.stroke();
		ctx.lineWidth = 1.5;
		for (let tooth = 0; tooth < 5; tooth++) {
			const y = floor - 15 + tooth * 3.5;
			ctx.beginPath();
			ctx.moveTo(headX, y);
			ctx.lineTo(headX + 5, y + 1);
			ctx.stroke();
		}

		this.#paintGhost(rake.x, baseY);
	}

	/** A small sheet ghost facing right, centered at x with its hem at y. */
	#paintGhost(x: number, y: number) {
		const ctx = this.#front;
		const w = 22;
		const wave = this.#time * 8;
		ctx.setTransform(this.#dpr, 0, 0, this.#dpr, 0, 0);
		ctx.globalAlpha = 1;
		ctx.translate(x, y);

		// Body: round head, straight sides, wavy hem.
		ctx.shadowColor = "rgba(255, 240, 220, 0.6)";
		ctx.shadowBlur = 14;
		ctx.fillStyle = "#f6efe3";
		ctx.beginPath();
		ctx.moveTo(-w, 0);
		ctx.lineTo(-w, -34);
		ctx.arc(0, -34, w, Math.PI, 0);
		ctx.lineTo(w, 0);
		for (let i = 0; i < 4; i++) {
			const x0 = w - i * ((2 * w) / 4);
			const x1 = x0 - (2 * w) / 4;
			const dip = 6 + Math.sin(wave + i) * 2;
			ctx.quadraticCurveTo((x0 + x1) / 2, dip, x1, 0);
		}
		ctx.closePath();
		ctx.fill();
		ctx.shadowBlur = 0;

		// Little arm.
		ctx.beginPath();
		ctx.ellipse(w - 2, -26, 7, 4, -0.5, 0, Math.PI * 2);
		ctx.fill();

		// Face, looking right.
		ctx.fillStyle = "#1a1310";
		for (const side of [-1, 1]) {
			ctx.beginPath();
			ctx.ellipse(3 + side * 7, -36, 3, 4.5, 0, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.beginPath();
		ctx.ellipse(3, -25, 2.5, 3.2, 0, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = "rgba(255, 138, 140, 0.45)";
		for (const side of [-1, 1]) {
			ctx.beginPath();
			ctx.ellipse(3 + side * 12, -29, 3.5, 2.2, 0, 0, Math.PI * 2);
			ctx.fill();
		}
	}

	#save = () => {
		if (!this.#dirty) return;
		this.#dirty = false;
		try {
			sessionStorage.setItem(
				STORAGE_KEY,
				JSON.stringify(
					this.#settled.map((leaf) => [
						+leaf.x.toFixed(4),
						+leaf.h.toFixed(1),
						+leaf.size.toFixed(1),
						+leaf.rotation.toFixed(2),
						+leaf.squash.toFixed(2),
						leaf.color,
						leaf.shape,
					]),
				),
			);
		} catch {
			// Storage full or blocked; the pile just won't persist.
		}
	};
}

function load(): SettledLeaf[] {
	try {
		const raw = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "[]");
		if (!Array.isArray(raw)) return [];
		return raw
			.filter((entry) => Array.isArray(entry) && entry.length === 7)
			.slice(0, MAX_SETTLED)
			.map(([x, h, size, rotation, squash, color, shape]) => ({
				x,
				h,
				size,
				rotation,
				squash,
				color: color % LEAF_COLORS.length,
				shape: shape % LEAF_SHAPE_NAMES.length,
			}));
	} catch {
		return [];
	}
}
