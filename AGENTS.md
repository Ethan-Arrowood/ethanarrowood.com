# AGENTS.md

Agent guide for [ethanarrowood.com](https://ethanarrowood.com), a personal website built with Astro.

## Project Overview

Static site deployed to GitHub Pages via GitHub Actions. No CMS; all content is Markdown files with frontmatter.

- **Framework**: Astro 7 with TypeScript (strict)
- **Node**: 26
- **Package manager**: npm
- **Domain**: ethanarrowood.com (CNAME)

## Commands

```sh
npm run dev    # local dev server
npm run build  # production build to ./dist
npm run start  # preview production build
npm run format # format with oxfmt
```

## Directory Structure

```
src/
├── components/       # Reusable Astro components
├── images/           # Static images
├── layouts/          # Page templates (Base, Post, Talk)
├── pages/
│   ├── index.astro   # Homepage
│   ├── blog.astro    # Blog listing
│   ├── talks.astro   # Talks listing
│   ├── blog/         # Blog post Markdown files
│   └── talks/        # Talk Markdown files
├── styles/
│   ├── post.css      # Blog post styles
│   └── talk.css      # Talk page styles
└── utils/
    ├── frontmatter.d.ts      # Blog post frontmatter type
    ├── talkfrontmatter.d.ts  # Talk frontmatter type
    └── remarkDatePlugin.ts   # Custom remark plugin (date formatting, America/Denver)
```

## Adding Content

### Blog post

Create `src/pages/blog/<slug>.md`:

```markdown
---
layout: ../../layouts/PostLayout.astro
title: "Post Title"
pubDate: 2026-01-01T12:00:00-06:00
editDate: 2026-01-01T12:00:00-06:00
description: "One or two sentence summary."
---

Content here.
```

- `pubDate` and `editDate` are ISO 8601. Both are required; if the post is new, set them to the same value.
- Dates are auto-formatted to "Month Day, Year" (America/Denver) by the remark plugin.
- `editDate` is only shown in the UI if it differs from `pubDate`.
- Posts are sorted newest-first on the listing page.

### Talk

Create `src/pages/talks/<slug>.md`:

```markdown
---
layout: "../../layouts/TalkLayout.astro"
title: "Talk Title"
description: "One or two sentence summary."
audienceLevel: "Any"
sessionFormat: "Adaptable to all time formats from 15 min to 45 min+"
events:
  - name: "Conference Name Year"
    date: "Month DD, YYYY"
    eventUrl: "https://..."
    talkUrl: "https://..."   # optional, schedule/talk page
    videoUrl: "https://..."  # optional, recording
    slidesUrl: "https://..." # optional, slides
editions:                     # optional, decks not tied to an event
  - name: "2027 edition"
    slidesUrl: "/talks/<talk-slug>/2027/slides/"
    draft: true               # optional, shows a "Draft" badge
---

Content here.
```

- `talkUrl` (schedule or talk page entry), `videoUrl` (recording), and `slidesUrl` (slides) are all optional per-event links.
- Talks are split into "upcoming" and "past" on the listing page based on event dates (a talk is "upcoming" if any of its events is in the future). On the talk page itself, each event also gets an "Upcoming"/"Past" badge, upcoming events sort first, and `videoUrl`/`slidesUrl` surface "Watch recording" / "Slides" links.
- `events` is optional. A talk with no events is listed under "In Development" on the listing page.
- `editions` lists versions of the deck that are not tied to an event, such as a new edition in development. Each shows on the talk page with a "Slides" link, after the events. `draft: true` adds a "Draft" badge.
- **Embedding a video** in a talk body: use the `lite-youtube` web component, not a raw `<iframe>`. It renders a thumbnail and only loads the YouTube iframe on click (no third-party JS/cookies until play). `TalkLayout.astro` already registers the component, so just drop it into the Markdown body:

  ```html
  <lite-youtube videoid="VIDEO_ID" videotitle="Talk Title">
    <a href="https://www.youtube.com/watch?v=VIDEO_ID" class="lite-youtube-fallback" target="_blank" rel="noreferrer">
      Watch "Talk Title" on YouTube
    </a>
  </lite-youtube>
  ```

  `videoid` is the `v=` value from a watch URL. For a playlist (e.g. the homepage embed in `index.astro`), add `playlistid` (the `list=` value from a playlist URL).

Some talks slides are stored as static assets within the `public/talks/` directory. That directory copies the expected output path for talk pages, with one folder per event so each delivery of a talk keeps its own deck: `public/talks/<talk-slug>/<event-slug>/slides/`. The event slug is the event's `name` lowercased, with punctuation dropped and spaces turned into hyphens.

For example, the talk "Performant, Parallelizable, Framework Agnostic Node.js Integration Testing" has its talk page at `ethanarrowood.com/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing`, sourced from `src/pages/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing.md`. Its deck for "Node.js Interactive @ Render ATL 2026" lives in `public/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/nodejs-interactive-render-atl-2026/slides/` and is served at `ethanarrowood.com/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/nodejs-interactive-render-atl-2026/slides/`. Point that event's `slidesUrl` at the same path.

That deck used to live at `.../performant-parallelizable-framework-agnostic-nodejs-integration-testing/slides/`. A small redirect page stays there (keeping the `#slide` hash) because the old URL was shared. Keep redirects like it when moving a deck that has been shared.

An edition's deck lives beside the event folders, in a folder named by its edition slug: `public/talks/<talk-slug>/<edition-slug>/slides/`. For example, a "2027 edition" lives in `public/talks/<talk-slug>/2027/slides/`. A draft deck's `index.html` carries `<meta name="robots" content="noindex">`; remove it once the edition is final. When an edition is presented at an event, copy its folder into that event's folder and point the event's `slidesUrl` at the copy. The event keeps the deck as presented while the edition keeps changing.

Slides exported as a PDF go in the same event folder as `slides.pdf`, for example `public/talks/nodejs-code-and-learn/nodejs-interactive-render-atl-2026/slides.pdf`, with the event's `slidesUrl` pointing at it.

These slide decks may use Ethan's personal HTML+CSS based presentation framework, Dais. The framework is individually vendored into each slide directory in order to avoid existing/past presentations breaking whenever the framework is updated.

## Key Patterns

- **Content discovery**: `import.meta.glob()` in listing pages (`blog.astro`, `talks.astro`). New files are auto-included.
- **Styling**: CSS variables in `BaseLayout.astro`. No CSS framework. Scoped styles in `.astro` files, shared post/talk styles in `src/styles/`.
- **Markdown plugins**: remark (dates, math, GitHub alerts) + rehype (KaTeX, slug, autolink headings, Shiki syntax highlighting with `github-light`).
- **Code blocks**: Copy-to-clipboard buttons injected client-side in `PostLayout.astro`; excluded for `plain-text`, `bash`, and `terminal` blocks.
- **Table of contents**: `TableOfContents.astro` auto-generates from h2/h3 headings.
- **Formatting**: [oxfmt](https://oxc.rs/docs/guide/usage/formatter.html) with tabs and 80 columns (`.oxfmtrc.json`). `npm run format` to fix, `npm run format:check` to verify (CI runs this on pull requests). `public/` is ignored so vendored slide decks are never touched.

## Themes

Visitors pick a theme from the "theme" menu in the header (`ThemePicker.astro`). Preferences live in `localStorage` (`theme`: `system` or a theme id; `animations`: `on` or `off`).

- `src/utils/themes.ts` is the theme registry. Each theme has an `id`, `label`, `group` (`standard` or `special` for seasonal and fun themes), `scheme` (`light` or `dark`), and an optional background `animation`.
- `src/components/ThemeInit.astro` runs inline in `<head>` before first paint. It sets `data-theme`, `data-scheme`, and `data-animation` on `<html>`, and exposes `window.siteTheme` for the picker. Visitors who have not picked a theme get `DEFAULT_THEME` from `themes.ts` (currently `spooky`). `system` follows `prefers-color-scheme`. Animations default to on unless the visitor prefers reduced motion.
- `src/styles/themes.css` defines the color tokens per theme, the dark Shiki colors, and GitHub alert colors.
- Background animations live in `src/components/animations/` and are mounted by `BackgroundAnimation.astro`. Each renders hidden and shows itself when `<html data-animation>` matches its name. They render at the end of `<body>`, are fixed to the viewport, `aria-hidden`, and ignore pointer events.
  - `falling-leaves`: pure CSS leaves falling through the viewport. Not used by a theme right now.
  - `leaf-pile` (Spooky): canvas leaves that pile up along the bottom of the viewport. Falling leaves draw behind the content; the pile draws in front. A ghost peeks out from the left edge; clicking it (a real `<button>`, last in tab order) sends it across to rake the pile away. It also goes on its own when the pile averages 10% of the viewport height or peaks at 15%, then floats back to its spot. Settled leaves are painted once to an offscreen canvas, so cost stays flat as the pile grows. The pile persists across page navigations in `sessionStorage`. Leaf shapes and colors are shared in `animations/leaves.ts`.

To add a theme: add it to `themes.ts`, add a `:root[data-theme="<id>"]` block to `themes.css`, and check text contrast (WCAG AA, 4.5:1) for `--text-primary`, `--text-secondary`, and `--accent` against `--background` and `--surface`. To add an animation: create a component in `animations/`, mount it in `BackgroundAnimation.astro`, and reference its name from a theme.

## CSS Variables (from themes.css)

Light values shown. Use these tokens instead of hardcoded colors so every theme works.

| Variable           | Value                 | Use                             |
| ------------------ | --------------------- | ------------------------------- |
| `--background`     | `#f5f5f1`             | Page background                 |
| `--surface`        | `#fafaf9`             | Raised panels (TOC, theme menu) |
| `--card-bg`        | `var(--background)`   | Cards                           |
| `--accent`         | `#2d8b72`             | Links, highlights               |
| `--text-body`      | `#000000`             | Default body text               |
| `--text-primary`   | `#1a1a1a`             | Headings, primary text          |
| `--text-secondary` | `#666666`             | Metadata, secondary             |
| `--divider`        | `rgba(26,26,26,0.12)` | Thin rules                      |
| `--code-bg`        | `#d4d4d4`             | Inline code                     |
| `--shadow`         | `rgba(0,0,0,0.2)`     | Card and image shadows          |

## Writing Style Rules

These apply to all site content (blog posts, talk descriptions, page copy):

- No em dashes. Use semicolons, periods, or connective words instead.
- Succinct sentences. No filler words or padding.
- No significance inflation or AI-flavored vocabulary: avoid "additionally", "testament", "underscores", "showcasing", "delve", "navigate".
- No bold overuse. No sycophantic openers. No generic conclusions.
- State facts plainly. Surface constraints and trade-offs early.
- Keep language tight and direct.

## Accessibility

The site targets 100% accessibility. Use semantic HTML. Provide alt text for images. Maintain sufficient color contrast. If something breaks accessibility, fix it.

## Deployment

Push to `main` triggers the GitHub Actions workflow (`.github/workflows/deploy.yml`), which builds and deploys to GitHub Pages. No manual steps needed.
