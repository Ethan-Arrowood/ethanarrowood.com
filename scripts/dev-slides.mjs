// Zero-dependency live-reload dev server for the static decks in public/.
//
// The decks are plain HTML/CSS/JS served verbatim (see any slides/dais/VENDORED.md
// for why they're static and vendored). `astro dev` is for the site; this is for
// authoring decks: it serves public/ with no caching and full-page reload on save.
//
//   node scripts/dev-slides.mjs            # http://localhost:4321/
//   PORT=5000 node scripts/dev-slides.mjs
//
// Open the deck you're editing, e.g.
//   http://localhost:4321/talks/<slug>/slides/
// then edit its index.html / CSS / dais files and the browser reloads.

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { watch } from "node:fs";
import { join, extname, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../public", import.meta.url));
const PORT = Number(process.env.PORT) || 4321;

const MIME = {
	".html": "text/html; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".mjs": "text/javascript; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".svg": "image/svg+xml",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".webp": "image/webp",
	".ico": "image/x-icon",
	".woff2": "font/woff2",
	".woff": "font/woff",
	".ttf": "font/ttf",
};

// A tiny reload client, injected into every HTML response.
const RELOAD_CLIENT = `<script>
(() => {
  const connect = () => {
    const es = new EventSource("/__reload");
    es.onmessage = () => location.reload();
    es.onerror = () => { es.close(); setTimeout(connect, 500); };
  };
  connect();
})();
</script>`;

const clients = new Set();

const server = createServer(async (req, res) => {
	const path = decodeURIComponent((req.url || "/").split("?")[0]);

	// Server-Sent Events channel the reload client subscribes to.
	if (path === "/__reload") {
		res.writeHead(200, {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
		});
		res.write("retry: 500\n\n");
		clients.add(res);
		req.on("close", () => clients.delete(res));
		return;
	}

	// Resolve within ROOT, blocking path traversal.
	let filePath = normalize(join(ROOT, path));
	if (filePath !== ROOT && !filePath.startsWith(ROOT + sep)) {
		res.writeHead(403);
		return res.end("Forbidden");
	}

	let info = await stat(filePath).catch(() => null);
	if (info?.isDirectory()) {
		filePath = join(filePath, "index.html");
		info = await stat(filePath).catch(() => null);
	}
	if (!info) {
		res.writeHead(404, { "Content-Type": "text/plain" });
		return res.end(`404 Not found: ${path}`);
	}

	const ext = extname(filePath);
	// no-store everywhere so an edit is never masked by a cached response.
	const headers = {
		"Content-Type": MIME[ext] || "application/octet-stream",
		"Cache-Control": "no-store",
	};

	if (ext === ".html") {
		const html = await readFile(filePath, "utf8");
		const injected = html.includes("</body>")
			? html.replace("</body>", `${RELOAD_CLIENT}</body>`)
			: html + RELOAD_CLIENT;
		res.writeHead(200, headers);
		return res.end(injected);
	}

	res.writeHead(200, headers);
	res.end(await readFile(filePath));
});

// Watch public/ and push a reload to every open deck on any change (debounced).
let timer;
watch(ROOT, { recursive: true }, () => {
	clearTimeout(timer);
	timer = setTimeout(() => {
		for (const res of clients) res.write("data: reload\n\n");
	}, 60);
});

server.listen(PORT, () => {
	console.log(`Slides dev server → http://localhost:${PORT}/`);
	console.log(`Watching ${ROOT} · live reload on · caching off`);
});
