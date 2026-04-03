import re

with open("README.md", "r", encoding="utf-8") as f:
    content = f.read()

# Make headings cooler
content = content.replace("## Agentic Workflow", "## 🤖 Agentic Workflow")
content = content.replace("## Agents", "## 🤖 Agents Roster")
content = content.replace("## Related Repositories", "## 🌐 Related Repositories")

toc = """
<details>
<summary><b>📖 Table of Contents</b></summary>
<br>

- [🤖 Agentic Workflow](#-agentic-workflow)
- [⚡ Quick Start](#-quick-start)
- [🤖 Agents Roster](#-agents-roster)
- [🧩 MCP Integration](#-mcp-integration)
- [🌐 Related Repositories](#-related-repositories)
- [🤝 Contributing & License](#-contributing--license)

</details>

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%">
"""

content = content.replace("track — Bicep or Terraform — and the system routes to the right agents, subagents, and validation\npipelines automatically.\n\n<img src=\"https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png\" width=\"100%\">",
"track — Bicep or Terraform — and the system routes to the right agents, subagents, and validation\npipelines automatically.\n\n<img src=\"https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png\" width=\"100%\">\n\n" + toc)

content = content.replace("APEX coordinates specialized AI agents through a complete infrastructure development\ncycle. Instead of context-switching between requirements, architecture decisions, IaC authoring\n(Bicep **or** Terraform), and documentation, you get a **structured multi-step workflow** with built-in\nWAF alignment, AVM-first code generation, and mandatory human approval gates. Choose your IaC\ntrack — Bicep or Terraform — and the system routes to the right agents, subagents, and validation\npipelines automatically.",
"> [!TIP]\n> **APEX** coordinates specialized AI agents through a complete infrastructure development cycle. Instead of context-switching between requirements, architecture decisions, IaC authoring (Bicep **or** Terraform), and documentation, you get a **structured multi-step workflow** with built-in **WAF alignment, AVM-first code generation, and mandatory human approval gates**. Choose your IaC track — Bicep or Terraform — and the system routes to the right agents, subagents, and validation pipelines automatically.")

with open("README.md", "w", encoding="utf-8") as f:
    f.write(content)
