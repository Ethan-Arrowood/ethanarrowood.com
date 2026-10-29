#!/usr/bin/env python3
"""Turn collect.py's raw data into the published CSVs.

Usage: python3 extract.py --raw <dir> [--out <data dir>]

Never touches the frozen files: harper-legacy-api-jobs.csv,
harperdb-api-jobs.csv, and legacy-waits.csv. Stops with an error when job
data is missing, rather than publishing numbers that would silently look
better. Only metadata is written, never code.
"""
import argparse
import csv
import json
import os
import re
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import parse_as_of, ts  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
SHARD = re.compile(r"Integration Tests (\d+)/(\d+) \((.*)\)")
CODE_EXT = (".js", ".mjs", ".cjs", ".ts", ".mts", ".cts")
TEST_DIRS = ("integrationTests/", "unitTests/", "test/", "tests/")


def write(out, name, header, rows):
    with open(os.path.join(out, name), "w", newline="") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(header)
        w.writerows(rows)
    print(f"{name}: {len(rows)} rows")


def jsonl(path):
    return [json.loads(l) for l in open(path)]


def variant(name):
    """The configuration a job tests: linux-node22/24/26, windows, bun, uws,
    build-linux, build-windows, apiTests, or other."""
    if name.startswith("Build Harper"):
        return "build-windows" if "Windows" in name else "build-linux"
    m = SHARD.match(name)
    if not m:
        return "apiTests" if name.startswith("Integration API Tests") else "other"
    v = m.group(3)
    for k in ("Windows", "Bun", "uWS"):
        if k in v:
            return k.lower()
    return "linux-node" + re.sub(r"\D", "", v)[:2]


class Jobs:
    def __init__(self, raw):
        self.dir = f"{raw}/jobs/harper"
        self.missing = []

    def get(self, run_id, attempt=None):
        """Jobs for a run. attempt="last" keeps the final attempt; an int keeps that attempt."""
        p = f"{self.dir}/{run_id}.json"
        if not os.path.exists(p):
            self.missing.append(str(run_id))
            return []
        jobs = json.load(open(p))
        if attempt == "last" and jobs:
            attempt = max(j["run_attempt"] or 1 for j in jobs)
        if attempt is not None:
            jobs = [j for j in jobs if (j["run_attempt"] or 1) == attempt]
        return jobs


def wall_minutes(jobs):
    timed = [j for j in jobs if j["started_at"] and j["completed_at"] and j["conclusion"] != "skipped"]
    if not timed:
        return ""
    return round((max(ts(j["completed_at"]) for j in timed) - min(ts(j["started_at"]) for j in timed)).total_seconds() / 60, 3)


def shard_steps(run_id, jobs):
    rows = []
    for j in jobs:
        if not SHARD.match(j["name"]):
            continue
        for st in j.get("steps") or []:
            if st["name"].startswith("Run Integration Test Shard") and st["conclusion"] == "success" and st["started_at"] and st["completed_at"]:
                rows.append([run_id, variant(j["name"]), round((ts(st["completed_at"]) - ts(st["started_at"])).total_seconds() / 60, 3)])
    return rows


def is_code(path):
    return path.endswith(CODE_EXT) and not path.startswith(TEST_DIRS) and "/test/" not in path and ".test." not in path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", required=True)
    ap.add_argument("--out", default=os.path.dirname(HERE))
    a = ap.parse_args()
    raw, out = a.raw, a.out
    as_of = parse_as_of(open(f"{raw}/as-of.txt").read())
    if os.path.exists(f"{raw}/missing-jobs.txt"):
        raise SystemExit("collect.py reported missing job data; re-run it first")
    jobs = Jobs(raw)
    samples = json.load(open(f"{raw}/samples.json"))

    # Run lists, deduplicated by id.
    runs = {r["id"]: r for r in jsonl(f"{raw}/runs/harper-integration.jsonl")}
    write(out, "harper-integration-runs.csv", ["run_id", "created_at", "event", "head_branch", "status", "conclusion", "run_attempt"],
          [[r["id"], r["created_at"], r["event"], r["head_branch"], r["status"], r["conclusion"], r["run_attempt"]]
           for r in sorted(runs.values(), key=lambda r: r["created_at"])])

    # Main push runs that didn't succeed: which jobs failed on the final attempt.
    rows = []
    for i in samples["failed_main"]:
        r = runs[int(i)]
        failed = [j for j in jobs.get(i, "last") if j["conclusion"] in ("failure", "cancelled", "timed_out")]
        rows.append([i, r["created_at"], r["conclusion"], " ".join(sorted({variant(j["name"]) for j in failed})),
                     " | ".join(sorted(j["name"] for j in failed))])
    write(out, "harper-main-failed-runs.csv", ["run_id", "created_at", "conclusion", "failed_variants", "failed_jobs"], rows)

    # Last 30 days: every main push run and a 25% hash sample of first-attempt PR runs.
    wrows, srows = [], []
    for i in samples["window"]:
        r = runs[int(i)]
        first = jobs.get(i, 1)
        failed1 = {variant(j["name"]) for j in first if j["conclusion"] in ("failure", "timed_out")}
        k = "main" if r["event"] == "push" else "pr"
        wrows.append([i, r["created_at"], k, r["conclusion"], r["run_attempt"], wall_minutes(first),
                      " ".join(sorted(failed1)), any(v.startswith("linux-node") for v in failed1)])
        srows += shard_steps(i, first)
    write(out, "harper-window-runs.csv", ["run_id", "created_at", "kind", "conclusion", "run_attempt", "attempt1_wall_minutes",
                                          "attempt1_failed_variants", "attempt1_linux_node_failed"], wrows)

    # Monthly timing sample: 30 first-attempt runs per month and kind.
    trows = []
    for i, month, k in samples["monthly"]:
        first = jobs.get(i, 1)
        trows.append([i, month, k, runs[int(i)]["conclusion"], wall_minutes(first)])
        srows += shard_steps(i, first)
    write(out, "harper-timing-sample.csv", ["run_id", "month", "kind", "conclusion", "wall_minutes"], trows)
    write(out, "harper-shard-step-sample.csv", ["run_id", "variant", "test_step_minutes"], srows)

    # One green main run, from its job logs.
    green = open(f"{raw}/green-run.txt").read().strip()
    rows = []
    for line in open(f"{raw}/logs/{green}/joblist.tsv"):
        if not line.strip():
            continue
        jid, name = line.rstrip("\n").split("\t")[:2]
        log = open(f"{raw}/logs/{green}/job-{jid}.log", errors="replace").read()
        c = {}
        for key, n in re.findall(r"ℹ (tests|suites|pass|fail|skipped|todo|duration_ms) ([\d.]+)", log):
            c[key] = c.get(key, 0) + float(n)
        if "tests" not in c:
            raise SystemExit(f"no node:test summary in the log for job {jid}")
        suites_ms = sum(float(m) for m in re.findall(r"\d{2}:\d{2}:\d{2}\.\d+Z [✔✖﹣] .+ \(([\d.]+)ms\)\s*$", log, re.M))
        instances = len(re.findall(r"Logs for this instance will be stored", log))
        rows.append([green, jid, name, variant(name), int(c["tests"]), int(c.get("pass", 0)), int(c.get("fail", 0)), int(c.get("skipped", 0)),
                     int(c.get("todo", 0)), round(c.get("duration_ms", 0)), round(suites_ms), instances])
    write(out, "harper-green-run-shards.csv",
          ["run_id", "job_id", "job_name", "variant", "tests", "pass", "fail", "skipped", "todo", "runner_duration_ms", "top_level_suites_ms", "harper_instances"], rows)

    # Next.js downstream check: every run, and the 7.5% hash sample.
    nx = jsonl(f"{raw}/runs/harper-nextjs-downstream.jsonl")
    write(out, "harper-nextjs-downstream-runs.csv", ["run_id", "created_at", "event", "conclusion"],
          [[r["id"], r["created_at"], r["event"], r["conclusion"]] for r in sorted(nx, key=lambda r: r["created_at"])])
    rows = []
    for i in samples["nextjs"]:
        adapter = [j for j in jobs.get(i, "last") if "adapter integration" in j["name"]]
        concl = [j["conclusion"] for j in adapter]
        status = "no-adapter-jobs" if not adapter else "ran" if any(c in ("success", "failure") for c in concl) else "skipped"
        failed = [m.group(1) for j in adapter if j["conclusion"] == "failure" for m in [re.search(r"\(Node (\d+)\)", j["name"])] if m]
        rows.append([i, status, " ".join(failed)])
    write(out, "harper-nextjs-downstream-sample.csv", ["run_id", "suite_status", "failed_node_versions"], rows)

    if jobs.missing:
        raise SystemExit(f"{len(set(jobs.missing))} runs have no job data: {sorted(set(jobs.missing))[:10]}")

    # harper-pro integration workflow runs.
    pro = jsonl(f"{raw}/runs/harper-pro-integration.jsonl")
    write(out, "harper-pro-integration-runs.csv", ["run_id", "created_at", "event", "head_branch", "conclusion"],
          [[r["id"], r["created_at"], r["event"], r["head_branch"], r["conclusion"]] for r in sorted(pro, key=lambda r: r["created_at"])])

    # Merged PRs to harper's main branch, classified by the files they change.
    rows = []
    for name in sorted(os.listdir(f"{raw}/prs")):
        for p in json.load(open(f"{raw}/prs/{name}")):
            files = p["files"]
            it_tests = [f for f in files if f.startswith("integrationTests/") and ".test." in f and not f.startswith("integrationTests/apiTests/tests/")]
            touching = [f for f in files if f.startswith("integrationTests/") and not f.startswith("integrationTests/apiTests/tests/")]
            rows.append([p["number"], p["merged_at"], name[:7], len(files), p["files_truncated"], bool(touching), bool(it_tests),
                         any(is_code(f) for f in files), p["title"]])
    write(out, "harper-prs.csv", ["number", "merged_at", "month", "files", "files_truncated", "touches_integration_tests",
                                  "changes_integration_test_file", "changes_non_test_code", "title"], rows)

    # Adoption across HarperFast: names and counts only, never code.
    rows = [l.rstrip("\n").split("\t") for l in list(open(f"{raw}/adoption.tsv"))[1:] if l.strip()]
    write(out, "org-adoption.csv", ["repo", "visibility", "files_importing", "commit"], sorted(rows, key=lambda r: r[0].lower()))

    # Next.js plugin suite and npm.
    s = json.load(open(f"{raw}/nextjs-suite.json"))
    write(out, "nextjs-suite.csv", ["commit", "fixtures", "spec_files", "tests"], [[s["commit"], s["fixtures"], s["spec_files"], s["tests"]]])
    n = json.load(open(f"{raw}/npm.json"))
    write(out, "npm.csv", ["versions", "downloads", "downloads_start", "downloads_end"], [[n["versions"], n["downloads"], n["downloads_start"], n["downloads_end"]]])

    # Git-history CSVs from collect_git.py.
    for name in ("harper-test-growth.csv", "harper-pro-test-growth.csv", "harper-pro-node-counts.csv", "git-refs.csv"):
        shutil.copyfile(f"{raw}/{name}", f"{out}/{name}")
        print(f"{name}: copied")

    times = json.load(open(f"{raw}/collected-at.json"))
    write(out, "collection-times.csv", ["step", "collected_at"], sorted(times.items()))
    open(f"{out}/as-of.txt", "w").write(as_of.isoformat() + "\n")


if __name__ == "__main__":
    main()
