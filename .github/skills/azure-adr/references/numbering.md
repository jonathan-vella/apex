# ADR Numbering Conventions

## File Naming Pattern

`{phase}-adr-NNNN-{title-slug}.md`

### Components

| Component | Format | Example |
|-----------|--------|---------|
| Phase | `03-des` or `07-ab` | `03-des` |
| Prefix | `adr` | `adr` |
| Number | 4-digit padded | `0001` |
| Title Slug | lowercase-hyphenated | `database-selection` |

### Examples

- `03-des-adr-0001-database-selection.md`
- `03-des-adr-0002-authentication-strategy.md`
- `07-ab-adr-0001-final-architecture.md`

## Phase Prefixes

| Prefix | Phase | When to Use |
|--------|-------|-------------|
| `03-des-` | Design | ADRs created during architecture design (Step 3) |
| `07-ab-` | As-Built | ADRs documenting final implementation (Step 7) |

## Numbering Rules

1. **Sequential within project**: Each project starts at 0001
2. **No gaps**: Don't skip numbers even if ADRs are rejected
3. **Phase-independent**: Design and as-built ADRs share the same sequence
4. **Never reuse**: Once assigned, never reuse an ADR number

## Finding Next Number

```bash
# Count existing ADRs in project
ls agent-output/{project}/*-adr-*.md 2>/dev/null | wc -l

# List existing ADR numbers
ls agent-output/{project}/*-adr-*.md 2>/dev/null | grep -oP 'adr-\K\d{4}'
```

## Superseding ADRs

When one ADR replaces another:

1. Keep original ADR with status "Superseded"
2. Add `superseded_by: "ADR-NNNN"` to original front matter
3. Add `supersedes: "ADR-XXXX"` to new ADR front matter
4. New ADR gets next sequential number (not the superseded number)
