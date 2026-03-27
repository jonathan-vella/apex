# Draw.io Icon Libraries

Local Azure architecture icon libraries for draw.io diagram generation.
Icons are base64-encoded SVG data URIs embedded in `mxlibrary` XML format
for fully offline operation.

## Directory Structure

```text
drawio-libraries/
├── mxfile.xsd                      # Official draw.io XML schema (from drawio.com)
├── README.md                       # This file
└── azure-icons/
    ├── manifest.json               # Icon metadata (count, categories, version)
    ├── reference.md                # Icon name → filename lookup for agents
    ├── 001-ai-machine-learning.xml # Per-category mxlibrary files
    ├── 002-analytics.xml
    ├── ...                         # ~29 category files
    └── icons/                      # Individual icon .xml snippets
        ├── icon-service-App-Services.xml
        ├── icon-service-Virtual-Machines.xml
        └── ...                     # ~705 individual icon files
```

## Regeneration

To regenerate icon libraries from the latest Microsoft Azure icon pack:

```bash
# 1. Download the latest Azure Public Service Icons ZIP from:
#    https://learn.microsoft.com/en-us/azure/architecture/icons/
#
# 2. Run the conversion pipeline:
python scripts/convert-azure-icons-to-drawio.py <path-to-zip>
```

## Usage in Diagrams

Icons are referenced in draw.io via the `image` style property with a
`data:image/svg+xml;base64,...` data URI. The simonkurtz-MSFT Draw.io MCP
server includes its own 700+ icon library; these local libraries are for
the VS Code Draw.io extension and manual diagram editing. Each icon snippet in `icons/`
contains a complete `.drawio` XML file with a single image cell that
agents can copy into their diagrams.

### Agent Icon Discovery Protocol

1. Read `azure-icons/reference.md` to find the icon name → filename mapping
2. Load the icon snippet from `azure-icons/icons/{filename}.xml`
3. Copy the `mxCell` element (id="2") into the target diagram
4. Adjust `x`, `y` coordinates and optionally `width`, `height`

### Loading Libraries in draw.io Desktop/Web

Open draw.io → File → Open Library → select a category `.xml` file.

## Microsoft Icon License

Azure Architecture Icons are provided by Microsoft under their
[icon terms of use](https://learn.microsoft.com/en-us/azure/architecture/icons/).

**Do's**: Use icons to illustrate how products work together in architecture diagrams.
Include the product name near the icon. Use icons as they appear within Azure.

**Don'ts**: Don't crop, flip, or rotate icons. Don't distort or change icon shape.
Don't use Microsoft product icons to represent your product or service.
