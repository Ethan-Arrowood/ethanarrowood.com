#!/usr/bin/env python3
"""Recompute every number in the "Did it work?" section of the 2026 Q4 deck
from the CSVs next to this script's parent folder.

Usage: python3 analyze.py [data-dir]

No dependencies beyond the standard library. "Today" is the date in
as-of.txt, the day the data was collected; "last 30 days" is the 30 days
ending then. Monthly series stop at the last complete month. Percentages
are rounded half up to whole numbers unless shown with a decimal.
"""
import csv
import os
import statistics
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from decimal import ROUND_HALF_UP, Decimal

DATA = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..")
AS_OF = open(os.path.join(DATA, "as-of.txt")).read().strip()
NOW = datetime.fromisoformat(AS_OF).replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
# Monthly series stop before the month still in progress on NOW.
PARTIAL_MONTH = NOW.strftime("%Y-%m")


def rows(name):
    with open(os.path.join(DATA, name), newline="") as f:
        return list(csv.DictReader(f))


def ts(s):
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def last30(s):
    return (NOW - ts(s)).days < 30


def pct(n, d, places=0):
    q = Decimal(1) if places == 0 else Decimal(1).scaleb(-places)
    return f"{(Decimal(100) * n / d).quantize(q, rounding=ROUND_HALF_UP)}%"


def p90(xs):
    xs = sorted(xs)
    k = (len(xs) - 1) * 0.9
    f = int(k)
    c = min(f + 1, len(xs) - 1)
    return xs[f] + (xs[c] - xs[f]) * (k - f)


def mins(x):
    return f"{Decimal(str(x)).quantize(Decimal('0.1'), rounding=ROUND_HALF_UP)} min"


def section(title):
    print(f"\n## {title}")


def show(key, value, detail=""):
    print(f"  {key:<34} {value}" + (f"   ({detail})" if detail else ""))


# --- Legacy suite --------------------------------------------------------------
section("legacy suite (harper integration-tests.yml, legacy API job)")
jobs = rows("harper-legacy-api-jobs.csv")
linux = [j for j in jobs if j["variant"].startswith("Node.js")]

steps = [float(j["api_step_minutes"]) for j in linux if j["api_step_conclusion"] == "success" and j["api_step_minutes"]]
show("legacy-test-step", f"median {mins(statistics.median(steps))}, p90 {mins(p90(steps))}", f"n={len(steps)} successful 'Run API Tests' steps")

# A main push run fails if any attempt-1 Linux legacy job failed. Runs with a
# job that neither passed nor failed (cancelled, skipped) are left out.
by_run = defaultdict(list)
for j in linux:
    if j["event"] == "push" and j["head_branch"] == "main" and j["job_attempt"] == "1":
        by_run[j["run_id"]].append(j["conclusion"])
decided = {r: cs for r, cs in by_run.items() if all(c in ("success", "failure") for c in cs)}
failed = sum("failure" in cs for cs in decided.values())
show("legacy-main-failure-rate", pct(failed, len(decided), 1), f"{failed} of {len(decided)} main push runs, attempt 1")

# Failing attempts where another of Node 20/22/24 passed on the same commit.
attempts = defaultdict(list)
for j in jobs:
    v = j["variant"]
    if v in ("Node.js v20", "Node.js v22", "Node.js v24"):
        attempts[(j["run_id"], j["job_attempt"])].append(j["conclusion"])
fail_attempts = [cs for cs in attempts.values() if "failure" in cs]
split = sum("success" in cs for cs in fail_attempts)
show("legacy-same-commit-split", pct(split, len(fail_attempts)), f"{split} of {len(fail_attempts)} failing attempts had another Node version pass")

growth = rows("harper-test-growth.csv")
leg = [int(g["legacy_cases"]) for g in growth if int(g["legacy_cases"]) > 0]
show("legacy-suite-size", f"{leg[0]} to {max(leg)} test cases", "Nov 2025 to Jun 2026, never grew past ~1,000")

# --- Test growth ---------------------------------------------------------------
section("test growth (harper main, counted from source)")
for g in growth:
    show(g["date"], f"framework {g['framework_cases']} cases in {g['framework_files']} files; legacy {g['legacy_cases']}")
port_done = next(g for g in growth if g["date"] == "2026-06-09")
latest = growth[-1]
show("growth-since-port", int(latest["framework_cases"]) - int(port_done["framework_cases"]), f"test cases added Jun 9 to {latest['date']}")

# --- One CI run today ------------------------------------------------------------
shards = [s for s in rows("harper-green-run-shards.csv") if s["job_name"].endswith("(Node.js v24)")]
section(f"green main run {shards[0]['run_id']}, Linux Node 24 shards")
show("tests-per-run", sum(int(s["tests"]) for s in shards), f"pass {sum(int(s['pass']) for s in shards)}, fail {sum(int(s['fail']) for s in shards)}, {len(shards)} shards")
show("harper-instances-per-run", sum(int(s["harper_instances"]) for s in shards))
serial = sum(int(s["top_level_suites_ms"]) for s in shards) / 60000
slowest = max(int(s["runner_duration_ms"]) for s in shards) / 60000
show("summed-suite-time", mins(serial))
show("slowest-shard", mins(slowest), f"{serial / slowest:.1f}x")

# --- CI runs -------------------------------------------------------------------
section("harper integration-tests.yml runs")
runs = rows("harper-integration-runs.csv")
done = [r for r in runs if r["status"] == "completed"]

by_month = defaultdict(list)
for r in done:
    if r["created_at"][:7] != PARTIAL_MONTH:
        by_month[r["created_at"][:7]].append(r)
    if last30(r["created_at"]):
        by_month["last30"].append(r)

failed_runs = {r["run_id"]: r["failed_variants"].split() for r in rows("harper-main-failed-runs.csv")}

print(f"  {'month':<8} {'runs':>6} {'main':>5} {'main fail':>10} {'linux fail':>10} {'rerun green':>12} {'PR branches':>12}")
for m in sorted(by_month):
    R = by_month[m]
    main = [r for r in R if r["event"] == "push" and r["head_branch"] == "main"]
    mf = [r for r in main if r["conclusion"] == "failure"]
    linux_f = [r for r in main if "linux-node" in failed_runs.get(r["run_id"], [])]
    green = sum(int(r["run_attempt"]) > 1 and r["conclusion"] == "success" for r in R)
    branches = {r["head_branch"] for r in R if r["event"] == "pull_request"}
    non_renovate = {b for b in branches if not b.startswith("renovate/")}
    print(
        f"  {m:<8} {len(R):>6} {len(main):>5} {pct(len(mf), len(main)) if main else '-':>10} "
        f"{pct(len(linux_f), len(main)) if main else '-':>10} {pct(green, len(R), 1):>12} "
        f"{len(branches):>5} ({len(non_renovate)})"
    )

R = by_month["last30"]
main = [r for r in R if r["event"] == "push" and r["head_branch"] == "main"]
mf = [r for r in main if r["conclusion"] == "failure"]
only_other = [r for r in mf if "linux-node" not in failed_runs.get(r["run_id"], [])]
show("main-failure-rate-last30", pct(len(mf), len(main)), f"{len(mf)} of {len(main)} main pushes")
show("failures-only-off-linux-last30", pct(len(only_other), len(mf)), f"{len(only_other)} of {len(mf)} failed runs had no Linux Node shard failure")

# --- Timing ----------------------------------------------------------------------
section("time to a full result (timing sample, successful attempt-1 runs)")
sample = rows("harper-timing-sample.csv")
for kind in ("main", "pr"):
    w = [float(s["wall_minutes"]) for s in sample if s["kind"] == kind and s["last30"] == "True" and s["conclusion"] == "success"]
    show(f"wall-{kind}-last30", f"median {mins(statistics.median(w))}, p90 {mins(p90(w))}", f"n={len(w)}")

# --- PR activity -----------------------------------------------------------------
section("harper PR activity (first-parent commits on main)")
act = {a["month"]: a for a in rows("harper-pr-activity.csv")}


def span(months, f):
    vals = [f(act[m]) for m in months]
    return vals


print(f"  {'month':<8} {'merged':>6} {'touching':>8} {'share':>6} {'fixes':>6} {'tested':>6} {'share':>6}")
for m in sorted(act):
    a = act[m]
    mg, t, fx, ft = (int(a[k]) for k in ("merged", "touching_integration_tests", "fix_commits", "fix_with_integration_test"))
    print(f"  {m:<8} {mg:>6} {t:>8} {pct(t, mg) if mg else '-':>6} {fx:>6} {ft:>6} {pct(ft, fx) if fx else '-':>6}")

before = ["2026-02", "2026-03", "2026-04"]
after = [m for m in sorted(act) if m >= "2026-06"]
for label, months in (("Feb-Apr 2026", before), (f"{after[0]} to {after[-1]}", after)):
    touch = span(months, lambda a: int(a["touching_integration_tests"]))
    share = span(months, lambda a: Decimal(100) * int(a["touching_integration_tests"]) / int(a["merged"]))
    fixes = span(months, lambda a: Decimal(100) * int(a["fix_with_integration_test"]) / int(a["fix_commits"]))
    rnd = lambda d: d.quantize(Decimal(1), rounding=ROUND_HALF_UP)
    show(f"prs-touching {label}", f"{min(touch)}-{max(touch)} a month")
    show(f"share-of-merged {label}", f"{rnd(min(share))}-{rnd(max(share))}%")
    show(f"fixes-with-test {label}", f"{rnd(min(fixes))}-{rnd(max(fixes))}%")
    runs_m = [len([r for r in done if r["created_at"][:7] == m]) for m in months]
    show(f"ci-runs {label}", f"{min(runs_m):,}-{max(runs_m):,} a month")

# --- harper-pro ------------------------------------------------------------------
section("harper-pro")
pro = rows("harper-pro-test-growth.csv")
show("cluster-test-files", f"{pro[0]['cluster_test_files']} ({pro[0]['date']}) to {pro[-1]['cluster_test_files']} ({pro[-1]['date']})")
show("integration-test-files", f"{pro[0]['integration_test_files']} to {pro[-1]['integration_test_files']}")
pro_runs = Counter(r["created_at"][:7] for r in rows("harper-pro-integration-runs.csv"))
show("integration-runs-per-month", ", ".join(f"{m} {n}" for m, n in sorted(pro_runs.items()) if "2026-06" <= m < PARTIAL_MONTH))

# --- Next.js downstream check ----------------------------------------------------
section("Next.js downstream check in harper")
nx_runs = rows("harper-nextjs-downstream-runs.csv")
show("downstream-runs", len(nx_runs), f"{nx_runs[-1]['created_at'][:10]} to {nx_runs[0]['created_at'][:10]}")
nx = rows("harper-nextjs-downstream-sample.csv")
status = Counter(n["suite_status"] for n in nx)
ran = [n for n in nx if n["suite_status"] == "ran"]
nx_failed = [n for n in ran if n["failed_node_versions"]]
show("downstream-sample", f"{len(nx)} sampled: {status['ran']} ran, {status['skipped']} skipped, {status['no-adapter-jobs']} without adapter jobs")
show("downstream-failure-rate", pct(len(nx_failed), len(ran)), f"{len(nx_failed)} of {len(ran)} suite runs had a Node version fail")

# --- Adoption ------------------------------------------------------------------
section("adoption across HarperFast")
ad = rows("org-adoption.csv")
show("repos-importing", len(ad))
for a in sorted(ad, key=lambda a: -int(a["test_files_importing"]))[:5]:
    show(a["repo"], f"{a['test_files_importing']} files")
