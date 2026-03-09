import os
import glob

def process_files():
    files = glob.glob("*.md")
    files = [f for f in files if os.path.isfile(f)]

    for file_path in files:
        with open(file_path, "r", encoding="utf-8") as f:
            lines = f.readlines()

        new_lines = []
        in_code_block = False
        in_frontmatter = False

        h2_count = 0

        # Check if we should insert <a id="top"></a>
        has_readme_top = any('<a id="readme-top"></a>' in line for line in lines)
        has_top = any('<a id="top"></a>' in line for line in lines)

        top_anchor = "top"
        if has_readme_top:
            top_anchor = "readme-top"

        if not has_readme_top and not has_top:
            new_lines.append('<a id="top"></a>\n\n')

        i = 0
        while i < len(lines):
            line = lines[i]

            if i == 0 and line.strip() == "---":
                in_frontmatter = True

            if line.startswith("```"):
                in_code_block = not in_code_block

            is_frontmatter_end = in_frontmatter and i > 0 and line.strip() == "---"
            if is_frontmatter_end:
                in_frontmatter = False
                new_lines.append(line)
                i += 1
                continue

            if not in_code_block and not in_frontmatter:
                stripped = line.strip()

                if stripped.startswith("## ") and h2_count > 0 and "Table of Contents" not in stripped and "Back to Top" not in stripped:
                    # check if we already have a back-to-top link right before
                    if not (len(new_lines) > 0 and "Back to Top" in new_lines[-1]) and not (len(new_lines) > 1 and "Back to Top" in new_lines[-2]):
                        back_to_top = f'<div align="right"><a href="#{top_anchor}"><b>⬆️ Back to Top</b></a></div>\n\n'
                        if len(new_lines) > 0 and new_lines[-1].startswith('<img src="https://raw.githubusercontent.com'):
                            new_lines.insert(-1, back_to_top)
                        elif len(new_lines) > 0 and new_lines[-1].strip() == "":
                            new_lines.insert(-1, back_to_top)
                        else:
                            new_lines.append(back_to_top)

                if stripped.startswith("## "):
                    h2_count += 1

                if stripped == "---":
                    line = '<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%">\n'

            new_lines.append(line)
            i += 1

        # Append back to top at end if h2_count > 0, make sure it's not duplicated
        if h2_count > 0:
            last_lines = "".join(new_lines[-5:])
            if "Back to Top" not in last_lines:
                new_lines.append(f'\n<div align="right"><a href="#{top_anchor}"><b>⬆️ Back to Top</b></a></div>\n')

        with open(file_path, "w", encoding="utf-8") as f:
            f.writelines(new_lines)

if __name__ == "__main__":
    process_files()
    print("Done")
