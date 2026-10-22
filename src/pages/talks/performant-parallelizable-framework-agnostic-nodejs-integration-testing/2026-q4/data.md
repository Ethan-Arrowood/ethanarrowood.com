---
layout: ../../../../layouts/PostLayout.astro
title: "Did it work? Data and method"
pubDate: 2026-10-22T12:00:00-06:00
editDate: 2026-10-22T12:00:00-06:00
description: "How every number in the impact section of the 2026 Q4 edition of my integration testing talk was measured, with the data and scripts to recompute it."
---

This page backs section 5, "Did it work?", of the 2026 Q4 edition of [Performant, Parallelizable, Framework Agnostic Node.js Integration Testing](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing) and the post [Parallel Node.js Integration Testing](/blog/parallel-nodejs-integration-testing). Each number has its own heading, so a slide or a sentence can link straight to it.

The data runs through **October 21, 2026** (UTC). "Last 30 days" means September 22 through October 21, 2026. Monthly series stop at September 2026, the last complete month. These are observations from one team's repositories over changing suites, not a controlled experiment.

> [!NOTE]
> To recompute everything, download the CSVs and the `scripts/` folder listed under [Files](#files), then run `python3 scripts/analyze.py`. It uses only the Python standard library and prints every number on this page; [`analysis.txt`](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/analysis.txt) is its output for this data. A few fixed facts about history are listed at the end of that output as static.

## Files

All files sit next to this page, under `/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/`. Only metadata is published, never code. Some of it comes from private HarperFast repositories, including the `harperdb` repository where the legacy suite started.

| File | What it holds |
| --- | --- |
| [`harper-integration-runs.csv`](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/harper-integration-runs.csv) | Every run of harper's `integration-tests.yml` (8,896 runs, Nov 4, 2025 to Oct 21, 2026) |
| [`harper-main-failed-runs.csv`](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/harper-main-failed-runs.csv) | Which jobs failed on the final attempt, for every main push run that didn't succeed |
| [`harper-window-runs.csv`](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/harper-window-runs.csv) | Every main push run in the last 30 days, and a 25% sample of first-attempt PR runs, with first-attempt wall time and failures |
| [`harper-timing-sample.csv`](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/harper-timing-sample.csv) | Wall time for 30 first-attempt main push runs and 30 PR runs per month |
| [`harper-shard-step-sample.csv`](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/harper-shard-step-sample.csv) | Per-shard test step time for the same runs |
| [`harper-green-run-shards.csv`](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/harper-green-run-shards.csv) | Test counts, durations, and Harper instances for each of the 36 shards of one green main run |
| [`harper-prs.csv`](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/harper-prs.csv) | Every PR merged to harper's main branch, classified by the files it changed |
| [`harper-test-growth.csv`](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/harper-test-growth.csv) | Test files and test cases on harper's main branch over time |
| [`harper-pro-test-growth.csv`](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/harper-pro-test-growth.csv), [`harper-pro-node-counts.csv`](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/harper-pro-node-counts.csv) | harper-pro integration and cluster test files, test cases, and nodes per cluster test |
| [`harper-pro-integration-runs.csv`](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/harper-pro-integration-runs.csv) | Every run of harper-pro's integration workflow |
| [`harper-nextjs-downstream-runs.csv`](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/harper-nextjs-downstream-runs.csv), [`harper-nextjs-downstream-sample.csv`](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/harper-nextjs-downstream-sample.csv) | Every run of harper's Next.js downstream check, and a 7.5% sample with outcomes |
| [`nextjs-suite.csv`](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/nextjs-suite.csv), [`npm.csv`](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/npm.csv), [`org-adoption.csv`](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/org-adoption.csv) | The Next.js plugin's suite size, npm versions and downloads, and repositories that import the package |
| [`harper-legacy-api-jobs.csv`](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/harper-legacy-api-jobs.csv) | Frozen. Legacy API test jobs in harper, for 452 main push runs, 396 PR runs, and 4 manual runs |
| [`harperdb-api-jobs.csv`](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/harperdb-api-jobs.csv) | Frozen. The legacy suite's CI jobs in the private `harperdb` repository, Sep 3 to Oct 9, 2025 |
| [`legacy-waits.csv`](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/legacy-waits.csv) | Frozen. Every hard-coded wait in the legacy suite, at two commits |
| [`as-of.txt`](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/as-of.txt), [`collection-times.csv`](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/collection-times.csv), [`git-refs.csv`](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/git-refs.csv) | The as-of date, when each collection step ran, and the commits the git history came from |
| [`analysis.txt`](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/analysis.txt) | The output of `analyze.py` |
| [`RUNBOOK.md`](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/RUNBOOK.md) | How to repeat the collection for a later date, and where each number appears |
| [`scripts/collect.py`](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/scripts/collect.py) | Collects the raw data: run lists, samples, jobs, logs, merged PRs, adoption, npm, and git history |
| [`scripts/collect_git.py`](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/scripts/collect_git.py) | Produces the git-history CSVs from clones of harper and harper-pro |
| [`scripts/extract.py`](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/scripts/extract.py) | Turns the raw data into the published CSVs |
| [`scripts/analyze.py`](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/scripts/analyze.py) | Recomputes every number on this page from the CSVs |
| [`scripts/common.py`](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/scripts/common.py) | Shared rules: complete months, the 30-day window, hash sampling, and GitHub API retries |
| [`scripts/legacy_waits.py`](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/scripts/legacy_waits.py), [`scripts/freeze_harperdb.py`](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/scripts/freeze_harperdb.py) | One-off scripts that produced the frozen legacy files |

## How the data was collected

The whole procedure is scripted, and [`RUNBOOK.md`](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/RUNBOOK.md) walks through repeating it. `collect.py --as-of 2026-10-21` gathered the raw data on October 22, `extract.py` wrote these CSVs, and `analyze.py` printed the numbers. The as-of date had already ended, so running the same commands again reproduces this snapshot, as long as GitHub still has the job data and logs.

- **Run lists:** every run of harper's `integration-tests.yml` (workflow 203879333), its Next.js downstream check (313396365), and harper-pro's integration workflow (238747852), through the end of October 21 in UTC. They're fetched a week at a time and checked against GitHub's reported totals.
- **Jobs and steps:** `GET /repos/HarperFast/harper/actions/runs/<id>/jobs?filter=all` for every run any figure uses. Collection stops if any of them can't be fetched. GitHub keeps step timings for a few months and job logs for 90 days, so older runs only have job-level timing.
- **Samples:** a run is in a sample when a SHA-256 hash of its ID and a fixed seed falls under a threshold, or ranks first in its month. Membership never changes as more runs arrive, and nothing is hand-picked. Monthly timing takes the first 30 first-attempt runs per month and kind by hash order. The PR timing sample keeps 25% of first-attempt PR runs in the last 30 days, and the Next.js sample keeps 7.5% of the check's runs. Each sample's run IDs are in its CSV.
- **Merged PRs:** `gh pr list --state merged --base main` for each month, with every PR's changed file paths.
- **Test counts:** the job logs of one green main run, [39696281381](https://github.com/HarperFast/harper/actions/runs/39696281381) on October 21.
- **Adoption:** GitHub code search for the package name across HarperFast, then a shallow clone of each repository to count the files that actually import it.
- **Git history:** `collect_git.py` against full clones of [harper](https://github.com/HarperFast/harper) and [harper-pro](https://github.com/HarperFast/harper-pro) at the commits in `git-refs.csv`, with UTC day boundaries.

## The legacy suite

The legacy suite was written in the private `harperdb` repository for Harper v4, starting in December 2024. It came into the public harper repository on October 25, 2025 and was removed on June 8, 2026 in [b4f83887f](https://github.com/HarperFast/harper/commit/b4f83887f18b3418fa73ea934de189e65266c0d2). Its entry point is readable at [fb098c0](https://github.com/HarperFast/harper/blob/fb098c0f54f4321848bc2ae7c9cca05aee709a2c/integrationTests/apiTests/tests/testSuite.mjs), the commit before the new framework landed. All of its data is frozen.

### Legacy suite size

About **930 active tests**. At fb098c0 the suite had 28 ordered files and 974 `it()` calls. 45 were statically skipped: 19 `it.skip` calls plus a `describe.skip('S3 Operations')` holding 26 tests. Six more skip at runtime when HTTPS isn't available. The skips were counted by hand. The suite's README said the tests were "not currently independent or idempotent".

It barely grew: 974 test cases in November 2025 and 993 when it was removed in June 2026.

### Hard-coded waits

**387.7 seconds (6.5 minutes)** of fixed waiting per run, in the suite as it stood during the timing window below (commit 8780c52). `scripts/legacy_waits.py` counts every awaited timer with a literal duration in the test files, plus each restart helper call as its 1-second pre-wait and its timeout. That's 201.7 seconds of timers and 186 seconds across the restarts. Polling helpers aren't counted, and a wait inside a loop counts once, so this is a lower bound. At fb098c0, before PR #27, the same rules give 324.4 seconds (5.4 minutes). Every wait is listed in `legacy-waits.csv`.

### Legacy test step time

**7.5 minutes median, 7.7 minutes p90**, over 778 successful "Run API Tests" steps on Linux from May 5 to June 2, 2026. GitHub had already purged step timings for older runs. The whole job, including setup, took a median 8.2 minutes.

On June 2, [harper PR #1091](https://github.com/HarperFast/harper/pull/1091) replaced the restart sleeps with readiness polls. Over the next 262 successful steps, until the suite was removed, the median fell to **5.6 minutes**. Source: `harper-legacy-api-jobs.csv`.

### Legacy main-branch failures

**9.3% of main pushes** (42 of 450) had the suite fail on at least one Linux Node.js job on the first attempt, from December 3, 2025 to June 8, 2026. Ten more runs failed during setup, before any test ran, and aren't counted. Before May 5, step data is gone, so setup failures there can't be told apart and are counted. Runs where a legacy job was cancelled or skipped are left out.

By Node version, first-attempt legacy jobs on main failed 5.5% of the time on Node.js 20 (21 of 384), 4.0% on Node.js 22 (18 of 450), and 2.7% on Node.js 24 (12 of 450).

In **61% of failing attempts** (77 of 126, main and PR), another of Node.js 20, 22, or 24 passed on the same commit. That points to flakiness, but a real version-specific bug produces the same pattern. This is a failure rate, not a measured flake rate.

In the private `harperdb` repository, before the move, the same suite's API job failed on 2.3% of main pushes (1 of 43) and 11.9% of PR runs (16 of 135), from September 3 to October 9, 2025. It only ran after unit tests passed, which took a median 13 minutes from the start of the workflow. Source: `harperdb-api-jobs.csv`.

## The port

### Port timeline

The framework landed in [harper PR #27](https://github.com/HarperFast/harper/pull/27), opened November 4 and merged December 3, 2025. It was extracted into [@harperfast/integration-testing](https://github.com/HarperFast/integration-testing) in [PR #334](https://github.com/HarperFast/harper/pull/334), merged April 29, 2026.

Kris Zyp ported the legacy suite with coding agents between May 15 and June 9, 2026: **about 3.5 weeks** and **14 PRs**, mostly on `claude/api-tests-*` branches. The PRs were [#555](https://github.com/HarperFast/harper/pull/555), [#597](https://github.com/HarperFast/harper/pull/597), [#627](https://github.com/HarperFast/harper/pull/627), [#634](https://github.com/HarperFast/harper/pull/634), [#645](https://github.com/HarperFast/harper/pull/645), [#646](https://github.com/HarperFast/harper/pull/646), [#647](https://github.com/HarperFast/harper/pull/647), [#648](https://github.com/HarperFast/harper/pull/648), [#730](https://github.com/HarperFast/harper/pull/730), [#731](https://github.com/HarperFast/harper/pull/731), [#732](https://github.com/HarperFast/harper/pull/732), [#759](https://github.com/HarperFast/harper/pull/759), [#761](https://github.com/HarperFast/harper/pull/761), and [#778](https://github.com/HarperFast/harper/pull/778).

When the legacy suite was removed, `integrationTests/apiTests/` held **17 self-contained test files**. Seven more were added there later. The cleanup, [PR #1173](https://github.com/HarperFast/harper/pull/1173), deleted **19,977 lines** of legacy tests and infrastructure.

## Test growth

### Test cases over time

Test cases on harper's main branch, counted as lines that start an `it()` or `test()` call. Each row uses the last first-parent commit on main before the end of that day (UTC). Source: `harper-test-growth.csv`.

| Date        | Framework files | Framework test cases | Legacy test cases |
| ----------- | --------------: | -------------------: | ----------------: |
| Nov 5, 2025 |               0 |                    0 |               974 |
| Dec 4, 2025 |               2 |                    7 |               985 |
| Jan 1, 2026 |               2 |                    7 |               985 |
| Feb 1       |               5 |                   28 |               985 |
| Mar 1       |               7 |                   59 |               985 |
| Apr 1       |               8 |                   60 |               985 |
| May 1       |              13 |                  117 |               993 |
| Jun 1       |              39 |                  372 |               993 |
| Jun 9       |              45 |                1,096 |                 0 |
| Jul 1       |              89 |                1,378 |                 0 |
| Aug 1       |             148 |                1,699 |                 0 |
| Sep 1       |             189 |                2,007 |                 0 |
| Oct 1       |             242 |                2,304 |                 0 |
| Oct 21      |             261 |                2,422 |                 0 |

The framework passed the legacy suite's size on the day the port finished, and has added **1,326 test cases** since.

## Today's suite

### Tests and instances per run

Main run [39696281381](https://github.com/HarperFast/harper/actions/runs/39696281381) on October 21, 2026, summed over its six Linux Node.js 24 shards: **2,632 tests** (2,610 passed, 0 failed, 21 skipped, 1 todo) and **421 Harper instances**. Test counts come from node:test's summary lines (`ℹ tests`). Instances are counted from the harness's "Logs for this instance will be stored" line, which it prints once per started instance. The run executes more tests than the 2,422 `test()` calls in source because some tests are generated in loops. The Windows shards run 871 tests; the rest skip on Windows. Source: `harper-green-run-shards.csv`.

### Summed suite time vs. slowest shard

In the same run, the top-level suite durations on the six Linux Node.js 24 shards add up to **74.4 minutes**. The slowest of those shards finished in **5.4 minutes**, a ratio of 13.8. Each shard runs three files at once (`floor(4 / 2) + 1` on a 4-vCPU hosted runner), and there are six shards.

The durations were measured while files ran concurrently and competed for CPU, and time inside a file before its first suite isn't counted. So 74.4 minutes isn't a serial baseline, and the ratio shows how much work overlaps, not a measured speedup.

### CI matrix

On main, release branches, and a nightly schedule, `integration-tests.yml` runs **36 shard jobs**: Linux Node.js 22, 24, and 26, Windows, Bun, and the uWS HTTP backend, six shards each. PRs run 24: Node.js 24, Windows, Bun, and uWS. Windows and Bun were added in May 2026, Node.js 26 on May 29, and uWS on July 9. See the workflow at [run 39696281381](https://github.com/HarperFast/harper/actions/runs/39696281381/workflow).

### Time to a full result

**11.9 minutes median, 13.1 minutes p90** from the first job starting to the last job finishing, over all 205 successful first-attempt main push runs in the last 30 days. PR runs, with 24 shard jobs, took a median 10.5 minutes, from a 25% sample of 198 successful first-attempt runs. Queue time was negligible. Source: `harper-window-runs.csv`.

For successful first-attempt main runs, the monthly median went from 8.6 minutes in December to 10.3 in March, 15.9 in June, 14.1 in July, and 9.2 in September, while the suite grew from 2 to about 190 test files. Each month samples 30 first-attempt runs, so months with many failures have few successful runs to measure. Source: `harper-timing-sample.csv`.

This is full-matrix elapsed time. The legacy 7.5 minutes was a single test step on a different suite, so the two aren't a direct speed comparison.

## harper-pro

### Cluster test growth

harper-pro's `integrationTests/cluster/` went from **1 test file** on March 1, 2026 to **104** on October 21. All of harper-pro's integration tests went from 4 files to 123, with 295 test cases. Most cluster tests start two to four Harper nodes, each on its own loopback address: `NODE_COUNT` is 2 in 11 files, 3 in 3, and 4 in 2. Sources: `harper-pro-test-growth.csv`, `harper-pro-node-counts.csv`.

harper-pro's integration workflow ran 579 times in June 2026, then 409 to 428 times a month from July through September. Source: `harper-pro-integration-runs.csv`.

### Old cluster harness

Before this, cluster tests lived in the private `harperdb` repository. Its `docker-cluster-test` workflows provisioned a `c7g.2xlarge` EC2 instance with Terraform, loaded a Docker image, started five HarperDB containers, slept 30 seconds, ran Newman (Postman) collections over SSH, copied the logs back with `scp`, and destroyed the instance. The job had a 40-minute timeout.

## Next.js plugin

### Next.js fixtures and tests

[@harperfast/nextjs](https://github.com/HarperFast/nextjs) has **10 fixtures** across Next.js 14, 15, and 16 (webpack, Turbopack, ISR, `use cache`, and a cluster) and **53 Playwright tests** in 12 spec files under `integrationTests/`. Each fixture runs against its own Harper on its own loopback address. Before version 2 in April 2026, a Playwright global setup ran one shared `npx harperdb start` and then waited two seconds. Source: `nextjs-suite.csv`.

### Downstream check

harper's "Next.js Integration Tests (downstream)" workflow builds a PR's Harper and runs the Next.js adapter's suite against it on Node.js 20, 22, and 24. It ran **3,325 times** from July 15 to October 21, 2026. Source: `harper-nextjs-downstream-runs.csv`.

The check is advisory and path-filtered, so not every run executes the suite. In a 7.5% sample of 254 runs, the suite ran in 208 (82%), was skipped in 41, and 5 runs had no adapter jobs. Of the 208 that ran, **10 (5%)** had at least one Node.js version fail on the final attempt. Some of those failures may come from the adapter's own main branch, since the check tracks it, rather than from the Harper PR. Don't apply 5% to all 3,325 runs. Source: `harper-nextjs-downstream-sample.csv`.

## Velocity

### PRs touching integration tests

Merged PRs to harper's main branch, by merge month. A PR touches integration tests when it changes any file under `integrationTests/` outside the legacy suite. October 2026 is left out because the month isn't over. Source: `harper-prs.csv`.

| Month | Merged PRs | Touching integration tests | Share | Code PRs | Also changed an integration test | Share |
| --- | --: | --: | --: | --: | --: | --: |
| Dec 2025 | 14 | 3 | 21% | 7 | 1 | 14% |
| Jan 2026 | 13 | 3 | 23% | 8 | 2 | 25% |
| Feb 2026 | 30 | 5 | 17% | 23 | 3 | 13% |
| Mar 2026 | 96 | 10 | 10% | 60 | 2 | 3% |
| Apr 2026 | 67 | 8 | 12% | 42 | 2 | 5% |
| May 2026 | 151 | 29 | 19% | 97 | 15 | 15% |
| Jun 2026 | 229 | 59 | 26% | 151 | 26 | 17% |
| Jul 2026 | 215 | 54 | 25% | 161 | 35 | 22% |
| Aug 2026 | 148 | 48 | 32% | 102 | 33 | 32% |
| Sep 2026 | 238 | 74 | 31% | 144 | 47 | 33% |

December and January are high on very few PRs. From February to April, **10 to 17%** of merged PRs touched integration tests. From June to September it was **25 to 32%**, at about three times the volume. Some of those PRs only fix or maintain tests, which the next metric excludes. The share controls for overall volume, but it doesn't prove the framework caused the change or measure delivery speed.

### Code changes that ship an integration test

A code PR changes a `.js` or `.ts` file outside test directories. It ships an integration test when it also adds or changes an `integrationTests/**/*.test.*` file. From February to April, **3 to 13%** of code PRs did each month. From June to September, **17 to 33%**, with 47 of 144 in September. The table above has every month.

A changed test file doesn't prove the test covers the change, so read this as a trend, not a coverage measure.

### CI runs per month

Runs of `integration-tests.yml`, by month. October 2026 is left out because the month isn't over. Source: `harper-integration-runs.csv`.

| Month    |  Runs | PR branches (not Renovate) |
| -------- | ----: | -------------------------: |
| Dec 2025 |    68 |                         14 |
| Jan 2026 |   132 |                         21 |
| Feb 2026 |   213 |                         39 |
| Mar 2026 |   446 |                        105 |
| Apr 2026 |   493 |                        104 |
| May 2026 | 1,042 |                        196 |
| Jun 2026 | 1,356 |                        297 |
| Jul 2026 | 1,374 |                        265 |
| Aug 2026 | 1,186 |                        190 |
| Sep 2026 | 1,622 |                        311 |

In the last 30 days there were 1,461 runs from 355 PR branches, not counting Renovate. More runs show use; on their own they don't show faster engineering or better reliability.

## Adoption

### Repos importing the package

**32 HarperFast repositories** import `@harperfast/integration-testing`, not counting harper itself: 26 public and 6 private or internal. Only repository names and file counts are published. Repositories were found with GitHub code search for the package name, then each one was checked for files that actually import it (an `import`, `from`, or `require` of the package, outside Markdown, `package.json`, and lockfiles), at the default-branch commit in the CSV. Source: `org-adoption.csv`.

The heaviest users are harper-pro (126 files: 123 integration tests, 2 smoke tests, and a benchmark), harper-reflex (35), Developer-Relations-Agents (7), oauth (6), and agent-memory and symphony (4 each). Most templates and examples carry a single smoke test. The package has 23 published versions and had 49,736 npm downloads from September 22 to October 21, 2026. Source: `npm.csv`.

## Stability

### Main-branch failures by month

The share of main push runs of `integration-tests.yml` whose final attempt failed, and the share where a Linux Node.js shard was among the failed jobs. October 2026 is left out because the month isn't over; see [Last 30 days](#last-30-days) for the most recent window. Sources: `harper-integration-runs.csv`, `harper-main-failed-runs.csv`.

| Month    | Main runs | Any job failed | Linux Node.js shard failed |
| -------- | --------: | -------------: | -------------------------: |
| Dec 2025 |        13 |             0% |                         0% |
| Jan 2026 |        13 |             8% |                         0% |
| Feb 2026 |        30 |             7% |                         0% |
| Mar 2026 |       109 |            16% |                         4% |
| Apr 2026 |        74 |            19% |                         0% |
| May 2026 |       160 |            41% |                        12% |
| Jun 2026 |       245 |            66% |                        40% |
| Jul 2026 |       225 |            52% |                        30% |
| Aug 2026 |       154 |            62% |                        34% |
| Sep 2026 |       244 |            19% |                        10% |

December and January had only 13 main pushes each: the workflow started running on main when PR #27 merged on December 3. December's 0% is all 13 passing, too few to mean much, so the deck leaves it out. Through April, almost every main failure came from the legacy suite. From June to August the matrix grew (Windows, Bun, Node.js 26, uWS) and Windows shards had long tail latency.

Failures include real regressions. Main runs with a failed Linux Node.js 26 job: 44 in June, 37 in July, 17 in August, and 15 in September; harper pinned Node.js 26 to 26.5.0 from August 3 to September 1. A failed run means any of up to 36 jobs failed, so this counts regressions the suite caught as well as flakes. **Failure rate is not flake rate.**

### Last 30 days

- **20% of main pushes failed** on the final attempt (52 of 258), and 19% on the first attempt.
- A Linux Node.js shard failed in 11% of main pushes (29 of 258), on both the first and final attempt.
- 23 of the 52 failed runs had no Linux Node.js shard failure. **20** failed only in Windows, Bun, or uWS jobs.
- The legacy suite failed on 9.3% of main pushes, but it was a different suite on a smaller matrix, so the two rates aren't comparable.

### Re-runs that then succeeded

Runs re-run at least once whose final attempt succeeded, as a share of all completed runs: **12.9% in July 2026, down to 4.3% in September**. It was below 3% from December through April, then 3.6% in May, 7.4% in June, and 12.6% in August; 3.1% in the last 30 days. This counts any re-run that ended in success, including re-runs after cancellations or infrastructure problems, so it's only a proxy for flakiness. The old and new suites and their matrices differ, so none of this shows that CI became less flaky.
