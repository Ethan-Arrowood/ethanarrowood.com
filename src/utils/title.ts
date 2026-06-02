// Helpers for rendering post titles. Titles come from frontmatter as plain
// text, so any `inline code` spans need explicit handling.

const escapeHtml = (s: string) =>
	s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Render `inline code` spans in a title as <code> elements. All other text is
 * HTML-escaped, so the result is safe to use with Astro's `set:html`.
 */
export const renderInlineCode = (s: string) =>
	s
		.split(/(`[^`]+`)/g)
		.map((part) =>
			/^`[^`]+`$/.test(part)
				? `<code>${escapeHtml(part.slice(1, -1))}</code>`
				: escapeHtml(part),
		)
		.join("");

/** Strip backticks for plain-text contexts (`<title>`, Open Graph meta). */
export const stripCode = (s: string) => s.replace(/`/g, "");
