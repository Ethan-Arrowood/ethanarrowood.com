// Add images to the shared, append-only media folder (public/media/).
//
// Slide decks are frozen static files, so they can't use Astro's image
// pipeline. Instead they reference optimized copies here by URL. Each file is
// named by a hash of its contents, so the same image always gets the same URL
// (decks share one file and one cached download) and a changed image always
// gets a new one (old decks never change). Never edit or delete files in
// public/media/; `npm run media:check` enforces it.
//
//   npm run media:add -- src/images/headshot.jpeg [more files...]
//   npm run media:add -- --max=2560 src/images/diagram.png
//
// Raster images are resized to fit within --max px (default 1920) on both
// sides, never enlarged, and re-encoded as WebP (lossless with --lossless).
// SVGs are copied as-is. Prints the URL to use for each file.

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const MEDIA_DIR = fileURLToPath(new URL("../public/media", import.meta.url));

const { values, positionals } = parseArgs({
	allowPositionals: true,
	options: {
		max: { type: "string", default: "1920" },
		quality: { type: "string", default: "82" },
		lossless: { type: "boolean", default: false },
	},
});

if (positionals.length === 0) {
	console.error("Usage: npm run media:add -- [--max=1920] <file...>");
	process.exit(1);
}

const max = Number(values.max);
const quality = Number(values.quality);

function hashName(name, bytes, ext) {
	const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 10);
	return `${name}.${hash}${ext}`;
}

function slug(file) {
	return basename(file, extname(file))
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

async function exists(path) {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

await mkdir(MEDIA_DIR, { recursive: true });

for (const file of positionals) {
	const input = await readFile(file);
	let output;
	let ext;
	let size = "";

	if (extname(file).toLowerCase() === ".svg") {
		output = input;
		ext = ".svg";
	} else {
		const { data, info } = await sharp(input, { animated: true })
			.rotate() // apply EXIF orientation before metadata is stripped
			.resize({
				width: max,
				height: max,
				fit: "inside",
				withoutEnlargement: true,
			})
			.webp(values.lossless ? { lossless: true } : { quality })
			.toBuffer({ resolveWithObject: true });
		output = data;
		ext = ".webp";
		size = ` ${info.width}x${info.pageHeight ?? info.height}`;
	}

	const name = hashName(slug(file), output, ext);
	const target = join(MEDIA_DIR, name);
	const existed = await exists(target);
	if (!existed) await writeFile(target, output);

	const kb = Math.round(output.length / 1024);
	const before = Math.round(input.length / 1024);
	console.log(
		`/media/${name}${size}, ${kb} KB (from ${before} KB)${existed ? ", already present" : ""}`,
	);
}
