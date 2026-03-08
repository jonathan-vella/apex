<a id="top"></a>

# Presenter Resources

> Version: see [VERSION.md](../../VERSION.md) | [Back to Documentation Hub](../README.md)

Complete toolkit for demonstrating Agentic InfraOps to customers, partners, and internal teams.

## Agent Personas Quick Reference

Use these personas when introducing agents to audiences:

| Agent              | Persona       | Role                              |
| ------------------ | ------------- | --------------------------------- |
| InfraOps Conductor | 🎼 Maestro    | Master orchestrator               |
| requirements       | 📜 Scribe     | Requirements capture              |
| architect          | 🏛️ Oracle     | WAF assessment                    |
| design             | 🎨 Artisan    | Diagrams and ADRs                 |
| bicep-planner      | 📐 Strategist | Bicep implementation planning     |
| terraform-planner  | 📐 Strategist | Terraform implementation planning |
| bicep-codegen      | ⚒️ Forge      | Bicep generation                  |
| terraform-codegen  | ⚒️ Forge      | Terraform generation              |
| bicep-deploy       | 🚀 Envoy      | Bicep deployment                  |
| terraform-deploy   | 🚀 Envoy      | Terraform deployment              |
| as-built           | 📚 Archivist  | Documentation suite               |
| challenger         | ⚔️ Challenger | Adversarial review                |
| diagnose           | 🔍 Sentinel   | Troubleshooting                   |

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="section divider" width="100%">
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>


## Quick Navigation

| Resource                                          | Purpose                       | Prep Time |
| ------------------------------------------------- | ----------------------------- | --------- |
| [Executive Pitch](executive-pitch.md)             | C-level presentation          | 10 min    |
| [Objection Handling](objection-handling.md)       | Common concerns + responses   | 5 min     |
| [ROI Calculator](roi-calculator.md)               | Quantify time/cost savings    | 10 min    |
| [Visual Elements Guide](visual-elements-guide.md) | Use diagrams and visuals well | 5 min     |

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="section divider" width="100%">
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>


## 🎯 Demo Materials

### Core Demo Resources

- [Presentation Deck](agentic-infraops.pptx) - PowerPoint presentation
- [Time Savings Evidence](time-savings-evidence.md) - Metrics and methodology

### Demo Prompts

Use prompts from the [Prompt Guide](../prompt-guide/README.md) to demonstrate agent capabilities:

| Demo                        | Duration | Audience  | Guide Section                                          |
| --------------------------- | -------- | --------- | ------------------------------------------------------ |
| Requirements + Architecture | 15 min   | Technical | [Prompt Guide - Steps 1-2](../prompt-guide/README.md)  |
| Full 7-Step Workflow        | 30 min   | Mixed     | [Prompt Guide - End-to-End](../prompt-guide/README.md) |

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="section divider" width="100%">
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>


## 💼 Business Value

### ROI & Time Savings

- [Time Savings Evidence](time-savings-evidence.md) - Detailed methodology and metrics (78% reduction
  in infrastructure development time)
- [ROI Calculator](roi-calculator.md) - Interactive calculator for customer-specific projections

### Executive Materials

- [Executive Pitch](executive-pitch.md) - 5-slide C-level presentation with key messages
- [Pilot Success Checklist](pilot-success-checklist.md) - Prerequisites for successful customer pilots

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="section divider" width="100%">
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>


## 🛡️ Objection Handling

### Common Concerns

| Objection                         | Quick Response                                          | Details                                            |
| --------------------------------- | ------------------------------------------------------- | -------------------------------------------------- |
| "AI-generated code is unreliable" | Bicep + Terraform validation + linting catches issues   | [Full response](objection-handling.md#reliability) |
| "Our environment is too complex"  | Agent workflow handles multi-tier architectures         | [Full response](objection-handling.md#complexity)  |
| "Security concerns with AI"       | Code stays local, follows WAF principles                | [Full response](objection-handling.md#security)    |
| "What about compliance?"          | Azure Policy integration + audit trails                 | [Full response](objection-handling.md#compliance)  |
| "We use Terraform, not Bicep"     | Full Terraform track with AVM-TF modules and validation | [Full response](objection-handling.md#terraform)   |

See [Objection Handling Guide](objection-handling.md) for complete responses with supporting evidence.

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="section divider" width="100%">
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>


## 📋 MicroHack Delivery

### Preparation Checklists

- [MicroHack Checklist](workshop-checklist.md) - Complete preparation guide for hands-on sessions
- [Pilot Success Checklist](pilot-success-checklist.md) - Customer pilot prerequisites

🎯 **MicroHack site**: <https://jonathan-vella.github.io/microhack-agentic-infraops/> —
a hands-on, guided challenge where participants build Azure infrastructure end-to-end
using AI agents, from requirements to deployment.

### Interactive Materials

- [Character Reference](character-reference.md) - Persona profiles for role-playing exercises

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="section divider" width="100%">
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>


## File Index

| File                         | Description                   |
| ---------------------------- | ----------------------------- |
| `agentic-infraops.pptx`      | PowerPoint deck               |
| `character-reference.md`     | Persona profiles              |
| `executive-pitch.md`         | C-level presentation          |
| `objection-handling.md`      | Common objections + responses |
| `pilot-success-checklist.md` | Customer pilot checklist      |
| `roi-calculator.md`          | ROI calculation guide         |
| `time-savings-evidence.md`   | Time savings methodology      |
| `workshop-checklist.md`      | MicroHack delivery preparation  |

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="section divider" width="100%">
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>


## Related Resources

- [Glossary](../GLOSSARY.md) - Technical terms and patterns
- [Quick Start](../quickstart.md) - Setup and first demo
- [Prompt Guide](../prompt-guide/) - Agent & skill prompt examples

<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>
