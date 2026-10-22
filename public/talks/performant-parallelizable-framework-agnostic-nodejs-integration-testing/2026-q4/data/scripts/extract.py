#!/usr/bin/env python3
"""Turn collect.py's raw data into the published CSVs.

Usage: python3 extract.py --raw <dir> [--out <data dir>]

Only data from public repositories is written. harper-legacy-api-jobs.csv
is frozen (the legacy suite was removed in June 2026 and GitHub has purged
its step timings), so it is never rewritten here.
"""
import argparse
import csv
import json
import os
import re
import shutil
from datetime import datetime, timedelta, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
SHARD = re.compile(r"Integration Tests (\d+)/(\d+) \((.*)\)")


def ts(s):
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def write(out, name, header, rows):
    with open(os.path.join(out, name), "w", newline="") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(header)
        w.writerows(rows)
    print(f"{name}: {len(rows)} rows")


def jsonl(path):
    return [json.loads(l) for l in open(path)]


def variant(name):
    """Group a job name into the configuration it tests."""
    m = SHARD.match(name)
    if not m:
        return "apiTests" if name.startswith("Integration API Tests") else "other"
    v = m.group(3)
    for k in ("Windows", "Bun", "uWS"):
        if k in v:
            return k.lower()
    return "linux-node"


def step_variant(name):
    m = SHARD.match(name)
    if not m:
        return None
    v = m.group(3)
    for k in ("Windows", "Bun", "uWS"):
        if k in v:
            return k.lower()
    return "linux-node" + re.sub(r"\D", "", v)[:2]


def jobs_for(raw, run_id, latest=False):
    """Jobs for a run. latest=True keeps only the final attempt, which is
    what decided the run's conclusion."""
    p = f"{raw}/jobs/harper/{run_id}.json"
    if not os.path.exists(p):
        return None
    jobs = json.load(open(p))
    if latest and jobs:
        last = max(j["run_attempt"] or 1 for j in jobs)
        jobs = [j for j in jobs if (j["run_attempt"] or 1) == last]
    return jobs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", required=True)
    ap.add_argument("--out", default=os.path.dirname(HERE))
    a = ap.parse_args()
    raw, out = a.raw, a.out
    as_of = open(f"{raw}/as-of.txt").read().strip()
    now = datetime.fromisoformat(as_of).replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)

    # 1. Every run of harper's integration-tests.yml.
    runs = jsonl(f"{raw}/runs/harper-integration.jsonl")
    write(out, "harper-integration-runs.csv", ["run_id", "created_at", "event", "head_branch", "status", "conclusion", "run_attempt"],
          [[r["id"], r["created_at"], r["event"], r["head_branch"], r["status"], r["conclusion"], r["run_attempt"]] for r in runs])

    # 2. Failed job variants for every non-success main push run.
    rows = []
    for r in runs:
        if not (r["event"] == "push" and r["head_branch"] == "main" and r["status"] == "completed" and r["conclusion"] != "success"):
            continue
        jobs = jobs_for(raw, r["id"], latest=True)
        if jobs is None:
            continue
        failed = sorted({variant(j["name"]) for j in jobs if j["conclusion"] in ("failure", "cancelled", "timed_out")})
        rows.append([r["id"], r["created_at"], r["conclusion"], " ".join(failed)])
    write(out, "harper-main-failed-runs.csv", ["run_id", "created_at", "conclusion", "failed_variants"], rows)

    # 3. Timing sample: wall-clock per run and test-step time per shard.
    byid = {str(r["id"]): r for r in runs}
    sample = list(csv.DictReader(open(f"{raw}/timing-sample.csv")))
    trows, srows = [], []
    for s in sample:
        r, jobs = byid.get(s["run_id"]), jobs_for(raw, s["run_id"])
        if not r or not jobs:
            continue
        timed = [j for j in jobs if j["started_at"] and j["completed_at"] and j["conclusion"] != "skipped"]
        if not timed:
            continue
        wall = (max(ts(j["completed_at"]) for j in timed) - min(ts(j["started_at"]) for j in timed)).total_seconds() / 60
        last30 = (now - ts(r["created_at"])) < timedelta(days=30)
        trows.append([s["run_id"], s["month"], last30, s["kind"], r["conclusion"], round(wall, 3), s["drawn_as_of"]])
        for j in jobs:
            v = step_variant(j["name"])
            for st in j.get("steps") or []:
                if v and st["name"].startswith("Run Integration Test Shard") and st["conclusion"] == "success" and st["started_at"] and st["completed_at"]:
                    srows.append([s["run_id"], v, round((ts(st["completed_at"]) - ts(st["started_at"])).total_seconds() / 60, 3)])
    write(out, "harper-timing-sample.csv", ["run_id", "month", "last30", "kind", "conclusion", "wall_minutes", "drawn_as_of"], trows)
    write(out, "harper-shard-step-sample.csv", ["run_id", "variant", "test_step_minutes"], srows)

    # 4. Per-shard summary of one green main run, from its job logs.
    green = open(f"{raw}/green-run.txt").read().strip()
    rows = []
    for line in open(f"{raw}/logs/{green}/joblist.tsv"):
        if not line.strip():
            continue
        jid, name = line.rstrip("\n").split("\t")[:2]
        log = open(f"{raw}/logs/{green}/job-{jid}.log", errors="replace").read()
        c = {}
        for k, n in re.findall(r"ℹ (tests|suites|pass|fail|skipped|todo|duration_ms) ([\d.]+)", log):
            c[k] = c.get(k, 0) + float(n)
        suites_ms = sum(float(m) for m in re.findall(r"\d{2}:\d{2}:\d{2}\.\d+Z [✔✖﹣] .+ \(([\d.]+)ms\)\s*$", log, re.M))
        instances = len(re.findall(r"Logs for this instance will be stored", log))
        rows.append([green, jid, name, int(c.get("tests", 0)), int(c.get("pass", 0)), int(c.get("fail", 0)), int(c.get("skipped", 0)),
                     int(c.get("todo", 0)), round(c.get("duration_ms", 0)), round(suites_ms), instances])
    write(out, "harper-green-run-shards.csv",
          ["run_id", "job_id", "job_name", "tests", "pass", "fail", "skipped", "todo", "runner_duration_ms", "top_level_suites_ms", "harper_instances"], rows)

    # 5. Next.js downstream check: every run, and the sample.
    nx = jsonl(f"{raw}/runs/harper-nextjs-downstream.jsonl")
    write(out, "harper-nextjs-downstream-runs.csv", ["run_id", "created_at", "event", "conclusion"], [[r["id"], r["created_at"], r["event"], r["conclusion"]] for r in nx])
    rows = []
    for i in [l.strip() for l in open(f"{raw}/nextjs-sample.txt") if l.strip()]:
        jobs = [j for j in (jobs_for(raw, i, latest=True) or []) if "adapter integration" in j["name"]]
        concl = [j["conclusion"] for j in jobs]
        status = "no-adapter-jobs" if not jobs else "ran" if any(c in ("success", "failure") for c in concl) else "skipped"
        failed = [m.group(1) for j in jobs if j["conclusion"] == "failure" for m in [re.search(r"\(Node (\d+)\)", j["name"])] if m]
        rows.append([i, status, " ".join(failed)])
    write(out, "harper-nextjs-downstream-sample.csv", ["run_id", "suite_status", "failed_node_versions"], rows)

    # 6. harper-pro integration workflow runs.
    pro = jsonl(f"{raw}/runs/harper-pro-integration.jsonl")
    write(out, "harper-pro-integration-runs.csv", ["run_id", "created_at", "event", "head_branch", "conclusion"],
          [[r["id"], r["created_at"], r["event"], r["head_branch"], r["conclusion"]] for r in pro])

    # 7. Adoption across HarperFast. Only public repositories are named.
    rows = [l.rstrip("\n").split("\t") for l in list(open(f"{raw}/adoption.tsv"))[1:] if l.strip()]
    write(out, "org-adoption.csv", ["repo", "files_importing"], [[r, n] for r, v, n in rows if v == "public"])
    write(out, "org-adoption-summary.csv", ["public_repos", "non_public_repos"],
          [[sum(v == "public" for _, v, _ in rows), sum(v != "public" for _, v, _ in rows)]])

    # 8. Git-history CSVs, written by collect_git.py into the raw directory.
    for name in ("harper-test-growth.csv", "harper-pr-activity.csv", "harper-pro-test-growth.csv", "git-refs.csv"):
        shutil.copyfile(f"{raw}/{name}", f"{out}/{name}")
        print(f"{name}: copied")

    # 9. When each run list was collected, as its newest run.
    times = [("harper integration-tests.yml run list", runs), ("harper Next.js downstream run list", nx), ("harper-pro integration run list", pro)]
    write(out, "collection-times.csv", ["source", "latest_run_created_at"], [[n, max(r["created_at"] for r in rs)] for n, rs in times if rs])

    with open(f"{out}/as-of.txt", "w") as f:
        f.write(as_of + "\n")


if __name__ == "__main__":
    main()
