#!/usr/bin/env python3
"""Collect the raw GitHub data behind the "Did it work?" section.

Usage:
  python3 collect.py --as-of 2026-11-30 --raw /tmp/impact-raw \
      --harper ~/src/harper --harper-pro ~/src/harper-pro [--data DIR]
      [--green-run ID] [--reuse-samples]

Needs an authenticated `gh` CLI and full (not blobless) clones of
HarperFast/harper and HarperFast/harper-pro. Only the Python standard
library is used. See RUNBOOK.md for the whole procedure.

What it does, in order:
  1. Run lists for harper's integration-tests.yml, harper's Next.js
     downstream check, and harper-pro's integration workflow.
  2. Samples, seeded so the same inputs give the same sample:
       - timing sample: up to 30 first-attempt main-push runs and 30 PR runs
         per month. Months already in the published sample are kept, unless
         the month was still in progress when they were drawn.
       - Next.js downstream sample: 250 runs.
  3. Jobs and steps for every sampled run and every non-successful main
     push run.
  4. Job logs for one green main run (the latest before --as-of, or
     --green-run).
  5. Adoption: HarperFast repositories that import the package in test files.
  6. Git history metrics, by running collect_git.py.

The legacy suite data (Dec 2025 to Jun 2026) is frozen in
harper-legacy-api-jobs.csv: GitHub no longer keeps the step timings, so it
is never re-collected.
"""
import argparse
import csv
import json
import os
import random
import re
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
WORKFLOWS = {
    "harper-integration": ("harper", 203879333),
    "harper-nextjs-downstream": ("harper", 313396365),
    "harper-pro-integration": ("harper-pro", 238747852),
}
NEXTJS_SAMPLE_SIZE = 250
TIMING_PER_MONTH = 30
EXCLUDED_ADOPTERS = ("harper", "integration-testing")
EXCLUDED_ADOPTER_PREFIX = "harper-ghsa-"  # private security advisory forks


def gh(*args, check=True, attempts=5):
    """Run gh, retrying GitHub's transient 5xx errors with backoff."""
    for n in range(attempts):
        r = subprocess.run(["gh", *args], capture_output=True, text=True)
        if r.returncode == 0 or not re.search(r"HTTP 5\d\d|timed out|connection reset", r.stderr, re.I):
            break
        time.sleep(2 ** n)
    if check and r.returncode != 0:
        raise RuntimeError(f"gh {' '.join(args)} failed: {r.stderr.strip()[:300]}")
    return r


def ts(s):
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def month_complete(month, as_of):
    y, m = map(int, month.split("-"))
    nxt = date(y + (m == 12), m % 12 + 1, 1)
    return nxt - timedelta(days=1) <= as_of


FIRST_RUN_DAY = date(2025, 10, 1)  # before the first run of any of these workflows


def fetch_runs(raw, as_of_end):
    """Page through each workflow's runs one week at a time.

    One unfiltered --paginate over ~10,000 runs fails with GitHub 502s, and a
    created-filtered query returns at most 1,000 runs, so weekly windows keep
    every request small. Each page is retried on its own.
    """
    os.makedirs(f"{raw}/runs", exist_ok=True)
    fields = ("id", "created_at", "event", "head_branch", "status", "conclusion", "run_attempt")
    for name, (repo, wf) in WORKFLOWS.items():
        runs = {}
        start = FIRST_RUN_DAY
        while start <= as_of_end.date():
            end = min(start + timedelta(days=6), as_of_end.date())
            page = 1
            while True:
                r = gh("api", f"repos/HarperFast/{repo}/actions/workflows/{wf}/runs?per_page=100&page={page}&created={start}..{end}",
                       "--jq", ".workflow_runs[] | {" + ",".join(fields) + "}")
                batch = [json.loads(l) for l in r.stdout.splitlines() if l.strip()]
                for x in batch:
                    runs[x["id"]] = x
                if len(batch) < 100:
                    break
                page += 1
            start = end + timedelta(days=1)
        runs = sorted((x for x in runs.values() if ts(x["created_at"]) <= as_of_end), key=lambda x: x["created_at"], reverse=True)
        with open(f"{raw}/runs/{name}.jsonl", "w") as f:
            for x in runs:
                f.write(json.dumps(x) + "\n")
        print(f"runs {name}: {len(runs)}")


def load_runs(raw, name):
    return [json.loads(l) for l in open(f"{raw}/runs/{name}.jsonl")]


def read_csv(path):
    if not os.path.exists(path):
        return []
    with open(path, newline="") as f:
        return list(csv.DictReader(f))


def timing_sample(raw, data, as_of, reuse):
    """30 first-attempt runs per month and kind, seeded per stratum."""
    runs = load_runs(raw, "harper-integration")
    prior = read_csv(f"{data}/harper-timing-sample.csv")
    keep = {}
    for p in prior:
        if reuse or month_complete(p["month"], date.fromisoformat(p.get("drawn_as_of") or "2026-10-22")):
            keep.setdefault((p["month"], p["kind"]), []).append(p["run_id"])
    strata = {}
    for r in runs:
        if r["run_attempt"] != 1 or r["conclusion"] not in ("success", "failure"):
            continue
        if r["event"] == "push" and r["head_branch"] == "main":
            kind = "main"
        elif r["event"] == "pull_request":
            kind = "pr"
        else:
            continue
        strata.setdefault((r["created_at"][:7], kind), []).append(str(r["id"]))
    chosen = {}
    for key, ids in sorted(strata.items()):
        if key in keep:
            chosen[key] = keep[key]
            continue
        ids = sorted(ids)
        rng = random.Random(f"42:{key[0]}:{key[1]}")
        chosen[key] = ids if len(ids) <= TIMING_PER_MONTH else sorted(rng.sample(ids, TIMING_PER_MONTH))
    with open(f"{raw}/timing-sample.csv", "w", newline="") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(["run_id", "month", "kind", "drawn_as_of"])
        for (month, kind), ids in sorted(chosen.items()):
            for i in ids:
                w.writerow([i, month, kind, as_of.isoformat()])
    n = sum(len(v) for v in chosen.values())
    print(f"timing sample: {n} runs in {len(chosen)} strata")
    return [i for v in chosen.values() for i in v]


def nextjs_sample(raw, data, reuse):
    if reuse:
        prior = read_csv(f"{data}/harper-nextjs-downstream-sample.csv")
        ids = [p["run_id"] for p in prior]
    else:
        ids = sorted(str(r["id"]) for r in load_runs(raw, "harper-nextjs-downstream"))
        ids = sorted(random.Random("42:nextjs").sample(ids, min(NEXTJS_SAMPLE_SIZE, len(ids))))
    with open(f"{raw}/nextjs-sample.txt", "w") as f:
        f.write("\n".join(ids) + "\n")
    print(f"nextjs sample: {len(ids)} runs")
    return ids


def fetch_jobs(raw, repo, ids):
    out = f"{raw}/jobs/{repo}"
    os.makedirs(out, exist_ok=True)

    def one(i):
        p = f"{out}/{i}.json"
        if os.path.exists(p) and os.path.getsize(p) > 2:
            return
        r = gh("api", "--paginate", f"repos/HarperFast/{repo}/actions/runs/{i}/jobs?filter=all&per_page=100",
               "--jq", ".jobs[]", check=False)
        if r.returncode != 0:
            print(f"  jobs {i}: {r.stderr.strip()[:120]}", file=sys.stderr)
            return
        jobs = [json.loads(l) for l in r.stdout.splitlines() if l.strip()]
        slim = [{k: j.get(k) for k in ("id", "run_id", "run_attempt", "name", "status", "conclusion", "started_at", "completed_at")}
                | {"steps": [{k: s.get(k) for k in ("name", "conclusion", "started_at", "completed_at", "number")} for s in (j.get("steps") or [])]}
                for j in jobs]
        with open(p, "w") as f:
            json.dump(slim, f)

    with ThreadPoolExecutor(8) as ex:
        list(ex.map(one, sorted(set(ids))))
    print(f"jobs {repo}: {len(set(ids))} runs")


def fetch_green_run_logs(raw, as_of_end, green_run):
    if not green_run:
        runs = load_runs(raw, "harper-integration")
        green = [r for r in runs if r["event"] == "push" and r["head_branch"] == "main" and r["conclusion"] == "success"]
        green_run = str(max(green, key=lambda r: r["created_at"])["id"])
    out = f"{raw}/logs/{green_run}"
    os.makedirs(out, exist_ok=True)
    r = gh("api", f"repos/HarperFast/harper/actions/runs/{green_run}/jobs?per_page=100",
           "--jq", '.jobs[] | select(.name|test("^Integration Tests [0-9]+/[0-9]+")) | [.id, .name, .conclusion] | @tsv')
    lines = [l for l in r.stdout.splitlines() if l.strip()]
    with open(f"{out}/joblist.tsv", "w") as f:
        f.write("\n".join(lines) + "\n")

    def one(line):
        jid = line.split("\t")[0]
        p = f"{out}/job-{jid}.log"
        if not os.path.exists(p):
            with open(p, "w") as f:
                f.write(gh("run", "view", "--job", jid, "--log", "--repo", "HarperFast/harper").stdout)

    with ThreadPoolExecutor(6) as ex:
        list(ex.map(one, lines))
    with open(f"{raw}/green-run.txt", "w") as f:
        f.write(green_run + "\n")
    print(f"green run {green_run}: {len(lines)} shard logs")


IMPORT_RE = r"(from|require\(|import\()[[:space:]]*['\"]@harperfast/integration-testing"


def adoption(raw):
    """Repositories whose code imports the package.

    Code search runs with your token, so it also finds private repositories.
    Only public repositories are named; the rest are counted. A file counts
    when it imports or requires the package, not when it only mentions it.
    """
    r = gh("search", "code", '"@harperfast/integration-testing"', "--owner", "HarperFast", "--limit", "1000",
           "--json", "repository", "-q", ".[].repository.nameWithOwner")
    repos = sorted({x.split("/", 1)[1] for x in r.stdout.split() if x.startswith("HarperFast/")})
    repos = [x for x in repos if x not in EXCLUDED_ADOPTERS and not x.startswith(EXCLUDED_ADOPTER_PREFIX)]
    clones = f"{raw}/adoption-clones"
    os.makedirs(clones, exist_ok=True)
    rows = []
    for repo in repos:
        visibility = gh("api", f"repos/HarperFast/{repo}", "-q", ".visibility").stdout.strip()
        d = f"{clones}/{repo}"
        if os.path.exists(d):
            subprocess.run(["git", "-C", d, "fetch", "-q", "--depth", "1", "origin", "HEAD"], check=True)
            subprocess.run(["git", "-C", d, "reset", "-q", "--hard", "FETCH_HEAD"], check=True)
        else:
            subprocess.run(["git", "clone", "-q", "--depth", "1", f"https://github.com/HarperFast/{repo}.git", d], check=True)
        g = subprocess.run(["git", "-C", d, "grep", "-lE", IMPORT_RE, "HEAD", "--", ":!*.md", ":!*package.json", ":!*package-lock.json"],
                           capture_output=True, text=True)
        n = len([l for l in g.stdout.splitlines() if l.strip()])
        if n:
            rows.append((repo, visibility, n))
    with open(f"{raw}/adoption.tsv", "w") as f:
        f.write("repo\tvisibility\tfiles_importing\n")
        for repo, visibility, n in rows:
            f.write(f"{repo}\t{visibility}\t{n}\n")
    print(f"adoption: {sum(v == 'public' for _, v, _ in rows)} public, {sum(v != 'public' for _, v, _ in rows)} not public")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--as-of", required=True, help="last day of data, YYYY-MM-DD")
    ap.add_argument("--raw", required=True, help="scratch directory for raw responses")
    ap.add_argument("--harper", required=True, help="full clone of HarperFast/harper")
    ap.add_argument("--harper-pro", required=True, help="full clone of HarperFast/harper-pro")
    ap.add_argument("--data", default=os.path.dirname(HERE), help="published data directory")
    ap.add_argument("--green-run", help="use this run for per-run test counts")
    ap.add_argument("--reuse-samples", action="store_true", help="keep every published sample as is (to reproduce a snapshot)")
    a = ap.parse_args()
    as_of = date.fromisoformat(a.as_of)
    as_of_end = datetime(as_of.year, as_of.month, as_of.day, 23, 59, 59, tzinfo=timezone.utc)
    os.makedirs(a.raw, exist_ok=True)
    with open(f"{a.raw}/as-of.txt", "w") as f:
        f.write(a.as_of + "\n")

    fetch_runs(a.raw, as_of_end)
    timing_ids = timing_sample(a.raw, a.data, as_of, a.reuse_samples)
    failed_main = [str(r["id"]) for r in load_runs(a.raw, "harper-integration")
                   if r["event"] == "push" and r["head_branch"] == "main" and r["status"] == "completed" and r["conclusion"] != "success"]
    fetch_jobs(a.raw, "harper", timing_ids + failed_main)
    fetch_jobs(a.raw, "harper", nextjs_sample(a.raw, a.data, a.reuse_samples))
    fetch_green_run_logs(a.raw, as_of_end, a.green_run)
    adoption(a.raw)
    subprocess.run([sys.executable, f"{HERE}/collect_git.py", "--as-of", a.as_of, "--harper", a.harper,
                    "--harper-pro", a.harper_pro, "--out", a.raw], check=True)
    print(f"raw data in {a.raw}; next: extract.py --raw {a.raw}")


if __name__ == "__main__":
    main()
