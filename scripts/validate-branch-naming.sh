#!/usr/bin/env bash
# validate-branch-naming.sh
# Enforces branch naming convention: must use an approved domain prefix.
# Called by lefthook pre-push hook and can be run standalone.
set -euo pipefail

BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Skip enforcement for main, HEAD (detached), and dependabot branches
if [[ "$BRANCH" == "main" || "$BRANCH" == "HEAD" || "$BRANCH" == dependabot/* ]]; then
  exit 0
fi

ALLOWED_PREFIXES="docs/|agents/|skills/|infra/|scripts/|instructions/|fix/|chore/|feat/|ci/|refactor/|perf/|test/|build/|revert/"

if ! echo "$BRANCH" | grep -qE "^($ALLOWED_PREFIXES)"; then
  echo "❌ Branch name '$BRANCH' does not follow naming convention."
  echo ""
  echo "   Allowed prefixes:"
  echo "     docs/         Documentation changes (site/, README.md)"
  echo "     agents/       Agent definitions (.github/agents/)"
  echo "     skills/       Skill files (.github/skills/)"
  echo "     infra/        Infrastructure code (infra/bicep/, infra/terraform/)"
  echo "     scripts/      Validation scripts, linters"
  echo "     instructions/ Instruction files (.github/instructions/)"
  echo "     fix/          Bug fixes (cross-cutting)"
  echo "     feat/         New features (cross-cutting)"
  echo "     chore/        Maintenance, deps, tooling"
  echo "     ci/           CI/CD workflows"
  echo "     refactor/     Code refactoring"
  echo "     perf/         Performance improvements"
  echo "     test/         Test additions/updates"
  echo "     build/        Build system changes"
  echo "     revert/       Reverting previous changes"
  echo ""
  echo "   Examples:"
  echo "     docs/update-workflow-guide"
  echo "     agents/improve-orchestrator-handoff"
  echo "     feat/azure-skills-integration"
  echo "     fix/session-state-schema"
  echo ""
  exit 1
fi

echo "✅ Branch name '$BRANCH' follows naming convention"
