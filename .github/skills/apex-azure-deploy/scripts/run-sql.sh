#!/usr/bin/env bash
# Execute reviewed SQL with Go sqlcmd and explicit target-bound authorization.
set -euo pipefail

if [[ "${1:-}" == "--help" ]]; then
  printf '%s\n' 'Usage: run-sql.sh <reviewed.sql>' 'Requires SQL_SERVER_FQDN, SQL_DATABASE, SQL_APPROVED_TARGET, SQL_APPROVED_SHA256.'
  exit 0
fi
[[ $# == 1 && -f "$1" ]] || { printf '%s\n' 'A reviewed SQL file is required.' >&2; exit 2; }
: "${SQL_SERVER_FQDN:?Approved SQL server FQDN is required}"
: "${SQL_DATABASE:?Approved SQL database is required}"
[[ "${SQL_APPROVED_TARGET:-}" == "${SQL_SERVER_FQDN}/${SQL_DATABASE}" ]] || {
  printf '%s\n' 'SQL target approval is missing or stale.' >&2; exit 2;
}
actual_hash=$(sha256sum -- "$1")
actual_hash=${actual_hash%% *}
[[ "${SQL_APPROVED_SHA256:-}" == "$actual_hash" ]] || {
  printf '%s\n' 'SQL file approval is missing or stale.' >&2; exit 2;
}
command -v sqlcmd >/dev/null || { printf '%s\n' 'Go sqlcmd is unavailable; SQL execution is unverified.' >&2; exit 127; }
sqlcmd -S "tcp:${SQL_SERVER_FQDN},1433" -d "$SQL_DATABASE" \
  --authentication-method ActiveDirectoryDefault -b -i "$1"
