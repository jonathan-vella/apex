# Fixture: compliant grep usage inside `set -e` bash block

The grep below has a `|| echo` fallback, so the no-match exit-1 will not
abort the batch. The linter MUST NOT flag this snippet.

```bash
set -e
grep -n 'pattern' file.md || echo "No matches"
grep -c foo bar.txt | head -1
grep -E 'pat' src.log || true
```
