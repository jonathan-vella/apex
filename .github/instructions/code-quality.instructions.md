---
description: "Code quality guidelines: commenting best practices (WHY not WHAT) and review priorities with security checks"
applyTo: "**/*.{js,mjs,cjs,ts,tsx,jsx,py,ps1,sh,bicep,tf}"
---

# Code Quality Instructions

## Language-Specific Precedence

Language-specific instruction files take precedence over these general
guidelines. In particular:

- **PowerShell** (`powershell.instructions.md`): always include
  comment-based help (`.SYNOPSIS`, `.DESCRIPTION`, `.EXAMPLE`).
- **Bicep** (`iac-bicep-best-practices.instructions.md`): always use
  `@description` annotations on parameters, variables, and outputs.
- **Shell** (`shell.instructions.md`): include a header comment
  explaining the script's purpose.

These requirements are additive — public-facing APIs and parameters
must be documented per their language rules, while internal code
follows the minimal-comment philosophy below.

---

## Commenting: Core Principle

**Write code that speaks for itself. Comment only when necessary to explain WHY, not WHAT.**

### AVOID These Comments

- **Obvious**: `let counter = 0; // Initialize counter to zero`
- **Redundant**: comment repeats what the code already says
- **Outdated**: comment doesn't match the code

### WRITE These Comments

- **Complex business logic**: explains WHY a specific calculation
- **Non-obvious algorithms**: explains the algorithm choice
- **Regex patterns**: explains what the regex matches
- **API constraints or gotchas**: explains external limitations

### Decision Framework

1. **Is the code self-explanatory?** → No comment needed
2. **Would a better name eliminate the need?** → Refactor instead
3. **Does this explain WHY, not WHAT?** → Good comment
4. **Will this help future maintainers?** → Good comment

### Annotations

Use standard annotation tags: `TODO`, `FIXME`, `HACK`, `NOTE`,
`WARNING`, `PERF`, `SECURITY`, `BUG`, `REFACTOR`, `DEPRECATED`.

### Anti-Patterns

- Dead code left as comments — delete it (Git has history)
- Journal comments tracking changes — use Git log
- Closing brace comments — refactor into smaller functions
- Commented-out code blocks — delete or explain why kept

---

## Code Review Priorities

**🔴 CRITICAL** (Block merge): Security vulns, logic errors, breaking changes, data loss

**🟡 IMPORTANT** (Discuss): SOLID violations, missing tests, perf bottlenecks, architecture drift

**🟢 SUGGESTION** (Non-blocking): Readability, optimization, best practices, documentation

### General Review Principles

1. Be specific — reference exact lines with concrete examples
2. Explain WHY + potential impact
3. Suggest solutions, not just problems
4. Be constructive and pragmatic
5. Group related comments; recognize good practices

### Security Review Checklist

- **Sensitive Data**: No passwords, API keys, tokens, or PII in code or logs
- **Input Validation**: All user inputs are validated and sanitized
- **SQL Injection**: Use parameterized queries, never string concatenation
- **Authentication**: Proper checks before accessing resources
- **Authorization**: Verify user has permission to perform action
- **Cryptography**: Use established libraries, never roll your own
- **Dependency Security**: Check for known vulnerabilities

### Comment Format Template

```markdown
**[PRIORITY] Category: Brief title**

Description. **Why this matters**: impact explanation.
**Suggested fix**: code example if applicable.
```

### Project Context

- **IaC**: Azure Bicep (AVM-first), Terraform
- **Scripts**: PowerShell 7+, Node.js (`.mjs`), bash, Python 3.10+
- **Build**: `npm run lint:md`, `npm run validate:all`
- **Style**: Conventional Commits, 120-char lines, TLS 1.2+, managed identity

### Reference

Detailed checklists: `.github/instructions/references/code-review-checklists.md`
