# ADR-0001: Use Azure Static Web Apps with CDN for Static Content Delivery

> Status: Accepted
> Date: 2026-02-05
> Deciders: DevOps Team, Architect Agent
> Project: e2e-conductor-test

## Context

The e2e-conductor-test project requires hosting static web content (HTML, CSS, JavaScript, images) with global content delivery. Key requirements include:

- **Budget constraint**: ~$20/month maximum
- **Availability target**: 99.9% SLA
- **Global users**: Content must be served efficiently worldwide
- **CI/CD integration**: Automated deployments from GitHub
- **Simplicity**: Minimal operational overhead for a test/demo workload

The team evaluated multiple Azure static content hosting options to meet these requirements while optimizing for cost.

## Decision

**We will use Azure Static Web Apps (Free tier) as the origin server combined with Azure CDN (Standard Microsoft tier) for global content delivery.**

This architecture provides:
- Zero compute cost via SWA Free tier
- Global edge caching via Azure CDN
- Built-in GitHub Actions integration
- Managed SSL certificates
- Preview environments for pull requests

## Alternatives Considered

| Option | Pros | Cons | WAF Impact |
|--------|------|------|------------|
| **Azure Static Web Apps + CDN (Selected)** | Free tier available, native GitHub integration, managed SSL, preview environments | CDN adds ~$5/mo cost, single-region origin | Cost: ↑↑, Reliability: ↑, Performance: ↑↑ |
| **Azure Blob Storage Static Website + CDN** | Lowest cost (~$1/mo), simple setup | No GitHub integration, manual SSL setup, no preview envs | Cost: ↑↑↑, Operations: ↓ |
| **Azure App Service (Basic tier)** | Full web server capabilities, easy scaling | $13/mo minimum, overkill for static content | Cost: ↓, Performance: → |
| **Azure Front Door (Standard)** | Built-in CDN + WAF, multi-origin, advanced routing | $35/mo minimum, complex for simple use case | Reliability: ↑↑, Cost: ↓↓ |
| **GitHub Pages** | Free, native GitHub integration | No Azure integration, limited customization | Cost: ↑↑↑, Security: ↓ |

## Consequences

### Positive

- **Cost savings**: ~$5/month total vs $13+ for App Service alternatives
- **Simplified operations**: Fully managed PaaS, no server administration
- **Faster deployments**: GitHub Actions integration deploys in <2 minutes
- **Better performance**: CDN edge caching achieves <100ms TTFB globally
- **Developer experience**: Preview environments for every PR

### Negative

- **Single-region origin**: Static Web App in westeurope only (mitigated by CDN caching)
- **CDN dependency**: Content freshness depends on cache TTL settings
- **Limited server-side**: No server-side processing capabilities
- **Feature limitations**: Free tier limited to 100GB bandwidth/month

### Neutral

- **Azure-specific**: Solution is Azure-native, no multi-cloud portability
- **Learning curve**: Team familiar with App Service may need SWA training

## WAF Pillar Analysis

| Pillar | Impact | Notes |
|--------|--------|-------|
| 🔒 Security | → Neutral | HTTPS enforced via managed certificates. No WAF included (acceptable for public static content). Minimal attack surface. |
| 🔄 Reliability | ↑ Improved | Combined SLA ~99.9%. CDN provides edge redundancy. Single-region origin acceptable given 4h RTO requirement. |
| ⚡ Performance | ↑↑ Significantly Improved | CDN edge caching achieves <100ms TTFB. Global distribution via Microsoft backbone. 90%+ cache hit ratio expected. |
| 💰 Cost Optimization | ↑↑ Significantly Improved | ~$5/mo vs $13+ alternatives. 75% under $20 budget. Free tier SWA eliminates compute costs. |
| 🔧 Operational Excellence | ↑ Improved | Zero server management. GitHub Actions CI/CD included. Preview environments accelerate development. |

## Reliability Enhancement (from WAF Deep Dive)

Based on the reliability pillar deep dive, we added proactive monitoring:

| Enhancement | Implementation | Cost Impact |
|-------------|----------------|-------------|
| Action Group | Email alerts to DevOps team | $0 |
| CDN Health Alert | Metric alert for OriginHealthPercentage <90% | ~$0.10/mo |

This addresses the reliability gap identified in the assessment by enabling proactive notification of origin health issues.

## Compliance Considerations

- **Data residency**: Content served from EU origin (westeurope) with global CDN edge caching
- **GDPR**: No user data collected or stored; static content only
- **Regulatory**: No specific compliance requirements for test workload
- **Certificate management**: Azure-managed SSL certificates (no manual renewal)

## Implementation Notes

### Required Azure Resources

```yaml
resources:
  - staticWebApp:
      name: swa-e2e-conductor-test
      sku: Free
      region: westeurope
      repositoryUrl: https://github.com/{owner}/{repo}
      branch: main
      
  - cdnProfile:
      name: cdn-e2e-conductor-test
      sku: Standard_Microsoft
      
  - cdnEndpoint:
      name: endpoint-e2e-conductor-test
      origin: swa-e2e-conductor-test.azurestaticapps.net
      
  - actionGroup:
      name: ag-e2e-conductor-test-reliability
      emailReceivers: [devops-team@contoso.com]
      
  - metricAlert:
      name: alert-cdn-origin-health
      threshold: 90 (percent)
```

### Caching Strategy

| Content Type | Cache-Control | CDN TTL |
|--------------|---------------|---------|
| HTML | no-cache | 0 (always revalidate) |
| JS/CSS (versioned) | max-age=31536000 | 1 year |
| Images | max-age=604800 | 7 days |
| Fonts | max-age=31536000 | 1 year |

### Deployment Pipeline

1. Push to `main` branch triggers GitHub Actions
2. SWA CLI builds and deploys to Azure Static Web Apps
3. CDN purge (optional) for cache invalidation
4. Preview deployments created automatically for PRs

---

## References

| Resource | Link |
|----------|------|
| Azure Static Web Apps | [Documentation](https://learn.microsoft.com/azure/static-web-apps/) |
| Azure CDN | [Documentation](https://learn.microsoft.com/azure/cdn/) |
| WAF Reliability Pillar | [Checklist](https://learn.microsoft.com/azure/well-architected/reliability/checklist) |
| Requirements | [01-requirements.md](./01-requirements.md) |
| Architecture Assessment | [02-architecture-assessment.md](./02-architecture-assessment.md) |

---

_ADR generated by azure-adr skill | 2026-02-05_
