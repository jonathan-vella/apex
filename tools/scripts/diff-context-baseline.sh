#!/usr/bin/env bash
# Generate a diff report comparing a baseline snapshot against current agent context files.

set -euo pipefail

readonly SCRIPT_NAME="$(basename "$0")"
readonly REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
readonly BASELINES_DIR="${REPO_ROOT}/agent-output/_baselines"

BASELINE_LABEL=""
OUTPUT_PATH=""

usage() {
  cat <<EOF
Usage: ${SCRIPT_NAME} --baseline LABEL [--output PATH]

Generate a markdown diff report comparing a baseline snapshot against the
current state of agent context files.

Options:
  --baseline LABEL  The snapshot label to compare against (required)
  --output PATH     Output file path (default: agent-output/_baselines/{label}/diff-report.md)
  -h, --help        Show this help message

Example:
  ${SCRIPT_NAME} --baseline 2026-03-02T14-30-00
  ${SCRIPT_NAME} --baseline pre-optimization --output /tmp/my-diff.md
EOF
  exit 0
}

while [[ $# -gt 0 ]]; do
  case $1 in
    --baseline) BASELINE_LABEL="$2"; shift 2 ;;
    --output) OUTPUT_PATH="$2"; shift 2 ;;
    -h|--help) usage ;;
    -*) echo "Error: Unknown option $1" >&2; exit 1 ;;
    *) echo "Error: Unexpected argument $1" >&2; exit 1 ;;
  esac
done

if [[ -z "${BASELINE_LABEL}" ]]; then
  echo "Error: --baseline LABEL is required" >&2
  echo "Available baselines:"
  if [[ -d "${BASELINES_DIR}" ]]; then
    find "${BASELINES_DIR}" -maxdepth 1 -mindepth 1 -type d -exec basename {} \; | sort
  else
    echo "  (none — run npm run snapshot:baseline first)"
  fi
  exit 1
fi

readonly SNAPSHOT_DIR="${BASELINES_DIR}/${BASELINE_LABEL}"

if [[ ! -d "${SNAPSHOT_DIR}" ]]; then
  echo "Error: Baseline '${BASELINE_LABEL}' not found at ${SNAPSHOT_DIR}" >&2
  exit 1
fi

if [[ -z "${OUTPUT_PATH}" ]]; then
  OUTPUT_PATH="${SNAPSHOT_DIR}/diff-report.md"
fi

readonly MANIFEST="${SNAPSHOT_DIR}/manifest.json"
if [[ ! -f "${MANIFEST}" ]]; then
  echo "Error: No manifest.json in baseline — snapshot may be corrupt" >&2
  exit 1
fi

baseline_timestamp=$(jq -r '.timestamp' "${MANIFEST}")
baseline_sha=$(jq -r '.git_sha' "${MANIFEST}")
current_sha=$(git -C "${REPO_ROOT}" rev-parse --short HEAD 2>/dev/null || echo "unknown")

readonly CATEGORIES=(
  ".github/agents:Agents"
  ".github/instructions:Instructions"
  ".github/prompts:Prompts"
  ".github/skills:Skills"
  "AGENTS.md:AGENTS.md"
)

total_added=0
total_modified=0
total_deleted=0
total_unchanged=0
total_lines_added=0
total_lines_removed=0
category_summaries=""
category_diffs=""

for entry in "${CATEGORIES[@]}"; do
  target="${entry%%:*}"
  label="${entry##*:}"

  baseline_path="${SNAPSHOT_DIR}/${target}"
  current_path="${REPO_ROOT}/${target}"

  added=0
  modified=0
  deleted=0
  unchanged=0
  cat_diffs=""

  if [[ -d "${baseline_path}" ]]; then
    # Directory comparison
    while IFS= read -r rel_file; do
      old_file="${baseline_path}/${rel_file}"
      new_file="${current_path}/${rel_file}"

      if [[ ! -f "${new_file}" ]]; then
        deleted=$((deleted + 1))
        cat_diffs+=$'\n'"#### Deleted: \`${target}/${rel_file}\`"$'\n'
      elif ! diff -q "${old_file}" "${new_file}" > /dev/null 2>&1; then
        modified=$((modified + 1))
        udiff=$(diff -u "${old_file}" "${new_file}" 2>/dev/null || true)
        lines_added=$(echo "${udiff}" | grep -c '^+[^+]' || true)
        lines_removed=$(echo "${udiff}" | grep -c '^-[^-]' || true)
        total_lines_added=$((total_lines_added + lines_added))
        total_lines_removed=$((total_lines_removed + lines_removed))

        cat_diffs+=$'\n'"#### Modified: \`${target}/${rel_file}\` (+${lines_added}/-${lines_removed})"$'\n\n'
        cat_diffs+='```diff'$'\n'"${udiff}"$'\n''```'$'\n'
      else
        unchanged=$((unchanged + 1))
      fi
    done < <(cd "${baseline_path}" && find . -type f ! -name 'manifest.json' | sed 's|^\./||' | sort)

    # Check for new files not in baseline
    if [[ -d "${current_path}" ]]; then
      while IFS= read -r rel_file; do
        if [[ ! -f "${baseline_path}/${rel_file}" ]]; then
          added=$((added + 1))
          line_count=$(wc -l < "${current_path}/${rel_file}" 2>/dev/null || echo "0")
          total_lines_added=$((total_lines_added + line_count))
          cat_diffs+=$'\n'"#### Added: \`${target}/${rel_file}\` (+${line_count} lines)"$'\n'
        fi
      done < <(cd "${current_path}" && find . -type f | sed 's|^\./||' | sort)
    fi

  elif [[ -f "${baseline_path}" ]]; then
    # Single file comparison
    if [[ ! -f "${current_path}" ]]; then
      deleted=$((deleted + 1))
      cat_diffs+=$'\n'"#### Deleted: \`${target}\`"$'\n'
    elif ! diff -q "${baseline_path}" "${current_path}" > /dev/null 2>&1; then
      modified=$((modified + 1))
      udiff=$(diff -u "${baseline_path}" "${current_path}" 2>/dev/null || true)
      lines_added=$(echo "${udiff}" | grep -c '^+[^+]' || true)
      lines_removed=$(echo "${udiff}" | grep -c '^-[^-]' || true)
      total_lines_added=$((total_lines_added + lines_added))
      total_lines_removed=$((total_lines_removed + lines_removed))

      cat_diffs+=$'\n'"#### Modified: \`${target}\` (+${lines_added}/-${lines_removed})"$'\n\n'
      cat_diffs+='```diff'$'\n'"${udiff}"$'\n''```'$'\n'
    else
      unchanged=$((unchanged + 1))
    fi
  fi

  total_added=$((total_added + added))
  total_modified=$((total_modified + modified))
  total_deleted=$((total_deleted + deleted))
  total_unchanged=$((total_unchanged + unchanged))

  category_summaries+="| ${label} | ${added} | ${modified} | ${deleted} | ${unchanged} |"$'\n'

  if [[ -n "${cat_diffs}" ]]; then
    category_diffs+=$'\n'"### ${label}"$'\n'"${cat_diffs}"
  fi
done

total_files=$((total_added + total_modified + total_deleted + total_unchanged))

mkdir -p "$(dirname "${OUTPUT_PATH}")"

cat > "${OUTPUT_PATH}" << REPORT_HEADER
# Context Optimization Diff Report

**Baseline**: ${BASELINE_LABEL} (${baseline_timestamp}, git: ${baseline_sha})
**Current**: $(date -u +%Y-%m-%dT%H:%M:%SZ) (git: ${current_sha})

## Summary

| Metric | Count |
| ------ | ----- |
| Files added | ${total_added} |
| Files modified | ${total_modified} |
| Files deleted | ${total_deleted} |
| Files unchanged | ${total_unchanged} |
| **Total files compared** | **${total_files}** |
| Lines added | +${total_lines_added} |
| Lines removed | -${total_lines_removed} |
| **Net line change** | **$((total_lines_added - total_lines_removed))** |

## By Category

| Category | Added | Modified | Deleted | Unchanged |
| -------- | ----- | -------- | ------- | --------- |
${category_summaries}
REPORT_HEADER

if [[ -n "${category_diffs}" ]]; then
  cat >> "${OUTPUT_PATH}" << DIFF_HEADER

## Detailed Changes
${category_diffs}
DIFF_HEADER
else
  echo $'\n'"## Detailed Changes"$'\n\n'"No changes detected." >> "${OUTPUT_PATH}"
fi

echo ""
echo "Diff report generated"
echo "  Baseline:     ${BASELINE_LABEL}"
echo "  Output:       ${OUTPUT_PATH}"
echo "  Added:        ${total_added} files (+${total_lines_added} lines)"
echo "  Modified:     ${total_modified} files"
echo "  Deleted:      ${total_deleted} files (-${total_lines_removed} lines)"
echo "  Unchanged:    ${total_unchanged} files"
echo "  Net change:   $((total_lines_added - total_lines_removed)) lines"
