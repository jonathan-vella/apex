#!/usr/bin/env bats
# lefthook-config.bats — Structural tests for lefthook.yml

load setup

@test "post-commit block contains only the allow-listed stamp-sku-manifest hook" {
  # post-commit hooks are normally rejected to keep the commit path
  # blocking-free. The only sanctioned exception is the
  # stamp-sku-manifest hook from the SKU Manifest workflow, which
  # writes commit_sha onto sku-manifest.json revisions and is
  # explicitly best-effort (cannot block a commit).
  if grep -q '^post-commit:' "$REPO_ROOT/lefthook.yml"; then
    # Extract the post-commit block (from "^post-commit:" until next top-level key or EOF).
    local block
    block=$(awk '/^post-commit:/{f=1; next} /^[a-z][a-z-]*:/{f=0} f' "$REPO_ROOT/lefthook.yml")
    # Allow only stamp-sku-manifest as a command name under post-commit.
    local extra
    extra=$(echo "$block" | grep -E '^    [a-z][a-z0-9_-]*:' | grep -v '^    stamp-sku-manifest:' || true)
    if [ -n "$extra" ]; then
      echo "Unexpected post-commit hooks (only stamp-sku-manifest is allow-listed):"
      echo "$extra"
      false
    fi
  fi
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
