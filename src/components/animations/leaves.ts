// Leaf shapes and colors shared by the leaf animations. Paths use a 100x100
// viewBox with the stem at the bottom center.

export const LEAF_SHAPES = {
	maple:
		"M50 4 58 24 72 16 68 38 90 33 79 50 94 58 70 63 75 80 55 69 52 96H48L45 69 25 80 30 63 6 58 21 50 10 33 32 38 28 16 42 24Z",
	oval: "M50 4C80 22 84 56 62 80 58 84 54 87 52 96H48C46 87 42 84 38 80 16 56 20 22 50 4Z",
	round:
		"M50 8C82 14 92 46 74 70 66 80 56 84 52 96H48C44 84 34 80 26 70 8 46 18 14 50 8Z",
};

export type LeafShape = keyof typeof LEAF_SHAPES;

export const LEAF_SHAPE_NAMES = Object.keys(LEAF_SHAPES) as LeafShape[];

/** Yellow through deep red. */
export const LEAF_COLORS = [
	"#f2c230",
	"#e8a317",
	"#e8731a",
	"#d4561b",
	"#b8321f",
	"#8f2416",
];

/** A CSS `url()` for masking an element into a leaf shape. */
export function leafMaskUrl(shape: LeafShape) {
	const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><path d='${LEAF_SHAPES[shape]}'/></svg>`;
	return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
