"""Fetch jobs and steps for a list of GitHub Actions run IDs.

Usage: collect-jobs.py <repo> <run-ids-file> <out-dir>
Writes <out-dir>/<run_id>.json with a slim copy of each job and its steps.
Requires an authenticated gh CLI.
"""
import json, subprocess, sys, os
from concurrent.futures import ThreadPoolExecutor
repo, idsfile, outdir = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(outdir, exist_ok=True)
ids = [l.strip() for l in open(idsfile) if l.strip()]
def f(i):
    p = os.path.join(outdir, f"{i}.json")
    if os.path.exists(p) and os.path.getsize(p) > 2: return
    r = subprocess.run(["gh","api","--paginate",f"repos/HarperFast/{repo}/actions/runs/{i}/jobs?filter=all&per_page=100","--jq",".jobs[]"],capture_output=True,text=True)
    if r.returncode != 0:
        print(i, r.stderr[:200], file=sys.stderr); return
    jobs = [json.loads(l) for l in r.stdout.splitlines() if l.strip()]
    slim = [{k:j.get(k) for k in ("id","run_id","run_attempt","name","status","conclusion","started_at","completed_at","runner_name")} | {"steps":[{k:s.get(k) for k in ("name","conclusion","started_at","completed_at","number")} for s in (j.get("steps") or [])]} for j in jobs]
    json.dump(slim, open(p,"w"))
with ThreadPoolExecutor(8) as ex: list(ex.map(f, ids))
print("done", len(ids))
