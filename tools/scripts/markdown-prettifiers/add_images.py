import re

with open("docs/how-it-works.md", "r", encoding="utf-8") as f:
    lines = f.readlines()

image_map = {
    "### 🛠️ Harness Engineering (OpenAI)": '<div align="center"><img src="https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1200&auto=format&fit=crop" height="200" style="object-fit: cover; border-radius: 8px;"></div><br/>\n',
    "### 🧠 The Orchestrator Pattern": '<div align="center"><img src="https://images.unsplash.com/photo-1507838153414-b4b713384a76?q=80&w=1200&auto=format&fit=crop" height="200" style="object-fit: cover; border-radius: 8px;"></div><br/>\n',
    "### 🛤️ Dual IaC Tracks": '<div align="center"><img src="https://images.unsplash.com/photo-1474487548417-781cb71495f3?q=80&w=1200&auto=format&fit=crop" height="200" style="object-fit: cover; border-radius: 8px;"></div><br/>\n',
    "## ⚙️ Deep Dive: Workflow Engine": '<div align="center"><img src="https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=1200&auto=format&fit=crop" height="250" style="object-fit: cover; border-radius: 8px;"></div><br/>\n'
}

new_lines = []
for line in lines:
    new_lines.append(line)
    stripped = line.strip()
    if stripped in image_map:
        new_lines.append("\n" + image_map[stripped])

with open("docs/how-it-works.md", "w", encoding="utf-8") as f:
    f.writelines(new_lines)
