# Stage 3 — MCP-integration audit (read-only)

> **Plan**: [`plan-gepa-pipeline.prompt.md`](../../prompts/sensei/plan-gepa-pipeline.prompt.md) — Stage 3
> **Generated**: 2026-05-10
> **Branch**: `feat/skills-sensei`
> **Trigger**: `mcp audit`

This audit covers the four in-scope skills that declare `INVOKES:` in their
frontmatter `description`. Each is checked against four criteria:

1. **MCP Tools section** — explicit table or list of tools + parameters
2. **Prerequisites** — auth, package install, MCP server configuration
3. **CLI fallback** — pattern when the MCP server is unavailable
4. **No name collision** — skill name ≠ MCP server name and ≠ MCP tool names

No new INVOKES skills were introduced by Stage 2 (token squeeze).
Reference files (`creation-workflows.md`, `phases.md`, etc.) created in
Stage 2 are pure relocations and do not change MCP-tool surface area.

## Skill summary

| Skill | MCP server | Frontmatter `INVOKES:` claim | Body declares MCP tools? |
| --- | --- | --- | --- |
| `azure-kusto` | Azure MCP (`mcp_azure_mcp_kusto`) | "azure-kusto MCP (queries, sample, list-clusters)" | Yes — `## MCP Tools Used` |
| `azure-quotas` | Azure MCP (`mcp_azure_mcp_quota`) | "azure-quota MCP (check, region-availability)" | **No** — body says CLI is primary |
| `microsoft-docs` | Microsoft Learn MCP (`mcp_microsoft-lea_*`) | "microsoft-learn MCP (microsoft_docs_search, microsoft_code_sample_search, microsoft_docs_fetch)" | Yes — `## Tools` (2 of 3 tools listed) |
| `drawio` | simonkurtz-MSFT/drawio-mcp-server (`mcp_drawio_*`) | "drawio MCP (search-shapes, add-cells, finish-diagram)" | Partial — `## MCP Workflow Summary` (no parameter table) |

## Traffic-light per skill

Legend: ✅ pass · ⚠️ partial · ❌ missing or contradictory.

| Skill | (1) MCP Tools section | (2) Prerequisites | (3) CLI fallback | (4) No collision |
| --- | :---: | :---: | :---: | :---: |
| `azure-kusto` | ✅ | ⚠️ | ✅ | ✅ |
| `azure-quotas` | ❌ | ⚠️ | ✅ (CLI is primary) | ✅ |
| `microsoft-docs` | ⚠️ | ⚠️ | ✅ | ✅ |
| `drawio` | ⚠️ | ✅ | ❌ | ❌ |

### azure-kusto

1. **MCP Tools section**: ✅ `## MCP Tools Used` lists 4 tools (`kusto_cluster_list`,
   `kusto_database_list`, `kusto_query`, `kusto_table_schema_get`) with required and
   optional parameters.
2. **Prerequisites**: ⚠️ No dedicated `## Prerequisites` heading. Auth (Viewer role for
   queries), Azure subscription scope, and MCP server availability are implied by the
   parameter list and the "Common Issues" section but never enumerated in one place.
3. **CLI fallback**: ✅ `## Fallback Strategy: Azure CLI` heading + pointer to
   [`references/fallback-strategy.md`](../azure-kusto/references/fallback-strategy.md).
4. **Name collision**: ✅ Skill `azure-kusto` ≠ tool names (`kusto_*`). Frontmatter
   `INVOKES:` says "azure-kusto MCP" — this is the Azure MCP server's `kusto` namespace,
   not a separate MCP server. Phrasing is correct.

**Recommended remediation** (deferred to `mcp update`):

- Add a `## Prerequisites` section listing: Azure CLI authenticated; subscription with
  Kusto resources; reader/viewer role on the target database; Azure MCP server
  configured in `.vscode/mcp.json`.

### azure-quotas

1. **MCP Tools section**: ❌ No `## MCP Tools` section. The body explicitly states "CLI-first
   is mandatory" and treats Azure CLI as the primary path; the frontmatter `INVOKES:` claim
   "azure-quota MCP (check, region-availability)" is not reflected in the body.
2. **Prerequisites**: ⚠️ The Quick Reference table mentions `az extension add --name quota`
   and required permissions (Reader / Quota Request Operator) but there is no dedicated
   `## Prerequisites` heading. MCP server config is not mentioned at all.
3. **CLI fallback**: ✅ The CLI is intentionally the **primary** path; the body documents the
   CLI-first decision and warns against starting from REST API or Portal. (This is the
   inverse of the usual MCP-primary / CLI-fallback shape, but it is documented and
   correct for this skill.)
4. **Name collision**: ✅ Skill `azure-quotas` ≠ Azure MCP `quota` namespace. Frontmatter
   `INVOKES:` says "azure-quota MCP" — referring to the Azure MCP server's `quota`
   namespace, not a separate MCP server. Phrasing is acceptable but `azure-quota`
   (singular) vs the skill name `azure-quotas` (plural) is a minor inconsistency.

**Recommended remediation** (deferred to `mcp update`):

- Resolve the contradiction: either remove `INVOKES:` from frontmatter (since the body
  treats CLI as primary), or add a `## MCP Tools (Optional Augmentation)` section listing
  the relevant Azure MCP `quota` tools (`mcp_azure_mcp_quota` check / region-availability /
  usage).
- Add a `## Prerequisites` section listing: Azure CLI ≥ 2.50; `az extension add --name
  quota`; Reader role minimum; (optional) Azure MCP server for the augmentation path.
- Reconcile `azure-quota` vs `azure-quotas` plural in the `INVOKES:` claim.

### microsoft-docs

1. **MCP Tools section**: ⚠️ `## Tools` lists 2 tools (`microsoft_docs_search`,
   `microsoft_docs_fetch`). The frontmatter `INVOKES:` declares 3
   (`microsoft_code_sample_search` is also part of the Learn MCP). The third tool is
   referenced in body Step 5 ("Cross-reference code samples with
   `microsoft_code_sample_search`") but missing from the Tools table.
2. **Prerequisites**: ⚠️ The `compatibility:` frontmatter field names the Learn MCP
   endpoint (`https://learn.microsoft.com/api/mcp`) and the `mslearn` CLI fallback, but
   there is no dedicated `## Prerequisites` body section.
3. **CLI fallback**: ✅ `## CLI Alternative` heading with concrete commands
   (`npx @microsoft/learn-cli search "..."`) and an MCP-tool ↔ CLI-command mapping table.
4. **Name collision**: ✅ Skill `microsoft-docs` ≠ MCP tool names (`microsoft_docs_*` /
   `microsoft_code_sample_search`). Tool names share the `microsoft_docs_` prefix with
   the skill name but the skill is not aliased to any single tool.

**Recommended remediation** (deferred to `mcp update`):

- Add `microsoft_code_sample_search` to the `## Tools` table.
- Add a `## Prerequisites` section listing: Microsoft Learn MCP server reachable
  (no auth required); Node.js ≥ 18 for the `mslearn` CLI fallback; outbound
  HTTPS to `learn.microsoft.com`.

### drawio

1. **MCP Tools section**: ⚠️ `## MCP Workflow Summary` lists 5 tools but is a workflow
   description, not a parameter table. There is no formal `## MCP Tools` heading. The
   skill body does say the MCP server's own startup `instructions.md` is the
   authoritative tool reference — this is a deliberate design choice (avoid duplicating
   ~15 KB of tool docs) but the audit criterion is technically not met.
2. **Prerequisites**: ✅ `## Prerequisites` section lists: simonkurtz-MSFT MCP server
   configured in `.vscode/mcp.json`, Deno runtime (devcontainer feature), optional
   `hediet.vscode-drawio` extension.
3. **CLI fallback**: ❌ No CLI fallback documented. There is no public `drawio` CLI for
   programmatic diagram authoring; the closest equivalent (Draw.io desktop app) is
   manual. The `python3 tools/scripts/save-drawio.py` and `cleanup-drawio.py` scripts
   referenced by the skill are post-processing utilities, not MCP fallbacks. **The
   honest answer is that no CLI fallback exists and the SKILL should say so explicitly.**
4. **Name collision**: ❌ Skill name `drawio` ≡ MCP server slug `drawio` ≡ MCP tool prefix
   `mcp_drawio_*`. This is the cleanest case of skill / MCP-server / MCP-tool name
   collision in the in-scope tree. It does not break Copilot routing today (skills and
   MCP tools live in different namespaces), but it makes references like "use drawio"
   ambiguous in agent prompts.

**Recommended remediation** (deferred to `mcp update`):

- Add a `## MCP Tools` heading immediately after `## MCP Workflow Summary` with a small
  table (5–10 most-used tools, parameters, when to call) — keep it concise and link to
  the MCP server's `src/instructions.md` for the authoritative reference.
- Add a `## CLI fallback` (or `## No CLI Fallback`) section explicitly stating that no
  programmatic CLI exists and that manual Draw.io desktop work is the only fallback.
- Document the name collision: keep the skill name `drawio` but add a leading paragraph
  noting that "drawio" can refer to the skill (this file), the MCP server
  (`simonkurtz-MSFT/drawio-mcp-server`), or the underlying tool family — disambiguate
  in agent-facing references.

## Recommended diff scope (for `mcp update`)

Estimated SKILL.md token impact (rough):

| Skill | Sections to add | Estimated +tokens |
| --- | --- | ---: |
| `azure-kusto` | `## Prerequisites` | +60 |
| `azure-quotas` | `## MCP Tools (Optional Augmentation)` + `## Prerequisites` | +120 |
| `microsoft-docs` | Add 3rd tool to `## Tools`; new `## Prerequisites` | +50 |
| `drawio` | `## MCP Tools` (concise) + `## CLI fallback` (no-fallback notice) + collision note | +90 |
| **Total** | — | **+320** |

This stays well within the repo-root [`.token-limits.json`](../../../.token-limits.json)
soft limits. None of the four skills will breach their limit after Stage 3 updates.

## Stage 3 entry criteria for `mcp update`

When the user issues `mcp update` (or `mcp update <skill>`):

1. Apply the recommended diffs from each skill's "Recommended remediation" block above.
2. Run validators (`validate:skills`, `validate:agents`, `lint:vendor-prompting`,
   `tokens check`).
3. Append a "Post-update" section to this file documenting which diffs were applied.
4. Commit `feat(skills): Apply MCP-integration audit findings (stage 3)`.

## Status

Audit complete; **0 diffs applied**. Awaiting `mcp update` (or
`mcp update <skill>`) to start the remediation pass.
