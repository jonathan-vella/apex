/**
 * Shared Model Helpers
 *
 * Common helpers for the model-consistency / deprecated-models /
 * vendor-prompting validators.
 *
 * Centralises:
 *   - DEFAULT_MODEL_CATALOG: self-contained authorized/deprecated model
 *     labels for legacy fixture and vendor-prompting checks.
 *   - normalizeModel: strip the legacy " (copilot)" qualifier and
 *     unwrap array form (`model: ["..."]`) before string equality.
 *   - walkRegistry: yield `[label, entry]` pairs from the agent
 *     registry, expanding the `bicep` / `terraform` deploy split into
 *     two virtual entries.
 */

export const DEFAULT_MODEL_CATALOG = {
  models: {
    "GPT-6.1 Sol (copilot)": { deprecated: false },
    "GPT-6 Sol (copilot)": { deprecated: false },
    "GPT-6 Luna (copilot)": { deprecated: false },
    "Claude Opus 5.5 (copilot)": { deprecated: false },
    "Claude Sonnet 5.5 (copilot)": { deprecated: false },
    "GPT-5.6 Terra (copilot)": { deprecated: false },
    "MAI-Code-1.1-Flash": { deprecated: false },
  },
};

/**
 * Normalize a raw `model:` value to the canonical string form.
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

export function normalizeModels(raw) {
  if (raw === undefined || raw === null) return [];
  const values = Array.isArray(raw) ? raw : [raw];
  if (values.length === 0 || values.some((value) => typeof value !== "string" || !normalizeModel(value))) {
    throw new TypeError("model must be a non-empty label or ordered array of non-empty labels");
  }
  return values.map((value) => normalizeModel(value));
}

export function modelLabels(raw) {
  if (raw === undefined) return [];
  const values = Array.isArray(raw) ? raw : [raw];
  if (values.length === 0 || values.some((value) => typeof value !== "string" || !value.trim())) {
    throw new TypeError("model must be a non-empty label or ordered array of non-empty labels");
  }
  return [...values];
}

export function catalogModelLabel(label, { handoff = false, models = {} } = {}) {
  if (Object.hasOwn(models, label)) return label;
  return handoff ? label.replace(/ \([^()]+\)$/, "") : label;
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
