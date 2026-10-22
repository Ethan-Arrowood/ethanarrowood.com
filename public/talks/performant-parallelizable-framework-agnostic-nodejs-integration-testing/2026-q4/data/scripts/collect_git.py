#!/usr/bin/env python3
"""Git-history metrics for the "Did it work?" section.

Usage: python3 collect_git.py --as-of YYYY-MM-DD --harper <clone> --harper-pro <clone> --out <dir> [--no-fetch]

Both clones need full history (not --filter=blob:none). Writes to --out:

- harper-test-growth.csv: test files and test cases on harper's main branch
  at fixed milestones, the first of every month, and the as-of date. A test
  case is a line starting with it( or test(, optionally .only/.skip/.todo.
- harper-pro-test-growth.csv: harper-pro integration test files, cluster test
  files, and test cases at the first of every month and the as-of date.
- harper-pro-node-counts.csv: NODE_COUNT values in harper-pro's cluster
  tests at the as-of date.
- git-refs.csv: the origin/main commits used.

Each snapshot is the last first-parent commit on main before the end of that
day in UTC. Git reads a bare date as that day at the current time of day, so
every boundary is passed as an explicit UTC time.
"""
import argparse
import csv
import os
import re
import subprocess
import sys
from collections import Counter
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import next_month, parse_as_of  # noqa: E402

CASE = r"^[[:space:]]*(it|test)(\.only|\.skip|\.todo)?\("
# Milestones that aren't month starts: just after PR #27 merged, mid-port,
# and the day the port finished.
HARPER_MILESTONES = ["2025-11-05", "2025-12-04", "2026-05-15", "2026-06-09"]
HARPER_FIRST_MONTH = date(2026, 1, 1)
PRO_FIRST_MONTH = date(2026, 3, 1)
REF = "origin/main"


def git(repo, *args, ok=(0,)):
    r = subprocess.run(["git", "-C", repo, *args], capture_output=True, text=True)
    if r.returncode not in ok:
        raise RuntimeError(f"git {' '.join(args)}: {r.stderr.strip()[:300]}")
    return r.stdout


def lines(out):
    return [l for l in out.splitlines() if l.strip()]


def month_starts(first, as_of):
    d = first
    while d <= as_of:
        yield d
        d = next_month(d)


def at(repo, day):
    """Last first-parent commit on main before the end of `day` (UTC)."""
    nxt = date.fromisoformat(str(day)) + timedelta(days=1)
    return git(repo, "rev-list", "-1", "--first-parent", f"--before={nxt} 00:00:00 +0000", REF).strip()


def test_files(repo, commit, pattern):
    return [f for f in lines(git(repo, "ls-tree", "-r", "--name-only", commit, "integrationTests")) if re.search(pattern, f)]


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
    as_of = parse_as_of(a.as_of)

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
        files = test_files(a.harper, c, r"\.test\.(m?ts|m?js)$")
        legacy = [f for f in lines(git(a.harper, "ls-tree", "-r", "--name-only", c, "integrationTests/apiTests/tests"))
                  if f.endswith(".mjs") and "testSuite" not in f]
        rows.append([d, c, len(files), count_cases(a.harper, c, files), len(legacy),
                     count_cases(a.harper, c, ["integrationTests/apiTests/tests"]) if legacy else 0])
    write(f"{a.out}/harper-test-growth.csv", ["date", "commit", "framework_files", "framework_cases", "legacy_files", "legacy_cases"], rows)

    days = sorted(set([d.isoformat() for d in month_starts(PRO_FIRST_MONTH, as_of)] + [a.as_of]))
    rows = []
    for d in days:
        c = at(a.harper_pro, d)
        files = test_files(a.harper_pro, c, r"\.test\.(m?[jt]s)$")
        rows.append([d, c, len(files), sum(f.startswith("integrationTests/cluster/") for f in files), count_cases(a.harper_pro, c, files)])
    write(f"{a.out}/harper-pro-test-growth.csv", ["date", "commit", "integration_test_files", "cluster_test_files", "test_cases"], rows)

    c = at(a.harper_pro, a.as_of)
    counts = Counter(int(n) for n in re.findall(r"NODE_COUNT\s*=\s*(\d+)",
                                                git(a.harper_pro, "grep", "-hE", r"NODE_COUNT[[:space:]]*=[[:space:]]*[0-9]+", c, "--", "integrationTests/cluster", ok=(0, 1))))
    write(f"{a.out}/harper-pro-node-counts.csv", ["node_count", "files"], sorted(counts.items()))


if __name__ == "__main__":
    main()
