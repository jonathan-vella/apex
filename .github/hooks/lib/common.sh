#!/usr/bin/env bash
# Shared helpers for APEX Copilot agent hooks.
#
# This file is SOURCED (not executed) by the hook scripts in sibling
# directories. It centralizes the idioms used across hooks: ISO timestamps, the
# standard "continue" response, JSON string escaping, size-bounded JSONL logging,
# and allowlist parsing. It is currently sourced by tool-guardian; keep it as the
# home for these helpers so future hooks can reuse them.
#
# JSON runtime policy: hooks standardize on `python3` for parsing/encoding
# stdin payloads (it is already a hard dependency of several hooks and is
# guaranteed in the dev container). This sed-based escaper exists only for the
# zero-subprocess hot paths where a finding string is interpolated into a
# printf-built JSON line.
#
# Callers own `set -euo pipefail`; this file intentionally does not set shell
# options so it does not surprise the sourcing script.

# ISO-8601 UTC timestamp, e.g. 2026-06-10T07:00:00Z
hook_timestamp() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

# Emit the standard non-blocking hook response on stdout.
hook_emit_continue() {
  printf '{"continue": true}\n'
}

# Escape a string for safe embedding inside a JSON string literal
# (backslash, double-quote, and tab). Pure sed — no subprocess fork of an
# interpreter — so it is safe to call inside hot-path loops.
hook_json_escape() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e "s/$(printf '\t')/\\\\t/g"
}

# Append a single line to a log file, creating the parent directory as needed.
# The log is size-bounded: when it would exceed HOOK_LOG_MAX_BYTES (default
# 1 MiB) it is rotated to "<file>.1" (one generation kept) before the new line
# is written, so session logs cannot grow without bound.
# Usage: hook_log <log_file> <line>
hook_log() {
  local file="$1" line="$2"
  mkdir -p "$(dirname "$file")"
  local max="${HOOK_LOG_MAX_BYTES:-1048576}"
  # Guard against a non-integer override: an invalid value would make the
  # arithmetic comparison below error and, under the caller's `set -e`, could
  # abort the whole hook. Fall back to the default when not a plain integer.
  [[ "$max" =~ ^[0-9]+$ ]] || max=1048576
  if [[ -f "$file" ]]; then
    local size
    size=$(stat -c %s "$file" 2>/dev/null || wc -c < "$file" 2>/dev/null || echo 0)
    if [[ "${size:-0}" -ge "$max" ]]; then
      mv -f "$file" "$file.1" 2>/dev/null || : > "$file"
    fi
  fi
  printf '%s\n' "$line" >> "$file"
}

# Allowlist support. hook_parse_allowlist populates the HOOK_ALLOWLIST array
# from a comma-separated env value (whitespace around entries is trimmed).
# hook_is_allowlisted returns 0 if its argument contains any allowlisted
# substring.
HOOK_ALLOWLIST=()

hook_parse_allowlist() {
  HOOK_ALLOWLIST=()
  [[ -n "${1:-}" ]] || return 0
  local raw entry
  IFS=',' read -ra raw <<< "$1"
  for entry in "${raw[@]}"; do
    entry=$(printf '%s' "$entry" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    [[ -n "$entry" ]] && HOOK_ALLOWLIST+=("$entry")
  done
}

hook_is_allowlisted() {
  local text="$1" pattern
  for pattern in "${HOOK_ALLOWLIST[@]:-}"; do
    [[ -z "$pattern" ]] && continue
    [[ "$text" == *"$pattern"* ]] && return 0
  done
  return 1
}
