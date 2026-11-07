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
	// The Harper integration testing presentation moved into the testing talk
	// as its 2026-q4 edition. Its old bare path was shared; send it to the deck.
	redirects: {
		"/harper-integration-testing-framework-development-and-impact-analysis":
			"/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/slides/",
	},
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
			// Dark colors are applied by src/styles/themes.css for dark themes.
			themes: {
				light: "github-light",
				dark: "github-dark",
			},
			// Code is easier to read not-wrapped on mobile
			wrap: false,
		},
	},
});
