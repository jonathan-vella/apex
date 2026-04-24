#!/usr/bin/env bats
# lefthook-config.bats — Structural tests for lefthook.yml

load setup

@test "no post-commit block exists" {
  ! grep -q '^post-commit:' "$REPO_ROOT/lefthook.yml"
}

@test "pre-commit parallel is true" {
  grep -q 'parallel: true' "$REPO_ROOT/lefthook.yml"
}

@test "all referenced npm scripts exist in package.json" {
  local scripts
  scripts=$(grep -oP 'npm run \K[a-z0-9:_-]+' "$REPO_ROOT/lefthook.yml" | sort -u)
  local missing=0
  for script in $scripts; do
    if ! grep -q "\"$script\"" "$REPO_ROOT/package.json"; then
      echo "Missing npm script: $script"
      missing=$((missing + 1))
    fi
  done
  [ "$missing" -eq 0 ]
}
