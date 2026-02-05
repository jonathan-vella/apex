# Resource Inventory: e2e-conductor-test

**Generated**: 2025-01-27
**Source**: Infrastructure as Code (Bicep)
**Environment**: dev
**Region**: West Europe

> [!NOTE]
> 📚 See [documentation-styling.md](../../.github/agents/_shared/documentation-styling.md) for visual standards.

---

## Summary

| Category            | Count |
| ------------------- | ----- |
| **Total Resources** | 4     |
| 💻 Compute          | 0     |
| 💾 Data Services    | 0     |
| 🌐 Networking       | 0     |
| 📨 Messaging        | 0     |
| 🔐 Security         | 0     |
| 📊 Monitoring       | 2     |
| 🌍 Web              | 1     |
| 📦 Resource Group   | 1     |

---

## Resource Listing

### 📦 Resource Group

| Name                        | Type                               | Location    | Purpose           |
| --------------------------- | ---------------------------------- | ----------- | ----------------- |
| rg-e2e-conductor-test-dev-weu | Microsoft.Resources/resourceGroups | West Europe | Project container |

### 🌍 Web Resources

| Name                       | Type                      | SKU  | Location    | Purpose              |
| -------------------------- | ------------------------- | ---- | ----------- | -------------------- |
| swa-e2e-conductor-test-dev | Microsoft.Web/staticSites | Free | West Europe | Static web hosting   |

**Static Web App Details:**
- **Hostname**: victorious-sea-04f1fdb03.6.azurestaticapps.net
- **URL**: https://victorious-sea-04f1fdb03.6.azurestaticapps.net
- **Features**: Built-in global distribution, managed HTTPS, GitHub Actions integration

### 📊 Monitoring Resources

| Name                       | Type                                       | SKU/Retention | Location    | Purpose              |
| -------------------------- | ------------------------------------------ | ------------- | ----------- | -------------------- |
| log-e2e-conductor-test-dev | Microsoft.OperationalInsights/workspaces   | PerGB2018/30d | West Europe | Centralized logging  |
| ag-e2e-conductor-test-dev  | Microsoft.Insights/actionGroups            | Standard      | Global      | Alert notifications  |

**Log Analytics Details:**
- **Retention**: 30 days
- **Data Cap**: None configured
- **Solutions**: Azure Monitor

**Action Group Details:**
- **Short Name**: ag-e2e-cond
- **Email**: devops@example.com (TechContact)

### ⏭️ Disabled Resources

| Name                       | Type                    | Status  | Reason                                |
| -------------------------- | ----------------------- | ------- | ------------------------------------- |
| cdn-e2e-conductor-test-dev | Microsoft.Cdn/profiles  | Skipped | Standard_Microsoft SKU deprecated     |
| CDN Metric Alert           | Microsoft.Insights/...  | Skipped | CDN not deployed                      |

---

## References

| Topic                | Link                                                                                                                   |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Azure Resource Types | [Resource Providers](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-providers-and-types) |
| Naming Conventions   | [CAF Naming](https://learn.microsoft.com/azure/cloud-adoption-framework/ready/azure-best-practices/resource-naming)    |
| Pricing Calculator   | [Azure Pricing](https://azure.microsoft.com/pricing/calculator/)                                                       |

---

_Resource inventory generated from Bicep templates._
