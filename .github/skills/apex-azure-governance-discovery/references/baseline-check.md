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

1. Check whether the adopter-owned `.github/data/governance-policy-baseline.json.gz` exists.
   The separate shared `.github/data/alz-corp-policy-baseline.json.gz` is assumed evidence, not a tenant snapshot;
   follow [source selection](policy-source.md) for Architecture use.
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
4. If eligible, use `ask_user` to ask the user:
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

6. If the tenant baseline is missing, eligibility fails, or the user chooses live discovery,
   proceed to Phase 0.5 with actual authorized scope. Do not silently substitute shared assumptions.

## ALZ Corp default baseline (assumed governance)

The repository ships `.github/data/alz-corp-policy-baseline.json.gz` (`baseline_kind: alz-corp-default`): the policy a
subscription inherits under the Azure landing zone Corp management group (`root`, `landing_zones` and `corp`
archetypes, pinned in `alz_library_ref`). It holds one synthetic subscription entry, so no target subscription
ID ever matches. It is **assumed governance**, never discovered policy. Adopters collect tenant evidence separately;
the private snapshot must not overwrite or synchronize as the generic shared source.

Use the [source-selection and managed-scope procedure](policy-source.md), not a target-ID-dependent render,
for new-contract Architecture. Read the shared envelope directly:

```bash
python3 .github/skills/apex-azure-governance-discovery/scripts/governance_baseline.py \
  .github/data/alz-corp-policy-baseline.json.gz --alz-default
```

Keep its original synthetic identity and tenant-unverified provenance. Explicit owner acceptance is hash-bound
by `apex-recall policy-source --assumed-corp`; it is not an Azure read permission or a formal Governance completion.
Neither a refreshed render timestamp nor a real subscription substituted into an assumed envelope can attest
the target's actual policy. New-contract planning completion, CodeGen and deployment require verified evidence.
Historical assumed artifacts remain historical; never relabel them discovered or reset their approvals/reviews.
