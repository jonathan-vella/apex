#!/usr/bin/env python3
"""
ASCII to Azure Diagram Converter

Analyzes markdown files containing ASCII architecture diagrams and generates
proper Azure architecture diagrams using the diagrams library.

Usage:
    python ascii_to_diagram.py <markdown_file> [--output-dir <dir>]
    
This script is designed to be used WITH Claude Code CLI. The script extracts
ASCII diagrams, and Claude interprets them to generate the proper Python code.

Workflow:
1. Run this script to extract ASCII diagrams from markdown
2. Claude Code interprets each ASCII diagram
3. Claude generates proper diagram code
4. Diagrams are saved and markdown is updated with image links
"""

import re
import sys
import argparse
from pathlib import Path
from dataclasses import dataclass
from typing import List, Optional


@dataclass
class AsciiDiagram:
    """Represents an ASCII diagram found in markdown."""
    content: str
    start_line: int
    end_line: int
    context_before: str  # Text before the diagram for context
    heading: Optional[str]  # Section heading if found
    
    def __str__(self):
        return f"Lines {self.start_line}-{self.end_line}: {self.heading or 'Untitled'}"


def extract_ascii_diagrams(markdown_content: str) -> List[AsciiDiagram]:
    """
    Extract ASCII diagrams from markdown content.
    
    Looks for:
    - Code blocks with ASCII art (boxes, arrows, lines)
    - Indented blocks with diagram-like characters
    """
    diagrams = []
    lines = markdown_content.split('\n')
    
    # Pattern for ASCII art characters
    ascii_art_chars = set('─│┌┐└┘├┤┬┴┼═║╔╗╚╝╠╣╦╩╬+-|/\\<>^v*[](){}')
    box_drawing_pattern = re.compile(r'[─│┌┐└┘├┤┬┴┼═║╔╗╚╝╠╣╦╩╬\+\-\|]')
    arrow_pattern = re.compile(r'(-->|<--|->|<-|=>|<=|>>|<<|\|>|<\||\.\.\.>|>\.\.\.)')
    
    in_code_block = False
    code_block_start = 0
    code_block_content = []
    current_heading = None
    
    for i, line in enumerate(lines):
        # Track headings for context
        if line.startswith('#'):
            current_heading = line.lstrip('#').strip()
        
        # Check for code block markers
        if line.strip().startswith('```'):
            if not in_code_block:
                in_code_block = True
                code_block_start = i
                code_block_content = []
            else:
                # End of code block - analyze content
                in_code_block = False
                content = '\n'.join(code_block_content)
                
                # Check if it looks like an ASCII diagram
                has_box_chars = bool(box_drawing_pattern.search(content))
                has_arrows = bool(arrow_pattern.search(content))
                has_multiple_lines = len(code_block_content) > 2
                
                # Heuristic: looks like a diagram if it has box chars or arrows
                # and multiple lines
                if (has_box_chars or has_arrows) and has_multiple_lines:
                    # Get context (previous paragraph)
                    context_start = max(0, code_block_start - 5)
                    context = '\n'.join(lines[context_start:code_block_start])
                    
                    diagrams.append(AsciiDiagram(
                        content=content,
                        start_line=code_block_start + 1,
                        end_line=i + 1,
                        context_before=context.strip(),
                        heading=current_heading
                    ))
        elif in_code_block:
            code_block_content.append(line)
    
    return diagrams


def generate_diagram_prompt(diagram: AsciiDiagram, index: int) -> str:
    """Generate a prompt for Claude to interpret the ASCII diagram."""
    return f"""
## Diagram {index + 1}: {diagram.heading or 'Architecture Diagram'}

**Context from document:**
{diagram.context_before}

**ASCII Diagram to convert:**
```
{diagram.content}
```

**Task:** Convert this ASCII diagram to a proper Azure architecture diagram using the Python diagrams library.

Analyze the ASCII art and:
1. Identify the Azure services represented (Logic Apps, Service Bus, Functions, API Management, etc.)
2. Understand the data flow and connections
3. Generate Python code using the diagrams library with official Azure icons
4. Use appropriate clustering/grouping
5. Preserve the logical flow and relationships

Generate the Python code that creates an equivalent professional diagram.
"""


def create_conversion_report(markdown_path: Path, diagrams: List[AsciiDiagram]) -> str:
    """Create a report of diagrams found for Claude to process."""
    report = f"""# ASCII Diagram Conversion Report

**Source File:** {markdown_path}
**Diagrams Found:** {len(diagrams)}

---

"""
    for i, diagram in enumerate(diagrams):
        report += generate_diagram_prompt(diagram, i)
        report += "\n---\n\n"
    
    return report


def main():
    parser = argparse.ArgumentParser(
        description="Extract ASCII diagrams from markdown for conversion",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s tech-spec.md
  %(prog)s tech-spec.md --output-dir ./diagrams
  %(prog)s docs/*.md --report conversion-tasks.md

Workflow with Claude Code CLI:
  1. Run: python ascii_to_diagram.py my-spec.md --report tasks.md
  2. Ask Claude Code: "Read tasks.md and generate proper Azure diagrams for each ASCII diagram"
  3. Claude will create PNG files and can update the original markdown
        """
    )
    
    parser.add_argument("files", nargs="+", help="Markdown file(s) to process")
    parser.add_argument("-o", "--output-dir", default="./diagrams",
                        help="Output directory for generated diagrams")
    parser.add_argument("-r", "--report", default="conversion-report.md",
                        help="Output file for conversion report")
    parser.add_argument("--dry-run", action="store_true",
                        help="Only report findings, don't generate anything")
    
    args = parser.parse_args()
    
    all_diagrams = []
    
    for file_pattern in args.files:
        for filepath in Path('.').glob(file_pattern):
            if filepath.suffix.lower() in ['.md', '.markdown']:
                print(f"📄 Processing: {filepath}")
                content = filepath.read_text(encoding='utf-8')
                diagrams = extract_ascii_diagrams(content)
                
                if diagrams:
                    print(f"   Found {len(diagrams)} ASCII diagram(s)")
                    for d in diagrams:
                        print(f"   - {d}")
                        all_diagrams.append((filepath, d))
                else:
                    print("   No ASCII diagrams found")
    
    if not all_diagrams:
        print("\n⚠️  No ASCII diagrams found in the provided files.")
        return
    
    print(f"\n📊 Total diagrams found: {len(all_diagrams)}")
    
    if args.dry_run:
        print("\n[Dry run - no files generated]")
        return
    
    # Generate conversion report
    report_content = f"""# ASCII Diagram Conversion Report

**Generated for Claude Code CLI**
**Total Diagrams:** {len(all_diagrams)}

Use this report with Claude Code CLI:
```
"Read this report and convert each ASCII diagram to a proper Azure architecture 
diagram using the azure-architecture-diagrams skill. Save each diagram as PNG 
and provide updated markdown image links."
```

---

"""
    
    for i, (filepath, diagram) in enumerate(all_diagrams):
        report_content += f"## Diagram {i + 1}\n"
        report_content += f"**Source:** `{filepath}`\n"
        report_content += f"**Lines:** {diagram.start_line}-{diagram.end_line}\n"
        report_content += f"**Section:** {diagram.heading or 'N/A'}\n\n"
        report_content += f"**Context:**\n{diagram.context_before}\n\n"
        report_content += f"**ASCII Diagram:**\n```\n{diagram.content}\n```\n\n"
        report_content += "**Suggested output filename:** "
        safe_name = re.sub(r'[^\w\-]', '-', (diagram.heading or f'diagram-{i+1}').lower())
        report_content += f"`{safe_name}.png`\n\n"
        report_content += "---\n\n"
    
    # Write report
    report_path = Path(args.report)
    report_path.write_text(report_content, encoding='utf-8')
    print(f"\n✅ Conversion report written to: {report_path}")
    print(f"\n💡 Next step: Ask Claude Code CLI to process {report_path}")


if __name__ == "__main__":
    main()
