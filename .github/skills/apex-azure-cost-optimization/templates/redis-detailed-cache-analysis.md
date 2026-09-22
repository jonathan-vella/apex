## Redis Cost Optimization Report - Detailed Analysis

Template only: placeholders are not observed costs, prices, savings or approvals.
Apply the [Redis evidence and arithmetic rules](../references/azure-redis.md#cost-optimization-rules).

- Subscription: {subscription_name} ({subscription_id})
- Generated: {timestamp}
- Analysis period: {start_utc} to {end_utc}
- Currency: {currency}
- Scope and coverage gaps: {scope_and_gaps}

## Subscription Overview

- Total caches: {observed_cache_count}
- Actual baseline cost: {baseline_total_or_unknown}
- Estimated target cost: {target_total_or_unknown}
- Estimated saving: {saving_total_or_unknown} ({saving_pct_or_undefined})
- Known subtotal and excluded/missing evidence: {subtotal_and_gaps}

## Cache Analysis

Repeat for each distinct resource ID; retain resources without recommendations.

- Resource: {name}, {full_resource_id}, {subscription_id}
- Service, SKU, region: {service}, {sku}, {region}
- State, age, tags: {observed_metadata}
- Cost evidence: {actual_baseline}, {period}, {currency}, {query_file}, {timestamp}
- Utilization evidence: {peak_memory_load_connections_latency}, {window}, {source}
- Dependencies, features, retention and owner confirmation: {evidence_or_unknown}
- Finding: {investigation_signal_not_automatic_deletion}
- Recommendation: {evidence_based_option_or_insufficient_evidence}
- Target estimate and source: {target_cost_or_unknown}, {pricing_source}, {timestamp}
- Estimated saving: {baseline_minus_target_or_unknown}
- Risk, recovery and approval status: {review_or_risky}, {recovery_plan}, {not_approved_or_explicit_approval}

## Savings Summary

Sum distinct, non-overlapping line items using the same period and currency.
Reconcile baseline, target and saving totals; retain negative savings and mark
percentage undefined for a zero baseline. Missing evidence is unknown, not zero.
Show incomplete totals as known subtotals with coverage gaps. This report does not authorize remediation.
