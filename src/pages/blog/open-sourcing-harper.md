---
layout: ../../layouts/PostLayout.astro
title: "Open Sourcing Harper"
pubDate: 2026-04-15T12:00:00-06:00
editDate: 2026-04-15T12:00:00-06:00
description: "How Harper went from a decade of closed-source development to an open source core and source-available pro tier — the decisions, the dual-license model, and what open source means in the agentic era."
---

## Before Harper

Open source is more than just sharing code. It's how I became a developer.

My first open source contribution was at a Node.js Code & Learn event in 2016. I showed up not really knowing what to expect, and walked away completing two contributions, a [test update](https://github.com/nodejs/node/pull/9923) and a [fs module fix](https://github.com/nodejs/node/pull/10041). I was able to complete this not because I was some prestigious engineer, but because the maintainers had made that first contribution easy and welcoming. Their clear guidance, willingness to mentor, and encouragement to contribute turned into the foundation for my software engineering and open source career.

From there I found Fastify, largely because of the openness of Matteo Collina. His advice was simple: "just get involved. Show up in the repository and opportunity will present itself." So I did. And then everything else followed, years of contributions leading to becoming a proper maintainer of Fasitfy, contributions to Node.js core, work on the Undici HTTP client and the Fetch API, involvement with the OpenJS Foundation, and eventually standards work with ECMA's WinterTC (TC55). Each step built on the last, and each community reinforced the same lesson: open source works when people are deliberately welcoming, when participation is straightforward, and when showing up consistently actually matters.

I share all of this because it is the foundation for how we approached open sourcing Harper. These aren't abstract principles we read about, they're patterns I've lived through. Being explicitly open and inviting so that trust forms naturally. Building consistency so people stick around. Every decision we've made in Harper's open source journey connects back to these ideas.

## Where We Started

Harper has been in production for nearly a decade as a closed-source, distributed application platform. It collapses database, cache, messaging, and application runtime into a single process. A unified architecture that delivers the kind of performance our enterprise customers depend on.

But we recognized a pattern in our own growth. We saw where adoption stalled. We saw what potential users needed before they could commit. And we saw a clear opportunity: open sourcing the core would unlock the kind of trust, experimentation, and community-driven momentum that closed source simply can't achieve.

This was not a decision we took lightly. Getting it wrong would mean starting from a fractured foundation — losing trust before we'd even built it. It was important to me personally, and it was important to the entire Harper team, that we did this right.

## JSConf and Going Open

In October 2025, we [announced at JSConf North America](https://www.harper.fast/resources/harper-is-officially-open-source) that Harper was going open source. At the time, we open sourced the in-development v5 repository and shared our plans for where we were headed. It was the beginning of the journey, not the end of it.

That initial step was deliberate. We wanted the community to see the code, follow along as we built, and start forming trust around the project from day one. We weren't publishing a finished product and walking away. We were inviting people in.

## Harper and Harper Pro

Today, with the release of Harper v5, we're excited to share the full picture.

[`harper`](https://www.npmjs.com/package/harper) is the open source core, licensed under [Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0.txt). This is the complete foundational system. The unified application platform that makes everything else possible. It's available for anyone to build with, experiment on, learn from, and contribute to. No restrictions, no asterisks.

[`harper-pro`](https://www.npmjs.com/package/@harperfast/harper-pro) is now source-available under the [Elastic License v2 (ELv2)](https://www.elastic.co/licensing/elastic-license). All of the advanced capabilities that existing Harper customers know and depend on, the enterprise features built on top of that core, are available for anyone to read, evaluate, and use. The only restrictions are narrow: you can't use harper-pro to offer a competing managed service. That's it.

This is the first version of Harper where the entire source is available. From the open source core to the source-available pro edition. We believe this structure builds trust because it's honest. The core is genuinely open source. The commercial layer is transparent about what it is and why it exists. There's no ambiguity about where one ends and the other begins.

We chose this dual-license model intentionally. Apache 2.0 for the core gives the community real freedom, and yes, that includes the freedom to fork. We're at peace with that. If someone can out-build us using our own open core, that's a signal to be better, not to lock things down. ELv2 for the pro tier protects the business in a way that's concise, well-understood, and battle-tested. This is what keeps Harper sustainable as both a project and a company, and sustainability is what makes open source durable.

## Why This Matters in the Agentic Era

Harper is a unified runtime platform. Database, cache, messaging, and application logic all in one system, one process. That architectural decision has always been about performance, but it takes on new significance in the age of AI agents.

When an AI agent needs to interact with your infrastructure, every additional service it has to stitch together is another point of failure, another integration to manage, another set of docs to parse. Harper collapses that complexity. An agent can work with one platform and fully lean into the optimizations that are only possible when everything is combined. As AI platforms evolve toward building "[super apps](https://gafowler.medium.com/evolution-of-gen-ai-superapps-to-hyperapps-40218ddadc79)," Harper is positioned as a "super platform" where you don't have to manage multiple processes or services.

And here's where open source becomes even more valuable: agents can read the code. Just like human developers who "read the source" have the deepest understanding of how a system works, AI benefits from that same transparency. Open source and source-available code gives AI-driven development tools direct access to understand how to build with Harper — not just from documentation, but from the implementation itself.

## A Note on AI and Open Source

While we're excited about AI's role in the ecosystem, it's worth being direct about the challenges too.

Spam is nothing new to open source. AI-generated nonsense is no different from the low-effort spam maintainers have dealt with for years, it's just arriving faster and in higher volume. The response is the same as it's always been: abide by quality community guidelines and ensure actual human work is appreciated.

Our position is straightforward. AI-assisted development is welcome. AI-generated contributions, fully autonomous agents opening pull requests with no human review, are not. The distinction matters. If you're using AI to help you write code, write tests, or draft documentation, that's part of the modern developer toolkit. But you, the human, are responsible for what gets submitted. Validate your work, understand what you're contributing, and stand behind it.

## What's Next

In May, I'll be speaking at the [Linux Foundation Open Source Summit + Embedded Linux Conference North America](https://events.linuxfoundation.org/open-source-summit-north-america/) in Minneapolis, presenting "[Building Sustainable Open Source: The Harper Story](/talks/building-sustainable-open-source-the-harper-story)." It's the first time we're sharing the full execution story publicly, the business decisions, the technical challenges, and the ongoing work of maintaining both open source momentum and commercial success.

> If you're a conference organizer, engineering leader, or founder interested in this topic, the full talk details, descriptions, and booking information are on the [talk page](/talks/building-sustainable-open-source-the-harper-story).

But the story isn't just mine to tell. I became a developer because of open source. Open source communities opened doors for me, and the people in those communities made it possible for me to walk through them. Now it's our turn to do the same. Not just leaving the door open behind us, but actively making it more inviting and accessible.

Harper is building in the open right now. We have an exploding ecosystem, from the docs site, to plugins, to applications, to AI integrations, to the core repository itself. We're shifting our engineering practices to be open-first in both our GitHub and Discord community spaces. Come get involved.

**Get started:**

- [Harper on GitHub](https://github.com/HarperFast/harper)
- [Harper Fabric](https://fabric.harper.fast)
- [Join our Discord](https://harper.fast/discord)