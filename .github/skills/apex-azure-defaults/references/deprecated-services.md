<!-- ref:deprecated-services-v1 -->

# Deprecated Azure Services (Do NOT Recommend for Greenfield)

> Loaded by `apex-azure-defaults` SKILL.md when the agent encounters a service
> that may be deprecated or facing retirement. Keep the deprecation list
> here so the SKILL.md stays focused on the IaC workflow.

| Deprecated Service                           | Replacement                     | Retires/EOL        | Notes                            |
| -------------------------------------------- | ------------------------------- | ------------------ | -------------------------------- |
| Azure AD B2C                                 | Microsoft Entra External ID     | May 2025           | Not available for new tenants    |
| Azure Cache for Redis Enterprise / Flash     | Azure Managed Redis             | March 31, 2027     | Assess with `apex-azure-upgrade` |
| Azure Cache for Redis Basic/Standard/Premium | Azure Managed Redis             | September 30, 2028 | Assess with `apex-azure-upgrade` |
| Azure Functions Linux Consumption (Y1)       | Functions Flex Consumption      | September 30, 2028 | Assess with `apex-azure-upgrade` |
| CDN WAF (classic)                            | Front Door Standard/Premium WAF | 2025               | CDN WAF creation blocked         |
| App Gateway v1                               | App Gateway v2                  | April 2026         | Classic SKU retiring             |
| CDN Standard Microsoft                       | Front Door Standard             | 2027               | Migration required               |

**Rule**: Never recommend deprecated services for greenfield projects. Before recommending
any service with a multi-year RI commitment, verify the service retirement timeline extends
beyond the commitment period. Check Microsoft Learn deprecation announcements.
