#!/usr/bin/env bash
# diff-based-push-check.sh
# Categorizes changed files and runs only matching validators.
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
PASS=0
FAIL=0

check_domain() {
  local label="$1"
  local count="$2"
  local cmd="$3"

  if [ "$count" -gt 0 ]; then
    echo "  🔍 $label ($count file(s))..."
    if eval "$cmd" > /dev/null 2>&1; then
      echo "    ✅ $label passed"
      PASS=$((PASS + 1))
    else
      echo "    ❌ $label failed"
      FAIL=$((FAIL + 1))
    fi
  fi
}

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
  esac
done <<< "$CHANGED_FILES"

TOTAL=$((BICEP_COUNT + TF_COUNT + MD_ARTIFACT_COUNT + AGENT_COUNT + INSTRUCTION_COUNT + SKILL_COUNT + JSON_COUNT + PY_COUNT))

if [ "$TOTAL" -eq 0 ]; then
  echo "ℹ️  No validatable files changed — skipping"
  exit 0
fi

echo "🔄 Running diff-based push checks..."
echo ""

check_domain "Bicep lint" "$BICEP_COUNT" "for f in infra/bicep/*/main.bicep; do [ -f \"\$f\" ] && bicep build \"\$f\" && bicep lint \"\$f\"; done"
check_domain "Terraform fmt" "$TF_COUNT" "npm run lint:terraform-fmt"
check_domain "Terraform validate" "$TF_COUNT" "npm run validate:terraform"
check_domain "Artifact templates" "$MD_ARTIFACT_COUNT" "npm run lint:artifact-templates"
check_domain "Agent frontmatter" "$AGENT_COUNT" "npm run lint:agent-frontmatter"
check_domain "Agent body size" "$AGENT_COUNT" "npm run lint:agent-body-size"
check_domain "Instruction frontmatter" "$INSTRUCTION_COUNT" "npm run lint:instruction-frontmatter"
check_domain "Skills format" "$SKILL_COUNT" "npm run lint:skills-format"
check_domain "Skill size" "$SKILL_COUNT" "npm run lint:skill-size"
check_domain "JSON syntax" "$JSON_COUNT" "npm run lint:json"
check_domain "Python lint" "$PY_COUNT" "npm run lint:python"

echo ""
echo "📊 Checked: ${BICEP_COUNT} Bicep, ${TF_COUNT} Terraform, ${MD_ARTIFACT_COUNT} Artifact MD, ${AGENT_COUNT} Agent, ${INSTRUCTION_COUNT} Instruction, ${SKILL_COUNT} Skill, ${JSON_COUNT} JSON, ${PY_COUNT} Python"
echo "   Results: ${PASS} passed, ${FAIL} failed"

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "❌ Pre-push validation failed"
  exit 1
fi

echo ""
echo "✅ All pre-push checks passed"
