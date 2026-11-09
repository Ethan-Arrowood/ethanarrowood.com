// Live reload for the static slide decks in public/, during `astro dev` only.
//
// Decks are plain HTML/CSS/JS served verbatim (see any slides/dais/VENDORED.md
// for why they're static and vendored), so Astro's own HMR doesn't see them.
// This integration injects a small client into every HTML file served from
// public/ and tells it when anything under public/ changes. It does nothing
// at build time: decks still ship exactly as committed.
//
// Run `npm run dev`, open the deck you're editing, e.g.
//   http://localhost:4321/talks/<talk-slug>/<event-or-edition-slug>/slides/
// then edit its index.html / CSS / dais files and the browser updates.

import { watch } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { join, normalize, sep } from "node:path";

const RELOAD_PATH = "/__deck-reload";

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
    const es = new EventSource("/__deck-reload");
    es.onmessage = (e) => onChange(e.data);
    es.onerror = () => { es.close(); setTimeout(connect, 500); };
  };
  connect();
})();
</script>`;

// Resolve a request path to an HTML file in public/, or null. Blocks path
// traversal and maps directory URLs to their index.html.
async function publicHtml(root, path) {
	let file = normalize(join(root, path));
	if (file !== root && !file.startsWith(root + sep)) return null;
	let info = await stat(file).catch(() => null);
	if (info?.isDirectory()) {
		file = join(file, "index.html");
		info = await stat(file).catch(() => null);
	}
	return info?.isFile() && /\.html?$/i.test(file) ? file : null;
}

/** @returns {import("astro").AstroIntegration} */
export default function deckLiveReload() {
	return {
		name: "deck-live-reload",
		hooks: {
			"astro:server:setup": ({ server, logger }) => {
				const root = normalize(server.config.publicDir).replace(/\/$/, "");
				const clients = new Set();

				server.middlewares.use(async (req, res, next) => {
					const path = decodeURIComponent((req.url || "/").split("?")[0]);

					// Server-Sent Events channel the reload client subscribes to.
					if (path === RELOAD_PATH) {
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

					const file = await publicHtml(root, path);
					if (!file) return next();
					const html = await readFile(file, "utf8");
					res.writeHead(200, {
						"Content-Type": "text/html; charset=utf-8",
						"Cache-Control": "no-store",
					});
					res.end(
						html.includes("</body>")
							? html.replace("</body>", `${RELOAD_CLIENT}</body>`)
							: html + RELOAD_CLIENT,
					);
				});

				// Tell every open deck what changed (debounced). The client uses the
				// path to decide between an in-place morph (.html) and a full reload.
				let timer;
				let changed = "";
				const watcher = watch(root, { recursive: true }, (_event, filename) => {
					if (filename) changed = filename.split(sep).join("/");
					clearTimeout(timer);
					timer = setTimeout(() => {
						const data = changed || "reload";
						for (const res of clients) res.write(`data: ${data}\n\n`);
						changed = "";
					}, 60);
				});
				server.httpServer?.on("close", () => {
					watcher.close();
					for (const res of clients) res.end();
				});

				logger.info("Live reload on for HTML in public/ (slide decks)");
			},
		},
	};
}
