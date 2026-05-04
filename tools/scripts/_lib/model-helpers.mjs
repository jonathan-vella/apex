/**
 * Shared Model Helpers
 *
 * Common helpers for the model-catalog / model-consistency /
 * generate-model-catalog cluster of validators.
 *
 * Centralises:
 *   - normalizeModel: strip the legacy " (copilot)" qualifier and
 *     unwrap array form (`model: ["..."]`) before string equality.
 *   - walkRegistry: yield `[label, entry]` pairs from the agent
 *     registry, expanding the `bicep` / `terraform` deploy split into
 *     two virtual entries.
 */

/**
 * Normalize a raw `model:` value to the canonical string form used by
 * the model catalog.
 *
 * @param {string | string[] | null | undefined} raw
 * @returns {string | null}
 */
export function normalizeModel(raw) {
  if (!raw) return null;
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v !== "string") return null;
  return v.replace(/ \(copilot\)$/i, "").trim();
}

/**
 * Walk the registry's `agents` and `subagents` maps and yield
 * `[label, entry]` pairs. Deploy entries with `bicep` / `terraform`
 * sub-objects are expanded into two virtual entries with " (bicep)" /
 * " (terraform)" suffixes so callers see a flat list.
 *
 * @param {object} registry - parsed agent-registry.json
 * @returns {Iterable<[string, object]>}
 */
export function* walkRegistry(registry) {
  for (const [key, entry] of Object.entries(registry.agents ?? {})) {
    yield* expandRegistryEntry(key, entry);
  }
  for (const [key, entry] of Object.entries(registry.subagents ?? {})) {
    yield* expandRegistryEntry(key, entry);
  }
}

function* expandRegistryEntry(key, entry) {
  if (entry.bicep || entry.terraform) {
    if (entry.bicep) yield [`${key} (bicep)`, entry.bicep];
    if (entry.terraform) yield [`${key} (terraform)`, entry.terraform];
    return;
  }
  yield [key, entry];
}
