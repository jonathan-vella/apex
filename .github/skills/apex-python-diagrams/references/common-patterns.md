<!-- ref:common-patterns-v1 -->

# Common Azure Architecture Patterns (`dlib.py` SVG + 4K PNG)

Ready-to-use Python generator patterns using [`scripts/dlib.py`](../scripts/dlib.py)
on the `1920×1080` SVG coordinate canvas (rendered to both an editable `.svg`
master with embedded official Azure v23 vector `<symbol>` icons and a
`3840×2160` 4K `.png` sibling).

## Standard Preamble

```python
import sys
from pathlib import Path

sys.path.insert(0, str(Path(".github/skills/apex-python-diagrams/scripts").resolve()))
from dlib import *  # noqa: E402, F403
```

---

## 1. Hub-and-Spoke Routing & Private Endpoints

Shows shared hub firewall inspection, spoke VNet peering, UDR route tables,
private endpoints, and numbered example traffic paths (`A`–`D`) with a bottom
key panel and architectural callout card.

```python
import sys
from pathlib import Path

sys.path.insert(0, str(Path(".github/skills/apex-python-diagrams/scripts").resolve()))
from dlib import *  # noqa: E402, F403

reset()

# Shared hub subscription
add(sub(620, 95, 680, 178, "Shared platform subscription", BL, "#F5FAFF", "SHARED PLATFORM", 190))
add(box(640, 135, 640, 128, BLF, BL, sw=1.8) + ic("vnet", 650, 140, 28) + t(686, 162, "rg-hub / vnet-hub  10.100.0.0/16", 18, "700", BL, mw=420))
add(box(770, 172, 380, 84, "#FFFFFF", BL, sw=1.5) + t(782, 192, "AzureFirewallSubnet  10.100.0.0/26", 15, "700", mw=355))
add(card(790, 200, 340, 50, "fw", [("afw-hub: Azure Firewall Standard", 1)], BLF, BL, 34, sz=(16, 14)))

# Workload subscription
add(sub(30, 305, 1860, 510, "Workload subscription", TL, "#F2FAF8", "WORKLOAD SPOKE", 210))

# Source / hybrid spoke
add(rg(55, 350, 690, 450, "rg-connectivity", TL))
add(box(70, 390, 660, 395, "#FFFFFF", TL, sw=1.8) + ic("vnet", 80, 394, 28) + t(116, 416, "vnet-integration  10.10.0.0/24", 18, "700", TL, mw=400))
add(box(90, 428, 620, 236, TLF, TL, sw=1.5) + t(104, 452, "snet-workloads  10.10.0.0/25", 17, "700", mw=300) + ic("rt", 104, 460, 24) + t(134, 478, "rt-workloads: 10.20.0.0/24 -> afw-hub", 14, fill=GR, mw=400))
add(card(110, 492, 580, 66, "vm", [("vm-worker-01   .4", 1), ("Background integration worker", 0)], "#EEF2F6", SL, 40, ls=22, sz=(17, 14)))
add(card(110, 576, 580, 66, "bas", [("bas-hub", 1), ("Private operator access", 0)], "#FFFFFF", TL, 40, ls=22, sz=(17, 14)))
add(card(330, 690, 380, 64, "nat", [("NAT Gateway", 1), ("Dedicated outbound egress", 0)], TLF, TL, 40, ls=22, sz=(17, 14)))

# Application spoke
add(rg(1175, 350, 690, 450, "rg-spoke-prod", TL, 70))
add(box(1190, 390, 660, 395, "#FFFFFF", TL, sw=1.8) + ic("vnet", 1200, 394, 28) + t(1236, 416, "vnet-spoke  10.20.0.0/24", 18, "700", TL, mw=400))
subnets = [
    (487, "snet-data  10.20.0.128/26", "rt-data: 10.10.0.0/24 -> afw-hub"),
    (572, "snet-pe  10.20.0.64/26", "rt-pe: 0.0.0.0/0 -> afw-hub; Private Endpoints"),
    (657, "snet-app  10.20.0.0/26", "rt-app: 0.0.0.0/0 -> afw-hub; VNet integration"),
]
for y, a, b in subnets:
    add(card(1215, y, 615, 76, "subnet", [(a, 1), (b, 0)], TLF, TL, 36, ls=24, sz=(17, 14.5)))

# External destinations
add(box(800, 692, 200, 56, "#FFFFFF", SL, sw=1.8) + t(900, 726, "Internet", 20, "700", anchor="middle"))
add(box(1400, 110, 300, 70, "#FFFFFF", SL, sw=1.8) + t(1550, 140, "Permitted public", 17, "700", anchor="middle") + t(1550, 162, "endpoints", 17, "700", anchor="middle"))

# Peerings & routed traffic paths
add(arr("M690 390V263", "net", True, True) + arr("M1230 390V263", "net", True, True))
add(chip(500, 290, 280, "VNet peering; forwarded traffic enabled", BL, size=13))
add(chip(1410, 290, 280, "VNet peering; forwarded traffic enabled", BL, size=13))
add(arr("M690 525H840V250", "mig") + arr("M1080 250V525H1215", "mig") + circ(770, 525, "B", AM))
add(arr("M690 609H900V250", "net") + arr("M1010 250V609H1215", "net") + circ(770, 609, "A", BL))
add(arr("M1215 695H1170V222H1132", "net") + arr("M1132 196H1400", "net") + circ(1195, 695, "D", BL))
add(arr("M710 722H800", "net") + circ(755, 722, "C", BL))

# Bottom key panel + architecture note
add(box(30, 830, 1100, 175, "#FFFFFF", SL, sw=1.5) + t(50, 860, "Example paths", 20, "700"))
keys = [
    ("A", BL, "Operator -> afw-hub -> snet-pe: private PaaS endpoints"),
    ("B", AM, "vm-worker-01 -> afw-hub -> snet-data: inspected data replication"),
    ("C", BL, "snet-workloads -> NAT Gateway -> Internet: outbound egress"),
    ("D", BL, "snet-app -> afw-hub -> permitted public endpoints: controlled app egress"),
]
for i, (l, c, s) in enumerate(keys):
    add(circ(60, 885 + i * 31, l, c) + t(84, 891 + i * 31, s, 17, mw=1030))

add(
    box(1150, 830, 740, 175, AMF, AMB, sw=2)
    + t(1170, 868, "VNet peering is non-transitive. UDR route tables and", 19, "700", mw=700)
    + t(1170, 893, "Azure Firewall enforce spoke-to-spoke inspection.", 19, "700")
    + t(1170, 935, "All PaaS data services disable public network access", 17, mw=700)
    + t(1170, 965, "and resolve exclusively through private DNS zones.", 17, mw=700)
)

finish("agent-output/my-project/04-runtime-diagram", "Hub-and-spoke routing and private connectivity")
```

---

## 2. Managed Identities, Secrets & Observability Telemetry

Uses three horizontal bands to separate:
1. Application workload managed identity + least-privilege RBAC role chips (`id` dashed purple).
2. Database / directory lookup identity (`id` dashed purple + amber governance note card).
3. Observability flow to Application Insights and Log Analytics (`tel` dashed slate).

```python
import sys
from pathlib import Path

sys.path.insert(0, str(Path(".github/skills/apex-python-diagrams/scripts").resolve()))
from dlib import *  # noqa: E402, F403

reset()

# Top band: App Service & Managed Identity RBAC fan-out
add(box(30, 90, 1860, 345, "#FFFFFF", SL, sw=2) + t(50, 122, "Application workload identity and RBAC", 24, "700", TL))
legend = [("id", "Identity / authorization", PU), ("net", "Request", BL), ("tel", "Telemetry", SL)]
x = 1130
for k, label, _ in legend:
    add(arr(f"M{x} 114H{x+50}", k) + t(x + 60, 120, label, 16, mw=170))
    x += 250 if k == "id" else 150

add(card(50, 135, 290, 56, "app", [("App Service", 1)], TLF, TL, 36))
add(card(380, 135, 360, 56, "mi", [("id-workload-&lt;suffix&gt;", 1), ("User-Assigned Managed Identity", 0)], "#FFFFFF", PU, 36, ls=20, sz=(16, 13)))
add(arr("M340 163H380", "id"))

targets = [
    ("acr", "Container Registry", "AcrPull"),
    ("blob", "Storage Account", "Storage Blob Data Contributor"),
    ("sb", "Service Bus", "Azure Service Bus Data Sender"),
    ("kv", "Key Vault", "Key Vault Secrets User"),
    ("ai", "Application Insights", "Monitoring Metrics Publisher"),
    ("sqldb", "Azure SQL Database", "Contained Entra User"),
]
add(f'<path d="M560 191V218M{50+135} 218H{50+5*305+135}" stroke="{PU}" stroke-width="3" stroke-dasharray="9 6" fill="none"/>')
for i, (k, name, role) in enumerate(targets):
    cx = 50 + i * 305 + 135
    add(card(50 + i * 305, 290, 270, 76, k, [(name, 1)], "#FFFFFF", PU, 40, ls=22, sz=(17, 13)))
    add(arr(f"M{cx} 218V290", "id"))
    add(chip(cx, 254, 255, role, PU, PUF, 13, h=24))

# Bottom band: Observability & central logging
add(box(30, 465, 1860, 320, "#FFFFFF", SL, sw=2) + t(50, 498, "Centralized observability and diagnostics", 24, "700", SL))
add(card(50, 540, 300, 80, "app", [("App Service", 1), ("OpenTelemetry SDK", 0)], TLF, TL, 40, ls=22, sz=(17, 14)))
add(card(520, 540, 300, 80, "ai", [("Application Insights", 1), ("Workspace-based", 0)], "#FFFFFF", SL, 40, ls=22, sz=(17, 14)))
add(card(990, 540, 320, 80, "law", [("Log Analytics Workspace", 1), ("Central audit & metrics sink", 0)], BLF, BL, 40, ls=22, sz=(17, 14)))
add(arr("M350 580H520", "tel") + chip(435, 555, 120, "Traces & metrics", SL, size=12, h=22))
add(arr("M820 580H990", "tel") + chip(905, 555, 120, "Ingestion", SL, size=12, h=22))

finish("agent-output/my-project/04-dependency-diagram", "Managed identities, RBAC assignments and telemetry")
```

---

## 3. Central Private DNS Resolution (`dns` Dotted Teal + Step Badges)

Illustrates numbered DNS resolution steps (`1`–`4`) from a spoke workload
through Azure Firewall DNS proxy to central `privatelink.*` Private DNS zones
and a Private Endpoint NIC.

```python
import sys
from pathlib import Path

sys.path.insert(0, str(Path(".github/skills/apex-python-diagrams/scripts").resolve()))
from dlib import *  # noqa: E402, F403

reset()

add(sub(30, 95, 880, 680, "Shared platform subscription", BL, "#F5FAFF", "CENTRAL DNS", 180))
add(rg(55, 150, 830, 600, "rg-hub", BL))
add(card(85, 210, 360, 80, "fw", [("afw-hub", 1), ("DNS Proxy enabled (10.100.0.4)", 0)], BLF, BL, 40))
add(card(85, 360, 770, 140, "dns", [
    ("Central Private DNS Zones", 1),
    ("privatelink.blob.core.windows.net | privatelink.vaultcore.azure.net", 0),
    ("privatelink.database.windows.net | privatelink.azurecr.io", 0),
], "#FFFFFF", BL, 44, ls=26, sz=(18, 15)))

add(sub(950, 95, 940, 680, "Workload subscription", TL, "#F2FAF8", "SPOKE WORKLOAD", 200))
add(rg(975, 150, 890, 600, "rg-spoke-prod", TL))
add(card(1010, 210, 380, 80, "app", [("app-api-prod", 1), ("Custom DNS: 10.100.0.4", 0)], TLF, TL, 40))
add(card(1010, 520, 380, 80, "pe", [("pep-st-prod", 1), ("Private IP: 10.20.0.68", 0)], TLF, TL, 40))
add(card(1460, 520, 370, 80, "blob", [("stprod001", 1), ("Public network access: Disabled", 0)], "#FFFFFF", TL, 40))

# DNS query & private traffic paths
add(arr("M1010 250H445", "dns") + circ(720, 250, "1", TL) + chip(720, 218, 290, "Query stprod001.blob.core.windows.net", TL, TLF, 13))
add(arr("M265 290V360", "dns") + circ(265, 325, "2", TL))
add(arr("M445 270H1010", "dns") + circ(720, 290, "3", TL) + chip(720, 320, 240, "A record -> 10.20.0.68", TL, TLF, 13))
add(arr("M1200 290V520", "net") + circ(1200, 405, "4", BL) + chip(1310, 405, 190, "TLS 1.2 over Private Link", BL, BLF, 13))
add(arr("M1390 560H1460", "net"))

finish("agent-output/my-project/03-des-private-dns", "Private endpoint resolution via central Private DNS zones")
```

---

## 4. Multi-Lane Deployment Pipeline Swimlane (`genP1` Style)

Uses column headers (`Phase 1`–`Phase 5`) and horizontal actor/environment
lanes (`BL`, `TL`, `AM`) with `gh()` GitHub Actions badges and `ic()` Azure
service icons.

```python
import sys
from pathlib import Path

sys.path.insert(0, str(Path(".github/skills/apex-python-diagrams/scripts").resolve()))
from dlib import *  # noqa: E402, F403

reset()

COLX = [330 + 312 * i for i in range(5)]
CW = 300
heads = [
    ("Phase 1", "Preflight & Lint"),
    ("Phase 2", "Foundation"),
    ("Phase 3", "Security & DNS"),
    ("Phase 4", "Data & Compute"),
    ("Phase 5", "Smoke Verify"),
]
for i, (a, b) in enumerate(heads):
    x = COLX[i]
    add(box(x, 92, CW, 52, GRF, SL, sw=1.5, rx=8) + t(x + 16, 126, a, 24, "700", NAVY) + t(x + 118, 126, b, 17, "400", GR, mw=CW - 128))

LANES = [
    ("CI / CD WORKFLOW", BL, BLF, 160, 230),
    ("AZURE INFRASTRUCTURE", TL, TLF, 410, 230),
    ("GOVERNANCE GATE", AM, AMF, 660, 230),
]
for name, col, fill, y, h in LANES:
    add(box(30, y, 1860, h, fill, col, sw=1.8, rx=10) + t(50, y + 38, name, 18, "700", col))

for col, title, line1, line2 in [
    (0, "Validate & What-If", "bicep lint / terraform validate", "OIDC workload identity login"),
    (1, "Deploy Network Hub", "Resource groups, VNet, NSGs", "Log Analytics workspace"),
    (2, "Deploy Key Vault & DNS", "Private DNS zones & links", "Managed identities & RBAC"),
    (3, "Deploy App & Data", "SQL / Cosmos DB + Private Endpoints", "App Service VNet integration"),
    (4, "Health & Drift Check", "Verify HTTPS endpoints", "Confirm zero policy violations"),
]:
    x = COLX[col] + 8
    w = CW - 16
    add(
        box(x, 195, w, 165, "#FFFFFF", BL, sw=2, rx=10)
        + gh(x + 12, 207, 34)
        + t(x + 56, 230, title, 17, "700", NAVY, mw=w - 68)
        + t(x + 14, 275, line1, 15, "400", GR, mw=w - 24)
        + t(x + 14, 302, line2, 15, "400", GR, mw=w - 24)
    )

finish("agent-output/my-project/04-deployment-pipeline", "Phased infrastructure deployment pipeline")
```

---

## Layout Checklist Before Calling `finish()`

1. **Zero `WARN overflow:` output**: Run the `.py` script and verify stdout has no `WARN overflow:` lines. Wrap long text into two lines (`chip2` or multi-line `card`) or widen the container.
2. **20px+ sibling gap**: Leave clear whitespace between sibling cards and reserve dedicated horizontal/vertical corridors for `arr()` paths.
3. **Boundary vs. connector semantics**: Containment is always a boundary box (`sub`, `rg`, `box`); relationships/flows are always arrows (`arr`).
4. **Legend & footer**: Include only the connector kinds (`net`, `id`, `dns`, `tel`, `mig`, `off`) actually used in the diagram. Keep the default `footer="APEX"` unless a project-specific footer is requested.
