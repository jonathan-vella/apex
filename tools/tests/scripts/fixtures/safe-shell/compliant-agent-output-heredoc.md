# Compliant: writes to agent-output happen via the file-editing tool, not shell

```bash
# Read-only inspection is fine
ls agent-output/my-project/
cat agent-output/my-project/04-implementation-plan.md | wc -l
```

# Compliant: redirects to /tmp are fine

```bash
my-cmd > /tmp/my-cmd.out 2>&1
echo "wrote /tmp/my-cmd.out"
```

# Compliant: heredoc to /tmp (not agent-output) is allowed by this rule

```bash
cat <<'EOF' > /tmp/sample.json
{"hello": "world"}
EOF
```
