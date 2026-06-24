---
layout: "../../layouts/TalkLayout.astro"
title: "Building Sustainable Open Source: The Harper Story"
description: "A practical account of open sourcing a near-decade-old commercial database system: the business decisions that made it viable, the technical realities of the transition, and how Harper is maintaining both open source momentum and commercial success."
audienceLevel: "Any"
sessionFormat: "Adaptable to all time formats from 15 min to 45 min+"
events:
  - name: "Open Source Summit + Embedded Linux Conference North America 2026"
    date: "May 18, 2026"
    eventUrl: "https://events.linuxfoundation.org/open-source-summit-north-america/"
    talkUrl: "https://sched.co/2JQuD"
    videoUrl: "https://www.youtube.com/watch?v=IvyLMwMNU0g"
  - name: "Node.js Interactive @ Render ATL 2026"
    date: "August 12, 2026"
    eventUrl: "https://renderatl.com"
---

## Recording

Recorded at Open Source Summit North America 2026.

<div class="video-embed">
	<iframe
		src="https://www.youtube-nocookie.com/embed/IvyLMwMNU0g"
		title="Building Sustainable Open Source: The Harper Story"
		loading="lazy"
		allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
		referrerpolicy="strict-origin-when-cross-origin"
		allowfullscreen
	></iframe>
</div>

## Description

> This talk can be tailored for technical or business audiences. Both versions cover Harper's full open source story. The framing and depth of certain aspects shift depending on who's in the room.

### For Engineers and Technical Leaders

Early in 2025, the Harper team agreed that after nearly a decade of closed source development, we wanted to open source our core product. The challenge: how do we achieve this without disrupting feature development, customer trust, and our overall business success? In this talk, I will share Harper’s intimate story of open sourcing our core product while maintaining engineering excellence.

The initial lift brought challenges like splitting the main repository into multiple open, closed, and source-available distributions, deciding what technical debt to bring forward, and restructuring our build and testing systems. Today, we’re navigating the active development of the new distributions, while maintaining enterprise support; including licensing decisions, architecture composability, repository synchronization, and community development.

Open source ecosystems thrive when production systems can be sustainably maintained, not just published and abandoned. This talk is for engineers, technical leaders, and developer relations teams who want a realistic view of open sourcing production systems without sacrificing business viability or engineering quality.

### For Founders, Investors, and Developer Relations

Open sourcing a core product is easy to celebrate, but hard to initiate and sustain. This is a practical story about economic viability and how Harper open sourced our core product while protecting business health, funding continued engineering, and creating the conditions for durable community growth.

Geared towards founders, CTOs, investors, and developer relations and engineering managers, I share Harper’s intimate story of transforming our nearly decade-old, closed source code base into an actively growing open source community. I share what we learned from customer growth patterns, where adoption stalled, and how we recognized the potential of open source. From there, I dive deep into our execution strategy; separating the open source core from the commercial operations customers valued.

You’ll learn how licensing choices and clear boundaries between shapes trust, and how we approached the organizational and technical realities of moving a long-lived product into the open. If you're building or funding open source and need a sustainable model supporting profitability and momentum, this session offers a concrete path grounded in lived experiences.

---

## What You'll Learn

- How to evaluate business viability before committing to open source
- The dual-license model Harper chose (Apache 2.0 core + source-available pro tier) and why
- Technical challenges of splitting a long-lived codebase into multiple distributions
- How licensing boundaries build trust without sacrificing revenue
- What sustainable community development looks like in the early stages

## Benefits to the Ecosystem

Open source ecosystems are healthier when organizations sustainably contribute, not just publish code. Yet many efforts describe the end result without explaining how they got there, leaving teams uncertain about making the journey themselves.

This session shares Harper's complete open source story with concrete examples: business decisions that made it viable, technical challenges we faced during transition, and ongoing work maintaining both open source momentum and commercial success. By being transparent about both what worked and what we're navigating (monetization boundaries, licensing decisions, repository synchronization, and community development) this talk helps other teams avoid common traps like unclear commercialization plans, unsustainable technical debt, and trust gaps from ambiguous licensing.

Whether you're a founder evaluating feasibility, an engineering leader planning technical work, or developer relations building community, this talk offers adaptable practices grounded in real decisions. The outcome: more organizations confident they can open source without sacrificing their business or engineering excellence, leading to more durable projects, better-resourced maintainers, and stronger open source ecosystems.
