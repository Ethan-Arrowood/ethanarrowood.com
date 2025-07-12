import { defineConfig } from "astro/config";
import { remarkDatePlugin } from "./src/utils/remarkDatePlugin.js";
import { remarkAlert } from "remark-github-blockquote-alert";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

export default defineConfig({
	markdown: {
		remarkPlugins: [remarkDatePlugin, remarkAlert, remarkMath],
		rehypePlugins: [rehypeKatex]
	},
});
