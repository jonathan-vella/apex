# Non-compliant: bare rg with no guard

```bash
rg "pattern" file.md
```

# Non-compliant: bare fd in a pipeline

```bash
fd -e md . | head -5
```

# Non-compliant: bare bat after &&

```bash
echo hi && bat README.md
```
