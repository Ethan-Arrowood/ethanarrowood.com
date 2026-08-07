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

// Live-update client, injected into every HTML response.
//
// For HTML edits (the usual slide-tweaking case) it updates the slides IN PLACE:
// it re-fetches the page and swaps each slide's inner content, the deck styles,
// and the footer, without touching scroll position or re-running dais.js — so the
// deck stays exactly on the slide you're viewing. It falls back to a full reload
// only when the slide structure changed (a slide added/removed/reordered) or a
// non-HTML file changed (dais.js, CSS, images), and that reload restores scroll
// instantly so it never starts at slide 1 and scrolls over.
const RELOAD_CLIENT = `<script>
(() => {
  const deck = () => document.querySelector(".dais");

  // --- Instant scroll restore across a full reload -------------------------
  try { history.scrollRestoration = "manual"; } catch (e) {}
  const saved = sessionStorage.getItem("__daisLeft");
  if (saved !== null) {
    sessionStorage.removeItem("__daisLeft");
    // Drop the hash so neither the browser nor dais.js smooth-scrolls to it.
    history.replaceState(null, "", location.pathname + location.search);
    const put = () => {
      const d = deck();
      if (!d) return;
      const prev = d.style.scrollBehavior;
      d.style.scrollBehavior = "auto";
      d.scrollLeft = +saved;
      d.style.scrollBehavior = prev;
    };
    put();
    addEventListener("DOMContentLoaded", put);
    addEventListener("load", () => requestAnimationFrame(put));
  }

  const reload = () => {
    const d = deck();
    if (d) sessionStorage.setItem("__daisLeft", d.scrollLeft);
    location.reload();
  };

  // Swap slide contents in place. Section ELEMENTS are preserved (only their
  // innerHTML changes), so dais.js's cached slide list and listeners stay valid
  // and scrollLeft is untouched.
  const morph = async () => {
    const d = deck();
    if (!d) return reload();
    let doc;
    try {
      const html = await (await fetch(location.href, { cache: "no-store" })).text();
      doc = new DOMParser().parseFromString(html, "text/html");
    } catch (e) { return reload(); }
    const nd = doc.querySelector(".dais");
    if (!nd) return reload();
    const cur = [...d.children].filter((el) => el.tagName === "SECTION");
    const next = [...nd.children].filter((el) => el.tagName === "SECTION");
    const sameShape =
      cur.length === next.length && cur.every((s, i) => s.id === next[i].id);
    if (!sameShape) return reload();

    const nStyle = doc.querySelector("head style");
    const cStyle = document.querySelector("head style");
    if (nStyle && cStyle && nStyle.textContent !== cStyle.textContent)
      cStyle.textContent = nStyle.textContent;

    const nFoot = doc.querySelector(".deck-footer");
    const cFoot = document.querySelector(".deck-footer");
    if (nFoot && cFoot && nFoot.innerHTML !== cFoot.innerHTML)
      cFoot.innerHTML = nFoot.innerHTML;

    if (nd.className !== d.className) d.className = nd.className;
    next.forEach((n, i) => {
      if (cur[i].className !== n.className) cur[i].className = n.className;
      if (cur[i].innerHTML !== n.innerHTML) cur[i].innerHTML = n.innerHTML;
    });
  };

  const onChange = (path) => {
    if (path && /\\.html?$/i.test(path)) morph();
    else reload();
  };

  const connect = () => {
    const es = new EventSource("/__reload");
    es.onmessage = (e) => onChange(e.data);
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

// Watch public/ and tell every open deck what changed (debounced). The client
// uses the path to decide between an in-place morph (.html) and a full reload.
let timer;
let changed = "";
watch(ROOT, { recursive: true }, (_event, filename) => {
	if (filename) changed = filename.split(sep).join("/");
	clearTimeout(timer);
	timer = setTimeout(() => {
		const data = changed || "reload";
		for (const res of clients) res.write(`data: ${data}\n\n`);
		changed = "";
	}, 60);
});

server.listen(PORT, () => {
	console.log(`Slides dev server → http://localhost:${PORT}/`);
	console.log(`Watching ${ROOT} · live reload on · caching off`);
});
