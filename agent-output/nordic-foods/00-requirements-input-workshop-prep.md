# Nordic Foods - Requirements Input (Workshop Prep)

Source URL: https://jonathan-vella.github.io/microhack-agentic-infraops/getting-started/workshop-prep/
Captured: 2026-05-11

## Business Context
- Company: Nordic Fresh Foods, farm-to-table delivery business in Stockholm.
- Current baseline: manual workflows (spreadsheets, WordPress, WhatsApp updates), operational friction, and error-prone order handling.
- Immediate driver: recently funded modernization with MVP needed before peak season.

## Problem Statement
- Manual order intake from multiple channels causes data-entry mistakes and lost orders.
- Inventory updates are not real-time, leading to overselling and customer dissatisfaction.
- Delivery scheduling is manual and inefficient, with poor coordination timing.
- Customers lack self-service visibility for order status and ETA.
- Seasonal demand spikes require unsustainable manual scaling.

## Target Vision (FreshConnect)
- Cloud platform supporting web and mobile order channels.
- Real-time inventory from partner farms.
- Automated delivery planning and optimization.
- Order tracking for restaurants and consumers.
- Elastic scaling during peaks.
- Analytics for operational and business decisions.

## Mission Scope
- Design and deploy Azure infrastructure for the FreshConnect MVP.
- Application code delivery is explicitly out of scope.

## Functional Requirements (MVP)
- Web portal support for restaurant and consumer order entry.
- API backend for mobile and integration scenarios.
- Database for orders, customers, inventory, and delivery schedules.
- File/object storage for product media, invoices, and receipts.
- Secrets management for API keys, credentials, and certificates.
- Monitoring for health, metrics, and alerting.

## Constraints
- Budget target around 500 EUR/month for infrastructure during MVP phase.
- GDPR alignment with customer PII retained in EU regions.
- Primary region expectation: swedencentral.
- Delivery timeline: three months to MVP readiness.
- Small team with preference for managed Azure services.

## Non-Functional Requirements
- Availability target: 99.9% SLA.
- Initial recoverability targets: RTO 4 hours, RPO 1 hour.
- Peak load planning includes seasonal volume expansion.
- Authentication intent includes Azure AD for internal and Azure AD B2C for external users.
- Public endpoints are acceptable for MVP where justified by timeline and cost.

## Out of Scope (MVP)
- Mobile app infrastructure (deferred phase).
- AI/ML route optimization (deferred phase).
- Multi-region DR in initial MVP scope (added in later challenge progression).
- Real-time IoT telemetry from delivery vehicles.

## Stakeholder Drivers
- CEO: predictable delivery outcomes and budget control.
- CTO: scalability and modern cloud architecture.
- CFO: cost efficiency and measurable ROI.
- Operations: reliability and maintainability.

## Notes For Step 1 Agent
- Treat this file and the source URL as canonical customer-provided input.
- Preserve explicit constraints and deferred-scope boundaries.
- Capture unresolved decisions and assumptions clearly in 01-requirements.md.
- Capture the IaC tool decision in Phase 2 of requirements (do not ask the orchestrator).
