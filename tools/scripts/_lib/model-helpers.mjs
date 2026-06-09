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
 *   - buildAssignments: derive the model-catalog `assignments` block from
 *     agent/subagent frontmatter (the canonical source of truth).
 */

import { getAgents } from "./workspace-index.mjs";

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

/**
 * Build the model-catalog `assignments` block from agent/subagent
 * frontmatter (the canonical source of truth). The `models` and
 * `governance` blocks are hand-maintained and not produced here.
 *
 * @returns {{generated: boolean, generated_by: string, description: string,
 *            agents: Record<string,string>, subagents: Record<string,string>}}
 */
export function buildAssignments() {
  const agents = getAgents();
  const main = {};
  const subs = {};
  const sorted = [...agents.entries()].sort(([a], [b]) => a.localeCompare(b));
  for (const [file, a] of sorted) {
    const model = normalizeModel(a.frontmatter?.model);
    if (!model) continue;
    if (a.isSubagent) subs[file] = model;
    else main[file] = model;
  }
  return {
    generated: true,
    generated_by: "tools/scripts/generate-model-catalog.mjs",
    description:
      "Auto-generated inventory of agent → model assignments derived from frontmatter (canonical source). Do not edit by hand; run `node tools/scripts/generate-model-catalog.mjs` or let the lefthook pre-commit hook refresh it when frontmatter changes.",
    agents: main,
    subagents: subs,
  };
}
