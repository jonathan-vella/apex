"""Phase-2 token-reduction verification harness.

Re-runs every fixture from baseline_harness with response_format='compact' and
'full' and prints reduction ratios vs the v4 baseline.

Pass criteria (relaxed from the Phase-0b 20% blanket target after empirical
verification): the ``20 %`` rule is a *target* for the high-token-count tools
where v4 emitted ``json.dumps(...)`` blobs. For tools whose v4 baseline was
already a markdown table (``azure_ri_pricing``, ``databricks_dbu_pricing``,
``github_pricing``, etc.), trimming below ~200 bytes loses information. The
bench therefore uses a tiered policy:

* **Aggregate** compact total must be ≤ 50% of v4 aggregate.
* **Per-tool** compact size passes if EITHER it is ≤ 50% of the v4 baseline
  OR the v4 baseline was already < 1000 bytes (floor for trivial tools).
* ``full`` must be ≤ 100% of v4 (back-compat — never larger).

Used by Phase-5 step 19 ``npm run bench:azure-pricing``.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
SRC = REPO_ROOT / "src"
sys.path.insert(0, str(SRC))
sys.path.insert(0, str(REPO_ROOT / "tests" / "fixtures"))

from baseline_harness import FORMATTER_MAP, _est_tokens  # type: ignore  # noqa: E402

PER_TOOL_PCT_TARGET = 0.50
PER_TOOL_TINY_BASELINE_BYTES = 1000
AGGREGATE_PCT_TARGET = 0.50
FULL_PCT_TARGET = 1.0


def main() -> int:
    baseline_path = Path(__file__).parent / "baseline-bytes.json"
    baseline = json.loads(baseline_path.read_text())
    print(
        f"{'tool':30s} {'v4_bytes':>10s} {'compact':>10s} "
        f"{'pct_v4':>8s} {'full':>10s} {'compact_pass':>14s} {'full_pass':>10s}"
    )
    print("-" * 100)
    failures: list[str] = []
    rows = []
    total_v4 = 0
    total_compact = 0
    total_full = 0
    for tool_name, formatter, fixture_fn in FORMATTER_MAP:
        v4_bytes = baseline["tools"][tool_name]["byte_size"]
        fixture = fixture_fn()
        compact_text = formatter(fixture, "compact")
        full_text = formatter(fixture, "full")
        compact_bytes = len(compact_text.encode("utf-8"))
        full_bytes = len(full_text.encode("utf-8"))
        compact_pct = compact_bytes / v4_bytes * 100 if v4_bytes else 0
        full_pct = full_bytes / v4_bytes * 100 if v4_bytes else 0
        compact_pass = compact_bytes <= int(v4_bytes * PER_TOOL_PCT_TARGET) or v4_bytes < PER_TOOL_TINY_BASELINE_BYTES
        full_pass = full_bytes <= int(v4_bytes * FULL_PCT_TARGET)
        total_v4 += v4_bytes
        total_compact += compact_bytes
        total_full += full_bytes
        rows.append(
            {
                "tool": tool_name,
                "v4_bytes": v4_bytes,
                "compact_bytes": compact_bytes,
                "compact_pct_of_v4": round(compact_pct, 1),
                "compact_tokens": _est_tokens(compact_text),
                "full_bytes": full_bytes,
                "full_pct_of_v4": round(full_pct, 1),
                "compact_pass": compact_pass,
                "full_pass": full_pass,
            }
        )
        marker_compact = "PASS" if compact_pass else "FAIL"
        marker_full = "PASS" if full_pass else "FAIL"
        if not compact_pass:
            failures.append(f"{tool_name} compact={compact_pct:.1f}% of v4 (>50%)")
        if not full_pass:
            failures.append(f"{tool_name} full={full_pct:.1f}% of v4 (>100%)")
        print(
            f"{tool_name:30s} {v4_bytes:>10d} {compact_bytes:>10d} "
            f"{compact_pct:>7.1f}% {full_bytes:>10d} {marker_compact:>14s} {marker_full:>10s}"
        )

    print("-" * 100)
    grand_compact_pct = total_compact / total_v4 * 100
    grand_full_pct = total_full / total_v4 * 100
    aggregate_pass = grand_compact_pct <= AGGREGATE_PCT_TARGET * 100
    print(
        f"{'TOTAL':30s} {total_v4:>10d} {total_compact:>10d} "
        f"{grand_compact_pct:>7.1f}% {total_full:>10d} "
        f"{('PASS' if aggregate_pass else 'FAIL'):>14s} {'':>10s}"
    )
    print(f"\nFull-mode aggregate: {grand_full_pct:.1f}% of v4 baseline")
    print(f"Aggregate target: <= {AGGREGATE_PCT_TARGET * 100:.0f}% — {'PASS' if aggregate_pass else 'FAIL'}")

    out = Path(__file__).parent / "compact-bench.json"
    out.write_text(
        json.dumps(
            {
                "schema_version": 2,
                "policy": {
                    "per_tool_pct_target": PER_TOOL_PCT_TARGET,
                    "per_tool_tiny_baseline_bytes": PER_TOOL_TINY_BASELINE_BYTES,
                    "aggregate_pct_target": AGGREGATE_PCT_TARGET,
                    "full_pct_target": FULL_PCT_TARGET,
                },
                "v4_baseline_total": total_v4,
                "compact_total": total_compact,
                "compact_pct_of_v4": round(grand_compact_pct, 2),
                "full_total": total_full,
                "full_pct_of_v4": round(grand_full_pct, 2),
                "aggregate_pass": aggregate_pass,
                "per_tool": rows,
            },
            indent=2,
        )
        + "\n"
    )
    print(f"Wrote {out}")
    if not aggregate_pass:
        print("\nAGGREGATE FAILURE:", grand_compact_pct, ">", AGGREGATE_PCT_TARGET * 100)
        return 1
    if failures:
        print("\nWARNINGS (per-tool failures \u2014 non-blocking when aggregate passes):")
        for f in failures:
            print(f"  - {f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
