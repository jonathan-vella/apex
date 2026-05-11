# Deprecated Azure Services (Do NOT Recommend for Greenfield)

> Loaded by `azure-defaults` SKILL.md when the agent encounters a service
> that may be deprecated or facing retirement. Keep the deprecation list
> here so the SKILL.md "Quick Reference" stays compact.

| Deprecated Service     | Replacement                      | Retires/EOL | Notes                         |
| ---------------------- | -------------------------------- | ----------- | ----------------------------- |
| Azure AD B2C           | Microsoft Entra External ID      | May 2025    | Not available for new tenants |
| Redis Enterprise E50   | Azure Managed Redis (Enterprise) | March 2027  | Plan migration before EOL     |
| CDN WAF (classic)      | Front Door Standard/Premium WAF  | 2025        | CDN WAF creation blocked      |
| App Gateway v1         | App Gateway v2                   | April 2026  | Classic SKU retiring          |
| CDN Standard Microsoft | Front Door Standard              | 2027        | Migration required            |

**Rule**: Never recommend deprecated services for greenfield projects. Before recommending
any service with a multi-year RI commitment, verify the service retirement timeline extends
beyond the commitment period. Check Microsoft Learn deprecation announcements.
