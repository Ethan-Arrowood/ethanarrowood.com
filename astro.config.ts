import { defineConfig } from "astro/config";
import { remarkDatePlugin } from "./src/utils/remarkDatePlugin.js";
import { remarkAlert } from "remark-github-blockquote-alert";

export default defineConfig({
  markdown: {
    remarkPlugins: [remarkDatePlugin, remarkAlert],
  }
});
