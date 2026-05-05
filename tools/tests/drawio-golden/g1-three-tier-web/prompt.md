# G1 — Three-Tier Web App

Generate a logical architecture diagram for a small three-tier web application
deployed to a single subscription in Sweden Central.

## Resources

- App Service Plan (Standard S1)
- Web App (running on the plan above)
- Azure SQL Database (Standard S1, single database)
- Storage Account (general-purpose v2)
- Key Vault (Standard, used by the Web App for secrets)
- Application Insights (workspace-based, linked to Log Analytics)

## Constraints

- Single resource group (`rg-3tier-prod`)
- No virtual network (public PaaS endpoints)
- All services use Managed Identity to access Key Vault and SQL

## Diagram expectations

- **Type:** logical (not network).
- **Flow:** left-to-right (user → Web App → SQL / Storage / Key Vault).
- **Labels:** edges show protocol (`HTTPS`, `SQL`).
- **Legend:** required (icons + edge styles).
