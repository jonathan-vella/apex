#!/usr/bin/env bash
# Validate that every `agent: NAME` reference inside a `handoffs:` block of
# an `.agent.md` frontmatter resolves to an agent that actually exists.
#
# Extracted from `.github/workflows/ci.yml` (May 2026) so the same check can
# run from lefthook, locally, or any other CI surface without duplicating
# bash. Behaviour is byte-identical to the previous inline implementation.
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

# Anchor on indented YAML frontmatter lines so prose like
# "subagent: foo" or "agent name:" in body markdown doesn't slip
# through. Real handoff entries always look like `    agent: NAME`
# under a `handoffs:` list.
grep -rhE "^[[:space:]]+agent:[[:space:]]" "$agents_dir" --include="*.agent.md" 2>/dev/null \
  | sed 's/^[[:space:]]*agent:[[:space:]]*//' \
  | tr -d '"' \
  | sort -u > "$handoffs_file"

# `name:` lives at column 0 of the YAML frontmatter, so anchor
# to start-of-line with no leading whitespace.
grep -rhE "^name:[[:space:]]" "$agents_dir" --include="*.agent.md" 2>/dev/null \
  | sed 's/^name:[[:space:]]*//' \
  | tr -d '"' \
  | sort -u > "$agents_file"

errors=0
while IFS= read -r handoff; do
  [[ -z "$handoff" ]] && continue
  if echo "$builtin_agents" | grep -qiw "$handoff"; then
    continue
  fi
  if ! grep -qi "^${handoff}$" "$agents_file"; then
    echo "Invalid handoff reference: $handoff"
    errors=$((errors + 1))
  fi
done < "$handoffs_file"

if (( errors > 0 )); then
  echo "Found $errors invalid handoff reference(s)"
  exit 1
fi

echo "All handoff references are valid"
