#!/usr/bin/env bash
# Tool Guardian Hook
# Blocks dangerous tool operations (destructive file ops, force pushes, DB drops,
# etc.) before the Copilot coding agent executes them.
# Adapted from: https://github.com/github/awesome-copilot/tree/main/hooks/tool-guardian
#
# Environment variables:
#   GUARD_MODE           - "warn" (log only) or "block" (exit non-zero on threats) (default: block)
#   SKIP_TOOL_GUARD      - "true" to disable entirely (default: unset)
#   TOOL_GUARD_LOG_DIR   - Directory for guard logs (default: logs/copilot/tool-guardian)
#   TOOL_GUARD_ALLOWLIST - Comma-separated patterns to skip (default: unset)

set -euo pipefail

# Early exit if disabled
if [[ "${SKIP_TOOL_GUARD:-}" == "true" ]]; then
  exit 0
fi

# shellcheck source=../lib/common.sh
source "$(dirname "${BASH_SOURCE[0]}")/../lib/common.sh"

INPUT=$(cat)

MODE="${GUARD_MODE:-block}"
LOG_DIR="${TOOL_GUARD_LOG_DIR:-logs/copilot/tool-guardian}"
LOG_FILE="$LOG_DIR/guard.log"
TIMESTAMP=$(hook_timestamp)

# ---------------------------------------------------------------------------
# Extract tool name, file path, and a single-line scannable input string in one
# python3 pass (replaces the previous jq + grep/sed fallback chain). The program
# is supplied on fd 3 so the JSON payload can be piped in on stdin.
# ---------------------------------------------------------------------------
EXTRACT=$(printf '%s' "$INPUT" | python3 /dev/fd/3 3<<'PY'
import json
import sys

try:
    data = json.load(sys.stdin)
    if not isinstance(data, dict):
        data = {}
except Exception:
    data = {}

# VS Code sends snake_case (tool_name, tool_input); older clients used camelCase.
ti = data.get("tool_input", data.get("toolInput"))
name = data.get("tool_name") or data.get("toolName") or ""

file_path = ""
if isinstance(ti, dict):
    file_path = ti.get("filePath") or ti.get("path") or ""

if isinstance(ti, (dict, list)):
    ti_str = json.dumps(ti, separators=(",", ":"))
elif ti is None:
    ti_str = ""
else:
    ti_str = str(ti)

# Collapse tabs/newlines so the value survives the line-oriented grep scan, and
# strip the field separator so it cannot corrupt the delimited handoff.
for ch in ("\t", "\n", "\r", "\x1f"):
    ti_str = ti_str.replace(ch, " ")

# Use the unit separator (0x1f) between fields: unlike tab/space it is not an
# IFS-whitespace character, so empty fields (e.g. no filePath) are preserved by
# the bash `read` below instead of being collapsed.
sys.stdout.write(name + "\x1f" + file_path + "\x1f" + ti_str)
PY
) || true

TOOL_NAME=""
FILE_PATH=""
TOOL_INPUT=""
IFS=$'\x1f' read -r TOOL_NAME FILE_PATH TOOL_INPUT <<< "$EXTRACT"

# ---------------------------------------------------------------------------
# Self-modification protection: block edits to hook scripts
# ---------------------------------------------------------------------------
case "$TOOL_NAME" in
  replace_string_in_file|multi_replace_string_in_file|create_file|editFiles)
    if [[ -n "$FILE_PATH" ]]; then
      RESOLVED=$(realpath "$FILE_PATH" 2>/dev/null || echo "$FILE_PATH")
      if [[ "$RESOLVED" == *".github/hooks"* ]]; then
        hook_log "$LOG_FILE" "{\"timestamp\":\"$TIMESTAMP\",\"event\":\"self_mod_blocked\",\"tool\":\"$(hook_json_escape "$TOOL_NAME")\",\"file\":\"$(hook_json_escape "$FILE_PATH")\"}"
        echo '{"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": "BLOCKED: hook self-modification prevented. Files under .github/hooks/ cannot be edited by agents."}}'
        exit 0
      fi
    fi
    hook_emit_continue
    exit 0
    ;;
esac

# ---------------------------------------------------------------------------
# Allowlist: skip all scanning when the combined text matches an allowed pattern
# ---------------------------------------------------------------------------
COMBINED="${TOOL_NAME} ${TOOL_INPUT}"

hook_parse_allowlist "${TOOL_GUARD_ALLOWLIST:-}"
if [[ ${#HOOK_ALLOWLIST[@]} -gt 0 ]] && hook_is_allowlisted "$COMBINED"; then
  hook_log "$LOG_FILE" "{\"timestamp\":\"$TIMESTAMP\",\"event\":\"guard_skipped\",\"reason\":\"allowlisted\",\"tool\":\"$(hook_json_escape "$TOOL_NAME")\"}"
  hook_emit_continue
  exit 0
fi

# ---------------------------------------------------------------------------
# Fast skip for read-only tools that cannot carry shell/SQL/infra payloads.
# Editing tools are already handled by the self-modification case above, so the
# threat scan only needs to run for command-executing and unknown tools.
# ---------------------------------------------------------------------------
case "$TOOL_NAME" in
  read_file|semantic_search|list_dir|file_search|grep_search|get_errors|\
  list_code_usages|test_search|read_notebook_cell_output|get_changed_files|\
  fetch_webpage|github_repo|vscode_searchExtensions_internal)
    hook_log "$LOG_FILE" "{\"timestamp\":\"$TIMESTAMP\",\"event\":\"guard_passed\",\"mode\":\"$MODE\",\"tool\":\"$(hook_json_escape "$TOOL_NAME")\"}"
    hook_emit_continue
    exit 0
    ;;
esac

# ---------------------------------------------------------------------------
# Threat patterns (6 categories, ~20 patterns)
#
# Each entry: "CATEGORY:::SEVERITY:::REGEX:::SUGGESTION"
# Uses ::: as delimiter to avoid conflicts with regex pipe characters
# ---------------------------------------------------------------------------
PATTERNS=(
  # Destructive file operations.
  # The path targets are anchored to a path boundary (end-of-string, whitespace,
  # or a bare trailing slash) so a catastrophic whole-target delete is blocked
  # while a scoped subpath like `rm -rf ./dist` or `rm -rf ~/project/build` is
  # allowed through.
  "destructive_file_ops:::critical:::rm -rf /([[:space:]]|$|\*):::Use targeted 'rm' on specific paths instead of root"
  "destructive_file_ops:::critical:::rm -rf ~(/?([[:space:]]|$)):::Use targeted 'rm' on specific paths instead of home directory"
  "destructive_file_ops:::critical:::rm -rf \.(/?([[:space:]]|$)):::Use targeted 'rm' on a specific subpath instead of the current directory"
  "destructive_file_ops:::critical:::rm -rf \.\.(/?([[:space:]]|$)):::Never remove parent directories recursively"
  "destructive_file_ops:::critical:::(rm|del|unlink).*\.env:::Use 'mv' to back up .env files before removing"
  "destructive_file_ops:::critical:::(rm|del|unlink).*\.git[^i]:::Never delete .git directory — use 'git' commands to manage repo state"

  # Destructive git operations
  "destructive_git_ops:::critical:::git push --force.*(main|master):::Use 'git push --force-with-lease' or push to a feature branch"
  "destructive_git_ops:::critical:::git push -f.*(main|master):::Use 'git push --force-with-lease' or push to a feature branch"
  "destructive_git_ops:::high:::git reset --hard:::Use 'git stash' to preserve changes, or 'git reset --soft'"
  "destructive_git_ops:::high:::git clean -fd:::Use 'git clean -n' (dry run) first to preview what will be deleted"

  # Database destruction. SQL keywords are scoped to their destructive forms so
  # the `truncate` coreutil (e.g. `truncate -s 0 file`) is not mistaken for the
  # `TRUNCATE TABLE` statement.
  "database_destruction:::critical:::DROP TABLE:::Use 'ALTER TABLE' or create a migration with rollback support"
  "database_destruction:::critical:::DROP DATABASE:::Create a backup first; consider revoking DROP privileges"
  "database_destruction:::critical:::TRUNCATE[[:space:]]+TABLE:::Use 'DELETE FROM ... WHERE' with a condition for safer data removal"
  "database_destruction:::high:::DELETE FROM [a-zA-Z_]+ *;:::Add a WHERE clause to 'DELETE FROM' to avoid deleting all rows"

  # Permission abuse
  "permission_abuse:::high:::chmod 777:::Use 'chmod 755' for directories or 'chmod 644' for files"
  "permission_abuse:::high:::chmod -R 777:::Use specific permissions ('chmod -R 755') and limit scope"

  # Network exfiltration
  "network_exfiltration:::critical:::curl.*\|.*bash:::Download the script first, review it, then execute"
  "network_exfiltration:::critical:::wget.*\|.*sh:::Download the script first, review it, then execute"
  "network_exfiltration:::high:::curl.*--data.*@:::Review what data is being sent before using 'curl --data @file'"

  # System danger.
  # NOTE: a bare `sudo` pattern was intentionally removed — `sudo apt-get`/etc.
  # are routine in the dev container, and the genuinely dangerous combinations
  # (e.g. `sudo rm -rf /`) are already caught by the destructive_file_ops rules.
  "system_danger:::high:::npm publish:::Use 'npm publish --dry-run' first to verify package contents"

  # Infrastructure destruction (project-specific)
  "infra_destruction:::critical:::terraform destroy:::Use 'terraform plan -destroy' to preview first"
  "infra_destruction:::critical:::terraform apply.*-auto-approve:::Remove '-auto-approve' and review the plan"
  "infra_destruction:::critical:::az group delete:::Use 'az group delete --no-wait' with confirmation, or use the portal"
  "infra_destruction:::critical:::az deployment sub delete:::Review deployment resources before deleting"
  "infra_destruction:::high:::mkfs\.:::Formatting disks is destructive — verify the target device"
  "infra_destruction:::high:::dd if=:::Verify source and destination before using 'dd'"

  # Bypass safety
  "bypass_safety:::high:::--no-verify:::Do not bypass git hooks or verification checks"
)

# ---------------------------------------------------------------------------
# Fast path: a single combined-alternation grep decides whether ANY pattern
# could match. Only a definite no-match (grep rc 1) takes the clean exit; a
# match (rc 0) or a grep error (rc > 1) falls through to the detailed, per-
# pattern categorization loop. This turns the common (safe) case into one grep
# instead of ~25.
# ---------------------------------------------------------------------------
COMBINED_RE=""
for entry in "${PATTERNS[@]}"; do
  rest="${entry#*:::}"
  regex="${rest#*:::}"
  regex="${regex%%:::*}"
  COMBINED_RE+="${COMBINED_RE:+|}(${regex})"
done

MATCH_RC=0
printf '%s\n' "$COMBINED" | grep -qiE -- "$COMBINED_RE" 2>/dev/null || MATCH_RC=$?

if [[ "$MATCH_RC" -eq 1 ]]; then
  hook_log "$LOG_FILE" "{\"timestamp\":\"$TIMESTAMP\",\"event\":\"guard_passed\",\"mode\":\"$MODE\",\"tool\":\"$(hook_json_escape "$TOOL_NAME")\"}"
  hook_emit_continue
  exit 0
fi

# ---------------------------------------------------------------------------
# Detailed scan: categorize each matching pattern
# ---------------------------------------------------------------------------
THREATS=()
THREAT_COUNT=0

for entry in "${PATTERNS[@]}"; do
  category="${entry%%:::*}"
  rest="${entry#*:::}"
  severity="${rest%%:::*}"
  rest="${rest#*:::}"
  regex="${rest%%:::*}"
  suggestion="${rest#*:::}"

  if printf '%s\n' "$COMBINED" | grep -qiE -- "$regex" 2>/dev/null; then
    local_match=$(printf '%s\n' "$COMBINED" | grep -oiE -- "$regex" 2>/dev/null | head -1)
    THREATS+=("${category}	${severity}	${local_match}	${suggestion}")
    THREAT_COUNT=$((THREAT_COUNT + 1))
  fi
done

# A combined-regex match with no per-pattern match (rare regex-engine edge) is
# treated as clean rather than fabricating a finding.
if [[ $THREAT_COUNT -eq 0 ]]; then
  hook_log "$LOG_FILE" "{\"timestamp\":\"$TIMESTAMP\",\"event\":\"guard_passed\",\"mode\":\"$MODE\",\"tool\":\"$(hook_json_escape "$TOOL_NAME")\"}"
  hook_emit_continue
  exit 0
fi

# ---------------------------------------------------------------------------
# Output and logging
# ---------------------------------------------------------------------------
echo ""
echo "🛡️  Tool Guardian: $THREAT_COUNT threat(s) detected in '$TOOL_NAME' invocation"
echo ""
printf "  %-24s %-10s %-40s %s\n" "CATEGORY" "SEVERITY" "MATCH" "SUGGESTION"
printf "  %-24s %-10s %-40s %s\n" "--------" "--------" "-----" "----------"

# Build JSON findings array
FINDINGS_JSON="["
FIRST=true
for threat in "${THREATS[@]}"; do
  IFS=$'\t' read -r category severity match suggestion <<< "$threat"

  # Truncate match for display
  display_match="$match"
  if [[ ${#match} -gt 38 ]]; then
    display_match="${match:0:35}..."
  fi
  printf "  %-24s %-10s %-40s %s\n" "$category" "$severity" "$display_match" "$suggestion"

  if [[ "$FIRST" != "true" ]]; then
    FINDINGS_JSON+=","
  fi
  FIRST=false
  FINDINGS_JSON+="{\"category\":\"$(hook_json_escape "$category")\",\"severity\":\"$(hook_json_escape "$severity")\",\"match\":\"$(hook_json_escape "$match")\",\"suggestion\":\"$(hook_json_escape "$suggestion")\"}"
done
FINDINGS_JSON+="]"

echo ""

# Write structured log entry
hook_log "$LOG_FILE" "{\"timestamp\":\"$TIMESTAMP\",\"event\":\"threats_detected\",\"mode\":\"$MODE\",\"tool\":\"$(hook_json_escape "$TOOL_NAME")\",\"threat_count\":$THREAT_COUNT,\"threats\":$FINDINGS_JSON}"

if [[ "$MODE" == "block" ]]; then
  echo "🚫 Operation blocked: resolve the threats above or adjust TOOL_GUARD_ALLOWLIST."
  echo "   Set GUARD_MODE=warn to log without blocking."

  # Build a human-readable summary for `permissionDecisionReason` so VS Code
  # surfaces *why* the call was blocked. Empty `status.message` on PreToolUse
  # spans is what made hook errors in the May 2026 nordic-foods debug log
  # unattributable; emitting structured JSON here is the fix.
  REASONS=""
  for threat in "${THREATS[@]}"; do
    IFS=$'\t' read -r category severity match suggestion <<< "$threat"
    if [[ -n "$REASONS" ]]; then
      REASONS+=" | "
    fi
    REASONS+="[${severity}] ${category}: \"${match}\" — ${suggestion}"
  done
  REASON_MSG="tool-guardian blocked ${TOOL_NAME} (${THREAT_COUNT} threat(s)): ${REASONS}. Set GUARD_MODE=warn to log without blocking, or add a pattern to TOOL_GUARD_ALLOWLIST."

  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"%s","threatCount":%d,"threats":%s,"hook":"tool-guardian"}}\n' \
    "$(hook_json_escape "$REASON_MSG")" "$THREAT_COUNT" "$FINDINGS_JSON"
  exit 0
else
  echo "⚠️  Threats logged in warn mode. Set GUARD_MODE=block to prevent dangerous operations."
  # warn mode allows execution — still emit the standard allow response so the
  # hook always returns valid JSON on stdout.
  hook_emit_continue
fi

exit 0
