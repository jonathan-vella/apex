---
name: azure-diagrams
description: "ROUTING SKILL — delegates to specialized diagram skills. USE FOR: any diagram request when the caller does not know which tool to use. Routes to excalidraw, python-diagrams, mermaid, or drawio based on diagram type."
compatibility: Works with VS Code Copilot, Claude Code, and any MCP-compatible tool.
license: MIT
metadata:
  author: azure-agentic-infraops
  version: "7.0"
---

# Azure Diagrams — Routing Skill

This skill routes diagram requests to the appropriate specialized skill.
Do NOT load this skill's references directly — load the target skill instead.

## Routing Table

| Diagram type                                   | Target skill         | Output format     |
| ---------------------------------------------- | -------------------- | ----------------- |
| Architecture diagrams (default)                | `excalidraw`         | `.excalidraw`     |
| Dependency / runtime diagrams                  | `excalidraw`         | `.excalidraw`     |
| As-built diagrams                              | `excalidraw`         | `.excalidraw`     |
| WAF bar charts                                 | `python-diagrams`    | `.py` + `.png`    |
| Cost donut / projection charts                 | `python-diagrams`    | `.py` + `.png`    |
| Compliance gap charts                          | `python-diagrams`    | `.py` + `.png`    |
| Python architecture diagrams (diagrams lib)    | `python-diagrams`    | `.py` + `.png`    |
| Swimlane / ERD / timeline / wireframe          | `python-diagrams`    | `.py` + `.png`    |
| Inline markdown diagrams (flowchart, sequence) | `mermaid`            | fenced code block |
| Azure resource visualization                   | `mermaid`            | fenced code block |
| Draw.io diagrams                               | `drawio` _(planned)_ | `.drawio`         |

## How to Use

1. Identify the diagram type from the request.
2. Read `.github/skills/{target-skill}/SKILL.md` instead of this file.
3. Follow that skill's generation workflow and guardrails.
