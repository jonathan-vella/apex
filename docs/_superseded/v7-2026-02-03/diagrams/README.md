# Architecture Diagrams

> Version: see [VERSION.md](../../VERSION.md) | [Back to Documentation Hub](../README.md)

This folder is the canonical index for diagrams in this repository.

For workload-specific, date-stamped evidence, use `agent-output/{project}/` artifacts.

## Where Diagrams Live

| Folder                   | Description                           | Last Updated  |
| ------------------------ | ------------------------------------- | ------------- |
| [ecommerce/](ecommerce/) | E-commerce platform architecture      | December 2025 |
| [mcp/](mcp/)             | Azure Pricing MCP server architecture | December 2025 |
| [workflow/](workflow/)   | Agent workflow visualizations         | December 2025 |

> Freshness note: diagrams are regenerated when infrastructure changes.
> Check the `.py` timestamp or run the diagram agent to refresh.

## IT Pro Usage

Diagrams help IT Pros explain:

- **Network flows**: VNet peering, NSG rules, private endpoints
- **Security boundaries**: WAF placement, Key Vault access, managed identities
- **Ops dependencies**: Monitoring, backup, DR relationships

## About Diagrams

Architecture diagrams are generated using the `diagram` custom agent, which uses the Python
[diagrams](https://diagrams.mingrammer.com/) library by mingrammer.

### File Types

- `.py` - Python source code for generating diagrams
- `.png` - Generated PNG images
- `.svg` - Scalable vector graphics (when available)
- `.dot` - Graphviz DOT format

## Generating New Diagrams

1. Press `Ctrl+Shift+A` in VS Code
2. Select `diagram`
3. Describe the architecture you want to visualize

The agent will create a Python script and generate the corresponding image.

## Related Documentation

- [S07 Diagrams as Code](../../scenarios/S07-diagrams-as-code/) - Hands-on scenario for diagram generation
- [Visual Elements Guide](../presenter/visual-elements-guide.md) - Using diagrams in presentations
- [Diagram Generator Agent](../../.github/agents/diagram.agent.md) - Agent definition
