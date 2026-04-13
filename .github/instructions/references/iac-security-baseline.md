# IaC Security Baseline

Shared security rules for both Bicep and Terraform IaC generation.
Referenced by `iac-bicep-best-practices.instructions.md` and
`iac-terraform-best-practices.instructions.md`.

## First Principle

Azure Policy always wins. Current Azure Policy implementation cannot
be changed. Code adapts to policy, never the reverse.

## Zone Redundancy SKUs

| SKU       | Zone Redundancy | Use Case            |
| --------- | --------------- | ------------------- |
| S1/S2     | Not supported   | Dev/test            |
| P1v3/P2v3 | Supported       | Production          |
| P1v4/P2v4 | Supported       | Production (latest) |
