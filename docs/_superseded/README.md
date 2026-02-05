# Superseded Documentation

> **⚠️ ARCHIVED CONTENT - NOT ACTIVELY MAINTAINED**

This folder contains documentation that has been superseded by content in the active `docs/` folders.
Files are preserved for historical reference and to maintain git history.

---

## Purpose

When documentation is reorganized, consolidated, or becomes out-of-scope for the current project direction,
files are moved here rather than deleted. This approach:

- Preserves git history for all documentation
- Allows recovery if content becomes relevant again
- Provides historical context for architectural decisions

---

## Contents

| Folder             | Description                     | Status                                 |
| ------------------ | ------------------------------- | -------------------------------------- |
| `adr/`             | Architecture Decision Records   | Historical reference                   |
| `diagrams/`        | Generated architecture diagrams | Replaced by agent-output/{project}/    |
| `getting-started/` | Legacy getting-started guides   | Replaced by docs/quickstart.md         |
| `reference/`       | Legacy reference docs           | Replaced by docs/workflow.md           |

> **Cleaned up Feb 2026**: Removed `guides/`, `presenter/`, `v7-*` folders.
> Valuable content consolidated into `docs/dev-containers.md` and `docs/copilot-tips.md`.

---

## Guidelines

1. **Do not edit files in this folder** — they are historical snapshots
2. **Do not add new files here** — use active `docs/` folders
3. **Reference with caution** — links may point to outdated resources
4. **Version strings are frozen** — they reflect the version when archived

---

**Archived**: 2026-01-21 | **Version at archive**: 5.3.0
