<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Azure AI Gateway (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

## When to Use This Skill

| Category | Triggers |
|----------|----------|
| **Model Governance** | "semantic caching", "token limits", "load balance AI", "track token usage" |
| **Tool Governance** | "rate limit MCP", "protect my tools", "configure my tool", "convert API to MCP" |
| **Agent Governance** | "content safety", "jailbreak detection", "filter harmful content" |
| **Configuration** | "add Azure OpenAI backend", "configure my model", "add AI Foundry model" |

> _See SKILL.md for full content._

## Quick Reference

| Policy | Purpose | Details |
|--------|---------|---------|
| `azure-openai-token-limit` | Cost control | [Model Policies](references/policies.md#token-rate-limiting) |
| `azure-openai-semantic-cache-lookup/store` | 60-80% cost savings | [Model Policies](references/policies.md#semantic-caching) |
| `azure-openai-emit-token-metric` | Observability | [Model Policies](references/policies.md#token-metrics) |
| `llm-content-safety` | Safety & compliance | [Agent Policies](references/policies.md#content-safety) |

> _See SKILL.md for full content._

## Get Gateway Details

```bash
# Get gateway URL
az apim show --name <apim-name> --resource-group <rg> --query "gatewayUrl" -o tsv

# List backends (AI models)
az apim backend list --service-name <apim-name> --resource-group <rg> \

> _See SKILL.md for full content._

## Test AI Endpoint

```bash
GATEWAY_URL=$(az apim show --name <apim-name> --resource-group <rg> --query "gatewayUrl" -o tsv)

curl -X POST "${GATEWAY_URL}/openai/deployments/<deployment>/chat/completions?api-version=2024-02-01" \
  -H "Content-Type: application/json" \
  -H "Ocp-Apim-Subscription-Key: <key>" \

> _See SKILL.md for full content._

## Common Tasks

### Add AI Backend

See [references/patterns.md](references/patterns.md#pattern-1-add-ai-model-backend) for full steps.

```bash
# Discover AI resources

> _See SKILL.md for full content._

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Token limit 429 | Increase `tokens-per-minute` or add load balancing |
| No cache hits | Lower `score-threshold` to 0.7 |
| Content false positives | Increase category thresholds (5-6) |
| Backend auth 401 | Grant APIM "Cognitive Services User" role |

> _See SKILL.md for full content._

## References

- [**Detailed Policies**](references/policies.md) - Full policy examples
- [**Configuration Patterns**](references/patterns.md) - Step-by-step patterns
- [**Troubleshooting**](references/troubleshooting.md) - Common issues
- [AI-Gateway Samples](https://github.com/Azure-Samples/AI-Gateway)
- [GenAI Gateway Docs](https://learn.microsoft.com/azure/api-management/genai-gateway-capabilities)
