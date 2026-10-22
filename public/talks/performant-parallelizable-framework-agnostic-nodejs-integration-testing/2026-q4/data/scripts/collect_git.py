#!/usr/bin/env python3
"""Git-history metrics for the "Did it work?" section.

Usage: python3 collect_git.py --as-of YYYY-MM-DD --harper <clone> --harper-pro <clone> --out <dir>

Both clones need full history (not --filter=blob:none); the script fetches
origin first. Writes harper-test-growth.csv, harper-pr-activity.csv, and
harper-pro-test-growth.csv to --out.

- Test growth: test files and test cases on harper's main branch at fixed
  milestones, the first of every month, and the as-of date. A test case is a
  line starting with it( or test(, optionally .only/.skip/.todo.
- PR activity: first-parent commits on main (one per merged PR) for every
  complete month. A month still in progress on the as-of date is left out.
- harper-pro growth: integration and cluster test files over time.
"""
import argparse
import csv
import os
import re
import subprocess
from datetime import date, timedelta

CASE = r"^[[:space:]]*(it|test)(\.only|\.skip|\.todo)?\("
# Milestones that aren't month starts: just after PR #27 merged, mid-port,
# and the day the port finished.
HARPER_MILESTONES = ["2025-11-05", "2025-12-04", "2026-05-15", "2026-06-09"]
HARPER_FIRST_MONTH = date(2026, 1, 1)
REF = "origin/main"
PRO_FIRST_MONTH = date(2026, 3, 1)
PR_FIRST_MONTH = date(2025, 11, 1)


def git(repo, *args, ok=(0,)):
    r = subprocess.run(["git", "-C", repo, *args], capture_output=True, text=True)
    if r.returncode not in ok:
        raise RuntimeError(f"git {' '.join(args)}: {r.stderr.strip()[:300]}")
    return r.stdout


def month_starts(first, as_of):
    d = first
    while d <= as_of:
        yield d
        d = date(d.year + (d.month == 12), d.month % 12 + 1, 1)


# Git reads a bare date as that date at the current time of day, so every
# boundary is an explicit UTC midnight, matching GitHub's timestamps.
def utc_midnight(day):
    return f"{day} 00:00:00 +0000"


def at(repo, day):
    """Last first-parent commit on main before the end of `day` (UTC)."""
    nxt = date.fromisoformat(str(day)) + timedelta(days=1)
    return git(repo, "rev-list", "-1", "--first-parent", f"--before={utc_midnight(nxt)}", REF).strip()


def lines(out):
    return [l for l in out.splitlines() if l.strip()]


def test_files(repo, commit):
    return [f for f in lines(git(repo, "ls-tree", "-r", "--name-only", commit, "integrationTests"))
            if re.search(r"\.test\.(m?ts|m?js)$", f)]


def count_cases(repo, commit, paths):
    if not paths:
        return 0
    return len(lines(git(repo, "grep", "-hE", CASE, commit, "--", *paths, ok=(0, 1))))


def write(path, header, rows):
    with open(path, "w", newline="") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(header)
        w.writerows(rows)
    print(f"{os.path.basename(path)}: {len(rows)} rows")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--as-of", required=True)
    ap.add_argument("--harper", required=True)
    ap.add_argument("--harper-pro", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--no-fetch", action="store_true", help="use the clones' origin/main as they are")
    a = ap.parse_args()
    as_of = date.fromisoformat(a.as_of)
    refs = []
    for name, repo in (("harper", a.harper), ("harper-pro", a.harper_pro)):
        if not a.no_fetch:
            git(repo, "fetch", "-q", "origin")
        refs.append([name, git(repo, "rev-parse", REF).strip()])
    write(f"{a.out}/git-refs.csv", ["repo", "origin_main_commit"], refs)

    days = sorted(set(HARPER_MILESTONES + [d.isoformat() for d in month_starts(HARPER_FIRST_MONTH, as_of)] + [a.as_of]))
    rows = []
    for d in days:
        c = at(a.harper, d)
        files = test_files(a.harper, c)
        legacy = [f for f in lines(git(a.harper, "ls-tree", "-r", "--name-only", c, "integrationTests/apiTests/tests"))
                  if f.endswith(".mjs") and "testSuite" not in f]
        rows.append([d, len(files), count_cases(a.harper, c, files), len(legacy),
                     count_cases(a.harper, c, ["integrationTests/apiTests/tests"]) if legacy else 0])
    write(f"{a.out}/harper-test-growth.csv", ["date", "framework_files", "framework_cases", "legacy_files", "legacy_cases"], rows)

    rows = []
    for start in month_starts(PR_FIRST_MONTH, as_of):
        end = date(start.year + (start.month == 12), start.month % 12 + 1, 1)
        if end - timedelta(days=1) > as_of:
            break  # month still in progress
        rng = [f"--since={utc_midnight(start)}", f"--until={utc_midnight(end)}"]
        merged = len(lines(git(a.harper, "log", "--first-parent", *rng, "--format=%h", REF)))
        touching = len(lines(git(a.harper, "log", "--first-parent", *rng, "--format=%h", REF, "--",
                                 "integrationTests", ":!integrationTests/apiTests/tests")))
        adding = len(lines(git(a.harper, "log", "--first-parent", *rng, "--diff-filter=A", "--format=%h", REF, "--",
                               "integrationTests/**/*.test.*")))
        fixes = lines(git(a.harper, "log", "--first-parent", *rng, "--format=%H", "-i", "-E", "--grep=^fix", REF))
        tested = sum(1 for c in fixes
                     if any(re.match(r"^integrationTests/.*\.test\.", f) for f in lines(git(a.harper, "diff", "--name-only", f"{c}^1", c))))
        rows.append([start.strftime("%Y-%m"), merged, touching, adding, len(fixes), tested])
    write(f"{a.out}/harper-pr-activity.csv",
          ["month", "merged", "touching_integration_tests", "adding_test_files", "fix_commits", "fix_with_integration_test"], rows)

    days = sorted(set([d.isoformat() for d in month_starts(PRO_FIRST_MONTH, as_of)] + [a.as_of]))
    rows = []
    for d in days:
        c = at(a.harper_pro, d)
        files = [f for f in lines(git(a.harper_pro, "ls-tree", "-r", "--name-only", c, "integrationTests"))
                 if re.search(r"\.test\.(m?[jt]s)$", f)]
        rows.append([d, len(files), sum(f.startswith("integrationTests/cluster/") for f in files)])
    write(f"{a.out}/harper-pro-test-growth.csv", ["date", "integration_test_files", "cluster_test_files"], rows)


if __name__ == "__main__":
    main()
