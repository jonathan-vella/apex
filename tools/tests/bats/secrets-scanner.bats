#!/usr/bin/env bats
# secrets-scanner.bats — Tests for scan-secrets.sh

load setup

HOOK="$HOOKS_DIR/secrets-scanner/scan-secrets.sh"

@test "scan with no modified files exits 0" {
  run bash "$HOOK" <<< '{}'
  [ "$status" -eq 0 ]
}
