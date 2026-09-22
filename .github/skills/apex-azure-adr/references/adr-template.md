<!-- ref:adr-template-v1 -->

# ADR Template Structure

Full template for Azure Architecture Decision Records. Copy and fill in when creating ADRs.

```markdown
# ADR-{NNNN}: {Decision Title}

![Step](https://img.shields.io/badge/Step-3-blue?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Proposed-orange?style=for-the-badge)
![Type](https://img.shields.io/badge/Type-ADR-purple?style=for-the-badge)

<details open>
<summary><strong>📑 Decision Contents</strong></summary>

- [🔍 Context](#-context)
- [✅ Decision](#-decision)
- [🔄 Alternatives Considered](#-alternatives-considered)
- [⚖️ Consequences](#%EF%B8%8F-consequences)
- [🏛️ WAF Pillar Analysis](#%EF%B8%8F-waf-pillar-analysis)
- [🔒 Compliance Considerations](#-compliance-considerations)
- [📝 Implementation Notes](#-implementation-notes)

</details>

> Status: Proposed | Accepted | Deprecated | Superseded
> Date: {YYYY-MM-DD}
> Deciders: {team/person}

## 🔍 Context

What is the issue that we're seeing that is motivating this decision or change?

## ✅ Decision

What is the change that we're proposing and/or doing?

## 🔄 Alternatives Considered

| Option   | Pros | Cons | WAF Impact                     |
| -------- | ---- | ---- | ------------------------------ |
| Option A | ...  | ...  | Security: +, Cost: -           |
| Option B | ...  | ...  | Reliability: +, Performance: + |

## ⚖️ Consequences

### Positive

- List of positive outcomes

### Negative

- List of trade-offs or risks

### Neutral

- List of neutral observations

## 🏛️ WAF Pillar Analysis

| Pillar      | Impact | Notes |
| ----------- | ------ | ----- |
| Security    | ↑/↓/→  | ...   |
| Reliability | ↑/↓/→  | ...   |
| Performance | ↑/↓/→  | ...   |
| Cost        | ↑/↓/→  | ...   |
| Operations  | ↑/↓/→  | ...   |

## 🔒 Compliance Considerations

- List any regulatory or compliance implications

## 📝 Implementation Notes

- Key implementation details or constraints

---

<div align="center">

| ⬅️ [Previous ADR](.) | 🏠 [Project Index](README.md) | ➡️ [Next ADR](.) |
| -------------------- | ----------------------------- | ---------------- |

</div>
```
