# Compliant: rg guarded by command -v

```bash
if command -v rg >/dev/null 2>&1; then
  rg "pattern" file.md
else
  grep -R "pattern" .
fi
```

# Compliant: no portability tool used — pure stdlib

```bash
grep -R "pattern" .
find . -name "*.md"
python -m json.tool file.json
```

# Compliant: guard appears AFTER the invocation in the same fence

```bash
# This fence is OK because the guard exists below.
rg "pattern" file.md  # author asserts presence below
command -v rg >/dev/null
```
