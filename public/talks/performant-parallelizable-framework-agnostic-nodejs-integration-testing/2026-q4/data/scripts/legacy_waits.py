#!/usr/bin/env python3
"""Inventory the hard-coded waits in harper's legacy API test suite.

Usage: python3 legacy_waits.py --harper <clone> --commit <sha> --out <csv>

The legacy suite is gone, so this is run once per commit and its output is
frozen. Rules:

- A wait is an awaited timer with a literal duration in a test file under
  integrationTests/apiTests/tests/: `await setTimeout(N)` (node:timers/
  promises) or `setTimeout(resolve, N)` inside a Promise.
- Each call to a restart helper (restartWithTimeout,
  restartServiceHttpWorkersWithTimeout) counts as the helper's fixed
  1-second pre-wait plus its timeout argument. `testData.<key>` arguments
  are resolved from config/envConfig.mjs at the same commit.
- Polling helpers (loops that wait until a condition holds) are not counted.
- A wait inside a loop is counted once; the `in_loop` column flags it, so the
  total is a lower bound.
"""
import argparse
import csv
import re
import subprocess

TESTS = "integrationTests/apiTests/tests"
CONFIG = "integrationTests/apiTests/config/envConfig.mjs"
AWAIT_TIMER = re.compile(r"await\s+setTimeout\(\s*([\d_]+)\s*\)")
PROMISE_TIMER = re.compile(r"setTimeout\(\s*resolve\s*,\s*([\d_]+)\s*\)")
RESTART = re.compile(r"(restartWithTimeout|restartServiceHttpWorkersWithTimeout)\(\s*([^)]*)\)")


def show(repo, commit, path):
    return subprocess.run(["git", "-C", repo, "show", f"{commit}:{path}"], capture_output=True, text=True, check=True).stdout


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--harper", required=True)
    ap.add_argument("--commit", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()

    config = {k: int(v.replace("_", "")) for k, v in re.findall(r"'(\w+)'\s*:\s*([\d_]+)\s*,", show(a.harper, a.commit, CONFIG))}
    files = subprocess.run(["git", "-C", a.harper, "ls-tree", "--name-only", f"{a.commit}:{TESTS}"],
                           capture_output=True, text=True, check=True).stdout.split()
    rows = []
    for name in sorted(f for f in files if f.endswith(".mjs") and f != "testSuite.mjs"):
        lines = show(a.harper, a.commit, f"{TESTS}/{name}").splitlines()
        depth = 0  # crude loop tracking: count open for/while blocks by braces
        loop_stack = []
        for i, line in enumerate(lines, 1):
            stripped = line.strip()
            if stripped.startswith("//"):
                continue
            if re.match(r"(for|while)\s*\(", stripped):
                loop_stack.append(depth)
            depth += line.count("{") - line.count("}")
            while loop_stack and depth <= loop_stack[-1]:
                loop_stack.pop()
            in_loop = bool(loop_stack)
            for rx, kind in ((AWAIT_TIMER, "timer"), (PROMISE_TIMER, "timer")):
                for t in rx.finditer(line):
                    rows.append([name, i, kind, int(t.group(1).replace("_", "")) / 1000, in_loop, stripped[:80]])
            for t in RESTART.finditer(line):
                arg = t.group(2).strip()
                key = arg.removeprefix("testData.")
                ms = config.get(key) if arg.startswith("testData.") else int(arg.replace("_", "")) if arg.replace("_", "").isdigit() else None
                if ms is None:
                    raise SystemExit(f"{name}:{i}: can't resolve restart timeout {arg!r}")
                rows.append([name, i, "restart", (1000 + ms) / 1000, in_loop, stripped[:80]])
    with open(a.out, "w", newline="") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(["commit", "file", "line", "kind", "seconds", "in_loop", "code"])
        for r in rows:
            w.writerow([a.commit] + r)
    total = sum(r[3] for r in rows)
    print(f"{len(rows)} waits, {total:.1f} s ({total / 60:.1f} min) at {a.commit}")


if __name__ == "__main__":
    main()
