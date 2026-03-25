/**
 * Regression tests for the merged add-cells workflow.
 *
 * Guards against three regressions observed when add-cells-of-shape was merged
 * into add-cells with the shape_name parameter:
 *   1. Edge labels (text) dropped when edges are in the same batch as shape-resolved vertices
 *   2. Transactional placeholder IDs not usable in add-cells-to-group
 *   3. Group containment lost — children appear outside their parent group in XML
 */
import { beforeEach, describe, it } from "@std/testing/bdd";
import { assert, assertEquals, assertExists } from "@std/assert";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { handlers as baseHandlers } from "../src/tools.ts";

function parseResult(result: CallToolResult): any {
  const content = result.content[0];
  if (content.type !== "text") {
    throw new Error(`Expected text content, got ${content.type}`);
  }
  return JSON.parse(content.text);
}

let diagramXml: string | undefined;

const handlers = new Proxy(baseHandlers, {
  get(target, prop: string) {
    const handler = target[prop as keyof typeof target] as ((args?: any) => CallToolResult) | undefined;
    if (!handler) return undefined;
    return async (args: Record<string, unknown> = {}) => {
      const result = await handler({
        ...args,
        ...(diagramXml ? { diagram_xml: diagramXml } : {}),
      });
      if (!result.isError) {
        const parsed = parseResult(result);
        if (parsed?.data?.diagram_xml) {
          diagramXml = parsed.data.diagram_xml;
        }
      }
      return result;
    };
  },
}) as unknown as Record<string, (args?: Record<string, unknown>) => Promise<CallToolResult>>;

beforeEach(() => {
  diagramXml = undefined;
});

describe("workflow regression: empty-string text falls back to shape name", () => {
  it("should use shape display name when text is empty string", async () => {
    const result = await handlers["add-cells"]({
      cells: [
        { type: "vertex", shape_name: "Container Apps", x: 100, y: 100, text: "" },
      ],
    });
    const parsed = parseResult(result);
    assertEquals(parsed.data.summary.succeeded, 1);
    // The resolved display name comes from the Azure icon library, not the
    // caller's shape_name.  "Container Apps" matches the icon titled
    // "Container Apps Environments".
    assert(
      parsed.data.results[0].cell.value.length > 0,
      "Empty string text should fall back to shape display name, got: " +
        JSON.stringify(parsed.data.results[0].cell.value),
    );
  });

  it("should use shape display name when text is whitespace-only", async () => {
    const result = await handlers["add-cells"]({
      cells: [
        { type: "vertex", shape_name: "Front Doors", x: 100, y: 100, text: "   " },
      ],
    });
    const parsed = parseResult(result);
    assertEquals(parsed.data.summary.succeeded, 1);
    assert(
      parsed.data.results[0].cell.value.length > 0,
      "Whitespace-only text should fall back to shape display name, got: " +
        JSON.stringify(parsed.data.results[0].cell.value),
    );
  });

  it("should preserve explicit non-empty text over shape name", async () => {
    const result = await handlers["add-cells"]({
      cells: [
        { type: "vertex", shape_name: "Container Apps", x: 100, y: 100, text: "My API" },
      ],
    });
    const parsed = parseResult(result);
    assertEquals(parsed.data.summary.succeeded, 1);
    assertEquals(
      parsed.data.results[0].cell.value,
      "My API",
      "Explicit non-empty text should be preserved",
    );
  });

  it("should use shape name when text is undefined", async () => {
    const result = await handlers["add-cells"]({
      cells: [
        { type: "vertex", shape_name: "Key Vaults", x: 100, y: 100 },
      ],
    });
    const parsed = parseResult(result);
    assertEquals(parsed.data.summary.succeeded, 1);
    assert(
      parsed.data.results[0].cell.value.length > 0,
      "Undefined text should fall back to shape display name, got: " +
        JSON.stringify(parsed.data.results[0].cell.value),
    );
  });

  it("should fall back to shape name for empty text in transactional mode", async () => {
    const result = await handlers["add-cells"]({
      transactional: true,
      cells: [
        { type: "vertex", shape_name: "Monitor", x: 100, y: 100, text: "" },
        { type: "vertex", shape_name: "Key Vaults", x: 200, y: 100, text: "" },
      ],
    });
    const parsed = parseResult(result);
    assertEquals(parsed.data.summary.succeeded, 2);
    assert(
      parsed.data.results[0].cell.value.length > 0,
      "Empty text in transactional mode should fall back to shape name",
    );
    assert(
      parsed.data.results[1].cell.value.length > 0,
      "Empty text in transactional mode should fall back to shape name",
    );
  });

  it("should not apply shape-name fallback for basic shapes", async () => {
    const result = await handlers["add-cells"]({
      cells: [
        { type: "vertex", shape_name: "rectangle", x: 100, y: 100, text: "" },
      ],
    });
    const parsed = parseResult(result);
    assertEquals(parsed.data.summary.succeeded, 1);
    assertEquals(
      parsed.data.results[0].cell.value,
      "",
      "Basic shapes should NOT get a default label when text is empty",
    );
  });
});

describe("workflow regression: edge labels with shape_name vertices", () => {
  it("should preserve edge text when edges are batched with shape-resolved vertices", async () => {
    const result = await handlers["add-cells"]({
      cells: [
        { type: "vertex", shape_name: "Front Doors", x: 100, y: 100, temp_id: "fd" },
        { type: "vertex", shape_name: "Container Apps", x: 400, y: 100, temp_id: "ca" },
        { type: "edge", source_id: "fd", target_id: "ca", text: "HTTPS" },
      ],
    });
    const parsed = parseResult(result);
    assertEquals(parsed.data.summary.succeeded, 3);
    assertEquals(parsed.data.summary.failed, 0);

    const edgeResult = parsed.data.results[2];
    assertEquals(edgeResult.cell.value, "HTTPS", "Edge label should be preserved");
  });

  it("should preserve edge text in transactional mode with shape-resolved vertices", async () => {
    const result = await handlers["add-cells"]({
      transactional: true,
      cells: [
        { type: "vertex", shape_name: "Front Doors", x: 100, y: 100, temp_id: "fd" },
        { type: "vertex", shape_name: "App Services", x: 400, y: 300, temp_id: "as" },
        { type: "edge", source_id: "fd", target_id: "as", text: "gRPC" },
      ],
    });
    const parsed = parseResult(result);
    assertEquals(parsed.data.summary.succeeded, 3);

    const edgeResult = parsed.data.results[2];
    assertEquals(edgeResult.cell.value, "gRPC", "Edge label should be preserved in transactional mode");
  });

  it("should preserve multiple edge labels in a single batch", async () => {
    const result = await handlers["add-cells"]({
      cells: [
        { type: "vertex", shape_name: "Front Doors", x: 100, y: 200, temp_id: "fd" },
        { type: "vertex", shape_name: "Container Apps", x: 400, y: 100, temp_id: "ca" },
        { type: "vertex", shape_name: "App Services", x: 400, y: 300, temp_id: "as" },
        { type: "edge", source_id: "fd", target_id: "ca", text: "HTTPS" },
        { type: "edge", source_id: "fd", target_id: "as", text: "gRPC" },
      ],
    });
    const parsed = parseResult(result);
    assertEquals(parsed.data.summary.succeeded, 5);

    assertEquals(parsed.data.results[3].cell.value, "HTTPS", "First edge label should be preserved");
    assertEquals(parsed.data.results[4].cell.value, "gRPC", "Second edge label should be preserved");
  });

  it("should include edge labels in diagram XML", async () => {
    await handlers["add-cells"]({
      cells: [
        { type: "vertex", shape_name: "rectangle", x: 100, y: 100, temp_id: "a" },
        { type: "vertex", shape_name: "rectangle", x: 400, y: 100, temp_id: "b" },
        { type: "edge", source_id: "a", target_id: "b", text: "MyLabel" },
      ],
    });
    assert(diagramXml!.includes("MyLabel"), "Edge label should appear in diagram XML");
  });
});

describe("workflow regression: transactional placeholder IDs in group assignment", () => {
  it("should assign transactional placeholder cells to groups", async () => {
    // Step 1: Create group
    const groupResult = await handlers["create-groups"]({
      transactional: true,
      groups: [{ x: 200, y: 50, width: 400, height: 300, text: "Container Apps Environment" }],
    });
    const groupParsed = parseResult(groupResult);
    const groupId = groupParsed.data.results[0].cell.id;

    // Step 2: Add cells with shape_name in transactional mode
    const cellsResult = await handlers["add-cells"]({
      transactional: true,
      cells: [
        { type: "vertex", shape_name: "Container Apps", x: 30, y: 30, temp_id: "ca1" },
        { type: "vertex", shape_name: "Container Apps", x: 30, y: 130, temp_id: "ca2" },
      ],
    });
    const cellsParsed = parseResult(cellsResult);
    const ca1Id = cellsParsed.data.results[0].cell.id;
    const ca2Id = cellsParsed.data.results[1].cell.id;

    // Verify placeholder IDs
    assert(ca1Id.startsWith("placeholder-"), "Cell 1 should have placeholder ID");
    assert(ca2Id.startsWith("placeholder-"), "Cell 2 should have placeholder ID");

    // Step 3: Assign cells to group using actual IDs from response
    const assignResult = await handlers["add-cells-to-group"]({
      transactional: true,
      assignments: [
        { cell_id: ca1Id, group_id: groupId },
        { cell_id: ca2Id, group_id: groupId },
      ],
    });
    const assignParsed = parseResult(assignResult);
    assertEquals(assignParsed.success, true);
    assertEquals(assignParsed.data.summary.succeeded, 2);
    assertEquals(assignParsed.data.summary.failed, 0);

    // Verify parent assignment in response
    assertEquals(assignParsed.data.results[0].cell.parent, groupId);
    assertEquals(assignParsed.data.results[1].cell.parent, groupId);
  });

  it("should reflect group containment in diagram XML after transactional assignment", async () => {
    // Create group
    const groupResult = await handlers["create-groups"]({
      transactional: true,
      groups: [{ x: 100, y: 100, width: 300, height: 200, text: "VNet" }],
    });
    const groupId = parseResult(groupResult).data.results[0].cell.id;

    // Add a cell
    const cellsResult = await handlers["add-cells"]({
      transactional: true,
      cells: [{ type: "vertex", shape_name: "Container Apps", x: 20, y: 20, temp_id: "ca" }],
    });
    const cellId = parseResult(cellsResult).data.results[0].cell.id;

    // Assign to group
    await handlers["add-cells-to-group"]({
      transactional: true,
      assignments: [{ cell_id: cellId, group_id: groupId }],
    });

    // Verify the XML contains parent="{groupId}" for the child cell
    assert(
      diagramXml!.includes(`parent="${groupId}"`),
      `Diagram XML should have parent="${groupId}" for the child cell`,
    );
  });
});

describe("workflow regression: full architecture workflow", () => {
  it("should complete search → groups → add-cells → assign → verify flow", async () => {
    // Step 1: Search shapes
    const searchResult = await handlers["search-shapes"]({
      queries: ["Front Doors", "Container Apps", "App Services"],
    });
    const searchParsed = parseResult(searchResult);
    assertEquals(searchParsed.data.results.length, 3);

    // Step 2: Create groups
    const groupResult = await handlers["create-groups"]({
      transactional: true,
      groups: [
        { x: 300, y: 50, width: 300, height: 250, text: "Container Apps Environment", temp_id: "env" },
      ],
    });
    const groupParsed = parseResult(groupResult);
    const envGroupId = groupParsed.data.results[0].cell.id;

    // Step 3: Add cells — vertices with shapes + edges with labels
    const cellsResult = await handlers["add-cells"]({
      transactional: true,
      cells: [
        { type: "vertex", shape_name: "Front Doors", x: 100, y: 150, temp_id: "fd" },
        { type: "vertex", shape_name: "Container Apps", x: 30, y: 30, temp_id: "ca1" },
        { type: "vertex", shape_name: "Container Apps", x: 30, y: 130, temp_id: "ca2" },
        { type: "vertex", shape_name: "App Services", x: 700, y: 350, temp_id: "api" },
        { type: "edge", source_id: "fd", target_id: "ca1", text: "HTTPS" },
        { type: "edge", source_id: "ca1", target_id: "api", text: "REST" },
      ],
    });
    const cellsParsed = parseResult(cellsResult);
    assertEquals(cellsParsed.data.summary.succeeded, 6);
    assertEquals(cellsParsed.data.summary.failed, 0);

    // Extract actual IDs from response
    const fdId = cellsParsed.data.results[0].cell.id;
    const ca1Id = cellsParsed.data.results[1].cell.id;
    const ca2Id = cellsParsed.data.results[2].cell.id;

    // Verify edge labels are preserved
    assertEquals(cellsParsed.data.results[4].cell.value, "HTTPS");
    assertEquals(cellsParsed.data.results[5].cell.value, "REST");

    // Verify placeholder IDs for shape cells
    assert(fdId.startsWith("placeholder-"), "Front Doors should have placeholder ID");
    assert(ca1Id.startsWith("placeholder-"), "Container App 1 should have placeholder ID");
    assert(ca2Id.startsWith("placeholder-"), "Container App 2 should have placeholder ID");

    // Step 4: Assign container apps to group using actual IDs
    const assignResult = await handlers["add-cells-to-group"]({
      transactional: true,
      assignments: [
        { cell_id: ca1Id, group_id: envGroupId },
        { cell_id: ca2Id, group_id: envGroupId },
      ],
    });
    const assignParsed = parseResult(assignResult);
    assertEquals(assignParsed.data.summary.succeeded, 2);
    assertEquals(assignParsed.data.summary.failed, 0);

    // Verify containment in XML
    assertExists(diagramXml);
    assert(
      diagramXml!.includes(`parent="${envGroupId}"`),
      "Container apps should have the group as parent in XML",
    );

    // Step 5: Finish diagram — finish-diagram returns xml, not diagram_xml
    const finishResult = await handlers["finish-diagram"]({ compress: false });
    const finishParsed = parseResult(finishResult);
    assertEquals(finishParsed.success, true);

    // Verify final XML still has labels and containment
    const finalXml = finishParsed.data.xml;
    assertExists(finalXml, "finish-diagram should return xml");
    assert(finalXml.includes("HTTPS"), "HTTPS label should survive finish-diagram");
    assert(finalXml.includes("REST"), "REST label should survive finish-diagram");
    assert(
      finalXml.includes(`parent="${envGroupId}"`),
      "Group containment should survive finish-diagram",
    );
  });

  it("should complete workflow in non-transactional mode", async () => {
    // Create group
    const groupResult = await handlers["create-groups"]({
      groups: [{ x: 300, y: 50, width: 300, height: 200, text: "Env" }],
    });
    const envGroupId = parseResult(groupResult).data.results[0].cell.id;

    // Add cells with shapes and labeled edges
    const cellsResult = await handlers["add-cells"]({
      cells: [
        { type: "vertex", shape_name: "Front Doors", x: 100, y: 120, temp_id: "fd" },
        { type: "vertex", shape_name: "Container Apps", x: 30, y: 30, temp_id: "ca" },
        { type: "edge", source_id: "fd", target_id: "ca", text: "HTTPS" },
      ],
    });
    const cellsParsed = parseResult(cellsResult);
    const caId = cellsParsed.data.results[1].cell.id;

    // Verify edge label
    assertEquals(cellsParsed.data.results[2].cell.value, "HTTPS");

    // Assign to group
    const assignResult = await handlers["add-cells-to-group"]({
      assignments: [{ cell_id: caId, group_id: envGroupId }],
    });
    assertEquals(parseResult(assignResult).data.summary.succeeded, 1);

    // Export and verify
    const exportResult = await handlers["export-diagram"]({ compress: false });
    const exportParsed = parseResult(exportResult);
    const xml = exportParsed.data.xml;
    assert(xml.includes("HTTPS"), "Edge label should be in exported XML");
    assert(xml.includes(`parent="${envGroupId}"`), "Group containment should be in exported XML");
  });
});

describe("workflow regression: edge anchor stripping", () => {
  it("should strip entryX/entryY/exitX/exitY from caller-provided edge styles in add-cells", async () => {
    const result = await handlers["add-cells"]({
      cells: [
        { type: "vertex", shape_name: "rectangle", x: 100, y: 100, temp_id: "a", width: 80, height: 60 },
        { type: "vertex", shape_name: "rectangle", x: 400, y: 100, temp_id: "b", width: 80, height: 60 },
        {
          type: "edge",
          source_id: "a",
          target_id: "b",
          text: "flow",
          style: "edgeStyle=orthogonalEdgeStyle;exitX=0.5;exitY=1;entryX=0;entryY=0.5;rounded=0;html=1;",
        },
      ],
    });
    const parsed = parseResult(result);
    assertEquals(parsed.data.summary.succeeded, 3);

    // The stored cell style should NOT contain any caller-provided anchors
    const edgeStyle: string = parsed.data.results[2].cell.style;
    assert(!edgeStyle.includes("exitX=0.5"), "Caller's exitX=0.5 should be stripped");
    assert(!edgeStyle.includes("exitY=1"), "Caller's exitY=1 should be stripped");
    assert(!edgeStyle.includes("entryX=0"), "Caller's entryX=0 should be stripped");
    assert(!edgeStyle.includes("entryY=0.5"), "Caller's entryY=0.5 should be stripped");

    // The server calculates anchors during XML rendering (withSymmetricEdgeAnchors)
    // so the exported XML should contain server-calculated anchors
    const exportResult = await handlers["export-diagram"]({ compress: false });
    const exportParsed = parseResult(exportResult);
    const xml: string = exportParsed.data.xml;
    assert(xml.includes("exitX="), "Server should calculate exitX in rendered XML");
    assert(xml.includes("entryX="), "Server should calculate entryX in rendered XML");
  });

  it("should strip anchor properties from edit-edges styles", async () => {
    // First, create vertices and an edge
    const addResult = await handlers["add-cells"]({
      cells: [
        { type: "vertex", shape_name: "rectangle", x: 100, y: 100, temp_id: "a", width: 80, height: 60 },
        { type: "vertex", shape_name: "rectangle", x: 400, y: 100, temp_id: "b", width: 80, height: 60 },
        { type: "edge", source_id: "a", target_id: "b", text: "test" },
      ],
    });
    const addParsed = parseResult(addResult);
    const edgeId = addParsed.data.results[2].cell.id;

    // Now edit the edge with style containing anchors
    const editResult = await handlers["edit-edges"]({
      edges: [
        {
          cell_id: edgeId,
          style: "edgeStyle=orthogonalEdgeStyle;exitX=1;exitY=0;entryX=0.5;entryY=1;rounded=1;html=1;",
        },
      ],
    });
    const editParsed = parseResult(editResult);
    assertEquals(editParsed.data.summary.succeeded, 1);

    // Verify anchors were stripped (style should not contain caller's anchor values)
    const edgeStyle: string = editParsed.data.results[0].cell.style;
    assert(!edgeStyle.includes("exitX=1;"), "Caller's exitX=1 should be stripped from edit-edges");
    assert(!edgeStyle.includes("entryY=1;"), "Caller's entryY=1 should be stripped from edit-edges");
  });

  it("should preserve non-anchor style properties when stripping anchors", async () => {
    const result = await handlers["add-cells"]({
      cells: [
        { type: "vertex", shape_name: "rectangle", x: 100, y: 100, temp_id: "a", width: 80, height: 60 },
        { type: "vertex", shape_name: "rectangle", x: 400, y: 100, temp_id: "b", width: 80, height: 60 },
        {
          type: "edge",
          source_id: "a",
          target_id: "b",
          style: "edgeStyle=orthogonalEdgeStyle;exitX=1;exitY=0.5;dashed=1;rounded=1;entryX=0;entryY=0.5;html=1;",
        },
      ],
    });
    const parsed = parseResult(result);
    const edgeStyle: string = parsed.data.results[2].cell.style;
    assert(edgeStyle.includes("dashed=1"), "Non-anchor property 'dashed=1' should be preserved");
    assert(edgeStyle.includes("rounded=1"), "Non-anchor property 'rounded=1' should be preserved");
    assert(edgeStyle.includes("edgeStyle=orthogonalEdgeStyle"), "edgeStyle should be preserved");
  });

  it("should not affect vertex styles (only strip from edges)", async () => {
    // Vertex styles can legitimately contain anchor-like properties
    const result = await handlers["add-cells"]({
      cells: [
        {
          type: "vertex",
          x: 100,
          y: 100,
          width: 80,
          height: 60,
          style: "rounded=1;exitX=0.5;exitY=1;html=1;",
        },
      ],
    });
    const parsed = parseResult(result);
    assertEquals(parsed.data.summary.succeeded, 1);
    const vertexStyle: string = parsed.data.results[0].cell.style;
    assert(vertexStyle.includes("exitX=0.5"), "Vertex styles should NOT have anchors stripped");
  });
});

describe("workflow regression: create-groups requires non-empty text", () => {
  it("should succeed with non-empty text", async () => {
    const result = await handlers["create-groups"]({
      groups: [{ x: 100, y: 100, width: 300, height: 200, text: "VNet" }],
    });
    const parsed = parseResult(result);
    assertEquals(parsed.data.summary.succeeded, 1);
    assertEquals(parsed.data.results[0].cell.value, "VNet");
  });
});
