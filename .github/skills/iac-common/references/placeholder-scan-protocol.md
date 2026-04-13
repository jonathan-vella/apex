<!-- ref:placeholder-scan-protocol-v1 -->

# Placeholder Scan Protocol

Before running preview/what-if or plan, scan param files for unresolved placeholders:

```bash
grep -n "<replace-with-\|<your-\|<TODO\|PLACEHOLDER" {param-files} 2>/dev/null || true
```

If any placeholders are found:

1. Do not proceed to preview or plan
2. Use `askQuestions` to collect every missing value in a single form
   (one question per placeholder with clear header and description)
3. After the user supplies all values, update the param file(s)
4. Re-run the scan to confirm no placeholders remain

Gate: never pass a param file with literal placeholder strings to preview or apply.
