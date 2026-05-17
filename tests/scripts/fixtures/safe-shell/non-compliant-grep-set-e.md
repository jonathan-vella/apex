# Fixture: non-compliant grep usage inside `set -e` bash block

The grep below has no `|| true` / `|| echo` fallback and is not piped,
so `set -e` will abort on a no-match exit code. The linter MUST flag
the bare grep on line 11.

```bash
set -e
grep -n 'pattern' file.md
echo "this line never runs on no-match"
```
