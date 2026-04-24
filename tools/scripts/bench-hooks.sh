#!/usr/bin/env bash
# bench-hooks.sh — Benchmark harness for agent hooks and lefthook pre-commit.
# Runs each agent hook N times with mock JSON, records wall-clock times.
# Usage: bash tools/scripts/bench-hooks.sh [output-file]
set -euo pipefail

ITERATIONS="${BENCH_ITERATIONS:-10}"
OUTPUT_FILE="${1:-logs/hooks-bench/benchmark.json}"
HOOKS_DIR=".github/hooks"

mkdir -p "$(dirname "$OUTPUT_FILE")"

declare -A HOOK_EVENTS=(
  ["SessionStart"]='{"timestamp":"2026-01-01T00:00:00Z","sessionId":"bench-001","cwd":"/workspace","source":"copilot"}'
  ["UserPromptSubmit"]='{"userMessage":"deploy a web app to Azure"}'
  ["Stop"]='{"sessionId":"bench-001"}'
)

# Discover which hook dirs handle which events
declare -A DIR_EVENTS
for dir in "$HOOKS_DIR"/*/; do
  [ -f "$dir/hooks.json" ] || continue
  dir_name=$(basename "$dir")
  events=$(python3 -c "
import json, sys
with open(sys.argv[1]) as f:
    data = json.load(f)
for event in data.get('hooks', {}):
    print(event)
" "$dir/hooks.json" 2>/dev/null || true)
  DIR_EVENTS["$dir_name"]="$events"
done

results="[]"

echo "🔄 Benchmarking agent hooks ($ITERATIONS iterations each)..."
echo ""

for event in SessionStart UserPromptSubmit Stop; do
  input_json="${HOOK_EVENTS[$event]}"
  times=()

  for dir_name in "${!DIR_EVENTS[@]}"; do
    if ! echo "${DIR_EVENTS[$dir_name]}" | grep -q "$event"; then
      continue
    fi

    hooks_json="$HOOKS_DIR/$dir_name/hooks.json"
    script=$(python3 -c "
import json, sys
with open(sys.argv[1]) as f:
    data = json.load(f)
entries = data.get('hooks', {}).get(sys.argv[2], [])
for e in entries:
    print(e.get('command', ''))
" "$hooks_json" "$event" 2>/dev/null | head -1)

    [ -z "$script" ] && continue

    # Extract script path from "bash <path>" to avoid eval (command injection risk)
    script_path="${script#bash }"
    if [[ ! -f "$script_path" ]]; then
      echo "    ⚠️  Script not found: $script_path — skipping"
      continue
    fi

    echo "  ⏱️  $dir_name/$event ..."
    durations=()
    for ((i = 1; i <= ITERATIONS; i++)); do
      start_ns=$(date +%s%N 2>/dev/null || python3 -c "import time; print(int(time.time()*1e9))")
      echo "$input_json" | bash "$script_path" > /dev/null 2>&1 || true
      end_ns=$(date +%s%N 2>/dev/null || python3 -c "import time; print(int(time.time()*1e9))")
      duration_ms=$(( (end_ns - start_ns) / 1000000 ))
      durations+=("$duration_ms")
    done

    # Calculate stats
    sum=0
    min=${durations[0]}
    max=${durations[0]}
    for d in "${durations[@]}"; do
      sum=$((sum + d))
      (( d < min )) && min=$d
      (( d > max )) && max=$d
    done
    avg=$((sum / ITERATIONS))

    results=$(python3 -c "
import json, sys
results = json.loads(sys.argv[1])
results.append({
    'hook': sys.argv[2],
    'event': sys.argv[3],
    'iterations': int(sys.argv[4]),
    'avg_ms': int(sys.argv[5]),
    'min_ms': int(sys.argv[6]),
    'max_ms': int(sys.argv[7])
})
print(json.dumps(results))
" "$results" "$dir_name" "$event" "$ITERATIONS" "$avg" "$min" "$max")

    echo "     avg=${avg}ms min=${min}ms max=${max}ms"
  done
done

# Benchmark lefthook pre-commit (if lefthook available)
echo ""
echo "  ⏱️  lefthook pre-commit ..."
if command -v lefthook &>/dev/null; then
  # Create a synthetic changeset touching multiple domains
  SYNTHETIC_FILES="README.md,.github/agents/test.agent.md,infra/terraform/test/main.tf"
  lh_durations=()
  for ((i = 1; i <= ITERATIONS; i++)); do
    start_ns=$(date +%s%N 2>/dev/null || python3 -c "import time; print(int(time.time()*1e9))")
    lefthook run pre-commit --files "$SYNTHETIC_FILES" > /dev/null 2>&1 || true
    end_ns=$(date +%s%N 2>/dev/null || python3 -c "import time; print(int(time.time()*1e9))")
    duration_ms=$(( (end_ns - start_ns) / 1000000 ))
    lh_durations+=("$duration_ms")
  done

  sum=0; min=${lh_durations[0]}; max=${lh_durations[0]}
  for d in "${lh_durations[@]}"; do
    sum=$((sum + d))
    (( d < min )) && min=$d
    (( d > max )) && max=$d
  done
  avg=$((sum / ITERATIONS))

  results=$(python3 -c "
import json, sys
results = json.loads(sys.argv[1])
results.append({
    'hook': 'lefthook-precommit',
    'event': 'pre-commit',
    'iterations': int(sys.argv[2]),
    'avg_ms': int(sys.argv[3]),
    'min_ms': int(sys.argv[4]),
    'max_ms': int(sys.argv[5])
})
print(json.dumps(results))
" "$results" "$ITERATIONS" "$avg" "$min" "$max")

  echo "     avg=${avg}ms min=${min}ms max=${max}ms"
else
  echo "     ⚠️  lefthook not installed — skipping pre-commit benchmark"
fi

# Write results
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
python3 -c "
import json, sys
output = {
    'timestamp': sys.argv[1],
    'iterations': int(sys.argv[2]),
    'results': json.loads(sys.argv[3])
}
with open(sys.argv[4], 'w') as f:
    json.dump(output, f, indent=2)
print()
print(f'📊 Results written to {sys.argv[4]}')
" "$TIMESTAMP" "$ITERATIONS" "$results" "$OUTPUT_FILE"
