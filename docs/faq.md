# :material-frequently-asked-questions: FAQ

Frequently asked questions about Agentic InfraOps.

---

## General

??? question "Is this project production-ready?"

    Agentic InfraOps is currently at **v0.10.0** (pre-1.0). It is suitable for
    development, testing, and proof-of-concept deployments. The generated IaC templates
    follow Azure Verified Modules standards and include security baselines, but you
    should always review generated code before deploying to production environments.

    See the [Changelog](CHANGELOG.md) for release history and maturity indicators.

??? question "What AI models does this require?"

    The project is built for **GitHub Copilot** in VS Code. Agents specify their
    preferred model in their frontmatter — most use Claude Opus 4.6 or GPT-5.3-Codex.
    The Conductor and review-heavy agents perform best with Claude Opus 4.6.

    You need an active **GitHub Copilot** license (Individual, Business, or Enterprise).

??? question "Do I need an Azure subscription?"

    **For learning**: No. You can run the full workflow through Steps 1-5 (requirements,
    architecture, design, planning, code generation) without an Azure subscription.
    The generated templates are valid and ready to deploy.

    **For deployment**: Yes. Step 6 (Deploy) requires an active Azure subscription with
    permissions to create resources. Step 2 (Architecture) optionally uses the Azure
    Pricing MCP server, which queries public pricing APIs and does not require a subscription.

---

## IaC Tracks

??? question "Bicep or Terraform — which should I choose?"

    Both tracks produce production-quality output. Choose based on your team's expertise
    and organizational standards:

    | Factor             | Bicep                                    | Terraform                                  |
    | ------------------ | ---------------------------------------- | ------------------------------------------ |
    | **Azure-only**     | Native DSL, first-class Azure support    | Multi-cloud, Azure via AzureRM provider    |
    | **State**          | No state file (ARM-managed)              | State file (Azure Storage backend)         |
    | **Learning curve** | Lower if you know ARM/Azure              | Lower if you know HCL/multi-cloud          |
    | **AVM modules**    | `br/public:avm/res/`                     | `registry.terraform.io/Azure/avm-res-*/`   |
    | **CI/CD**          | `az deployment group create`             | `terraform plan` + `terraform apply`       |

    The Requirements agent (Step 1) captures your `iac_tool` preference, and the
    Conductor routes all subsequent steps to the correct track automatically.

    See [How It Works](how-it-works/index.md) for a deeper comparison.

??? question "Can I switch IaC tracks mid-workflow?"

    Not directly. The `iac_tool` field in `01-requirements.md` determines the track for
    Steps 4-6. To switch, update the `iac_tool` field in requirements and re-run from
    Step 4 (Planning). Steps 1-3 are shared and do not need to be repeated.

---

## Usage

??? question "Can I use this offline?"

    No. Agentic InfraOps requires:

    - **GitHub Copilot** — cloud-hosted AI service
    - **MCP servers** — Azure Pricing, Microsoft Learn, GitHub, and Terraform MCP servers
      provide real-time data to agents

    The dev container itself runs locally, but agent conversations and MCP tool calls
    require internet connectivity.

??? question "How do I customize agents or add new ones?"

    Agents are defined in `.github/agents/*.agent.md` as YAML frontmatter + markdown body.
    To create a new agent:

    1. Copy an existing agent file as a template
    2. Update the frontmatter (name, description, model, tools, skills)
    3. Write the agent body with instructions
    4. Reload VS Code — the agent appears in the `Ctrl+Shift+A` picker

    See [Contributing](CONTRIBUTING.md) for contribution guidelines and the
    [Agent and Skill Workflow](workflow.md) for how agents fit into the system.

??? question "What's the difference between agents and skills?"

    | Aspect          | Agents                                   | Skills                   |
    | --------------- | ---------------------------------------- | ------------------------ |
    | **Invocation**  | Manual (`Ctrl+Shift+A`) or via Conductor | Automatic or explicit    |
    | **Interaction** | Conversational with handoffs             | Task-focused             |
    | **State**       | Session context                          | Stateless                |
    | **Output**      | Multiple artifacts                       | Specific outputs         |
    | **When to use** | Core workflow steps                      | Specialized capabilities |

    Agents are the actors in the 7-step workflow. Skills are reusable knowledge modules
    that agents load on demand. See the [Workflow](workflow.md) page for details.

??? question "How do I resume a failed or interrupted workflow?"

    The Conductor supports session resume via the `session-resume` skill. To resume:

    1. Open Copilot Chat and select **InfraOps Conductor**
    2. Say: *"Resume the workflow from where we left off. Check agent-output/{project}/ for existing artifacts."*
    3. The Conductor reads `00-session-state.json` and existing artifacts to determine
       which steps are complete, then continues from the next pending step.

    See the [Quickstart](quickstart.md) for the full getting-started flow.

---

## Troubleshooting

??? question "The Conductor doesn't delegate to other agents — what's wrong?"

    The most common cause is the subagent orchestration setting not being enabled.
    Add this to your **VS Code User Settings** (not workspace settings):

    ```json
    {
      "chat.customAgentInSubagent.enabled": true
    }
    ```

    See [Troubleshooting](troubleshooting.md#15-conductorsubagent-invocation-not-working-vs-code-1109)
    for detailed steps.

??? question "Where do I report bugs or request features?"

    - **Bugs**: [GitHub Issues](https://github.com/jonathan-vella/azure-agentic-infraops/issues)
    - **Questions**: [GitHub Discussions](https://github.com/jonathan-vella/azure-agentic-infraops/discussions)
    - **Feature requests**: Open a GitHub issue with the `enhancement` label
