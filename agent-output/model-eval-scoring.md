# Model Evaluation: Architect Agent — Scoring Rubric

![Evaluation](https://img.shields.io/badge/Type-Model%20Comparison-purple?style=for-the-badge)

## Overview

Compare **Claude Opus 4.6** vs **GPT-5.3-Codex** when powering the Architect agent.

| Property      | Value                                           |
| ------------- | ----------------------------------------------- |
| Fixed Input   | `aks-platform/01-requirements.md` (frozen copy) |
| Run A (Opus)  | `agent-output/aks-platform-opus/`               |
| Run B (Codex) | `agent-output/aks-platform-codex/`              |
| Evaluator     | Human review + structured rubric                |
| Date          | 2026-02-15                                      |

---

## Scoring Criteria

Each criterion is scored **1–5** (1 = poor, 3 = acceptable, 5 = excellent).

### 1. WAF Coverage (Weight: 25%)

> All 5 pillars addressed with specific, actionable, workload-tailored recommendations.

| Subcriterion                            | Opus | Codex | Notes |
| --------------------------------------- | ---- | ----- | ----- |
| All 5 pillars present with scores       |      |       |       |
| Recommendations are workload-specific   |      |       |       |
| Gaps & trade-offs explicitly documented |      |       |       |
| Confidence levels provided              |      |       |       |
| Service Maturity Assessment included    |      |       |       |
| **Subtotal (avg)**                      |      |       |       |

### 2. Cost Estimate Accuracy (Weight: 20%)

> SKU selections match requirements; prices are plausible and verifiable.

| Subcriterion                             | Opus | Codex | Notes |
| ---------------------------------------- | ---- | ----- | ----- |
| Correct SKU names (exist in Azure)       |      |       |       |
| Prices within ±15% of Azure calculator   |      |       |       |
| All major resources costed               |      |       |       |
| Reserved/spot optimizations acknowledged |      |       |       |
| Total within stated budget envelope      |      |       |       |
| **Subtotal (avg)**                       |      |       |       |

### 3. Technical Accuracy (Weight: 20%)

> No hallucinated services, correct service limits, valid configurations.

| Subcriterion                                    | Opus | Codex | Notes |
| ----------------------------------------------- | ---- | ----- | ----- |
| No hallucinated Azure services or SKU names     |      |       |       |
| AGIC/private-cluster constraint correctly noted |      |       |       |
| Network CIDR ranges valid and non-overlapping   |      |       |       |
| SQL zone-redundancy pricing correct             |      |       |       |
| AKS tier/SLA mapping accurate                   |      |       |       |
| **Subtotal (avg)**                              |      |       |       |

### 4. Completeness (Weight: 15%)

> All requirements from 01-requirements.md addressed; no gaps.

| Subcriterion                                      | Opus | Codex | Notes |
| ------------------------------------------------- | ---- | ----- | ----- |
| All 12 functional requirements covered            |      |       |       |
| NFRs (SLA, RTO, RPO, perf targets) addressed      |      |       |       |
| Compliance frameworks (SOC2, GDPR, ISO) discussed |      |       |       |
| Networking design matches requirements            |      |       |       |
| Operational requirements (monitoring, DR) covered |      |       |       |
| **Subtotal (avg)**                                |      |       |       |

### 5. Actionability (Weight: 10%)

> Recommendations specific enough to drive implementation planning.

| Subcriterion                                          | Opus | Codex | Notes |
| ----------------------------------------------------- | ---- | ----- | ----- |
| Implementation handoff table with concrete parameters |      |       |       |
| Security requirements mapped to Bicep configs         |      |       |       |
| Resource naming follows CAF conventions               |      |       |       |
| Architecture decisions include rationale              |      |       |       |
| **Subtotal (avg)**                                    |      |       |       |

### 6. Structure & Clarity (Weight: 10%)

> Follows artifact template; well-organized; concise.

| Subcriterion                       | Opus | Codex | Notes |
| ---------------------------------- | ---- | ----- | ----- |
| H2 headings match template exactly |      |       |       |
| Badge row and navigation present   |      |       |       |
| TOC present and accurate           |      |       |       |
| Mermaid/table formatting correct   |      |       |       |
| Approval gate section present      |      |       |       |
| **Subtotal (avg)**                 |      |       |       |

---

## Weighted Summary

| #   | Criterion          | Weight | Opus Score | Codex Score |
| --- | ------------------ | ------ | ---------- | ----------- |
| 1   | WAF Coverage       | 25%    |            |             |
| 2   | Cost Accuracy      | 20%    |            |             |
| 3   | Technical Accuracy | 20%    |            |             |
| 4   | Completeness       | 15%    |            |             |
| 5   | Actionability      | 10%    |            |             |
| 6   | Structure          | 10%    |            |             |
|     | **Weighted Total** |        |            |             |

### Calculation

```
Weighted = (WAF × 0.25) + (Cost × 0.20) + (Tech × 0.20) + (Complete × 0.15) + (Action × 0.10) + (Structure × 0.10)
```

---

## Qualitative Observations

### Opus Strengths

-

### Opus Weaknesses

-

### Codex Strengths

-

### Codex Weaknesses

- ***

## Recommendation

| Decision                                | Rationale |
| --------------------------------------- | --------- |
| Preferred model for Architect agent     |           |
| Should dual-model be kept?              |           |
| Any task-specific model routing needed? |           |

---

## Hallucination Log

Track any factual errors per model. Critical for trust assessment.

| Model | Error Description | Severity (H/M/L) | Category |
| ----- | ----------------- | ---------------- | -------- |
|       |                   |                  |          |
