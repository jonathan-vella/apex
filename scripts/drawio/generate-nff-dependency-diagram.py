"""
Generate the Nordic Fresh Foods FreshConnect MVP dependency diagram (draw.io).

Produces a module dependency graph showing the 5-phase deployment order:
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5

Output saved to agent-output/nordic-fresh-foods/04-dependency-diagram.drawio
and site/public/demo/04-dependency-diagram.drawio
"""
import html
import json
import re
from pathlib import Path

LIBRARY_DIR = Path("assets/drawio-libraries/azure-public-service-icons")
OUTPUT_DIR = Path("agent-output/nordic-fresh-foods")
DEMO_DIR = Path("site/public/demo")


def get_image_data(fname: str, title_search: str) -> str:
    """Extract the base64 image data URI from a built icon library."""
    fpath = LIBRARY_DIR / fname
    with open(fpath) as f:
        content = f.read()
    json_str = content[len("<mxlibrary>"):-len("</mxlibrary>")]
    items = json.loads(json_str)
    for item in items:
        if title_search in item.get("title", ""):
            xml_unescaped = html.unescape(item["xml"])
            m = re.search(r'image=(data:image/svg[^"]+)', xml_unescaped)
            if m:
                return m.group(1)
    raise ValueError(f"Icon not found: {title_search} in {fname}")


def resource_with_icon(cell_id: str, icon_id: str, label: str,
                       image_data: str,
                       x: int, y: int,
                       width: int = 230, height: int = 80,
                       fill: str = "#EBF3FB", stroke: str = "#0078D4",
                       font_color: str = "#003366") -> str:
    """Resource box with a small Azure icon centered at the top."""
    style = (
        f"rounded=1;whiteSpace=wrap;html=1;fillColor={fill};"
        f"strokeColor={stroke};fontColor={font_color};"
        "fontFamily=Arial;fontSize=10;verticalAlign=top;"
        "spacingTop=26;align=center;"
    )
    escaped = html.escape(label)
    box_cell = (
        f'        <mxCell id="{cell_id}" value="{escaped}"\n'
        f'                style="{style}"\n'
        f'                vertex="1" parent="1">\n'
        f'          <mxGeometry x="{x}" y="{y}" width="{width}" height="{height}" as="geometry"/>\n'
        f'        </mxCell>\n'
    )
    icon_x = x + width // 2 - 10
    icon_y = y + 4
    icon_style = (
        f"shape=image;verticalLabelPosition=bottom;verticalAlign=top;"
        f"imageAspect=0;aspect=fixed;html=1;image={image_data}"
    )
    icon_cell_str = (
        f'        <mxCell id="{icon_id}" value=""\n'
        f'                style="{icon_style}"\n'
        f'                vertex="1" parent="1">\n'
        f'          <mxGeometry x="{icon_x}" y="{icon_y}" width="20" height="20" as="geometry"/>\n'
        f'        </mxCell>\n'
    )
    return box_cell + icon_cell_str


def phase_header(cell_id: str, label: str, x: int, y: int,
                 width: int, height: int = 36) -> str:
    style = (
        "rounded=1;whiteSpace=wrap;html=1;"
        "fillColor=#0078D4;strokeColor=#004E8C;"
        "fontColor=#FFFFFF;fontFamily=Arial;fontSize=12;fontStyle=1;"
        "verticalAlign=middle;"
    )
    escaped = html.escape(label)
    return (
        f'        <mxCell id="{cell_id}" value="{escaped}"\n'
        f'                style="{style}"\n'
        f'                vertex="1" parent="1">\n'
        f'          <mxGeometry x="{x}" y="{y}" width="{width}" height="{height}" as="geometry"/>\n'
        f'        </mxCell>\n'
    )


def resource_box(cell_id: str, label: str, x: int, y: int,
                 width: int = 220, height: int = 80,
                 fill: str = "#EBF3FB", stroke: str = "#0078D4",
                 font_color: str = "#003366") -> str:
    style = (
        f"rounded=1;whiteSpace=wrap;html=1;fillColor={fill};"
        f"strokeColor={stroke};fontColor={font_color};"
        "fontFamily=Arial;fontSize=10;verticalAlign=middle;"
    )
    escaped = html.escape(label)
    return (
        f'        <mxCell id="{cell_id}" value="{escaped}"\n'
        f'                style="{style}"\n'
        f'                vertex="1" parent="1">\n'
        f'          <mxGeometry x="{x}" y="{y}" width="{width}" height="{height}" as="geometry"/>\n'
        f'        </mxCell>\n'
    )


def phase_container(cell_id: str, label: str, x: int, y: int,
                    width: int, height: int) -> str:
    style = (
        "rounded=1;whiteSpace=wrap;html=1;dashed=1;dashPattern=6 4;"
        "fillColor=#F0F7FF;strokeColor=#0078D4;fontSize=11;"
        "fontFamily=Arial;fontStyle=1;verticalAlign=top;spacingTop=6;arcSize=6;"
    )
    escaped = html.escape(label)
    return (
        f'        <mxCell id="{cell_id}" value="{escaped}"\n'
        f'                style="{style}"\n'
        f'                vertex="1" parent="1">\n'
        f'          <mxGeometry x="{x}" y="{y}" width="{width}" height="{height}" as="geometry"/>\n'
        f'        </mxCell>\n'
    )


def edge(cell_id: str, label: str, source: str, target: str,
         color: str = "#0078D4", dashed: bool = False,
         width: int = 2) -> str:
    dash_str = "dashed=1;dashPattern=6 4;" if dashed else ""
    style = (
        f"endArrow=block;endFill=1;html=1;strokeColor={color};"
        f"strokeWidth={width};fontFamily=Arial;fontSize=9;"
        f"fontColor=#333333;{dash_str}"
    )
    escaped = html.escape(label)
    return (
        f'        <mxCell id="{cell_id}" value="{escaped}"\n'
        f'                style="{style}"\n'
        f'                edge="1" parent="1" source="{source}" target="{target}">\n'
        f'          <mxGeometry relative="1" as="geometry"/>\n'
        f'        </mxCell>\n'
    )


def label_only(cell_id: str, label: str, x: int, y: int,
               width: int, height: int = 24,
               font_color: str = "#666666") -> str:
    style = (
        f"text;html=1;align=center;fontFamily=Arial;fontSize=9;"
        f"fontColor={font_color};fontStyle=2;"
    )
    escaped = html.escape(label)
    return (
        f'        <mxCell id="{cell_id}" value="{escaped}"\n'
        f'                style="{style}"\n'
        f'                vertex="1" parent="1">\n'
        f'          <mxGeometry x="{x}" y="{y}" width="{width}" height="{height}" as="geometry"/>\n'
        f'        </mxCell>\n'
    )


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    DEMO_DIR.mkdir(parents=True, exist_ok=True)

    # Load Azure icons
    ico_vnet   = get_image_data("024 networking.xml",              "10061-icon-service-Virtual-Networks")
    ico_rg     = get_image_data("011 general.xml",                 "10007-icon-service-Resource-Groups")
    ico_la     = get_image_data("023 monitor.xml",                 "00009-icon-service-Log-Analytics-Workspaces")
    ico_appi   = get_image_data("023 monitor.xml",                 "00012-icon-service-Application-Insights")
    ico_kv     = get_image_data("027 security.xml",                "10245-icon-service-Key-Vaults")
    ico_dns    = get_image_data("024 networking.xml",              "10064-icon-service-DNS-Zones")
    ico_sql    = get_image_data("009 databases.xml",               "10132-icon-service-SQL-Server")
    ico_pe     = get_image_data("024 networking.xml",              "00427-icon-service-Private-Link")
    ico_st     = get_image_data("028 storage.xml",                 "10086-icon-service-Storage-Accounts")
    ico_asp    = get_image_data("003 app services.xml",            "00046-icon-service-App-Service-Plans")
    ico_app    = get_image_data("003 app services.xml",            "10035-icon-service-App-Services")
    ico_budget = get_image_data("017 management + governance.xml", "00004-icon-service-Cost-Management-and-Billing")
    ico_scale  = get_image_data("023 monitor.xml",                 "10832-icon-service-Auto-Scale")

    cells = []

    # -------------------------------------------------------------------------
    # Canvas: pageWidth=1900, pageHeight=900
    # Layout: 5 phase columns, left → right
    # Columns at x = 60, 380, 700, 1020, 1340
    # -------------------------------------------------------------------------

    # Title
    cells.append(label_only(
        "title", "FreshConnect MVP — Module Dependency Graph (Bicep · AVM-first)",
        50, 20, 1800, 30, "#003366"
    ))

    # =========================================================================
    # PHASE 1 — Foundation (x=60, independent)
    # =========================================================================
    cells.append(phase_container("ph1-box", "Phase 1 · Foundation", 60, 60, 270, 540))

    cells.append(resource_with_icon(
        "vnet", "vnet-ico", "Virtual Network\nvnet-nordic-fresh-foods-prod\n10.0.0.0/16",
        ico_vnet, 80, 110, 230, 80
    ))
    cells.append(label_only("vnet-sub", "AVM: network/virtual-network:0.7.2", 80, 196, 230))

    cells.append(resource_box(
        "nsg-app", "NSG — App Subnet\nnsg-app-prod",
        80, 240, 100, 60, "#F5F9FF", "#5B9BD5"
    ))
    cells.append(resource_box(
        "nsg-data", "NSG — Data Subnet\nnsg-data-prod",
        190, 240, 100, 60, "#F5F9FF", "#5B9BD5"
    ))
    cells.append(resource_box(
        "nsg-pe", "NSG — PE Subnet\nnsg-pe-prod",
        80, 320, 100, 60, "#F5F9FF", "#5B9BD5"
    ))
    cells.append(resource_with_icon(
        "rg", "rg-ico", "Resource Group\nrg-nordic-fresh-foods-prod\n9 mandatory tags (Policy)",
        ico_rg, 80, 420, 230, 80, "#FFF8E7", "#D6A000", "#5C4000"
    ))
    cells.append(label_only("rg-sub", "az group create (CLI)", 80, 506, 230))

    # =========================================================================
    # PHASE 2 — Observability (x=380, independent)
    # =========================================================================
    cells.append(phase_container("ph2-box", "Phase 2 · Observability", 380, 200, 270, 260))

    cells.append(resource_with_icon(
        "la", "la-ico", "Log Analytics Workspace\nlog-nordic-fresh-foods-prod\n30-day retention · 5 GB/day cap",
        ico_la, 400, 250, 230, 80
    ))
    cells.append(label_only("la-sub", "AVM: operational-insights/workspace:0.15.0", 400, 336, 230))

    cells.append(resource_with_icon(
        "appi", "appi-ico", "Application Insights\nappi-nordic-fresh-foods-prod\nWorkspace-based · 50% sampling",
        ico_appi, 400, 370, 230, 80
    ))
    cells.append(label_only("appi-sub", "AVM: insights/component:0.7.1", 400, 456, 230))

    # =========================================================================
    # PHASE 3 — Security + DNS (x=700, depends on Phase 1)
    # =========================================================================
    cells.append(phase_container("ph3-box", "Phase 3 · Security + DNS", 700, 60, 270, 540))

    cells.append(resource_with_icon(
        "kv", "kv-ico", "Key Vault\nkv-nff-prod-{suffix}\nRBAC · Purge Protect · PE",
        ico_kv, 720, 110, 230, 80
    ))
    cells.append(label_only("kv-sub", "AVM: key-vault/vault:0.13.3", 720, 196, 230))

    cells.append(resource_with_icon(
        "dns-sql", "dns-sql-ico", "Private DNS Zone\nprivatelink.database.windows.net\n+ VNet link",
        ico_dns, 720, 240, 230, 70
    ))
    cells.append(label_only("dns-sql-sub", "AVM: network/private-dns-zone:0.8.1", 720, 316, 230))

    cells.append(resource_with_icon(
        "dns-blob", "dns-blob-ico", "Private DNS Zone\nprivatelink.blob.core.windows.net\n+ VNet link",
        ico_dns, 720, 360, 230, 70
    ))
    cells.append(label_only("dns-blob-sub", "AVM: network/private-dns-zone:0.8.1", 720, 436, 230))

    cells.append(resource_with_icon(
        "dns-kv", "dns-kv-ico", "Private DNS Zone\nprivatelink.vaultcore.azure.net\n+ VNet link",
        ico_dns, 720, 480, 230, 70
    ))
    cells.append(label_only("dns-kv-sub", "AVM: network/private-dns-zone:0.8.1", 720, 556, 230))

    # =========================================================================
    # PHASE 4 — Data (x=1020, depends on Phases 1–3)
    # =========================================================================
    cells.append(phase_container("ph4-box", "Phase 4 · Data Layer", 1020, 60, 270, 540))

    cells.append(resource_with_icon(
        "sql", "sql-ico", "SQL Server + Database\nsql-nordic-fresh-foods-prod\nsqldb-freshconnect-prod · S0 · AD-only",
        ico_sql, 1040, 110, 230, 80
    ))
    cells.append(label_only("sql-sub", "AVM: sql/server:0.21.1", 1040, 196, 230))

    cells.append(resource_with_icon(
        "pe-sql-res", "pe-sql-ico", "Private Endpoint\npe-sql-nordic-fresh-foods-prod\nsnet-pe · sqlServer",
        ico_pe, 1040, 240, 230, 70, "#F5F9FF", "#5B9BD5"
    ))
    cells.append(label_only("pe-sql-sub", "AVM: network/private-endpoint:0.12.0", 1040, 316, 230))

    cells.append(resource_with_icon(
        "st", "st-ico", "Storage Account\nstnffprod{suffix}\nStandard LRS · No public blob · TLS 1.2",
        ico_st, 1040, 360, 230, 80
    ))
    cells.append(label_only("st-sub", "AVM: storage/storage-account:0.32.0", 1040, 446, 230))

    cells.append(resource_with_icon(
        "pe-st-res", "pe-st-ico", "Private Endpoint\npe-st-nordic-fresh-foods-prod\nsnet-pe · blob",
        ico_pe, 1040, 490, 230, 70, "#F5F9FF", "#5B9BD5"
    ))
    cells.append(label_only("pe-st-sub", "AVM: network/private-endpoint:0.12.0", 1040, 566, 230))

    # =========================================================================
    # PHASE 5 — Compute + Budget (x=1340, depends on all)
    # =========================================================================
    cells.append(phase_container("ph5-box", "Phase 5 · Compute + Budget", 1340, 60, 510, 540))

    cells.append(resource_with_icon(
        "asp", "asp-ico", "App Service Plan\nasp-nordic-fresh-foods-prod\nLinux S1 · 2 instances · autoscale → 3",
        ico_asp, 1360, 110, 230, 80
    ))
    cells.append(label_only("asp-sub", "AVM: web/serverfarm:0.7.0", 1360, 196, 230))

    cells.append(resource_with_icon(
        "app", "app-ico", "App Service\napp-nordic-fresh-foods-prod\nHTTPS-only · MI · VNet integration",
        ico_app, 1360, 260, 230, 100
    ))
    cells.append(label_only("app-sub-roles", "RBAC: KV Secrets User + Storage Blob Data Contributor", 1360, 365, 230, 20))
    cells.append(label_only("app-sub", "AVM: web/site:0.22.0", 1360, 386, 230))

    cells.append(resource_with_icon(
        "budget", "budget-ico", "Budget Alert\nbudget-nordic-fresh-foods\n€800 prod · €200 dev · 80%/90%/100% alerts",
        ico_budget, 1620, 260, 200, 100, "#FFF8E7", "#D6A000", "#5C4000"
    ))
    cells.append(label_only("budget-sub", "Raw Bicep (no AVM for sub-scope budget)", 1620, 365, 200, 20))

    cells.append(resource_with_icon(
        "autoscale", "autoscale-ico", "Autoscale Settings\n(Prod only)\nCPU > 70% → scale out\nCPU < 30% → scale in",
        ico_scale, 1620, 110, 200, 100, "#F0FFF0", "#2E7D32", "#1A4D1A"
    ))

    # =========================================================================
    # EDGES — Phase dependencies
    # =========================================================================

    # Phase 1 → Phase 3 (VNet is required for DNS Zone VNet links and PE subnets)
    cells.append(edge("e-vnet-dns-sql", "", "vnet", "dns-sql", color="#0078D4", width=2))
    cells.append(edge("e-vnet-dns-blob", "", "vnet", "dns-blob", color="#0078D4", width=2))
    cells.append(edge("e-vnet-dns-kv", "", "vnet", "dns-kv", color="#0078D4", width=2))
    cells.append(edge("e-vnet-kv", "", "vnet", "kv", color="#0078D4", width=2))

    # Phase 3 → Phase 4 (DNS Zones required for PE dns zone groups)
    cells.append(edge("e-dns-sql-pe", "", "dns-sql", "pe-sql-res", color="#5B9BD5", width=1, dashed=True))
    cells.append(edge("e-dns-blob-pe", "", "dns-blob", "pe-st-res", color="#5B9BD5", width=1, dashed=True))
    cells.append(edge("e-kv-dns-pe", "PE needs DNS zone", "dns-kv", "kv", color="#5B9BD5", width=1, dashed=True))

    # Phase 2 + 3 → Phase 4 (monitoring + networking required for SQL/Storage)
    cells.append(edge("e-la-sql", "diagnostics", "la", "sql", color="#7B4DA0", width=1, dashed=True))
    cells.append(edge("e-la-st", "diagnostics", "la", "st", color="#7B4DA0", width=1, dashed=True))

    # Phase 4 → Phase 5 (App Service depends on SQL + Storage)
    cells.append(edge("e-sql-app", "SQL (contained user)", "sql", "app", color="#107C10", width=2))
    cells.append(edge("e-st-app", "Storage (RBAC)", "st", "app", color="#107C10", width=2))

    # Phase 3 → Phase 5 (KV dependency)
    cells.append(edge("e-kv-app", "KV Secrets User (RBAC)", "kv", "app", color="#C00000", width=2))

    # Phase 2 → Phase 5 (monitoring for App Service)
    cells.append(edge("e-appi-app", "telemetry", "appi", "app", color="#7B4DA0", width=1, dashed=True))
    cells.append(edge("e-la-app", "diagnostics", "la", "asp", color="#7B4DA0", width=1, dashed=True))

    # Phase 1 → Phase 5 (VNet integration)
    cells.append(edge("e-vnet-app", "VNet Integration (snet-app)", "vnet", "app", color="#0078D4", width=2))

    # =========================================================================
    # Legend
    # =========================================================================
    cells.append(resource_box(
        "legend", "Legend",
        50, 640, 120, 30, "#F5F5F5", "#999999", "#666666"
    ))
    cells.append(label_only(
        "legend-solid", "━━━ Hard dependency (blocking)",
        50, 676, 300, 20, "#0078D4"
    ))
    cells.append(label_only(
        "legend-dashed", "╌ ╌ Diagnostic / runtime dependency",
        50, 696, 300, 20, "#7B4DA0"
    ))

    # =========================================================================
    # Assemble XML
    # =========================================================================
    cells_xml = "".join(cells)

    diagram_xml = f"""<mxfile host="agent" modified="2026-03-23" agent="azure-diagrams" version="1.0">
  <diagram name="FreshConnect MVP — Dependency Graph" id="nff-dep-01">
    <mxGraphModel dx="1422" dy="762" grid="1" gridSize="10" guides="1" tooltips="1"
                  connect="1" arrows="1" fold="1" page="1" pageScale="1"
                  pageWidth="1900" pageHeight="900" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
{cells_xml}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
"""

    for out_dir in [OUTPUT_DIR, DEMO_DIR]:
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / "04-dependency-diagram.drawio"
        out_path.write_text(diagram_xml, encoding="utf-8")
        print(f"✅ Generated: {out_path}")

    print(f"   Cells: {len(cells)}")


if __name__ == "__main__":
    main()
