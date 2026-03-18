Redis Cost Optimization Report
Tenant: {tenant}
Generated: {date}
Subscriptions Analyzed: {subscription_count} (filtered by prefix "{subscription_filter}")

═══════════════════════════════════════════════════════════════════

EXECUTIVE SUMMARY
- Total Redis Caches: {total_caches}
- Current Monthly Cost: ${current_cost}
- Potential Savings: ${savings}/month ({savings_pct}%)
- Critical Issues: {critical_count} caches requiring immediate action

BY SUBSCRIPTION
┌─────────────────────┬──────┬──────────┬─────────────┬──────────┐
│ Subscription        │Caches│  Cost/Mo │  Savings/Mo │ Priority │
├─────────────────────┼──────┼──────────┼─────────────┼──────────┤
│ {sub_1_name}        │  {n} │   ${amt} │   ${save}   │    🔴    │
│ {sub_2_name}        │  {n} │   ${amt} │     $0      │    🟢    │
│ {sub_3_name}        │  {n} │ ${amt}   │   ${save}   │    🟠    │
└─────────────────────┴──────┴──────────┴─────────────┴──────────┘

CRITICAL ISSUES (🔴 Immediate Action Required)
- {subscription}: {issue_description}
- {subscription}: {issue_description}

Next Steps:
1. Review detailed analysis for {priority_subscription} (type 'analyze {name}')
2. Review detailed analysis for {priority_subscription} (type 'analyze {name}')
3. Generate full report with all recommendations (type 'full report')