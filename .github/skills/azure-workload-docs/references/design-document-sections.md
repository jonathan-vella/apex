# Design Document Sections

The design document follows a 10-section structure. Each section has specific content
requirements.

## Section 1: Introduction

| Subsection | Content |
|------------|---------|
| Purpose | Why this document exists |
| Objectives | Business and technical goals |
| Scope | What's included/excluded |
| Stakeholders | Teams and roles involved |
| Document History | Version, date, author, changes |

## Section 2: Architecture Overview

| Subsection | Content |
|------------|---------|
| High-Level Diagram | Reference to architecture diagram |
| Subscription Organization | Management groups, subscriptions |
| Resource Groups | RG structure and naming |
| Regions | Primary, secondary, rationale |
| Naming Conventions | CAF naming patterns used |
| Tagging Strategy | Required and optional tags |

## Section 3: Networking

| Subsection | Content |
|------------|---------|
| Virtual Networks | VNet topology, address spaces |
| Subnets | Subnet layout, delegation |
| Network Security Groups | NSG rules summary |
| DNS | Private DNS zones, resolution |
| Connectivity | Peering, VPN, ExpressRoute |

## Section 4: Storage

| Subsection | Content |
|------------|---------|
| Storage Accounts | Names, tiers, replication |
| Encryption | At-rest, in-transit, keys |
| Access Control | RBAC, SAS, network rules |
| Data Protection | Soft delete, versioning |

## Section 5: Compute

| Subsection | Content |
|------------|---------|
| App Services | Names, SKUs, scaling rules |
| Functions | Consumption vs. premium |
| Virtual Machines | Sizes, availability sets/zones |
| Containers | AKS, Container Apps config |
| Scaling | Auto-scale rules, thresholds |

## Section 6: Identity & Access

| Subsection | Content |
|------------|---------|
| Authentication | AAD integration, MFA |
| Authorization | RBAC roles assigned |
| Managed Identities | System vs. user-assigned |
| Service Principals | If any, purpose |
| Conditional Access | Policies applied |

## Section 7: Security & Compliance

| Subsection | Content |
|------------|---------|
| Security Baseline | Azure Security Benchmark alignment |
| Network Security | Private endpoints, firewalls |
| Data Protection | Encryption, classification |
| Threat Protection | Defender, Sentinel |
| Compliance | Frameworks, controls |

## Section 8: Backup & DR

| Subsection | Content |
|------------|---------|
| Backup Strategy | What's backed up, frequency |
| Retention | Short-term, long-term |
| RTO/RPO | Recovery objectives |
| DR Topology | Failover region, process |
| Testing | DR test schedule |

## Section 9: Monitoring

| Subsection | Content |
|------------|---------|
| Log Analytics | Workspace config, retention |
| Application Insights | Instrumentation |
| Alerts | Critical alerts configured |
| Dashboards | Workbooks, Azure Dashboard |
| Diagnostics | Diagnostic settings |

## Section 10: Appendix

| Subsection | Content |
|------------|---------|
| Resource Inventory | Link to 07-resource-inventory.md |
| IP Allocations | Subnet IP ranges |
| NSG Rules Detail | Full rule tables |
| Cost Summary | Link to 07-ab-cost-estimate.md |
| ADR References | Links to related ADRs |
