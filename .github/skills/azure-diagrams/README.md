# Azure Diagrams Skill

A comprehensive technical diagramming toolkit for **solutions architects**, **presales engineers**,
and **developers**. Generate professional diagrams for proposals, documentation, and architecture
reviews.

> **Credits**: This skill was created by [@cmb211087](https://github.com/cmb211087).  
> **Original Repository**: [github.com/cmb211087/azure-diagrams-skill][repo]  
> **License**: MIT

[repo]: https://github.com/cmb211087/azure-diagrams-skill

## What You Can Create

| Diagram Type                  | Use Case                              |
| ----------------------------- | ------------------------------------- |
| **Azure Architecture**        | Solution designs, infrastructure docs |
| **Business Process Flows**    | Workflows, approvals, swimlanes       |
| **Entity Relationship (ERD)** | Database schemas, data models         |
| **Timeline / Gantt**          | Project roadmaps, migration plans     |
| **UI Wireframes**             | Dashboard mockups, screen layouts     |
| **Sequence Diagrams**         | Auth flows, API interactions          |
| **Network Topology**          | Hub-spoke, VNets, hybrid cloud        |

## Installation

For detailed installation instructions across different platforms (Claude Code CLI, GitHub
Copilot, Cursor, etc.), see the [main repository README][install].

[install]: https://github.com/cmb211087/azure-diagrams-skill#installation

### Prerequisites

```bash
pip install diagrams matplotlib
apt-get install graphviz  # or: brew install graphviz (macOS) / choco install graphviz (Windows)
```

## Contents

```
azure-diagrams/
├── SKILL.md                              # Main skill instructions
├── references/
│   ├── azure-components.md               # 700+ Azure components
│   ├── common-patterns.md                # Architecture patterns
│   ├── business-process-flows.md         # Workflow & swimlane patterns
│   ├── entity-relationship-diagrams.md   # ERD patterns
│   ├── timeline-gantt-diagrams.md        # Timeline patterns
│   ├── ui-wireframe-diagrams.md          # Wireframe patterns
│   ├── iac-to-diagram.md                 # Generate from Bicep/Terraform
│   ├── preventing-overlaps.md            # Layout troubleshooting
│   └── quick-reference.md                # Copy-paste snippets
└── scripts/
    ├── generate_diagram.py               # Interactive generator
    └── verify_installation.py            # Check prerequisites
```

## Example Prompts

**Architecture Diagram:**

```
Create an e-commerce platform architecture with:
- Front Door for global load balancing
- AKS for microservices
- Cosmos DB for product catalog
- Redis for session cache
- Service Bus for order processing
```

**Business Process Flow:**

```
Create a swimlane diagram for employee onboarding with lanes for:
- HR, IT, Manager, and New Employee
Show the process from offer acceptance to first day completion
```

**ERD Diagram:**

```
Generate an entity relationship diagram for an order management system with:
- Customers, Orders, OrderItems, Products, Categories
- Show primary keys, foreign keys, and cardinality
```

## Compatibility

| Tool            | Status    |
| --------------- | --------- |
| Claude Code CLI | Supported |
| GitHub Copilot  | Supported |
| Cursor          | Supported |
| VS Code Copilot | Supported |

Built on the [Agent Skills](https://agentskills.io) open standard.

## License

MIT License - free to use, modify, and distribute.

## Credits

- [diagrams](https://diagrams.mingrammer.com/) - Diagram as Code library
- [Graphviz](https://graphviz.org/) - Graph visualization
- [Agent Skills](https://agentskills.io) - Open standard for AI skills
