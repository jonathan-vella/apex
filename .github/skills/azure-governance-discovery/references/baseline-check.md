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

1. Check whether `.github/data/governance-policy-baseline.json` exists.
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
   - Extract the subscription entry from the baseline JSON.
   - Write it to a temporary file.
   - Run `render_cached_governance.py`:

     ```bash
     set +H && python .github/skills/azure-governance-discovery/scripts/render_cached_governance.py \
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
