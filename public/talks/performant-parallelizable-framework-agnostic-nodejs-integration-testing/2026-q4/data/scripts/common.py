"""Shared helpers for the impact data scripts. Standard library only.

Every script uses these, so dates, months, and sampling mean the same thing
everywhere:

- The as-of date is inclusive and in UTC: data runs through 23:59:59 UTC.
- A month is complete when its last day is on or before the as-of date.
  Monthly series include complete months only.
- Hash sampling keeps a run when sha256(seed:id) falls under a threshold, so
  a run's membership never changes as the population grows.
"""
import hashlib
import re
import subprocess
import time
from datetime import date, datetime, timedelta, timezone


def parse_as_of(s):
    return date.fromisoformat(s.strip())


def end_of_day(d):
    return datetime(d.year, d.month, d.day, 23, 59, 59, tzinfo=timezone.utc)


def ts(s):
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def next_month(d):
    return date(d.year + (d.month == 12), d.month % 12 + 1, 1)


def month_complete(month, as_of):
    """month is 'YYYY-MM'; complete when its last day is on or before as_of."""
    y, m = map(int, month.split("-"))
    return next_month(date(y, m, 1)) - timedelta(days=1) <= as_of


def complete_months(first, as_of):
    """'YYYY-MM' strings from `first` (a date) through the last complete month."""
    d, out = date(first.year, first.month, 1), []
    while month_complete(d.strftime("%Y-%m"), as_of):
        out.append(d.strftime("%Y-%m"))
        d = next_month(d)
    return out


def in_last_30(created_at, as_of):
    """True when a timestamp falls in the 30 days ending at the end of as_of."""
    end = end_of_day(as_of)
    return end - timedelta(days=30) < ts(created_at) <= end


def hash_sample(run_id, seed, fraction):
    h = int(hashlib.sha256(f"{seed}:{run_id}".encode()).hexdigest()[:12], 16)
    return h < fraction * 16**12


def gh(*args, check=True, attempts=6):
    """Run gh, retrying transient 5xx errors and rate limits with backoff."""
    r = None
    for n in range(attempts):
        r = subprocess.run(["gh", *args], capture_output=True, text=True)
        if r.returncode == 0:
            return r
        err = r.stderr
        if re.search(r"rate limit|HTTP 429|secondary", err, re.I):
            time.sleep(min(60 * (n + 1), 300))
        elif re.search(r"HTTP 5\d\d|timed out|timeout|connection reset|EOF", err, re.I):
            time.sleep(2**n)
        else:
            break
    if check:
        raise RuntimeError(f"gh {' '.join(args)} failed: {r.stderr.strip()[:300]}")
    return r
