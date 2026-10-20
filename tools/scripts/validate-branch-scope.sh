#!/usr/bin/env bash
# Validate committed branch scope against an explicit base, locally and in CI.
set -euo pipefail

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  echo "Usage: bash tools/scripts/validate-branch-scope.sh [branch] [base-ref]"
  echo "Defaults to the current branch and origin/main. Missing comparison evidence fails."
  exit 0
fi
if [[ $# -gt 2 ]]; then
  echo "Expected branch and optional base-ref arguments. Use --help for usage." >&2
  exit 1
fi

BRANCH="${1-$(git rev-parse --abbrev-ref HEAD)}"
BASE_REF="${2-origin/main}"
bash "$(dirname "${BASH_SOURCE[0]}")/validate-branch-naming.sh" "$BRANCH"

if [[ "$BRANCH" == "main" || "$BRANCH" == "HEAD" ]]; then
  exit 0
fi

PREFIX="${BRANCH%%/*}"
case "$PREFIX" in
  feat|fix|chore|refactor|revert|perf|test|build|ci|dependabot|automation)
    echo "Branch '$BRANCH' is cross-cutting; no domain scope restriction."
    exit 0
    ;;
  docs)
    ALLOWED_PATTERN='^(README\.md|CONTRIBUTING\.md|CHANGELOG\.md|GLOSSARY\.md)$'
    LABEL="README.md, CONTRIBUTING.md, CHANGELOG.md, GLOSSARY.md"
    ;;
  agents)
    ALLOWED_PATTERN='^(\.github/agents/|tools/registry/agent-registry\.json$)'
    LABEL=".github/agents/, tools/registry/agent-registry.json"
    ;;
  skills)
    ALLOWED_PATTERN='^\.github/skills/'
    LABEL=".github/skills/"
    ;;
  infra)
    ALLOWED_PATTERN='^infra/'
    LABEL="infra/"
    ;;
  scripts)
    ALLOWED_PATTERN='^(tools/scripts/|package\.json$)'
    LABEL="tools/scripts/, package.json"
    ;;
  instructions)
    ALLOWED_PATTERN='^\.github/instructions/'
    LABEL=".github/instructions/"
    ;;
esac

CHANGED_FILES_FILE=$(mktemp)
trap 'rm -f "$CHANGED_FILES_FILE"' EXIT
if [[ -z "$BASE_REF" ]] || ! git diff --name-only --no-renames -z "$BASE_REF"...HEAD -- > "$CHANGED_FILES_FILE"; then
  echo "Cannot compare branch '$BRANCH' with base '$BASE_REF'; fetch/verify the base before retrying." >&2
  exit 1
fi

OUT_OF_SCOPE=()
TOTAL=0
while IFS= read -r -d '' file; do
  TOTAL=$((TOTAL + 1))
  if [[ ! "$file" =~ $ALLOWED_PATTERN ]]; then
    OUT_OF_SCOPE+=("$file")
  fi
done < "$CHANGED_FILES_FILE"

if [[ ${#OUT_OF_SCOPE[@]} -gt 0 ]]; then
  echo "Branch '$BRANCH' modifies files outside $LABEL:" >&2
  printf '  %q\n' "${OUT_OF_SCOPE[@]}" >&2
  echo "Use an approved cross-cutting branch or split the changes." >&2
  exit 1
fi

echo "All $TOTAL changed file(s) are within scope for '$PREFIX/' branch."
