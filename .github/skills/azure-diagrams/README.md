# Azure Diagrams — Routing Skill

> **Status**: Router only (v8.0). All implementation content has moved to specialized skills.

This skill routes diagram requests to the appropriate specialized skill:

| Diagram type                   | Target skill                             |
| ------------------------------ | ---------------------------------------- |
| Architecture diagrams          | [`drawio`](../drawio/)                   |
| WAF / cost / compliance charts | [`python-diagrams`](../python-diagrams/) |
| Inline markdown diagrams       | [`mermaid`](../mermaid/)                 |
| Hand-drawn whiteboarding       | [`excalidraw`](../excalidraw/)           |

See [SKILL.md](SKILL.md) for the full routing table.

## Example Prompts

**Architecture Diagram:**

```text
Create an e-commerce platform architecture with:
- Front Door for global load balancing
- AKS for microservices
- Cosmos DB for product catalog
- Redis for session cache
- Service Bus for order processing
```

**Business Process Flow:**

```text
Create a swimlane diagram for employee onboarding with lanes for:
- HR, IT, Manager, and New Employee
Show the process from offer acceptance to first day completion
```

**ERD Diagram:**

```text
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
