---
layout: ../../../../layouts/PostLayout.astro
title: "Did it work? Data and method"
pubDate: 2026-10-22T12:00:00-06:00
editDate: 2026-10-22T12:00:00-06:00
description: "How every number in the impact section of the 2026 Q4 edition of my integration testing talk was measured, with the data and scripts to recompute it."
---

This page backs section 5, "Did it work?", of the 2026 Q4 edition of [Performant, Parallelizable, Framework Agnostic Node.js Integration Testing](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing) and the post [Parallel Node.js Integration Testing](/blog/parallel-nodejs-integration-testing). Each number has its own heading, so a slide or a sentence can link straight to it.

The data was collected on October 22, 2026. "Last 30 days" means September 23 through October 22, 2026. These are observations from one team's repositories over changing suites, not a controlled experiment.

> [!NOTE]
> To recompute everything, download the CSVs and the `scripts/` folder listed under [Files](#files), then run `python3 scripts/analyze.py`. It uses only the Python standard library and prints every number on this page.

## Files

All files sit next to this page, under `/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/`. Only data from public repositories is published. The legacy suite also ran in the private `harperdb` repository; numbers from there are described below as aggregates only.

| File | What it holds |
| --- | --- |
| [`harper-integration-runs.csv`](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/harper-integration-runs.csv) | Every run of harper's `integration-tests.yml` (8,912 runs, Nov 2025 to Oct 2026) |
| [`harper-legacy-api-jobs.csv`](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/harper-legacy-api-jobs.csv) | Legacy API test jobs and their "Run API Tests" step, for every main push run plus 400 random PR runs. Frozen: the suite no longer exists. |
| [`harper-main-failed-runs.csv`](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/harper-main-failed-runs.csv) | Which job variants failed, for every main push run that didn't succeed |
| [`harper-timing-sample.csv`](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/harper-timing-sample.csv) | Wall-clock time for a stratified sample of 651 runs |
| [`harper-shard-step-sample.csv`](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/harper-shard-step-sample.csv) | Per-shard test step time for the same sample |
| [`harper-green-run-shards.csv`](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/harper-green-run-shards.csv) | Test counts, durations, and Harper instances per shard for one green main run |
| [`harper-test-growth.csv`](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/harper-test-growth.csv) | Test files and test cases on harper's main branch over time |
| [`harper-pr-activity.csv`](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/harper-pr-activity.csv) | Merged PRs per month, and how many touched integration tests |
| [`harper-pro-test-growth.csv`](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/harper-pro-test-growth.csv) | harper-pro integration and cluster test files over time |
| [`harper-pro-integration-runs.csv`](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/harper-pro-integration-runs.csv) | Every run of harper-pro's integration workflow |
| [`harper-nextjs-downstream-runs.csv`](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/harper-nextjs-downstream-runs.csv) | Every run of harper's Next.js downstream check |
| [`harper-nextjs-downstream-sample.csv`](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/harper-nextjs-downstream-sample.csv) | 250 sampled downstream runs and whether the suite ran or failed |
| [`org-adoption.csv`](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/org-adoption.csv) | HarperFast repositories that import the package in test files |
| [`as-of.txt`](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/as-of.txt) | The last day of data (2026-10-22) |
| [`collection-times.csv`](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/collection-times.csv) | The newest run in each run list, which marks when it was collected |
| [`git-refs.csv`](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/git-refs.csv) | The harper and harper-pro commits the git-history CSVs were computed from |
| [`analysis.txt`](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/analysis.txt) | The output of `analyze.py` for this data |
| [`RUNBOOK.md`](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/RUNBOOK.md) | How to repeat the collection for a later date, and where each number appears |
| [`scripts/collect.py`](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/scripts/collect.py) | Collects the raw data: run lists, samples, jobs, logs, adoption, and git history |
| [`scripts/collect_git.py`](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/scripts/collect_git.py) | Produces the three git-history CSVs from clones of harper and harper-pro |
| [`scripts/extract.py`](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/scripts/extract.py) | Turns the raw data into the published CSVs |
| [`scripts/analyze.py`](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/scripts/analyze.py) | Recomputes every number on this page from the CSVs |

## How the data was collected

The whole procedure is scripted, and [`RUNBOOK.md`](/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data/RUNBOOK.md) walks through repeating it for a later date. In short, `collect.py --as-of <date>` gathers the raw data, `extract.py` writes these CSVs, and `analyze.py` prints the numbers. Re-running `collect.py --as-of 2026-10-22 --green-run 39774245654 --reuse-samples` reproduces this snapshot, except for runs created on October 22 after the times in `collection-times.csv`; the run lists were collected between 14:07 and 16:06 UTC that day.

- **Run lists:** every run of harper's `integration-tests.yml` (workflow 203879333), its Next.js downstream check (313396365), and harper-pro's integration workflow (238747852), up to the end of the as-of date.
- **Jobs and steps:** `GET /repos/HarperFast/harper/actions/runs/<id>/jobs?filter=all` for every sampled run and every main push run that didn't succeed. GitHub keeps step timings for a few months and job logs for 90 days, so older runs only have job-level timing.
- **Timing sample:** up to 30 first-attempt runs per month for main pushes and for PRs, drawn at random with a fixed seed per month. Months with fewer runs are taken whole.
- **Next.js downstream sample:** 250 runs, drawn at random with a fixed seed.
- **Test and instance counts:** the job logs of one green main run, [39774245654](https://github.com/HarperFast/harper/actions/runs/39774245654), fetched with `gh run view --job <id> --log`.
- **Adoption:** GitHub code search for the package name across HarperFast, then a shallow clone of each repository to count the files that import it, outside `package.json` and lockfiles.
- **Git history:** `collect_git.py` against full clones of [harper](https://github.com/HarperFast/harper) and [harper-pro](https://github.com/HarperFast/harper-pro), at the commits in `git-refs.csv`. Months and dates use UTC midnight boundaries.
- **Months:** monthly series stop at the last complete month, so October 2026 is left out. The "last 30 days" window and point-in-time counts use the as-of date.
- **Samples:** where a figure uses a sample, the sample's run IDs are in the CSV, so you can check exactly which runs were used.

## The legacy suite

The legacy suite was written in the private `harperdb` repository for Harper v4, starting in December 2024. It came into the public harper repository on October 25, 2025 and was removed on June 8, 2026 in [b4f83887f](https://github.com/HarperFast/harper/commit/b4f83887f18b3418fa73ea934de189e65266c0d2). Its entry point is readable at [fb098c0](https://github.com/HarperFast/harper/blob/fb098c0f54f4321848bc2ae7c9cca05aee709a2c/integrationTests/apiTests/tests/testSuite.mjs), the commit before the new framework landed.

### Legacy suite size

About **930 active tests**. At fb098c0 the suite had 28 ordered files and 974 `it()` calls. 45 were statically skipped: 19 `it.skip` calls plus a `describe.skip('S3 Operations')` holding 26 tests. Six more skip at runtime when HTTPS isn't available. The suite's README said the tests were "not currently independent or idempotent".

It never grew. `harper-test-growth.csv` counts 974 test cases in November 2025 and 993 when the suite was removed in June 2026. The skips were counted by hand at fb098c0.

### Hard-coded waits

About **315 seconds (5.3 minutes)** of fixed waiting per run, counted statically at fb098c0:

- 191 seconds of unconditional `setTimeout` calls in test files. The largest were 76 s in `23_blob`, 72 s in `15_customFunctionsAndComponents`, 31 s in `8_deleteTests`, and 13 s in `16_terminologyUpdates`.
- 124 seconds of fixed waits around restarts: 45 s, 45 s, two of 15 s, and 1 s before each of four restarts.

The CI workflow also slept 10 seconds after starting Harper. Polling helpers aren't counted. [harper PR #1091](https://github.com/HarperFast/harper/pull/1091) later replaced several of these sleeps with readiness checks.

### Legacy test step time

**7.4 minutes median, 7.7 minutes p90**, over 1,040 successful "Run API Tests" steps on Linux between May 5 and June 8, 2026. That is the only window where GitHub still had step timings. The whole job, including setup, took a median 8.2 minutes. Source: `harper-legacy-api-jobs.csv`, `api_step_minutes`.

### Legacy main-branch failures

**11.6% of main pushes** (52 of 450) had at least one Linux Node.js legacy API job fail on the first attempt, between December 3, 2025 and June 8, 2026. Runs where a legacy job was cancelled or skipped are left out.

By Node version, attempt-1 legacy jobs on main failed 8.1% of the time on Node 20 (31 of 384), 4.0% on Node 22 (18 of 450), and 2.7% on Node 24 (12 of 450).

In **66% of failing attempts** (99 of 149, main and PR), another of Node 20, 22, or 24 passed on the same commit. That points to flakiness, but a real version-specific bug produces the same pattern. This is a failure rate, not a measured flake rate.

In the private `harperdb` repository, before the move, the same suite's API job failed on 2.3% of main pushes (1 of 43) and 11.9% of PR runs (16 of 135), between September 3 and October 9, 2025. It only ran after unit tests passed, which took a median 13 minutes from the start of the workflow.

## The port

### Port timeline

The framework landed in [harper PR #27](https://github.com/HarperFast/harper/pull/27), opened November 4 and merged December 3, 2025. It was extracted into [@harperfast/integration-testing](https://github.com/HarperFast/integration-testing) in [PR #334](https://github.com/HarperFast/harper/pull/334), merged April 29, 2026.

Kris Zyp ported the legacy suite with coding agents between May 15 and June 9, 2026: **about 3.5 weeks** and **14 PRs**, mostly on `claude/api-tests-*` branches. The PRs were [#555](https://github.com/HarperFast/harper/pull/555), [#597](https://github.com/HarperFast/harper/pull/597), [#627](https://github.com/HarperFast/harper/pull/627), [#634](https://github.com/HarperFast/harper/pull/634), [#645](https://github.com/HarperFast/harper/pull/645), [#646](https://github.com/HarperFast/harper/pull/646), [#647](https://github.com/HarperFast/harper/pull/647), [#648](https://github.com/HarperFast/harper/pull/648), [#730](https://github.com/HarperFast/harper/pull/730), [#731](https://github.com/HarperFast/harper/pull/731), [#732](https://github.com/HarperFast/harper/pull/732), [#759](https://github.com/HarperFast/harper/pull/759), [#761](https://github.com/HarperFast/harper/pull/761), and [#778](https://github.com/HarperFast/harper/pull/778).

When the legacy suite was removed, `integrationTests/apiTests/` held **17 self-contained test files**. Seven more were added there later. The cleanup, [PR #1173](https://github.com/HarperFast/harper/pull/1173), deleted **19,977 lines** of legacy tests and infrastructure.

## Test growth

### Test cases over time

Test cases on harper's main branch, counted as lines that start an `it()` or `test()` call. Each row uses the last first-parent commit on main before the end of that day. Source: `harper-test-growth.csv`, produced by `scripts/collect-git.sh`.

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
| Oct 22      |             263 |                2,435 |                 0 |

The framework passed the legacy suite's size on the day the port finished, and has added **1,339 test cases** since.

## Today's suite

### Tests and instances per run

Main run [39774245654](https://github.com/HarperFast/harper/actions/runs/39774245654) on October 22, 2026, summed over its six Linux Node.js 24 shards: **2,652 tests** (2,630 passed, 0 failed, 21 skipped, 1 todo) and **423 Harper instances**. Test counts come from node:test's summary lines (`ℹ tests`). Instances are counted from the harness's "Logs for this instance will be stored" line, which it prints once per started instance. The run executes more tests than the 2,435 `test()` calls in source because some tests are generated in loops. The Windows shards run 871 tests; the rest skip on Windows. Source: `harper-green-run-shards.csv`.

### Summed suite time vs. slowest shard

In the same run, the top-level suite durations on the six Linux Node.js 24 shards add up to **82.0 minutes**. The slowest of those shards finished in **5.6 minutes**, about 15 times less. Roughly 3 times comes from running three files at once per shard (`floor(4 / 2) + 1` on a 4-vCPU hosted runner) and 6 times from sharding.

The 82 minutes was measured while files ran concurrently and competed for CPU, so it overstates true serial time somewhat. Time inside a file before its first suite isn't counted. It shows overlapping work; it isn't a measured serial run.

### CI matrix

On main, release branches, and a nightly schedule, `integration-tests.yml` runs **36 shard jobs**: Linux Node.js 22, 24, and 26, Windows, Bun, and the uWS HTTP backend, six shards each. PRs run 24: Node.js 24, Windows, Bun, and uWS. Windows and Bun were added in May 2026, Node.js 26 on May 29, and uWS on July 9. See the workflow at [run 39774245654's commit](https://github.com/HarperFast/harper/actions/runs/39774245654/workflow).

### Time to a full result

**12.1 minutes median, 13.1 minutes p90** from the first job starting to the last job finishing, over 30 successful main push runs in the last 30 days. PR runs, with 24 shard jobs, took a median 11.5 minutes (27 runs). Queue time was negligible.

The sample is 30 first-attempt runs per month and kind (main push or PR), chosen at random with seed 42, or every run in months with fewer. Source: `harper-timing-sample.csv`.

This is full-matrix elapsed time. The legacy 7.4 minutes was a single test step on a different suite, so the two aren't a direct speed comparison.

## harper-pro

### Cluster test growth

harper-pro's `integrationTests/cluster/` went from **1 test file** on March 1, 2026 to **105** on October 22. All of harper-pro's integration tests went from 4 files to 124, with 300 test cases. Most cluster tests start two to four Harper nodes, each on its own loopback address: `NODE_COUNT` is 2 in 11 files, 3 in 4 files, and 4 in 3 files. Source: `harper-pro-test-growth.csv`.

harper-pro's integration workflow ran 580 times in June 2026, then 409 to 428 times a month from July through September. Source: `harper-pro-integration-runs.csv`.

### Old cluster harness

Before this, cluster tests lived in the private `harperdb` repository. Its `docker-cluster-test` workflows provisioned a `c7g.2xlarge` EC2 instance with Terraform, loaded a Docker image, started five HarperDB containers, slept 30 seconds, ran Newman (Postman) collections over SSH, copied the logs back with `scp`, and destroyed the instance. The job had a 40-minute timeout. That repository is private, so this is described rather than linked.

## Next.js plugin

### Next.js fixtures and tests

[@harperfast/nextjs](https://github.com/HarperFast/nextjs) has **10 fixtures** across Next.js 14, 15, and 16 (webpack, Turbopack, ISR, `use cache`, and a cluster) and **53 Playwright tests** in 12 spec files under `integrationTests/`, as of October 22, 2026. Each fixture runs against its own Harper on its own loopback address. Before version 2 in April 2026, a Playwright global setup ran one shared `npx harperdb start` and then waited two seconds.

### Downstream check

harper's "Next.js Integration Tests (downstream)" workflow builds a PR's Harper and runs the Next.js adapter's suite against it on Node.js 20, 22, and 24. It ran **3,336 times** from July 15 to October 22, 2026. Source: `harper-nextjs-downstream-runs.csv`.

The check is advisory and path-filtered, so not every run executes the suite. In a random sample of 250 runs, the suite ran in 212, was skipped in 32, and 6 runs had no adapter jobs. Of the 212 that ran, **13 (6%)** had at least one Node.js version fail. Some of those failures may come from the adapter's own main branch, since the check tracks it, rather than from the Harper PR. Don't apply 6% to all 3,336 runs. Source: `harper-nextjs-downstream-sample.csv`.

## Velocity

### PRs touching integration tests

Counted as first-parent commits on harper's main branch, which is one per merged PR. A fix PR is one whose subject starts with "fix"; it ships a test if its diff adds or changes an `integrationTests/**/*.test.*` file. October 2026 is left out because the month isn't over. Source: `harper-pr-activity.csv`.

| Month | Merged | Touching integration tests | Share | Fix PRs | Fixes with a test | Share |
| --- | --: | --: | --: | --: | --: | --: |
| Dec 2025 | 14 | 3 | 21% | 5 | 0 | 0% |
| Jan 2026 | 18 | 8 | 44% | 2 | 0 | 0% |
| Feb 2026 | 84 | 11 | 13% | 16 | 2 | 13% |
| Mar 2026 | 233 | 13 | 6% | 46 | 0 | 0% |
| Apr 2026 | 133 | 10 | 8% | 27 | 1 | 4% |
| May 2026 | 287 | 59 | 21% | 108 | 9 | 8% |
| Jun 2026 | 329 | 82 | 25% | 130 | 24 | 18% |
| Jul 2026 | 456 | 82 | 18% | 223 | 31 | 14% |
| Aug 2026 | 351 | 83 | 24% | 150 | 35 | 23% |
| Sep 2026 | 311 | 94 | 30% | 59 | 27 | 46% |

December and January are high on very few PRs. From February to April, PR volume jumped as the team adopted coding agents, and **6 to 13%** of merged PRs touched integration tests (10 to 13 a month). From June to September it held at **18 to 30%** (82 to 94 a month) at the higher volume. The share controls for overall volume, but it doesn't prove the framework caused the change or measure delivery speed.

### Fixes that ship an integration test

From February to April, **0 to 13%** of fix PRs shipped an integration test each month. From June to September it was **14 to 46%**, peaking at 27 of 59 in September. The subject-prefix rule is a heuristic and misses fixes titled differently. See the table above.

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
| Sep 2026 | 1,623 |                        311 |

In the last 30 days there were 1,428 runs from 347 PR branches, not counting Renovate. More runs show use; on their own they don't show faster engineering or better reliability.

## Adoption

### Repos importing the package

**32 HarperFast repositories** import `@harperfast/integration-testing`, not counting harper itself: 26 public and 6 private or internal. Only repository names and file counts are published, never code. Repositories were found with GitHub code search for the package name, then each one was checked for files that actually import it (an `import`, `from`, or `require` of the package, outside Markdown, `package.json`, and lockfiles). Source: `org-adoption.csv`.

The heaviest users are harper-pro (126 files: 123 integration tests, 2 smoke tests, and a benchmark), harper-reflex (33), Developer-Relations-Agents (7), oauth (6), and symphony and agent-memory (4 each). Most templates and examples carry a single smoke test. The package had 56.7k npm downloads from September 19 to October 18, 2026.

## Stability

### Main-branch failures by month

The share of main push runs of `integration-tests.yml` that ended in failure, and the share where a Linux Node.js shard was among the failed jobs. October 2026 is left out because the month isn't over; see [Last 30 days](#last-30-days) for the most recent window. Source: `harper-integration-runs.csv` and `harper-main-failed-runs.csv`.

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

December and January had only 13 main pushes each: the workflow started running on main when PR #27 merged on December 3. December's 0% is all 13 passing, too few to mean much, so the deck leaves it out. Through April, almost every main failure came from the legacy suite. From June to August the matrix grew (Windows, Bun, Node.js 26, uWS) and Windows shards had long tail latency. A failed run means any of up to 36 jobs failed, so this counts real regressions the suite caught as well as flakes. **Failure rate is not flake rate.**

### Last 30 days

- **22% of main pushes failed** (55 of 253).
- 11% had a Linux Node.js shard failure (29 of 253).
- 26 of the 55 failed runs, **nearly half**, failed only on Windows, Bun, or uWS jobs.
- Failures include real regressions. Node.js 26 jobs alone failed 11 to 32 main runs a month from June to August (from job names in the jobs API, not in the published CSVs), and harper pinned Node.js 26 to 26.5.0 from August 3 to September 1.

### Re-runs that turned green

Runs re-run at least once whose final attempt succeeded, as a share of all completed runs: **12.9% in July 2026, down to 4.3% in September**. It was below 3% from December through April, then 3.6% in May, 7.4% in June, and 12.6% in August. October is left out because the month isn't over. This is the closest proxy for flakiness that run metadata allows, and it is still only a proxy. The old and new suites and their matrices differ, so none of this shows that CI became less flaky.
