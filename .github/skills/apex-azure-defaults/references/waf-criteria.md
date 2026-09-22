<!-- ref:waf-criteria-v1 -->

# WAF Assessment Criteria

## Scoring Scale

| Score | Definition                                  |
| ----- | ------------------------------------------- |
| 9-10  | Exceeds best practices, production-ready    |
| 7-8   | Meets best practices with minor gaps        |
| 5-6   | Adequate but improvements needed            |
| 3-4   | Significant gaps, address before production |
| 1-2   | Critical deficiencies, not production-ready |

## Pillar Definitions

| Pillar      | Icon | Focus Areas                                          |
| ----------- | ---- | ---------------------------------------------------- |
| Security    | 🔒   | Identity, network, data protection, threat detection |
| Reliability | 🔄   | SLA, redundancy, DR, health monitoring               |
| Performance | ⚡   | Response time, scalability, caching, load testing    |
| Cost        | 💰   | Right-sizing, reserved instances, monitoring spend   |
| Operations  | 🔧   | IaC, CI/CD, monitoring, incident response, docs      |

## Assessment Rules

- **DO**: Score each pillar 1-10 with confidence level
  (High/Medium/Low)
- **DO**: Identify specific gaps with remediation recommendations
- **DO**: Calculate composite WAF score as average of all pillars
- **DON'T**: Give 10/10 without exceptional justification
- **DON'T**: Skip any pillar even if requirements seem light
- **DON'T**: Provide generic recommendations — be workload-specific
