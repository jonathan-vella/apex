<!-- ref:best-practices-notes-v1 -->

# Important Notes — Cost Optimization

Data classification labels, best practices, common pitfalls, and safety requirements
for cost optimization workflows.

## Data Classification

- 💰 **ACTUAL DATA** = Retrieved from Azure Cost Management API
- 📈 **ACTUAL METRICS** = Retrieved from Azure Monitor
- 💵 **VALIDATED PRICING** = Retrieved from official Azure pricing pages
- 📊 **ESTIMATED SAVINGS** = Calculated based on actual data and validated pricing

## Best Practices

- Always query actual costs first - never estimate or assume
- Validate pricing from official sources - account for free tiers
- Use REST API for cost queries (more reliable than `az costmanagement query`)
- Save audit trail - include all queries and responses
- Include Azure Portal links for all resources
- Use UTF-8 encoding when creating report files
- For costs < $10/month, emphasize operational improvements over financial savings
- Never execute destructive operations without explicit approval

## Common Pitfalls

- **Assuming costs**: Always query actual data from Cost Management API
- **Ignoring free tiers**: Many services have generous allowances (e.g., Container Apps: 180K vCPU-sec free/month)
- **Using wrong date ranges**: 30 days for costs, 14 days for utilization
- **Broken Portal links**: Verify tenant ID and resource ID format
- **Cost query failures**: Use `az rest` with JSON body, not `az costmanagement query`

## Safety Requirements

- Get approval before deleting resources
- Test changes in non-production first
- Provide dry-run commands for validation
- Include rollback procedures
- Monitor impact after implementation
