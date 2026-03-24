<!-- ref:drawio-common-patterns-v1 -->

# Common Architecture Patterns — Draw.io

Ready-to-use draw.io XML templates for common Azure architectures.
Each pattern is a complete `.drawio` file that agents can adapt.

## How to Use

1. Copy the XML for your pattern
2. Replace resource names with actual project names
3. Adjust positioning (x, y coordinates) as needed
4. Add/remove resources to match architecture
5. Update CIDR blocks, labels, and edge descriptions

## Pattern 1: Web Application (3-Tier)

App Gateway → Web App → API → SQL Database + Redis Cache + Blob Storage

```xml
<mxfile host="agent" agent="azure-diagrams" version="1.0">
  <diagram name="3-Tier Web App" id="web-3tier">
    <mxGraphModel dx="1422" dy="762" grid="1" gridSize="10" guides="1" tooltips="1"
                  connect="1" arrows="1" fold="1" page="1" pageScale="1"
                  pageWidth="1169" pageHeight="827" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>

        <!-- Resource Group -->
        <mxCell id="rg-1" value="rg-webapp-prod"
                style="rounded=1;whiteSpace=wrap;html=1;dashed=1;dashPattern=5 5;fillColor=#E8F0FE;strokeColor=#0078D4;fontSize=14;fontFamily=Arial;fontStyle=1;verticalAlign=top;spacingTop=10;arcSize=8"
                vertex="1" parent="1">
          <mxGeometry x="50" y="50" width="1070" height="700" as="geometry"/>
        </mxCell>

        <!-- Edge Tier -->
        <mxCell id="appgw-1" value="Application Gateway"
                style="shape=image;verticalLabelPosition=bottom;verticalAlign=top;imageAspect=0;aspect=fixed;image=data:image/svg+xml,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCIgZmlsbD0iIzAwNzhENCIvPjx0ZXh0IHg9IjI0IiB5PSIyOCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0id2hpdGUiIGZvbnQtc2l6ZT0iMTAiPkFHVzwvdGV4dD48L3N2Zz4="
                vertex="1" parent="rg-1">
          <mxGeometry x="100" y="300" width="48" height="48" as="geometry"/>
        </mxCell>

        <!-- Web Tier -->
        <mxCell id="app-1" value="app-webapp-prod"
                style="shape=image;verticalLabelPosition=bottom;verticalAlign=top;imageAspect=0;aspect=fixed;image=data:image/svg+xml,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCIgZmlsbD0iIzAwNzhENCIvPjx0ZXh0IHg9IjI0IiB5PSIyOCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0id2hpdGUiIGZvbnQtc2l6ZT0iMTAiPkFQUDwvdGV4dD48L3N2Zz4="
                vertex="1" parent="rg-1">
          <mxGeometry x="350" y="300" width="48" height="48" as="geometry"/>
        </mxCell>

        <!-- Data Tier -->
        <mxCell id="sql-1" value="sql-webapp-prod"
                style="shape=image;verticalLabelPosition=bottom;verticalAlign=top;imageAspect=0;aspect=fixed;image=data:image/svg+xml,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCIgZmlsbD0iIzAwNzhENCIvPjx0ZXh0IHg9IjI0IiB5PSIyOCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0id2hpdGUiIGZvbnQtc2l6ZT0iMTAiPlNRTDwvdGV4dD48L3N2Zz4="
                vertex="1" parent="rg-1">
          <mxGeometry x="600" y="200" width="48" height="48" as="geometry"/>
        </mxCell>

        <mxCell id="redis-1" value="redis-webapp-prod"
                style="shape=image;verticalLabelPosition=bottom;verticalAlign=top;imageAspect=0;aspect=fixed;image=data:image/svg+xml,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCIgZmlsbD0iI0M4MTAyQSIvPjx0ZXh0IHg9IjI0IiB5PSIyOCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0id2hpdGUiIGZvbnQtc2l6ZT0iOCI+UkVESVM8L3RleHQ+PC9zdmc+"
                vertex="1" parent="rg-1">
          <mxGeometry x="600" y="300" width="48" height="48" as="geometry"/>
        </mxCell>

        <mxCell id="blob-1" value="stwebappprod"
                style="shape=image;verticalLabelPosition=bottom;verticalAlign=top;imageAspect=0;aspect=fixed;image=data:image/svg+xml,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCIgZmlsbD0iIzAwNzhENCIvPjx0ZXh0IHg9IjI0IiB5PSIyOCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0id2hpdGUiIGZvbnQtc2l6ZT0iOCI+QkxPQjwvdGV4dD48L3N2Zz4="
                vertex="1" parent="rg-1">
          <mxGeometry x="600" y="400" width="48" height="48" as="geometry"/>
        </mxCell>

        <!-- Security -->
        <mxCell id="kv-1" value="kv-webapp-prod"
                style="shape=image;verticalLabelPosition=bottom;verticalAlign=top;imageAspect=0;aspect=fixed;image=data:image/svg+xml,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCIgZmlsbD0iI0M4MTAyQSIvPjx0ZXh0IHg9IjI0IiB5PSIyOCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0id2hpdGUiIGZvbnQtc2l6ZT0iMTAiPktWPC90ZXh0Pjwvc3ZnPg=="
                vertex="1" parent="rg-1">
          <mxGeometry x="350" y="550" width="48" height="48" as="geometry"/>
        </mxCell>

        <!-- Edges -->
        <mxCell id="e-1" value="HTTPS" style="endArrow=classic;html=1;strokeColor=#0078D4;fontFamily=Arial;fontSize=10" edge="1" parent="1" source="appgw-1" target="app-1">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="e-2" value="SQL" style="endArrow=classic;html=1;strokeColor=#0078D4;fontFamily=Arial;fontSize=10" edge="1" parent="1" source="app-1" target="sql-1">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="e-3" value="Cache" style="endArrow=classic;html=1;strokeColor=#0078D4;fontFamily=Arial;fontSize=10" edge="1" parent="1" source="app-1" target="redis-1">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="e-4" value="Blob" style="endArrow=classic;html=1;strokeColor=#0078D4;fontFamily=Arial;fontSize=10" edge="1" parent="1" source="app-1" target="blob-1">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="e-5" value="Secrets" style="endArrow=classic;html=1;strokeColor=#C00000;fontFamily=Arial;fontSize=10;dashed=1" edge="1" parent="1" source="app-1" target="kv-1">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
```

## Pattern 2: Hub-Spoke Networking

Firewall in hub VNet, peered spoke VNets with workload subnets.

```xml
<mxfile host="agent" agent="azure-diagrams" version="1.0">
  <diagram name="Hub-Spoke" id="hub-spoke">
    <mxGraphModel dx="1422" dy="762" grid="1" gridSize="10" guides="1" tooltips="1"
                  connect="1" arrows="1" fold="1" page="1" pageScale="1"
                  pageWidth="1169" pageHeight="827" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>

        <!-- Hub VNet -->
        <mxCell id="vnet-hub" value="vnet-hub-prod (10.0.0.0/16)"
                style="rounded=1;whiteSpace=wrap;html=1;dashed=1;dashPattern=8 4;fillColor=#F0F8FF;strokeColor=#0078D4;fontSize=12;fontFamily=Arial;fontStyle=1;verticalAlign=top;spacingTop=10;arcSize=6"
                vertex="1" parent="1">
          <mxGeometry x="350" y="200" width="400" height="400" as="geometry"/>
        </mxCell>

        <mxCell id="fw-1" value="Azure Firewall"
                style="shape=image;verticalLabelPosition=bottom;verticalAlign=top;imageAspect=0;aspect=fixed"
                vertex="1" parent="vnet-hub">
          <mxGeometry x="176" y="176" width="48" height="48" as="geometry"/>
        </mxCell>

        <!-- Spoke 1 -->
        <mxCell id="vnet-spoke1" value="vnet-spoke-web (10.1.0.0/16)"
                style="rounded=1;whiteSpace=wrap;html=1;dashed=1;dashPattern=8 4;fillColor=#F0F8FF;strokeColor=#0078D4;fontSize=12;fontFamily=Arial;fontStyle=1;verticalAlign=top;spacingTop=10;arcSize=6"
                vertex="1" parent="1">
          <mxGeometry x="50" y="50" width="250" height="200" as="geometry"/>
        </mxCell>

        <!-- Spoke 2 -->
        <mxCell id="vnet-spoke2" value="vnet-spoke-data (10.2.0.0/16)"
                style="rounded=1;whiteSpace=wrap;html=1;dashed=1;dashPattern=8 4;fillColor=#F0F8FF;strokeColor=#0078D4;fontSize=12;fontFamily=Arial;fontStyle=1;verticalAlign=top;spacingTop=10;arcSize=6"
                vertex="1" parent="1">
          <mxGeometry x="800" y="50" width="250" height="200" as="geometry"/>
        </mxCell>

        <!-- Peering edges -->
        <mxCell id="e-peer1" value="Peering"
                style="endArrow=classic;startArrow=classic;html=1;strokeColor=#0078D4;dashed=1;fontFamily=Arial;fontSize=10"
                edge="1" parent="1" source="vnet-spoke1" target="vnet-hub">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="e-peer2" value="Peering"
                style="endArrow=classic;startArrow=classic;html=1;strokeColor=#0078D4;dashed=1;fontFamily=Arial;fontSize=10"
                edge="1" parent="1" source="vnet-spoke2" target="vnet-hub">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
```

## Pattern 3: Serverless / Event-Driven

Event sources → Functions → Service Bus → Cosmos DB

```xml
<mxfile host="agent" agent="azure-diagrams" version="1.0">
  <diagram name="Serverless Event-Driven" id="serverless">
    <mxGraphModel dx="1422" dy="762" grid="1" gridSize="10" guides="1" tooltips="1"
                  connect="1" arrows="1" fold="1" page="1" pageScale="1"
                  pageWidth="1169" pageHeight="827" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>

        <!-- Resource Group -->
        <mxCell id="rg-1" value="rg-serverless-prod"
                style="rounded=1;whiteSpace=wrap;html=1;dashed=1;dashPattern=5 5;fillColor=#E8F0FE;strokeColor=#0078D4;fontSize=14;fontFamily=Arial;fontStyle=1;verticalAlign=top;spacingTop=10;arcSize=8"
                vertex="1" parent="1">
          <mxGeometry x="50" y="50" width="1070" height="500" as="geometry"/>
        </mxCell>

        <!-- Event Sources -->
        <mxCell id="blob-trigger" value="Blob Storage (trigger)"
                style="shape=image;verticalLabelPosition=bottom;verticalAlign=top;imageAspect=0;aspect=fixed"
                vertex="1" parent="rg-1">
          <mxGeometry x="50" y="100" width="48" height="48" as="geometry"/>
        </mxCell>

        <mxCell id="eh-1" value="Event Hub"
                style="shape=image;verticalLabelPosition=bottom;verticalAlign=top;imageAspect=0;aspect=fixed"
                vertex="1" parent="rg-1">
          <mxGeometry x="50" y="250" width="48" height="48" as="geometry"/>
        </mxCell>

        <!-- Processing -->
        <mxCell id="func-1" value="func-processor"
                style="shape=image;verticalLabelPosition=bottom;verticalAlign=top;imageAspect=0;aspect=fixed"
                vertex="1" parent="rg-1">
          <mxGeometry x="300" y="175" width="48" height="48" as="geometry"/>
        </mxCell>

        <!-- Messaging -->
        <mxCell id="sb-1" value="Service Bus"
                style="shape=image;verticalLabelPosition=bottom;verticalAlign=top;imageAspect=0;aspect=fixed"
                vertex="1" parent="rg-1">
          <mxGeometry x="550" y="175" width="48" height="48" as="geometry"/>
        </mxCell>

        <!-- Data Store -->
        <mxCell id="cosmos-1" value="Cosmos DB"
                style="shape=image;verticalLabelPosition=bottom;verticalAlign=top;imageAspect=0;aspect=fixed"
                vertex="1" parent="rg-1">
          <mxGeometry x="800" y="175" width="48" height="48" as="geometry"/>
        </mxCell>

        <!-- Edges -->
        <mxCell id="e-1" value="Trigger" style="endArrow=classic;html=1;strokeColor=#0078D4;fontFamily=Arial;fontSize=10" edge="1" parent="1" source="blob-trigger" target="func-1">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="e-2" value="Events" style="endArrow=classic;html=1;strokeColor=#0078D4;fontFamily=Arial;fontSize=10" edge="1" parent="1" source="eh-1" target="func-1">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="e-3" value="Publish" style="endArrow=classic;html=1;strokeColor=#0078D4;fontFamily=Arial;fontSize=10" edge="1" parent="1" source="func-1" target="sb-1">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="e-4" value="Write" style="endArrow=classic;html=1;strokeColor=#0078D4;fontFamily=Arial;fontSize=10" edge="1" parent="1" source="sb-1" target="cosmos-1">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
```

## Adapting Patterns

When adapting these patterns for a project:

1. **Replace placeholder icons** with actual icons from `references/quick-reference.md`
   (the patterns above use simplified SVGs for readability)
2. **Update resource names** to match CAF naming conventions
3. **Adjust coordinates** to accommodate added/removed resources
4. **Add CIDR blocks** to all VNet and subnet labels
5. **Update edge labels** to describe actual data flows
6. **Add Key Vault** — every production architecture should show secret management
7. **Add monitoring** — include Application Insights / Log Analytics where applicable
