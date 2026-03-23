"""
Generate the Nordic Fresh Foods FreshConnect As-Built Architecture diagram (draw.io).

Replicates the post-deployment as-built view showing the full deployed stack:
Identity (Entra + MI) → App Service → Private Endpoints → Backend Services,
with Key Vault, Private DNS, Observability, and External SaaS connections.

Output saved to agent-output/nordic-fresh-foods/07-ab-diagram.drawio
and site/public/demo/07-ab-diagram.drawio
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


def icon_cell(cell_id: str, label: str, image_data: str,
              x: int, y: int, w: int = 48, h: int = 48) -> str:
    """Azure icon with label below (shape=image style)."""
    escaped = html.escape(label)
    return (
        f'        <mxCell id="{cell_id}" value="{escaped}"\n'
        f'                style="shape=image;verticalLabelPosition=bottom;verticalAlign=top;'
        f'imageAspect=0;aspect=fixed;labelWidth=140;overflow=width;'
        f'html=1;fontSize=9;fontFamily=Arial;image={image_data}"\n'
        f'                vertex="1" parent="1">\n'
        f'          <mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/>\n'
        f'        </mxCell>\n'
    )


def zone(cell_id: str, label: str, x: int, y: int, width: int, height: int,
         fill: str = "#F0F8FF", stroke: str = "#0078D4",
         font_color: str = "#003366", dashed: bool = False,
         font_style: int = 1, font_size: int = 11,
         v_align: str = "top", spacing_top: int = 6) -> str:
    """Background zone rectangle (no container=1 — flat layout)."""
    dash_str = "dashed=1;dashPattern=6 4;" if dashed else ""
    style = (
        f"rounded=1;whiteSpace=wrap;html=1;{dash_str}"
        f"fillColor={fill};strokeColor={stroke};fontColor={font_color};"
        f"fontFamily=Arial;fontSize={font_size};fontStyle={font_style};"
        f"verticalAlign={v_align};spacingTop={spacing_top};arcSize=5;"
    )
    escaped = html.escape(label)
    return (
        f'        <mxCell id="{cell_id}" value="{escaped}"\n'
        f'                style="{style}"\n'
        f'                vertex="1" parent="1">\n'
        f'          <mxGeometry x="{x}" y="{y}" width="{width}" height="{height}" as="geometry"/>\n'
        f'        </mxCell>\n'
    )


def text_label(cell_id: str, label: str, x: int, y: int,
               width: int, height: int = 24,
               font_color: str = "#555555", font_style: int = 0,
               font_size: int = 9, align: str = "center") -> str:
    style = (
        f"text;html=1;align={align};fontFamily=Arial;"
        f"fontSize={font_size};fontColor={font_color};fontStyle={font_style};"
    )
    escaped = html.escape(label)
    return (
        f'        <mxCell id="{cell_id}" value="{escaped}"\n'
        f'                style="{style}"\n'
        f'                vertex="1" parent="1">\n'
        f'          <mxGeometry x="{x}" y="{y}" width="{width}" height="{height}" as="geometry"/>\n'
        f'        </mxCell>\n'
    )


def ext_box(cell_id: str, label: str, x: int, y: int,
            width: int = 160, height: int = 60) -> str:
    """External service box (no Azure icon)."""
    style = (
        "rounded=1;whiteSpace=wrap;html=1;"
        "fillColor=#FFEBEE;strokeColor=#C62828;fontColor=#B71C1C;"
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


def edge(cell_id: str, label: str, source: str, target: str,
         color: str = "#0078D4", dashed: bool = False,
         width: int = 1, end_arrow: str = "block") -> str:
    dash_str = "dashed=1;dashPattern=6 4;" if dashed else ""
    style = (
        f"endArrow={end_arrow};endFill=1;html=1;strokeColor={color};"
        f"strokeWidth={width};fontFamily=Arial;fontSize=9;"
        f"fontColor=#333333;{dash_str}edgeStyle=orthogonalEdgeStyle;"
    )
    escaped = html.escape(label)
    return (
        f'        <mxCell id="{cell_id}" value="{escaped}"\n'
        f'                style="{style}"\n'
        f'                edge="1" parent="1" source="{source}" target="{target}">\n'
        f'          <mxGeometry relative="1" as="geometry"/>\n'
        f'        </mxCell>\n'
    )


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    DEMO_DIR.mkdir(parents=True, exist_ok=True)

    # Load Azure icons
    ico_users  = get_image_data("013 identity.xml",     "10230-icon-service-Users")
    ico_entra  = get_image_data("013 identity.xml",     "03338-icon-service-External-Identities")
    ico_mi     = get_image_data("013 identity.xml",     "10227-icon-service-Managed-Identities")
    ico_app    = get_image_data("003 app services.xml", "10035-icon-service-App-Services")
    ico_pe     = get_image_data("024 networking.xml",   "00427-icon-service-Private-Link")
    ico_kv     = get_image_data("027 security.xml",     "10245-icon-service-Key-Vaults")
    ico_dns    = get_image_data("024 networking.xml",   "10064-icon-service-DNS-Zones")
    ico_st     = get_image_data("028 storage.xml",      "10086-icon-service-Storage-Accounts")
    ico_sql    = get_image_data("009 databases.xml",    "10130-icon-service-SQL-Database")
    ico_appi   = get_image_data("023 monitor.xml",      "00012-icon-service-Application-Insights")
    ico_la     = get_image_data("023 monitor.xml",      "00009-icon-service-Log-Analytics-Workspaces")
    ico_vnet   = get_image_data("024 networking.xml",   "10061-icon-service-Virtual-Networks")

    cells = []

    # =========================================================================
    # TITLE
    # =========================================================================
    cells.append(text_label(
        "title", "Nordic Fresh Foods — As-Built Architecture",
        250, 12, 1620, 22, "#003366", font_style=3, font_size=13, align="center"
    ))
    cells.append(text_label(
        "subtitle", "swedencentral  |  rg-nordic-fresh-foods-prod",
        250, 32, 1620, 16, "#555555", font_style=2, font_size=10, align="center"
    ))

    # =========================================================================
    # IDENTITY PANEL (left, x=20..205)
    # =========================================================================
    cells.append(zone(
        "identity-bg", "Identity",
        20, 60, 185, 900,
        fill="#EFF6FF", stroke="#3B82F6", font_color="#1E3A5F",
        dashed=False, font_style=1, font_size=12, v_align="top", spacing_top=8
    ))

    cells.append(icon_cell("ico-users",
        "Restaurants\nConsumers\nFarmers",
        ico_users, 83, 130, 48, 48
    ))

    cells.append(icon_cell("ico-entra",
        "Entra External ID\n(Social + Local Auth)",
        ico_entra, 83, 330, 48, 48
    ))

    cells.append(icon_cell("ico-mi",
        "App Service\nManaged Identity",
        ico_mi, 83, 530, 48, 48
    ))

    # =========================================================================
    # AZURE SUBSCRIPTION / RESOURCE GROUP (main container box)
    # x=225, y=50, w=1560, h=1080
    # =========================================================================
    cells.append(zone(
        "sub-bg",
        "Azure Subscription\nrg-nordic-fresh-foods-prod",
        225, 50, 1560, 1080,
        fill="#E8F0FE", stroke="#0078D4",
        font_color="#003366", dashed=True, font_style=1, font_size=11,
        v_align="top", spacing_top=8
    ))

    # =========================================================================
    # NETWORK / VNET ZONE (inside RG, left section)
    # x=248, y=130, w=675, h=710
    # =========================================================================
    cells.append(zone(
        "vnet-bg",
        "Network\nVNet 10.0.0.0/16",
        248, 130, 675, 710,
        fill="#F0F8FF", stroke="#0078D4",
        font_color="#003366", dashed=True, font_style=1, font_size=11,
        v_align="top", spacing_top=8
    ))

    # VNet icon (small, top-right of vnet zone)
    cells.append(icon_cell("ico-vnet",
        "",
        ico_vnet, 876, 138, 28, 28
    ))

    # =========================================================================
    # SNET-PE (inside VNet, left column)
    # x=268, y=200, w=255, h=520
    # =========================================================================
    cells.append(zone(
        "snet-pe-bg",
        "snet-pe\n10.0.3.0/24",
        268, 200, 255, 520,
        fill="#FAFEFF", stroke="#5B9BD5",
        font_color="#003366", dashed=False, font_style=1, font_size=10,
        v_align="top", spacing_top=6
    ))

    cells.append(icon_cell("ico-pe-kv",
        "PE KeyVault\n(pe-kv-nff-prod)",
        ico_pe, 343, 260, 48, 48
    ))
    cells.append(icon_cell("ico-pe-blob",
        "PE Blob\n(pe-st-nff-prod)",
        ico_pe, 343, 400, 48, 48
    ))
    cells.append(icon_cell("ico-pe-sql",
        "PE SQL\n(pe-sql-nff-prod)",
        ico_pe, 343, 550, 48, 48
    ))

    # =========================================================================
    # SNET-APP / APP TIER (inside VNet, right column, upper)
    # x=545, y=200, w=355, h=290
    # =========================================================================
    cells.append(zone(
        "snet-app-bg",
        "App Tier\nsnet-app 10.0.1.0/24  (S1 plan)",
        545, 200, 355, 290,
        fill="#F0FFF4", stroke="#107C10",
        font_color="#1A4D1A", dashed=False, font_style=1, font_size=10,
        v_align="top", spacing_top=6
    ))

    cells.append(icon_cell("ico-app",
        "app-nordic-fresh-foods-prod\n(HTTPS-only · MI · VNet-integrated)",
        ico_app, 671, 295, 64, 64
    ))

    # =========================================================================
    # OBSERVABILITY ZONE (inside VNet, right column, lower)
    # x=545, y=518, w=355, h=295
    # =========================================================================
    cells.append(zone(
        "observ-bg",
        "Observability",
        545, 518, 355, 295,
        fill="#F8F0FF", stroke="#7B1FA2",
        font_color="#4A0072", dashed=False, font_style=1, font_size=11,
        v_align="top", spacing_top=8
    ))

    cells.append(icon_cell("ico-appi",
        "appi-nordic-fresh-foods-prod\n(Pay-per-GB · 50% sampling)",
        ico_appi, 565, 570, 48, 48
    ))
    cells.append(icon_cell("ico-la",
        "log-nordic-fresh-foods-prod\n(30d retention · 2 GB/day cap)",
        ico_la, 755, 570, 48, 48
    ))

    # =========================================================================
    # SECURITY PANEL (inside RG, right side, top)
    # x=958, y=90, w=260, h=290
    # =========================================================================
    cells.append(zone(
        "security-bg",
        "Security",
        958, 90, 260, 290,
        fill="#FFF0F0", stroke="#C62828",
        font_color="#7B0000", dashed=False, font_style=1, font_size=11,
        v_align="top", spacing_top=8
    ))

    cells.append(icon_cell("ico-kv",
        "kv-nff-prod\n(RBAC · Purge Protect · Premium SKU)",
        ico_kv, 1039, 158, 64, 64
    ))

    # =========================================================================
    # PRIVATE DNS PANEL (inside RG, right side, middle)
    # x=958, y=400, w=260, h=380
    # =========================================================================
    cells.append(zone(
        "dns-bg",
        "Private DNS",
        958, 400, 260, 410,
        fill="#E8F8F0", stroke="#2E7D32",
        font_color="#1B4D1B", dashed=False, font_style=1, font_size=11,
        v_align="top", spacing_top=8
    ))

    cells.append(icon_cell("ico-dns-kv",
        "privatelink.vaultcore.azure.net",
        ico_dns, 968, 455, 40, 40
    ))
    cells.append(icon_cell("ico-dns-blob",
        "privatelink.blob.core.windows.net",
        ico_dns, 968, 555, 40, 40
    ))
    cells.append(icon_cell("ico-dns-sql",
        "privatelink.database.windows.net",
        ico_dns, 968, 660, 40, 40
    ))

    # =========================================================================
    # DATA TIER PANEL (inside RG, right side, bottom)
    # x=958, y=830, w=260, h=280
    # =========================================================================
    cells.append(zone(
        "data-bg",
        "Data Tier\npublicNetworkAccess: Disabled",
        958, 830, 260, 280,
        fill="#FFF8E7", stroke="#D6A000",
        font_color="#5C4000", dashed=False, font_style=1, font_size=11,
        v_align="top", spacing_top=8
    ))

    cells.append(icon_cell("ico-st",
        "stnffprod{suffix}\n(Standard LRS · No public blob)",
        ico_st, 978, 888, 48, 48
    ))
    cells.append(icon_cell("ico-sql",
        "sqldb-freshconnect-prod\n(S0 · AD-only auth)",
        ico_sql, 1100, 888, 64, 64
    ))

    # =========================================================================
    # EXTERNAL SERVICES (below RG box, bottom)
    # x=248, y=1150, w=675, h=120
    # =========================================================================
    cells.append(zone(
        "ext-bg",
        "External Services",
        248, 1155, 675, 130,
        fill="#FFF8F0", stroke="#E65100",
        font_color="#BF360C", dashed=True, font_style=1, font_size=11,
        v_align="top", spacing_top=6
    ))

    cells.append(ext_box("ext-payment", "💳 Payment Gateway\n(REST · PCI scope)", 268, 1195, 190, 60))
    cells.append(ext_box("ext-maps",    "🗺️ Maps / Routing API\n(REST)", 480, 1195, 190, 60))
    cells.append(ext_box("ext-email",   "📧 Email / SMS Provider\n(REST)", 692, 1195, 190, 60))

    # =========================================================================
    # EDGES
    # =========================================================================

    # 1. Identity flows
    cells.append(edge("e-users-oidc", "OIDC / OIDX",
                      "ico-users", "ico-entra",
                      color="#C62828", width=2))
    cells.append(edge("e-entra-jwt", "JWT",
                      "ico-entra", "ico-app",
                      color="#C62828", width=2))
    cells.append(edge("e-mi-app", "MI auth",
                      "ico-mi", "ico-app",
                      color="#107C10", width=1, dashed=True))

    # 2. User HTTPS → App Service
    cells.append(edge("e-users-https", "HTTPS",
                      "ico-users", "ico-app",
                      color="#0078D4", width=3))

    # 3. App Service → Private Endpoints (inside snet-pe)
    cells.append(edge("e-app-pe-kv", "private link",
                      "ico-app", "ico-pe-kv",
                      color="#0078D4", width=2))
    cells.append(edge("e-app-pe-blob", "private link",
                      "ico-app", "ico-pe-blob",
                      color="#0078D4", width=2))
    cells.append(edge("e-app-pe-sql", "private link",
                      "ico-app", "ico-pe-sql",
                      color="#0078D4", width=2))

    # 4. App Service → Key Vault (secrets via managed identity + PE)
    cells.append(edge("e-app-kv-secrets", "secrets",
                      "ico-app", "ico-kv",
                      color="#C62828", width=1, dashed=True))

    # 5. Private Endpoints → backend services
    cells.append(edge("e-pe-kv-kv", "private link",
                      "ico-pe-kv", "ico-kv",
                      color="#E65100", width=1, dashed=True))
    cells.append(edge("e-pe-blob-st", "private link",
                      "ico-pe-blob", "ico-st",
                      color="#E65100", width=1, dashed=True))
    cells.append(edge("e-pe-sql-sql", "private link",
                      "ico-pe-sql", "ico-sql",
                      color="#E65100", width=1, dashed=True))

    # 6. Private Endpoints → DNS resolution
    cells.append(edge("e-pe-kv-dns", "",
                      "ico-pe-kv", "ico-dns-kv",
                      color="#2E7D32", width=1, dashed=True))
    cells.append(edge("e-pe-blob-dns", "",
                      "ico-pe-blob", "ico-dns-blob",
                      color="#2E7D32", width=1, dashed=True))
    cells.append(edge("e-pe-sql-dns", "",
                      "ico-pe-sql", "ico-dns-sql",
                      color="#2E7D32", width=1, dashed=True))

    # 7. Observability
    cells.append(edge("e-app-appi", "telemetry",
                      "ico-app", "ico-appi",
                      color="#7B1FA2", width=1, dashed=True))
    cells.append(edge("e-appi-la", "workspace-based",
                      "ico-appi", "ico-la",
                      color="#7B1FA2", width=1, dashed=True))

    # 8. External SaaS
    cells.append(edge("e-app-payment", "REST",
                      "ico-app", "ext-payment",
                      color="#E65100", width=1))
    cells.append(edge("e-app-maps", "REST",
                      "ico-app", "ext-maps",
                      color="#E65100", width=1))
    cells.append(edge("e-app-email", "REST",
                      "ico-app", "ext-email",
                      color="#E65100", width=1))

    # =========================================================================
    # Assemble XML
    # =========================================================================
    cells_xml = "".join(cells)

    diagram_xml = f"""<mxfile host="agent" modified="2026-03-23" agent="azure-diagrams" version="1.0">
  <diagram name="NFF As-Built Architecture" id="nff-ab-01">
    <mxGraphModel dx="1422" dy="762" grid="1" gridSize="10" guides="1" tooltips="1"
                  connect="1" arrows="1" fold="1" page="1" pageScale="1"
                  pageWidth="1900" pageHeight="1300" math="0" shadow="0">
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
        out_path = out_dir / "07-ab-diagram.drawio"
        out_path.write_text(diagram_xml, encoding="utf-8")
        print(f"✅ Generated: {out_path}")

    print(f"   Cells: {len(cells)}")


if __name__ == "__main__":
    main()
