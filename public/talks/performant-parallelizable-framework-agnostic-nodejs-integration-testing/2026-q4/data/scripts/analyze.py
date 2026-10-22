#!/usr/bin/env python3
"""Recompute every number in the "Did it work?" section from the CSVs.

Usage: python3 analyze.py [data-dir] > analysis.txt

Standard library only. "Today" is the date in as-of.txt; "last 30 days" is
the 30 days ending at the end of that day (UTC). Monthly series include only
complete months (see common.py). Percentages are rounded half up.

A few figures are not derived here because they are fixed facts about
history, not measurements: they are listed under "static" at the end, with
where each comes from.
"""
import csv
import os
import statistics
import sys
from collections import Counter, defaultdict
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import complete_months, in_last_30, parse_as_of, ts  # noqa: E402

DATA = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..")
AS_OF = parse_as_of(open(os.path.join(DATA, "as-of.txt")).read())
MONTHS = complete_months(date(2025, 11, 1), AS_OF)
PR_1091_MERGED = "2026-06-02T17:38:00Z"  # replaced the legacy suite's fixed sleeps with readiness polls
WINDOW_COMMIT = "8780c520566d7a9cda73a13146da138de370a652"  # the legacy suite during the timing window, before #1091
SUITE_COMMIT = "fb098c0f54f4321848bc2ae7c9cca05aee709a2c"  # the commit before PR #27


def rows(name):
    with open(os.path.join(DATA, name), newline="") as f:
        return list(csv.DictReader(f))


def rnd(x, places=0):
    q = Decimal(1) if places == 0 else Decimal(1).scaleb(-places)
    return Decimal(str(x)).quantize(q, rounding=ROUND_HALF_UP)


def pct(n, d, places=0):
    return f"{rnd(Decimal(100) * n / d, places)}%" if d else "-"


def p90(xs):
    xs = sorted(xs)
    k = (len(xs) - 1) * 0.9
    f = int(k)
    c = min(f + 1, len(xs) - 1)
    return xs[f] + (xs[c] - xs[f]) * (k - f)


def mins(x):
    return f"{rnd(x, 1)} min"


def med(xs):
    return f"median {mins(statistics.median(xs))}, p90 {mins(p90(xs))}, n={len(xs)}" if xs else "-"


def section(title):
    print(f"\n## {title}")


def show(key, value, detail=""):
    print(f"  {key:<38} {value}" + (f"   ({detail})" if detail else ""))


def table(header, data):
    widths = [max(len(str(x)) for x in col) for col in zip(header, *data)]
    for r in [header] + data:
        print("  " + "  ".join(str(x).rjust(w) for x, w in zip(r, widths)))


def truthy(s):
    return s == "True"


print(f"as of {AS_OF}; complete months {MONTHS[0]} to {MONTHS[-1]}")

# --- Legacy suite: frozen -----------------------------------------------------------
section("legacy suite (frozen: harper-legacy-api-jobs.csv, legacy-waits.csv, harperdb-api-jobs.csv)")
jobs = rows("harper-legacy-api-jobs.csv")
linux = [j for j in jobs if j["variant"].startswith("Node.js")]
steps = [(j["run_created_at"], float(j["api_step_minutes"])) for j in linux if j["api_step_conclusion"] == "success" and j["api_step_minutes"]]
show("legacy-test-step-before-1091", med([m for t, m in steps if t < PR_1091_MERGED]), f"successful 'Run API Tests' steps, {min(t for t, _ in steps)[:10]} to #1091")
show("legacy-test-step-after-1091", med([m for t, m in steps if t >= PR_1091_MERGED]), "after #1091 replaced fixed sleeps with polls")
show("legacy-job", med([float(j["job_minutes"]) for j in linux if j["conclusion"] == "success" and j["job_minutes"]]), "whole Linux job incl. setup")

waits = rows("legacy-waits.csv")
for commit, label in ((WINDOW_COMMIT, "legacy-waits-timing-window"), (SUITE_COMMIT, "legacy-waits-before-pr-27")):
    w = [x for x in waits if x["commit"] == commit]
    total = sum(float(x["seconds"]) for x in w)
    by = Counter()
    for x in w:
        by[x["kind"]] += float(x["seconds"])
    show(label, f"{rnd(total, 1)} s ({rnd(total / 60, 1)} min)", f"{len(w)} waits at {commit[:7]}: timers {rnd(by['timer'], 1)} s, restarts {rnd(by['restart'], 1)} s")

def suite_outcome(j):
    """'failure' only when the suite itself failed: a job whose test step was
    skipped failed during setup, before any test ran, and counts as neither."""
    if j["conclusion"] == "failure" and j["api_step_conclusion"] == "skipped":
        return "setup-failure"
    return j["conclusion"]


by_run = defaultdict(list)
for j in linux:
    if j["event"] == "push" and j["head_branch"] == "main" and j["job_attempt"] == "1":
        by_run[j["run_id"]].append(suite_outcome(j))
decided = {r: cs for r, cs in by_run.items() if all(c in ("success", "failure", "setup-failure") for c in cs)}
failed = sum("failure" in cs for cs in decided.values())
setup_only = sum("setup-failure" in cs and "failure" not in cs for cs in decided.values())
show("legacy-main-failure-rate", pct(failed, len(decided), 1),
     f"{failed} of {len(decided)} main push runs, first attempt, Linux Node.js legacy jobs; {setup_only} more failed in setup before any test ran")
for v in ("Node.js v20", "Node.js v22", "Node.js v24"):
    js = [j for j in linux if j["variant"] == v and j["event"] == "push" and j["head_branch"] == "main" and j["job_attempt"] == "1" and j["conclusion"] in ("success", "failure")]
    f = sum(suite_outcome(j) == "failure" for j in js)
    show(f"legacy-main-failure {v}", pct(f, len(js), 1), f"{f} of {len(js)} jobs")
attempts = defaultdict(list)
for j in jobs:
    if j["variant"] in ("Node.js v20", "Node.js v22", "Node.js v24"):
        attempts[(j["run_id"], j["job_attempt"])].append(suite_outcome(j))
fails = [cs for cs in attempts.values() if "failure" in cs]
split = sum("success" in cs for cs in fails)
show("legacy-same-commit-split", pct(split, len(fails)), f"{split} of {len(fails)} failing attempts had another Node version pass")
sample_runs = {(j["run_id"], j["event"], j["head_branch"]) for j in jobs}
ev = Counter("main push" if e == "push" and b == "main" else e for _, e, b in sample_runs)
show("legacy-job-sample", ", ".join(f"{n} {k}" for k, n in sorted(ev.items())), "runs in harper-legacy-api-jobs.csv")

growth = rows("harper-test-growth.csv")
leg = [int(g["legacy_cases"]) for g in growth if int(g["legacy_cases"]) > 0]
show("legacy-suite-size", f"{leg[0]} to {max(leg)} test cases", "Nov 2025 to Jun 2026")

hdb = rows("harperdb-api-jobs.csv")
api = [j for j in hdb if j["job_name"] == "runIntegrationTests" and j["job_conclusion"] in ("success", "failure") and j["job_started_at"] != j["job_completed_at"]]


def hdb_rate(sel):
    f = sum(j["job_conclusion"] == "failure" for j in sel)
    return f"{pct(f, len(sel), 1)} ({f} of {len(sel)})"


show("harperdb-api-job-main-push", hdb_rate([j for j in api if j["event"] == "push" and j["head_branch"] == "main"]), "Sep 3 to Oct 9, 2025")
show("harperdb-api-job-pr", hdb_rate([j for j in api if j["event"] == "pull_request"]))
e2e = []
attempt_jobs = defaultdict(list)
for j in hdb:
    attempt_jobs[(j["run_id"], j["job_attempt"])].append(j)
for js in attempt_jobs.values():
    it = [j for j in js if j["job_name"] == "runIntegrationTests" and j["job_conclusion"] == "success"]
    if it:
        start = min(ts(j["job_started_at"]) for j in js if j["job_started_at"])
        e2e.append((ts(it[0]["job_completed_at"]) - start).total_seconds() / 60)
show("harperdb-start-to-api-result", med(e2e), "successful attempts")

# --- Test growth --------------------------------------------------------------------
section("test growth (harper main, counted from source)")
table(["date", "framework files", "framework cases", "legacy cases"], [[g["date"], g["framework_files"], g["framework_cases"], g["legacy_cases"]] for g in growth])
port = next(g for g in growth if g["date"] == "2026-06-09")
show("growth-since-port", int(growth[-1]["framework_cases"]) - int(port["framework_cases"]), f"test cases added Jun 9 to {growth[-1]['date']}")

# --- One green run --------------------------------------------------------------------
shards = rows("harper-green-run-shards.csv")
section(f"green main run {shards[0]['run_id']}")
n24 = [s for s in shards if s["variant"] == "linux-node24"]
show("tests-per-run", sum(int(s["tests"]) for s in n24),
     f"Linux Node.js 24, {len(n24)} shards: pass {sum(int(s['pass']) for s in n24)}, fail {sum(int(s['fail']) for s in n24)}, skipped {sum(int(s['skipped']) for s in n24)}, todo {sum(int(s['todo']) for s in n24)}")
show("harper-instances-per-run", sum(int(s["harper_instances"]) for s in n24))
serial = sum(int(s["top_level_suites_ms"]) for s in n24) / 60000
slowest = max(int(s["runner_duration_ms"]) for s in n24) / 60000
show("summed-suite-time", mins(serial))
show("slowest-shard", mins(slowest), f"ratio {rnd(serial / slowest, 1)}x")
show("windows-tests", sum(int(s["tests"]) for s in shards if s["variant"] == "windows"))
show("shard-jobs-in-run", len(shards), ", ".join(f"{v} {n}" for v, n in sorted(Counter(s["variant"] for s in shards).items())))

# --- CI runs ----------------------------------------------------------------------------
section("harper integration-tests.yml runs")
all_runs = rows("harper-integration-runs.csv")
ids = [r["run_id"] for r in all_runs]
assert len(ids) == len(set(ids)), "duplicate run ids"
runs = [r for r in all_runs if r["status"] == "completed"]
failed_runs = {r["run_id"]: r for r in rows("harper-main-failed-runs.csv")}
main_runs = [r for r in runs if r["event"] == "push" and r["head_branch"] == "main"]
missing = [r["run_id"] for r in main_runs if r["conclusion"] != "success" and r["run_id"] not in failed_runs]
assert not missing, f"failed main runs without job data: {missing[:5]}"
show("runs-total", len(all_runs), f"{all_runs[0]['created_at'][:10]} to {all_runs[-1]['created_at'][:10]}")


def linux_failed(r):
    return any(v.startswith("linux-node") for v in failed_runs.get(r["run_id"], {}).get("failed_variants", "").split())


def summarize(R):
    main = [r for r in R if r["event"] == "push" and r["head_branch"] == "main"]
    mf = [r for r in main if r["conclusion"] == "failure"]
    green = sum(int(r["run_attempt"]) > 1 and r["conclusion"] == "success" for r in R)
    branches = {r["head_branch"] for r in R if r["event"] == "pull_request" and not r["head_branch"].startswith("renovate/")}
    return [len(R), len(main), pct(len(mf), len(main)), pct(sum(linux_failed(r) for r in main), len(main)), pct(green, len(R), 1), len(branches)]


data = [[m] + summarize([r for r in runs if r["created_at"][:7] == m]) for m in MONTHS]
data.append(["last 30 days"] + summarize([r for r in runs if in_last_30(r["created_at"], AS_OF)]))
table(["month", "runs", "main pushes", "main failed", "linux shard failed", "re-run then succeeded", "PR branches (not renovate)"], data)

node26 = Counter(r["created_at"][:7] for r in failed_runs.values()
                 if any("Node.js v26" in j and "Windows" not in j for j in r["failed_jobs"].split(" | ")))
show("node26-failed-main-runs", ", ".join(f"{m} {node26.get(m, 0)}" for m in MONTHS if m >= "2026-06"), "main runs with a failed Linux Node.js 26 job")

w = [r for r in runs if in_last_30(r["created_at"], AS_OF)]
wm = [r for r in w if r["event"] == "push" and r["head_branch"] == "main"]
wf = [r for r in wm if r["conclusion"] == "failure"]
off_linux = [r for r in wf if not linux_failed(r)]
only_named = [r for r in off_linux if failed_runs[r["run_id"]]["failed_variants"]
              and set(failed_runs[r["run_id"]]["failed_variants"].split()) <= {"windows", "build-windows", "bun", "uws"}]
show("main-failure-rate-last30", pct(len(wf), len(wm)), f"{len(wf)} of {len(wm)} main pushes, final attempt")
show("linux-failure-rate-last30", pct(sum(linux_failed(r) for r in wm), len(wm)), f"{sum(linux_failed(r) for r in wm)} of {len(wm)}")
show("failed-without-linux-node-last30", f"{len(off_linux)} of {len(wf)}", f"{len(only_named)} failed only in Windows, Bun, or uWS jobs")

win = rows("harper-window-runs.csv")
wmain1 = [x for x in win if x["kind"] == "main" and x["attempt1_wall_minutes"]]
show("main-failure-rate-attempt1-last30", pct(sum(bool(x["attempt1_failed_variants"]) for x in wmain1), len(wmain1)), f"{len(wmain1)} main pushes, first attempt")
show("linux-failure-rate-attempt1-last30", pct(sum(truthy(x["attempt1_linux_node_failed"]) for x in wmain1), len(wmain1)),
     f"{sum(truthy(x['attempt1_linux_node_failed']) for x in wmain1)} of {len(wmain1)}, first attempt")

# --- Timing -------------------------------------------------------------------------------
section("time to a full result (first job start to last job end, first attempt)")
show("wall-main-last30", med([float(x["attempt1_wall_minutes"]) for x in win if x["kind"] == "main" and x["conclusion"] == "success" and x["run_attempt"] == "1"]),
     "every successful first-attempt main push in the window")
show("wall-pr-last30", med([float(x["attempt1_wall_minutes"]) for x in win if x["kind"] == "pr" and x["conclusion"] == "success" and x["attempt1_wall_minutes"]]),
     "25% hash sample of successful first-attempt PR runs")
ts_rows = rows("harper-timing-sample.csv")
data = []
for m in MONTHS:
    v = [float(x["wall_minutes"]) for x in ts_rows if x["month"] == m and x["kind"] == "main" and x["conclusion"] == "success" and x["wall_minutes"]]
    if v:
        data.append([m, rnd(statistics.median(v), 1), len(v)])
table(["month", "main median (min)", "n"], data)

# --- PRs ------------------------------------------------------------------------------------
section("merged PRs to harper main (harper-prs.csv)")
prs = rows("harper-prs.csv")
data = []
for m in MONTHS:
    P = [p for p in prs if p["month"] == m]
    touch = sum(truthy(p["touches_integration_tests"]) for p in P)
    code = [p for p in P if truthy(p["changes_non_test_code"])]
    code_t = sum(truthy(p["changes_integration_test_file"]) for p in code)
    data.append([m, len(P), touch, pct(touch, len(P)), len(code), code_t, pct(code_t, len(code)), sum(truthy(p["files_truncated"]) for p in P)])
table(["month", "merged PRs", "touching int. tests", "share", "code PRs", "code PRs with int. test", "share", "file lists truncated"], data)

# --- harper-pro ------------------------------------------------------------------------------
section("harper-pro")
pro = rows("harper-pro-test-growth.csv")
show("cluster-test-files", f"{pro[0]['cluster_test_files']} ({pro[0]['date']}) to {pro[-1]['cluster_test_files']} ({pro[-1]['date']})")
show("integration-test-files", f"{pro[0]['integration_test_files']} to {pro[-1]['integration_test_files']}", f"{pro[-1]['test_cases']} test cases")
show("node-counts", ", ".join(f"NODE_COUNT {r['node_count']} in {r['files']}" for r in rows("harper-pro-node-counts.csv")))
pro_runs = Counter(r["created_at"][:7] for r in rows("harper-pro-integration-runs.csv"))
show("integration-runs-per-month", ", ".join(f"{m} {pro_runs[m]}" for m in MONTHS if m >= "2026-06"))

# --- Next.js -------------------------------------------------------------------------------------
section("Next.js plugin and downstream check")
s = rows("nextjs-suite.csv")[0]
show("nextjs-suite", f"{s['fixtures']} fixtures, {s['spec_files']} spec files, {s['tests']} tests", f"commit {s['commit'][:7]}")
nx = rows("harper-nextjs-downstream-runs.csv")
show("downstream-runs", len(nx), f"{nx[0]['created_at'][:10]} to {nx[-1]['created_at'][:10]}")
sample = rows("harper-nextjs-downstream-sample.csv")
st = Counter(x["suite_status"] for x in sample)
ran = [x for x in sample if x["suite_status"] == "ran"]
nf = [x for x in ran if x["failed_node_versions"]]
show("downstream-sample", f"{len(sample)} sampled: {st['ran']} ran ({pct(st['ran'], len(sample))}), {st['skipped']} skipped, {st['no-adapter-jobs']} without adapter jobs")
show("downstream-failure-rate", pct(len(nf), len(ran)), f"{len(nf)} of {len(ran)} suite runs had a Node.js version fail")

# --- Adoption and npm -------------------------------------------------------------------------
section("adoption and npm")
ad = rows("org-adoption.csv")
public = sum(a["visibility"] == "public" for a in ad)
show("repos-importing", len(ad), f"{public} public, {len(ad) - public} private or internal")
for a in sorted(ad, key=lambda a: -int(a["files_importing"]))[:6]:
    show(f"  {a['repo']}", f"{a['files_importing']} files", a["visibility"])
n = rows("npm.csv")[0]
show("npm", f"{n['versions']} versions, {int(n['downloads']):,} downloads {n['downloads_start']} to {n['downloads_end']}")

section("static (facts about history, not re-measured)")
for k, v in (
    ("legacy-active-tests", "~930: 974 it() calls minus 45 static skips (19 it.skip, 26 in describe.skip('S3 Operations')), counted by hand at fb098c0"),
    ("port", "14 PRs, May 15 to Jun 9, 2026 (#555 #597 #627 #634 #645 #646 #647 #648 #730 #731 #732 #759 #761 #778)"),
    ("port-files", "17 files in integrationTests/apiTests/ at b4f83887f, when the legacy suite was removed"),
    ("port-cleanup", "19,977 lines deleted in harper PR #1173"),
    ("node26-pin", "Node.js 26 pinned to 26.5.0 from 2026-08-03 to 2026-09-01"),
):
    show(k, v)
