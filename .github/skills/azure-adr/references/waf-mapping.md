# WAF Pillar Mapping for ADRs

Map architecture decisions to Well-Architected Framework pillars.

## Pillar Reference

| Pillar | Focus Areas | Common Decision Types |
|--------|-------------|----------------------|
| **Security** | Identity, data protection, network security, governance | Auth mechanisms, encryption, network isolation |
| **Reliability** | Resiliency, availability, disaster recovery, monitoring | Redundancy, failover, backup strategies |
| **Performance** | Scalability, capacity planning, optimization | SKU selection, caching, async patterns |
| **Cost** | Resource optimization, monitoring, governance | Tier selection, reserved instances, auto-scaling |
| **Operations** | DevOps, automation, monitoring, management | IaC choice, monitoring tools, deployment patterns |

## Decision Impact Matrix

When documenting an ADR, identify which pillars are affected:

### Security-Impacting Decisions

- Authentication method (AAD vs. local, MFA requirements)
- Network architecture (private endpoints, NSGs, firewalls)
- Data encryption (at-rest, in-transit, key management)
- Identity model (managed identities vs. service principals)

### Reliability-Impacting Decisions

- Deployment topology (single-region vs. multi-region)
- Data replication strategy (sync vs. async)
- Backup and recovery approach
- Service tier selection (availability SLAs)

### Performance-Impacting Decisions

- Database selection (SQL vs. NoSQL, tier selection)
- Caching strategy (Redis, in-memory, CDN)
- Compute scaling (vertical vs. horizontal)
- Async patterns (queues, event-driven)

### Cost-Impacting Decisions

- SKU/tier selection for all resources
- Reserved vs. pay-as-you-go capacity
- Auto-scaling boundaries
- Data retention policies

### Operations-Impacting Decisions

- IaC tooling (Bicep, Terraform, ARM)
- CI/CD platform selection
- Monitoring and alerting strategy
- Secret management approach

## Trade-off Documentation

When one pillar is optimized at the expense of another, document explicitly:

```markdown
### WAF Trade-offs

| Optimized | Sacrificed | Rationale |
|-----------|------------|-----------|
| Cost | Performance | Budget constraints require smaller SKUs |
| Security | Operations | Private endpoints add deployment complexity |
```
