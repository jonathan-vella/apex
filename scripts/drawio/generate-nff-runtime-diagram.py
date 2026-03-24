"""
Generate the Nordic Fresh Foods FreshConnect MVP runtime flow diagram (draw.io).

Produces a runtime request flow diagram showing how a user request traverses
the system: User → App Service → (App Insights, Key Vault, SQL PE, Storage PE,
External APIs) with Log Analytics diagnostics and Budget Alert.

Output saved to agent-output/nordic-fresh-foods/04-runtime-diagram.drawio
and site/public/demo/04-runtime-diagram.drawio
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

# ---------------------------------------------------------------------------
# Shared cell helpers
# ---------------------------------------------------------------------------

def box_with_icon(cell_id: str, icon_id: str, label: str,
                  image_data: str,
                  x: int, y: int, width: int, height: int,
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


def box(cell_id: str, label: str, x: int, y: int,
        width: int, height: int,
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


def swim_lane(cell_id: str, label: str, x: int, y: int,
              width: int, height: int,
              fill: str = "#F0F7FF", stroke: str = "#0078D4") -> str:
    style = (
        f"rounded=1;whiteSpace=wrap;html=1;dashed=1;dashPattern=6 4;"
        f"fillColor={fill};strokeColor={stroke};"
        "fontFamily=Arial;fontSize=11;fontStyle=1;verticalAlign=top;spacingTop=6;arcSize=6;"
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
         width: int = 2, end_arrow: str = "block") -> str:
    dash_str = "dashed=1;dashPattern=6 4;" if dashed else ""
    style = (
        f"endArrow={end_arrow};endFill=1;html=1;strokeColor={color};"
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
    ico_entra  = get_image_data("013 identity.xml",     "03338-icon-service-External-Identities")
    ico_asp    = get_image_data("003 app services.xml", "00046-icon-service-App-Service-Plans")
    ico_app    = get_image_data("003 app services.xml", "10035-icon-service-App-Services")
    ico_pe     = get_image_data("024 networking.xml",   "00427-icon-service-Private-Link")
    ico_sql    = get_image_data("009 databases.xml",    "10130-icon-service-SQL-Database")
    ico_st     = get_image_data("028 storage.xml",      "10086-icon-service-Storage-Accounts")
    ico_appi   = get_image_data("023 monitor.xml",      "00012-icon-service-Application-Insights")
    ico_la     = get_image_data("023 monitor.xml",      "00009-icon-service-Log-Analytics-Workspaces")
    ico_kv     = get_image_data("027 security.xml",     "10245-icon-service-Key-Vaults")

    cells = []

    # -------------------------------------------------------------------------
    # Canvas: pageWidth=1900, pageHeight=900
    # Layout:
    #   Column 1 (x~60):   User + Auth
    #   Column 2 (x~360):  App Service (center hub)
    #   Column 3 (x~700):  Azure backend (SQL PE, Storage PE, KV, App Insights)
    #   Column 4 (x~1050): Infrastructure (Log Analytics, Budget)
    #   Column 5 (x~1350): External SaaS
    # -------------------------------------------------------------------------

    # Title
    cells.append(label_only(
        "title", "FreshConnect MVP — Runtime Request Flow",
        50, 18, 1800, 30, "#003366"
    ))

    # =========================================================================
    # ACTOR COLUMN (x=60)
    # =========================================================================

    cells.append(box(
        "user", "👤 User\n(Restaurant / Consumer\n/ Farmer)",
        60, 330, 180, 90,
        fill="#FFF8E7", stroke="#D6A000", font_color="#5C4000"
    ))

    cells.append(box_with_icon(
        "entra", "entra-ico", "Entra External ID\n(Social + Local Auth)\nOIDC / OAuth 2.0",
        ico_entra, 60, 170, 180, 90,
        fill="#F3E8FF", stroke="#7B1FA2", font_color="#4A0072"
    ))

    # =========================================================================
    # APP SERVICE COLUMN (x=360 — center hub)
    # =========================================================================

    cells.append(swim_lane(
        "vnet-zone", "Azure VNet  ·  vnet-nordic-fresh-foods-prod (10.0.0.0/16)",
        310, 120, 1300, 660
    ))

    cells.append(swim_lane(
        "snet-app-zone", "snet-app (10.0.1.0/24) — App Service VNet Integration",
        330, 160, 500, 580,
        fill="#FAFEFF", stroke="#5B9BD5"
    ))

    cells.append(box_with_icon(
        "asp-rt", "asp-rt-ico", "App Service Plan\nasp-nordic-fresh-foods-prod\nLinux S1 · min 2 / max 3 instances",
        ico_asp, 360, 200, 440, 80,
        fill="#E8F4FE", stroke="#0078D4"
    ))

    cells.append(box_with_icon(
        "app-rt", "app-rt-ico", "App Service\napp-nordic-fresh-foods-prod\nHTTPS-only · Managed Identity · VNet-integrated",
        ico_app, 360, 330, 440, 100,
        fill="#107C10", stroke="#004E1A", font_color="#FFFFFF"
    ))
    cells.append(label_only(
        "app-note", "snet-app · TLS 1.2 · FTPS-only · AlwaysOn · HTTP/2",
        360, 436, 440, 20, "#555555"
    ))

    cells.append(swim_lane(
        "snet-pe-zone", "snet-pe (10.0.3.0/24) — Private Endpoints",
        890, 160, 700, 580,
        fill="#FAFEFF", stroke="#5B9BD5"
    ))

    # =========================================================================
    # PRIVATE ENDPOINTS + BACKEND (x=920)
    # =========================================================================

    cells.append(box_with_icon(
        "pe-sql-rt", "pe-sql-rt-ico", "Private Endpoint → SQL\npe-sql-nordic-fresh-foods-prod\nprivatelink.database.windows.net",
        ico_pe, 920, 195, 300, 80,
        fill="#F5F9FF", stroke="#5B9BD5"
    ))

    cells.append(box_with_icon(
        "sql-rt", "sql-rt-ico", "Azure SQL Database\nsqldb-freshconnect-prod\nS0 · AD-only auth · Private access",
        ico_sql, 920, 315, 300, 90,
        fill="#EBF3FB", stroke="#0078D4"
    ))

    cells.append(box_with_icon(
        "pe-st-rt", "pe-st-rt-ico", "Private Endpoint → Storage\npe-st-nordic-fresh-foods-prod\nprivatelink.blob.core.windows.net",
        ico_pe, 920, 450, 300, 80,
        fill="#F5F9FF", stroke="#5B9BD5"
    ))

    cells.append(box_with_icon(
        "st-rt", "st-rt-ico", "Storage Account\nstnffprod\nProduct images · assets · private blob",
        ico_st, 920, 570, 300, 75,
        fill="#EBF3FB", stroke="#0078D4"
    ))

    # =========================================================================
    # OBSERVABILITY (right of VNet zone — overflows into monitoring section)
    # =========================================================================

    cells.append(swim_lane(
        "obs-zone", "Observability",
        1650, 120, 220, 330,
        fill="#F8F0FF", stroke="#7B1FA2"
    ))

    cells.append(box_with_icon(
        "appi-rt", "appi-rt-ico", "Application Insights\nappi-nordic-fresh-foods-prod\nPay-per-GB · 50% sampling",
        ico_appi, 1660, 165, 200, 80,
        fill="#F3E8FF", stroke="#7B1FA2", font_color="#4A0072"
    ))

    cells.append(box_with_icon(
        "la-rt", "la-rt-ico", "Log Analytics Workspace\nlog-nordic-fresh-foods-prod\n30-day retention · 2 GB/day cap",
        ico_la, 1660, 295, 200, 80,
        fill="#F3E8FF", stroke="#7B1FA2", font_color="#4A0072"
    ))

    # =========================================================================
    # KEY VAULT (inside VNet zone, adjacent to PE zone)
    # =========================================================================

    cells.append(box_with_icon(
        "kv-rt", "kv-rt-ico", "Key Vault\nkv-nff-prod\nRBAC · Purge Protect · Private Endpoint",
        ico_kv, 1260, 195, 290, 80,
        fill="#FFF3E0", stroke="#E65100", font_color="#BF360C"
    ))

    # =========================================================================
    # EXTERNAL SAAS (x=1650, bottom area)
    # =========================================================================

    cells.append(swim_lane(
        "ext-zone", "External SaaS",
        1650, 490, 220, 290,
        fill="#FFF8F8", stroke="#C62828"
    ))

    cells.append(box(
        "pay-gw-rt", "💳 Payment Gateway\n(External · REST · PCI scope)",
        1660, 535, 200, 60,
        fill="#FFEBEE", stroke="#C62828", font_color="#B71C1C"
    ))

    cells.append(box(
        "maps-rt", "🗺️ Maps / Routing API\n(External · REST)",
        1660, 613, 200, 55,
        fill="#FFEBEE", stroke="#C62828", font_color="#B71C1C"
    ))

    cells.append(box(
        "email-rt", "📧 Email / SMS Provider\n(External · REST)",
        1660, 686, 200, 55,
        fill="#FFEBEE", stroke="#C62828", font_color="#B71C1C"
    ))

    # =========================================================================
    # BUDGET ALERT (bottom)
    # =========================================================================

    cells.append(box(
        "budget-rt", "💰 Budget Alert\n€800/month (prod) · 80%/90%/100% thresholds\n→ Email (CTO)",
        60, 650, 200, 90,
        fill="#FFF8E7", stroke="#D6A000", font_color="#5C4000"
    ))

    # =========================================================================
    # EDGES — Request flow
    # =========================================================================

    # User auth flow via Entra
    cells.append(edge("e-user-auth", "1. Auth (OIDC)", "user", "entra",
                      color="#7B1FA2", width=2))
    cells.append(edge("e-auth-app", "Token / Claims", "entra", "app-rt",
                      color="#7B1FA2", width=2))

    # User → App Service (main request)
    cells.append(edge("e-user-app", "2. HTTPS Request", "user", "app-rt",
                      color="#0078D4", width=3))

    # App Service → PE → SQL
    cells.append(edge("e-app-pe-sql", "3. SQL query (private)", "app-rt", "pe-sql-rt",
                      color="#0078D4", width=2))
    cells.append(edge("e-pe-sql-db", "", "pe-sql-rt", "sql-rt",
                      color="#0078D4", width=1, dashed=True))

    # App Service → PE → Storage
    cells.append(edge("e-app-pe-st", "4. Blob read/write (private)", "app-rt", "pe-st-rt",
                      color="#0078D4", width=2))
    cells.append(edge("e-pe-st-blob", "", "pe-st-rt", "st-rt",
                      color="#0078D4", width=1, dashed=True))

    # App Service → Key Vault (MI)
    cells.append(edge("e-app-kv", "5. Secrets (Managed Identity)", "app-rt", "kv-rt",
                      color="#E65100", width=2))

    # App Service → App Insights (telemetry)
    cells.append(edge("e-app-appi", "6. Telemetry / APM", "app-rt", "appi-rt",
                      color="#7B1FA2", width=1, dashed=True))

    # App Service → External SaaS
    cells.append(edge("e-app-pay", "7a. Payment (REST / outbound)", "app-rt", "pay-gw-rt",
                      color="#C62828", width=1))
    cells.append(edge("e-app-maps", "7b. Route lookup (REST)", "app-rt", "maps-rt",
                      color="#C62828", width=1))
    cells.append(edge("e-app-email", "7c. Email / SMS (REST)", "app-rt", "email-rt",
                      color="#C62828", width=1))

    # Diagnostic settings → Log Analytics
    cells.append(edge("e-appi-la", "Workspace-based", "appi-rt", "la-rt",
                      color="#7B1FA2", width=1, dashed=True))
    cells.append(edge("e-app-la", "Diagnostic logs", "app-rt", "la-rt",
                      color="#7B1FA2", width=1, dashed=True))
    cells.append(edge("e-sql-la", "Audit logs", "sql-rt", "la-rt",
                      color="#7B1FA2", width=1, dashed=True))

    # Budget Alert
    cells.append(edge("e-sub-budget", "Cost monitoring", "la-rt", "budget-rt",
                      color="#D6A000", width=1, dashed=True))

    # =========================================================================
    # Step legend
    # =========================================================================

    cells.append(label_only(
        "leg-title", "Request steps", 60, 560, 200, 20, "#333333"
    ))
    cells.append(label_only(
        "leg-1", "1. User authenticates via Entra External ID", 60, 580, 200, 18, "#555555"
    ))
    cells.append(label_only(
        "leg-2", "2. HTTPS request to App Service", 60, 598, 200, 18, "#555555"
    ))
    cells.append(label_only(
        "leg-3", "3–4. Data access via Private Endpoints", 60, 616, 200, 18, "#555555"
    ))
    cells.append(label_only(
        "leg-4", "5. Secrets from Key Vault (Managed Identity)", 60, 634, 200, 18, "#555555"
    ))

    # =========================================================================
    # Assemble XML
    # =========================================================================
    cells_xml = "".join(cells)

    diagram_xml = f"""<mxfile host="agent" modified="2026-03-23" agent="azure-diagrams" version="1.0">
  <diagram name="FreshConnect MVP — Runtime Flow" id="nff-rt-01">
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
        out_path = out_dir / "04-runtime-diagram.drawio"
        out_path.write_text(diagram_xml, encoding="utf-8")
        print(f"✅ Generated: {out_path}")

    print(f"   Cells: {len(cells)}")


if __name__ == "__main__":
    main()
