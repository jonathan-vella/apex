#!/usr/bin/env bash
# Creates GitHub issues for the Terraform support workstream (issue #85 + 8 phase children).
# Prerequisites: gh auth login must be completed first.
# Usage: bash docs/tf-support/github-issues/create-issues.sh

set -e

REPO="jonathan-vella/azure-agentic-infraops"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Creating child issues for Terraform support workstream..."

create_issue() {
  local file="$1"
  local title
  title=$(grep -m1 '^# ' "$file" | sed 's/^# //')
  local labels
  labels=$(grep -m1 '^labels:' "$file" | sed 's/^labels: //')
  local body
  body=$(sed '1,/^---$/d' "$file" 2>/dev/null || sed '1,5d' "$file")

  gh issue create \
    --repo "$REPO" \
    --title "$title" \
    --body "$body" \
    --label "$labels" \
    --milestone "Terraform Support"
}

for issue_file in "$SCRIPT_DIR"/issue-child-*.md; do
  echo "Creating: $issue_file"
  create_issue "$issue_file"
  sleep 1
done

echo ""
echo "All issues created. Update issue #85 body manually using issue-85-parent.md"
echo "Then link all child issues to #85 as a tasklist."
