"""Turn the raw GitHub Actions data gathered on 2026-10-22 into the
compact CSVs published with the talk. Only public-repo data is written."""
import csv, json, os, re, sys
from datetime import datetime

D = sys.argv[1]   # scratchpad/data
OUT = sys.argv[2]  # repo data dir
os.makedirs(OUT, exist_ok=True)


def t(s):
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def mins(a, b):
    return round((t(b) - t(a)).total_seconds() / 60, 3)


def write(name, header, rows):
    with open(os.path.join(OUT, name), "w", newline="") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(header)
        w.writerows(rows)
    print(name, len(rows))


def load_jsonl(p):
    return [json.loads(l) for l in open(p)]


# 1. Every run of harper's integration-tests.yml (workflow 203879333).
runs = load_jsonl(f"{D}/harper-203879333.jsonl")
write(
    "harper-integration-runs.csv",
    ["run_id", "created_at", "event", "head_branch", "status", "conclusion", "run_attempt"],
    [[r["id"], r["created_at"], r["event"], r["head_branch"], r["status"], r["conclusion"], r["run_attempt"]] for r in runs],
)

# 2. Legacy API test jobs (era B: the legacy job inside integration-tests.yml),
#    for every main push/dispatch run plus a random 400 PR runs (seed 42).
ids_b = [l.strip() for l in open(f"{D}/ids-B.txt") if l.strip()]
byid = {str(r["id"]): r for r in runs}
rows = []
for i in ids_b:
    p = f"{D}/jobs/harper/{i}.json"
    if not os.path.exists(p):
        continue
    r = byid[i]
    for j in json.load(open(p)):
        if not j["name"].startswith("Integration API Tests"):
            continue
        m = re.search(r"\((.*)\)", j["name"])
        variant = m.group(1) if m else ""
        job_min = mins(j["started_at"], j["completed_at"]) if j["started_at"] and j["completed_at"] else ""
        step = next((s for s in j.get("steps") or [] if s["name"] == "Run API Tests"), None)
        step_min = mins(step["started_at"], step["completed_at"]) if step and step["started_at"] and step["completed_at"] else ""
        rows.append([i, r["created_at"], r["event"], r["head_branch"], j["run_attempt"], variant, j["conclusion"], job_min, step["conclusion"] if step else "", step_min])
write(
    "harper-legacy-api-jobs.csv",
    ["run_id", "run_created_at", "event", "head_branch", "job_attempt", "variant", "conclusion", "job_minutes", "api_step_conclusion", "api_step_minutes"],
    rows,
)

# 3. Failed jobs for every non-success main push run of integration-tests.yml.
SH = re.compile(r"Integration Tests (\d+)/(\d+) \((.*)\)")


def variant(n):
    m = SH.match(n)
    if not m:
        if n.startswith("Integration API Tests"):
            return "apiTests"
        return "other"
    v = m.group(3)
    for k in ("Windows", "Bun", "uWS"):
        if k in v:
            return k.lower()
    return "linux-node"


rows = []
for r in runs:
    if not (r["event"] == "push" and r["head_branch"] == "main" and r["conclusion"] != "success"):
        continue
    p = f"{D}/jobs/{r['id']}.json"
    if not os.path.exists(p):
        continue
    d = json.load(open(p))
    failed = sorted({variant(j["name"]) for j in d["jobs"] if j["conclusion"] in ("failure", "cancelled", "timed_out")})
    rows.append([r["id"], r["created_at"], r["conclusion"], " ".join(failed)])
write("harper-main-failed-runs.csv", ["run_id", "created_at", "conclusion", "failed_variants"], rows)

# 4. Timing sample: 30 attempt-1 runs per month per kind (seed 42).
js = json.load(open(f"{D}/jobsummary.json"))
write(
    "harper-timing-sample.csv",
    ["run_id", "month", "last30", "kind", "conclusion", "wall_minutes"],
    [[d["id"], d["month"], d["last30"], d["kind"], d["concl"], round(d["wall"], 3)] for d in js],
)
rows = []
for d in js:
    for v, xs in d["steps"].items():
        for x in xs:
            rows.append([d["id"], v, round(x, 3)])
write("harper-shard-step-sample.csv", ["run_id", "variant", "test_step_minutes"], rows)

# 5. Per-shard summary of main run 39774245654 (2026-10-22), from job logs.
rows = []
for line in open(f"{D}/logs/joblist.txt"):
    jid, rest = line.split(" ", 1)
    name = rest.rsplit(" ", 1)[0]
    p = f"{D}/logs/job-{jid}.log"
    if not os.path.exists(p):
        continue
    L = open(p, errors="replace").read()
    c = {}
    for k, n in re.findall(r"ℹ (tests|suites|pass|fail|skipped|todo|duration_ms) ([\d.]+)", L):
        c[k] = c.get(k, 0) + float(n)
    suites_ms = sum(float(m) for m in re.findall(r"\d{2}:\d{2}:\d{2}\.\d+Z [✔✖﹣] .+ \(([\d.]+)ms\)\s*$", L, re.M))
    inst = len(re.findall(r"Logs for this instance will be stored", L))
    rows.append([jid, name, int(c.get("tests", 0)), int(c.get("pass", 0)), int(c.get("fail", 0)), int(c.get("skipped", 0)), int(c.get("todo", 0)), round(c.get("duration_ms", 0)), round(suites_ms), inst])
write(
    "harper-run-39774245654-shards.csv",
    ["job_id", "job_name", "tests", "pass", "fail", "skipped", "todo", "runner_duration_ms", "top_level_suites_ms", "harper_instances"],
    rows,
)

# 6. Next.js downstream check: every run, and the 250-run job sample.
nx = load_jsonl(f"{D}/harper-313396365.jsonl")
write("harper-nextjs-downstream-runs.csv", ["run_id", "created_at", "event", "conclusion"], [[r["id"], r["created_at"], r["event"], r["conclusion"]] for r in nx])
rows = []
raw = open(f"{D}/nx-jobs.jsonl").read()
dec = json.JSONDecoder()
docs, pos = [], 0
while pos < len(raw):
    while pos < len(raw) and raw[pos].isspace():
        pos += 1
    if pos >= len(raw):
        break
    obj, pos = dec.raw_decode(raw, pos)
    docs.append(obj)
byrun = {}
for d in docs:
    for j in d.get("jobs", []):
        byrun.setdefault(str(j["run_id"]), []).append(j)
for i in [l.strip() for l in open(f"{D}/nx-sample.txt") if l.strip()]:
    jobs = [j for j in byrun.get(i, []) if "adapter integration" in j["name"]]
    concl = [j["conclusion"] for j in jobs]
    if not jobs:
        status = "no-adapter-jobs"
    elif any(c in ("success", "failure") for c in concl):
        status = "ran"
    else:
        status = "skipped"
    failed = [re.search(r"\(Node (\d+)\)", j["name"]).group(1) for j in jobs if j["conclusion"] == "failure"]
    rows.append([i, status, " ".join(failed)])
write("harper-nextjs-downstream-sample.csv", ["run_id", "suite_status", "failed_node_versions"], rows)

# 7. Org adoption (test files importing the package), excluding a private fork.
rows = []
for l in list(open(f"{D}/adoption.tsv"))[1:]:
    parts = l.rstrip("\n").split("\t")
    if parts[0].startswith("harper-ghsa"):
        continue
    rows.append([parts[0], parts[2]])
write("org-adoption.csv", ["repo", "test_files_importing"], rows)

# 8. harper-pro integration workflow runs (public repo).
pro = load_jsonl(f"{D}/harperpro-238747852.jsonl")
write("harper-pro-integration-runs.csv", ["run_id", "created_at", "event", "head_branch", "conclusion"], [[r["id"], r["created_at"], r["event"], r["head_branch"], r["conclusion"]] for r in pro])
