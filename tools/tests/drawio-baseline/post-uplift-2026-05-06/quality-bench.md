# Draw.io Quality Bench — 2026-05-06-postup

Post-uplift comparison vs. baseline at `tools/tests/drawio-baseline/regen-baseline.json`.

## Verdict

| Metric | Value |
| --- | --- |
| Phase-3 gate | **FAIL** |
| Scenarios captured | 7/7 |
| Baseline mean cost / .drawio | 4.14 |
| Current mean cost / .drawio | 4.29 |
| Cost reduction | 0.0% (target ≥40%) |
| Current mean rubric | 3.51/4 (target ≥3/4) |

## Per-scenario summary

| ID | retries | friction | cost | rubric | validator (T-006/7/8/9/10 + palette) |
| --- | :-: | :-: | :-: | :-: | --- |
| g1-three-tier-web | 0 | 2 | 2 | 3.29 | 0/0/0/0/0 + 0 |
| g2-hub-spoke-landing-zone | 0 | 5 | 5 | 3.43 | 6/0/0/1/0 + 0 |
| g3-event-driven-microservices | 0 | 4 | 4 | 3.43 | 0/0/1/1/1 + 0 |
| g4-ml-training-pipeline | 0 | 5 | 5 | 3.14 | 0/0/0/0/0 + 0 |
| g5-enterprise-landing-zone | 0 | 4 | 4 | 3.57 | 0/0/0/0/0 + 1 |
| g6-hyperscale-platform | 0 | 6 | 6 | 3.71 | 1/0/0/0/0 + 1 |
| g7-multi-region-active-active | 0 | 4 | 4 | 4.00 | 0/0/1/0/0 + 0 |

## Phase-3 exit criteria (per plan §Validation Strategy)

- ✅ All 7 golden scenarios captured
- ❌ Mean cost reduction ≥ 40% vs. baseline
- ✅ Mean rubric ≥ 3/4 across all dimensions
- ⚪ Validator extensions clean on all 7 goldens (manual gate — see per-scenario validator column)

## Artifacts

- JSON snapshot: `agent-output/_bench/drawio-quality-uplift/2026-05-06-postup/quality-bench.json`
- This report: `agent-output/_bench/drawio-quality-uplift/2026-05-06-postup/quality-bench.md`
- Baseline source: `tools/tests/drawio-baseline/regen-baseline.json`
- Working file: `tools/tests/drawio-baseline/_baseline-runs.json`
- Post-uplift runs: `agent-output/_bench/drawio-quality-uplift/2026-05-06-postup/post-runs.json`

Run side-by-side render with `node tools/scripts/render-golden-diff.mjs --post=2026-05-06-postup` once the post-uplift recapture exists.
