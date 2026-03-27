# Azure Draw.io Patterns

Reusable draw.io XML patterns for common Azure architectures.
Based on the reference diagram in `tmp/azure-architecture-example.drawio`.

**Icon placeholders**: Where you see `image=data:image/svg+xml;base64,REPLACE_WITH_ICON_BASE64`,
load the actual base64 content from `assets/drawio-libraries/azure-icons/icons/{icon-name}.xml`.
Alternatively, use draw.io built-in stencils: `shape=mxgraph.azure.<category>.<icon_name>`.

## Hub-Spoke Network

```xml
<!-- Hub VNet -->
<mxCell id="hub-vnet" value="vnet-hub-prod (10.0.0.0/16)"
  style="swimlane;startSize=25;fillColor=#E7F5FF;strokeColor=#0078D4;
  fontStyle=1;html=1;rounded=1;" vertex="1" parent="rg-hub">
  <mxGeometry x="20" y="40" width="400" height="300" as="geometry"/>
</mxCell>

<!-- Spoke VNet (peered) -->
<mxCell id="spoke-vnet" value="vnet-spoke-prod (10.1.0.0/16)"
  style="swimlane;startSize=25;fillColor=#E7F5FF;strokeColor=#0078D4;
  fontStyle=1;html=1;rounded=1;" vertex="1" parent="rg-spoke">
  <mxGeometry x="20" y="40" width="400" height="300" as="geometry"/>
</mxCell>

<!-- VNet Peering -->
<mxCell id="peering-1" style="edgeStyle=orthogonalEdgeStyle;rounded=1;
  strokeColor=#0078D4;startArrow=classic;endArrow=classic;html=1;
  strokeWidth=2;" edge="1" parent="1" source="hub-vnet" target="spoke-vnet">
  <mxGeometry relative="1" as="geometry"/>
</mxCell>
```

## Private Endpoint Pattern

```xml
<!-- Private Endpoint subnet -->
<mxCell id="snet-pe" value="snet-pe (10.0.3.0/24)"
  style="swimlane;startSize=20;fillColor=#FFF2CC;strokeColor=#D6B656;
  html=1;rounded=1;fontSize=11;" vertex="1" parent="vnet-1">
  <mxGeometry x="10" y="200" width="260" height="100" as="geometry"/>
</mxCell>

<!-- PE icon (load from icons/ directory) -->
<mxCell id="pe-sql" value="PE: SQL"
  style="shape=image;verticalLabelPosition=bottom;verticalAlign=top;
  imageAspect=0;aspect=fixed;image=data:image/svg+xml;base64,..."
  vertex="1" parent="snet-pe">
  <mxGeometry x="20" y="30" width="48" height="48" as="geometry"/>
</mxCell>

<!-- Private link connection -->
<mxCell id="plink-sql" style="edgeStyle=orthogonalEdgeStyle;rounded=1;
  dashed=1;strokeColor=#0078D4;endArrow=classic;html=1;"
  edge="1" parent="1" source="pe-sql" target="sql-db">
  <mxGeometry relative="1" as="geometry"/>
</mxCell>
```

## Diagnostics / Monitoring Pattern

From `tmp/azure-architecture-example.drawio`:

```xml
<!-- Monitoring container -->
<mxCell id="mon-group" value=""
  style="rounded=0;whiteSpace=wrap;html=1;dashed=1;fillColor=#E6E6E6;
  strokeColor=none;" vertex="1" parent="1">
  <mxGeometry x="800" y="50" width="120" height="230" as="geometry"/>
</mxCell>

<!-- Azure Monitor icon -->
<mxCell id="monitor" value="Azure Monitor"
  style="aspect=fixed;html=1;points=[];align=center;image;fontSize=12;
  image=data:image/svg+xml;base64,...;dashed=1;fillColor=#FFFFFF;"
  vertex="1" parent="mon-group">
  <mxGeometry x="28" y="15" width="64" height="64" as="geometry"/>
</mxCell>

<!-- Log Analytics icon -->
<mxCell id="log-analytics" value="Log Analytics"
  style="aspect=fixed;html=1;points=[];align=center;image;fontSize=12;
  image=data:image/svg+xml;base64,...;dashed=1;fillColor=#FFFFFF;"
  vertex="1" parent="mon-group">
  <mxGeometry x="28" y="120" width="64" height="64" as="geometry"/>
</mxCell>

<!-- Diagnostic flow edge -->
<mxCell id="diag-edge" value="Diagnostic Logs"
  style="edgeStyle=orthogonalEdgeStyle;rounded=0;dashed=1;
  strokeColor=#666666;endArrow=classic;html=1;"
  edge="1" parent="1" source="app-service" target="monitor">
  <mxGeometry relative="1" as="geometry"/>
</mxCell>
```

## App Service with Background Processing

```xml
<!-- App Service Plan container -->
<mxCell id="asp-container" value="App Service Plan"
  style="rounded=0;whiteSpace=wrap;html=1;dashed=1;fillColor=#FFFFFF;
  strokeColor=none;verticalLabelPosition=top;verticalAlign=bottom;"
  vertex="1" parent="rg-1">
  <mxGeometry x="100" y="60" width="90" height="159" as="geometry"/>
</mxCell>

<!-- Web App icon inside ASP -->
<mxCell id="webapp" value="Web App"
  style="aspect=fixed;html=1;points=[];align=center;image;fontSize=12;
  image=data:image/svg+xml;base64,...;verticalLabelPosition=top;
  verticalAlign=bottom;" vertex="1" parent="asp-container">
  <mxGeometry x="13" y="81" width="64" height="64" as="geometry"/>
</mxCell>

<!-- Function App container -->
<mxCell id="func-container" value=""
  style="rounded=0;whiteSpace=wrap;html=1;dashed=1;fillColor=#FFFFFF;
  strokeColor=none;" vertex="1" parent="rg-1">
  <mxGeometry x="250" y="60" width="90" height="159" as="geometry"/>
</mxCell>

<!-- Function App icon -->
<mxCell id="funcapp" value="Function App"
  style="aspect=fixed;html=1;points=[];align=center;image;fontSize=12;
  image=data:image/svg+xml;base64,...;verticalLabelPosition=top;
  verticalAlign=bottom;" vertex="1" parent="func-container">
  <mxGeometry x="11" y="83" width="68" height="60" as="geometry"/>
</mxCell>
```

## Data Flow with Queue/Storage

```xml
<!-- Storage Queue -->
<mxCell id="queue-1" value="Queue"
  style="verticalLabelPosition=top;html=1;verticalAlign=bottom;
  align=center;strokeColor=none;fillColor=#00BEF2;
  shape=mxgraph.azure.storage_queue;" vertex="1" parent="rg-1">
  <mxGeometry x="200" y="140" width="50" height="45" as="geometry"/>
</mxCell>

<!-- Blob Storage -->
<mxCell id="blob-1" value="Blob"
  style="verticalLabelPosition=bottom;html=1;verticalAlign=top;
  align=center;strokeColor=none;fillColor=#00BEF2;
  shape=mxgraph.azure.storage_blob;" vertex="1" parent="rg-1">
  <mxGeometry x="100" y="250" width="50" height="45" as="geometry"/>
</mxCell>
```

## Edge Label Pattern

```xml
<mxCell id="e-labeled" value="REST API"
  style="edgeStyle=orthogonalEdgeStyle;rounded=1;strokeColor=#0078D4;
  endArrow=classic;html=1;labelBackgroundColor=none;"
  edge="1" parent="1" source="client" target="api">
  <mxGeometry relative="1" as="geometry"/>
</mxCell>
```
