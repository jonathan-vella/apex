import re

with open("docs/how-it-works.md", "r", encoding="utf-8") as f:
    lines = f.readlines()

new_lines = []
h2_count = 0

for line in lines:
    if line.startswith("## ") and h2_count > 0 and line.strip() != "## 📑 Table of Contents":
        # Add a back to top link before the next H2
        if len(new_lines) > 0 and new_lines[-1].startswith("<img src="):
            new_lines.insert(-1, '\n<div align="right"><a href="#-table-of-contents"><b>⬆️ Back to Top</b></a></div>\n\n')
        else:
            new_lines.append('\n<div align="right"><a href="#-table-of-contents"><b>⬆️ Back to Top</b></a></div>\n\n')
    
    if line.startswith("## "):
        h2_count += 1
        
    new_lines.append(line)

# Also add to the very end
new_lines.append('\n<div align="right"><a href="#-table-of-contents"><b>⬆️ Back to Top</b></a></div>\n')

with open("docs/how-it-works.md", "w", encoding="utf-8") as f:
    f.writelines(new_lines)
