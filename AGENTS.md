# AGENTS.md

Agent guide for [ethanarrowood.com](https://ethanarrowood.com), a personal website built with Astro.

## Project Overview

Static site deployed to GitHub Pages via GitHub Actions. No CMS; all content is Markdown files with frontmatter.

- **Framework**: Astro 6 with TypeScript (strict)
- **Node**: 24
- **Package manager**: npm
- **Domain**: ethanarrowood.com (CNAME)

## Commands

```sh
npm run dev    # local dev server
npm run build  # production build to ./dist
npm run start  # preview production build
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

- `pubDate` and `editDate` are ISO 8601. Both are required; if the post has never been edited, set them to the same value.
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
---

## Description

Content here.
```

- `talkUrl` is optional (schedule or talk page entry); `videoUrl` is optional (link to a recording).
- Talks are split into "upcoming" and "past" on the listing page based on event dates (a talk is "upcoming" if any of its events is in the future). On the talk page itself, each event also gets an "Upcoming"/"Past" badge, upcoming events sort first, and a `videoUrl` surfaces a "Watch recording" link.
- **Embedding a video** in a talk body: use the `lite-youtube` web component, not a raw `<iframe>`. It renders a thumbnail and only loads the YouTube iframe on click (no third-party JS/cookies until play). `TalkLayout.astro` already registers the component, so just drop it into the Markdown body:

  ```html
  <lite-youtube videoid="VIDEO_ID" videotitle="Talk Title">
    <a href="https://www.youtube.com/watch?v=VIDEO_ID" class="lite-youtube-fallback" target="_blank" rel="noreferrer">
      Watch "Talk Title" on YouTube
    </a>
  </lite-youtube>
  ```

  `videoid` is the `v=` value from a watch URL. For a playlist (e.g. the homepage embed in `index.astro`), add `playlistid` (the `list=` value from a playlist URL).

## Key Patterns

- **Content discovery**: `import.meta.glob()` in listing pages (`blog.astro`, `talks.astro`). New files are auto-included.
- **Styling**: CSS variables in `BaseLayout.astro`. No CSS framework. Scoped styles in `.astro` files, shared post/talk styles in `src/styles/`.
- **Markdown plugins**: remark (dates, math, GitHub alerts) + rehype (KaTeX, slug, autolink headings, Shiki syntax highlighting with `github-light`).
- **Code blocks**: Copy-to-clipboard buttons injected client-side in `PostLayout.astro`; excluded for `plain-text`, `bash`, and `terminal` blocks.
- **Table of contents**: `TableOfContents.astro` auto-generates from h2/h3 headings.
- **Formatting**: Prettier with tabs. Run on `.astro`, `.ts`, `.md` files.

## CSS Variables (from BaseLayout)

| Variable          | Value       | Use                   |
|-------------------|-------------|-----------------------|
| `--background`    | `#f5f5f1`   | Page background       |
| `--accent`        | `#2d8b72`   | Links, highlights     |
| `--text-primary`  | `#1a1a1a`   | Body text             |
| `--text-secondary`| `#666666`   | Metadata, secondary   |
| `--code-bg`       | `#d4d4d4`   | Inline code           |

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
