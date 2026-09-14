Redis Cost Optimization Report
Template only: placeholders are not observed evidence. Use the
[Redis evidence and arithmetic rules](../references/azure-redis.md#cost-optimization-rules).
Keep mixed-service requests in scope; report the Redis subtotal separately.
Tenant: {tenant}
Generated: {date}
Period / currency / source timestamps: {period_currency_sources}
Coverage gaps and unknown estimates: {coverage_gaps}
Subscriptions Analyzed: {subscription_count} (filtered by prefix "{subscription_filter}")

═══════════════════════════════════════════════════════════════════

EXECUTIVE SUMMARY

- Total Redis Caches: {total_caches}
- Current Monthly Cost: ${current_cost}
- Potential Savings: ${savings}/month ({savings_pct}%)
- Investigation signals: {signal_count} caches requiring review, not automatic deletion

BY SUBSCRIPTION
┌─────────────────────┬──────┬──────────┬─────────────┬──────────┐
│ Subscription │Caches│ Cost/Mo │ Savings/Mo │ Priority │
├─────────────────────┼──────┼──────────┼─────────────┼──────────┤
│ {sub_1_name} │ {n} │ ${amt} │ ${save} │ 🔴 │
│ {sub_2_name} │ {n} │ ${amt_or_unknown} │ {save_or_unknown} │ {review_status} │
│ {sub_3_name} │ {n} │ ${amt} │ ${save} │ 🟠 │
└─────────────────────┴──────┴──────────┴─────────────┴──────────┘

INVESTIGATION SIGNALS (Review Required)

- {subscription}: {issue_description}
- {subscription}: {issue_description}

Next Steps:

1. Review detailed analysis for {priority_subscription} (type 'analyze {name}')
2. Review detailed analysis for {priority_subscription} (type 'analyze {name}')
3. Generate full report with all recommendations (type 'full report')
