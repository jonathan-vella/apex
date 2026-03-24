/**
 * Shape alias registry — maps common Azure service names to their
 * canonical draw.io shape library names.
 *
 * Aliases are checked BEFORE exact-match and fuzzy search in resolveShape().
 * This handles cases where Azure marketing names differ from the icon library
 * titles (e.g., "Entra External ID" → "External Identities").
 *
 * Maintenance rules:
 * - Hard cap: MAX_ALIASES entries (enforced by test)
 * - Only add aliases when fuzzy search genuinely fails
 * - Each alias must have a corresponding test case
 */

/** Maximum number of aliases allowed. Enforced by tests. */
export const MAX_ALIASES = 20;

/**
 * Static alias map: common name → canonical shape library name.
 * Keys are case-insensitive (lowered at lookup time).
 */
const SHAPE_ALIASES_RAW: Record<string, string> = {
  "Entra External ID": "External Identities",
  "Azure SQL": "SQL Database",
  "Azure SQL Database": "SQL Database",
  "Private DNS Zones": "DNS Zones",
  "Managed Identity": "Entra Managed Identities",
  "Azure Monitor": "Monitor",
  "App Service": "App Services",
  "Container App": "Container Apps",
  "Azure Key Vault": "Key Vaults",
  "Azure Storage": "Storage Accounts",
};

/** Lowercased lookup map built once at module load. */
const SHAPE_ALIASES: ReadonlyMap<string, string> = new Map(
  Object.entries(SHAPE_ALIASES_RAW).map(([k, v]) => [k.toLowerCase(), v]),
);

/**
 * Resolve a shape name through the alias registry.
 * Returns the canonical shape name if an alias exists, otherwise undefined.
 *
 * @param query — the shape name to look up (case-insensitive)
 * @returns the canonical shape name, or undefined if no alias matches
 */
export function resolveAlias(query: string): string | undefined {
  return SHAPE_ALIASES.get(query.toLowerCase());
}

/** Return the number of registered aliases (for test assertions). */
export function getAliasCount(): number {
  return SHAPE_ALIASES.size;
}

/** Return all alias entries as an array (for test/debug). */
export function getAllAliases(): Array<{ alias: string; canonical: string }> {
  return Array.from(SHAPE_ALIASES.entries()).map(([alias, canonical]) => ({
    alias,
    canonical,
  }));
}
