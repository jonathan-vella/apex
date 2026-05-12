/**
 * AVM (Azure Verified Modules) default-SKU lookup table.
 *
 * Used by tools/scripts/validate-sku-iac-coverage.mjs to resolve the
 * effective SKU when an IaC module call does not explicitly pass a
 * SKU parameter. Without this table, the IaC→manifest coverage check
 * would flag every AVM-default consumer as a coverage gap.
 *
 * Maintenance:
 *   - Add a row when a new AVM module ships with a default SKU.
 *   - Source of truth for AVM defaults is the module's own main.bicep
 *     or variables.tf (look for `param skuName string = '...'` or
 *     `default = "..."`). Cite the module version in `version_seen`.
 *   - Pattern style: `module-id` is the registry name fragment
 *     (`avm/res/<service>/<resource>`); `default_sku` is the canonical
 *     SKU string consumers can reference in services[].size.
 *
 * Scope: covers the AVM modules most commonly used by APEX-generated
 * IaC today. Modules without an entry are treated as "explicit-SKU
 * required" — if the consumer doesn't pass a SKU param, the validator
 * emits a coverage warning telling the user to either add the module
 * to this table or pass an explicit SKU.
 */

export const AVM_DEFAULT_SKUS = [
  // ── Bicep AVM resource modules ──
  {
    module_id: "avm/res/web/serverfarm",
    default_sku: "P1v3",
    version_seen: "0.4.x",
    sku_param_names: ["skuName", "sku"],
    canonical_service: "App Service Plan",
  },
  {
    module_id: "avm/res/web/site",
    default_sku: "P1v3",
    version_seen: "0.12.x",
    sku_param_names: [],
    canonical_service: "App Service",
  },
  {
    module_id: "avm/res/storage/storage-account",
    default_sku: "Standard_LRS",
    version_seen: "0.18.x",
    sku_param_names: ["skuName"],
    canonical_service: "Storage Account",
  },
  {
    module_id: "avm/res/sql/server/databases",
    default_sku: "GP_S_Gen5_2",
    version_seen: "0.10.x",
    sku_param_names: ["skuName", "sku"],
    canonical_service: "SQL Database",
  },
  {
    module_id: "avm/res/document-db/database-account",
    default_sku: "Standard",
    version_seen: "0.6.x",
    sku_param_names: [],
    canonical_service: "Cosmos DB",
  },
  {
    module_id: "avm/res/cache/redis",
    default_sku: "Standard_C1",
    version_seen: "0.7.x",
    sku_param_names: ["skuName"],
    canonical_service: "Redis Cache",
  },
  {
    module_id: "avm/res/api-management/service",
    default_sku: "Developer_1",
    version_seen: "0.4.x",
    sku_param_names: ["sku"],
    canonical_service: "API Management",
  },
  {
    module_id: "avm/res/network/application-gateway",
    default_sku: "Standard_v2",
    version_seen: "0.5.x",
    sku_param_names: ["skuName"],
    canonical_service: "Application Gateway",
  },
  {
    module_id: "avm/res/container-service/managed-cluster",
    default_sku: "Standard_DS2_v2",
    version_seen: "0.9.x",
    sku_param_names: ["vmSize"],
    canonical_service: "AKS Node Pool",
  },
  {
    module_id: "avm/res/compute/virtual-machine",
    default_sku: "Standard_D2s_v5",
    version_seen: "0.16.x",
    sku_param_names: ["vmSize"],
    canonical_service: "Virtual Machine",
  },
  // ── Terraform AVM modules (Azure/avm-res-*) ──
  {
    module_id: "Azure/avm-res-web-serverfarm/azurerm",
    default_sku: "P1v3",
    version_seen: "0.3.x",
    sku_param_names: ["sku_name"],
    canonical_service: "App Service Plan",
  },
  {
    module_id: "Azure/avm-res-storage-storageaccount/azurerm",
    default_sku: "Standard_LRS",
    version_seen: "0.4.x",
    sku_param_names: ["account_tier", "account_replication_type"],
    canonical_service: "Storage Account",
  },
  {
    module_id: "Azure/avm-res-sql-server/azurerm",
    default_sku: "GP_S_Gen5_2",
    version_seen: "0.1.x",
    sku_param_names: ["sku_name"],
    canonical_service: "SQL Database",
  },
];

/**
 * Find the AVM default-SKU entry matching a module identifier.
 *
 * @param {string} moduleRef - Module reference string from Bicep
 *   (`br/public:avm/res/web/serverfarm:0.4.1`) or Terraform
 *   (`Azure/avm-res-web-serverfarm/azurerm`).
 * @returns {object|null} Matching entry from AVM_DEFAULT_SKUS or null.
 */
export function lookupAvmDefault(moduleRef) {
  if (!moduleRef) return null;
  const ref = moduleRef.toLowerCase();
  for (const entry of AVM_DEFAULT_SKUS) {
    if (ref.includes(entry.module_id.toLowerCase())) return entry;
  }
  return null;
}
