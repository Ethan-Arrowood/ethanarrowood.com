import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import { unified } from "@astrojs/markdown-remark";
import { remarkDatePlugin } from "./src/utils/remarkDatePlugin.js";
import { remarkAlert } from "remark-github-blockquote-alert";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";

export default defineConfig({
	site: "https://ethanarrowood.com",
	// Astro 7 defaults to JSX whitespace rules, which drop spaces between inline
	// elements written on separate lines. Keep HTML whitespace semantics.
	compressHTML: true,
	integrations: [mdx()],
	markdown: {
		processor: unified({
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
		}),
		shikiConfig: {
			theme: "github-light",
			// Code is easier to read not-wrapped on mobile
			wrap: false,
		},
	},
});
