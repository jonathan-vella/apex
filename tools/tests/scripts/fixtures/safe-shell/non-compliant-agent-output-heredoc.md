# Non-compliant: heredoc with quoted delimiter writing to agent-output

```bash
cat <<'EOF' > agent-output/my-project/06-policy-precheck.json
{"deploy_gate": "PROCEED"}
EOF
```

# Non-compliant: indented heredoc with unquoted delimiter

```bash
cat <<-EOF > agent-output/my-project/notes.md
hello
EOF
```

# Non-compliant: tee write to agent-output

```bash
echo "hello" | tee agent-output/my-project/notes.txt
```

# Non-compliant: append redirect to agent-output

```bash
echo "more" >> agent-output/my-project/log.txt
```
