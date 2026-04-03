import re
import subprocess

subprocess.run(["git", "checkout", "docs/how-it-works.md"])

with open("docs/how-it-works.md", "r", encoding="utf-8") as f:
    lines = f.readlines()

emoji_map = {
    "# How APEX Works": "# 🚀 How APEX Works",
    "## Table of Contents": "## 📑 Table of Contents",
    "## Executive Summary": "## 📋 Executive Summary",
    "## Intellectual Foundations": "## 🧠 Intellectual Foundations",
    "### Harness Engineering (OpenAI)": "### 🛠️ Harness Engineering (OpenAI)",
    "### Bosun (VirtEngine)": "### ⚓ Bosun (VirtEngine)",
    "### How This Project Synthesises Both": "### ⚖️ How This Project Synthesises Both",
    "## System Architecture Overview": "## 📐 System Architecture Overview",
    "### The Multi-Step Workflow": "### 🔄 The Multi-Step Workflow",
    "### The Orchestrator Pattern": "### 🧠 The Orchestrator Pattern",
    "### Dual IaC Tracks": "### 🛤️ Dual IaC Tracks",
    "## The Four Pillars": "## 🏛️ The Four Pillars",
    "### 1. Agents": "### 🤖 1. Agents",
    "### 2. Skills": "### 🥋 2. Skills",
    "### 3. Instructions": "### 📜 3. Instructions",
    "### 4. Configuration Registries": "### ⚙️ 4. Configuration Registries",
    "## AGENTS.md and Copilot Instructions": "## 🗂️ AGENTS.md and Copilot Instructions",
    "### AGENTS.md — The Table of Contents": "### 📖 AGENTS.md — The Table of Contents",
    "### copilot-instructions.md — The VS Code Bridge": "### 🌉 copilot-instructions.md — The VS Code Bridge",
    "## Deep Dive: Agent Architecture": "## 🕵️‍♂️ Deep Dive: Agent Architecture",
    "### Agent Anatomy": "### 🧬 Agent Anatomy",
    "### Top-Level Agents (14)": "### 👑 Top-Level Agents (14)",
    "### Subagents (9)": "### 🕵️‍♀️ Subagents (9)",
    "### The Challenger Pattern": "### 🤺 The Challenger Pattern",
    "### Handoffs and Delegation": "### 🤝 Handoffs and Delegation",
    "## Deep Dive: Skills System": "## 🤿 Deep Dive: Skills System",
    "### Skill Structure": "### 🏗️ Skill Structure",
    "### Progressive Loading": "### ⏳ Progressive Loading",
    "### Skill Catalog": "### 🗃️ Skill Catalog",
    "## Deep Dive: Instruction System": "## 🧪 Deep Dive: Instruction System",
    "### Glob-Based Auto-Application": "### 🌐 Glob-Based Auto-Application",
    "### Enforcement Over Documentation": "### 👮 Enforcement Over Documentation",
    "## Deep Dive: Workflow Engine": "## ⚙️ Deep Dive: Workflow Engine",
    "### The DAG Model": "### 🕸️ The DAG Model",
    "### Gates and Approval Points": "### 🚧 Gates and Approval Points",
    "### IaC Routing": "### 🔀 IaC Routing",
    "### Session State and Resume": "### 💾 Session State and Resume",
    "## Deep Dive: Quality and Safety Systems": "## 🛡️ Deep Dive: Quality and Safety Systems",
    "### 27 Validation Scripts": "### ✅ 27 Validation Scripts",
    "### Git Hooks (Pre-Commit and Pre-Push)": "### 🪝 Git Hooks (Pre-Commit and Pre-Push)",
    "### Circuit Breaker": "### 🔌 Circuit Breaker",
    "### Context Compression": "### 🗜️ Context Compression",
    "## The Golden Principles": "## 🏆 The Golden Principles",
    "## File Map": "## 🗺️ File Map",
    "## References": "## 📚 References"
}

def create_slug(text):
    text = text.lower()
    text = re.sub(r'[^a-z0-9\s-]', '', text)
    text = re.sub(r'\s+', '-', text)
    return text

in_code_block = False
new_lines = []

# Using name instead of id as it's an older but safer anchor pattern in simple markdown renderers sometimes, but ID is actually the standard now in HTML5. We will use id.

for idx, line in enumerate(lines):
    if line.startswith("```"):
        in_code_block = not in_code_block

    if not in_code_block:
        stripped = line.strip()
        if stripped in emoji_map:
            clean_text = stripped.replace('#', '').strip()
            slug = create_slug(clean_text)

            if stripped.startswith("## ") and stripped not in ["## Table of Contents", "## Executive Summary", "## Intellectual Foundations"]:
                new_lines.append('<div align="right"><a href="#table-of-contents"><b>⬆️ Back to Top</b></a></div>\n\n')

            new_lines.append(f'<a id="{slug}"></a>\n')
            line = line.replace(stripped, emoji_map[stripped])
        elif stripped == "---":
            line = '<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%">\n'

    new_lines.append(line)

new_lines.append('\n<div align="right"><a href="#table-of-contents"><b>⬆️ Back to Top</b></a></div>\n')

# Banner - simple image only, no text so we don't risk duplicating the H1
banner = '''<div align="center">
  <img src="https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2000&auto=format&fit=crop" width="100%" height="300" style="object-fit: cover; border-radius: 10px;" alt="APEX Banner"/>
</div>\n\n'''

new_lines.insert(0, banner)

with open("docs/how-it-works.md", "w", encoding="utf-8") as f:
    f.writelines(new_lines)
