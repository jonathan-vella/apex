# Plan: Apply nordic-foods + nordic-p1 Lessons (Revised after Adversarial Review)

Goal: every issue observed in the nordic-foods and nordic-p1 chats must be
**impossible (or self-healing)** in the next project. Targeted edits to
existing agents/skills/instructions/validators + two new scripts + one new
banned-phrase lint. No new skills.

> **Revision history**: v1 reviewed adversarially → 7 must-fix + 11 should-fix
> findings. v2 (this document) incorporates all findings; verifies apex-recall
> `show.py` actually omits `.steps` (not just shapes it wrong); confirms
> "IaC Planner" is a legitimate agent name and the banned-phrase guard must
> be scoped to the Architect file only.

## Scope (confirmed)

In scope (next-project prevention):

- 03-Architect — SKU-first flow, budget gate, per-finding askMe,
  cost-feasibility conditional, sku-manifest MD write, correct handoff
  target (Design **or** Governance depending on `skip_design`),
  challenger empty-output diagnostic.
- 04-Design — Python-vs-Drawio choice (**Drawio remains default**),
  Drawio MCP `import-diagram` input contract, surrogate-pair root-cause
  reproducer.
- 04g-Governance — same-region silent default with audit marker,
  tag-baseline-from-Policy; decide a defensible lowercase fallback for
  greenfield based on CAF guidance.
- cost-estimate-subagent — canonical alias table + mandatory pre-call
  normalisation + unresolved-SKU triage + feedback loop into the
  alias table.
- 07b/07t Deploy agents + apex-recall — make `show --json` actually
  emit `steps`, then provide a schema-aware jq query.
- SKU manifest pipeline — MD↔JSON sync via renderer + validator + hook
  - CI re-render diff gate.
- Banned-phrase lint scoped to `03-architect.agent.md`, copilot-instructions,
  and `04g-governance.agent.md`.
- Site docs propagation.
- End-to-end acceptance test that replays the nordic-foods scenarios.

Out of scope (deliberate):

- Step 7 docs for nordic-foods — premise was wrong (deployment did NOT
  succeed); folded into Phase H below as separate work, not prevention.
- New skills.
- Orchestrator agent rewrite (legit `05-IaC Planner` references stay).

## Decision keys used by this plan

Recorded once per project, then read by gates. All registered in new
`tools/apex-recall/docs/decision-keys.md`:

| Key                       | Values                                             | Set by       | Read by                       |
| ------------------------- | -------------------------------------------------- | ------------ | ----------------------------- |
| `sku_confirmation_status` | `approved` \| `revising`                           | A1 askMe     | A1 gate; cost subagent invite |
| `budget_decision`         | `approve_overage` \| `revise_sku` \| `revise_reqs` | A2 askMe     | A2 gate                       |
| `cost_feasibility_review` | `run` \| `skip`                                    | A4 rule      | A4 gate                       |
| `diagram_tool`            | `drawio` (default) \| `python`                     | D1 askMe     | D2 path switch                |
| `skip_design`             | `true` \| `false`                                  | Orchestrator | A5 routing message            |
| `review_depth`            | `default` \| `deep`                                | Orchestrator | challenger invocations        |

## TL;DR

Eleven phases. A–F, I are independent prevention edits. Phase G
(renderer + schema fixes) blocks A6, B2, F1. Phase H closes nordic-foods
(separate work item). Phase J is acceptance test. Phase K is
cross-cutting guards.

```text
G ─┬─► A6, B2 (sku-manifest sync)
   └─► F1 (jq query)
A1–A5, A7 ◄── independent ──► C, D, E, I, K
                                                ▼
                                                J (acceptance test, last)

H = parallel, separate work item, NOT prevention.
```

## Phase A — `03-Architect` overhaul

Single file: `.github/agents/03-architect.agent.md`.

A1. **SKU confirmation gate before cost subagent.** New Phase 3a between
Phase 6 (compaction) and Phase 7 (delegate pricing) in "Core Workflow
→ Steps" (~lines 220–260). `vscode_askQuestions` shows ONLY
`services[]` rows where `source: "architect-derived"`. User-pinned
rows shown in read-only context block above the question, never in
answer options. Options: Approve / Revise SKUs / Discuss. On
Approve: `decisions.sku_confirmation_status = "approved"` and
continue to A2.

A2. **Budget gate after pricing.** New Phase 7.5 after pricing-receive.
If `01-requirements.md` declares a budget (`budget_cap_known`): when
`monthly_total > budget_cap`, blocking `vscode_askQuestions` with
three options — Approve overage, Revise SKUs (loop to A1), Revise
requirements (return to 02-Requirements). Cap revise loop at
**3 iterations**; hard-stop after that. Record via
`apex-recall decide --key budget_decision`.

A3. **Per-finding askMe.** Update "## Approval Gate" (~line 408): one
`vscode_askQuestions` call PER finding (Accept / Skip / Defer +
rationale). Explicit rule: **"MUST NOT batch findings into a single
question with multiSelect."** Worked example: 5 findings ⇒ 5
sequential questions.

A4. **Cost-feasibility review made conditional.** New H3 under
"## Adversarial Review" titled `### Cost-feasibility review — when
    to skip`. Document pros/cons. Rule:
`run = (budget_cap_known AND monthly_total > 0.8 * budget_cap)
    OR decisions.review_depth == "deep" OR NOT budget_cap_known`.
Otherwise skip. Record `decisions.cost_feasibility_review`.
Architecture comprehensive review always runs; only cost-feasibility
lens is gated.

A5. **Fix the wrong handoff string AT THE SOURCE, then guard it.** Two
specific lines say literal "IaC Planner" in Architect-approval
contexts (verified):

    - Line 178: `- ✅ Wait for user approval before handoff to IaC Planner`
      → rewrite to: `- ✅ Wait for user approval before handoff to the
      next step (Design when `decisions.skip_design == false`, else
      Governance Discovery — never directly to IaC Planner)`.
    - Line 442: `- **On Proceed**: present final handoff to IaC Planner agent.`
      → rewrite to: `- **On Proceed**: present final handoff via the
      `<approval_gate_message_template>` block (routes to 04-Design or
      04g-Governance based on `decisions.skip_design`).`

    Add new `<approval_gate_message_template>` block (~line 410) with
    branching templates:

    ```
    if decisions.skip_design == true:
      "Reply approve and I'll run `apex-recall complete-step <project> 2`
       and hand off to **Governance Discovery (Step 3.5)**."
    else:
      "Reply approve and I'll run `apex-recall complete-step <project> 2`
       and hand off to **Design (Step 3)** for diagrams/ADRs, then
       Governance Discovery (Step 3.5)."
    ```

    Explicitly forbid emitting "IaC Planner" or "Step 4" from this gate.
    Verified scope: other agents' "IaC Planner" mentions are legitimate
    (`05-IaC Planner` is a real agent name; governance line 463 hands off
    to it correctly). Only Architect misroutes.

A6. **sku-manifest.md sync via renderer.** After rev-2 JSON write
(~line 146), invoke
`node tools/scripts/render-sku-manifest-md.mjs <project>` (Phase G).
Self-validation: re-read MD, assert Overview "Current revision" cell
equals JSON `current_revision`. Fail-hard otherwise.
**Depends on Phase G.**

A7. **Challenger empty-output diagnostic + bounded retry.** Update
`challenger-review-subagent` invocation block (~line 360). Before
any retry, log a structured failure record to
`agent-output/{project}/_meta/challenger-failures.json` with:
timestamp, output_path, return-summary verbatim, output-file size
in bytes, last error message. Then retry once with identical inputs.
After second failure: STOP, surface the structured log to the user,
do NOT proceed to Approval Gate.

## Phase B — SKU Manifest MD↔JSON sync

Depends on Phase G.

B2. **Extend `tools/scripts/validate-sku-manifest.mjs`.** Add assertion
that MD's "Current revision" cell equals JSON's `current_revision`.
Fail-hard.

B3. **lefthook pre-commit + CI guard.** lefthook runs renderer when
`sku-manifest.json` is staged, then auto-stages the regenerated MD.
CI workflow runs renderer + `git diff --exit-code` on
`**/sku-manifest.md` — fails the PR if MD is stale. Belt and braces:
A6 is primary control (in-flow), B3 protects humans, CI catches
both.

B4. **Update `.github/instructions/sku-manifest.instructions.md`.** New
"MD↔JSON sync" section. Remove guidance that says agents hand-edit
MD. Replace with: "MD is rendered from JSON via
`tools/scripts/render-sku-manifest-md.mjs`. Agents write JSON only."

## Phase C — cost-estimate-subagent SKU resolution

C1. **Canonical SKU alias table** in
`.github/skills/azure-defaults/references/pricing-guidance.md` — new
H2 "Canonical SKU Aliases" mapping variant names to MCP-returned
`sku_name`. Seed: SQL DB serverless (`"2 vCore General Purpose
    Serverless Gen5"` → `"2 vCore"`), App Service Plans (`"P1v3 Linux"`
→ `"P1v3"`, `"P0v3"` → `"P0v3"`), Storage replication (`"Standard
    ZRS"` → `"Standard_ZRS"`), ACR tiers.

C2. **Mandatory pre-call normalisation.** In
`cost-estimate-subagent.agent.md` lines 177–186, change
canonical-rewrite from soft suggestion to MUST. Add example matrix
of 4–6 rewrites. Guard: "If alias table doesn't contain the input
`sku_name`, do not guess — record in `<unresolved_sku_triage>` (C3)
and proceed."

C3. **`<unresolved_sku_triage>` block.** New sub-block after line 240.
For each unresolved SKU, record: (a) input `sku_name`, (b) resolved
`product_filter`, (c) top 3 closest matches from `line_items[]`,
(d) subagent's best-guess canonical form as `proposed_alias`.
Output: appended to new `proposed_aliases[]` array in cost JSON.

C4. **Smoke test + feedback loop.** Create
`tests/cost-estimate-subagent/sku-alias-resolution.test.mjs` —
parses every alias in `pricing-guidance.md`, asserts each resolves
to a priced line via recorded MCP fixture. Also
`tools/scripts/promote-sku-aliases.mjs`: scans recent
`cost-estimate-*.json` files under `agent-output/`, extracts
`proposed_aliases[]`, opens a PR appending them to
`pricing-guidance.md`. Monthly cron + manual on-demand.

## Phase D — `04-Design` agent: tool choice + Drawio contract

D1. **Phase-0 tool-choice gate.** ~line 110 of `04-design.agent.md`.
`vscode_askQuestions`:

    - "Draw.io (Azure-brand icons, higher visual quality)" — **recommended**
      [default — every existing artifact uses Drawio]
    - "Python diagrams (faster, lower visual fidelity, generic icons)"

    Record `decisions.diagram_tool`. Skip on subsequent invocations.

D2. **Two-path workflow** gated on `decisions.diagram_tool`. Drawio path
is existing workflow (steps 1–8). Python path uses existing
`python-diagrams` skill — read on Python path only.

D3. **Drawio `import-diagram` input contract guard.** Two-pronged:

    - Add explicit warning block in `04-design.agent.md` Drawio Workflow
      section: "`import-diagram` `xml` field accepts **XML content**, NOT
      a file path. If you have a path, read the file first via
      `read_file` and pass the content string."
    - Same warning in `.github/skills/drawio/SKILL.md` next to every
      `import-diagram` reference.

D4. **Timing budget.** Subsection: "A typical 12-resource diagram
completes in ≤ 3 minutes. If exceeded, abort, run `clear-diagram`,
rebuild from clean base."

D5. **Drawio Deno crash — root-cause reproducer FIRST.** Do NOT add a
sanitiser pass blindly. Instead:

    D5a. `tests/drawio/reproduce-surrogate-error.test.mjs` captures
       the exact byte at column 9879 from the log fixture. Identify the
       offending payload.
    D5b. Based on reproducer finding, pick the right fix:
       - Shape names contain non-BMP characters → fix Deno server's
         UTF-16 surrogate-pair encoding (proper pair-encode, not strip).
       - VS Code LSP transport corrupts > 8 KB messages → chunk response.
       - MCP server emits raw `\uD800`-class half-pairs → pre-write
         validator that rejects malformed UTF-16 (not silent sanitiser).
    D5c. Pin Deno version in `tools/mcp-servers/drawio/` (devcontainer
       config or `post-create.sh`).
    D5d. Write `/memories/repo/drawio-mcp-surrogate-trap.md` after fix.

## Phase E — `04g-Governance` defaults

E1. **Drop same-region question, record assumption.** In
`04g-governance.agent.md` Phase 2.7 (lines ~80, 410, 495) remove
"RG/resource same-region enforcement" from the `vscode_askQuestions`
panel. `discover.py` sets `location_constraints.same_region: true`
silently. Governance JSON also gets:
`location_constraints.same_region_source: "default-assumption"` and
`auditable: true` so Step 4 challenger and Step 7 As-Built see the
assumption explicitly. Only raise the question if discovery finds a
policy that explicitly allows cross-region AND assessment includes
multi-region resources. Phase 2.7 now has 2 questions max.

E2. **Tag baseline from live policy, never hard-coded.** Remove every
assumption about "default 4 PascalCase tag baseline". Discovered tag
set always wins. `tag_contract.source` becomes `"policy"` only;
remove `"baseline-default"` as valid value.

E3. **Rewrite `.github/copilot-instructions.md` tags table** (lines
22–24). Replace:

    > Minimum baseline (PascalCase, exact casing): `Environment`,
    > `ManagedBy`, `Project`, `Owner`.

    With:

    > Tag schema is **whatever live Azure Policy enforces** in the
    > target subscription. Governance Discovery (Step 3.5) discovers the
    > real contract; that always wins.
    >
    > **Greenfield fallback** (no tag policy found at any inherited
    > scope): `environment`, `owner`, `costcenter`, `project` —
    > lowercase per Microsoft CAF tag-strategy guidance (citation in
    > `azure-defaults/references/tag-strategy.md`).

E4. **Create `tag-strategy.md`.** New file
`.github/skills/azure-defaults/references/tag-strategy.md`. Cite
Microsoft Learn CAF tag guidance. State explicitly: Microsoft does
not prescribe casing; lowercase is the most common Azure-native
convention. PascalCase 4-tag set demoted to "deprecated convention;
do not propagate to new projects." Include greenfield decision
checklist.

## Phase F — Bicep/Terraform deploy agents + apex-recall

F1. **VERIFIED GAP: `show.py` does NOT emit `steps` at all.** Confirmed
by reading `tools/apex-recall/src/apex_recall/commands/show.py`:
returned `session` dict has `current_step, iac_tool, region,
    updated, decisions, open_findings, decision_log` — **no `steps`
field**. Original `.steps[] | select(.id == …)` query failed
because the field is missing (jq iterates `null`).

    Three-part fix:

    F1a. **Add `steps` to `show.py` output.** Patch `session` dict
       construction to include `"steps": data.get("steps", {})`. Steps
       stored as object keyed by string ids (`"1"`, `"2"`, `"3_5"`,
       etc., verified in `_STEP_TEMPLATE`). Default `{}` ensures jq
       never iterates null.

    F1b. **Fix jq queries in 07b/07t deploy agents.** Audit
       `.github/agents/07b-bicep-deploy.agent.md` and
       `.github/agents/07t-terraform-deploy.agent.md` for any documented
       `apex-recall show … | jq` patterns. Replace with:

       ```bash
       apex-recall show <project> --json \
         | jq '.session.steps | to_entries[] \
             | select(.key=="5" or .key=="6") \
             | {step: .key, status: .value.status, sub_step: .value.sub_step}'
       ```

       Keys are strings — `.key=="5"` correct, no `tonumber` coercion.

    F1c. **Migration scan for `.steps` consumers.** Before merging F1a,
       grep all agents and tooling for `.steps` / `steps[` /
       `session.steps` usage. Document each in
       `agent-output/_meta/apex-recall-steps-consumers.md`. F1a is
       **not** truly breaking (current value is absent, not `null`),
       but the audit catches silent assumptions.

F3. **Document show schema.** Create
`tools/apex-recall/docs/show-schema.md` with the exact dict shape
emitted by `show.py`. Cross-link from `.github/copilot-instructions.md`
Session State section and `AGENTS.md`.

## Phase G — Renderer + schema fixes (blocking dependency)

G1. **`tools/scripts/render-sku-manifest-md.mjs`** — reads
`agent-output/{project}/sku-manifest.json`, renders MD per
`.github/skills/azure-artifacts/templates/sku-manifest.template.md`.
Must handle:

    - Simple placeholders: `{project-name}`, `{default_region}`,
      `{current_revision}`, `{updated_at}`.
    - Array placeholders: `{environments[]}` (comma-joined),
      `{services[]}` (row per entry).
    - Conditional sections: "Per-environment overrides" renders only
      services with non-empty `environment_overrides`; "As-built actual
      SKUs" renders only if any service has `actual_sku`.
    - Deterministic ordering: services by `id` lexicographic.
    - Idempotent: byte-equal output on repeat runs.

G2. Unit test `tools/tests/render-sku-manifest-md.test.mjs` — fixture
JSON + expected MD; assert byte-equality across two runs; assert
revision-mismatch fixture surfaces.

G3. **`show.py` patch** — F1a addition. Unit test
`tools/apex-recall/tests/test_show_steps.py` asserting empty
project (`steps: {}`) and populated project (`steps: {"1": {...}}`).

## Phase H — Close out nordic-foods (NOT prevention; separate work item)

Per N4, split into its own track. Do not run with prevention phases.

H1. **ACR Basic + AVM trap remediation** in
`infra/bicep/nordic-foods/modules/registry.bicep`. **Probe order**:

    1. Upgrade AVM `container-registry/registry` to `0.13.x` or latest;
       check if a `disableNetworkRuleSet` parameter is exposed.
    2. If yes, pin upgrade + set flag.
    3. If no, pass `networkRuleSetDefaultAction: 'Allow'` if module
       allows it for Basic.
    4. If still no, replace AVM call with raw
       `Microsoft.ContainerRegistry/registries@2023-07-01` for Basic
       only (Premium retains AVM).

H2. Re-run `az deployment group what-if`; confirm no `networkRuleSet`
on ACR.

H3. `az deployment group create`; only on success, run Step 7 As-Built
suite. The earlier "Deployment succeeded" framing was incorrect —
correction message goes to the user before invoking 08-As-Built.

## Phase I — Backward compatibility + decision-key registry

I1. **Decision-key registry.** New
`tools/apex-recall/docs/decision-keys.md` enumerating valid keys +
values + setter + reader. Validator
`tools/scripts/validate-decision-keys.mjs` checks all
`apex-recall decide --key <k>` references in agent files are in
the registry.

I2. **Migration policy.** Document in
`tools/apex-recall/docs/decision-keys.md`:

    > Behavioural changes in this plan apply only to projects whose
    > Step 1 starts after this plan is merged. In-flight projects
    > (those with `current_step > 0` at merge time) continue with their
    > existing gates to avoid mid-stream surprises. New decision keys
    > are backward-compatible: agents treat absent keys as "default
    > behaviour".

## Phase J — End-to-end acceptance test

J1. **Replay test**: spin up new project (`nordic-foods-replay`) with
same `01-requirements.md` content (sandbox subscription). Run
Steps 1 → 2 → 3.5 → 4 → 5 → 6 to apply. Capture chat transcript.

J2. **Grep transcript** for forbidden patterns (each MUST be absent):

    | Pattern                                        | Origin                |
    | ---------------------------------------------- | --------------------- |
    | `Reply approve.*hand off to.*IaC Planner`     | nordic-p1 architect   |
    | `INVALID_XML`                                  | nordic-p1 drawio      |
    | `Cannot iterate over null`                     | nordic-p1 bicep-deploy|
    | `4 PascalCase tag baseline`                    | nordic-p1 governance  |
    | `Must the resource group.*same region`         | nordic-p1 governance  |
    | `failed to decode message.*surrogate`          | nordic-p1 drawio      |

J3. **Affirmative checks**: transcript MUST include:

    - SKU confirmation panel before any `cost-estimate-subagent` call.
    - Budget gate iff design exceeds budget.
    - Per-finding askMe (question count == finding count).
    - Drawio chosen by default when D1 fires.
    - Governance Phase 2.7 with exactly 2 questions.

J4. **Acceptance criterion**: all forbidden patterns absent AND all
affirmative checks pass. Failure = revisit the relevant phase.

J5. **CI cost mitigation**: J1 runs nightly against `main`, not
per-PR. Per-PR runs only J2 grep against a recorded fixture
transcript checked into `tests/fixtures/nordic-foods-replay/`.

## Phase K — Cross-cutting guards

K1. **Banned-phrase lint scoped per-file** (NOT global — `05-IaC Planner`
references elsewhere are legitimate). New
`tools/scripts/validate-banned-phrases.mjs` with config:

    ```jsonc
    [
      {
        "file": ".github/agents/03-architect.agent.md",
        "regex": "hand(?:\\s|-)?off to (?:the )?IaC Planner",
        "reason": "Architect must route to Design or Governance, not directly to IaC Planner."
      },
      {
        "file": ".github/copilot-instructions.md",
        "regex": "Minimum baseline \\(PascalCase, exact casing\\)",
        "reason": "Tag baseline must derive from Azure Policy; PascalCase is demoted to deprecated convention."
      },
      {
        "file": ".github/agents/04g-governance.agent.md",
        "regex": "RG/resource same-region enforcement",
        "reason": "Same-region is now a silent default; remove the askMe question text."
      }
    ]
    ```

    Wire into `npm run validate:all` and lefthook.

K2. **Site docs propagation.** Update
`site/src/content/docs/concepts/how-it-works/agents.md` and any
per-step pages to reflect: SKU gate, budget gate, per-finding
askMe, Drawio/Python choice, governance defaults, tag baseline
policy. Update any quickstart that screenshots the old "PascalCase
4-tag" message. Run `npm run check-links` in `site/` after edits.

## Relevant files

- `.github/agents/03-architect.agent.md` — Phase A1–A7.
- `.github/agents/_subagents/cost-estimate-subagent.agent.md` — C2, C3.
- `.github/skills/azure-defaults/references/pricing-guidance.md` — C1.
- `.github/agents/04-design.agent.md` — D1, D2, D3, D4.
- `.github/skills/drawio/SKILL.md` — D3.
- `tools/mcp-servers/drawio/` — D5 (after reproducer).
- `.github/agents/04g-governance.agent.md` — E1, E2.
- `.github/copilot-instructions.md` — E3.
- `.github/skills/azure-defaults/references/tag-strategy.md` — E4 (NEW).
- `.github/agents/07b-bicep-deploy.agent.md` — F1b.
- `.github/agents/07t-terraform-deploy.agent.md` — F1b.
- `tools/apex-recall/src/apex_recall/commands/show.py` — F1a, G3.
- `tools/apex-recall/docs/show-schema.md` — F3 (NEW).
- `tools/apex-recall/docs/decision-keys.md` — I1, I2 (NEW).
- `tools/scripts/render-sku-manifest-md.mjs` — G1 (NEW).
- `tools/scripts/validate-sku-manifest.mjs` — B2.
- `tools/scripts/validate-banned-phrases.mjs` — K1 (NEW).
- `tools/scripts/validate-decision-keys.mjs` — I1 (NEW).
- `tools/scripts/promote-sku-aliases.mjs` — C4 (NEW).
- `tools/tests/render-sku-manifest-md.test.mjs` — G2 (NEW).
- `tools/apex-recall/tests/test_show_steps.py` — G3 (NEW).
- `tests/cost-estimate-subagent/sku-alias-resolution.test.mjs` — C4 (NEW).
- `tests/drawio/reproduce-surrogate-error.test.mjs` — D5a (NEW).
- `tests/fixtures/nordic-foods-replay/` — J5 (NEW).
- `.github/instructions/sku-manifest.instructions.md` — B4.
- `lefthook.yml` — B3 wiring.
- `.github/workflows/*` — B3 CI re-render diff gate, C4 monthly cron,
  J5 nightly replay.
- `site/src/content/docs/concepts/how-it-works/agents.md` and per-step
  pages — K2.
- `infra/bicep/nordic-foods/modules/registry.bicep` — H1 (separate
  work item, not prevention).

## Verification

| Phase | Validation                                                                                                                                                                                                                                        |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A     | `npm run validate:agents` + `lint:vendor-prompting` + new `validate:banned-phrases` (K1). Manual: dry-run on fixture project asserts SKU panel appears before cost subagent.                                                                      |
| B + G | `npm run validate:sku-manifest` against fixture with MD@rev1 / JSON@rev3 → FAIL; run renderer → PASS; byte-equal across 2 runs. CI re-render diff returns clean.                                                                                  |
| C     | `tests/cost-estimate-subagent/sku-alias-resolution.test.mjs` PASS; manual: invoke subagent on 5-resource list with one non-canonical name → appears in `proposed_aliases[]`, not unresolved.                                                      |
| D     | Replay INVALID_XML scenario → contract guard rejects pre-call. 12-resource Drawio diagram completes ≤ 3 min in clean dev container. Reproducer (D5a) pinpoints exact byte; chosen fix justified in `/memories/repo/drawio-mcp-surrogate-trap.md`. |
| E     | `npm run validate:agents`; fresh `04g-Governance` asks 2 questions; lowercase 9-tag policy → `tag_contract.tags[]` matches with `source: "policy"`. `validate:banned-phrases` catches old same-region text.                                       |
| F     | `apex-recall show <fresh-project> --json \| jq '.session.steps'` returns `{}`. `… \| jq '.session.steps \| to_entries[] \| select(.key=="5" or .key=="6")'` returns 0 or 2 entries without error. `test_show_steps.py` passes.                    |
| H     | `az deployment group what-if` on nordic-foods shows no `networkRuleSet` on ACR; `create` succeeds; Step 7 suite runs. **Not a gate for prevention work.**                                                                                         |
| I     | `validate:decision-keys` passes on all agent files.                                                                                                                                                                                               |
| J     | J2 forbidden-patterns grep returns 0 matches; J3 affirmative checks all green.                                                                                                                                                                    |
| K     | `validate:banned-phrases` passes; `npm run check-links` in `site/` returns no 404s after K2 edits.                                                                                                                                                |

Cross-cutting after every phase: `npm run validate:all`,
`npm run lint:safe-shell`, `npm run lint:artifact-templates`,
`npm run lint:md`.

## Decisions (revised)

- Prevention-first; every fix lands in agent/skill files. nordic-foods
  Step 7 explicitly deferred and not gated by this plan.
- Policy is source of truth for tags; PascalCase 4-tag set demoted to
  **deprecated convention**, lowercase 4-tag documented as greenfield
  fallback (per CAF).
- Same-region is silent default + recorded auditable assumption — not
  silently flipped.
- Per-finding askMe is mandatory; explicit anti-batch rule.
- Drawio remains default for Design; Python is opt-in.
- D5 surrogate fix requires a reproducer FIRST; no blind sanitiser.
- F1 doesn't just "fix the jq" — first adds `steps` to `show.py` output.
  Audit `.steps` consumers across repo before merging.
- Banned-phrase lint is **scoped per-file**, not global.
- Budget-revise loop capped at 3 iterations.
- Plan changes apply to projects starting Step 1 after merge.

## Further considerations

1. **CI cost of acceptance test J1.** Mitigated via J5 — J1 runs
   nightly against `main`, per-PR runs only J2 grep against a recorded
   fixture transcript.

2. **C4 alias-promotion PR cadence.** Monthly cron + manual on-demand
   to avoid stale PRs.

3. **E4 lowercase 4-tag set decision.** Recommend
   `environment, owner, costcenter, project` per common CAF examples;
   open to alternative if Microsoft Learn citation supports differently.

4. **H1 AVM upgrade vs raw resource.** Probe AVM 0.13.x first; if no
   `disableNetworkRuleSet` switch exists, raw resource is safer
   long-term than waiting for AVM module changes.

5. **D5b decision tree depth.** Reproducer may reveal a root cause
   outside the Drawio MCP server (e.g., VS Code chat-input encoding).
   If so, escalate to a VS Code Copilot issue; do not block this plan.
   The contract guard in D3 mitigates the user-facing symptom
   independently.
