# Standalone WAF Assessment & Visuals v2 Improvements

## Plan: Review Provenance Resilience, Deterministic Evidence Collection, Cost Pacing, Bounded Scoring, and Rich Visuals

**Status**: Completed
**Owner**: @jonathan-vella **Created**: 2026-11-11 **Decisions**:

- Stamp mechanical review-snapshot metadata (`cache_inputs` and, only when present on dispatch, `supporting_inputs`)
  from the verified native `APEX_REVIEW` dispatch record in `tools/scripts/record-review.mjs` across both single and
  `batch_results` payloads when omitted by `challenger-review-subagent` (preserving strict failure on explicit `null`
  or conflicting values, and recording the editorial hash transition in `tools/registry/review-contract.json` so
  existing review receipts stay `editorial-compatible`). Add symlink-safe, flush-verified `--events-dir` resolution
  and bounded `publication-retry` support integrated across CLI, `review_audit.py`, `practical.py`, and
  `session-state.schema.json`.
- Add a read-only, scalar-allowlisted collector (`tools/scripts/collect-assessment-evidence.py`) that strictly honors
  per-RG vs. per-subscription `scope.azure_scopes`, per-category `scope.categories` gates, optional disjoint
  `scope.rg_attribution` (`workload_rgs`, `shared_rgs`, `excluded_rgs`), CLI error-string secret/GUID redaction, and
  emits the exact `{coverage, checks}` schema required by `assessment.py:validate_evidence`.
- Separate **physical Cost Management collection** (`tools/scripts/collect-assessment-cost.mjs` with 92-day daily
  historical consolidation eligibility checks, 1.5s pacing, and `Retry-After` / `x-ms-ratelimit-*` backoff) from
  **logical `(scope, period)` evidence** in `tools/scripts/assessment-cost.mjs`: support `physical_slice` provenance
  pointing multiple logical periods at one immutable consolidated response file, and verifiable `inferred_currency_from`
  cross-checked against a complete sibling period of the exact same `(scope, cost_type, metric)`.
- Require **>= 2 observed pillar-relevant checks** for a bounded `0-10` WAF pillar score (unknowns excluded from
  numerator and denominator, paired with `High | Medium | Low` coverage), and add backward-compatible optional
  `disposition` (`remediate_now`, `production_readiness_gap`, `intentional_lab_tradeoff`, `orphan_or_drift_cleanup`,
  `verification_followup`) on Action Register actions — keeping `derived`, Markdown, and `.xlsx` **byte-identical**
  when `disposition` is omitted, plus registered `tool_hashes` compatibility so accepted `v2` bundles stay valid.
- Introduce additive graph `3.3` / `assessment-bundle-v3` (keeping `3.1`/`3.2` and `v1`/`v2` untouched): `03-Architect`
  produces frozen `_meta/waf-scores.json` and runs `tools/scripts/render-assessment-charts.py` during `analysis` to
  emit `assets/02-waf-posture.{png,svg}`, `assets/03-cost-trends.{png,svg}`, and `assets/03-cost-drivers.{png,svg}`
  (never summing overlapping MTD + Forecast history), while `04-Design` applies the Multi-Subscription Existing-State
  `dlib.py` pattern (`<= 10%` canvas height for caveats).

**Progress**:

- [x] P1 (`ws1-review-recorder`): Update `tools/scripts/record-review.mjs`,
      `.github/agents/_subagents/challenger-review-subagent.agent.md`,
      `.github/skills/apex-azure-defaults/references/one-shot-review.md`,
      `tools/apex-recall/src/apex_recall/commands/review_audit.py`,
      `tools/apex-recall/src/apex_recall/practical.py`, and unit tests.
- [x] P2 (`ws2-evidence-collector`): Create `tools/scripts/collect-assessment-evidence.py` + tests; extend
      `tools/schemas/session-state.schema.json` and `tools/apex-recall/src/apex_recall/assessment.py` for optional
      RG attribution; update `.github/agents/01-orchestrator.agent.md` and
      `.github/skills/apex-workflow-engine/references/standalone-assessment.md`.
- [x] P3 (`ws3-cost-resilience`): Extend `tools/scripts/assessment-cost.mjs`,
      `tools/schemas/assessment-cost.schema.json`, and `tools/tests/scripts/test_assessment_cost.mjs` for
      consolidated historical queries, `429` `Retry-After` pacing, and same-scope zero-row currency inference.
- [x] P4 (`ws4-waf-dispositions`): Extend `tools/schemas/assessment-action-register.schema.json`,
      `tools/scripts/assessment-action-register.mjs`, `tools/scripts/render-assessment-action-register.py`,
      `.github/agents/03-architect.agent.md`, `.github/skills/apex-azure-defaults/references/existing-workload-intake.md`,
      and register unit tests.
- [x] P5 (`ws5-assessment-visuals`): Add `tools/scripts/render-assessment-charts.py` + tests; update
      `.github/agents/04-design.agent.md`, `.github/skills/apex-python-diagrams/SKILL.md`,
      `.github/skills/apex-python-diagrams/references/common-patterns.md`, and
      `.github/skills/apex-python-diagrams/references/waf-cost-charts.md`; add graph `3.3` /
      `assessment-bundle-v3` in `workflow-graph.json`, `workflow-graph.schema.json`,
      `validate-workflow-graph.mjs`, and `tools/apex-recall/src/apex_recall/assessment.py`.
- [x] P6 (`ws6-docs-validate-prs`): Update `README.md`, `CHANGELOG.md`, and Explorer graph if needed; pass
      targeted suites + `npm run validate:all`; open PRs in `jonathan-vella/apex-mine` and `jonathan-vella/apex`.

---

## 1. Post-Mortem Context

During the 63-minute `partner-modernization-factory` live assessment across 4 subscriptions (210 resources):

1. **Review closure wedged on LLM hex-copy typos**: `challenger-review-subagent` returned `APPROVED` with zero
   findings twice, yet `record-review.mjs` rejected both attempts because the read-only LLM had to emit 34
   `supporting_inputs` SHA-256 hashes (2,500+ hex chars) and flipped a single hex nibble (`...d8b7...` vs
   `...d8a7...`). Delegated `03-Architect` also hit `ENOENT` locating the parent session's `events.jsonl`.
2. **Ad-hoc CLI probing & uneven depth**: `03-Architect` debugged `az policy assignment list`, diagnostic-settings
   `[]` arrays, and SQL MI property names interactively, inspecting `gh-workload01` deeply while leaving
   `gh-workload02` (111 resources, 73% of October spend) lightly inspected.
3. **Cost Management `429` throttling & empty-month currency gap**: 16 rapid Cost Management calls hit `HTTP 429`
   on 3 queries, and a 0-row September response was marked `not_assessed` for missing currency despite `USD` in
   October and November MTD of the same subscription.
4. **Epistemic paralysis**: All 5 WAF pillars were rated `Not assessed; Low confidence` and all 6 Action Register
   items were `Not quantified`, burying both intentional hackathon trade-offs and real cost leaks (`$276.63/mo`
   Bastion and `northeurope`/`westus2` drift).
5. **Sparse disclaimer visuals**: `03-des-diagram.png` drew only 6 icons out of 210 resources, dedicated ~35% of
   canvas height to prose disclaimers, and produced zero quantitative WAF or Cost charts.

---

## 2. Detailed Workstreams

### 2.1 Workstream 1 — Deterministic Review Metadata Stamping & Session Discovery

- **`tools/scripts/record-review.mjs` & `tools/registry/review-contract.json`**:
  - Keep `preflightReviewRequest(input, root)` unchanged: `input.cache_inputs` is always required, while
    `input.supporting_inputs` remains optional except when private policy evidence is required.
  - In `normalizeReviewDoc(doc, input, root)` (covering both single-review objects and every entry in
    `doc.batch_results`):
    - Stamp `entry.cache_inputs = structuredClone(input.cache_inputs)` **only** when `!Object.hasOwn(entry, "cache_inputs")`.
    - Stamp `entry.supporting_inputs = structuredClone(input.supporting_inputs)` **only** when
      `input.supporting_inputs !== undefined && !Object.hasOwn(entry, "supporting_inputs")`.
    - Explicit `null` or conflicting `cache_inputs` / `supporting_inputs` values remain untouched in
      `normalizeReviewDoc` so `checkReview` continues to fail closed on all tamper cases.
  - Add `--events-dir <abs-dir>` (keeping bare missing `--events` an error):
    - Reject symlinks on `<abs-dir>`, immediate child session directories, and candidate `events.jsonl` files (`lstatSync`).
    - Scan `<abs-dir>/events.jsonl` and `<abs-dir>/*/events.jsonl`, tolerating a trailing partial JSONL line during
      live flush and matching `--request-id` via **both** parent `tool.execution_start` (`matchesRequest`) and worker
      `user.message` fallback (`resolveReviewer` parity).
    - Fail closed if `0` or `>1` files match; run `loadEventsWithFlushWait` on the unique candidate and **re-scan
      `<abs-dir>` after flush** to confirm uniqueness and identity did not change.
  - Record the exact `from` -> `to` SHA-256 pairs for `one-shot-review.md` (`reviewer_contract_sha`) and
    `challenger-review-subagent.agent.md` (`reviewer_definition_sha`) in `tools/registry/review-contract.json`
    (`editorial_compatibility`) so previously recorded review receipts stay `editorial-compatible`.
- **`.github/agents/_subagents/challenger-review-subagent.agent.md` &
  `.github/skills/apex-azure-defaults/references/one-shot-review.md`**:
  - Instruct `challenger-review-subagent` to omit `cache_inputs` and `supporting_inputs` (alongside `id` and
    `severity_counts`).
- **`tools/apex-recall` (`__main__.py`, `commands/review_audit.py`, `practical.py`, & `session-state.schema.json`)**:
  - Clarify that re-running `record-review.mjs` against an already-completed native `events.jsonl` does not invoke a
    new `review-audit --attempt-outcome started` call.
  - Integrate `--attempt-kind publication-retry` end-to-end across CLI parser choices, `review_audit.py`,
    `practical.py` (`prepare_cycle` + `validate_practical_state`), and `session-state.schema.json`:
    - Requires `--retry-of <attempt-id>` where the target attempt belongs to the same cycle, ended `completed` with
      `review_output == "nonempty"`, and has **no** published findings file at its `output_path` / `current_path`.
    - Verifies on-disk `inputs_digest` of `attempt_inputs` matches the prior attempt's `input_digest` (never trusting
      a caller-supplied `--input-digest` string alone).
    - Permitted at most once per cycle (`cycle["publication_retries"] <= 1`) without consuming a substantive
      `cycle["calls"]` slot.

### 2.2 Workstream 2 — Multi-Subscription Evidence Collector & Resource-Group Attribution

- **`tools/scripts/collect-assessment-evidence.py`**:
  - Pure stdlib Python 3.14 CLI (`argparse`, `subprocess`, `json`, `hashlib`, `pathlib`) with injectable command
    runner for offline `unittest.mock` testing.
  - Enforces **both** `scope.azure_scopes` (subscription-level vs. `/subscriptions/<sub>/resourceGroups/<rg>` RG-level
    scoping) and `scope.categories` gates before every probe; never queries categories absent from `scope.categories`
    or RGs outside an RG-scoped entry or inside `rg_attribution.excluded_rgs`.
  - Redacts GUIDs, bearer/SAS tokens, and connection-string patterns from any CLI error messages before persisting.
  - Emits `contracts/assessment-evidence.json` with the **exact** `{coverage, checks}` structure required by
    `assessment.py:validate_evidence` (`{category, scope, status, evidence}` for every approved `(scope, category)`
    excluding `billing` unless cost contract status is supplied, truthfully reporting `denied` / `unknown` / `partial`).
  - Also writes `_meta/live-inventory.json`, `_meta/register-inventory.json`, `_meta/controls-evidence.json`,
    `_meta/diagnostics-recovery-evidence.json`, and `_meta/01-discovered-evidence.json`.
- **`tools/schemas/session-state.schema.json` & `tools/apex-recall/src/apex_recall/assessment.py`**:
  - Add optional `rg_attribution` inside `$defs/assessmentScope` (`workload_rgs`, `shared_rgs`, `excluded_rgs`:
    unique string arrays, validated pairwise disjoint in `assessment.py:validate_scope`).
  - Include `rg_attribution` in `scope_projection(run)` **only when present** in `run["scope"]` so existing scope
    digests remain 100% unchanged.

### 2.3 Workstream 3 — Physical Cost Collection Consolidation, `429` Backoff & Verifiable Empty-Period Currency

- **Keep logical `assessment-cost.mjs plan` (`1` request per `(scope, period)`) unchanged** so `assessment.py:cost_plan`
  and `validateAssessmentCost` request-identity checks remain intact.
- **New `tools/scripts/collect-assessment-cost.mjs` + additive slice/currency verification in
  `tools/scripts/assessment-cost.mjs` & `tools/schemas/assessment-cost.schema.json`**:
  - `collect-assessment-cost.mjs` takes a planned request set (`assessment-cost.mjs plan`) and groups non-forecast
    `query` requests per scope when eligible (`granularity === "Daily"`, identical `cost_type`/`metric`/`group_by`/
    `expected_currency`, UTC day-aligned `from`, `max(to) - min(from) < 92 days`); otherwise executes individual
    period requests. Runs sequentially with `>= 1500ms` pacing, `Retry-After` / `x-ms-ratelimit-*` header parsing on
    HTTP `429`, exponential backoff + jitter, and sensitive-header stripping.
  - Extend `$defs/collection` in `assessment-cost.schema.json` with two optional, cryptographically verifiable fields:
    1. `physical_request_period: { from, to }` — when present on a saved consolidated response file,
       `normalizeCostCollection` validates `page.request_path` against the physical query window and filters daily
       rows strictly within `[request.period.from.slice(0, 10), request.period.to.slice(0, 10)]` (noting intraday
       `month_to_date` boundary granularity in `gaps` as non-blocking, matching Azure Cost Management daily grain).
       Each logical period saves a lightweight wrapper or shares the hashed source with its own `request` envelope.
    2. `inferred_currency_from: { period_id, currency }` — when a historical query has `rowsSeen === 0` and no
       `expected_currency`, `normalizeCostCollection` emits `amount: "0"` in `currency` **only** when
       `inferred_currency_from` is present, and `validateAssessmentCost` cross-checks that the referenced sibling
       `evidence` entry in `report.evidence` has the **exact same `scope`, `cost_type`, and `metric`**, `status === "complete"`,
       non-empty rows/series in that single `currency`, and no conflicting currency on that scope!

### 2.4 Workstream 4 — Bounded WAF Scoring, Action `disposition` & Tool-Hash Compatibility

- **Standardize field name to `disposition`** across `tools/schemas/assessment-action-register.schema.json`
  (`$defs/action.properties.disposition`), `tools/scripts/assessment-action-register.mjs`, and
  `tools/scripts/render-assessment-action-register.py`:
  - Enum: `["remediate_now", "production_readiness_gap", "intentional_lab_tradeoff", "orphan_or_drift_cleanup", "verification_followup"]`.
  - **Zero-diff guarantee for existing inputs**: when `"disposition"` is absent on an action, `derivedActions`,
    `action_rows` (`ACTION_HEADERS` remains 17 columns `A..Q`), `finance_rows`, `basis_rows`, Markdown, and `.xlsx`
    bytes are **100% unchanged**. When `"disposition"` is present, include `disposition` on the derived action,
    prepend `Disposition: <value>` to rendered `Notes`, and emit an `["Action", id, "disposition", value]` row in
    `Basis & Evidence`.
  - Add `tools/registry/register-tool-compatibility.json` checked by `validateAssessmentActionRegisterExport` so
    accepted `v2` bundles (`arcbox-insights`) whose `source_sha256`, `derived_sha256`, `evidence_hashes`,
    `output_hashes`, and live `python("validate", ...)` readback all pass are not invalidated solely by backward-compatible
    `TOOL_FILES` updates (while unknown/unregistered `tool_hashes` tampering still fails closed).
- **Minimum evidence threshold for bounded WAF scoring** (`03-Architect` & `existing-workload-intake.md`):
  - Require **>= 2 observed pillar-relevant checks** to assign a numeric `0-10` score (calculated over observed
    applicable checks only, excluding `unknown` from numerator and denominator, paired with explicit coverage tier
    `High (>=70%) | Medium (35-69%) | Low (<35%)`); pillars with `< 2` observed checks remain `Not assessed`.

### 2.5 Workstream 5 — Assessment Visuals Overhaul (`dlib.py` Pattern, `_meta/waf-scores.json` & Graph `3.3` / `assessment-bundle-v3`)

- **Frozen scoring input & phase ownership (`analysis` phase owned by `03-Architect`)**:
  - Define `tools/schemas/assessment-waf-scores.schema.json` for `_meta/waf-scores.json` (`project`, `as_of`,
    `pillars[]` with `pillar`, `status: "scored" | "not_assessed"`, `score: number | null`, `confidence`,
    `passed_checks`, `risk_checks`, `intentional_tradeoff_checks`, `unknown_checks`).
  - `03-Architect` writes `_meta/waf-scores.json` and runs `tools/scripts/render-assessment-charts.py` during
    **`analysis`** (before advancing `analysis` -> `diagram`), producing:
    1. `assets/02-waf-posture.{png,svg}`
    2. `assets/03-cost-trends.{png,svg}`
    3. `assets/03-cost-drivers.{png,svg}`
  - **Honest chart rules in `render-assessment-charts.py`**:
    - Never add `month_to_date` Query totals to `Forecast` totals; plot historical Query bars (`Preceding`,
      `Previous`, `MTD`) separately from the Forecast API's `Actual` + `Forecast` stacked bar, hatch `not_assessed`
      periods as `N/A`, separate currencies into distinct panels/subtitles if multiple exist, and render clean
      `IaC estimate` or `Cost not assessed` states when live billing is absent.
- **Additive Graph `3.3` & `assessment-bundle-v3`**:
  - Update `workflow-graph.json` (`metadata.version: "3.3"`), `workflow-graph.schema.json` (allow `"3.2"` and `"3.3"`),
    `validate-workflow-graph.mjs` (`knownVersions` includes `"3.3"`), `session-state.schema.json` (`bundle_contract`
    allows `v1`, `v2`, `v3`), and `tools/apex-recall/src/apex_recall/assessment.py` (`GRAPH_VERSIONS` includes `"3.3"`,
    new starts under `"3.3"` default to `"assessment-bundle-v3"` which inherits `action_register` rules and adds a
    `v3` `conditional_produces` entry on `analysis` for `_meta/waf-scores.json` + the 6 PNG/SVG chart files, with
    PNG/SVG header validation in `check_outputs`). Existing `v1` and `v2` runs remain untouched.
- **`04-Design` & `apex-python-diagrams`**:
  - Add the Multi-Subscription Existing-State Assessment `dlib.py` pattern to `references/common-patterns.md` and
    document `render-assessment-charts.py` in `SKILL.md` and `references/waf-cost-charts.md`.

### 2.6 Workstream 6 — Documentation, Validation & Dual-Repo PR Delivery

- Register all new `tools/tests/scripts/test_*.mjs` and `test_*.py` suites in `package.json` test scripts if needed so
  CI runs them automatically; verify `count-manifest.json` and `architecture-explorer-graph.json` with existing
  validators.
- Update `.github/skills/apex-workflow-engine/references/standalone-assessment.md`, `README.md`, and `CHANGELOG.md`.
- Run targeted Node + pytest suites, visually inspect sample charts generated by `render-assessment-charts.py`, pass
  `npm run validate:all` and `validate-branch-scope.sh`, and open PRs in `jonathan-vella/apex-mine` and
  `jonathan-vella/apex`.

---

## 3. Rubber-Duck Review Disposition (2026-11-11)

| #   | Severity     | Finding                                                                                                                                                           | Disposition & Plan Update                                                                                                                                                                                                                                                                              |
| --- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Blocking     | Reviewer guidance edits change `reviewer_contract_sha`/`reviewer_definition_sha`; register/cost edits change `TOOL_FILES` hashes and break existing `v2` exports. | **Adopted**: Record editorial reviewer SHA transitions in `tools/registry/review-contract.json`; guarantee zero byte diff when `disposition` is absent and add `tools/registry/register-tool-compatibility.json` with live readback verification; test accepted `v2` bundle (`arcbox-insights` shape). |
| 2   | Blocking     | Recorder retry was not integrated across CLI, `prepare_cycle`, state validation, and on-disk digest proof.                                                        | **Adopted**: Separate re-recording the same completed `events.jsonl` (zero new `started` audit) from `publication-retry` integrated across `__main__.py`, `review_audit.py`, `practical.py`, and `session-state.schema.json` with on-disk `inputs_digest` verification and `<= 1` retry cap.           |
| 3   | Blocking     | `--events-dir` could miss pre-flush worker messages or follow symlinks/races.                                                                                     | **Adopted**: Enforce `lstatSync` no-symlink checks, support `user.message` fallback + partial trailing line tolerance, wait for flush, and re-scan `<abs-dir>` post-flush to prove uniqueness.                                                                                                         |
| 4   | Blocking     | Collector could exceed RG/category scope and violate `{coverage, checks}` schema.                                                                                 | **Adopted**: Gate every query on `scope.categories` and exact RG/subscription bounds (`scope.azure_scopes` + `excluded_rgs`), redact error strings, and emit exact `{coverage, checks}` records.                                                                                                       |
| 5   | Blocking     | `rg_attribution` needed full `validate_scope`, disjointness, and `scope_projection` digest preservation.                                                          | **Adopted**: Place optional disjoint `rg_attribution` inside `assessmentScope` and include in `scope_projection` only when present so legacy `scope_digest` values stay identical.                                                                                                                     |
| 6   | Blocking     | Changing `assessment-cost.mjs plan` request IDs would break `assessment.py:cost_plan` and `validateAssessmentCost`.                                               | **Adopted**: Keep logical `(scope, period)` plan unchanged; perform physical consolidation + `429` pacing in `tools/scripts/collect-assessment-cost.mjs` backed by verifiable `physical_request_period` slice provenance.                                                                              |
| 7   | Blocking     | Consolidated period eligibility (92-day bound, gaps, intraday MTD) and same-scope currency inference needed cryptographic cross-period validation.                | **Adopted**: Gate consolidation on `< 92` days + daily grain + matching query config with automatic per-period fallback; verify `inferred_currency_from` in `validateAssessmentCost` against a `complete` sibling period of the exact same `(scope, cost_type, metric)`.                               |
| 8   | Blocking     | Graph `3.3` required explicit schema/validator/runtime branches and conditional `v3` outputs so `v1`/`v2` stay unchanged.                                         | **Adopted**: Add explicit `3.3` / `assessment-bundle-v3` branches across `workflow-graph.schema.json`, `validate-workflow-graph.mjs`, `session-state.schema.json`, and `assessment.py` with conditional `v3` outputs.                                                                                  |
| 9   | Blocking     | Chart generation lacked a defined scoring schema, clear phase owner (`03-Architect` vs `04-Design`), and non-overlapping MTD/Forecast rules.                      | **Adopted**: Add `assessment-waf-scores.schema.json` (`_meta/waf-scores.json`) and assign `render-assessment-charts.py` execution to `03-Architect` during `analysis`, never adding MTD Query totals to Forecast totals.                                                                               |
| 10  | Non-blocking | `disposition` vs `finding_disposition` naming drift and workbook readback cell sensitivity.                                                                       | **Adopted**: Standardize on `disposition` and emit zero derived/Markdown/workbook diff when omitted.                                                                                                                                                                                                   |
| 11  | Non-blocking | Single observed control could overstate a pillar score.                                                                                                           | **Adopted**: Require `>= 2` observed pillar-relevant checks for a numeric `0-10` score; otherwise `Not assessed`.                                                                                                                                                                                      |
| 12  | Non-blocking | `supporting_inputs` is optional in preflight except for private policy evidence; batch entries also need stamping.                                                | **Adopted**: Stamp `supporting_inputs` only when `input.supporting_inputs !== undefined && !Object.hasOwn(entry, "supporting_inputs")` across single and `batch_results` entries; reject `null`/conflicts.                                                                                             |
| 13  | Non-blocking | Do not assume Explorer/`count-manifest.json` changes; ensure `package.json` runs new test suites and check agent/skill line caps.                                 | **Adopted**: Wire new tests into `package.json` test scripts and verify line caps + Explorer/count validators directly.                                                                                                                                                                                |
