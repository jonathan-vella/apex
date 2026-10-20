#!/usr/bin/env bash
# Validate contributor branch names using the same policy locally and in CI.
set -euo pipefail

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  echo "Usage: bash tools/scripts/validate-branch-naming.sh [branch]"
  echo "Defaults to the current branch. main and detached HEAD are skipped."
  exit 0
fi
if [[ $# -gt 1 ]]; then
  echo "Expected at most one branch argument. Use --help for usage." >&2
  exit 1
fi

BRANCH="${1-$(git rev-parse --abbrev-ref HEAD)}"
if [[ "$BRANCH" == "main" || "$BRANCH" == "HEAD" ]]; then
  exit 0
fi
if ! git check-ref-format --branch "$BRANCH" >/dev/null 2>&1; then
  echo "Invalid Git branch name: '$BRANCH'." >&2
  exit 1
fi

ALLOWED_PREFIXES='^(docs|agents|skills|infra|scripts|instructions|fix|chore|feat|ci|refactor|perf|test|build|revert|dependabot|automation)/'
if [[ ! "$BRANCH" =~ $ALLOWED_PREFIXES ]]; then
  echo "Branch '$BRANCH' does not follow the naming convention." >&2
  echo "Use docs/, agents/, skills/, infra/, scripts/, instructions/," >&2
  echo "fix/, chore/, feat/, ci/, refactor/, perf/, test/, build/ or revert/." >&2
  echo "dependabot/ and automation/ are reserved for automation workflows." >&2
  exit 1
fi

echo "Branch '$BRANCH' follows the naming convention."
