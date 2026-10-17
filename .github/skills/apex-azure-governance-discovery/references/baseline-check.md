<!-- ref:baseline-check-v1 -->

# 04g-Governance Phase 0.45 — Committed-Baseline Check

Detailed procedure for the cached-governance baseline short-circuit. The
04g-Governance agent references this file from its Phase 0.45 section.

This phase runs only if Phase 0.4 (Resume-Complete Short-Circuit) did
NOT short-circuit.

## Why this exists

Avoids live Azure calls entirely when a committed governance baseline
already covers the target subscription. Useful for repeated runs on the
same subscription and for offline / sandboxed environments.

> Baseline freshness is branch-local: on feature branches that lag
> `main`, the visible baseline will also lag.

## Procedure

1. Check whether `.github/data/governance-policy-baseline.json.gz` exists.
   If `--get baseline_kind` prints `alz-corp-default`, follow
   [ALZ Corp default baseline](#alz-corp-default-baseline-assumed-governance) instead of steps 2-5.
2. If it exists, read the target subscription ID from the project's
   `02-architecture-assessment.md` or session state.
3. **All** eligibility conditions must be true:
   - The target subscription exists as a key in `subscriptions`.
   - The target subscription is NOT in `subscriptions_skipped` or
     `subscriptions_excluded`.
   - The subscription entry has `discovery_status == "COMPLETE"`.
   - The top-level `coverage_status == "COMPLETE"` OR the target
     subscription is individually present and complete despite partial
     overall coverage.
4. If eligible, use `askQuestions` to ask the user:
   _"A governance baseline from {date} is available for subscription
   {id}. Use the cached baseline or run fresh live discovery?"_
   Options: **Use baseline** (recommended) | **Run live discovery**.
5. If the user chooses baseline:
    - Extract the subscription entry through the shared loader:

       ```bash
       python3 .github/skills/apex-azure-governance-discovery/scripts/governance_baseline.py \
          .github/data/governance-policy-baseline.json.gz \
          --subscription "<sub-id>" > /tmp/{project}-baseline-sub.json
       ```

   - Write it to a temporary file.
   - Run `render_cached_governance.py`:

     ```bash
     set +H && python .github/skills/apex-azure-governance-discovery/scripts/render_cached_governance.py \
         --in /tmp/{project}-baseline-sub.json \
         --out agent-output/{project}/04-governance-constraints.json \
         --arch agent-output/{project}/02-architecture-assessment.md
     ```

   - Read the first stdout line for status JSON.
   - Copy `.preview.md` to `04-governance-constraints.md` — treat it as
     freshly generated. Do NOT reuse any prior annotated markdown from
     the agent-output folder.
   - Proceed directly to Phase 2 (Generate Artifacts / validation).

6. If the baseline file is missing, eligibility fails, or the user
   chooses live discovery, proceed to Phase 0.5 (Cache-First Check).
## ALZ Corp default baseline (assumed governance)

The repository ships an offline-generated baseline (`baseline_kind: alz-corp-default`): the default policy a
subscription inherits under the Azure landing zone Corp management group (`root`, `landing_zones` and `corp`
archetypes, pinned in `alz_library_ref`). It holds one synthetic subscription entry, so no target subscription
ID ever matches. It is **assumed governance**, never discovered policy, and adopters replace it by running the
tenant baseline workflow.

1. Read the file's `baseline_kind` and `alz_library_ref`:

   ```bash
   python3 .github/skills/apex-azure-governance-discovery/scripts/governance_baseline.py \
     .github/data/governance-policy-baseline.json.gz --get baseline_kind
   ```

2. When the target subscription is not a key in `subscriptions`, use `askQuestions` with the options
   **Run live discovery** (recommended when Azure access exists) and **Use ALZ Corp default as assumed
   governance**. Never choose the default on the user's behalf.
3. If the user picks live discovery, proceed to Phase 0.5.
4. If the user picks the default, extract and render it:

   ```bash
   python3 .github/skills/apex-azure-governance-discovery/scripts/governance_baseline.py \
     .github/data/governance-policy-baseline.json.gz --alz-default > /tmp/{project}-baseline-sub.json
   ```

   Then run `render_cached_governance.py` as in step 5 above, adding `--subscription <target-subscription-id>`.
   The renderer refuses the default without it and writes the target ID, not the synthetic baseline ID, into the
   artifact (the synthetic ID stays in `provenance.baseline_subscription_id`). The preview carries an **Assumed
   governance** banner; keep it in `04-governance-constraints.md`.
5. Record the choice with `apex-recall decide <project> --decision "Governance assumed from the ALZ Corp
   default baseline, not tenant-verified" --rationale "<why live discovery was not used>" --json`.
6. The Step 3.5 governance-reconciliation review stays mandatory; do not bypass it for assumed governance.
   Treat any tag contract as the greenfield fallback, because the ALZ Corp set has no tag policy.
