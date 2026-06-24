---
layout: "../../layouts/TalkLayout.astro"
title: "Performant, Parallelizable, Framework Agnostic Node.js Integration Testing"
description: "How I built the Harper Integration Testing framework to run integration tests in parallel across any test framework: process isolation, dynamic port allocation, and a framework-agnostic API that works on local machines, multiple operating systems, and CI."
audienceLevel: "Any"
sessionFormat: "Adaptable to all time formats from 15 min to 45 min+"
events:
  - name: "NodeConf EU 2026"
    date: "September 29, 2026"
    eventUrl: "https://nodeconf.eu"
---

## Description

Testing a collapsed-stack system is a fundamentally different challenge than testing a conventional web service. Harper is an open-source, Node.js application platform with database, networking, file system, CLI, applications and plugins, all wrapped up into one system. Harper runs as a single process, and uses workers for parallelization and overall performance. All in all, the complexity of Harper makes it difficult to efficiently integration test. How do we parallelize test executions when each test requires its own Harper process? How do we ensure these processes do not try to use conflicting HTTP ports? How does all of this work across various development environments like our local dev machines, different operating systems, and CI environments? How can we implement all of this in a test framework agnostic way so that it can integrate with various test frameworks for different purposes (API application testing with Node.js test runner, web application testing with Playwright, etc.)?

In this talk, I will answer all of these questions and more about how I developed the Harper Integration Testing framework (@harperfast/integration-testing) for efficiently executing integration tests for the Harper platform. I will walk through the optimization research I did for determining the best default parallelization configuration, the architecture and design principles that went into the test-framework agnostic API design, and two actual test framework integration implementations, one with Node.js Test Runner and the other with Playwright. Attendees will walk away with patterns for integrating testing, process isolation and management, dynamic port allocation, and framework-agnostic API design that apply well beyond Harper.

## What You'll Learn

- Why a collapsed-stack system is harder to integration test than a conventional web service
- How to parallelize tests that each require their own dedicated process
- Dynamic port allocation strategies that avoid conflicts across parallel processes
- The optimization research behind choosing a default parallelization configuration
- How to make all of this work consistently across local machines, operating systems, and CI
- Design principles for a framework-agnostic testing API, demonstrated with Node.js Test Runner and Playwright integrations
