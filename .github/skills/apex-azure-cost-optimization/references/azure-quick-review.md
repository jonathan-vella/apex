<!-- ref:azure-quick-review-v1 -->

## Azure Quick Review (azqr) for Cost Optimization

Azure Quick Review (azqr) generates compliance and governance reports that identify cost-impacting issues and orphaned resources.

## Create Filters Configuration

Create a `filters.yaml` file to focus the scan on cost optimization:

```yaml
includeSections:
  - Costs
  - Advisor
  - Inventory
  - Orphaned
excludeSections:
  - Recommendations
  - AzurePolicy
  - DefenderRecommendations
```

## Run the azqr Scan

Execute the scan using Azure MCP or CLI:

```powershell
# Via Azure MCP (extension_azqr is listed only while azqr 3.0.0 or later is on PATH)
# Use the extension_azqr tool with subscription and optional resource-group parameters

# Or via direct CLI:
azqr scan --subscription-id "<SUBSCRIPTION_ID>" --resource-group "<RESOURCE_GROUP>" --filters ./filters.yaml --json --output-name "agent-output/{project}/azqr_report_<YYYYMMDD_HHMMSS>"
```

## Save Output

Save all generated files to `agent-output/{project}/`:

1. Create the folder: `mkdir -p "agent-output/{project}"` (if it doesn't exist)
2. Save the azqr report as: `agent-output/{project}/azqr_report_<YYYYMMDD_HHMMSS>.json`
3. After the scan completes, delete the temporary `filters.yaml` file

## Report Output

The scan generates a JSON report with recommendations categorized by impact level (High/Medium/Low), including:

- Orphaned resources (NICs, disks, IPs)
- Azure Advisor cost recommendations
- Resource inventory
- Cost breakdown by resource

## Notes

- azqr provides qualitative governance recommendations
- Always validate findings with actual cost data before making changes
- The tool requires Reader role on the subscription or resource group
- Save reports to `agent-output/{project}/` with timestamps for audit trail
