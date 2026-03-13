<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Microsoft Foundry Skill (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

## Sub-Skills

| Sub-Skill | When to Use | Reference |
|-----------|-------------|-----------|
| **deploy** | Containerize, build, push to ACR, create/update/start/stop/clone agent deployments | [deploy](foundry-agent/deploy/deploy.md) |
| **invoke** | Send messages to an agent, single or multi-turn conversations | [invoke](foundry-agent/invoke/invoke.md) |
| **observe** | Eval-driven optimization loop: evaluate → analyze → optimize → compare → iterate | [observe](foundry-agent/observe/observe.md) |
| **trace** | Query traces, analyze latency/failures, correlate eval results to specific responses via App Insights `customEvents` | [trace](foundry-agent/trace/trace.md) |

> _See SKILL.md for full content._

## Agent Lifecycle

| Intent | Workflow |
|--------|----------|
| New agent from scratch | create → deploy → invoke |
| Deploy existing code | deploy → invoke |
| Test/chat with agent | invoke |
| Troubleshoot | invoke → troubleshoot |

> _See SKILL.md for full content._

## Project Context Resolution

Resolve only missing values. Extract from user message first, then azd, then ask.

1. Check for `azure.yaml`; if found, run `azd env get-values`
2. Map azd variables:

| azd Variable | Resolves To |

> _See SKILL.md for full content._

## Validation

After each workflow step, validate before proceeding:
1. Run the operation
2. Check output for errors or unexpected results
3. If failed → diagnose using troubleshoot sub-skill → fix → retry
4. Only proceed to next step when validation passes


## Agent Types

| Type | Kind | Description |
|------|------|-------------|
| **Prompt** | `"prompt"` | LLM-based, backed by model deployment |
| **Hosted** | `"hosted"` | Container-based, running custom code |

