# Standalone WAF Assessment v2.1 Improvements

## Plan: Root-Session Review Provenance, Workbook Read-Back, Parallel Evidence, Multi-View Cost, and Chart Polish

**Status**: Completed
**Owner**: @jonathan-vella **Created**: 2026-11-12 **Decisions**:

- Accept root-session live-flushed `preToolUse`/`postToolUse` + `subagent.started`/`subagent.completed` provenance in
  `tools/scripts/record-review.mjs` when VS Code Copilot SDK buffers the root turn's `tool.execution_start` and
  `tool.execution_complete` records in memory until turn end, while preserving strict `tool.execution_start` +
  `tool.execution_complete` validation whenever present (all subagent dispatches and completed root turns). Scope the
  `README.md`/`00-handoff.md` mutable-input ban in `validate-challenger-findings.mjs` to project-root paths so
  immutable snapshots/indexes under `_meta/**` remain freezeable.
- Automatically emit a deterministic, hash-bound JSON workbook read-back (`_meta/action-register-workbook-readback.json`)
  during `assessment-action-register.mjs render` / `render-assessment-action-register.py` and verify it in
  `validate-export`, while instructing read-only `challenger-review-subagent` never to `view` binary `.xlsx`/`.png`
  files directly and instead inspect their hash-bound text/SVG/read-back siblings.
- Fix the live Azure Resource Graph KQL reserved-keyword `ParserFailure` (`kind=tostring(kind)` ->
  `resourceKind=tostring(['kind'])`, `availabilityZones=tostring(zones)`), parallelize per-scope probes/queries with
  `ThreadPoolExecutor(max_workers=4)`, capture `subscription_name`, and fold scalar topology, SQL MI/Key Vault/Service
  Bus/App Service configuration extras, policy assignment summaries, and bounded Monitor metrics directly into
  `tools/scripts/collect-assessment-evidence.py` so `03-Architect` writes zero custom `_meta/scratch/*` collectors.
- Remove `--debug` from `tools/scripts/collect-assessment-cost.mjs` (avoiding `Authorization` headers in child stderr)
  and add `--include-amortized` + `--include-rg-breakdown` CLI flags so one invocation produces all three cost views;
  align `tools/scripts/cost-estimate.mjs` and `fetch-retail-price-evidence.mjs` with
  `{output_path}.retail-evidence/` (preserving legacy `pricing-evidence/` read fallback) and add PaaS service recipes
  (`sql managed instance`, `service bus`, `firewall`, `application gateway`, `postgresql`, `mysql`, `managed redis`,
  `container apps`).
- Record `row_count` and `currency_inferred` on normalized empty cost series in `assessment-cost.mjs`; update
  `tools/scripts/render-assessment-charts.py` to draw a `NO ROWS` callout badge instead of a synthetic `$0` bar on
  0-row inferred-currency periods, format nonzero sub-dollar values (`<0.01`, `0.xx`) instead of rounding `< $0.50` to
  `0`, and resolve human-readable subscription display/role names; bound `04-Design` standalone assessment output to 1
  primary diagram (+ at most 1 inventory companion sheet for large multi-subscription scopes) with a stock
  `tools/scripts/validate-assessment-diagram.py` validator.
- Codify in `03-architect.agent.md` (`< 350` lines) and `assessment-cost-contract.md` that query/evidence availability
  belongs in Coverage rather than WAF pillar pass/fail denominators, and trim `01-Orchestrator` scope-intake reads in
  `waf-assess-existing.prompt.md`.

**Progress**:

- [x] P1 (`v21-ws1-review-recorder`): Root-session hook+subagent provenance in `record-review.mjs`, root-only
      `README.md`/`00-handoff.md` mutable-input check, parallel review guidance, and `review-contract.json` update.
- [x] P2 (`v21-ws2-xlsx-readback`): Deterministic `_meta/action-register-workbook-readback.json` in
      `render-assessment-action-register.py` / `assessment-action-register.mjs`, binary-safe rule in
      `challenger-review-subagent.agent.md`, and `register-tool-compatibility.json` update.
- [x] P3 (`v21-ws3-evidence-collector`): Fix ARG `kind` alias `ParserFailure`, parallelize scopes, capture
      `subscription_name`, and add scalar topology, SQL MI/KV/SB/App extras, policy summaries, and Monitor metrics in
      `collect-assessment-evidence.py`.
- [x] P4 (`v21-ws4-cost-and-pricing`): Token-clean `--only-show-errors` executor + `--include-amortized` /
      `--include-rg-breakdown` in `collect-assessment-cost.mjs`; `{dirname(output_path)}/pricing-evidence/` alignment
      and SQL MI / PaaS recipes in `cost-estimate.mjs`.
- [x] P5 (`v21-ws5-charts-and-diagrams`): `NO ROWS` badge + `<0.01`/`-<0.01`/`0.xx` labels + subscription display
      names in `render-assessment-charts.py`, stock `validate-assessment-diagram.py`, and bounded `04-Design`
      assessment diagram guidance.
- [x] P6 (`v21-ws6-guardrails-and-intake`): WAF scoring denominator guardrail in `03-architect.agent.md` &
      `assessment-cost-contract.md`, fast scope-intake guidance in `waf-assess-existing.prompt.md`, full validation,
      live `partner-modernization-factory-v2` resume-compatibility check, and PR in `jonathan-vella/apex`.

---

## 1. Live Post-Mortem Context (`partner-modernization-factory-v2`, 3h 38m Active Compute)

Across the 4-subscription, 211-resource `assessment-bundle-v3` run (`b2f543cf-48c7-4540-9af1-dc3ce7078809`):

1. **Root-session deferred `tool.execution_start` flush blocked review recording (`~38m` + halted run)**: When
   `01-Orchestrator` (root session) dispatched `challenger-review-subagent` as a sibling (`REVIEW_REQUIRED`), the VS
   Code Copilot SDK flushed `hook.start (preToolUse)`, `subagent.started`, child `user.message`/`assistant.message`,
   `subagent.completed`, and `hook.start/end (postToolUse)` immediately (`18:14–18:24 UTC`), but buffered the root
   turn's `tool.execution_start` and `tool.execution_complete` records in memory until the root turn ended (`07:41 UTC`).
   `record-review.mjs` waited 25s per call and threw `Exactly one tool.execution_start is required`.
2. **Read-only reviewer failed on binary `.xlsx` (`~24m` + 1 wasted review slot)**: `challenger-review-subagent`
   called `view` on `assets/04-assessment-action-register.xlsx` in `supporting_inputs`, received compressed PKZIP
   bytes, and returned `FAILED` (`stage: "supporting_evidence_read"`). `03-Architect` then wrote 1.1 MB of custom
   `openpyxl` read-back files and had to snapshot `_meta/workbook-readback/README.md` because `mutableInputProblem`
   rejected `README.md` by basename anywhere in the tree.
3. **Sequential reviewer execution & 138-file `supporting_inputs` bloat (`~10–15m` per wave)**: Independent read-only
   `comprehensive` and `cost-feasibility` reviews ran sequentially over identical frozen digests.
4. **Live ARG KQL `ParserFailure` (`~5.5m`)**: `kind=tostring(kind)` in `collect-assessment-evidence.py` failed in live
   Azure Resource Graph because `kind` is a KQL reserved keyword (`join kind=...`).
5. **Missing topology/SQL MI/policy/metrics projections (`~7–10m`)**: `03-Architect` wrote 6 custom `_meta/scratch/*.py`
   scripts to gather VNet/subnet/peering/private-endpoint scalars, SQL MI `storageAccountType`, policy assignments, and
   Monitor metrics.
6. **`az rest --debug` token-hygiene friction & single-view CLI (`~4m`)**: `03-Architect` wrote a custom cost wrapper
   to avoid `--debug` stderr headers and to collect `AmortizedCost` + `ResourceGroupName` views.
7. **`cost-estimate-subagent` directory conflict & missing SQL MI recipe (`~18m`)**: `cost-estimate-subagent.agent.md`
   permitted writes only under `{output_path}.retail-evidence/`, whereas `cost-estimate.mjs` hardcoded
   `{dirname(output_path)}/pricing-evidence/`; `serviceRecipe()` also lacked `sql managed instance` and several PaaS
   services.
8. **Empty-period `$0` bar & sub-dollar rounding (`~18m`)**: `render-assessment-charts.py` plotted Member 03's 0-row
   inferred-USD September slice as `0` and rounded `<$0.01` and `$0.46` to `0`, prompting `03-Architect` to author a
   custom `assets/03-cost-trends.py` adapter after review feedback.
9. **Opaque `Sub 1..4` chart labels**: Cost trend and driver charts displayed `Sub 1 (706f47e8)` instead of
   `gh-shared (706f47e8)`.
10. **Unbounded `04-Design` fan-out (`~12–15m` + review bloat)**: `04-Design` rendered 8 separate 4K diagrams + a
    custom 16 KB `03-des-check.py`, leaving secondary subscriptions as text cards on the main overview diagram.
11. **Billing-collection checks counted in Cost Optimization score (`~38m` repair cycle)**: Counting query-collection
    availability (`C040–C042`) as passing workload controls inflated Cost Optimization to `7.5/10` and triggered a full
    repair wave.
12. **`01-Orchestrator` 55-call cold-start orientation (`~3–4m`)**: Read worker scripts and subagent definitions
    before `apex-recall init`.

---

## 2. Detailed Design by Workstream

### 2.1 WS1 — Root-Session Review Provenance, Scoped Mutable Basenames & Parallel Reviews

- **`tools/scripts/record-review.mjs`**:
  - Extract a helper `resolveParentDispatch(events, linked, worker, start, completed, parentId, reviewer)`:
    - **Primary path** (when `linked` contains `tool.execution_start` or `tool.execution_complete`): require exact 1
      `tool.execution_start` + exact 1 `tool.execution_complete` with identical checks to today (so partial/corrupt
      subagent dispatches still fail hard).
    - **Root live-buffered fallback** (only when `parentId === "root"`, `linked` has `0` `tool.execution_start` and
      `0` `tool.execution_complete`, `start.data?.parentId === undefined`, `start.data?.resumable === false`,
      `start.data?.executionMode === "sync"`, and `start.data?.taskModelSource === "unset"`):
      - Require matching `hook.start` (`hookType === "preToolUse"`, `(event.agentId ?? "root") === "root"`) containing
        exactly one tool call entry with `id === call` and `name === "task"`, paired with its `hook.end`
        (`success === true`), AND matching `hook.start` (`hookType === "postToolUse"`, `(event.agentId ?? "root") === "root"`,
        `data.input.toolCallId === call`, `data.input.toolName === "task"`,
        `data.input.toolResult?.resultType === "success"`), paired with its `hook.end` (`success === true`).
      - Verify `preToolUse` `args` (`args.agent_type === reviewer`, `!Object.hasOwn(args, "mode") || args.mode === "sync"`,
        `!["model", "reasoning_effort", "context_tier"].some((k) => Object.hasOwn(args, k))`), and verify exact prompt
        equality between `preToolUse` `args.prompt`, `postToolUse` `toolArgs.prompt`, and the child worker's
        `user.message.data.content`.
  - Update `loadEventsWithFlushWait`: treat a root worker (`start.data?.parentId === undefined`) as flush-complete as
    soon as `subagent.completed` AND either (`tool.execution_start` + `tool.execution_complete`) OR (`preToolUse` +
    `postToolUse` `hook.end`) are present, avoiding unnecessary 25s waits.
- **`tools/scripts/validate-challenger-findings.mjs`**:
  - Update `mutableInputProblem(inputPath)` so `README.md` and `00-handoff.md` are rejected at project root
    (`agent-output/<project>/README.md` or bare `README.md`), while allowing nested paths under `_meta/` (e.g.,
    `agent-output/<project>/_meta/workbook-readback/README.md`). Keep `00-session-state.json`, `sku-manifest.json`,
    `sku-manifest.md`, and `*-decisions.json` forbidden at any depth.
- **`.github/skills/apex-azure-defaults/references/one-shot-review.md` & `standalone-assessment.md` &
  `tools/registry/review-contract.json`**:
  - Document parallel sibling/subagent dispatch of `comprehensive` and `cost-feasibility` reviews against the same
    frozen `input_digest`, and bound `supporting_inputs` to canonical contracts/artifacts/evidence (never
    `_meta/scratch/**`).
  - Register prior `reviewer_definition_sha` / `reviewer_contract_sha` pairs in `review-contract.json`
    (`editorial_compatibility`).

### 2.2 WS2 — Deterministic Workbook Read-Back & Binary-Safe Review Contract

- **`tools/scripts/render-assessment-action-register.py` & `tools/scripts/assessment-action-register.mjs`**:
  - Add `_meta/action-register-workbook-readback.json` to `ACTION_REGISTER_OUTPUTS` (optional when validating legacy
    exports whose `tool_hashes` match `tools/registry/register-tool-compatibility.json`; required for newly rendered
    exports).
  - Generate `_meta/action-register-workbook-readback.json` by reopening the staged `.xlsx` via `openpyxl` in
    `render-assessment-action-register.py`, recording `workbook_sha256`, sheet order, visibility, `formula_cell_count`
    (`0`), header rows, row counts, and cell values per sheet; verify `workbook_sha256` and `formula_cell_count === 0`
    during `validate-export`.
- **`.github/agents/_subagents/challenger-review-subagent.agent.md`**:
  - Add an explicit binary-input rule: never invoke file-view tools on binary `.xlsx` or `.png` paths in
    `supporting_inputs` (their exact bytes are hash-verified by `record-review.mjs`); inspect their paired Markdown,
    `.svg`, `_meta/action-register-export.json`, and `_meta/action-register-workbook-readback.json` artifacts instead.
- **`tools/registry/register-tool-compatibility.json`**:
  - Add the current `main` (`cedf4e50`) `TOOL_FILES` hash map to `register-tool-compatibility.json` so existing
    `partner-modernization-factory-v2` and `arcbox-insights` exports remain valid on resume.

### 2.3 WS3 — Single-Pass Parallel Azure Evidence Collector

- **`tools/scripts/collect-assessment-evidence.py`**:
  - Fix ARG projection alias: `resourceKind=tostring(['kind']), availabilityZones=tostring(zones)`.
  - Capture `subscription_name` (`name` from `az account show` or `displayName` from `/subscriptions/{sub_id}`) on
    every inventory entry and scope summary.
  - Execute per-scope collection in parallel (`ThreadPoolExecutor(max_workers=min(4, len(scopes)))`) while preserving
    deterministic input-scope ordering in output JSON arrays.
  - Add bounded, server-side scalar ARG projections (no raw `properties` blobs, no tags, no secrets/connection strings):
    - `topology` -> `_meta/scalar-topology.json`: VNets (address prefixes, subnet names/prefixes/delegations/NSG/UDR
      IDs, peering state + remote VNet), Private Endpoints (subnet ID, target resource IDs, group IDs, connection
      states), Private DNS zones + VNet links, Firewalls, Bastions, App Gateways, and NIC subnet bindings.
    - `configuration` / `recovery` extras in `_meta/controls-evidence.json`: SQL Managed Instance
      (`storageAccountType`, `licenseType`, `vCores`, `storageSizeInGB`, `publicDataEndpointEnabled`,
      `minimalTlsVersion`), Key Vault (`enableRbacAuthorization`, `enableSoftDelete`, `enablePurgeProtection`,
      `publicNetworkAccess`), Service Bus (`zoneRedundant`, `disableLocalAuth`, `publicNetworkAccess`), App Service &
      ServerFarm (`httpsOnly`, `ftpsState`, `minTlsVersion`, `virtualNetworkSubnetId`, `vnetRouteAllEnabled`,
      `zoneRedundant`).
    - `policy` -> `_meta/scoped-policy-observations.json`: paginated scalar policy assignments (`id`, `name`,
      `displayName`, `scope`, `enforcementMode`, `policyDefinitionId`).
    - `utilization` -> `_meta/metrics-evidence.json`: bounded 7-day average/max CPU/memory/DTU/vCore `az monitor
metrics list` summaries for up to 25 compute/DB resources per scope (`PT1H`), recording `status: "observed"`
      (or `"unknown"` with redacted reason on failure).

### 2.4 WS4 — Token-Clean Multi-View Cost Collector & Retail Pricing Alignment

- **`tools/scripts/collect-assessment-cost.mjs`**:
  - Remove `"--debug"` from `defaultHttpExecutor`; run `az rest` with `--only-show-errors` and `--output-file`,
    parsing HTTP status codes, Azure error codes, and any retry-after seconds in error messages without ever emitting
    request `Authorization` headers into child stderr. Retain `parseAzRestResult` export compatibility for existing
    unit tests.
  - Add `--include-amortized` (executes and validates a companion `AmortizedCost` plan under
    `_meta/amortized-cost/`) and `--include-rg-breakdown` (executes and validates a companion non-forecast
    `["ResourceGroupName", "ResourceId"]` plan under `_meta/resource-group-cost/`).
- **`tools/scripts/cost-estimate.mjs` & `tools/scripts/fetch-retail-price-evidence.mjs`**:
  - Resolve request-binding and captured retail evidence directories under `{output_path}.retail-evidence/` by default
    (matching `.github/agents/_subagents/cost-estimate-subagent.agent.md`), while falling back to legacy
    `{dirname(output_path)}/pricing-evidence/` when reading existing bindings/evidence.
  - Extend `serviceRecipe(line)` for `sql managed instance`, `service bus`, `firewall`, `application gateway`,
    `postgresql` / `database for postgresql`, `mysql` / `database for mysql`, `managed redis`, and `container apps`.

### 2.5 WS5 — Chart Accuracy (`NO ROWS`, Sub-Dollar Labels, Display Names) & Bounded Diagram Validator

- **`tools/scripts/assessment-cost.mjs` & `tools/schemas/assessment-cost.schema.json`**:
  - Add optional `row_count` (`integer >= 0`) and `currency_inferred` (`boolean`) to `costSeries` in
    `assessment-cost.schema.json`, populated by `normalizeCostEvidence` when an empty period borrows currency via
    `inferred_currency_from`.
- **`tools/scripts/render-assessment-charts.py`**:
  - When a period series has `currency_inferred: true` or (`row_count == 0` / empty `groups` with an `"Empty historical
period"` gap), draw a distinct **`NO ROWS`** badge instead of a `0` bar.
  - Format nonzero bar/driver labels accurately: `<0.01` when `0 < abs(val) < 0.01`, two decimals (`f"{val:,.2f}"`)
    when `0.01 <= abs(val) < 10`, and integer/compact formatting for `>= 10`.
  - Resolve scope display names from `contracts/assessment-evidence.json` (`subscription_name`), `_meta/live-inventory.json`,
    or `_meta/user-brief.json` (`gh-shared (706f47e8)`), falling back to `Sub N (<prefix>)` only when absent.
- **`tools/scripts/validate-assessment-diagram.py`, `.github/agents/04-design.agent.md` & `standalone-assessment.md`**:
  - Add a reusable CLI validator `tools/scripts/validate-assessment-diagram.py --project-dir <dir>` checking primary
    `assets/03-des-diagram.{py,png,svg}` existence, valid PNG/SVG headers & dimensions, absence of full subscription
    GUIDs/secrets in SVG text, and optional `assets/03-des-coverage.json` subscription/resource-count reconciliation.
  - Bound standalone assessment `04-Design` deliverables to `03-des-diagram.{py,png,svg}` (+ at most 1 optional
    `03-des-inventory.{py,png,svg}` companion for `>80`-resource multi-subscription scopes) with compact resource-family
    count badges inside secondary subscription boxes on the primary diagram.

### 2.6 WS6 — WAF Scoring Guardrails, Fast Scope Intake & Documentation

- **`.github/agents/03-architect.agent.md` (`< 350` lines) & `assessment-cost-contract.md`**:
  - Explicitly state that query/telemetry collection success belongs in **Coverage**, never in WAF pillar control
    denominators; Cost Optimization checks score workload controls only.
  - Direct `03-Architect` to invoke stock `collect-assessment-evidence.py` and `collect-assessment-cost.mjs
--include-amortized --include-rg-breakdown` directly rather than writing custom `_meta/scratch/` collectors.
- **`.github/prompts/waf-assess-existing.prompt.md`**:
  - Add scope-intake read boundary: read `standalone-assessment.md` and `session-state.schema.json` at `scope` intake;
    defer worker scripts and subagent definitions to delegated phase owners.
- **`CHANGELOG.md`**:
  - Document the v2.1 standalone assessment reliability, collector, pricing, and chart improvements.

---

## 3. Rubber-Duck Review Dispositions (12 Findings Incorporated)

1. **Cost replay exact-equality (`assessment-cost.mjs:712`)**: Do **not** mutate `normalizeCostEvidence` output shape
   (which would invalidate saved `contracts/03-cost-management.json` on existing runs at `review`); instead detect
   0-row inferred-currency slices directly in `render-assessment-charts.py` from `entry["status"] == "complete"`,
   `not series.get("groups")`, and `"Empty historical period"` in `entry.get("gaps", [])`.
2. **Receipt-aware freeze binding (`assessment.py:777`)**: Require `_meta/action-register-workbook-readback.json` in
   `frozen_inputs` only when `_meta/action-register-export.json` contains `readback_sha256`, preserving legacy exports
   and frozen `v2`/`v3` bundles untouched on resume without input refresh.
3. **Byte-for-byte read-back verification (`assessment-action-register.mjs:818`)**: Stage read-back atomically alongside
   `.md` and `.xlsx`, store `readback_sha256` in `_meta/action-register-export.json`, and in `validate-export`
   recompute the canonical read-back JSON directly from the validated `.xlsx` and assert byte-for-byte digest equality.
4. **Audit reconciliation & ordering (`review_audit.py:31` & `record-review.mjs:412`)**: Mirror the root
   `preToolUse`/`postToolUse` + `subagent.started`/`subagent.completed` fallback in `review_audit.py:reconcile_events`
   so live-buffered root dispatches do not appear as `ledger_without_native_dispatch`, and enforce full event ordering
   (`preToolUse < subagent.started < ... < subagent.completed < postToolUse`) and error checks in `record-review.mjs`.
5. **Serialized `review-audit` state writes (`state_writer.py:432`)**: Require sequential `review-audit ... --attempt-outcome
started` writes before parallel `task` dispatch and sequential `record-review.mjs` + `review-audit ... --attempt-outcome
completed` writes afterward so concurrent processes never contend on `00-session-state.json.lock`.
6. **Isolated companion cost directories (`collect-assessment-cost.mjs`)**: Run `--include-amortized` into
   `projectRoot = _meta/amortized-cost` and `--include-rg-breakdown` into `projectRoot = _meta/resource-group-cost`,
   each validated against its own saved `_meta/cost-plan.json`, never overwriting primary `contracts/03-cost-management.json`.
7. **Canonical `{dirname(output_path)}/pricing-evidence/` alignment (`_lib/pricing-evidence.mjs:124`)**: Keep the code's
   canonical `{dirname(output_path)}/pricing-evidence/` directory and shared `request-ledger.json` budget intact; update
   `cost-estimate-subagent.agent.md`, `cost-estimate-parent-contract.md`, and `pricing-guidance.md` to authorize
   `{dirname(output_path)}/pricing-evidence/` (alongside `{output_path}.retail-evidence/`).
8. **Deliberate test updates (`test_assessment_cost.mjs:1337`)**: Update the `--debug` CLI assertion in
   `test_assessment_cost.mjs` to assert `--only-show-errors` (no `--debug`), keep `parseAzRestResult` exported and
   backward-compatible, and add token-clean 429/error tests.
9. **Child-resource scope filters & allowlisted metric errors (`collect-assessment-evidence.py`)**: Apply `where
{where_clause}` before `mv-expand`/`project` on all child ARG queries with explicit `--subscription {sub_id}`,
   distinguish `unsupported_or_empty_metric` from `observed`, and emit allowlisted error codes rather than raw stderr.
10. **Strict `contracts/assessment-evidence.json` keys (`assessment.py:728`)**: Keep `contracts/assessment-evidence.json`
    restricted to `{coverage, checks}`; store `subscription_name` in `_meta/live-inventory.json` (`inventories[]`).
11. **Signed sub-cent formatting (`render-assessment-charts.py`)**: Preserve negative signs on sub-cent credits
    (`-<0.01` vs `<0.01`) and test both positive and negative sub-cent/sub-dollar values.
12. **`03-architect.agent.md` body budget & test regexes**: Preserve exact regexes tested in
    `test_standalone_assessment.mjs:59` and `test_post_write_validation.mjs:157` while keeping body lines `< 350`.
