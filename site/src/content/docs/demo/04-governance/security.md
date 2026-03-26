---
title: "Security Posture"
sidebar:
  order: 2
---

## 🔐 Security Policies

| Requirement                | Policy Source                   | Implementation                            |
| -------------------------- | ------------------------------- | ----------------------------------------- |
| Azure AD-only auth for SQL | MCAPSGov Deny                   | `azureADOnlyAuthentication: true`         |
| TLS 1.2 minimum            | Azure Security Baseline (Audit) | `minTlsVersion: 'TLS1_2'` on all services |
| HTTPS-only                 | Azure Security Baseline (Audit) | `httpsOnly: true` on App Service          |
| No blob public access      | MCAPSGov Deploy (Modify)        | `allowBlobPublicAccess: false`            |
| SQL threat detection       | MCAPSGov Audit                  | Enable in SQL Server config               |
| SQL auditing               | MCAPSGov Audit                  | Enable diagnostic settings                |
| MFA for writes             | Management Group Deny           | Deployer prerequisite                     |
| Managed Identity           | Azure Security Baseline (Audit) | System-assigned MI on App Service         |

---
