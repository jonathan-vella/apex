# Visual Elements Guide

> Version: see [VERSION.md](../../VERSION.md) | [Back to Presenter Hub](README.md)

Use this guide to keep diagrams and visuals consistent across slides, demos, and customer artifacts.

---

## What You Get

- A simple standard for using architecture diagrams in decks.
- Guidance on when to regenerate diagrams vs reusing existing evidence.
- Practical defaults that work for IT Pro audiences.

---

## Canonical Sources

- Diagram generation: [S07 Diagrams as Code](../../scenarios/S07-diagrams-as-code/)
- Workload evidence (time-stamped): `agent-output/{project}/` artifacts

---

## Diagram Usage Standards

- Prefer diagrams that match the story you are telling:
  - Design intent: use `03-des-*` artifacts.
  - As-built reality: use `07-ab-*` artifacts.
- Keep the diagram label vocabulary consistent:
  - WAF, AVM, CAF, MCP
  - "agent-output artifacts" and "guardrails"
- Use outcome-first captions:
  - "What this diagram proves" (e.g., private endpoints, RBAC boundaries, monitoring coverage).

---

## Presentation Hygiene

- Use PNG for slides unless you need vector editing.
- Avoid unreadable diagrams:
  - If a diagram needs zooming, split it into layers (network, security, data, operations).
- Call out safety controls explicitly:
  - Approval gates, least privilege, auditability (logs/diagnostics).

---

## When to Regenerate

Regenerate diagrams when any of these change:

- Resource inventory (new services, removed services)
- Network boundaries (VNets, subnets, private endpoints)
- Security model (managed identities, Key Vault/RBAC)

Start with: [S07 Diagrams as Code](../../scenarios/S07-diagrams-as-code/)
