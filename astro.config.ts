import { defineConfig } from "astro/config";
import { remarkDatePlugin } from "./src/utils/remarkDatePlugin.js";

export default defineConfig({
  markdown: {
    remarkPlugins: [remarkDatePlugin]
  }
});
