#!/usr/bin/env bash
# validate-branch-scope.sh
# Enforces that domain-scoped branches only modify files within their domain.
# Cross-cutting prefixes (feat/, fix/, chore/, refactor/, revert/, perf/, test/, build/, ci/)
# are exempt — they may touch any files.
# Called by lefthook pre-push hook and can be run standalone.
set -euo pipefail

BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Skip enforcement for main, HEAD (detached), and dependabot branches
if [[ "$BRANCH" == "main" || "$BRANCH" == "HEAD" || "$BRANCH" == dependabot/* ]]; then
  exit 0
fi

PREFIX=$(echo "$BRANCH" | cut -d'/' -f1)

# Cross-cutting prefixes: no file scope restriction
case "$PREFIX" in
  feat|fix|chore|refactor|revert|perf|test|build|ci)
    echo "ℹ️  Branch prefix '$PREFIX/' is cross-cutting — no file scope restriction"
    exit 0
    ;;
esac

# Determine allowed file patterns per domain prefix
case "$PREFIX" in
  docs)
    ALLOWED_PATTERN='^(site/|README\.md|CONTRIBUTING\.md|CHANGELOG\.md|GLOSSARY\.md)'
    LABEL="site/, README.md, CONTRIBUTING.md, CHANGELOG.md"
    ;;
  agents)
    ALLOWED_PATTERN='^(\.github/agents/|\.github/agent-registry\.json)'
    LABEL=".github/agents/, .github/agent-registry.json"
    ;;
  skills)
    ALLOWED_PATTERN='^(\.github/skills/|\.github/skill-affinity\.json)'
    LABEL=".github/skills/, .github/skill-affinity.json"
    ;;
  infra)
    ALLOWED_PATTERN='^infra/'
    LABEL="infra/"
    ;;
  scripts)
    ALLOWED_PATTERN='^(scripts/|package\.json)'
    LABEL="scripts/, package.json"
    ;;
  instructions)
    ALLOWED_PATTERN='^\.github/instructions/'
    LABEL=".github/instructions/"
    ;;
  *)
    echo "ℹ️  Unknown branch prefix '$PREFIX/' — no file scope restriction"
    exit 0
    ;;
esac

# Get list of changed files vs origin/main (or fallback to HEAD~1)
CHANGED_FILES=$(git diff --name-only origin/main...HEAD 2>/dev/null || git diff --name-only HEAD~1...HEAD 2>/dev/null || echo "")

if [ -z "$CHANGED_FILES" ]; then
  echo "ℹ️  No changed files detected — skipping scope check"
  exit 0
fi

# Find files that fall outside the allowed scope
OUT_OF_SCOPE=""
while IFS= read -r file; do
  if ! echo "$file" | grep -qE "$ALLOWED_PATTERN"; then
    OUT_OF_SCOPE="${OUT_OF_SCOPE}    ${file}\n"
  fi
done <<< "$CHANGED_FILES"

if [ -n "$OUT_OF_SCOPE" ]; then
  echo "⚠️  Branch scope notice: '$BRANCH' also modifies files outside $LABEL"
  echo ""
  echo "   Files outside scope:"
  echo -e "$OUT_OF_SCOPE"
  echo "   💡 Consider a feat/ or fix/ branch for cross-cutting changes."
  echo ""
  # Warning only — do not block push
  exit 0
fi

TOTAL=$(echo "$CHANGED_FILES" | wc -l | tr -d ' ')
echo "✅ All $TOTAL changed file(s) are within scope for '$PREFIX/' branch"
