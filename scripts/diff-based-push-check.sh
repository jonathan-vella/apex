#!/usr/bin/env bash
# diff-based-push-check.sh
# Categorizes changed files and runs only matching validators in parallel.
# Called by lefthook pre-push hook.
set -euo pipefail

CHANGED_FILES=$(git diff --name-only origin/main...HEAD 2>/dev/null || git diff --name-only HEAD~1...HEAD 2>/dev/null || echo "")

if [ -z "$CHANGED_FILES" ]; then
  echo "ℹ️  No changed files detected — skipping validators"
  exit 0
fi

BICEP_COUNT=0
TF_COUNT=0
MD_ARTIFACT_COUNT=0
AGENT_COUNT=0
INSTRUCTION_COUNT=0
SKILL_COUNT=0
JSON_COUNT=0
PY_COUNT=0
DRAWIO_COUNT=0

while IFS= read -r file; do
  case "$file" in
    *.bicep) BICEP_COUNT=$((BICEP_COUNT + 1)) ;;
    *.tf) TF_COUNT=$((TF_COUNT + 1)) ;;
    agent-output/*.md) MD_ARTIFACT_COUNT=$((MD_ARTIFACT_COUNT + 1)) ;;
    *.agent.md) AGENT_COUNT=$((AGENT_COUNT + 1)) ;;
    *.instructions.md) INSTRUCTION_COUNT=$((INSTRUCTION_COUNT + 1)) ;;
    */SKILL.md) SKILL_COUNT=$((SKILL_COUNT + 1)) ;;
    *.json) JSON_COUNT=$((JSON_COUNT + 1)) ;;
    mcp/*.py|scripts/*.py) PY_COUNT=$((PY_COUNT + 1)) ;;
    *.drawio) DRAWIO_COUNT=$((DRAWIO_COUNT + 1)) ;;
  esac
done <<< "$CHANGED_FILES"

TOTAL=$((BICEP_COUNT + TF_COUNT + MD_ARTIFACT_COUNT + AGENT_COUNT + INSTRUCTION_COUNT + SKILL_COUNT + JSON_COUNT + PY_COUNT + DRAWIO_COUNT))

if [ "$TOTAL" -eq 0 ]; then
  echo "ℹ️  No validatable files changed — skipping"
  exit 0
fi

echo "🔄 Running diff-based push checks (parallel)..."
echo ""

# Temp dir for collecting per-check exit codes
RESULTS_DIR=$(mktemp -d)
trap 'rm -rf "$RESULTS_DIR"' EXIT

run_check() {
  local label="$1"
  local count="$2"
  local cmd="$3"
  local slug="$4"

  if [ "$count" -gt 0 ]; then
    if eval "$cmd" > /dev/null 2>&1; then
      echo "pass" > "$RESULTS_DIR/$slug"
    else
      echo "fail" > "$RESULTS_DIR/$slug"
    fi
  fi
}

# Launch all checks in background
run_check "Bicep lint" "$BICEP_COUNT" "shopt -s nullglob; for f in infra/bicep/*/main.bicep; do bicep build \"\$f\" && bicep lint \"\$f\"; done" "bicep" &
run_check "Terraform fmt" "$TF_COUNT" "npm run lint:terraform-fmt" "tf-fmt" &
run_check "Terraform validate" "$TF_COUNT" "npm run validate:terraform" "tf-validate" &
run_check "Artifact templates" "$MD_ARTIFACT_COUNT" "npm run validate:artifacts" "artifacts" &
run_check "Agent validation" "$AGENT_COUNT" "npm run validate:agents" "agents" &
run_check "Instruction checks" "$INSTRUCTION_COUNT" "npm run validate:instruction-checks" "instructions" &
run_check "Skills validation" "$SKILL_COUNT" "npm run validate:skills" "skills" &
run_check "JSON syntax" "$JSON_COUNT" "npm run lint:json" "json" &
run_check "Python lint" "$PY_COUNT" "npm run lint:python" "python" &
run_check "Draw.io files" "$DRAWIO_COUNT" "npm run lint:drawio" "drawio" &

wait

# Collect results
PASS=0
FAIL=0
for result_file in "$RESULTS_DIR"/*; do
  [ -f "$result_file" ] || continue
  slug=$(basename "$result_file")
  status=$(cat "$result_file")
  if [ "$status" = "pass" ]; then
    echo "  ✅ $slug passed"
    PASS=$((PASS + 1))
  else
    echo "  ❌ $slug failed"
    FAIL=$((FAIL + 1))
  fi
done

echo ""
echo "📊 Checked: ${BICEP_COUNT} Bicep, ${TF_COUNT} Terraform, ${MD_ARTIFACT_COUNT} Artifact MD, ${AGENT_COUNT} Agent, ${INSTRUCTION_COUNT} Instruction, ${SKILL_COUNT} Skill, ${JSON_COUNT} JSON, ${PY_COUNT} Python, ${DRAWIO_COUNT} Draw.io"
echo "   Results: ${PASS} passed, ${FAIL} failed"

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "❌ Pre-push validation failed"
  exit 1
fi

echo ""
echo "✅ All pre-push checks passed"
