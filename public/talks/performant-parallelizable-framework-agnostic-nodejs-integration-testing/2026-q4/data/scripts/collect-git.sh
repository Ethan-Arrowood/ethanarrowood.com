#!/usr/bin/env bash
# Git-history metrics for the "Did it work?" section of the 2026 Q4 deck.
#
# Usage: collect-git.sh <harper-clone> <harper-pro-clone> <out-dir>
#
# Both clones need full history (not --filter=blob:none). Results are as of
# the clones' origin/main; the published CSVs used origin/main on 2026-10-22.
set -euo pipefail

HARPER=$1
PRO=$2
OUT=$3
mkdir -p "$OUT"

# A test case is a line starting with it( or test(, optionally .only/.skip/.todo.
CASE='^[[:space:]]*(it|test)(\.only|\.skip|\.todo)?\('

# Last first-parent commit on main before the end of a day.
at() { git -C "$1" rev-list -1 --first-parent --before="$2 23:59" origin/main; }

# --- Test growth in harper ---------------------------------------------------
# Framework tests: any integrationTests/**/*.test.{ts,mts,js,mjs}.
# Legacy suite: the ordered files in integrationTests/apiTests/tests/.
{
  echo "date,framework_files,framework_cases,legacy_files,legacy_cases"
  for d in 2025-11-05 2025-12-04 2026-01-01 2026-02-01 2026-03-01 2026-04-01 \
           2026-05-01 2026-05-15 2026-06-01 2026-06-09 2026-07-01 2026-08-01 \
           2026-09-01 2026-10-01 2026-10-22; do
    c=$(at "$HARPER" "$d")
    files=$(git -C "$HARPER" ls-tree -r --name-only "$c" integrationTests | grep -E '\.test\.(m?ts|m?js)$' || true)
    nf=$(printf '%s' "$files" | grep -c . || true)
    if [ "$nf" -gt 0 ]; then
      nc=$( (git -C "$HARPER" grep -hE "$CASE" "$c" -- $files || true) | wc -l | tr -d ' ')
    else
      nc=0
    fi
    lf=$(git -C "$HARPER" ls-tree -r --name-only "$c" integrationTests/apiTests/tests 2>/dev/null | grep -E '\.mjs$' | grep -vc testSuite || true)
    lc=$( (git -C "$HARPER" grep -hE "$CASE" "$c" -- integrationTests/apiTests/tests 2>/dev/null || true) | wc -l | tr -d ' ')
    echo "$d,$nf,$nc,$lf,$lc"
  done
} > "$OUT/harper-test-growth.csv"

# --- PR activity in harper, per month ----------------------------------------
# Counts first-parent commits on main (one per merged PR).
#   touching:   changed anything under integrationTests/, except the legacy suite
#   adding:     added an integrationTests test file
#   fix:        subject starts with "fix" (case-insensitive)
#   fix_tested: a fix commit whose diff touches an integrationTests test file
{
  echo "month,merged,touching_integration_tests,adding_test_files,fix_commits,fix_with_integration_test"
  for m in 2025-11 2025-12 2026-01 2026-02 2026-03 2026-04 2026-05 2026-06 \
           2026-07 2026-08 2026-09 2026-10; do
    s="$m-01"
    e=$(date -j -v+1m -f %Y-%m-%d "$s" +%Y-%m-%d 2>/dev/null || date -d "$s +1 month" +%Y-%m-%d)
    all=$(git -C "$HARPER" log --first-parent --since="$s" --until="$e" --format=%h origin/main | wc -l | tr -d ' ')
    touch=$(git -C "$HARPER" log --first-parent --since="$s" --until="$e" --format=%h origin/main -- integrationTests ':!integrationTests/apiTests/tests' | wc -l | tr -d ' ')
    add=$(git -C "$HARPER" log --first-parent --since="$s" --until="$e" --diff-filter=A --format=%h origin/main -- 'integrationTests/**/*.test.*' | wc -l | tr -d ' ')
    fix=0; tested=0
    for c in $(git -C "$HARPER" log --first-parent --since="$s" --until="$e" --format=%H -i -E --grep='^fix' origin/main); do
      fix=$((fix + 1))
      if git -C "$HARPER" diff --name-only "$c^1" "$c" | grep -qE '^integrationTests/.*\.test\.'; then
        tested=$((tested + 1))
      fi
    done
    echo "$m,$all,$touch,$add,$fix,$tested"
  done
} > "$OUT/harper-pr-activity.csv"

# --- harper-pro integration test growth --------------------------------------
{
  echo "date,integration_test_files,cluster_test_files"
  for d in 2026-03-01 2026-04-01 2026-05-01 2026-06-01 2026-07-01 2026-08-01 \
           2026-09-01 2026-10-01 2026-10-22; do
    c=$(at "$PRO" "$d")
    files=$(git -C "$PRO" ls-tree -r --name-only "$c" integrationTests | grep -E '\.test\.(m?[jt]s)$' || true)
    nf=$(printf '%s' "$files" | grep -c . || true)
    cl=$(printf '%s' "$files" | grep -c '^integrationTests/cluster/' || true)
    echo "$d,$nf,$cl"
  done
} > "$OUT/harper-pro-test-growth.csv"

echo "wrote $OUT/harper-test-growth.csv, harper-pr-activity.csv, harper-pro-test-growth.csv"
