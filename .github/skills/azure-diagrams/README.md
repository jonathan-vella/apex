# Azure Diagrams Skill

A comprehensive technical diagramming toolkit for **solutions architects**, **presales engineers**,
and **developers**. Generate professional diagrams for proposals, documentation, and architecture
reviews using Python's `diagrams` library.

> **Library**: [mingrammer/diagrams](https://github.com/mingrammer/diagrams)  
> **License**: MIT

## 🎯 Output Format

This skill generates **PNG images** via Python code:

| Format         | File Extension | Tool             | Use Case                             |
| -------------- | -------------- | ---------------- | ------------------------------------ |
| **Python PNG** | `.py` + `.png` | diagrams library | Programmatic, version-controlled, CI |
| **SVG**        | `.svg`         | diagrams library | Web documentation (optional)         |

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

## Prerequisites

```bash
# Core requirements
pip install diagrams matplotlib pillow

# Graphviz (required for PNG generation)
apt-get install graphviz  # Ubuntu/Debian
# or: brew install graphviz  # macOS
# or: choco install graphviz  # Windows
```

## Contents

```
azure-diagrams/
├── SKILL.md                              # Main skill instructions
├── README.md                             # This file
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
├── scripts/
│   ├── generate_diagram.py               # Interactive generator
│   ├── multi_diagram_generator.py        # Multi-type generator
│   ├── ascii_to_diagram.py               # ASCII to diagram converter
│   └── verify_installation.py            # Check prerequisites
└── templates/
    └── (Python diagram templates)
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

- [diagrams](https://diagrams.mingrammer.com/) - Diagram as Code library by mingrammer
- [Graphviz](https://graphviz.org/) - Graph visualization
- [Agent Skills](https://agentskills.io) - Open standard for AI skills
