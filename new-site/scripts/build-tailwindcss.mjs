import fs from "node:fs";
import path from "node:path";
import autoprefixer from "autoprefixer";
import postcss from "postcss";
import tailwindcss from "tailwindcss";

export async function buildTailwindCSS() {
	const inputCSSPath = path.join(import.meta.dirname, "../src/input.css");
	const outputCSSPath = path.join(import.meta.dirname, "../site/styles.css");
	const css = await fs.promises.readFile(inputCSSPath);
	const result = await postcss([autoprefixer, tailwindcss]).process(css, {
		from: inputCSSPath,
		to: outputCSSPath,
	});
	await fs.promises.writeFile(outputCSSPath, result.css);
}
