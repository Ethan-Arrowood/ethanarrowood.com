# Refreshing the "Did it work?" data

This folder holds the data behind section 5, "Did it work?", of the 2026 Q4 edition of the integration testing talk, and behind the post `src/pages/blog/parallel-nodejs-integration-testing.md`. The rendered method page is `src/pages/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data.md`. This runbook is for repeating the collection later, for example in November 2026 to add October's data.

## Rules

- **Whole months only.** Monthly series (charts, tables, `harper-pr-activity.csv`) stop at the last complete month. A month still in progress on the as-of date is left out everywhere, including the slides. Don't add an on-screen note about it; the speaker notes and the data page say so.
- **Rolling windows stay.** "Last 30 days" is always the 30 days ending on the as-of date, even when it crosses into an incomplete month.
- **Snapshots stay.** Point-in-time counts (test files and cases on a date, harper-pro files today) use the as-of date.
- **Samples are seeded, never hand-picked.** `collect.py` keeps each published month of the timing sample once that month is complete, and redraws months that were still in progress when drawn. The Next.js downstream sample is redrawn from all runs with a fixed seed.
- **The legacy suite is frozen.** `harper-legacy-api-jobs.csv` covers December 2025 to June 2026. The legacy suite no longer exists and GitHub has purged its step timings, so don't re-collect or edit it.
- **Public data only.** Never publish raw data from the private `harperdb` repository. The data page cites its numbers as aggregates.
- **Recompute, don't edit by hand.** Every number on the slides, the data page, and the post must come from `scripts/analyze.py` output. If a number changes, change it everywhere it appears (see the map below).

## Prerequisites

- `gh` authenticated with read access to the public HarperFast repositories.
- Python 3.11 or newer. The scripts use only the standard library.
- Full clones (not `--filter=blob:none`) of `https://github.com/HarperFast/harper` and `https://github.com/HarperFast/harper-pro`. `collect_git.py` fetches `origin` itself.
- About 1,500 to 2,000 GitHub API calls, well under the hourly limit. It takes 10 to 20 minutes.

GitHub keeps job logs for 90 days and step timings for a few months. Run the collection within a few weeks of the as-of date.

## Steps

Pick the as-of date: the last day of data to include. Use a day that has already ended in UTC, so nothing more can be added to it and the run can be reproduced exactly. To add October 2026, use any finished day in November, for example `2026-11-30` run on December 1; October is then a complete month.

```sh
DATA=public/talks/performant-parallelizable-framework-agnostic-nodejs-integration-testing/2026-q4/data
RAW=/tmp/impact-raw   # anywhere outside the repo

python3 $DATA/scripts/collect.py --as-of 2026-11-30 --raw $RAW \
  --harper ~/src/harper --harper-pro ~/src/harper-pro --data $DATA
python3 $DATA/scripts/extract.py --raw $RAW --out $DATA
python3 $DATA/scripts/analyze.py $DATA > $DATA/analysis.txt
git diff $DATA/analysis.txt
```

1. `collect.py` writes raw responses to `$RAW`: run lists, the timing and Next.js samples, jobs and steps, the logs of the latest green main run, adoption counts, and the git-history CSVs.
2. `extract.py` rewrites the published CSVs and `as-of.txt` in `$DATA`. It never touches `harper-legacy-api-jobs.csv`.
3. `analyze.py` prints every number. `analysis.txt` is committed, so `git diff` shows exactly which numbers moved.
4. Update every place a changed number appears, using the map below.
5. Update dates in prose: "as of October 22, 2026", "last 30 days means ...", run IDs (the green run changes), and "through <month>" phrasing.
6. Check: `npm run format:check`, `npm run build`, open the deck with `node scripts/dev-slides.mjs` and check that no slide content runs under the footer, and confirm every `2026-q4/data/#anchor` link still matches a heading on the data page.

To reproduce the October 22 snapshot, run `collect.py --as-of 2026-10-22 --green-run 39774245654 --reuse-samples`. That snapshot was collected while October 22 was still in progress, so runs created after the times in `collection-times.csv` will also appear. The git-history CSVs were computed at the commits in `git-refs.csv`.

Git reads a bare date as that day at the current time of day, so `collect_git.py` always passes explicit UTC midnights. Keep it that way if you change it.

## Where each number appears

Slide ids are `<section id>` values in `../slides/index.html`. Page headings are in `data.md`. Post sections are headings in the blog post.

| `analyze.py` output | Slides | Data page heading | Post section |
| --- | --- | --- | --- |
| `legacy-test-step`, hard-coded waits (static, frozen) | `legacy-runtime` | Legacy test step time, Hard-coded waits | The legacy suite and its port |
| `legacy-main-failure-rate`, `legacy-same-commit-split` | `legacy-failures` | Legacy main-branch failures | Failure rate is not flake rate |
| `legacy-suite-size` | `legacy-shared` | Legacy suite size | The legacy suite and its port |
| test growth table, `growth-since-port` | `growth` (chart: one column per month start plus "Now") | Test cases over time | More tests within a bounded feedback window |
| `tests-per-run`, `harper-instances-per-run` | `today` | Tests and instances per run | More tests within a bounded feedback window |
| `summed-suite-time`, `slowest-shard` | `parallel-time` | Summed suite time vs. slowest shard | More tests within a bounded feedback window |
| `wall-main-last30`, `wall-pr-last30` | `result-time` | Time to a full result | More tests within a bounded feedback window |
| harper-pro `cluster-test-files`, runs per month | `cluster-growth`, `harper-pro` notes | Cluster test growth | Adoption beyond the core suite |
| `downstream-runs`, `downstream-sample`, `downstream-failure-rate` | `downstream-checks`, `downstream-failures` | Downstream check | Adoption beyond the core suite |
| PR activity table (merged, touching, fixes) | `velocity`, `fix-coverage` (stacked charts) | PRs touching integration tests, Fixes that ship an integration test | Adoption beyond the core suite |
| runs table (`runs` column) | `ci-usage` (chart) | CI runs per month | Adoption beyond the core suite |
| runs table (`main fail`, `linux fail`) | `failure-history` (chart, December left out) | Main-branch failures by month | Failure rate is not flake rate |
| `main-failure-rate-last30`, `failures-only-off-linux-last30`, re-run column | `failure-scope` | Last 30 days, Re-runs that turned green | Failure rate is not flake rate |
| `repos-importing`, top repos | `package-adoption` | Repos importing the package | Adoption beyond the core suite |

### Chart markup

The monthly charts in `../slides/index.html` are plain HTML and CSS.

- `.colchart` (`ci-usage`): one `<div><i style="--v: N"><span>label</span></i></div>` per month, with `--max` on the container a little above the largest value. Months from June 2026 on get `class="after"`, which marks the legacy port.
- `.colchart.stacked` (`velocity`, `fix-coverage`): `--v` is the month's total, `<b style="--part: P">` is the share as a percentage, and the x-axis label reads `N of T`.
- `.bars` (`failure-history`): one `<b>Mon</b> <i style="--pct: N"></i> <b>N%</b>` row per month.
- Update each chart's `aria-label` with the same values.

Add one column or row per new complete month, and keep each chart readable at deck size. If a chart gets crowded, drop the oldest low-volume months and say so in the speaker notes.

## Files

| File | Written by |
| --- | --- |
| `as-of.txt`, `collection-times.csv` | `extract.py` |
| `git-refs.csv` | `collect_git.py`, copied by `extract.py` |
| `harper-integration-runs.csv`, `harper-main-failed-runs.csv` | `extract.py` |
| `harper-timing-sample.csv`, `harper-shard-step-sample.csv` | `extract.py` (sample drawn by `collect.py`) |
| `harper-green-run-shards.csv` | `extract.py`, from the green run's logs |
| `harper-nextjs-downstream-runs.csv`, `harper-nextjs-downstream-sample.csv` | `extract.py` (sample drawn by `collect.py`) |
| `harper-pro-integration-runs.csv`, `org-adoption.csv` | `extract.py` |
| `harper-test-growth.csv`, `harper-pr-activity.csv`, `harper-pro-test-growth.csv` | `collect_git.py`, copied by `extract.py` |
| `harper-legacy-api-jobs.csv` | Frozen. Collected once on 2026-10-22. |
| `analysis.txt` | `analyze.py` |
