// Enforce that public/media/ is append-only (see scripts/media-add.mjs).
//
// 1. Every file's name carries a hash of its contents, so an edited file no
//    longer matches its name.
// 2. With a base ref (CI passes the pull request's base), no committed change
//    since the branch left that base may delete or rename a file.
//
//   npm run media:check
//   npm run media:check -- origin/main

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const MEDIA_DIR = fileURLToPath(new URL("../public/media", import.meta.url));
const NAME = /^[a-z0-9-]+\.([0-9a-f]{10})\.[a-z0-9]+$/;

const errors = [];

let files = [];
try {
	files = await readdir(MEDIA_DIR);
} catch (err) {
	if (err.code !== "ENOENT") throw err;
}

for (const file of files) {
	const match = NAME.exec(file);
	if (!match) {
		errors.push(`${file}: not named <slug>.<hash>.<ext>; use media:add`);
		continue;
	}
	const bytes = await readFile(join(MEDIA_DIR, file));
	const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 10);
	if (hash !== match[1]) {
		errors.push(`${file}: contents changed (hash is now ${hash})`);
	}
}

const base = process.argv[2];
if (base) {
	const removed = execFileSync(
		"git",
		[
			"diff",
			"--name-only",
			"--diff-filter=DR",
			`${base}...HEAD`,
			"--",
			"public/media/",
		],
		{ encoding: "utf8" },
	)
		.split("\n")
		.filter(Boolean);
	for (const file of removed) {
		errors.push(`${file}: deleted or renamed since ${base}`);
	}
}

if (errors.length > 0) {
	console.error("public/media/ is append-only:");
	for (const error of errors) console.error(`  ${error}`);
	process.exit(1);
}

console.log(`public/media/: ${files.length} files OK`);
