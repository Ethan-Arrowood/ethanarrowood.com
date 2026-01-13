import { defineConfig } from "astro/config";
import { remarkDatePlugin } from "./src/utils/remarkDatePlugin.js";
import { remarkAlert } from "remark-github-blockquote-alert";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";

export default defineConfig({
	markdown: {
		remarkPlugins: [remarkDatePlugin, remarkAlert, remarkMath],
		rehypePlugins: [
			rehypeKatex,
			rehypeSlug,
			[
				rehypeAutolinkHeadings,
				{
					behavior: "wrap",
				},
			],
		],
		shikiConfig: {
			theme: "github-light",
			wrap: false,
		},
	},
});
