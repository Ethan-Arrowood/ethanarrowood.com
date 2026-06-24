---
layout: "../../layouts/TalkLayout.astro"
title: "How to ship a registry when nobody wants to run one"
description: "TC55 (formerly WinterCG) needed a registry of runtime keys but had no interest in operating registry infrastructure. Co-presented with Aki Rose Braun, this talk shows how we shipped it as an Ecma Technical Report: a standards-backed, usable resource with no operational burden."
audienceLevel: "Intermediate"
events:
  - name: "Web Engines Hackfest 2026"
    date: "June 15, 2026"
    eventUrl: "https://webengineshackfest.org/"
    slidesUrl: "https://webengineshackfest.org/slides/how_to_ship_a_registry_when_nobody_wants_to_run_one_by_aki_rose_braun_and_ethan_arrowood.pdf"
---

## Description

Co-presented with Aki Rose Braun at the Web Engines Hackfest in A Coruña.

TC55 (formerly WinterCG) works on common APIs across JavaScript runtimes. Part of that work needs a registry of runtime keys: stable identifiers that tools and specifications can reference. The catch is that nobody wanted to run a registry. Standing up registry infrastructure means hosting, uptime, governance, and long-term maintenance, and none of that was a good fit for a standards group.

Instead of building infrastructure, we published the registry as an Ecma Technical Report. The report is the registry: versioned, standards-backed, and citable, without any servers to operate. This talk walks through how we arrived at that approach, what the Technical Report process looks like in practice, and the trade-offs of treating a published document as a registry.

## Slides

There is no recording. [Slides are available as a PDF](https://webengineshackfest.org/slides/how_to_ship_a_registry_when_nobody_wants_to_run_one_by_aki_rose_braun_and_ethan_arrowood.pdf).
