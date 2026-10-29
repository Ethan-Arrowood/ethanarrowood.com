#!/usr/bin/env python3
"""Collect the raw GitHub and npm data behind the "Did it work?" section.

Usage:
  python3 collect.py --as-of 2026-11-30 --raw /tmp/impact-raw \
      --harper ~/src/harper --harper-pro ~/src/harper-pro [--green-run ID]

Re-running with the same --raw resumes: run lists, job data, and logs that
were already fetched are kept.

Needs an authenticated `gh` CLI, network access to registry.npmjs.org, and
full (not blobless) clones of HarperFast/harper and HarperFast/harper-pro.
Standard library only. Use a fresh --raw directory for each collection. See
RUNBOOK.md for the whole procedure and common.py for the shared rules
(UTC dates, complete months, hash sampling).

Steps:
  1. Run lists for harper's integration-tests.yml, harper's Next.js
     downstream check, and harper-pro's integration workflow.
  2. Jobs and steps for:
       - every main push run in the last 30 days;
       - a 25% hash sample of first-attempt PR runs in the last 30 days;
       - 30 first-attempt main push runs and 30 PR runs per complete month,
         chosen by hash order;
       - every main push run that didn't succeed;
       - a 7.5% hash sample of the Next.js downstream check's runs.
  3. Job logs for one green main run: the latest before the as-of date, or
     --green-run.
  4. Merged PRs to harper's main branch, with changed file paths, for every
     complete month.
  5. Adoption: HarperFast repositories whose code imports the package.
  6. The Next.js plugin's suite size, and npm versions and downloads.
  7. Git history metrics, via collect_git.py.

If any job data can't be fetched, it writes missing-jobs.txt and exits with
an error rather than publishing partial data.
"""
import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import complete_months, end_of_day, gh, hash_sample, in_last_30, next_month, parse_as_of, ts  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
WORKFLOWS = {
    "harper-integration": ("harper", 203879333),
    "harper-nextjs-downstream": ("harper", 313396365),
    "harper-pro-integration": ("harper-pro", 238747852),
}
FIRST_RUN_DAY = date(2025, 10, 1)  # before the first run of any of these workflows
FIRST_MONTH = date(2025, 11, 1)
TIMING_PER_MONTH = 30
WINDOW_PR_FRACTION = 0.25
NEXTJS_FRACTION = 0.075
PACKAGE = "@harperfast/integration-testing"
EXCLUDED_ADOPTERS = ("harper", "integration-testing")
EXCLUDED_ADOPTER_PREFIX = "harper-ghsa-"  # security advisory forks
IMPORT_RE = r"(from|require\(|import\()[[:space:]]*['\"]@harperfast/integration-testing"
RUN_FIELDS = ("id", "created_at", "event", "head_branch", "status", "conclusion", "run_attempt")


def stamp(raw, key):
    p = f"{raw}/collected-at.json"
    data = json.load(open(p)) if os.path.exists(p) else {}
    data[key] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    json.dump(data, open(p, "w"), indent=1)


def runs_page(repo, wf, start, end, page):
    q = f"repos/HarperFast/{repo}/actions/workflows/{wf}/runs?per_page=100&page={page}&created={start}..{end}"
    r = gh("api", q, "--jq", "{total: .total_count, runs: [.workflow_runs[] | {" + ",".join(RUN_FIELDS) + "}]}")
    return json.loads(r.stdout)


def runs_window(repo, wf, start, end):
    """All runs created from start to end (dates, inclusive, UTC)."""
    first = runs_page(repo, wf, start, end, 1)
    if first["total"] >= 1000:  # GitHub caps a created-filtered query at 1,000 runs
        if start == end:
            raise SystemExit(f"{repo} {wf}: over 1,000 runs on {start}; can't page it")
        mid = start + (end - start) // 2
        return runs_window(repo, wf, start, mid) + runs_window(repo, wf, mid + timedelta(days=1), end)
    runs, page = list(first["runs"]), 1
    while len(runs) < first["total"]:
        page += 1
        batch = runs_page(repo, wf, start, end, page)["runs"]
        if not batch:
            break
        runs += batch
    if len({r["id"] for r in runs}) != first["total"]:
        raise SystemExit(f"{repo} {wf} {start}..{end}: got {len(runs)} runs, GitHub reports {first['total']}")
    return runs


def fetch_runs(raw, as_of):
    os.makedirs(f"{raw}/runs", exist_ok=True)
    for name, (repo, wf) in WORKFLOWS.items():
        if os.path.exists(f"{raw}/runs/{name}.jsonl"):  # resume a partial collection
            print(f"runs {name}: already collected")
            continue
        runs, start = {}, FIRST_RUN_DAY
        while start <= as_of:
            end = min(start + timedelta(days=6), as_of)
            for r in runs_window(repo, wf, start, end):
                runs[r["id"]] = r
            start = end + timedelta(days=1)
        rows = sorted(runs.values(), key=lambda r: r["created_at"], reverse=True)
        with open(f"{raw}/runs/{name}.jsonl", "w") as f:
            for r in rows:
                f.write(json.dumps(r) + "\n")
        print(f"runs {name}: {len(rows)}")
    stamp(raw, "run_lists")


def load_runs(raw, name):
    return [json.loads(l) for l in open(f"{raw}/runs/{name}.jsonl")]


def kind(r):
    if r["event"] == "push" and r["head_branch"] == "main":
        return "main"
    if r["event"] == "pull_request":
        return "pr"
    return None


def choose_samples(raw, as_of):
    runs = load_runs(raw, "harper-integration")
    first_attempt = [r for r in runs if r["run_attempt"] == 1 and r["conclusion"] in ("success", "failure")]
    window = [str(r["id"]) for r in runs if kind(r) == "main" and r["status"] == "completed" and in_last_30(r["created_at"], as_of)]
    window += [str(r["id"]) for r in first_attempt if kind(r) == "pr" and in_last_30(r["created_at"], as_of)
               and hash_sample(r["id"], "window-pr", WINDOW_PR_FRACTION)]
    strata = {}
    months = set(complete_months(FIRST_MONTH, as_of))
    for r in first_attempt:
        if kind(r) and r["created_at"][:7] in months:
            strata.setdefault((r["created_at"][:7], kind(r)), []).append(str(r["id"]))
    monthly = []
    for (month, k), ids in sorted(strata.items()):
        ids.sort(key=lambda i: hash_sample_key(i, f"timing:{month}:{k}"))
        monthly += [(i, month, k) for i in ids[:TIMING_PER_MONTH]]
    failed_main = [str(r["id"]) for r in runs if kind(r) == "main" and r["status"] == "completed" and r["conclusion"] != "success"]
    nextjs = [str(r["id"]) for r in load_runs(raw, "harper-nextjs-downstream") if hash_sample(r["id"], "nextjs", NEXTJS_FRACTION)]
    json.dump({"window": window, "monthly": monthly, "failed_main": failed_main, "nextjs": nextjs},
              open(f"{raw}/samples.json", "w"), indent=1)
    print(f"samples: window {len(window)}, monthly {len(monthly)}, failed main {len(failed_main)}, nextjs {len(nextjs)}")
    return set(window) | {i for i, _, _ in monthly} | set(failed_main) | set(nextjs)


def hash_sample_key(run_id, seed):
    """Sort key for choosing the first N runs of a stratum by hash order."""
    return hashlib.sha256(f"{seed}:{run_id}".encode()).hexdigest()


def fetch_jobs(raw, ids):
    out = f"{raw}/jobs/harper"
    os.makedirs(out, exist_ok=True)

    def one(i):
        p = f"{out}/{i}.json"
        if os.path.exists(p):
            return None
        r = gh("api", "--paginate", f"repos/HarperFast/harper/actions/runs/{i}/jobs?filter=all&per_page=100", "--jq", ".jobs[]", check=False)
        if r.returncode != 0:
            return i
        jobs = [json.loads(l) for l in r.stdout.splitlines() if l.strip()]
        slim = [{k: j.get(k) for k in ("id", "run_id", "run_attempt", "name", "status", "conclusion", "started_at", "completed_at")}
                | {"steps": [{k: s.get(k) for k in ("name", "conclusion", "started_at", "completed_at", "number")} for s in (j.get("steps") or [])]}
                for j in jobs]
        json.dump(slim, open(p, "w"))
        return None

    with ThreadPoolExecutor(6) as ex:
        missing = [m for m in ex.map(one, sorted(ids)) if m]
    print(f"jobs: {len(ids)} runs, {len(missing)} missing")
    stamp(raw, "jobs")
    return missing


def fetch_green_run_logs(raw, as_of, green_run):
    if not green_run:
        runs = load_runs(raw, "harper-integration")
        green = [r for r in runs if kind(r) == "main" and r["conclusion"] == "success"]
        green_run = str(max(green, key=lambda r: r["created_at"])["id"])
    out = f"{raw}/logs/{green_run}"
    os.makedirs(out, exist_ok=True)
    r = gh("api", f"repos/HarperFast/harper/actions/runs/{green_run}/jobs?per_page=100",
           "--jq", '.jobs[] | select(.name|test("^Integration Tests [0-9]+/[0-9]+")) | [.id, .name, .conclusion] | @tsv')
    lines = [l for l in r.stdout.splitlines() if l.strip()]
    open(f"{out}/joblist.tsv", "w").write("\n".join(lines) + "\n")

    def one(line):
        jid = line.split("\t")[0]
        p = f"{out}/job-{jid}.log"
        if not os.path.exists(p):
            # gh run view --log shares a zip cache that parallel calls corrupt; the API is safe.
            log = gh("api", "--allow-escape-sequences", f"repos/HarperFast/harper/actions/jobs/{jid}/logs").stdout
            open(p, "w").write(re.sub(r"\x1b\[[0-9;]*m", "", log))

    with ThreadPoolExecutor(6) as ex:
        list(ex.map(one, lines))
    open(f"{raw}/green-run.txt", "w").write(green_run + "\n")
    print(f"green run {green_run}: {len(lines)} shard logs")
    stamp(raw, "green_run_logs")


def fetch_prs(raw, as_of):
    """Merged PRs to main per complete month, with changed file paths.

    gh returns at most 100 files per PR; `files_truncated` marks those.
    """
    os.makedirs(f"{raw}/prs", exist_ok=True)

    def search(start, end):
        q = f"merged:{start}T00:00:00Z..{end}T23:59:59Z"
        r = gh("pr", "list", "--repo", "HarperFast/harper", "--state", "merged", "--base", "main", "--search", q,
               "--limit", "1000", "--json", "number,title,mergedAt,files")
        prs = json.loads(r.stdout)
        if len(prs) >= 1000:
            mid = start + (end - start) // 2
            return search(start, mid) + search(mid + timedelta(days=1), end)
        return prs

    for month in complete_months(FIRST_MONTH, as_of):
        start = date.fromisoformat(month + "-01")
        prs = search(start, next_month(start) - timedelta(days=1))
        rows = [{"number": p["number"], "title": p["title"], "merged_at": p["mergedAt"],
                 "files": [f["path"] for f in p["files"]], "files_truncated": len(p["files"]) >= 100} for p in prs]
        json.dump(rows, open(f"{raw}/prs/{month}.json", "w"))
        print(f"prs {month}: {len(rows)}")
    stamp(raw, "prs")


def adoption(raw):
    """Repositories whose code imports the package. Names and counts only."""
    r = gh("search", "code", f'"{PACKAGE}"', "--owner", "HarperFast", "--limit", "1000",
           "--json", "repository", "-q", ".[].repository.nameWithOwner")
    repos = sorted({x.split("/", 1)[1] for x in r.stdout.split() if x.startswith("HarperFast/")})
    repos = [x for x in repos if x not in EXCLUDED_ADOPTERS and not x.startswith(EXCLUDED_ADOPTER_PREFIX)]
    clones = f"{raw}/adoption-clones"
    os.makedirs(clones, exist_ok=True)
    rows = []
    for repo in repos:
        visibility = gh("api", f"repos/HarperFast/{repo}", "-q", ".visibility").stdout.strip()
        d = f"{clones}/{repo}"
        if not os.path.exists(d):
            subprocess.run(["git", "clone", "-q", "--depth", "1", f"https://github.com/HarperFast/{repo}.git", d], check=True)
        sha = subprocess.run(["git", "-C", d, "rev-parse", "HEAD"], capture_output=True, text=True, check=True).stdout.strip()
        g = subprocess.run(["git", "-C", d, "grep", "-lE", IMPORT_RE, "HEAD", "--", ":!*.md", ":!*package.json", ":!*package-lock.json"],
                           capture_output=True, text=True)
        n = len([l for l in g.stdout.splitlines() if l.strip()])
        if n:
            rows.append((repo, visibility, n, sha))
    with open(f"{raw}/adoption.tsv", "w") as f:
        f.write("repo\tvisibility\tfiles_importing\tcommit\n")
        for row in rows:
            f.write("\t".join(map(str, row)) + "\n")
    print(f"adoption: {len(rows)} repos")
    stamp(raw, "adoption")


def nextjs_suite(raw):
    """Fixtures, Playwright spec files, and tests in the Next.js plugin."""
    d = f"{raw}/nextjs"
    if not os.path.exists(d):
        subprocess.run(["git", "clone", "-q", "--depth", "1", "https://github.com/HarperFast/nextjs.git", d], check=True)
    sha = subprocess.run(["git", "-C", d, "rev-parse", "HEAD"], capture_output=True, text=True, check=True).stdout.strip()
    fixtures = sorted(x for x in os.listdir(f"{d}/fixtures") if os.path.isdir(f"{d}/fixtures/{x}") and not x.startswith("_"))
    specs = sorted(x for x in os.listdir(f"{d}/integrationTests") if x.endswith(".pw.ts"))
    tests = sum(len(re.findall(r"^\s*test(\.\w+)?\(", open(f"{d}/integrationTests/{s}").read(), re.M)) for s in specs)
    json.dump({"commit": sha, "fixtures": len(fixtures), "spec_files": len(specs), "tests": tests},
              open(f"{raw}/nextjs-suite.json", "w"), indent=1)
    print(f"nextjs suite: {len(fixtures)} fixtures, {len(specs)} specs, {tests} tests")
    stamp(raw, "nextjs_suite")


def npm(raw, as_of):
    meta = json.load(urllib.request.urlopen("https://registry.npmjs.org/" + PACKAGE.replace("/", "%2f")))
    end = end_of_day(as_of)
    versions = [v for v, t in meta["time"].items() if v not in ("created", "modified") and ts(t) <= end]
    start = as_of - timedelta(days=29)
    dl = json.load(urllib.request.urlopen(f"https://api.npmjs.org/downloads/point/{start}:{as_of}/{PACKAGE}"))
    json.dump({"versions": len(versions), "downloads": dl["downloads"], "downloads_start": dl["start"], "downloads_end": dl["end"]},
              open(f"{raw}/npm.json", "w"), indent=1)
    print(f"npm: {len(versions)} versions, {dl['downloads']} downloads {dl['start']}..{dl['end']}")
    stamp(raw, "npm")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--as-of", required=True, help="last day of data, YYYY-MM-DD, inclusive, UTC")
    ap.add_argument("--raw", required=True, help="fresh scratch directory for raw responses")
    ap.add_argument("--harper", required=True, help="full clone of HarperFast/harper")
    ap.add_argument("--harper-pro", required=True, help="full clone of HarperFast/harper-pro")
    ap.add_argument("--green-run", help="use this run for per-run test counts")
    a = ap.parse_args()
    as_of = parse_as_of(a.as_of)
    if end_of_day(as_of) > datetime.now(timezone.utc):
        raise SystemExit("--as-of must be a day that has already ended in UTC")
    os.makedirs(a.raw, exist_ok=True)
    open(f"{a.raw}/as-of.txt", "w").write(a.as_of + "\n")

    fetch_runs(a.raw, as_of)
    missing = fetch_jobs(a.raw, choose_samples(a.raw, as_of))
    if missing:
        missing = fetch_jobs(a.raw, set(missing))  # one more pass for transient failures
    fetch_green_run_logs(a.raw, as_of, a.green_run)
    fetch_prs(a.raw, as_of)
    adoption(a.raw)
    nextjs_suite(a.raw)
    npm(a.raw, as_of)
    subprocess.run([sys.executable, f"{HERE}/collect_git.py", "--as-of", a.as_of, "--harper", a.harper,
                    "--harper-pro", a.harper_pro, "--out", a.raw], check=True)
    stamp(a.raw, "git")
    if missing:
        open(f"{a.raw}/missing-jobs.txt", "w").write("\n".join(missing) + "\n")
        raise SystemExit(f"{len(missing)} runs have no job data (see missing-jobs.txt); fix or re-run before extracting")
    print(f"raw data in {a.raw}; next: extract.py --raw {a.raw}")


if __name__ == "__main__":
    main()
