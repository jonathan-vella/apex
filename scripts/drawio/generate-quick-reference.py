#!/usr/bin/env python3
"""Generate the quick-reference.md for draw.io diagrams.

Extracts actual icon styles from the built libraries and creates
copy-paste XML snippets for the most common Azure services.

Usage:
    python scripts/drawio/generate-quick-reference.py
"""

import json
import glob
import sys
from pathlib import Path

OUTPUT_FILE = ".github/skills/azure-diagrams/references/drawio-quick-reference.md"
LIBRARY_DIR = "assets/drawio-libraries/azure-public-service-icons"

# Top Azure services to include in quick-reference
# Key: search string in icon title → display name
TOP_SERVICES = {
    "Virtual-Machine": ("Virtual Machine", "vm"),
    "Kubernetes-Services": ("AKS / Kubernetes", "aks"),
    "Function-App": ("Function App", "func"),
    "App-Service-Plans": ("App Service Plan", "asp"),
    "Azure-Cosmos-DB": ("Cosmos DB", "cosmos"),
    "SQL-Database": ("SQL Database", "sql"),
    "Key-Vaults": ("Key Vault", "kv"),
    "Storage-Accounts": ("Storage Account", "st"),
    "Virtual-Networks": ("Virtual Network", "vnet"),
    "Azure-Firewall": ("Azure Firewall", "fw"),
    "Application-Gateway": ("Application Gateway", "appgw"),
    "Front-Door": ("Front Door / CDN", "fd"),
    "API-Management": ("API Management", "apim"),
    "Service-Bus": ("Service Bus", "sb"),
    "Event-Hub": ("Event Hub", "eh"),
    "Container-Registries": ("Container Registry", "acr"),
    "Log-Analytics": ("Log Analytics", "la"),
    "Application-Insights": ("Application Insights", "ai"),
}


def find_icon_style(title_search: str, libraries: dict) -> tuple[str, str] | None:
    """Find an icon's image data URL by searching title across all libraries."""
    for cat_name, entries in libraries.items():
        for entry in entries:
            if title_search in entry["title"]:
                xml = entry["xml"]
                idx = xml.find("image=data:image/svg+xml,")
                if idx >= 0:
                    start = idx + len("image=")
                    end = xml.find("&quot;", start)
                    if end == -1:
                        end = xml.find('"', start)
                    image_url = xml[start:end]
                    return image_url, cat_name
    return None


def main() -> None:
    lib_dir = Path(LIBRARY_DIR)
    if not lib_dir.exists():
        print(f"❌ Library directory not found: {lib_dir}", file=sys.stderr)
        sys.exit(1)

    # Load all libraries
    libraries = {}
    for xml_path in sorted(lib_dir.glob("[0-9][0-9][0-9] *.xml")):
        if xml_path.name.startswith("000"):
            continue
        content = xml_path.read_text(encoding="utf-8")
        start = content.index("[")
        end = content.rindex("]") + 1
        libraries[xml_path.stem] = json.loads(content[start:end])

    # Build icon table
    icon_rows = []
    icon_snippets = []
    for search_key, (display_name, short_id) in TOP_SERVICES.items():
        result = find_icon_style(search_key, libraries)
        if result:
            image_url, cat_name = result
            icon_rows.append(f"| {display_name} | `{short_id}` | {cat_name} |")
            icon_snippets.append(
                f'### {display_name} (`{short_id}`)\n\n'
                f'```xml\n'
                f'<mxCell id="{short_id}-1" value="{display_name}"\n'
                f'        style="shape=image;verticalLabelPosition=bottom;verticalAlign=top;\n'
                f'               imageAspect=0;aspect=fixed;image={image_url}"\n'
                f'        vertex="1" parent="1">\n'
                f'  <mxGeometry x="200" y="200" width="48" height="48" as="geometry"/>\n'
                f'</mxCell>\n'
                f'```'
            )
        else:
            icon_rows.append(f"| {display_name} | `{short_id}` | (not found) |")

    content = f"""# Draw.io Quick Reference

Copy-paste XML snippets for Azure architecture diagrams. All icons are from
Microsoft's official Azure Architecture Icons, built via `npm run build:drawio-icons`.

## Diagram Skeleton

```xml
<mxfile host="agent" modified="2026-03-23" agent="azure-diagrams" version="1.0">
  <diagram name="Architecture" id="arch-1">
    <mxGraphModel dx="1422" dy="762" grid="1" gridSize="10" guides="1" tooltips="1"
                  connect="1" arrows="1" fold="1" page="1" pageScale="1"
                  pageWidth="1169" pageHeight="827" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>

        <!-- Add resource cells, containers, and edges here -->

      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
```

## Container Patterns

### Resource Group

```xml
<mxCell id="rg-1" value="rg-project-prod"
        style="rounded=1;whiteSpace=wrap;html=1;dashed=1;dashPattern=5 5;
               fillColor=#E8F0FE;strokeColor=#0078D4;fontSize=14;
               fontFamily=Arial;fontStyle=1;verticalAlign=top;
               spacingTop=10;arcSize=8"
        vertex="1" parent="1">
  <mxGeometry x="50" y="50" width="800" height="500" as="geometry"/>
</mxCell>
```

### Virtual Network

```xml
<mxCell id="vnet-1" value="vnet-project-prod (10.0.0.0/16)"
        style="rounded=1;whiteSpace=wrap;html=1;dashed=1;dashPattern=8 4;
               fillColor=#F0F8FF;strokeColor=#0078D4;fontSize=12;
               fontFamily=Arial;fontStyle=1;verticalAlign=top;
               spacingTop=10;arcSize=6"
        vertex="1" parent="rg-1">
  <mxGeometry x="20" y="40" width="760" height="440" as="geometry"/>
</mxCell>
```

### Subnet

```xml
<mxCell id="snet-app" value="snet-app (10.0.1.0/24)"
        style="rounded=1;whiteSpace=wrap;html=1;dashed=0;
               fillColor=#FFFFFF;strokeColor=#98C1D9;fontSize=11;
               fontFamily=Arial;verticalAlign=top;spacingTop=8"
        vertex="1" parent="vnet-1">
  <mxGeometry x="20" y="40" width="350" height="380" as="geometry"/>
</mxCell>
```

## Edge Patterns

### Standard Connection

```xml
<mxCell id="e-1" value="HTTPS"
        style="endArrow=classic;html=1;strokeColor=#0078D4;
               fontFamily=Arial;fontSize=10"
        edge="1" parent="1" source="appgw-1" target="app-1">
  <mxGeometry relative="1" as="geometry"/>
</mxCell>
```

### Bidirectional

```xml
<mxCell id="e-2" value="Replication"
        style="endArrow=classic;startArrow=classic;html=1;strokeColor=#107C10;
               fontFamily=Arial;fontSize=10;dashed=1"
        edge="1" parent="1" source="sql-1" target="sql-2">
  <mxGeometry relative="1" as="geometry"/>
</mxCell>
```

### Security Flow

```xml
<mxCell id="e-3" value="Auth"
        style="endArrow=classic;html=1;strokeColor=#C00000;strokeWidth=2;
               fontFamily=Arial;fontSize=10;fontColor=#C00000"
        edge="1" parent="1" source="app-1" target="kv-1">
  <mxGeometry relative="1" as="geometry"/>
</mxCell>
```

## Azure Icon Quick Lookup

| Service | Short ID | Library |
|---------|----------|---------|
{chr(10).join(icon_rows)}

## Azure Icon XML Snippets

{chr(10).join(icon_snippets)}

## Design Tokens

| Element | Color | Usage |
|---------|-------|-------|
| Azure Blue | `#0078D4` | Borders, edges, labels |
| RG Fill | `#E8F0FE` | Resource group background |
| VNet Fill | `#F0F8FF` | Virtual network background |
| Subnet Fill | `#FFFFFF` | Subnet containers |
| Security | `#C00000` | Security-critical flows |
| Warning | `#FF8C00` | Advisory flows |
| Success | `#107C10` | Healthy/replicated flows |
| Font | `Arial` | All labels |
| Icon Size | `48x48` | Standard Azure icon |

## Layout Grid

- Page: 1169×827 (landscape A4)
- Grid: 10px snap
- Icon spacing: ≥100px apart
- Container padding: 20px internal
- Label position: below icon (`verticalLabelPosition=bottom`)
"""

    output = Path(OUTPUT_FILE)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(content, encoding="utf-8")
    print(f"✅ Quick reference written to {output}")
    print(f"   {len(icon_snippets)} icon snippets included")


if __name__ == "__main__":
    main()
