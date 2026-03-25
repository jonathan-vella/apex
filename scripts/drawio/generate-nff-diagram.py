"""
Generate the Nordic Fresh Foods FreshConnect MVP architecture draw.io diagram.

Reads official Microsoft Azure icon SVGs from the built libraries and produces
a valid .drawio (mxGraphModel) file saved to agent-output/nordic-fresh-foods/.
"""
import json
import os
import html
import re
from pathlib import Path

LIBRARY_DIR = Path("assets/drawio-libraries/azure-public-service-icons")
OUTPUT_DIR = Path("agent-output/nordic-fresh-foods")

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


def icon_cell(cell_id: str, label: str, image_data: str,
              x: int, y: int, parent: str = "1",
              w: int = 48, h: int = 48) -> str:
    escaped = html.escape(label)
    return (
        f'        <mxCell id="{cell_id}" value="{escaped}"\n'
        f'                style="shape=image;verticalLabelPosition=bottom;verticalAlign=top;'
        f'imageAspect=0;aspect=fixed;labelWidth=160;overflow=width;'
        f'html=1;fontSize=9;fontFamily=Arial;image={image_data}"\n'
        f'                vertex="1" parent="{parent}">\n'
        f'          <mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/>\n'
        f'        </mxCell>\n'
    )


def container(cell_id: str, label: str, x: int, y: int,
              width: int, height: int, parent: str = "1",
              style_extra: str = "", font_style: int = 1) -> str:
    style = (
        "rounded=1;whiteSpace=wrap;html=1;dashed=1;dashPattern=5 5;"
        "fillColor=#E8F0FE;strokeColor=#0078D4;fontSize=13;"
        f"fontFamily=Arial;fontStyle={font_style};verticalAlign=top;"
        "spacingTop=8;arcSize=6;container=1;pointerEvents=0;" + style_extra
    )
    escaped = html.escape(label)
    return (
        f'        <mxCell id="{cell_id}" value="{escaped}"\n'
        f'                style="{style}"\n'
        f'                vertex="1" parent="{parent}">\n'
        f'          <mxGeometry x="{x}" y="{y}" width="{width}" height="{height}" as="geometry"/>\n'
        f'        </mxCell>\n'
    )


def vnet_container(cell_id: str, label: str, x: int, y: int,
                   width: int, height: int, parent: str = "1") -> str:
    style = (
        "rounded=1;whiteSpace=wrap;html=1;dashed=1;dashPattern=8 4;"
        "fillColor=#F0F8FF;strokeColor=#0078D4;fontSize=12;"
        "fontFamily=Arial;fontStyle=1;verticalAlign=top;"
        "spacingTop=8;arcSize=4;container=1;pointerEvents=0;"
    )
    escaped = html.escape(label)
    return (
        f'        <mxCell id="{cell_id}" value="{escaped}"\n'
        f'                style="{style}"\n'
        f'                vertex="1" parent="{parent}">\n'
        f'          <mxGeometry x="{x}" y="{y}" width="{width}" height="{height}" as="geometry"/>\n'
        f'        </mxCell>\n'
    )


def subnet_container(cell_id: str, label: str, x: int, y: int,
                     width: int, height: int, parent: str) -> str:
    style = (
        "rounded=1;whiteSpace=wrap;html=1;dashed=0;"
        "fillColor=#FFFFFF;strokeColor=#98C1D9;fontSize=11;"
        "fontFamily=Arial;verticalAlign=top;spacingTop=6;"
        "container=1;pointerEvents=0;"
    )
    escaped = html.escape(label)
    return (
        f'        <mxCell id="{cell_id}" value="{escaped}"\n'
        f'                style="{style}"\n'
        f'                vertex="1" parent="{parent}">\n'
        f'          <mxGeometry x="{x}" y="{y}" width="{width}" height="{height}" as="geometry"/>\n'
        f'        </mxCell>\n'
    )


def edge(cell_id: str, label: str, source: str, target: str,
         parent: str = "1", color: str = "#0078D4",
         dashed: bool = False, width: int = 1) -> str:
    dash_str = "dashed=1;dashPattern=5 5;" if dashed else ""
    style = (
        f"endArrow=classic;html=1;strokeColor={color};strokeWidth={width};"
        f"fontFamily=Arial;fontSize=10;{dash_str}"
    )
    escaped = html.escape(label)
    return (
        f'        <mxCell id="{cell_id}" value="{escaped}"\n'
        f'                style="{style}"\n'
        f'                edge="1" parent="{parent}" source="{source}" target="{target}">\n'
        f'          <mxGeometry relative="1" as="geometry"/>\n'
        f'        </mxCell>\n'
    )


def box(cell_id: str, label: str, x: int, y: int,
        width: int, height: int, parent: str = "1",
        fill: str = "#f5f5f5", stroke: str = "#666666",
        font_color: str = "#333333") -> str:
    style = (
        f"rounded=1;whiteSpace=wrap;html=1;fillColor={fill};"
        f"strokeColor={stroke};fontColor={font_color};"
        "fontFamily=Arial;fontSize=11;"
    )
    escaped = html.escape(label)
    return (
        f'        <mxCell id="{cell_id}" value="{escaped}"\n'
        f'                style="{style}"\n'
        f'                vertex="1" parent="{parent}">\n'
        f'          <mxGeometry x="{x}" y="{y}" width="{width}" height="{height}" as="geometry"/>\n'
        f'        </mxCell>\n'
    )


def label_box(cell_id: str, label: str, x: int, y: int,
              width: int, height: int, parent: str = "1",
              fill: str = "#dae8fc", stroke: str = "#6c8ebf") -> str:
    return box(cell_id, label, x, y, width, height, parent, fill, stroke, "#00264d")


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Load icon data
    app_svc      = get_image_data("003 app services.xml", "10035-icon-service-App-Services")
    log_analytics = get_image_data("002 analytics.xml", "Log-Analytics-Workspaces")
    app_insights  = get_image_data("010 devops.xml", "Application-Insights")
    private_link  = get_image_data("024 networking.xml", "00427-icon-service-Private-Link")
    entra_icon    = get_image_data("013 identity.xml", "Entra-Managed-Identities")
    asp_icon      = get_image_data("003 app services.xml", "App-Service-Plans")
    sql_icon      = get_image_data("009 databases.xml", "SQL-Database")
    kv_icon       = get_image_data("027 security.xml", "Key-Vault")
    st_icon       = get_image_data("028 storage.xml", "Storage-Account")
    vnet_icon     = get_image_data("024 networking.xml", "Virtual-Network")

    cells = []

    # -------------------------------------------------------------------------
    # Canvas: pageWidth=1900, pageHeight=1100
    # Layout (L→R): Actors | RG [ VNet [ subnets ] | Monitoring ] | External SaaS
    # -------------------------------------------------------------------------

    # --- External Users (far left) ---
    cells.append(box(
        "users-box", "👤 Users\n(Restaurants, Consumers, Farmers)",
        30, 420, 160, 70, "1", "#fff2cc", "#d6b656", "#333333"
    ))

    # --- Entra External ID (top left, outside Azure) ---
    cells.append(icon_cell("entra-1", "Entra External ID\n(Social + Local Auth)",
                           entra_icon, 50, 220))

    # --- Resource Group container ---
    cells.append(container("rg-prod", "rg-nordic-fresh-foods-prod", 240, 80, 1260, 880))

    # --- VNet container (inside RG) ---
    cells.append(vnet_container("vnet-1", "vnet-nordic-fresh-foods-prod (10.0.0.0/16)",
                                30, 50, 1000, 790, "rg-prod"))

    # --- snet-app subnet ---
    cells.append(subnet_container("snet-app", "snet-app (10.0.1.0/24) — VNet Integration",
                                  20, 60, 540, 220, "vnet-1"))

    # App Service Plan + App Service inside snet-app
    cells.append(icon_cell("asp-1", "asp-nordic-fresh-foods-prod\n(S1 · 2–3 instances)",
                           asp_icon, 50, 65, "snet-app"))
    cells.append(icon_cell("app-1", "app-nordic-fresh-foods-prod\n(Web + API · HTTPS-only · MI)",
                           app_svc, 310, 65, "snet-app"))

    # --- snet-data subnet ---
    cells.append(subnet_container("snet-data", "snet-data (10.0.2.0/24)",
                                  20, 320, 540, 170, "vnet-1"))

    cells.append(icon_cell("sql-1", "sql-nordic-fresh-foods-prod\n(S0 · 10 DTU · Azure AD auth)",
                           sql_icon, 50, 45, "snet-data"))
    cells.append(icon_cell("st-1", "stnffprod (Standard LRS)\n(Images · Assets · HTTPS)",
                           st_icon, 310, 45, "snet-data"))

    # --- snet-pe subnet ---
    cells.append(subnet_container("snet-pe", "snet-pe (10.0.3.0/24) — Private Endpoints",
                                  20, 530, 540, 200, "vnet-1"))

    cells.append(icon_cell("pe-sql", "PE → SQL\n(privatelink.database.windows.net)",
                           private_link, 50, 50, "snet-pe"))
    cells.append(icon_cell("pe-st", "PE → Storage\n(privatelink.blob.core.windows.net)",
                           private_link, 310, 50, "snet-pe"))

    # --- Key Vault (in RG, outside VNet) ---
    cells.append(icon_cell("kv-1", "kv-nff-prod\n(RBAC · Purge Protect · MI)",
                           kv_icon, 1060, 90, "rg-prod"))

    # --- Monitoring (in RG, outside VNet) ---
    cells.append(icon_cell("ai-1", "appi-nff-prod\n(App Insights · Pay-per-GB)",
                           app_insights, 1060, 310, "rg-prod"))
    cells.append(icon_cell("la-1", "log-nff-prod\n(Log Analytics · 30d retention)",
                           log_analytics, 1060, 500, "rg-prod"))

    # Budget monitoring note
    cells.append(label_box("budget-note",
                           "💰 Budget Alert\n€900 / month (90% cap)",
                           1055, 680, 150, 55, "rg-prod",
                           "#fff2cc", "#d6b656"))

    # --- External SaaS (far right) ---
    cells.append(box("pay-gw",   "💳 Payment Gateway\n(External · REST · PCI scope)",
                     1560, 220, 190, 65, "1", "#f8cecc", "#b85450"))
    cells.append(box("maps-api", "🗺️ Maps / Routing API\n(External · REST)",
                     1560, 350, 190, 65, "1", "#f8cecc", "#b85450"))
    cells.append(box("email-sms","📧 Email / SMS\n(External · REST)",
                     1560, 480, 190, 65, "1", "#f8cecc", "#b85450"))

    # Dev environment note
    cells.append(label_box("dev-env",
                           "Dev environment:\nrg-nordic-fresh-foods-dev\nB1 + SQL Basic (separate VNet)",
                           30, 1010, 260, 60, "1", "#f0f0f0", "#999999"))

    # =========================================================================
    # EDGES
    # =========================================================================

    # User → App Service (via HTTPS)
    cells.append(edge("e-users-app", "HTTPS", "users-box", "app-1",
                      color="#0078D4", width=2))

    # User → Entra External ID (auth)
    cells.append(edge("e-users-entra", "Auth / OIDC", "users-box", "entra-1",
                      color="#C00000", width=2))

    # Entra → App Service (token validation)
    cells.append(edge("e-entra-app", "Token", "entra-1", "app-1",
                      color="#C00000"))

    # App Service → SQL (via VNet / Private Endpoint)
    cells.append(edge("e-app-sql", "SQL (Private)", "app-1", "pe-sql",
                      color="#0078D4"))

    # App Service → Storage (via VNet / Private Endpoint)
    cells.append(edge("e-app-st", "Blob (Private)", "app-1", "pe-st",
                      color="#0078D4"))

    # App Service → Key Vault (Managed Identity)
    cells.append(edge("e-app-kv", "Secrets (MI)", "app-1", "kv-1",
                      color="#C00000"))

    # App Service → App Insights (APM)
    cells.append(edge("e-app-ai", "APM / Telemetry", "app-1", "ai-1",
                      color="#6B4DA0", dashed=True))

    # App Insights → Log Analytics
    cells.append(edge("e-ai-la", "Workspace-based", "ai-1", "la-1",
                      color="#6B4DA0", dashed=True))

    # App Service → External SaaS
    cells.append(edge("e-app-pay",   "Outbound REST", "app-1", "pay-gw",   color="#FF8C00"))
    cells.append(edge("e-app-maps",  "Outbound REST", "app-1", "maps-api", color="#FF8C00"))
    cells.append(edge("e-app-email", "Outbound REST", "app-1", "email-sms",color="#FF8C00"))

    # PE → SQL and PE → Storage (internal)
    cells.append(edge("e-pe-sql",  "", "pe-sql", "sql-1", color="#0078D4", dashed=True))
    cells.append(edge("e-pe-st",   "", "pe-st",  "st-1",  color="#0078D4", dashed=True))

    # =========================================================================
    # Assemble XML
    # =========================================================================
    cells_xml = "".join(cells)

    diagram_xml = f"""<mxfile host="agent" modified="2026-03-23" agent="azure-diagrams" version="1.0">
  <diagram name="FreshConnect MVP Architecture" id="nff-arch-01">
    <mxGraphModel dx="1422" dy="762" grid="1" gridSize="10" guides="1" tooltips="1"
                  connect="1" arrows="1" fold="1" page="1" pageScale="1"
                  pageWidth="1900" pageHeight="1100" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
{cells_xml}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
"""

    DEMO_DIR = Path("site/public/demo")
    for out_dir in [OUTPUT_DIR, DEMO_DIR]:
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / "03-des-diagram.drawio"
        out_path.write_text(diagram_xml, encoding="utf-8")
        print(f"✅ Generated: {out_path}")

    print(f"   Cells: {len(cells)}")


if __name__ == "__main__":
    main()
