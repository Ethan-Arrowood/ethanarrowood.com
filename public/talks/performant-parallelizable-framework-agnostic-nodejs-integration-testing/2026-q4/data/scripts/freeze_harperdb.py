#!/usr/bin/env python3
"""Freeze the legacy suite's CI history from the private harperdb repository.

Usage: python3 freeze_harperdb.py --runs <runs.jsonl> --jobs <dir> --out <csv>

Run once, on 2026-10-22. Its output, harperdb-api-jobs.csv, is frozen: the
suite left harperdb on 2025-10-10, and only metadata (run and job names,
conclusions, timestamps) is kept, never code.

Inputs were collected with:
  gh api --paginate "repos/HarperFast/harperdb/actions/workflows/155210814/runs?per_page=100"
  gh api --paginate "repos/HarperFast/harperdb/actions/runs/<id>/jobs?filter=all&per_page=100"
Workflow 155210814 is "Run Source Code CI Tests and API Tests with Node js".
GitHub kept its runs back to 2025-09-03. Runs from 2025-10-10 on are left out:
by then the suite ran in harper, and this workflow failed for unrelated
reasons until it was set to manual-only.
"""
import argparse
import csv
import json
import os

CUTOFF = "2025-10-10"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--runs", required=True)
    ap.add_argument("--jobs", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    runs = [json.loads(l) for l in open(a.runs)]
    rows = []
    for r in sorted(runs, key=lambda r: r["created_at"]):
        if r["created_at"] >= CUTOFF:
            continue
        p = os.path.join(a.jobs, f"{r['id']}.json")
        if not os.path.exists(p):
            raise SystemExit(f"no jobs for run {r['id']}")
        for j in json.load(open(p)):
            rows.append([r["id"], r["created_at"], r["event"], r["head_branch"], r["conclusion"],
                         j["run_attempt"], j["name"], j["conclusion"], j["started_at"], j["completed_at"]])
    with open(a.out, "w", newline="") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(["run_id", "run_created_at", "event", "head_branch", "run_conclusion",
                    "job_attempt", "job_name", "job_conclusion", "job_started_at", "job_completed_at"])
        w.writerows(rows)
    print(f"{len(rows)} jobs from {len({r[0] for r in rows})} runs")


if __name__ == "__main__":
    main()
