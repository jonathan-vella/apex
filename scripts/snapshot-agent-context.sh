#!/usr/bin/env bash
# Snapshot agent context files for before/after comparison.
# Backs up: .github/agents, .github/instructions, .github/prompts, .github/skills, AGENTS.md

set -euo pipefail

readonly SCRIPT_NAME="$(basename "$0")"
readonly REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
readonly BASELINES_DIR="${REPO_ROOT}/agent-output/_baselines"

readonly BACKUP_TARGETS=(
  ".github/agents"
  ".github/instructions"
  ".github/prompts"
  ".github/skills"
  "AGENTS.md"
)

usage() {
  cat <<EOF
Usage: ${SCRIPT_NAME} [OPTIONS] [LABEL]

Create a baseline snapshot of agent context files for before/after comparison.

Arguments:
  LABEL       Snapshot label (default: ISO timestamp like 2026-03-02T14-30-00)

Options:
  -h, --help  Show this help message

Backed-up targets:
  .github/agents/        Agent definitions (including _subagents/)
  .github/instructions/  Instruction files
  .github/prompts/       Prompt files
  .github/skills/        Skills (full recursive)
  AGENTS.md              Root project conventions

Output:
  agent-output/_baselines/{label}/   Snapshot directory with manifest.json
EOF
  exit 0
}

while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--help) usage ;;
    -*) echo "Error: Unknown option $1" >&2; exit 1 ;;
    *) break ;;
  esac
done

LABEL="${1:-$(date -u +%Y-%m-%dT%H-%M-%S)}"
readonly SNAPSHOT_DIR="${BASELINES_DIR}/${LABEL}"

if [[ -d "${SNAPSHOT_DIR}" ]]; then
  echo "Error: Snapshot '${LABEL}' already exists at ${SNAPSHOT_DIR}" >&2
  exit 1
fi

mkdir -p "${SNAPSHOT_DIR}"

# Cleanup partial snapshot on error
trap 'rc=$?; if [[ $rc -ne 0 ]]; then echo "Error: snapshot failed; cleaning up ${SNAPSHOT_DIR}" >&2; rm -rf "${SNAPSHOT_DIR}"; fi; exit $rc' ERR

file_count=0
for target in "${BACKUP_TARGETS[@]}"; do
  src="${REPO_ROOT}/${target}"
  dest="${SNAPSHOT_DIR}/${target}"

  if [[ ! -e "${src}" ]]; then
    echo "Warning: ${target} not found, skipping" >&2
    continue
  fi

  if [[ -d "${src}" ]]; then
    mkdir -p "${dest}"
    cp -r "${src}/." "${dest}/"
    count=$(find "${dest}" -type f | wc -l)
  else
    mkdir -p "$(dirname "${dest}")"
    cp "${src}" "${dest}"
    count=1
  fi

  file_count=$((file_count + count))
done

total_size=$(du -sh "${SNAPSHOT_DIR}" | cut -f1)
git_sha=$(git -C "${REPO_ROOT}" rev-parse --short HEAD 2>/dev/null || echo "unknown")

# Build manifest using jq
jq -n \
  --arg label "${LABEL}" \
  --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg git_sha "${git_sha}" \
  --argjson file_count "${file_count}" \
  --arg total_size "${total_size}" \
  --argjson targets "$(printf '%s\n' "${BACKUP_TARGETS[@]}" | jq -R . | jq -s .)" \
  '{
    label: $label,
    timestamp: $timestamp,
    git_sha: $git_sha,
    file_count: $file_count,
    total_size: $total_size,
    backed_up_targets: $targets
  }' > "${SNAPSHOT_DIR}/manifest.json"

echo ""
echo "Baseline snapshot created"
echo "  Label:      ${LABEL}"
echo "  Location:   ${SNAPSHOT_DIR}"
echo "  Files:      ${file_count}"
echo "  Size:       ${total_size}"
echo "  Git SHA:    ${git_sha}"
echo ""
echo "To compare after changes: npm run diff:baseline -- --baseline ${LABEL}"
