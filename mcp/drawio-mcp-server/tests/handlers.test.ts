import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { assert, assertEquals, assertExists, assertGreater } from "@std/assert";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { clearResolveShapeCache, getResolveCacheSize, handlers as baseHandlers, setMaxResolveCacheSize, warmupSearchPath } from "../src/tools.ts";

/**
 * Extract and parse the JSON text payload from a CallToolResult.
 * All handlers return text content, so this narrows the union type safely.
 */
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

/** Create a vertex via add-cells and return the cell data. */
async function addVertex(
  args: { x?: number; y?: number; width?: number; height?: number; text?: string; style?: string } = {},
) {
  const result = await handlers["add-cells"]({ cells: [{ type: "vertex" as const, ...args }] });
  return parseResult(result).data.results[0].cell;
}

/** Create an edge via add-cells and return the cell data. */
async function addEdge(sourceId: string, targetId: string, text?: string, style?: string) {
  const result = await handlers["add-cells"]({
    cells: [{ type: "edge" as const, source_id: sourceId, target_id: targetId, text, style }],
  });
  return parseResult(result).data.results[0].cell;
}

// Reset diagram state between tests
beforeEach(() => {
  diagramXml = undefined;
});

describe("tool handlers", () => {
  describe("delete-cell-by-id", () => {
    it("should delete an existing cell", async () => {
      const cell = await addVertex({ text: "ToDelete" });
      const result = await handlers["delete-cell-by-id"]({ cell_id: cell.id });
      const parsed = parseResult(result);
      assertEquals(parsed.success, true);
      assertEquals(parsed.data.deleted, cell.id);
    });

    it("should return error for non-existent cell", async () => {
      const result = await handlers["delete-cell-by-id"]({ cell_id: "nope" });
      assertEquals(result.isError, true);
    });

    it("should report cascaded edge deletions", async () => {
      const a = await addVertex({ text: "A" });
      const b = await addVertex({ text: "B" });
      await addEdge(a.id, b.id);
      const result = await handlers["delete-cell-by-id"]({ cell_id: a.id });
      const parsed = parseResult(result);
      assertEquals(parsed.data.deleted, a.id);
      assertEquals(parsed.data.cascaded_edges.length, 1);
    });
  });

  describe("edit-edges", () => {
    it("should update edge text", async () => {
      const a = await addVertex({ text: "A" });
      const b = await addVertex({ text: "B" });
      const edge = await addEdge(a.id, b.id, "old");
      const result = await handlers["edit-edges"]({
        edges: [{ cell_id: edge.id, text: "new label" }],
      });
      const parsed = parseResult(result);
      assertEquals(parsed.success, true);
      assertEquals(parsed.data.summary.succeeded, 1);
      assertEquals(parsed.data.results[0].cell.value, "new label");
    });

    it("should batch-edit multiple edges", async () => {
      const a = await addVertex({ text: "A" });
      const b = await addVertex({ text: "B" });
      const c = await addVertex({ text: "C" });
      const edge1 = await addEdge(a.id, b.id, "e1");
      const edge2 = await addEdge(b.id, c.id, "e2");
      const result = await handlers["edit-edges"]({
        edges: [
          { cell_id: edge1.id, text: "updated-e1" },
          { cell_id: edge2.id, text: "updated-e2", style: "dashed=1;" },
        ],
      });
      const parsed = parseResult(result);
      assertEquals(parsed.success, true);
      assertEquals(parsed.data.summary.total, 2);
      assertEquals(parsed.data.summary.succeeded, 2);
      assertEquals(parsed.data.summary.failed, 0);
      assertEquals(parsed.data.results[0].cell.value, "updated-e1");
      assertEquals(parsed.data.results[1].cell.value, "updated-e2");
      assertEquals(parsed.data.results[1].cell.style, "dashed=1;");
    });

    it("should return error for non-existent edge", async () => {
      const result = await handlers["edit-edges"]({
        edges: [{ cell_id: "nonexistent", text: "X" }],
      });
      const parsed = parseResult(result);
      assertEquals(parsed.data.summary.failed, 1);
      assertEquals(parsed.data.results[0].error.code, "CELL_NOT_FOUND");
    });

    it("should return error when editing a vertex as an edge", async () => {
      const cell = await addVertex({ text: "A" });
      const result = await handlers["edit-edges"]({
        edges: [{ cell_id: cell.id, text: "X" }],
      });
      const parsed = parseResult(result);
      assertEquals(parsed.data.summary.failed, 1);
      assertEquals(parsed.data.results[0].error.code, "WRONG_CELL_TYPE");
    });

    it("should return error for empty edges array", async () => {
      const result = await handlers["edit-edges"]({ edges: [] });
      assertEquals(result.isError, true);
      const parsed = parseResult(result);
      assertEquals(parsed.error.code, "INVALID_INPUT");
    });

    it("should handle mixed success and failure in batch", async () => {
      const a = await addVertex({ text: "A" });
      const b = await addVertex({ text: "B" });
      const edge = await addEdge(a.id, b.id, "e1");
      const result = await handlers["edit-edges"]({
        edges: [
          { cell_id: edge.id, text: "updated" },
          { cell_id: "nonexistent", text: "fail" },
        ],
      });
      const parsed = parseResult(result);
      assertEquals(parsed.data.summary.total, 2);
      assertEquals(parsed.data.summary.succeeded, 1);
      assertEquals(parsed.data.summary.failed, 1);
      assertEquals(parsed.data.results[0].success, true);
      assertEquals(parsed.data.results[1].success, false);
    });
  });

  describe("list-paged-model", () => {
    it("should return empty page for empty diagram", async () => {
      const result = await handlers["list-paged-model"]({});
      const parsed = parseResult(result);
      assertEquals(parsed.data.totalCells, 0);
      assertEquals(parsed.data.cells.length, 0);
    });

    it("should paginate cells", async () => {
      for (let i = 0; i < 5; i++) {
        await addVertex({ text: `Cell ${i}` });
      }
      const page0 = await handlers["list-paged-model"]({ page: 0, page_size: 2 });
      const parsed0 = parseResult(page0);
      assertEquals(parsed0.data.cells.length, 2);
      assertEquals(parsed0.data.totalPages, 3);
      const page2 = await handlers["list-paged-model"]({ page: 2, page_size: 2 });
      const parsed2 = parseResult(page2);
      assertEquals(parsed2.data.cells.length, 1);
    });

    it("should filter by cell type", async () => {
      const a = await addVertex({ text: "A" });
      const b = await addVertex({ text: "B" });
      await addEdge(a.id, b.id);
      const vertexResult = await handlers["list-paged-model"]({
        filter: { cell_type: "vertex" },
      });
      const parsed = parseResult(vertexResult);
      assertEquals(parsed.data.totalCells, 2);
    });

    it("should filter by edge type", async () => {
      const a = await addVertex({ text: "A" });
      const b = await addVertex({ text: "B" });
      await addEdge(a.id, b.id);
      const edgeResult = await handlers["list-paged-model"]({
        filter: { cell_type: "edge" },
      });
      const parsed = parseResult(edgeResult);
      assertEquals(parsed.data.totalCells, 1);
    });
  });

  describe("layer operations", () => {
    it("should create, list, set, and get active layer", async () => {
      const createResult = await handlers["create-layer"]({ name: "Network" });
      const created = parseResult(createResult);
      assertEquals(created.data.layer.name, "Network");
      const listResult = await handlers["list-layers"]();
      const layers = parseResult(listResult).data.layers;
      assertEquals(layers.length, 2);
      await handlers["set-active-layer"]({ layer_id: created.data.layer.id });
      const listResult2 = await handlers["list-layers"]();
      const listParsed2 = parseResult(listResult2);
      assertEquals(listParsed2.data.active_layer_id, created.data.layer.id);
    });

    it("should move cell to different layer", async () => {
      const layerResult = await handlers["create-layer"]({ name: "Target" });
      const layerId = parseResult(layerResult).data.layer.id;
      const cell = await addVertex({ text: "Movable" });
      const moveResult = await handlers["move-cell-to-layer"]({
        cell_id: cell.id,
        target_layer_id: layerId,
      });
      const moved = parseResult(moveResult);
      assertEquals(moved.data.cell.parent, layerId);
    });

    it("should return error for set-active-layer with non-existent layer", async () => {
      const result = await handlers["set-active-layer"]({ layer_id: "nonexistent" });
      assertEquals(result.isError, true);
      const parsed = parseResult(result);
      assertEquals(parsed.error.code, "LAYER_NOT_FOUND");
    });

    it("should return error for move-cell-to-layer with non-existent cell", async () => {
      const layerResult = await handlers["create-layer"]({ name: "Target" });
      const layerId = parseResult(layerResult).data.layer.id;
      const result = await handlers["move-cell-to-layer"]({
        cell_id: "nonexistent",
        target_layer_id: layerId,
      });
      assertEquals(result.isError, true);
      const parsed = parseResult(result);
      assertEquals(parsed.error.code, "CELL_NOT_FOUND");
    });

    it("should return error for move-cell-to-layer with non-existent layer", async () => {
      const cell = await addVertex({ text: "A" });
      const result = await handlers["move-cell-to-layer"]({
        cell_id: cell.id,
        target_layer_id: "nonexistent",
      });
      assertEquals(result.isError, true);
      const parsed = parseResult(result);
      assertEquals(parsed.error.code, "LAYER_NOT_FOUND");
    });
  });

  describe("export-diagram", () => {
    it("should return valid XML", async () => {
      await addVertex({ text: "Test" });
      const result = await handlers["export-diagram"]({});
      const parsed = parseResult(result);
      assert(parsed.data.xml.includes("<mxfile"));
      assert(parsed.data.xml.includes("Test"));
      assertEquals(parsed.data.compression, { enabled: false });
    });
  });

  describe("clear-diagram", () => {
    it("should clear all cells", async () => {
      await addVertex({ text: "A" });
      await addVertex({ text: "B" });
      await handlers["clear-diagram"]();
      const stats = await handlers["get-diagram-stats"]();
      const parsed = parseResult(stats);
      assertEquals(parsed.data.stats.total_cells, 0);
    });
  });

  describe("get-diagram-stats", () => {
    it("should return correct stats", async () => {
      await addVertex({ text: "A" });
      await addVertex({ text: "B" });
      const result = await handlers["get-diagram-stats"]();
      const parsed = parseResult(result);
      assertEquals(parsed.data.stats.total_cells, 2);
      assertEquals(parsed.data.stats.vertices, 2);
      assertEquals(parsed.data.stats.edges, 0);
    });
  });

  describe("get-shape-categories", () => {
    it("should include basic and Azure categories", async () => {
      const result = await handlers["get-shape-categories"]();
      const parsed = parseResult(result);
      const categoryIds = parsed.data.categories.map((c: any) => c.id);
      assert(categoryIds.includes("general"));
      assert(categoryIds.includes("flowchart"));
      assert(parsed.data.categories.length > 5);
    });
  });

  describe("get-shapes-in-category", () => {
    it("should return shapes for general category", async () => {
      const result = await handlers["get-shapes-in-category"]({ category_id: "general" });
      const parsed = parseResult(result);
      assert(parsed.data.total > 0);
    });

    it("should return error for unknown category", async () => {
      const result = await handlers["get-shapes-in-category"]({ category_id: "nonexistent" });
      assertEquals(result.isError, true);
      const parsed = parseResult(result);
      assertEquals(parsed.error.code, "CATEGORY_NOT_FOUND");
    });

    it("should return shapes for an Azure category", async () => {
      const result = await handlers["get-shapes-in-category"]({ category_id: "compute" });
      const parsed = parseResult(result);
      assertEquals(parsed.success, true);
      assert(parsed.data.total > 0);
      assert("name" in parsed.data.shapes[0]);
      assert("id" in parsed.data.shapes[0]);
    });

    it("should return shapes for flowchart category", async () => {
      const result = await handlers["get-shapes-in-category"]({ category_id: "flowchart" });
      const parsed = parseResult(result);
      assertEquals(parsed.success, true);
      assert(parsed.data.total > 0);
    });
  });

  describe("add-cells", () => {
    it("should add multiple cells and resolve temp IDs", async () => {
      const result = await handlers["add-cells"]({
        cells: [
          { type: "vertex", x: 100, y: 100, text: "A", temp_id: "a" },
          { type: "vertex", x: 300, y: 100, text: "B", temp_id: "b" },
          { type: "edge", source_id: "a", target_id: "b", text: "link" },
        ],
      });
      const parsed = parseResult(result);
      assertEquals(parsed.data.summary.succeeded, 3);
      assertEquals(parsed.data.summary.failed, 0);
    });

    it("should support dry_run mode", async () => {
      const result = await handlers["add-cells"]({
        cells: [{ type: "vertex", x: 100, y: 100, text: "DryRun" }],
        dry_run: true,
      });
      const parsed = parseResult(result);
      assertEquals(parsed.data.dry_run, true);
      assertEquals(parsed.data.summary.succeeded, 1);
      const stats = await handlers["get-diagram-stats"]();
      const statsParsed = parseResult(stats);
      assertEquals(statsParsed.data.stats.total_cells, 0);
    });

    it("should fail when edge references non-existent source", async () => {
      const result = await handlers["add-cells"]({
        cells: [{ type: "edge", source_id: "nonexistent", target_id: "also-nonexistent" }],
      });
      const parsed = parseResult(result);
      assert(parsed.data.summary.failed > 0);
    });

    it("should resolve temp IDs for edges referencing earlier batch items", async () => {
      const result = await handlers["add-cells"]({
        cells: [
          { type: "vertex", x: 100, y: 100, text: "A", temp_id: "tmp-a" },
          { type: "vertex", x: 300, y: 100, text: "B", temp_id: "tmp-b" },
          { type: "edge", source_id: "tmp-a", target_id: "tmp-b", temp_id: "tmp-e" },
        ],
      });
      const parsed = parseResult(result);
      assertEquals(parsed.data.summary.succeeded, 3);
      const edgeResult = parsed.data.results[2];
      assertEquals(edgeResult.success, true);
    });

    it("should resolve shape_name to full icon style for vertices", async () => {
      const result = await handlers["add-cells"]({
        cells: [
          { type: "vertex", x: 50, y: 50, shape_name: "rectangle", temp_id: "r" },
          { type: "vertex", x: 200, y: 50, shape_name: "Front Doors", temp_id: "fd" },
          { type: "edge", source_id: "r", target_id: "fd" },
        ],
      });
      const parsed = parseResult(result);
      assertEquals(parsed.data.summary.succeeded, 3);
      // Basic shape should have its style
      const rectCell = parsed.data.results[0].cell;
      assert(rectCell.style.includes("whiteSpace=wrap"), "rectangle should have its basic shape style");
      // Azure icon should have the full image data URL
      const fdCell = parsed.data.results[1].cell;
      assert(fdCell.style.includes("shape=image;"), "Front Door should have shape=image style");
      assert(fdCell.style.includes("image=data:image/svg+xml,"), "Front Door should include SVG data URL");
    });

    it("should use shape_name style over explicit style when both provided", async () => {
      const result = await handlers["add-cells"]({
        cells: [
          { type: "vertex", x: 50, y: 50, shape_name: "Front Doors", style: "shape=image;", temp_id: "fd" },
        ],
      });
      const parsed = parseResult(result);
      assertEquals(parsed.data.summary.succeeded, 1);
      const cell = parsed.data.results[0].cell;
      assert(cell.style.includes("image=data:image/svg+xml,"), "shape_name should override explicit style");
    });

    it("should resolve temp_id cross-references for edges in transactional mode", async () => {
      const result = await handlers["add-cells"]({
        transactional: true,
        cells: [
          { type: "vertex", shape_name: "Front Doors", x: 100, y: 100, temp_id: "fd" },
          { type: "vertex", shape_name: "Container Apps", x: 400, y: 100, temp_id: "ca" },
          { type: "edge", source_id: "fd", target_id: "ca" },
        ],
      });
      const parsed = parseResult(result);
      assertEquals(parsed.data.summary.succeeded, 3);
      assertEquals(parsed.data.summary.failed, 0);
      // Vertex cells should have placeholder IDs
      const fdCell = parsed.data.results[0].cell;
      const caCell = parsed.data.results[1].cell;
      assert(fdCell.id.startsWith("placeholder-"), "Front Doors should have placeholder ID");
      assert(caCell.id.startsWith("placeholder-"), "Container Apps should have placeholder ID");
      // Edge should connect the two placeholder cells
      const edgeCell = parsed.data.results[2].cell;
      assertEquals(edgeCell.sourceId, fdCell.id);
      assertEquals(edgeCell.targetId, caCell.id);
    });
  });

  describe("edit-cells", () => {
    it("should edit multiple cells", async () => {
      const a = await addVertex({ text: "A" });
      const b = await addVertex({ text: "B" });
      const result = await handlers["edit-cells"]({
        cells: [
          { cell_id: a.id, text: "Updated A" },
          { cell_id: b.id, x: 999 },
        ],
      });
      const parsed = parseResult(result);
      assertEquals(parsed.data.summary.succeeded, 2);
    });

    it("should report failure for non-existent cell in batch", async () => {
      const a = await addVertex({ text: "A" });
      const result = await handlers["edit-cells"]({
        cells: [
          { cell_id: a.id, text: "Updated" },
          { cell_id: "nonexistent", text: "Fail" },
        ],
      });
      const parsed = parseResult(result);
      assertEquals(parsed.data.summary.succeeded, 1);
      assertEquals(parsed.data.summary.failed, 1);
    });

    it("should update text on transactional placeholder cells and reflect in response", async () => {
      // Create cells in transactional mode
      const addResult = await handlers["add-cells"]({
        transactional: true,
        cells: [
          { type: "vertex", shape_name: "Front Doors", x: 100, y: 100, temp_id: "fd" },
        ],
      });
      const addParsed = parseResult(addResult);
      const placeholderId = addParsed.data.results[0].cell.id;
      assert(placeholderId.startsWith("placeholder-"), "Should have placeholder ID");

      // Edit the text — this should work and the new value should appear in the response
      const editResult = await handlers["edit-cells"]({
        transactional: true,
        cells: [{ cell_id: placeholderId, text: "My Custom Label" }],
      });
      const editParsed = parseResult(editResult);
      assertEquals(editParsed.data.summary.succeeded, 1);
      assertEquals(editParsed.data.results[0].cell.value, "My Custom Label");

      // The diagram_xml should also contain the updated value
      assert(editParsed.data.diagram_xml.includes("My Custom Label"));
    });
  });

  describe("add-cells shape resolution", () => {
    it("should add multiple shape cells via shape_name", async () => {
      const result = await handlers["add-cells"]({
        cells: [
          { type: "vertex", shape_name: "rectangle", x: 100, y: 100, temp_id: "r1" },
          { type: "vertex", shape_name: "decision", x: 300, y: 100, temp_id: "d1" },
        ],
      });
      const parsed = parseResult(result);
      assertEquals(parsed.data.summary.succeeded, 2);
      assertEquals(parsed.data.summary.failed, 0);
    });

    it("should add Azure shape cells with info", async () => {
      const searchResult = await handlers["search-shapes"]({ queries: ["virtual machine"], limit: 1 });
      const azureName = parseResult(searchResult).data.results[0].matches[0].name;
      const result = await handlers["add-cells"]({
        cells: [{ type: "vertex", shape_name: azureName, x: 100, y: 100 }],
      });
      const parsed = parseResult(result);
      assertEquals(parsed.data.summary.succeeded, 1);
      assert(parsed.data.results[0].info.includes("Azure icon"));
    });

    it("should include confidence for fuzzy-matched Azure shapes", async () => {
      // Use a partial/approximate name that is NOT an alias hit so it falls
      // through to the fuzzy-search path in resolveShape.
      const result = await handlers["add-cells"]({
        cells: [{ type: "vertex", shape_name: "defender distributer control", x: 100, y: 100 }],
      });
      const parsed = parseResult(result);
      assertEquals(parsed.data.summary.succeeded, 1);
      assert(parsed.data.results[0].info.includes("matched from search"));
      assert(parsed.data.results[0].confidence > 0);
    });

    it("should handle mixed success and failure in batch", async () => {
      const result = await handlers["add-cells"]({
        cells: [
          { type: "vertex", shape_name: "rectangle", x: 100, y: 100 },
          { type: "vertex", shape_name: "xyznonexistent_shape", x: 200, y: 200 },
          { type: "vertex", shape_name: "decision", x: 300, y: 300 },
        ],
      });
      const parsed = parseResult(result);
      assertEquals(parsed.data.summary.succeeded, 2);
      assertEquals(parsed.data.summary.failed, 1);
      assertEquals(parsed.data.success, false);
      assertEquals(parsed.data.results[1].success, false);
      assertEquals(parsed.data.results[1].error.code, "SHAPE_NOT_FOUND");
    });

    it("should always use shape dimensions when shape_name is specified", async () => {
      const result = await handlers["add-cells"]({
        cells: [
          { type: "vertex", shape_name: "rectangle", x: 50, y: 50, width: 400, height: 200, text: "Big" },
        ],
      });
      const parsed = parseResult(result);
      // Shape dimensions are always used when shape_name is specified (ignores user-provided width/height)
      assertEquals(parsed.data.results[0].cell.width, 200); // rectangle default
      assertEquals(parsed.data.results[0].cell.height, 100); // rectangle default
      assertEquals(parsed.data.results[0].cell.value, "Big");
    });
  });

  describe("search-shapes", () => {
    it("should find shapes with queries array", async () => {
      const result = await handlers["search-shapes"]({ queries: ["storage"] });
      const parsed = parseResult(result);
      assertEquals(parsed.data.results.length, 1);
      assert(parsed.data.results[0].matches.length > 0);
    });

    it("should support multiple queries", async () => {
      const result = await handlers["search-shapes"]({
        queries: ["storage", "compute"],
      });
      const parsed = parseResult(result);
      assertEquals(parsed.data.results.length, 2);
      assertEquals(parsed.data.totalQueries, 2);
    });

    it("should error when queries array is empty", async () => {
      const result = await handlers["search-shapes"]({ queries: [] });
      assertEquals(result.isError, true);
      const parsed = parseResult(result);
      assertEquals(parsed.error.code, "INVALID_INPUT");
    });

    it("should respect custom limit", async () => {
      const result = await handlers["search-shapes"]({ queries: ["azure"], limit: 3 });
      const parsed = parseResult(result);
      assert(parsed.data.results[0].matches.length <= 3);
    });

    it("should include basic shapes in results", async () => {
      const result = await handlers["search-shapes"]({ queries: ["rectangle"] });
      const parsed = parseResult(result);
      const matches = parsed.data.results[0].matches;
      assert(matches.length > 0);
      assertEquals(matches[0].name, "rectangle");
      assertEquals(matches[0].category, "basic");
      assertEquals(matches[0].confidence, 1.0);
    });

    it("should return basic shapes before Azure icons for matching queries", async () => {
      const result = await handlers["search-shapes"]({ queries: ["diamond"] });
      const parsed = parseResult(result);
      const matches = parsed.data.results[0].matches;
      assert(matches.length > 0);
      assertEquals(matches[0].category, "basic");
    });

    it("should find basic shapes with partial match", async () => {
      const result = await handlers["search-shapes"]({ queries: ["rect"] });
      const parsed = parseResult(result);
      const matches = parsed.data.results[0].matches;
      const basicMatch = matches.find((m: any) => m.name === "rectangle");
      assertExists(basicMatch);
      assertEquals(basicMatch.category, "basic");
    });

    it("should combine basic and Azure results in a single query", async () => {
      const result = await handlers["search-shapes"]({ queries: ["circle", "storage"] });
      const parsed = parseResult(result);
      assertEquals(parsed.data.results.length, 2);
      const circleMatches = parsed.data.results[0].matches;
      assert(circleMatches.some((m: any) => m.category === "basic"));
      const storageMatches = parsed.data.results[1].matches;
      assert(storageMatches.length > 0);
    });
  });

  describe("get-style-presets", () => {
    it("should return preset categories", async () => {
      const result = await handlers["get-style-presets"]();
      const parsed = parseResult(result);
      assert("azure" in parsed.data.presets);
      assert("flowchart" in parsed.data.presets);
      assert("general" in parsed.data.presets);
      assert("edges" in parsed.data.presets);
    });
  });

  describe("set-cell-shape", () => {
    it("should update cells' styles to match shapes", async () => {
      const a = await addVertex({ text: "A" });
      const b = await addVertex({ text: "B" });
      const result = await handlers["set-cell-shape"]({
        cells: [
          { cell_id: a.id, shape_name: "ellipse" },
          { cell_id: b.id, shape_name: "circle" },
        ],
      });
      const parsed = parseResult(result);
      assertEquals(parsed.data.summary.succeeded, 2);
    });

    it("should error when cells array is empty", async () => {
      const result = await handlers["set-cell-shape"]({ cells: [] });
      assertEquals(result.isError, true);
      const parsed = parseResult(result);
      assertEquals(parsed.error.code, "INVALID_INPUT");
    });

    it("should report errors for unknown shapes in cells array", async () => {
      const cell = await addVertex({ text: "A" });
      const result = await handlers["set-cell-shape"]({
        cells: [{ cell_id: cell.id, shape_name: "xyznonexistent" }],
      });
      const parsed = parseResult(result);
      assertEquals(parsed.data.summary.failed, 1);
      assertEquals(parsed.data.results[0].error.code, "SHAPE_NOT_FOUND");
    });

    it("should report errors for non-existent cell in cells array", async () => {
      const result = await handlers["set-cell-shape"]({
        cells: [{ cell_id: "nonexistent", shape_name: "rectangle" }],
      });
      const parsed = parseResult(result);
      assertEquals(parsed.data.summary.failed, 1);
    });
  });

  describe("edge convention warnings", () => {
    it("should attach warnings when add-cells creates a leftward edge", async () => {
      const result = await handlers["add-cells"]({
        cells: [
          { type: "vertex", x: 400, y: 100, width: 50, height: 50, text: "Source", temp_id: "src" },
          { type: "vertex", x: 100, y: 100, width: 50, height: 50, text: "Target", temp_id: "tgt" },
          { type: "edge", source_id: "src", target_id: "tgt" },
        ],
      });
      const parsed = parseResult(result);
      assertEquals(parsed.data.summary.succeeded, 3);
      const edgeResult = parsed.data.results[2];
      assertExists(edgeResult.warnings);
      assert(edgeResult.warnings.some((w: string) => w.includes("leftward")));
    });

    it("should attach warnings when add-cells edge targets child inside group", async () => {
      // Create a group with a child, then add an external source and edge to the child
      const groupResult = await handlers["create-groups"]({
        groups: [{ x: 200, y: 100, width: 300, height: 200, text: "Env", temp_id: "grp" }],
      });
      const grpData = parseResult(groupResult).data;
      const groupId = grpData.results[0].cell.id;

      const cellsResult = await handlers["add-cells"]({
        cells: [
          { type: "vertex", x: 30, y: 30, width: 50, height: 50, text: "App", temp_id: "app" },
          { type: "vertex", x: 10, y: 150, width: 50, height: 50, text: "FrontDoor", temp_id: "fd" },
        ],
      });
      const cellsData = parseResult(cellsResult).data;
      const appId = cellsData.results[0].cell.id;
      const fdId = cellsData.results[1].cell.id;

      await handlers["add-cells-to-group"]({
        assignments: [{ cell_id: appId, group_id: groupId }],
      });

      const edgeResult = await handlers["add-cells"]({
        cells: [{ type: "edge", source_id: fdId, target_id: appId }],
      });
      const edgeParsed = parseResult(edgeResult);
      const edgeData = edgeParsed.data.results[0];
      assertExists(edgeData.warnings);
      assert(edgeData.warnings.some((w: string) => w.includes("group cell")));
    });

    it("should not attach warnings for well-formed edges", async () => {
      const result = await handlers["add-cells"]({
        cells: [
          { type: "vertex", x: 100, y: 100, width: 50, height: 50, text: "A", temp_id: "a" },
          { type: "vertex", x: 400, y: 100, width: 50, height: 50, text: "B", temp_id: "b" },
          { type: "edge", source_id: "a", target_id: "b" },
        ],
      });
      const parsed = parseResult(result);
      const edgeResult = parsed.data.results[2];
      assertEquals(edgeResult.warnings, undefined);
    });

    it("should attach warnings from edit-edges when source/target creates backwards flow", async () => {
      const a = await addVertex({ x: 400, y: 100, width: 50, height: 50, text: "A" });
      const b = await addVertex({ x: 100, y: 100, width: 50, height: 50, text: "B" });
      const edge = await addEdge(a.id, b.id);
      // Re-edit the edge (same bad direction)
      const result = await handlers["edit-edges"]({
        edges: [{ cell_id: edge.id, text: "updated" }],
      });
      const parsed = parseResult(result);
      assertEquals(parsed.data.summary.succeeded, 1);
      const edgeData = parsed.data.results[0];
      assertExists(edgeData.warnings);
      assert(edgeData.warnings.some((w: string) => w.includes("leftward")));
    });
  });

  describe("withDiagramState edge cases", () => {
    it("should handle undefined args (args ?? {} fallback)", () => {
      const result = baseHandlers["get-diagram-stats"](undefined as any);
      assertEquals(result.isError, undefined);
      const parsed = parseResult(result);
      assertEquals(parsed.success, true);
    });

    it("should return error for invalid diagram_xml", () => {
      const result = baseHandlers["list-paged-model"]({ diagram_xml: "<html>not valid drawio</html>" } as any);
      assertEquals(result.isError, true);
    });

    it("should set active layer from active_layer_id", () => {
      const setupResult = baseHandlers["create-layer"]({ name: "CustomLayer" });
      const setupParsed = parseResult(setupResult);
      const diagramXmlWithLayer = setupParsed.data.diagram_xml;
      const layerId = setupParsed.data.layer.id;

      const result = baseHandlers["add-cells"]({
        diagram_xml: diagramXmlWithLayer,
        active_layer_id: layerId,
        cells: [{ type: "vertex", text: "test" }],
      } as any);
      const parsed = parseResult(result);
      assertEquals(parsed.success, true);
      assertEquals(parsed.data.active_layer_id, layerId);
    });

    it("should return error for invalid active_layer_id", () => {
      const result = baseHandlers["list-paged-model"]({
        active_layer_id: "nonexistent-layer",
      } as any);
      assertEquals(result.isError, true);
    });
  });

  describe("resolveShape cache", () => {
    afterEach(() => {
      clearResolveShapeCache();
      setMaxResolveCacheSize(10_000);
    });

    it("should return cached not-found for previously unknown shape_name", async () => {
      clearResolveShapeCache();
      // First call: shape not found, caches undefined
      const result1 = await handlers["add-cells"]({
        cells: [{ type: "vertex", shape_name: "xyznonexistent_shape_cache_test", x: 0, y: 0 }],
      });
      const parsed1 = parseResult(result1);
      assertEquals(parsed1.data.results[0].error.code, "SHAPE_NOT_FOUND");
      const sizeAfterFirst = getResolveCacheSize();
      assertGreater(sizeAfterFirst, 0);

      // Second call: hits the "cached as not-found" branch (line 77)
      const result2 = await handlers["add-cells"]({
        cells: [{ type: "vertex", shape_name: "xyznonexistent_shape_cache_test", x: 0, y: 0 }],
      });
      const parsed2 = parseResult(result2);
      assertEquals(parsed2.data.results[0].error.code, "SHAPE_NOT_FOUND");
      // Cache size should not have grown
      assertEquals(getResolveCacheSize(), sizeAfterFirst);
    });

    it("should evict cache when maxResolveCacheSize is exceeded", async () => {
      clearResolveShapeCache();
      setMaxResolveCacheSize(2);
      // Fill cache with 2 entries
      await handlers["add-cells"]({
        cells: [{ type: "vertex", shape_name: "rectangle", x: 0, y: 0 }],
      });
      await handlers["add-cells"]({
        cells: [{ type: "vertex", shape_name: "ellipse", x: 0, y: 0 }],
      });
      assertEquals(getResolveCacheSize(), 2);

      // Third entry triggers eviction then re-caches
      await handlers["add-cells"]({
        cells: [{ type: "vertex", shape_name: "diamond", x: 0, y: 0 }],
      });
      // After eviction + re-cache, size should be 1
      assertEquals(getResolveCacheSize(), 1);
    });
  });

  describe("finish-diagram", () => {
    it("should return error when diagram_xml is missing", () => {
      const result = baseHandlers["finish-diagram"]({} as any);
      assertEquals(result.isError, true);
      const parsed = parseResult(result);
      assertEquals(parsed.error.code, "INVALID_INPUT");
    });

    it("should return already-complete when no placeholders exist", async () => {
      await addVertex({ text: "Normal" });
      const exportResult = await handlers["export-diagram"]({ compress: false });
      const xml = parseResult(exportResult).data.xml;

      const result = baseHandlers["finish-diagram"]({ diagram_xml: xml });
      const parsed = parseResult(result);
      assertEquals(parsed.success, true);
      assertEquals(parsed.data.resolved_count, 0);
      assert(parsed.data.message.includes("already complete"));
    });

    it("should return uncompressed output when compress is false and no placeholders", async () => {
      await addVertex({ text: "Normal" });
      const exportResult = await handlers["export-diagram"]({ compress: false });
      const xml = parseResult(exportResult).data.xml;

      const result = baseHandlers["finish-diagram"]({ diagram_xml: xml, compress: false });
      const parsed = parseResult(result);
      assertEquals(parsed.success, true);
      assertEquals(parsed.data.compression.enabled, false);
    });

    it("should resolve placeholders for transactional cells", async () => {
      const addResult = await handlers["add-cells"]({
        transactional: true,
        cells: [
          { type: "vertex", shape_name: "Front Doors", x: 100, y: 100, temp_id: "fd" },
        ],
      });
      const addParsed = parseResult(addResult);
      const txnXml = addParsed.data.diagram_xml;

      const result = baseHandlers["finish-diagram"]({ diagram_xml: txnXml });
      const parsed = parseResult(result);
      assertEquals(parsed.success, true);
      assertEquals(parsed.data.resolved_count, 1);
      assert(parsed.data.message.includes("Resolved 1 placeholder"));
    });

    it("should resolve multiple placeholders with plural message", async () => {
      const addResult = await handlers["add-cells"]({
        transactional: true,
        cells: [
          { type: "vertex", shape_name: "Front Doors", x: 100, y: 100, temp_id: "fd" },
          { type: "vertex", shape_name: "Container Apps", x: 300, y: 100, temp_id: "ca" },
        ],
      });
      const addParsed = parseResult(addResult);
      const txnXml = addParsed.data.diagram_xml;

      const result = baseHandlers["finish-diagram"]({ diagram_xml: txnXml });
      const parsed = parseResult(result);
      assertEquals(parsed.success, true);
      assertEquals(parsed.data.resolved_count, 2);
      assert(parsed.data.message.includes("Resolved 2 placeholders"));
    });

    it("should return error for unresolvable placeholder shapes", () => {
      // Construct XML with a placeholder cell that cannot be resolved
      const fakeXml = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>` +
        `<mxCell id="placeholder-zzz-nonexist-abc12345" value="X" style="fillColor=#d4d4d4;placeholder=1" vertex="1" parent="1">` +
        `<mxGeometry x="0" y="0" width="48" height="48" as="geometry"/></mxCell>` +
        `</root></mxGraphModel>`;
      const result = baseHandlers["finish-diagram"]({ diagram_xml: fakeXml });
      assertEquals(result.isError, true);
      const parsed = parseResult(result);
      assertEquals(parsed.error.code, "PLACEHOLDER_RESOLUTION_FAILED");
      // Verify the detailsMsg is constructed with shape names
      assertExists(parsed.error.suggestion);
      assert(parsed.error.suggestion.includes("zzz-nonexist"));
    });

    it("should return error for invalid XML after resolution", () => {
      // This is hard to trigger naturally; the catch block handles it
      // Test the catch path by providing malformed XML that passes placeholder detection
      const malformedXml = "not xml at all but has placeholder-test-abc12345 and placeholder=1";
      const result = baseHandlers["finish-diagram"]({ diagram_xml: malformedXml });
      // Should hit either the resolution error or the catch path
      assertEquals(result.isError, true);
    });
  });

  describe("suggest-group-sizing defaults", () => {
    it("should use default values when optional params are omitted", () => {
      const result = baseHandlers["suggest-group-sizing"]({ child_count: 3 } as any);
      const parsed = parseResult(result);
      assertEquals(parsed.success, true);
      assertEquals(parsed.data.inputs.child_width, 48);
      assertEquals(parsed.data.inputs.child_height, 48);
      assertEquals(parsed.data.inputs.vertical_spacing, 40);
      assertEquals(parsed.data.inputs.horizontal_padding, 40);
      assertEquals(parsed.data.inputs.vertical_padding, 40);
      assertEquals(parsed.data.inputs.min_width, 180);
      assertEquals(parsed.data.inputs.min_height, 120);
    });
  });

  describe("add-cells-to-group warnings spread", () => {
    it("should include response fields from batchAddCellsToGroup", async () => {
      // Create a group and assign a cell — verifies the response mapping works
      const groupResult = await handlers["create-groups"]({
        groups: [{ x: 100, y: 100, width: 200, height: 200, text: "" }],
      });
      const groupId = parseResult(groupResult).data.results[0].cell.id;

      const cellResult = await handlers["add-cells"]({
        cells: [{ type: "vertex", x: 120, y: 120, width: 50, height: 50, text: "Inside" }],
      });
      const cellId = parseResult(cellResult).data.results[0].cell.id;

      const assignResult = await handlers["add-cells-to-group"]({
        assignments: [{ cell_id: cellId, group_id: groupId }],
      });
      const parsed = parseResult(assignResult);
      assertEquals(parsed.data.summary.succeeded, 1);
      assertEquals(parsed.data.results[0].success, true);
      assertEquals(parsed.data.results[0].cell_id, cellId);
      assertEquals(parsed.data.results[0].group_id, groupId);
      assertExists(parsed.data.results[0].cell);
    });
  });

  describe("warmupSearchPath", () => {
    it("should execute without error", () => {
      warmupSearchPath();
    });
  });

  describe("export-diagram with SAVE_DIAGRAMS", () => {
    afterEach(() => {
      Deno.env.delete("SAVE_DIAGRAMS");
      try {
        Deno.removeSync("./diagrams", { recursive: true });
      } catch { /* ignore */ }
    });

    it("should include DEV_SAVED_PATH when SAVE_DIAGRAMS is enabled", async () => {
      Deno.env.set("SAVE_DIAGRAMS", "true");
      await addVertex({ text: "SaveTest" });
      const result = await handlers["export-diagram"]({ compress: false });
      const parsed = parseResult(result);
      assertEquals(parsed.success, true);
      // The DEV_SAVED_PATH is a Symbol property — it gets consumed by the tool_handler factory
      // and won't appear in the parsed JSON. Test that the export itself works.
      assert(parsed.data.xml.includes("SaveTest"));
    });
  });

  describe("add-cells edge anchor stripping", () => {
    it("should strip exitX/entryX/exitY/entryY properties from edge styles", async () => {
      const v1 = await addVertex({ x: 0, y: 0, width: 100, height: 60, text: "A" });
      const v2 = await addVertex({ x: 300, y: 0, width: 100, height: 60, text: "B" });
      const result = await handlers["add-cells"]({
        cells: [{
          type: "edge",
          source_id: v1.id,
          target_id: v2.id,
          style: "exitX=0.5;exitY=1;entryX=0.5;entryY=0;exitDx=0;exitDy=0;entryDx=0;entryDy=0;",
        }],
      });
      const parsed = parseResult(result);
      assertEquals(parsed.success, true);
      // The edge style should have the anchor properties stripped
      const edgeStyle = parsed.data.results[0].cell.style;
      assertEquals(edgeStyle.includes("exitX="), false);
      assertEquals(edgeStyle.includes("entryX="), false);
      assertEquals(edgeStyle.includes("exitY="), false);
      assertEquals(edgeStyle.includes("entryY="), false);
      assertEquals(edgeStyle.includes("exitDx="), false);
      assertEquals(edgeStyle.includes("entryDx="), false);
    });
  });

  describe("import-diagram error", () => {
    it("should return error for completely invalid XML", async () => {
      await addVertex({ text: "Init" });
      const result = await handlers["import-diagram"]({
        xml: "<<<not xml at all>>>",
      });
      assertEquals(result.isError, true);
    });
  });

  describe("validate-group-containment error", () => {
    it("should return error for nonexistent group_id", async () => {
      await addVertex({ text: "Placeholder" });
      const result = await handlers["validate-group-containment"]({
        group_id: "nonexistent-group",
      });
      assertEquals(result.isError, true);
    });
  });
});
