#!/usr/bin/env bash
# Validate that every `agent: NAME` reference inside a `handoffs:` block of
# an `.agent.md` frontmatter resolves to an agent that actually exists.
#
# Extracted from `.github/workflows/ci.yml` (May 2026) so the same check can
# run from lefthook, locally, or any other CI surface without duplicating
# bash. Active native agents omit UI handoffs; an empty reference set is valid.
#
# Usage:
#   tools/scripts/validate-handoff-references.sh [agents-dir]
#
# Defaults to `.github/agents` when no path is given.

set -euo pipefail

agents_dir="${1:-.github/agents}"

if [[ ! -d "$agents_dir" ]]; then
  echo "::error::Agents directory not found: $agents_dir"
  exit 2
fi

# Built-in agents that the platform provides — these never appear as
# `.agent.md` files but are legal handoff targets.
builtin_agents="agent"

handoffs_file=$(mktemp)
agents_file=$(mktemp)
trap 'rm -f "$handoffs_file" "$agents_file"' EXIT

collect_matches() {
  local status=0
  grep -rhE "$1" "$agents_dir" --include="*.agent.md" || status=$?
  if (( status > 1 )); then
    echo "::error::Unable to inspect agent references: $agents_dir (grep exit $status)" >&2
    return "$status"
  fi
}

# Anchor on indented YAML frontmatter lines so prose like
# "subagent: foo" or "agent name:" in body markdown doesn't slip
# through. Real handoff entries always look like `    agent: NAME`
# under a `handoffs:` list.
collect_matches "^[[:space:]]+(-[[:space:]]+)?agent:[[:space:]]" \
  | sed -E 's/^[[:space:]]*(-[[:space:]]+)?agent:[[:space:]]*//' \
  | tr -d '"' \
  | sort -u > "$handoffs_file"

# `name:` lives at column 0 of the YAML frontmatter, so anchor
# to start-of-line with no leading whitespace.
collect_matches "^name:[[:space:]]" \
  | sed 's/^name:[[:space:]]*//' \
  | tr -d '"' \
  | sort -u > "$agents_file"

if [[ ! -s "$agents_file" ]]; then
  echo "::error::No named agent definitions found: $agents_dir" >&2
  exit 2
fi

errors=0
while IFS= read -r handoff; do
  [[ -z "$handoff" ]] && continue
  if echo "$builtin_agents" | grep -Fqiw -- "$handoff"; then
    continue
  fi
  if ! grep -Fqix -- "$handoff" "$agents_file"; then
    echo "Invalid handoff reference: $handoff"
    errors=$((errors + 1))
  fi
done < "$handoffs_file"

if (( errors > 0 )); then
  echo "Found $errors invalid handoff reference(s)"
  exit 1
fi

echo "All handoff references are valid"
