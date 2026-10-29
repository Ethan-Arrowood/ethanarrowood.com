# Refreshing the "Did it work?" data

This folder holds the data behind section 5, "Did it work?", of the 2026 Q4 edition of the integration testing talk, and behind the post `src/pages/blog/parallel-nodejs-integration-testing.md`. The rendered method page is `src/pages/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data.md`. This runbook is for repeating the collection later, for example in November 2026 to add October's data.

## Rules

- **Whole months only.** Monthly series stop at the last complete month: a month is complete when its last day is on or before the as-of date (`common.month_complete`). Every script uses that one definition. Don't add an on-screen note about a missing month; the speaker notes and the data page say so.
- **The as-of date has ended.** Use a day that is already over in UTC. `collect.py` refuses a day that isn't, so the snapshot can be reproduced exactly.
- **Rolling windows stay.** "Last 30 days" is the 30 days ending at the end of the as-of date, even when it crosses into an incomplete month.
- **Snapshots stay.** Point-in-time counts (test files and cases on a date, harper-pro files, the green run) use the as-of date.
- **Samples are hash-based.** A run is in a sample when the SHA-256 of `seed:run_id` falls under a threshold, or ranks first in its month by that hash. Membership never changes as more runs arrive, and nothing is hand-picked.
- **The legacy suite is frozen.** `harper-legacy-api-jobs.csv`, `harperdb-api-jobs.csv`, and `legacy-waits.csv` describe a suite that no longer exists, and GitHub has purged the step timings. Never re-collect or edit them.
- **No code, ever.** Metadata from private HarperFast repositories (repository names, CI run and job data, PR titles and counts) may be published. Source code and file contents may not. Check every new CSV column against that rule.
- **Recompute, don't edit by hand.** Every number on the slides, the data page, and the post comes from `analysis.txt`, or from the "static" list at its end. If a number changes, change it everywhere it appears (see the map below).
- **Fail on missing data.** If job data or logs can't be fetched, `collect.py` and `extract.py` stop. Don't work around it; re-run until the data is complete.

## Prerequisites

- `gh` authenticated with read access to the HarperFast repositories.
- Network access to `registry.npmjs.org` and `api.npmjs.org`.
- Python 3.11 or newer. The scripts use only the standard library.
- Full clones (not `--filter=blob:none`) of `https://github.com/HarperFast/harper` and `https://github.com/HarperFast/harper-pro`. `collect_git.py` fetches `origin` itself.
- About 3,000 GitHub API calls. It takes 20 to 40 minutes.

GitHub keeps job logs for 90 days and step timings for a few months. Run the collection within a few weeks of the as-of date.

## Steps

Pick the as-of date: the last day of data to include, already over in UTC. To add October 2026, use a finished day in November, for example `2026-11-30`, run on December 1.

```sh
DATA=public/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data
RAW=/tmp/impact-raw-2026-11-30   # a fresh directory outside the repo

python3 $DATA/scripts/collect.py --as-of 2026-11-30 --raw $RAW \
  --harper ~/src/harper --harper-pro ~/src/harper-pro
python3 $DATA/scripts/extract.py --raw $RAW --out $DATA
python3 $DATA/scripts/analyze.py $DATA > $DATA/analysis.txt
git diff $DATA/analysis.txt
```

1. `collect.py` writes raw responses to `$RAW`. If it stops partway, run the same command again; it resumes.
2. `extract.py` rewrites the published CSVs, `as-of.txt`, and `collection-times.csv`. It never touches the frozen files.
3. `analyze.py` prints every number. `analysis.txt` is committed, so `git diff` shows exactly what moved.
4. Update every place a changed number appears, using the map below.
5. Update dates in prose: "as of <date>", the last-30-days window, the green run ID, and "through <month>" phrasing.
6. Check: `npm run format:check`, `npm run build`, open the deck with `node scripts/dev-slides.mjs` and check that no slide content runs under the footer, and confirm every `2026-q4/data/#anchor` link still matches a heading on the data page.

Git reads a bare date as that day at the current time of day, so `collect_git.py` passes explicit UTC times. Keep it that way if you change it.

## Where each number appears

Slide ids are `<section id>` values in `../slides/index.html`. Page headings are in `data.md`. Post sections are headings in the blog post.

| `analysis.txt` key | Slides | Data page heading | Post section |
| --- | --- | --- | --- |
| `legacy-test-step-before-1091`, `legacy-test-step-after-1091`, `legacy-waits-timing-window` | `legacy-runtime` | Legacy test step time, Hard-coded waits | The legacy suite and its port |
| `legacy-main-failure-rate`, `legacy-main-failure Node.js v*`, `legacy-same-commit-split` | `legacy-failures` | Legacy main-branch failures | Failure rate is not flake rate |
| `harperdb-*` | none | Legacy main-branch failures | none |
| `legacy-suite-size`, static `legacy-active-tests` | `legacy-shared` | Legacy suite size | The legacy suite and its port |
| static `port`, `port-files`, `port-cleanup` | `agent-port`, `port-units` | Port timeline | The legacy suite and its port |
| test growth table, `growth-since-port` | `growth` (chart: one column per month start, plus "Now") | Test cases over time | More tests within a bounded feedback window |
| `tests-per-run`, `harper-instances-per-run`, `windows-tests` | `today` | Tests and instances per run | More tests within a bounded feedback window |
| `summed-suite-time`, `slowest-shard` | `parallel-time` | Summed suite time vs. slowest shard | More tests within a bounded feedback window |
| `wall-main-last30`, `wall-pr-last30`, monthly main medians | `result-time` | Time to a full result | More tests within a bounded feedback window |
| harper-pro `cluster-test-files`, `integration-test-files`, `node-counts`, runs per month | `cluster-growth`, `cluster-local`, `harper-pro` notes | Cluster test growth | Adoption beyond the core suite |
| `nextjs-suite`, `downstream-*` | `nextjs-plugin`, `downstream-checks`, `downstream-failures` | Next.js fixtures and tests, Downstream check | Adoption beyond the core suite |
| merged PRs table | `velocity`, `code-with-tests` (stacked charts) | PRs touching integration tests, Code changes that ship an integration test | Adoption beyond the core suite |
| runs table (`runs` column) | `ci-usage` (chart) | CI runs per month | Adoption beyond the core suite |
| runs table (`main failed`, `linux shard failed`), `node26-failed-main-runs` | `failure-history` (chart, December left out) | Main-branch failures by month | Failure rate is not flake rate |
| `*-last30`, `failed-without-linux-node-last30`, re-run column | `failure-scope` | Last 30 days, Re-runs that then succeeded | Failure rate is not flake rate |
| `repos-importing`, top repos, `npm` | `package-adoption` | Repos importing the package | Adoption beyond the core suite |

### Chart markup

The monthly charts in `../slides/index.html` are plain HTML and CSS.

- `.colchart` (`ci-usage`): one `<div><i style="--v: N"><span>label</span></i></div>` per month, with `--max` on the container a little above the largest value. Months from June 2026 on get `class="after"`, marking the end of the legacy port.
- `.colchart.stacked` (`velocity`, `code-with-tests`): `--v` is the month's total, `<b style="--part: P">` is the share as a percentage, and the x-axis label reads `N of T`.
- `.bars` (`failure-history`): one `<b>Mon</b> <i style="--pct: N"></i> <b>N%</b>` row per month.
- `.hbars` (`legacy-runtime`, `parallel-time`): `--pct` is each bar's length as a share of the longest.
- Update each chart's `aria-label` with the same values.

Add one column or row per new complete month, and keep each chart readable at deck size. If a chart gets crowded, drop the oldest low-volume months and say so in the speaker notes.

## Files

| File | Written by |
| --- | --- |
| `as-of.txt`, `collection-times.csv` | `extract.py` |
| `harper-integration-runs.csv`, `harper-main-failed-runs.csv`, `harper-window-runs.csv` | `extract.py` |
| `harper-timing-sample.csv`, `harper-shard-step-sample.csv` | `extract.py` (samples chosen by `collect.py`) |
| `harper-green-run-shards.csv` | `extract.py`, from the green run's logs |
| `harper-nextjs-downstream-runs.csv`, `harper-nextjs-downstream-sample.csv` | `extract.py` |
| `harper-prs.csv` | `extract.py`, from merged PRs and their changed files |
| `harper-pro-integration-runs.csv`, `org-adoption.csv`, `nextjs-suite.csv`, `npm.csv` | `extract.py` |
| `harper-test-growth.csv`, `harper-pro-test-growth.csv`, `harper-pro-node-counts.csv`, `git-refs.csv` | `collect_git.py`, copied by `extract.py` |
| `harper-legacy-api-jobs.csv` | Frozen. Collected once on 2026-10-22. |
| `harperdb-api-jobs.csv` | Frozen. `scripts/freeze_harperdb.py`, run once on 2026-10-22. |
| `legacy-waits.csv` | Frozen. `scripts/legacy_waits.py` at fb098c0 and 8780c52. |
| `analysis.txt` | `analyze.py` |
