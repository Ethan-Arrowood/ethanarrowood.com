// Falling leaves that collect into a pile at the bottom of the page.
//
// Leaves fall through the viewport. The pile sits at the end of the document,
// behind the footer, so it never covers content. While the end of the page is
// off screen, leaves that fall past the bottom of the viewport still land on the
// pile, so it keeps growing and is there when the visitor scrolls down.
//
// Falling leaves are simulated and drawn every frame. Once a leaf lands it is
// painted onto an offscreen "pile" canvas and removed from the simulation, so
// the per-frame cost depends only on the number of falling leaves, not on the
// size of the pile. A height map (one value per few pixels of width) tracks the
// pile surface so new leaves land on top of earlier ones and slide off steep
// spots, which shapes the pile into mounds.
//
// The pile is saved to sessionStorage so it carries across page navigations.

import { LEAF_COLORS, LEAF_SHAPES, LEAF_SHAPE_NAMES } from "./leaves";

const COLUMN_WIDTH = 4;
const STORAGE_KEY = "leaf-pile";
const MAX_SETTLED = 900;
const FALLING_ALPHA = 0.6;
const PILE_ALPHA = 0.75;
const FADE_SECONDS = 2;
/** Tallest the pile grows; leaves that land above it fade out instead. */
const MAX_PILE_HEIGHT = 90;
/** Height of the offscreen pile canvas, with room for leaves on top. */
const PILE_CANVAS_HEIGHT = MAX_PILE_HEIGHT + 40;

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

const random = (min: number, max: number) => min + Math.random() * (max - min);
const randomIndex = (length: number) => Math.floor(Math.random() * length);

export class LeafPile {
	#canvas: HTMLCanvasElement;
	#ctx: CanvasRenderingContext2D;
	#pile = document.createElement("canvas");
	#pileCtx = this.#pile.getContext("2d")!;
	#shapes = LEAF_SHAPE_NAMES.map((name) => new Path2D(LEAF_SHAPES[name]));
	#falling: FallingLeaf[] = [];
	#settled: SettledLeaf[] = [];
	#heights = new Float32Array(0);
	#width = 0;
	#height = 0;
	#dpr = 1;
	#frame = 0;
	#lastTime = 0;
	#dirty = false;

	constructor(canvas: HTMLCanvasElement) {
		this.#canvas = canvas;
		this.#ctx = canvas.getContext("2d")!;
		this.#settled = load();
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
		this.#ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
	}

	#targetCount() {
		return Math.round(Math.min(40, Math.max(12, this.#width / 45)));
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
		this.#canvas.width = Math.round(width * dpr);
		this.#canvas.height = Math.round(height * dpr);
		this.#pile.width = Math.round(width * dpr);
		this.#pile.height = Math.round(PILE_CANVAS_HEIGHT * dpr);
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
		if (surface >= MAX_PILE_HEIGHT || this.#settled.length >= MAX_SETTLED) {
			// The pile is full; let this leaf rest briefly, then fade away.
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
	}

	#paintSettled(leaf: SettledLeaf) {
		const ctx = this.#pileCtx;
		const scale = leaf.size / 100;
		ctx.setTransform(this.#dpr, 0, 0, this.#dpr, 0, 0);
		ctx.translate(leaf.x * this.#width, PILE_CANVAS_HEIGHT - leaf.h);
		ctx.rotate(leaf.rotation);
		ctx.scale(scale, scale * leaf.squash);
		ctx.translate(-50, -50);
		ctx.globalAlpha = PILE_ALPHA;
		ctx.fillStyle = LEAF_COLORS[leaf.color]!;
		ctx.fill(this.#shapes[leaf.shape]!);
	}

	#tick = (now: number) => {
		// Clamp so a background tab doesn't teleport every leaf on return.
		const dt = Math.min((now - this.#lastTime) / 1000, 0.05);
		this.#lastTime = now;
		const ctx = this.#ctx;
		// The end of the page, in viewport coordinates.
		const floor = document.documentElement.scrollHeight - scrollY;
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
		if (floor - PILE_CANVAS_HEIGHT < this.#height) {
			ctx.drawImage(this.#pile, 0, (floor - PILE_CANVAS_HEIGHT) * this.#dpr);
		}

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
				// Past the bottom of the viewport means the end of the page is
				// further down; land there without drawing the rest of the fall.
				if (leaf.y + leaf.size * 0.3 >= surface || leaf.y > this.#height + 40) {
					this.#land(leaf);
				} else if (leaf.x < -40 || leaf.x > this.#width + 40) {
					Object.assign(leaf, this.#spawn());
				}
			}
			this.#paintFalling(leaf);
		}

		// Adjust the count after resizes.
		const target = this.#targetCount();
		while (this.#falling.length < target) this.#falling.push(this.#spawn());
		if (this.#falling.length > target) this.#falling.length = target;

		this.#frame = requestAnimationFrame(this.#tick);
	};

	#paintFalling(leaf: FallingLeaf) {
		const ctx = this.#ctx;
		const scale = leaf.size / 100;
		// Flipping the x scale makes the leaf look like it tumbles in 3D.
		const flip = Math.cos(leaf.phase * 1.7);
		ctx.setTransform(this.#dpr, 0, 0, this.#dpr, 0, 0);
		ctx.translate(leaf.x, leaf.y);
		ctx.rotate(leaf.rotation);
		ctx.scale(scale * flip, scale);
		ctx.translate(-50, -50);
		ctx.globalAlpha =
			leaf.fading === undefined
				? FALLING_ALPHA
				: (FALLING_ALPHA * leaf.fading) / FADE_SECONDS;
		ctx.fillStyle = LEAF_COLORS[leaf.color]!;
		ctx.fill(this.#shapes[leaf.shape]!);
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
