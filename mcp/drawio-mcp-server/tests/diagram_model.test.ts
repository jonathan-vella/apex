import { beforeEach, describe, it } from "@std/testing/bdd";
import { assert, assertEquals, assertExists, assertGreater, assertMatch, assertNotEquals } from "@std/assert";
import { type Cell, DiagramModel } from "../src/diagram_model.ts";

describe("DiagramModel", () => {
  let model: DiagramModel;

  beforeEach(() => {
    model = new DiagramModel();
  });

  describe("toXml", () => {
    it("should include the default layer in XML output", () => {
      const xml = model.toXml();
      assert(xml.includes('<mxCell id="0"/>'));
      assert(xml.includes('<mxCell id="1" parent="0"/>'));
    });

    it("should include custom layers as mxCell elements in XML output", () => {
      const layer = model.createLayer("Network");
      const xml = model.toXml();
      assert(xml.includes(`<mxCell id="${layer.id}" value="Network" style="" parent="0"/>`));
    });

    it("should include multiple custom layers in XML output", () => {
      const layer1 = model.createLayer("Network");
      const layer2 = model.createLayer("Security");
      const xml = model.toXml();
      assert(xml.includes(`<mxCell id="${layer1.id}" value="Network" style="" parent="0"/>`));
      assert(xml.includes(`<mxCell id="${layer2.id}" value="Security" style="" parent="0"/>`));
    });

    it("should render cells assigned to custom layers with correct parent", () => {
      const layer = model.createLayer("Custom");
      model.setActiveLayer(layer.id);
      const cell = model.addRectangle({ text: "In Custom Layer" });
      const xml = model.toXml();
      assert(xml.includes(`parent="${layer.id}"`));
      assert(xml.includes(`id="${cell.id}"`));
    });

    it("should escape special characters in layer names", () => {
      model.createLayer('Layer <1> & "test"');
      const xml = model.toXml();
      assert(xml.includes("Layer &lt;1&gt; &amp; &quot;test&quot;"));
    });

    it("should escape special XML characters in cell text values", () => {
      model.addRectangle({ text: "<strong>\"Hello\" & 'World'</strong>" });
      const xml = model.toXml();
      assert(xml.includes("&lt;strong&gt;&quot;Hello&quot; &amp; &apos;World&apos;&lt;/strong&gt;"));
    });

    it("should escape special XML characters in cell styles", () => {
      model.addRectangle({ text: "Test", style: 'fillColor=#ff0000;label="<b>bold</b>";' });
      const xml = model.toXml();
      assert(xml.includes("fillColor=#ff0000;label=&quot;&lt;b&gt;bold&lt;/b&gt;&quot;;"));
    });

    it("should produce valid XML with no custom layers", () => {
      model.addRectangle({ text: "Hello" });
      const xml = model.toXml();
      assert(xml.includes('<mxCell id="0"/>'));
      assert(xml.includes('<mxCell id="1" parent="0"/>'));
      assert(xml.includes('value="Hello"'));
    });

    it("should render edges in XML output", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      const edge = model.addEdge({ sourceId: a.id, targetId: b.id, text: "connects" });
      assertEquals("error" in edge, false);
      if (!("error" in edge)) {
        const xml = model.toXml();
        assert(xml.includes(`edge="1"`));
        assert(xml.includes(`source="${a.id}"`));
        assert(xml.includes(`target="${b.id}"`));
        assert(xml.includes(`value="connects"`));
        assert(xml.includes(`<mxGeometry relative="1" as="geometry"/>`));
      }
    });

    it("should emit only one label for duplicate flattened edge lines", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });

      model.addEdge({ sourceId: a.id, targetId: b.id, text: "https" });
      model.addEdge({ sourceId: b.id, targetId: a.id, text: "HTTPS" });

      const xml = model.toXml();
      const httpsLabelMatches = xml.match(/value="https"|value="HTTPS"/g) ?? [];
      assertEquals(httpsLabelMatches.length, 1);
    });

    it("should keep labels when flattened edge label texts differ", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });

      model.addEdge({ sourceId: a.id, targetId: b.id, text: "https" });
      model.addEdge({ sourceId: b.id, targetId: a.id, text: "gRPC" });

      const xml = model.toXml();
      assert(xml.includes('value="https"'));
      assert(xml.includes('value="gRPC"'));
    });

    it("should keep duplicate labels on different flattened edge lines", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      const c = model.addRectangle({ text: "C" });

      model.addEdge({ sourceId: a.id, targetId: b.id, text: "https" });
      model.addEdge({ sourceId: b.id, targetId: c.id, text: "https" });

      const xml = model.toXml();
      const httpsLabelMatches = xml.match(/value="https"/g) ?? [];
      assertEquals(httpsLabelMatches.length, 2);
    });

    it("should offset multiple visible labels on the same flattened edge line", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });

      const edge1 = model.addEdge({ sourceId: a.id, targetId: b.id, text: "https" });
      const edge2 = model.addEdge({ sourceId: b.id, targetId: a.id, text: "gRPC" });
      const edge3 = model.addEdge({ sourceId: a.id, targetId: b.id, text: "tcp" });
      assertEquals("error" in edge1, false);
      assertEquals("error" in edge2, false);
      assertEquals("error" in edge3, false);

      if (!("error" in edge1) && !("error" in edge2) && !("error" in edge3)) {
        const xml = model.toXml();
        const geometryFor = (edgeId: string): string => {
          const match = xml.match(new RegExp(`id=\\"${edgeId}\\"[^>]*><mxGeometry([^>]*)as=\\"geometry\\"`));
          assertExists(match);
          return match![1];
        };

        const geom1 = geometryFor(edge1.id);
        const geom2 = geometryFor(edge2.id);
        const geom3 = geometryFor(edge3.id);

        assertEquals(geom1.includes(' y="'), false);
        assert(geom2.includes(' y="-14"'));
        assert(geom3.includes(' y="14"'));
      }
    });

    it("should not offset labels on different flattened routes", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      const c = model.addRectangle({ text: "C" });

      const edge1 = model.addEdge({ sourceId: a.id, targetId: b.id, text: "https" });
      const edge2 = model.addEdge({ sourceId: b.id, targetId: c.id, text: "gRPC" });
      assertEquals("error" in edge1, false);
      assertEquals("error" in edge2, false);

      if (!("error" in edge1) && !("error" in edge2)) {
        const xml = model.toXml();
        const geometryFor = (edgeId: string): string => {
          const match = xml.match(new RegExp(`id=\\"${edgeId}\\"[^>]*><mxGeometry([^>]*)as=\\"geometry\\"`));
          assertExists(match);
          return match![1];
        };

        const geom1 = geometryFor(edge1.id);
        const geom2 = geometryFor(edge2.id);

        assertEquals(geom1.includes(' y="'), false);
        assertEquals(geom2.includes(' y="'), false);
      }
    });

    it("should apply symmetric side anchors for horizontal edges", () => {
      const left = model.addRectangle({ x: 0, y: 100, width: 100, height: 60, text: "Left" });
      const right = model.addRectangle({ x: 400, y: 100, width: 100, height: 60, text: "Right" });

      const edge = model.addEdge({ sourceId: left.id, targetId: right.id, text: "https" });
      assertEquals("error" in edge, false);
      if (!("error" in edge)) {
        const xml = model.toXml();
        const styleMatch = xml.match(new RegExp(`id=\\"${edge.id}\\"[^>]*style=\\"([^\\"]*)\\"`));
        assertExists(styleMatch);
        if (styleMatch) {
          assert(styleMatch[1].includes("exitX=1;exitY=0.5;entryX=0;entryY=0.5;"));
        }
      }
    });

    it("should apply symmetric top-bottom anchors for vertical edges", () => {
      const top = model.addRectangle({ x: 120, y: 0, width: 100, height: 60, text: "Top" });
      const bottom = model.addRectangle({ x: 120, y: 320, width: 100, height: 60, text: "Bottom" });

      const edge = model.addEdge({ sourceId: top.id, targetId: bottom.id, text: "https" });
      assertEquals("error" in edge, false);
      if (!("error" in edge)) {
        const xml = model.toXml();
        const styleMatch = xml.match(new RegExp(`id=\\"${edge.id}\\"[^>]*style=\\"([^\\"]*)\\"`));
        assertExists(styleMatch);
        if (styleMatch) {
          assert(styleMatch[1].includes("exitX=0.5;exitY=1;entryX=0.5;entryY=0;"));
        }
      }
    });

    it("should preserve explicit edge anchors when provided", () => {
      const a = model.addRectangle({ x: 0, y: 100, width: 100, height: 60, text: "A" });
      const b = model.addRectangle({ x: 400, y: 120, width: 100, height: 60, text: "B" });

      const explicitStyle = "edgeStyle=orthogonalEdgeStyle;html=1;exitX=0.2;exitY=0.3;entryX=0.8;entryY=0.7;";
      const edge = model.addEdge({ sourceId: a.id, targetId: b.id, style: explicitStyle });
      assertEquals("error" in edge, false);
      if (!("error" in edge)) {
        const xml = model.toXml();
        const styleMatch = xml.match(new RegExp(`id=\\"${edge.id}\\"[^>]*style=\\"([^\\"]*)\\"`));
        assertExists(styleMatch);
        if (styleMatch) {
          assert(styleMatch[1].includes("exitX=0.2;exitY=0.3;entryX=0.8;entryY=0.7;"));
          assertEquals(styleMatch[1].includes("exitX=1;exitY=0.5;entryX=0;entryY=0.5;"), false);
        }
      }
    });
  });

  describe("addRectangle", () => {
    it("should create a cell with defaults", () => {
      const cell = model.addRectangle({});
      assertEquals(cell.type, "vertex");
      assertEquals(cell.value, "New Cell");
      assertEquals(cell.width, 200);
      assertEquals(cell.height, 100);
    });

    it("should accept custom dimensions", () => {
      const cell = model.addRectangle({ width: 48, height: 48, text: "Icon" });
      assertEquals(cell.width, 48);
      assertEquals(cell.height, 48);
      assertEquals(cell.value, "Icon");
    });

    it("should clamp negative dimensions to 1", () => {
      const cell = model.addRectangle({ width: -10, height: -5 });
      assertEquals(cell.width, 1);
      assertEquals(cell.height, 1);
    });

    it("should clamp zero dimensions to 1", () => {
      const cell = model.addRectangle({ width: 0, height: 0 });
      assertEquals(cell.width, 1);
      assertEquals(cell.height, 1);
    });
  });

  describe("addEdge", () => {
    it("should error when source does not exist", () => {
      model.addRectangle({ text: "Target" });
      const result = model.addEdge({ sourceId: "nonexistent", targetId: "cell-2" });
      assertEquals("error" in result, true);
    });

    it("should error when target does not exist", () => {
      const a = model.addRectangle({ text: "Source" });
      const result = model.addEdge({ sourceId: a.id, targetId: "nonexistent" });
      assertEquals("error" in result, true);
      if ("error" in result) {
        assertEquals(result.error.code, "TARGET_NOT_FOUND");
      }
    });

    it("should create edge between existing cells", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      const edge = model.addEdge({ sourceId: a.id, targetId: b.id });
      assertEquals("error" in edge, false);
      if (!("error" in edge)) {
        assertEquals(edge.type, "edge");
      }
    });

    it("should create edge with custom text and style", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      const edge = model.addEdge({ sourceId: a.id, targetId: b.id, text: "label", style: "dashed=1;" });
      assertEquals("error" in edge, false);
      if (!("error" in edge)) {
        assertEquals(edge.value, "label");
        assertEquals(edge.style, "dashed=1;");
      }
    });
  });

  describe("editCell", () => {
    it("should return error for non-existent cell", () => {
      const result = model.editCell("nonexistent", { text: "X" });
      assertEquals("error" in result, true);
      if ("error" in result) {
        assertEquals(result.error.code, "CELL_NOT_FOUND");
      }
    });

    it("should return error when editing an edge as a vertex", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      const edge = model.addEdge({ sourceId: a.id, targetId: b.id });
      assertEquals("error" in edge, false);
      if (!("error" in edge)) {
        const result = model.editCell(edge.id, { text: "X" });
        assertEquals("error" in result, true);
        if ("error" in result) {
          assertEquals(result.error.code, "WRONG_CELL_TYPE");
        }
      }
    });

    it("should update all specified properties", () => {
      const cell = model.addRectangle({ text: "Original" });
      const result = model.editCell(cell.id, {
        text: "Updated",
        x: 500,
        y: 600,
        width: 300,
        height: 200,
        style: "fillColor=#ff0000;",
      });
      assertEquals("error" in result, false);
      if (!("error" in result)) {
        assertEquals(result.value, "Updated");
        assertEquals(result.x, 500);
        assertEquals(result.y, 600);
        assertEquals(result.width, 300);
        assertEquals(result.height, 200);
        assertEquals(result.style, "fillColor=#ff0000;");
      }
    });
  });

  describe("editEdge", () => {
    it("should return error for non-existent edge", () => {
      const result = model.editEdge("nonexistent", { text: "X" });
      assertEquals("error" in result, true);
      if ("error" in result) {
        assertEquals(result.error.code, "CELL_NOT_FOUND");
      }
    });

    it("should return error when editing a vertex as an edge", () => {
      const cell = model.addRectangle({ text: "A" });
      const result = model.editEdge(cell.id, { text: "X" });
      assertEquals("error" in result, true);
      if ("error" in result) {
        assertEquals(result.error.code, "WRONG_CELL_TYPE");
      }
    });

    it("should return error when reassigning to non-existent source", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      const edge = model.addEdge({ sourceId: a.id, targetId: b.id });
      assertEquals("error" in edge, false);
      if (!("error" in edge)) {
        const result = model.editEdge(edge.id, { sourceId: "nonexistent" });
        assertEquals("error" in result, true);
        if ("error" in result) {
          assertEquals(result.error.code, "SOURCE_NOT_FOUND");
        }
      }
    });

    it("should return error when reassigning to non-existent target", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      const edge = model.addEdge({ sourceId: a.id, targetId: b.id });
      assertEquals("error" in edge, false);
      if (!("error" in edge)) {
        const result = model.editEdge(edge.id, { targetId: "nonexistent" });
        assertEquals("error" in result, true);
        if ("error" in result) {
          assertEquals(result.error.code, "TARGET_NOT_FOUND");
        }
      }
    });

    it("should update edge text, source, target, and style", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      const c = model.addRectangle({ text: "C" });
      const edge = model.addEdge({ sourceId: a.id, targetId: b.id, text: "old" });
      assertEquals("error" in edge, false);
      if (!("error" in edge)) {
        const result = model.editEdge(edge.id, {
          text: "new",
          sourceId: c.id,
          style: "dashed=1;",
        });
        assertEquals("error" in result, false);
        if (!("error" in result)) {
          assertEquals(result.value, "new");
          assertEquals(result.sourceId, c.id);
          assertEquals(result.style, "dashed=1;");
        }
      }
    });

    it("should update edge target to valid cell", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      const c = model.addRectangle({ text: "C" });
      const edge = model.addEdge({ sourceId: a.id, targetId: b.id });
      assertEquals("error" in edge, false);
      if (!("error" in edge)) {
        const result = model.editEdge(edge.id, { targetId: c.id });
        assertEquals("error" in result, false);
        if (!("error" in result)) {
          assertEquals(result.targetId, c.id);
        }
      }
    });

    it("should reassign both source and target simultaneously", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      const c = model.addRectangle({ text: "C" });
      const d = model.addRectangle({ text: "D" });
      const edge = model.addEdge({ sourceId: a.id, targetId: b.id });
      assertEquals("error" in edge, false);
      if (!("error" in edge)) {
        const result = model.editEdge(edge.id, { sourceId: c.id, targetId: d.id });
        assertEquals("error" in result, false);
        if (!("error" in result)) {
          assertEquals(result.sourceId, c.id);
          assertEquals(result.targetId, d.id);
        }
      }
    });

    it("should partially update source when target is invalid", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      const c = model.addRectangle({ text: "C" });
      const edge = model.addEdge({ sourceId: a.id, targetId: b.id });
      assertEquals("error" in edge, false);
      if (!("error" in edge)) {
        const result = model.editEdge(edge.id, { sourceId: c.id, targetId: "nonexistent" });
        assertEquals("error" in result, true);
        if ("error" in result) {
          assertEquals(result.error.code, "TARGET_NOT_FOUND");
        }
        // Source was already mutated before the target check
        const updated = model.getCell(edge.id);
        assertEquals(updated?.sourceId, c.id);
      }
    });
  });

  describe("getCell", () => {
    it("should return a vertex by ID", () => {
      const cell = model.addRectangle({ text: "Hello" });
      const found = model.getCell(cell.id);
      assertExists(found);
      assertEquals(found!.value, "Hello");
      assertEquals(found!.type, "vertex");
    });

    it("should return undefined for non-existent ID", () => {
      assertEquals(model.getCell("nonexistent"), undefined);
    });

    it("should return an edge by ID", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      const edge = model.addEdge({ sourceId: a.id, targetId: b.id });
      if (!("error" in edge)) {
        const found = model.getCell(edge.id);
        assertExists(found);
        assertEquals(found!.type, "edge");
        assertEquals(found!.sourceId, a.id);
        assertEquals(found!.targetId, b.id);
      }
    });
  });

  describe("moveCellToLayer", () => {
    it("should return error for non-existent cell", () => {
      const layer = model.createLayer("L");
      const result = model.moveCellToLayer("nonexistent", layer.id);
      assertEquals("error" in result, true);
    });

    it("should return error for non-existent layer", () => {
      const cell = model.addRectangle({ text: "A" });
      const result = model.moveCellToLayer(cell.id, "nonexistent");
      assertEquals("error" in result, true);
    });
  });

  describe("setActiveLayer", () => {
    it("should return error for non-existent layer", () => {
      const result = model.setActiveLayer("nonexistent");
      assertEquals("error" in result, true);
    });
  });

  describe("batchAddCells", () => {
    it("should resolve temp IDs for edges within the batch", () => {
      const results = model.batchAddCells([
        { type: "vertex", text: "A", tempId: "tmp-a" },
        { type: "vertex", text: "B", tempId: "tmp-b" },
        { type: "edge", sourceId: "tmp-a", targetId: "tmp-b" },
      ]);
      assertEquals(results.length, 3);
      assertEquals(results[0].success, true);
      assertEquals(results[1].success, true);
      assertEquals(results[2].success, true);
    });

    it("should fail validation for edges with invalid source", () => {
      const results = model.batchAddCells([
        { type: "edge", sourceId: "nonexistent", targetId: "also-nonexistent" },
      ]);
      assertGreater(results.length, 0);
      assertEquals(results[0].success, false);
    });

    it("should fail validation for edges with invalid target", () => {
      const results = model.batchAddCells([
        { type: "vertex", text: "A", tempId: "tmp-a" },
        { type: "edge", sourceId: "tmp-a", targetId: "nonexistent" },
      ]);
      assertGreater(results.length, 0);
      assert(results.some((r) => !r.success));
    });

    it("should support dry run mode", () => {
      const results = model.batchAddCells(
        [{ type: "vertex", text: "DryRun" }],
        { dryRun: true },
      );
      assertEquals(results.length, 1);
      assertEquals(results[0].success, true);
      // Should not have persisted
      assertEquals(model.listCells().length, 0);
    });

    it("should support dry run with no text provided", () => {
      const results = model.batchAddCells(
        [{ type: "vertex" }],
        { dryRun: true },
      );
      assertEquals(results.length, 1);
      assertEquals(results[0].success, true);
      assertEquals(results[0].cell?.value, "");
    });

    it("should return INVALID_SOURCE with tempId when edge has bad source", () => {
      const results = model.batchAddCells([
        { type: "edge", sourceId: "bad-src", targetId: "bad-tgt", tempId: "edge-1" },
      ]);
      assert(results.length >= 1);
      const sourceErr = results.find((r) => !r.success && r.error?.code === "INVALID_SOURCE");
      assertExists(sourceErr);
      assertEquals(sourceErr!.tempId, "edge-1");
    });

    it("should succeed with edge that has no tempId", () => {
      const results = model.batchAddCells([
        { type: "vertex", text: "A", tempId: "tmp-a" },
        { type: "vertex", text: "B", tempId: "tmp-b" },
        { type: "edge", sourceId: "tmp-a", targetId: "tmp-b" },
      ]);
      assertEquals(results.length, 3);
      assertEquals(results[2].success, true);
      assertEquals(results[2].tempId, undefined);
    });

    it("should succeed with vertex that has no tempId", () => {
      const results = model.batchAddCells([
        { type: "vertex", text: "No TempId" },
      ]);
      assertEquals(results.length, 1);
      assertEquals(results[0].success, true);
      assertEquals(results[0].tempId, undefined);
    });

    it("should reference existing diagram cells in batch edges", () => {
      const existing = model.addRectangle({ text: "Existing" });
      const results = model.batchAddCells([
        { type: "vertex", text: "New", tempId: "tmp-new" },
        { type: "edge", sourceId: existing.id, targetId: "tmp-new" },
      ]);
      assertEquals(results.length, 2);
      assertEquals(results[1].success, true);
    });

    it("should allow an edge to reference another edge via tempId", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      const results = model.batchAddCells([
        { type: "edge", sourceId: a.id, targetId: b.id, tempId: "edge-1" },
        { type: "edge", sourceId: a.id, targetId: "edge-1" },
      ]);
      assertEquals(results.length, 2);
      assertEquals(results[0].success, true);
      assertEquals(results[1].success, true);
    });
  });

  describe("batchEditCells", () => {
    it("should edit multiple cells", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      const results = model.batchEditCells([
        { cell_id: a.id, text: "Updated A" },
        { cell_id: b.id, x: 999 },
      ]);
      assertEquals(results.length, 2);
      assertEquals(results[0].success, true);
      assertEquals(results[1].success, true);
    });

    it("should report errors for non-existent cells", () => {
      const results = model.batchEditCells([
        { cell_id: "nonexistent", text: "X" },
      ]);
      assertEquals(results[0].success, false);
    });
  });

  describe("clear", () => {
    it("should remove all cells", () => {
      model.addRectangle({ text: "A" });
      model.addRectangle({ text: "B" });
      assertEquals(model.listCells().length, 2);
      model.clear();
      assertEquals(model.listCells().length, 0);
    });

    it("should reset nextId so new cells start from cell-2", () => {
      model.addRectangle({ text: "A" }); // cell-2
      model.addRectangle({ text: "B" }); // cell-3
      model.clear();
      const cell = model.addRectangle({ text: "C" });
      assertEquals(cell.id, "cell-2");
    });

    it("should reset layers to defaults", () => {
      const layer = model.createLayer("Custom");
      model.setActiveLayer(layer.id);
      model.addRectangle({ text: "A" });
      model.clear();

      // Layers reset to just the default layer
      assertEquals(model.listLayers().length, 1);
      assertEquals(model.getActiveLayer().id, "1");
      // New cells are parented to the default layer
      const cell = model.addRectangle({ text: "B" });
      assertEquals(cell.parent, "1");
    });
  });

  describe("listCells", () => {
    it("should return all cells without filter", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      model.addEdge({ sourceId: a.id, targetId: b.id });
      assertEquals(model.listCells().length, 3);
    });

    it("should filter by vertex type", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      model.addEdge({ sourceId: a.id, targetId: b.id });
      const vertices = model.listCells({ cellType: "vertex" });
      assertEquals(vertices.length, 2);
      assertEquals(vertices.every((c) => c.type === "vertex"), true);
    });

    it("should filter by edge type", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      model.addEdge({ sourceId: a.id, targetId: b.id });
      const edges = model.listCells({ cellType: "edge" });
      assertEquals(edges.length, 1);
      assertEquals(edges[0].type, "edge");
    });
  });

  describe("deleteCell", () => {
    it("should return deleted false for non-existent cell", () => {
      assertEquals(model.deleteCell("does-not-exist").deleted, false);
    });

    it("should delete a vertex", () => {
      const cell = model.addRectangle({ text: "A" });
      const result = model.deleteCell(cell.id);
      assertEquals(result.deleted, true);
      assertEquals(result.cascadedEdgeIds.length, 0);
      assertEquals(model.getCell(cell.id), undefined);
    });

    it("should cascade-delete edges when a vertex is deleted", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      const c = model.addRectangle({ text: "C" });
      const edgeAB = model.addEdge({ sourceId: a.id, targetId: b.id });
      const edgeBC = model.addEdge({ sourceId: b.id, targetId: c.id });
      assertEquals("error" in edgeAB, false);
      assertEquals("error" in edgeBC, false);

      // Delete B — should remove both edges connected to B
      const result = model.deleteCell(b.id);
      assertEquals(result.deleted, true);
      assertEquals(result.cascadedEdgeIds.length, 2);
      assertEquals(model.getCell(b.id), undefined);
      if (!("error" in edgeAB)) {
        assertEquals(model.getCell(edgeAB.id), undefined);
      }
      if (!("error" in edgeBC)) {
        assertEquals(model.getCell(edgeBC.id), undefined);
      }
      // A and C should remain
      assertExists(model.getCell(a.id));
      assertExists(model.getCell(c.id));
    });

    it("should not cascade-delete when deleting an edge", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      const edge = model.addEdge({ sourceId: a.id, targetId: b.id });
      assertEquals("error" in edge, false);

      if (!("error" in edge)) {
        model.deleteCell(edge.id);
        assertEquals(model.getCell(edge.id), undefined);
        // Vertices should still exist
        assertExists(model.getCell(a.id));
        assertExists(model.getCell(b.id));
      }
    });

    it("should cascade based on updated edge source after edit", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      const c = model.addRectangle({ text: "C" });
      const edge = model.addEdge({ sourceId: a.id, targetId: b.id });
      assertEquals("error" in edge, false);

      if (!("error" in edge)) {
        const editResult = model.editEdge(edge.id, { sourceId: c.id });
        assertEquals("error" in editResult, false);

        const deleteOriginalSource = model.deleteCell(a.id);
        assertEquals(deleteOriginalSource.deleted, true);
        assertEquals(deleteOriginalSource.cascadedEdgeIds.length, 0);
        assertExists(model.getCell(edge.id));

        const deleteNewSource = model.deleteCell(c.id);
        assertEquals(deleteNewSource.deleted, true);
        assertEquals(deleteNewSource.cascadedEdgeIds.length, 1);
        assertEquals(deleteNewSource.cascadedEdgeIds[0], edge.id);
        assertEquals(model.getCell(edge.id), undefined);
      }
    });

    it("should cascade correctly after import rebuilds edge index", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      const edge = model.addEdge({ sourceId: a.id, targetId: b.id });
      assertEquals("error" in edge, false);

      const exported = model.toXml();
      const imported = new DiagramModel();
      const importResult = imported.importXml(exported);
      assertEquals("error" in importResult, false);

      const deleteResult = imported.deleteCell(a.id);
      assertEquals(deleteResult.deleted, true);
      assertEquals(deleteResult.cascadedEdgeIds.length, 1);
      if (!("error" in edge)) {
        assertEquals(deleteResult.cascadedEdgeIds[0], edge.id);
      }
    });
  });

  describe("getStats", () => {
    it("should return correct stats for empty diagram", () => {
      const stats = model.getStats();
      assertEquals(stats.total_cells, 0);
      assertEquals(stats.vertices, 0);
      assertEquals(stats.edges, 0);
      assertEquals(stats.layers, 1); // Default layer
      assertEquals(stats.bounds, null);
      assertEquals(stats.cells_with_text, 0);
      assertEquals(stats.cells_without_text, 0);
    });

    it("should return correct stats for diagram with cells", () => {
      model.addRectangle({ text: "A", x: 100, y: 100, width: 200, height: 100 });
      model.addRectangle({ text: "B", x: 400, y: 200, width: 150, height: 80 });
      model.addRectangle({ text: "", x: 50, y: 50, width: 100, height: 100 }); // No text

      const stats = model.getStats();
      assertEquals(stats.total_cells, 3);
      assertEquals(stats.vertices, 3);
      assertEquals(stats.edges, 0);
      assertEquals(stats.cells_with_text, 2);
      assertEquals(stats.cells_without_text, 1);
      assertEquals(stats.bounds, {
        minX: 50,
        minY: 50,
        maxX: 550, // 400 + 150
        maxY: 280, // 200 + 80
      });
    });

    it("should count edges correctly", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      model.addEdge({ sourceId: a.id, targetId: b.id, text: "connects" });

      const stats = model.getStats();
      assertEquals(stats.total_cells, 3);
      assertEquals(stats.vertices, 2);
      assertEquals(stats.edges, 1);
      assertEquals(stats.cells_with_text, 3);
    });

    it("should track cells by layer", () => {
      const layer1 = model.createLayer("Network");
      const layer2 = model.createLayer("Security");

      model.addRectangle({ text: "Default" }); // Added to default layer

      model.setActiveLayer(layer1.id);
      model.addRectangle({ text: "Net1" });
      model.addRectangle({ text: "Net2" });

      model.setActiveLayer(layer2.id);
      model.addRectangle({ text: "Sec1" });

      const stats = model.getStats();
      assertEquals(stats.total_cells, 4);
      assertEquals(stats.layers, 3);
      assertEquals(stats.cells_by_layer["1"], 1); // Default layer
      assertEquals(stats.cells_by_layer[layer1.id], 2);
      assertEquals(stats.cells_by_layer[layer2.id], 1);
    });

    it("should return null bounds when vertices have no position", () => {
      // addRectangle always sets x/y, but default is 0,0
      // Vertices with x=0 y=0 still count as positioned (filter checks !== undefined)
      model.addRectangle({ text: "A" });
      const stats = model.getStats();
      assertNotEquals(stats.bounds, null);
    });

    it("should return cached stats on second call", () => {
      model.addRectangle({ text: "A" });
      const stats1 = model.getStats();
      const stats2 = model.getStats();
      assertEquals(stats1.total_cells, stats2.total_cells);
      assertEquals(stats1.vertices, stats2.vertices);
    });
  });

  describe("clear with edges", () => {
    it("should count edges in clear result", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      model.addEdge({ sourceId: a.id, targetId: b.id });
      const result = model.clear();
      assertEquals(result.vertices, 2);
      assertEquals(result.edges, 1);
    });
  });

  describe("symmetric edge anchors", () => {
    it("should apply left-facing anchors when source is right of target", () => {
      const right = model.addRectangle({ x: 400, y: 100, width: 100, height: 60, text: "Right" });
      const left = model.addRectangle({ x: 0, y: 100, width: 100, height: 60, text: "Left" });
      const edge = model.addEdge({ sourceId: right.id, targetId: left.id });
      assertEquals("error" in edge, false);
      if (!("error" in edge)) {
        const xml = model.toXml();
        const styleMatch = xml.match(new RegExp(`id=\\"${edge.id}\\"[^>]*style=\\"([^\\"]*)\\"`));
        assertExists(styleMatch);
        assert(styleMatch![1].includes("exitX=0;exitY=0.5;entryX=1;entryY=0.5;"));
      }
    });

    it("should apply bottom-to-top anchors when source is below target", () => {
      const bottom = model.addRectangle({ x: 120, y: 320, width: 100, height: 60, text: "Bottom" });
      const top = model.addRectangle({ x: 120, y: 0, width: 100, height: 60, text: "Top" });
      const edge = model.addEdge({ sourceId: bottom.id, targetId: top.id });
      assertEquals("error" in edge, false);
      if (!("error" in edge)) {
        const xml = model.toXml();
        const styleMatch = xml.match(new RegExp(`id=\\"${edge.id}\\"[^>]*style=\\"([^\\"]*)\\"`));
        assertExists(styleMatch);
        assert(styleMatch![1].includes("exitX=0.5;exitY=0;entryX=0.5;entryY=1;"));
      }
    });

    it("should add semicolon terminator to style strings missing trailing semicolon", () => {
      const left = model.addRectangle({ x: 0, y: 100, width: 100, height: 60, text: "Left" });
      const right = model.addRectangle({ x: 400, y: 100, width: 100, height: 60, text: "Right" });
      const edge = model.addEdge({ sourceId: left.id, targetId: right.id, style: "html=1" });
      assertEquals("error" in edge, false);
      if (!("error" in edge)) {
        const xml = model.toXml();
        const styleMatch = xml.match(new RegExp(`id=\\"${edge.id}\\"[^>]*style=\\"([^\\"]*)\\"`));
        assertExists(styleMatch);
        // Should have a semicolon between the original style and the anchor suffix
        assert(styleMatch![1].startsWith("html=1;exitX="));
      }
    });
  });

  describe("group-aligned edge anchors", () => {
    it("should align entryY to source center when target is a group (horizontal flow)", () => {
      // Source vertex at y=100..160 (center y=130).
      // Target group at y=50..350 (height=300, center y=200).
      // Expected entryY = (130 - 50) / 300 = 0.27
      const group = model.createGroup({ x: 400, y: 50, width: 200, height: 300, text: "Group" });
      const source = model.addRectangle({ x: 0, y: 100, width: 100, height: 60, text: "Source" });
      const edge = model.addEdge({ sourceId: source.id, targetId: group.id });
      assertEquals("error" in edge, false);
      if (!("error" in edge)) {
        const xml = model.toXml();
        const styleMatch = xml.match(new RegExp(`id=\\"${edge.id}\\"[^>]*style=\\"([^\\"]*)\\"`));
        assertExists(styleMatch);
        assert(styleMatch![1].includes("exitX=1;exitY=0.5;"));
        assert(styleMatch![1].includes("entryX=0;entryY=0.27;"));
      }
    });

    it("should align exitY to target center when source is a group (horizontal flow)", () => {
      // Source group at y=50..350 (height=300, center y=200).
      // Target vertex at y=100..160 (center y=130).
      // Expected exitY = (130 - 50) / 300 = 0.27
      const group = model.createGroup({ x: 0, y: 50, width: 200, height: 300, text: "Group" });
      const target = model.addRectangle({ x: 400, y: 100, width: 100, height: 60, text: "Target" });
      const edge = model.addEdge({ sourceId: group.id, targetId: target.id });
      assertEquals("error" in edge, false);
      if (!("error" in edge)) {
        const xml = model.toXml();
        const styleMatch = xml.match(new RegExp(`id=\\"${edge.id}\\"[^>]*style=\\"([^\\"]*)\\"`));
        assertExists(styleMatch);
        assert(styleMatch![1].includes("exitX=1;exitY=0.27;"));
        assert(styleMatch![1].includes("entryX=0;entryY=0.5;"));
      }
    });

    it("should use midpoint Y for group-to-group horizontal edges", () => {
      // Source group: y=0..200 (center y=100). Target group: y=100..400 (center y=250).
      // midY = (100+250)/2 = 175. exitY = (175-0)/200 = 0.88. entryY = (175-100)/300 = 0.25.
      const srcGroup = model.createGroup({ x: 0, y: 0, width: 200, height: 200, text: "SrcGroup" });
      const tgtGroup = model.createGroup({ x: 400, y: 100, width: 200, height: 300, text: "TgtGroup" });
      const edge = model.addEdge({ sourceId: srcGroup.id, targetId: tgtGroup.id });
      assertEquals("error" in edge, false);
      if (!("error" in edge)) {
        const xml = model.toXml();
        const styleMatch = xml.match(new RegExp(`id=\\"${edge.id}\\"[^>]*style=\\"([^\\"]*)\\"`));
        assertExists(styleMatch);
        assert(styleMatch![1].includes("exitY=0.88;"));
        assert(styleMatch![1].includes("entryY=0.25;"));
      }
    });

    it("should not add waypoints for edges targeting a group", () => {
      const group = model.createGroup({ x: 400, y: 50, width: 200, height: 300, text: "Group" });
      const source = model.addRectangle({ x: 0, y: 100, width: 100, height: 60, text: "Source" });
      model.addEdge({ sourceId: source.id, targetId: group.id });
      const xml = model.toXml();
      // No <Array as="points"> for this edge — straight line with aligned anchors
      assert(!xml.match(new RegExp(`source=\\"${source.id}\\"[^>]*>.*?<Array`, "s")));
    });

    it("should clamp anchor to 0.05 when source is near top of target group", () => {
      // Source center above group top → anchor clamped to 0.05
      const group = model.createGroup({ x: 400, y: 200, width: 200, height: 300, text: "Group" });
      const source = model.addRectangle({ x: 0, y: 170, width: 100, height: 60, text: "Source" });
      const edge = model.addEdge({ sourceId: source.id, targetId: group.id });
      assertEquals("error" in edge, false);
      if (!("error" in edge)) {
        const xml = model.toXml();
        const styleMatch = xml.match(new RegExp(`id=\\"${edge.id}\\"[^>]*style=\\"([^\\"]*)\\"`));
        assertExists(styleMatch);
        // sourceCenter.y=200, groupTop=200 → (200-200)/300 = 0 → clamped to 0.05
        assert(styleMatch![1].includes("entryY=0.05;"));
      }
    });

    it("should align entryX to source center when target is a group (vertical flow)", () => {
      // Source vertex at x=100..200 (center x=150).
      // Target group at x=50..350 (width=300, center x=200).
      // Expected entryX = (150 - 50) / 300 = 0.33
      const group = model.createGroup({ x: 50, y: 400, width: 300, height: 200, text: "Group" });
      const source = model.addRectangle({ x: 100, y: 0, width: 100, height: 60, text: "Source" });
      const edge = model.addEdge({ sourceId: source.id, targetId: group.id });
      assertEquals("error" in edge, false);
      if (!("error" in edge)) {
        const xml = model.toXml();
        const styleMatch = xml.match(new RegExp(`id=\\"${edge.id}\\"[^>]*style=\\"([^\\"]*)\\"`));
        assertExists(styleMatch);
        assert(styleMatch![1].includes("exitX=0.5;exitY=1;"));
        assert(styleMatch![1].includes("entryX=0.33;entryY=0;"));
      }
    });

    it("should keep 0.5 anchors for non-group vertices", () => {
      // Both are normal vertices → standard 0.5 anchors
      const left = model.addRectangle({ x: 0, y: 100, width: 100, height: 60, text: "Left" });
      const right = model.addRectangle({ x: 400, y: 200, width: 100, height: 60, text: "Right" });
      const edge = model.addEdge({ sourceId: left.id, targetId: right.id });
      assertEquals("error" in edge, false);
      if (!("error" in edge)) {
        const xml = model.toXml();
        const styleMatch = xml.match(new RegExp(`id=\\"${edge.id}\\"[^>]*style=\\"([^\\"]*)\\"`));
        assertExists(styleMatch);
        assert(styleMatch![1].includes("exitX=1;exitY=0.5;entryX=0;entryY=0.5;"));
      }
    });
  });

  describe("group avoidance routing", () => {
    it("should route below group when nodes are below group center", () => {
      // Edge must cross through group. Position nodes on either side, with y below group center.
      // Group at (200, 100, 260, 200) → center y=200. Nodes at y=250 → mid y=280 > 200 → route below.
      model.createGroup({ x: 200, y: 100, width: 260, height: 200, text: "Container" });
      const left = model.addRectangle({ x: 20, y: 250, width: 100, height: 60, text: "Left" });
      const right = model.addRectangle({ x: 560, y: 250, width: 100, height: 60, text: "Right" });
      const edge = model.addEdge({ sourceId: left.id, targetId: right.id });
      assertEquals("error" in edge, false);
      if (!("error" in edge)) {
        const xml = model.toXml();
        // The waypoint should appear as an mxPoint in the edge geometry
        assert(xml.includes(`id="${edge.id}"`));
        const pointMatch = xml.match(/mxPoint x="[\d.]+" y="([\d.]+)"/);
        assertExists(pointMatch);
        if (pointMatch) {
          const waypointY = parseFloat(pointMatch[1]);
          // Route below group: groupBottom (300) + margin (30) = 330
          assertEquals(waypointY, 330);
        }
      }
    });

    it("should route through gap channel when source is left of group and target is below", () => {
      // Source left of group, target below group → vertical channel in the gap.
      // Group at (320, 80, 250, 380). Source at (80, 240, 65, 68), sourceRight=145.
      // Target at (413, 550, 65, 68), targetCenter.y=584 > groupBottom+margin (460+30=490).
      // Channel X = 145 + (320 - 145) / 2 = 232.5
      model.createGroup({ x: 320, y: 80, width: 250, height: 380, text: "Container" });
      const source = model.addRectangle({ x: 80, y: 240, width: 65, height: 68, text: "Source" });
      const target = model.addRectangle({ x: 413, y: 550, width: 65, height: 68, text: "Target" });
      const edge = model.addEdge({ sourceId: source.id, targetId: target.id });
      assertEquals("error" in edge, false);
      if (!("error" in edge)) {
        const xml = model.toXml();
        const pointsMatch = xml.match(
          new RegExp(`id="${edge.id}"[^>]*>.*?<Array as="points">(.*?)</Array>`, "s"),
        );
        assertExists(pointsMatch);
        // Channel at x=232.5, waypoints at sourceCenter.y=274 and targetCenter.y=584
        assert(pointsMatch![1].includes('x="232.5"'));
        assert(pointsMatch![1].includes('y="274"'));
        assert(pointsMatch![1].includes('y="584"'));
      }
    });

    it("should route through gap channel when source is left of group and target is above", () => {
      // Source left of group, target above group.
      // Group at (320, 200, 250, 300). Source at (80, 300, 65, 68), sourceRight=145.
      // Target at (413, 20, 65, 68), targetCenter.y=54 < groupTop-margin (200-30=170).
      // Channel X = 145 + (320 - 145) / 2 = 232.5
      model.createGroup({ x: 320, y: 200, width: 250, height: 300, text: "Container" });
      const source = model.addRectangle({ x: 80, y: 300, width: 65, height: 68, text: "Source" });
      const target = model.addRectangle({ x: 413, y: 20, width: 65, height: 68, text: "Target" });
      const edge = model.addEdge({ sourceId: source.id, targetId: target.id });
      assertEquals("error" in edge, false);
      if (!("error" in edge)) {
        const xml = model.toXml();
        const pointsMatch = xml.match(
          new RegExp(`id="${edge.id}"[^>]*>.*?<Array as="points">(.*?)</Array>`, "s"),
        );
        assertExists(pointsMatch);
        // Channel at x=232.5, waypoints at sourceCenter.y=334 and targetCenter.y=54
        assert(pointsMatch![1].includes('x="232.5"'));
        assert(pointsMatch![1].includes('y="334"'));
        assert(pointsMatch![1].includes('y="54"'));
      }
    });

    it("should route through gap channel when source is right of group and target is below", () => {
      // Group at (100, 80, 200, 300). Source at (400, 150, 80, 60), sourceBounds.x=400 > groupRight=300.
      // Target at (150, 470, 80, 60), targetCenter.y=500 > groupBottom+margin (380+30=410).
      // Channel X = 300 + (400 - 300) / 2 = 350
      model.createGroup({ x: 100, y: 80, width: 200, height: 300, text: "Container" });
      const source = model.addRectangle({ x: 400, y: 150, width: 80, height: 60, text: "Source" });
      const target = model.addRectangle({ x: 150, y: 470, width: 80, height: 60, text: "Target" });
      const edge = model.addEdge({ sourceId: source.id, targetId: target.id });
      assertEquals("error" in edge, false);
      if (!("error" in edge)) {
        const xml = model.toXml();
        const pointsMatch = xml.match(
          new RegExp(`id="${edge.id}"[^>]*>.*?<Array as="points">(.*?)</Array>`, "s"),
        );
        assertExists(pointsMatch);
        // Channel at x=350, waypoints at sourceCenter.y=180 and targetCenter.y=500
        assert(pointsMatch![1].includes('x="350"'));
        assert(pointsMatch![1].includes('y="180"'));
        assert(pointsMatch![1].includes('y="500"'));
      }
    });

    it("should route through gap channel when source is right of group and target is above", () => {
      // Group at (100, 200, 200, 300). Source at (400, 300, 80, 60), sourceBounds.x=400 > groupRight=300.
      // Target at (150, 20, 80, 60), targetCenter.y=50 < groupTop-margin (200-30=170).
      // Channel X = 300 + (400 - 300) / 2 = 350
      model.createGroup({ x: 100, y: 200, width: 200, height: 300, text: "Container" });
      const source = model.addRectangle({ x: 400, y: 300, width: 80, height: 60, text: "Source" });
      const target = model.addRectangle({ x: 150, y: 20, width: 80, height: 60, text: "Target" });
      const edge = model.addEdge({ sourceId: source.id, targetId: target.id });
      assertEquals("error" in edge, false);
      if (!("error" in edge)) {
        const xml = model.toXml();
        const pointsMatch = xml.match(
          new RegExp(`id="${edge.id}"[^>]*>.*?<Array as="points">(.*?)</Array>`, "s"),
        );
        assertExists(pointsMatch);
        // Channel at x=350, waypoints at sourceCenter.y=330 and targetCenter.y=50
        assert(pointsMatch![1].includes('x="350"'));
        assert(pointsMatch![1].includes('y="330"'));
        assert(pointsMatch![1].includes('y="50"'));
      }
    });

    it("should route through gap channel when source is above group and target is to the right", () => {
      // Group at (200, 200, 200, 200). Source at (250, 20, 80, 60), sourceBottom=80 < groupTop=200.
      // Target at (500, 280, 80, 60), targetCenter.x=540 > groupRight+margin (400+30=430).
      // Channel Y = 80 + (200 - 80) / 2 = 140
      model.createGroup({ x: 200, y: 200, width: 200, height: 200, text: "Container" });
      const source = model.addRectangle({ x: 250, y: 20, width: 80, height: 60, text: "Source" });
      const target = model.addRectangle({ x: 500, y: 280, width: 80, height: 60, text: "Target" });
      const edge = model.addEdge({ sourceId: source.id, targetId: target.id });
      assertEquals("error" in edge, false);
      if (!("error" in edge)) {
        const xml = model.toXml();
        const pointsMatch = xml.match(
          new RegExp(`id="${edge.id}"[^>]*>.*?<Array as="points">(.*?)</Array>`, "s"),
        );
        assertExists(pointsMatch);
        // Channel at y=140, waypoints at sourceCenter.x=290 and targetCenter.x=540
        assert(pointsMatch![1].includes('y="140"'));
        assert(pointsMatch![1].includes('x="290"'));
        assert(pointsMatch![1].includes('x="540"'));
      }
    });

    it("should route through gap channel when source is above group and target is to the left", () => {
      // Group at (200, 200, 200, 200). Source at (250, 20, 80, 60), sourceBottom=80 < groupTop=200.
      // Target at (20, 280, 80, 60), targetCenter.x=60 < groupLeft-margin (200-30=170).
      // Channel Y = 80 + (200 - 80) / 2 = 140
      model.createGroup({ x: 200, y: 200, width: 200, height: 200, text: "Container" });
      const source = model.addRectangle({ x: 250, y: 20, width: 80, height: 60, text: "Source" });
      const target = model.addRectangle({ x: 20, y: 280, width: 80, height: 60, text: "Target" });
      const edge = model.addEdge({ sourceId: source.id, targetId: target.id });
      assertEquals("error" in edge, false);
      if (!("error" in edge)) {
        const xml = model.toXml();
        const pointsMatch = xml.match(
          new RegExp(`id="${edge.id}"[^>]*>.*?<Array as="points">(.*?)</Array>`, "s"),
        );
        assertExists(pointsMatch);
        // Channel at y=140, waypoints at sourceCenter.x=290 and targetCenter.x=60
        assert(pointsMatch![1].includes('y="140"'));
        assert(pointsMatch![1].includes('x="290"'));
        assert(pointsMatch![1].includes('x="60"'));
      }
    });

    it("should route through gap channel when source is below group and target is to the left", () => {
      // Group at (200, 100, 200, 200). Source at (250, 400, 80, 60), sourceBounds.y=400 > groupBottom=300.
      // Target at (20, 180, 80, 60), targetCenter.x=60 < groupLeft-margin (200-30=170).
      // Channel Y = 300 + (400 - 300) / 2 = 350
      model.createGroup({ x: 200, y: 100, width: 200, height: 200, text: "Container" });
      const source = model.addRectangle({ x: 250, y: 400, width: 80, height: 60, text: "Source" });
      const target = model.addRectangle({ x: 20, y: 180, width: 80, height: 60, text: "Target" });
      const edge = model.addEdge({ sourceId: source.id, targetId: target.id });
      assertEquals("error" in edge, false);
      if (!("error" in edge)) {
        const xml = model.toXml();
        const pointsMatch = xml.match(
          new RegExp(`id="${edge.id}"[^>]*>.*?<Array as="points">(.*?)</Array>`, "s"),
        );
        assertExists(pointsMatch);
        // Channel at y=350, waypoints at sourceCenter.x=290 and targetCenter.x=60
        assert(pointsMatch![1].includes('y="350"'));
        assert(pointsMatch![1].includes('x="290"'));
        assert(pointsMatch![1].includes('x="60"'));
      }
    });

    it("should route through gap channel when source is below group and target is to the right", () => {
      // Group at (200, 100, 200, 200). Source at (250, 400, 80, 60), sourceBounds.y=400 > groupBottom=300.
      // Target at (500, 180, 80, 60), targetCenter.x=540 > groupRight+margin (400+30=430).
      // Channel Y = 300 + (400 - 300) / 2 = 350
      model.createGroup({ x: 200, y: 100, width: 200, height: 200, text: "Container" });
      const source = model.addRectangle({ x: 250, y: 400, width: 80, height: 60, text: "Source" });
      const target = model.addRectangle({ x: 500, y: 180, width: 80, height: 60, text: "Target" });
      const edge = model.addEdge({ sourceId: source.id, targetId: target.id });
      assertEquals("error" in edge, false);
      if (!("error" in edge)) {
        const xml = model.toXml();
        const pointsMatch = xml.match(
          new RegExp(`id="${edge.id}"[^>]*>.*?<Array as="points">(.*?)</Array>`, "s"),
        );
        assertExists(pointsMatch);
        // Channel at y=350, waypoints at sourceCenter.x=290 and targetCenter.x=540
        assert(pointsMatch![1].includes('y="350"'));
        assert(pointsMatch![1].includes('x="290"'));
        assert(pointsMatch![1].includes('x="540"'));
      }
    });

    it("should skip gap channel when path bbox does not overlap group", () => {
      // Source and target both above a group — no bbox overlap, no waypoints needed.
      model.createGroup({ x: 300, y: 400, width: 200, height: 200, text: "Container" });
      const source = model.addRectangle({ x: 20, y: 50, width: 80, height: 60, text: "Source" });
      const target = model.addRectangle({ x: 200, y: 50, width: 80, height: 60, text: "Target" });
      const edge = model.addEdge({ sourceId: source.id, targetId: target.id });
      assertEquals("error" in edge, false);
      if (!("error" in edge)) {
        const xml = model.toXml();
        // Edge should have no Array points (no avoidance waypoints)
        const edgeXml = xml.match(new RegExp(`<mxCell id="${edge.id}"[^/]*/>`))?.[0] ??
          xml.match(new RegExp(`<mxCell id="${edge.id}".*?</mxCell>`, "s"))?.[0] ?? "";
        assertEquals(edgeXml.includes("<Array"), false);
      }
    });
  });

  describe("nested group bounds", () => {
    it("should propagate parent group offsets in getAbsoluteBoundsFromMap", () => {
      // Create outer group, inner group, and a cell inside the inner group
      const outer = model.createGroup({ x: 100, y: 50, width: 500, height: 400, text: "Outer" });
      const inner = model.createGroup({ x: 20, y: 20, width: 200, height: 150, text: "Inner" });
      model.addCellToGroup(inner.id, outer.id);
      const child = model.addRectangle({ x: 10, y: 10, width: 80, height: 40, text: "Child" });
      model.addCellToGroup(child.id, inner.id);

      // Create nodes outside the outer group and an edge across
      const external = model.addRectangle({ x: 700, y: 200, width: 100, height: 60, text: "External" });
      model.addEdge({ sourceId: external.id, targetId: child.id });

      // Calling toXml() exercises getAbsoluteBoundsFromMap with nested parent recursion
      const xml = model.toXml();
      assert(xml.includes(`id="${child.id}"`));
      assert(xml.includes(`id="${inner.id}"`));
      assert(xml.includes(`id="${outer.id}"`));
    });
  });

  describe("private geometry helpers", () => {
    // Access private methods via `any` cast for thorough unit testing
    it("getAbsoluteBounds should traverse parent chain", () => {
      const m = model as any;
      const parent: Cell = {
        id: "g1",
        type: "vertex",
        value: "Group",
        x: 100,
        y: 50,
        width: 400,
        height: 300,
        style: "",
        parent: "1",
        isGroup: true,
        children: ["c1"],
      };
      const child: Cell = {
        id: "c1",
        type: "vertex",
        value: "Child",
        x: 20,
        y: 30,
        width: 80,
        height: 40,
        style: "",
        parent: "g1",
      };
      m.cells.set("g1", parent);
      m.cells.set("c1", child);
      const bounds = m.getAbsoluteBounds("c1");
      assertEquals(bounds, { x: 120, y: 80, width: 80, height: 40 });
    });

    it("getAbsoluteBounds should return null for non-existent cell", () => {
      const m = model as any;
      assertEquals(m.getAbsoluteBounds("missing"), null);
    });

    it("getAbsoluteBounds should return null for edge cell", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      const edge = model.addEdge({ sourceId: a.id, targetId: b.id });
      if (!("error" in edge)) {
        const m = model as any;
        assertEquals(m.getAbsoluteBounds(edge.id), null);
      }
    });

    it("getAbsoluteBounds should stop at non-group parent", () => {
      const m = model as any;
      const nonGroup: Cell = {
        id: "ng1",
        type: "vertex",
        value: "Not Group",
        x: 200,
        y: 200,
        width: 100,
        height: 100,
        style: "",
        parent: "1",
      };
      const child: Cell = {
        id: "c2",
        type: "vertex",
        value: "Child",
        x: 10,
        y: 10,
        width: 50,
        height: 50,
        style: "",
        parent: "ng1",
      };
      m.cells.set("ng1", nonGroup);
      m.cells.set("c2", child);
      const bounds = m.getAbsoluteBounds("c2");
      // Parent is not a group, so no offset is added
      assertEquals(bounds, { x: 10, y: 10, width: 50, height: 50 });
    });

    it("getCellCenter should return center point", () => {
      const m = model as any;
      const cell: Cell = {
        id: "v1",
        type: "vertex",
        value: "V",
        x: 100,
        y: 200,
        width: 80,
        height: 40,
        style: "",
        parent: "1",
      };
      m.cells.set("v1", cell);
      const center = m.getCellCenter("v1");
      assertEquals(center, { x: 140, y: 220 });
    });

    it("getCellCenter should return null for non-existent cell", () => {
      const m = model as any;
      assertEquals(m.getCellCenter("missing"), null);
    });

    it("isCellInsideGroup should return true for same cell", () => {
      const g = model.createGroup({ text: "G" });
      const m = model as any;
      assertEquals(m.isCellInsideGroup(g.id, g.id), true);
    });

    it("isCellInsideGroup should traverse nested groups", () => {
      const outer = model.createGroup({ text: "Outer" });
      const inner = model.createGroup({ text: "Inner" });
      model.addCellToGroup(inner.id, outer.id);
      const cell = model.addRectangle({ text: "Leaf" });
      model.addCellToGroup(cell.id, inner.id);
      const m = model as any;
      assertEquals(m.isCellInsideGroup(cell.id, outer.id), true);
    });

    it("isCellInsideGroup should return false for unrelated cell", () => {
      const g = model.createGroup({ text: "G" });
      const cell = model.addRectangle({ text: "A" });
      const m = model as any;
      assertEquals(m.isCellInsideGroup(cell.id, g.id), false);
    });

    it("pointInsideRect should detect point inside", () => {
      const m = model as any;
      assertEquals(m.pointInsideRect({ x: 150, y: 150 }, { x: 100, y: 100, width: 200, height: 200 }), true);
    });

    it("pointInsideRect should detect point outside", () => {
      const m = model as any;
      assertEquals(m.pointInsideRect({ x: 50, y: 150 }, { x: 100, y: 100, width: 200, height: 200 }), false);
    });

    it("pointInsideRect should fail for point below rect", () => {
      const m = model as any;
      assertEquals(m.pointInsideRect({ x: 150, y: 350 }, { x: 100, y: 100, width: 200, height: 200 }), false);
    });

    it("pointInsideRect should fail for point right of rect", () => {
      const m = model as any;
      assertEquals(m.pointInsideRect({ x: 350, y: 150 }, { x: 100, y: 100, width: 200, height: 200 }), false);
    });

    it("pointInsideRect should fail for point above rect", () => {
      const m = model as any;
      assertEquals(m.pointInsideRect({ x: 150, y: 50 }, { x: 100, y: 100, width: 200, height: 200 }), false);
    });

    it("lineSegmentsIntersect should detect collinear overlap o1=0", () => {
      const m = model as any;
      // Collinear horizontal segments that overlap: p1-p2 = (0,0)→(10,0) and q1-q2 = (5,0)→(15,0)
      assertEquals(m.lineSegmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 0 }, { x: 15, y: 0 }), true);
    });

    it("lineSegmentsIntersect should detect collinear overlap o2=0", () => {
      const m = model as any;
      // q2 is on segment p1-p2
      assertEquals(m.lineSegmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: -5, y: 0 }, { x: 5, y: 0 }), true);
    });

    it("lineSegmentsIntersect should detect collinear overlap o3=0", () => {
      const m = model as any;
      // p1 is on segment q1-q2
      assertEquals(m.lineSegmentsIntersect({ x: 5, y: 0 }, { x: 15, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }), true);
    });

    it("lineSegmentsIntersect should detect collinear overlap o4=0", () => {
      const m = model as any;
      // p2 is on segment q1-q2
      assertEquals(m.lineSegmentsIntersect({ x: -5, y: 0 }, { x: 5, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }), true);
    });

    it("lineSegmentsIntersect should detect when o3=0 (p1 on segment q1-q2)", () => {
      const m = model as any;
      // p1-p2 diagonal, q1-q2 horizontal. p1 lies on q1-q2 extended line (y=0).
      // o1,o2 non-zero, o3=0 and onSegment(q1,p1,q2)=true
      assertEquals(m.lineSegmentsIntersect({ x: 5, y: 0 }, { x: 0, y: 5 }, { x: 0, y: 0 }, { x: 10, y: 0 }), true);
    });

    it("lineSegmentsIntersect should detect when o4=0 (p2 on segment q1-q2)", () => {
      const m = model as any;
      // p2 lies on q1-q2 line (y=0). o1,o2 non-zero, o4=0
      assertEquals(m.lineSegmentsIntersect({ x: 0, y: 5 }, { x: 5, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }), true);
    });

    it("lineSegmentsIntersect should return false for non-intersecting segments", () => {
      const m = model as any;
      assertEquals(m.lineSegmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 5 }, { x: 10, y: 5 }), false);
    });

    it("segmentIntersectsRect should detect point inside rect", () => {
      const m = model as any;
      // Start point is inside the rect
      assertEquals(
        m.segmentIntersectsRect({ x: 150, y: 150 }, { x: 500, y: 500 }, { x: 100, y: 100, width: 200, height: 200 }),
        true,
      );
    });

    it("segmentIntersectsRect should check all four sides", () => {
      const m = model as any;
      const rect = { x: 100, y: 100, width: 200, height: 200 };
      // Diagonal segment that enters from bottom-left corner area
      assertEquals(m.segmentIntersectsRect({ x: 50, y: 350 }, { x: 350, y: 50 }, rect), true);
      // Segment crossing only the bottom side
      assertEquals(m.segmentIntersectsRect({ x: 150, y: 350 }, { x: 150, y: 250 }, rect), true);
      // Segment crossing only the left side
      assertEquals(m.segmentIntersectsRect({ x: 50, y: 200 }, { x: 150, y: 200 }, rect), true);
      // Segment that misses entirely
      assertEquals(m.segmentIntersectsRect({ x: 0, y: 0 }, { x: 50, y: 50 }, rect), false);
    });

    it("getFlattenedEdgeLabelKey should swap when sourceId > targetId", () => {
      const m = model as any;
      // Create edge where sourceId > targetId alphabetically
      const edge: Cell = {
        id: "e1",
        type: "edge",
        value: "label",
        style: "",
        sourceId: "z-cell",
        targetId: "a-cell",
        parent: "1",
      };
      m.cells.set("z-cell", { id: "z-cell", type: "vertex", value: "", style: "", parent: "1" });
      m.cells.set("a-cell", { id: "a-cell", type: "vertex", value: "", style: "", parent: "1" });
      m.cells.set("e1", edge);
      const key = m.getFlattenedEdgeLabelKey(edge);
      assertExists(key);
      // Key should have a-cell before z-cell (sorted order)
      assert(key!.includes("a-cell|z-cell"));
    });

    it("getFlattenedEdgeRouteKey should swap when sourceId > targetId", () => {
      const m = model as any;
      const edge: Cell = {
        id: "e2",
        type: "edge",
        value: "",
        style: "",
        sourceId: "z-cell",
        targetId: "a-cell",
        parent: "1",
      };
      m.cells.set("z-cell", { id: "z-cell", type: "vertex", value: "", style: "", parent: "1" });
      m.cells.set("a-cell", { id: "a-cell", type: "vertex", value: "", style: "", parent: "1" });
      m.cells.set("e2", edge);
      const key = m.getFlattenedEdgeRouteKey(edge);
      assertExists(key);
      assert(key!.includes("a-cell|z-cell"));
    });

    it("getFlattenedEdgeLabelKey should use empty string when parent is undefined", () => {
      const m = model as any;
      const edge: Cell = {
        id: "e3",
        type: "edge",
        value: "label",
        style: "",
        sourceId: "a-cell",
        targetId: "b-cell",
        parent: undefined,
      };
      m.cells.set("a-cell", { id: "a-cell", type: "vertex", value: "", style: "", parent: "1" });
      m.cells.set("b-cell", { id: "b-cell", type: "vertex", value: "", style: "", parent: "1" });
      m.cells.set("e3", edge);
      const key = m.getFlattenedEdgeLabelKey(edge);
      assertExists(key);
      assert(key!.startsWith("|"));
    });

    it("getFlattenedEdgeRouteKey should use empty string when parent is undefined", () => {
      const m = model as any;
      const edge: Cell = {
        id: "e4",
        type: "edge",
        value: "",
        style: "",
        sourceId: "a-cell",
        targetId: "b-cell",
        parent: undefined,
      };
      m.cells.set("a-cell", { id: "a-cell", type: "vertex", value: "", style: "", parent: "1" });
      m.cells.set("b-cell", { id: "b-cell", type: "vertex", value: "", style: "", parent: "1" });
      m.cells.set("e4", edge);
      const key = m.getFlattenedEdgeRouteKey(edge);
      assertExists(key);
      assert(key!.startsWith("|"));
    });

    it("getAbsoluteBounds should default undefined coords to 0", () => {
      const m = model as any;
      const cell: Cell = {
        id: "v-no-coords",
        type: "vertex",
        value: "No Coords",
        style: "",
        parent: "1",
      };
      m.cells.set("v-no-coords", cell);
      const bounds = m.getAbsoluteBounds("v-no-coords");
      assertEquals(bounds, { x: 0, y: 0, width: 0, height: 0 });
    });

    it("getAbsoluteBounds should default parent undefined coords to 0", () => {
      const m = model as any;
      const parent: Cell = {
        id: "g-no-coords",
        type: "vertex",
        value: "Group",
        style: "",
        parent: "1",
        isGroup: true,
        children: ["c-child"],
      };
      const child: Cell = {
        id: "c-child",
        type: "vertex",
        value: "Child",
        x: 10,
        y: 20,
        width: 50,
        height: 30,
        style: "",
        parent: "g-no-coords",
      };
      m.cells.set("g-no-coords", parent);
      m.cells.set("c-child", child);
      const bounds = m.getAbsoluteBounds("c-child");
      assertEquals(bounds, { x: 10, y: 20, width: 50, height: 30 });
    });

    it("getAbsoluteBoundsFromMap should return cached null", () => {
      const m = model as any;
      const cellMap = new Map<string, Cell>();
      const cache = new Map<string, any>();
      cache.set("cached-null", null);
      assertEquals(m.getAbsoluteBoundsFromMap("cached-null", cellMap, cache), null);
    });

    it("getAbsoluteBoundsFromMap should return null for edge cell", () => {
      const m = model as any;
      const edge: Cell = { id: "e-test", type: "edge", value: "", style: "", parent: "1" };
      const cellMap = new Map<string, Cell>([["e-test", edge]]);
      const cache = new Map<string, any>();
      assertEquals(m.getAbsoluteBoundsFromMap("e-test", cellMap, cache), null);
      assertEquals(cache.get("e-test"), null);
    });

    it("getAbsoluteBoundsFromMap should default undefined coords to 0", () => {
      const m = model as any;
      const cell: Cell = { id: "v-undef", type: "vertex", value: "", style: "", parent: "1" };
      const cellMap = new Map<string, Cell>([["v-undef", cell]]);
      const cache = new Map<string, any>();
      const bounds = m.getAbsoluteBoundsFromMap("v-undef", cellMap, cache);
      assertEquals(bounds, { x: 0, y: 0, width: 0, height: 0 });
    });
  });

  describe("edge index defensive branches", () => {
    it("removeEdgeReference should early return for undefined vertexId", () => {
      const m = model as any;
      // Should not throw
      m.removeEdgeReference(undefined, "some-edge");
    });

    it("removeEdgeReference should early return when vertex has no index entry", () => {
      const m = model as any;
      // Vertex ID is defined but not in the index
      m.removeEdgeReference("nonexistent-vertex", "some-edge");
    });

    it("removeEdgeFromIndex should early return for non-edge cell", () => {
      const m = model as any;
      const vertex: Cell = {
        id: "v1",
        type: "vertex",
        value: "",
        style: "",
        parent: "1",
      };
      m.removeEdgeFromIndex(vertex);
    });
  });

  describe("moveCellToLayer success", () => {
    it("should move cell to new layer", () => {
      const cell = model.addRectangle({ text: "A" });
      const layer = model.createLayer("Target");
      const result = model.moveCellToLayer(cell.id, layer.id);
      assertEquals("error" in result, false);
      if (!("error" in result)) {
        assertEquals(result.parent, layer.id);
      }
      const updated = model.getCell(cell.id);
      assertExists(updated);
      assertEquals(updated!.parent, layer.id);
    });
  });

  describe("batchEditEdges", () => {
    it("should edit multiple edges successfully", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      const c = model.addRectangle({ text: "C" });
      const edge1 = model.addEdge({ sourceId: a.id, targetId: b.id, text: "e1" });
      const edge2 = model.addEdge({ sourceId: b.id, targetId: c.id, text: "e2" });
      assertEquals("error" in edge1, false);
      assertEquals("error" in edge2, false);

      if (!("error" in edge1) && !("error" in edge2)) {
        const results = model.batchEditEdges([
          { cell_id: edge1.id, text: "updated1" },
          { cell_id: edge2.id, text: "updated2", style: "newStyle;" },
        ]);
        assertEquals(results.length, 2);
        assertEquals(results[0].success, true);
        assertEquals(results[1].success, true);
        assertExists(results[0].cell);
        assertEquals(results[0].cell!.value, "updated1");
        assertEquals(results[1].cell!.value, "updated2");
        assertEquals(results[1].cell!.style, "newStyle;");
      }
    });

    it("should report errors for non-existent edge", () => {
      const results = model.batchEditEdges([
        { cell_id: "nonexistent", text: "X" },
      ]);
      assertEquals(results.length, 1);
      assertEquals(results[0].success, false);
      assertExists(results[0].error);
    });

    it("should report error when editing a vertex as edge", () => {
      const cell = model.addRectangle({ text: "A" });
      const results = model.batchEditEdges([
        { cell_id: cell.id, text: "X" },
      ]);
      assertEquals(results.length, 1);
      assertEquals(results[0].success, false);
    });

    it("should update source and target IDs", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      const c = model.addRectangle({ text: "C" });
      const edge = model.addEdge({ sourceId: a.id, targetId: b.id });
      assertEquals("error" in edge, false);

      if (!("error" in edge)) {
        const results = model.batchEditEdges([
          { cell_id: edge.id, source_id: c.id, target_id: a.id },
        ]);
        assertEquals(results[0].success, true);
        assertEquals(results[0].cell!.sourceId, c.id);
        assertEquals(results[0].cell!.targetId, a.id);
      }
    });
  });

  describe("getGroupAvoidanceWaypoints without precomputed data", () => {
    it("should return empty when source center cannot be resolved", () => {
      const m = model as any;
      const edge: Cell = {
        id: "edge-no-center",
        type: "edge",
        value: "",
        style: "",
        sourceId: "nonexistent-src",
        targetId: "nonexistent-tgt",
        parent: "1",
      };
      m.cells.set("edge-no-center", edge);
      // No precomputed centers and cells don't exist → null centers → early return
      const waypoints = m.getGroupAvoidanceWaypoints(edge);
      assertEquals(waypoints.length, 0);
    });

    it("should fall back to getCellCenter and manual group collection", () => {
      const m = model as any;
      model.createGroup({ x: 200, y: 100, width: 260, height: 200, text: "G" });
      const left = model.addRectangle({ x: 20, y: 170, width: 100, height: 60, text: "L" });
      const right = model.addRectangle({ x: 560, y: 170, width: 100, height: 60, text: "R" });
      const edge: Cell = {
        id: "test-edge",
        type: "edge",
        value: "",
        style: "",
        sourceId: left.id,
        targetId: right.id,
        parent: "1",
      };
      m.cells.set("test-edge", edge);

      // Call without precomputed data to exercise fallback paths
      const waypoints = m.getGroupAvoidanceWaypoints(edge);
      assertGreater(waypoints.length, 0);
    });

    it("should use center-based spatial comparison when sourceBounds is null", () => {
      const m = model as any;
      // Create a group that the path crosses
      model.createGroup({ x: 200, y: 100, width: 200, height: 200, text: "G" });

      // Set up edge with source/target that don't exist as vertices (so getAbsoluteBounds returns null)
      // But provide precomputedCenters so the function gets past the center check
      const edge: Cell = {
        id: "edge-no-bounds",
        type: "edge",
        value: "",
        style: "",
        sourceId: "fake-src",
        targetId: "fake-tgt",
        parent: "1",
      };
      m.cells.set("edge-no-bounds", edge);

      const centers = new Map();
      centers.set("fake-src", { x: 50, y: 200 });
      centers.set("fake-tgt", { x: 550, y: 200 });

      const waypoints = m.getGroupAvoidanceWaypoints(edge, centers);
      // Should still produce waypoints using center-based spatial comparison
      assertGreater(waypoints.length, 0);
    });
  });

  describe("withSymmetricEdgeAnchors fallbacks", () => {
    it("should handle edge with undefined style", () => {
      const m = model as any;
      const edge: Cell = {
        id: "e-no-style",
        type: "edge",
        value: "",
        sourceId: "src",
        targetId: "tgt",
        parent: "1",
      };
      m.cells.set("e-no-style", edge);
      m.cells.set("src", {
        id: "src",
        type: "vertex",
        value: "",
        x: 0,
        y: 100,
        width: 100,
        height: 60,
        style: "",
        parent: "1",
      });
      m.cells.set("tgt", {
        id: "tgt",
        type: "vertex",
        value: "",
        x: 400,
        y: 100,
        width: 100,
        height: 60,
        style: "",
        parent: "1",
      });

      const result = m.withSymmetricEdgeAnchors(edge);
      assert(result.includes("exitX=1;exitY=0.5;"));
    });

    it("should return baseStyle when centers cannot be resolved", () => {
      const m = model as any;
      const edge: Cell = {
        id: "e-unresolvable",
        type: "edge",
        value: "",
        style: "custom;",
        sourceId: "missing-src",
        targetId: "missing-tgt",
        parent: "1",
      };
      m.cells.set("e-unresolvable", edge);
      // No cells for missing-src/missing-tgt and no precomputedCenters
      const result = m.withSymmetricEdgeAnchors(edge);
      assertEquals(result, "custom;");
    });

    it("should use precomputedCenters fallback to getCellCenter", () => {
      const m = model as any;
      const edge: Cell = {
        id: "e-fallback",
        type: "edge",
        value: "",
        style: "",
        sourceId: "src2",
        targetId: "tgt2",
        parent: "1",
      };
      m.cells.set("e-fallback", edge);
      m.cells.set("src2", {
        id: "src2",
        type: "vertex",
        value: "",
        x: 0,
        y: 100,
        width: 100,
        height: 60,
        style: "",
        parent: "1",
      });
      m.cells.set("tgt2", {
        id: "tgt2",
        type: "vertex",
        value: "",
        x: 400,
        y: 100,
        width: 100,
        height: 60,
        style: "",
        parent: "1",
      });

      // Pass a precomputedCenters map that does NOT contain src2/tgt2
      // This forces the ?? fallback to getCellCenter
      const emptyCenters = new Map();
      const result = m.withSymmetricEdgeAnchors(edge, emptyCenters);
      assert(result.includes("exitX=1;exitY=0.5;"));
    });
  });

  describe("getGroupAvoidanceWaypoints gap channel with sourceBounds", () => {
    it("should use sourceBounds.x+width when sourceLeft (L-shaped path)", () => {
      const m = model as any;
      // Group large enough that the diagonal from source to target crosses it
      model.createGroup({ x: 200, y: 100, width: 300, height: 300, text: "G" });
      // Source LEFT of the group
      model.addRectangle({ x: 20, y: 250, width: 80, height: 60, text: "Src" });
      // Target BELOW the group — its center is horizontally inside the group's x range
      model.addRectangle({ x: 350, y: 500, width: 60, height: 60, text: "Tgt" });
      const srcCell = Array.from(m.cells.values()).find((c: any) => c.value === "Src") as Cell;
      const tgtCell = Array.from(m.cells.values()).find((c: any) => c.value === "Tgt") as Cell;
      const edge: Cell = {
        id: "edge-sl",
        type: "edge",
        value: "",
        style: "",
        sourceId: srcCell.id,
        targetId: tgtCell.id,
        parent: "1",
      };
      m.cells.set("edge-sl", edge);
      const waypoints = m.getGroupAvoidanceWaypoints(edge);
      assertGreater(waypoints.length, 0);
    });

    it("should use sourceBounds.x when sourceRight (L-shaped path)", () => {
      const m = model as any;
      // Tall group so the diagonal crosses it
      model.createGroup({ x: 200, y: 150, width: 200, height: 350, text: "G" });
      // Source RIGHT of the group
      model.addRectangle({ x: 500, y: 350, width: 80, height: 60, text: "Src" });
      // Target ABOVE the group — its center is horizontally inside the group's x range
      model.addRectangle({ x: 280, y: 20, width: 60, height: 60, text: "Tgt" });
      const srcCell = Array.from(m.cells.values()).find((c: any) => c.value === "Src") as Cell;
      const tgtCell = Array.from(m.cells.values()).find((c: any) => c.value === "Tgt") as Cell;
      const edge: Cell = {
        id: "edge-sr",
        type: "edge",
        value: "",
        style: "",
        sourceId: srcCell.id,
        targetId: tgtCell.id,
        parent: "1",
      };
      m.cells.set("edge-sr", edge);
      const waypoints = m.getGroupAvoidanceWaypoints(edge);
      assertGreater(waypoints.length, 0);
    });

    it("should use sourceBounds.y+height when sourceAbove (L-shaped path)", () => {
      const m = model as any;
      // Large group so the diagonal crosses it
      model.createGroup({ x: 200, y: 150, width: 300, height: 300, text: "G" });
      // Source ABOVE group — horizontally within group x range
      model.addRectangle({ x: 300, y: 10, width: 80, height: 60, text: "Src" });
      // Target RIGHT of group
      model.addRectangle({ x: 600, y: 300, width: 80, height: 60, text: "Tgt" });
      const srcCell = Array.from(m.cells.values()).find((c: any) => c.value === "Src") as Cell;
      const tgtCell = Array.from(m.cells.values()).find((c: any) => c.value === "Tgt") as Cell;
      const edge: Cell = {
        id: "edge-sa",
        type: "edge",
        value: "",
        style: "",
        sourceId: srcCell.id,
        targetId: tgtCell.id,
        parent: "1",
      };
      m.cells.set("edge-sa", edge);
      const waypoints = m.getGroupAvoidanceWaypoints(edge);
      assertGreater(waypoints.length, 0);
    });

    it("should use sourceBounds.y when sourceBelow (L-shaped path)", () => {
      const m = model as any;
      // Large group so the diagonal crosses it
      model.createGroup({ x: 200, y: 100, width: 300, height: 300, text: "G" });
      // Source BELOW the group — horizontally within group x range
      model.addRectangle({ x: 300, y: 500, width: 80, height: 60, text: "Src" });
      // Target RIGHT of the group
      model.addRectangle({ x: 600, y: 250, width: 80, height: 60, text: "Tgt" });
      const srcCell = Array.from(m.cells.values()).find((c: any) => c.value === "Src") as Cell;
      const tgtCell = Array.from(m.cells.values()).find((c: any) => c.value === "Tgt") as Cell;
      const edge: Cell = {
        id: "edge-sb",
        type: "edge",
        value: "",
        style: "",
        sourceId: srcCell.id,
        targetId: tgtCell.id,
        parent: "1",
      };
      m.cells.set("edge-sb", edge);
      const waypoints = m.getGroupAvoidanceWaypoints(edge);
      assertGreater(waypoints.length, 0);
    });

    it("should fall back to sourceCenter.x when sourceBounds is null and sourceLeft (gap channel)", () => {
      const m = model as any;
      model.createGroup({ x: 200, y: 100, width: 300, height: 300, text: "G" });
      model.addRectangle({ x: 350, y: 500, width: 60, height: 60, text: "Tgt" });
      const tgtCell = Array.from(m.cells.values()).find((c: any) => c.value === "Tgt") as Cell;
      const edge: Cell = {
        id: "edge-null-sl",
        type: "edge",
        value: "",
        style: "",
        sourceId: "fake-left",
        targetId: tgtCell.id,
        parent: "1",
      };
      m.cells.set("edge-null-sl", edge);
      const centers = new Map();
      centers.set("fake-left", { x: 60, y: 280 });
      centers.set(tgtCell.id, { x: 380, y: 530 });
      const waypoints = m.getGroupAvoidanceWaypoints(edge, centers);
      assertGreater(waypoints.length, 0);
    });

    it("should fall back to sourceCenter.x when sourceBounds is null and sourceRight (gap channel)", () => {
      const m = model as any;
      model.createGroup({ x: 200, y: 150, width: 200, height: 350, text: "G" });
      model.addRectangle({ x: 280, y: 20, width: 60, height: 60, text: "Tgt" });
      const tgtCell = Array.from(m.cells.values()).find((c: any) => c.value === "Tgt") as Cell;
      const edge: Cell = {
        id: "edge-null-sr",
        type: "edge",
        value: "",
        style: "",
        sourceId: "fake-right",
        targetId: tgtCell.id,
        parent: "1",
      };
      m.cells.set("edge-null-sr", edge);
      const centers = new Map();
      centers.set("fake-right", { x: 540, y: 380 });
      centers.set(tgtCell.id, { x: 310, y: 50 });
      const waypoints = m.getGroupAvoidanceWaypoints(edge, centers);
      assertGreater(waypoints.length, 0);
    });

    it("should fall back to sourceCenter.y when sourceBounds is null and sourceAbove (gap channel)", () => {
      const m = model as any;
      model.createGroup({ x: 200, y: 150, width: 300, height: 300, text: "G" });
      model.addRectangle({ x: 600, y: 300, width: 80, height: 60, text: "Tgt" });
      const tgtCell = Array.from(m.cells.values()).find((c: any) => c.value === "Tgt") as Cell;
      const edge: Cell = {
        id: "edge-null-sa",
        type: "edge",
        value: "",
        style: "",
        sourceId: "fake-above",
        targetId: tgtCell.id,
        parent: "1",
      };
      m.cells.set("edge-null-sa", edge);
      const centers = new Map();
      centers.set("fake-above", { x: 340, y: 40 });
      centers.set(tgtCell.id, { x: 640, y: 330 });
      const waypoints = m.getGroupAvoidanceWaypoints(edge, centers);
      assertGreater(waypoints.length, 0);
    });

    it("should fall back to sourceCenter.y when sourceBounds is null and sourceBelow (gap channel)", () => {
      const m = model as any;
      model.createGroup({ x: 200, y: 100, width: 300, height: 300, text: "G" });
      model.addRectangle({ x: 600, y: 250, width: 80, height: 60, text: "Tgt" });
      const tgtCell = Array.from(m.cells.values()).find((c: any) => c.value === "Tgt") as Cell;
      const edge: Cell = {
        id: "edge-null-sb",
        type: "edge",
        value: "",
        style: "",
        sourceId: "fake-below",
        targetId: tgtCell.id,
        parent: "1",
      };
      m.cells.set("edge-null-sb", edge);
      const centers = new Map();
      centers.set("fake-below", { x: 340, y: 530 });
      centers.set(tgtCell.id, { x: 640, y: 280 });
      const waypoints = m.getGroupAvoidanceWaypoints(edge, centers);
      assertGreater(waypoints.length, 0);
    });
  });

  describe("getAbsoluteParentOffset edge cases", () => {
    it("should return {0,0} when parentId is undefined", () => {
      const m = model as any;
      const result = m.getAbsoluteParentOffset(undefined);
      assertEquals(result, { x: 0, y: 0 });
    });

    it("should return {0,0} when parent cell does not exist", () => {
      const m = model as any;
      const result = m.getAbsoluteParentOffset("nonexistent");
      assertEquals(result, { x: 0, y: 0 });
    });

    it("should return {0,0} when parent cell is not a group", () => {
      const cell = model.addRectangle({ x: 100, y: 200, text: "Not a group" });
      const m = model as any;
      const result = m.getAbsoluteParentOffset(cell.id);
      assertEquals(result, { x: 0, y: 0 });
    });

    it("should return group absolute position when parent is a group", () => {
      const group = model.createGroup({ x: 100, y: 50, width: 200, height: 200, text: "G" });
      const m = model as any;
      const result = m.getAbsoluteParentOffset(group.id);
      assertEquals(result, { x: 100, y: 50 });
    });
  });

  describe("getGroupContainmentWarning null bounds", () => {
    it("should return null when cell bounds cannot be resolved", () => {
      const m = model as any;
      const group = model.createGroup({ x: 0, y: 0, width: 200, height: 200, text: "G" });
      // Create an edge (non-vertex) — getAbsoluteBounds returns null for edges
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      const edge = model.addEdge({ sourceId: a.id, targetId: b.id });
      if (!("error" in edge)) {
        const result = m.getGroupContainmentWarning(edge.id, group.id);
        assertEquals(result, null);
      }
    });
  });

  describe("vertical edge anchors for groups", () => {
    it("should use midpoint X for group-to-group vertical edges", () => {
      // Two groups stacked vertically, offset horizontally so it's vertical flow
      // Source group: x=0..200 (center x=100). Target group: x=100..400 (center x=250).
      // midX = (100+250)/2 = 175. exitX = (175-0)/200 = 0.88. entryX = (175-100)/300 = 0.25.
      const srcGroup = model.createGroup({ x: 0, y: 0, width: 200, height: 100, text: "SrcGroup" });
      const tgtGroup = model.createGroup({ x: 100, y: 300, width: 300, height: 100, text: "TgtGroup" });
      const edge = model.addEdge({ sourceId: srcGroup.id, targetId: tgtGroup.id });
      assertEquals("error" in edge, false);
      if (!("error" in edge)) {
        const xml = model.toXml();
        const styleMatch = xml.match(new RegExp(`id=\\"${edge.id}\\"[^>]*style=\\"([^\\"]*)\\"`));
        assertExists(styleMatch);
        assert(styleMatch![1].includes("exitX=0.88;"));
        assert(styleMatch![1].includes("entryX=0.25;"));
        assert(styleMatch![1].includes("exitY=1;"));
        assert(styleMatch![1].includes("entryY=0;"));
      }
    });

    it("should align exitX to target center when source is a group (vertical flow)", () => {
      // Source group at x=50..350 (width=300, center x=200).
      // Target vertex at x=100..200 (center x=150).
      // Expected exitX = (150 - 50) / 300 = 0.33
      const group = model.createGroup({ x: 50, y: 0, width: 300, height: 100, text: "Group" });
      const target = model.addRectangle({ x: 100, y: 300, width: 100, height: 60, text: "Target" });
      const edge = model.addEdge({ sourceId: group.id, targetId: target.id });
      assertEquals("error" in edge, false);
      if (!("error" in edge)) {
        const xml = model.toXml();
        const styleMatch = xml.match(new RegExp(`id=\\"${edge.id}\\"[^>]*style=\\"([^\\"]*)\\"`));
        assertExists(styleMatch);
        assert(styleMatch![1].includes("exitX=0.33;exitY=1;"));
        assert(styleMatch![1].includes("entryX=0.5;entryY=0;"));
      }
    });
  });

  describe("addCellToGroup previousParentGroup", () => {
    it("should remove cell from previous group when moving to a new group", () => {
      const group1 = model.createGroup({ x: 0, y: 0, width: 200, height: 200, text: "G1" });
      const group2 = model.createGroup({ x: 300, y: 0, width: 200, height: 200, text: "G2" });
      const cell = model.addRectangle({ x: 10, y: 10, text: "Child" });

      // Add to group1 first
      model.addCellToGroup(cell.id, group1.id);
      let g1 = model.getCell(group1.id);
      assertExists(g1);
      assert(g1!.children?.includes(cell.id));

      // Move to group2
      model.addCellToGroup(cell.id, group2.id);
      g1 = model.getCell(group1.id);
      const g2 = model.getCell(group2.id);
      assertExists(g1);
      assertExists(g2);
      // Cell should be removed from group1's children
      assertEquals(g1!.children?.includes(cell.id), false);
      // Cell should be in group2's children
      assert(g2!.children?.includes(cell.id));
    });
  });

  describe("batchAddCellsToGroup warnings", () => {
    it("should include containment warnings spread from getGroupContainmentWarning", () => {
      const group = model.createGroup({ x: 0, y: 0, width: 50, height: 50, text: "Tiny" });
      const cell = model.addRectangle({ x: 200, y: 200, width: 100, height: 100, text: "Big" });
      const results = model.batchAddCellsToGroup([
        { cellId: cell.id, groupId: group.id },
      ]);
      assertEquals(results.length, 1);
      assertEquals(results[0].success, true);
    });
  });

  describe("centerChildrenInGroup edge cases", () => {
    it("should not crash when group has no children", () => {
      const group = model.createGroup({ x: 0, y: 0, width: 200, height: 200, text: "Empty" });
      const m = model as any;
      // Should not throw
      m.centerChildrenInGroup(group.id);
    });

    it("should not crash when called with non-group cell", () => {
      const cell = model.addRectangle({ text: "NotGroup" });
      const m = model as any;
      // Should not throw
      m.centerChildrenInGroup(cell.id);
    });

    it("should handle children with undefined dimensions using defaults", () => {
      const group = model.createGroup({ x: 0, y: 0, width: 200, height: 200, text: "G" });
      const m = model as any;

      // Manually add a child without width/height
      const child: Cell = {
        id: "no-dims",
        type: "vertex",
        value: "NoDims",
        style: "",
        parent: group.id,
      };
      m.cells.set("no-dims", child);
      const groupCell = m.cells.get(group.id);
      groupCell.children = ["no-dims"];

      // centerChildrenInGroup uses (c.height ?? 48) in computation but doesn't assign defaults
      // Just verify it doesn't throw and positions the child
      m.centerChildrenInGroup(group.id);
      assertExists(child.x);
      assertExists(child.y);
    });

    it("should expand group when children require more space", () => {
      const group = model.createGroup({ x: 0, y: 0, width: 50, height: 50, text: "Small" });
      const m = model as any;

      // Manually add large children
      const child1: Cell = {
        id: "big1",
        type: "vertex",
        value: "Big1",
        x: 0,
        y: 0,
        width: 200,
        height: 100,
        style: "",
        parent: group.id,
      };
      const child2: Cell = {
        id: "big2",
        type: "vertex",
        value: "Big2",
        x: 0,
        y: 0,
        width: 150,
        height: 80,
        style: "",
        parent: group.id,
      };
      m.cells.set("big1", child1);
      m.cells.set("big2", child2);
      const groupCell = m.cells.get(group.id);
      groupCell.children = ["big1", "big2"];

      m.centerChildrenInGroup(group.id);

      // Group should have expanded
      assertGreater(groupCell.width, 50);
      assertGreater(groupCell.height, 50);
    });

    it("should handle group with zero width/height", () => {
      const m = model as any;
      const group: Cell = {
        id: "zero-group",
        type: "vertex",
        value: "Zero",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        style: "",
        parent: "1",
        isGroup: true,
        children: [],
      };
      m.cells.set("zero-group", group);

      // Add a child
      const child: Cell = {
        id: "child-of-zero",
        type: "vertex",
        value: "Child",
        x: 0,
        y: 0,
        width: 48,
        height: 48,
        style: "",
        parent: "zero-group",
      };
      m.cells.set("child-of-zero", child);
      group.children = ["child-of-zero"];

      m.centerChildrenInGroup("zero-group");
      // Group should have expanded to fit child + padding
      assertGreater(group.width!, 0);
      assertGreater(group.height!, 0);
    });

    it("should skip edge children and only center vertex children", () => {
      const group = model.createGroup({ x: 0, y: 0, width: 300, height: 300, text: "G" });
      const v1 = model.addRectangle({ x: 10, y: 10, width: 48, height: 48, text: "V1" });
      model.addCellToGroup(v1.id, group.id);

      const m = model as any;
      const groupCell = m.cells.get(group.id);

      // Add an edge as a child
      const edgeChild: Cell = {
        id: "edge-child",
        type: "edge",
        value: "",
        style: "",
        parent: group.id,
      };
      m.cells.set("edge-child", edgeChild);
      groupCell.children.push("edge-child");

      // Should not throw; should only center vertex children
      m.centerChildrenInGroup(group.id);
    });

    it("should return early when group has only edge children (no vertices)", () => {
      const m = model as any;
      const group: Cell = {
        id: "edge-only-group",
        type: "vertex",
        value: "EdgeOnly",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        style: "",
        parent: "1",
        isGroup: true,
        children: ["only-edge-1"],
      };
      m.cells.set("edge-only-group", group);

      const edgeChild: Cell = {
        id: "only-edge-1",
        type: "edge",
        value: "",
        style: "",
        parent: "edge-only-group",
      };
      m.cells.set("only-edge-1", edgeChild);

      // Should return early without modifying group dimensions
      m.centerChildrenInGroup("edge-only-group");
      assertEquals(group.width, 100);
      assertEquals(group.height, 100);
    });

    it("should handle group with undefined width and height", () => {
      const m = model as any;
      const group: Cell = {
        id: "undef-dims-group",
        type: "vertex",
        value: "NoWH",
        x: 0,
        y: 0,
        style: "",
        parent: "1",
        isGroup: true,
        children: ["undef-child"],
      };
      // Intentionally leave width and height undefined
      m.cells.set("undef-dims-group", group);

      const child: Cell = {
        id: "undef-child",
        type: "vertex",
        value: "C",
        x: 0,
        y: 0,
        width: 48,
        height: 48,
        style: "",
        parent: "undef-dims-group",
      };
      m.cells.set("undef-child", child);

      // group.width ?? 0 and group.height ?? 0 should trigger the ?? branches
      m.centerChildrenInGroup("undef-dims-group");
      // Group should have been expanded from undefined to fit child + padding
      assertGreater(group.width!, 0);
      assertGreater(group.height!, 0);
    });
  });

  describe("validateGroupContainment error paths", () => {
    it("should return GROUP_NOT_FOUND when group does not exist", () => {
      const result = model.validateGroupContainment("nonexistent");
      assert("error" in result);
      if ("error" in result) {
        assertEquals(result.error.code, "GROUP_NOT_FOUND");
      }
    });

    it("should return NOT_A_GROUP when cell is not a group", () => {
      const cell = model.addRectangle({ text: "Not a group" });
      const result = model.validateGroupContainment(cell.id);
      assert("error" in result);
      if ("error" in result) {
        assertEquals(result.error.code, "NOT_A_GROUP");
      }
    });

    it("should handle group with undefined children array", () => {
      const m = model as any;
      const group: Cell = {
        id: "no-children-group",
        type: "vertex",
        value: "NoChildren",
        x: 0,
        y: 0,
        width: 200,
        height: 200,
        style: "",
        parent: "1",
        isGroup: true,
        // children is intentionally omitted (undefined)
      };
      m.cells.set("no-children-group", group);

      const result = model.validateGroupContainment("no-children-group");
      assert(!("error" in result));
      if (!("error" in result)) {
        assertEquals(result.totalChildren, 0);
        assertEquals(result.warnings.length, 0);
      }
    });
  });

  describe("toXml transactional placeholder stripping", () => {
    it("should strip image data and add placeholder marker in transactional mode", () => {
      const m = model as any;
      const cell: Cell = {
        id: "txn-cell",
        type: "vertex",
        value: "Shape",
        x: 100,
        y: 100,
        width: 48,
        height: 48,
        style: "fillColor=#E6F2FA;image=data:image/svg+xml,somesvgdata;strokeColor=#0078D4;",
        parent: "1",
      };
      m.cells.set("txn-cell", cell);

      const xml = model.toXml({ transactional: true });
      // Should not contain the image data
      assertEquals(xml.includes("somesvgdata"), false);
      // Should contain placeholder marker (PLACEHOLDER_MARKER = "placeholder=1" without trailing semicolon)
      assert(xml.includes("placeholder=1"));
    });

    it("should not strip image data in non-transactional mode", () => {
      const m = model as any;
      const cell: Cell = {
        id: "nontxn-cell",
        type: "vertex",
        value: "Shape",
        x: 100,
        y: 100,
        width: 48,
        height: 48,
        style: "fillColor=#E6F2FA;image=data:image/svg+xml,somesvgdata;strokeColor=#0078D4;",
        parent: "1",
      };
      m.cells.set("nontxn-cell", cell);

      const xml = model.toXml();
      // Should contain the image data
      assert(xml.includes("somesvgdata"));
    });

    it("should add placeholder marker to group cell with image style in transactional mode", () => {
      const m = model as any;
      const group: Cell = {
        id: "txn-group-img",
        type: "vertex",
        value: "",
        x: 0,
        y: 0,
        width: 200,
        height: 200,
        style: "rounded=1;image=data:image/svg+xml,groupsvg;fillColor=#f5f5f5",
        parent: "1",
        isGroup: true,
        children: [],
      };
      m.cells.set("txn-group-img", group);

      const xml = model.toXml({ transactional: true });
      // Should strip image data and add placeholder marker
      assertEquals(xml.includes("groupsvg"), false);
      assert(xml.includes("placeholder=1"));
      // container=1 should be appended since it's a group
      assert(xml.includes("container=1"));
    });
  });

  describe("batchAddCells placeholder tempId", () => {
    it("should create cell with placeholder ID when tempId starts with 'placeholder-'", () => {
      const results = model.batchAddCells([
        { type: "vertex", text: "Placeholder Cell", tempId: "placeholder-front-doors-abc123" },
      ]);
      assertEquals(results.length, 1);
      assertEquals(results[0].success, true);
      assertExists(results[0].cell);
      assertEquals(results[0].cell!.id, "placeholder-front-doors-abc123");
      assertEquals(results[0].cell!.value, "Placeholder Cell");
    });

    it("should use defaults for placeholder cell when no properties specified", () => {
      const results = model.batchAddCells([
        { type: "vertex", tempId: "placeholder-test-abc123" },
      ]);
      assertEquals(results.length, 1);
      assertEquals(results[0].success, true);
      assertExists(results[0].cell);
      // Should use default values
      assertEquals(results[0].cell!.value, "New Cell");
      assertEquals(results[0].cell!.x, 100);
      assertEquals(results[0].cell!.y, 100);
      assertEquals(results[0].cell!.width, 200);
      assertEquals(results[0].cell!.height, 100);
      assertMatch(results[0].cell!.style!, /whiteSpace=wrap/);
    });

    it("should clamp placeholder cell dimensions to minimum 1", () => {
      const results = model.batchAddCells([
        { type: "vertex", tempId: "placeholder-tiny-abc123", width: -5, height: 0 },
      ]);
      assertEquals(results.length, 1);
      assertEquals(results[0].success, true);
      assertExists(results[0].cell);
      assertEquals(results[0].cell!.width, 1);
      assertEquals(results[0].cell!.height, 1);
    });
  });

  describe("validateEdgeConventions group targeting warning", () => {
    it("should warn when external source targets child inside group", () => {
      const group = model.createGroup({ x: 200, y: 100, width: 200, height: 200, text: "G" });
      const child = model.addRectangle({ x: 10, y: 10, width: 48, height: 48, text: "Child" });
      model.addCellToGroup(child.id, group.id);
      const external = model.addRectangle({ x: 0, y: 0, width: 100, height: 60, text: "External" });
      const edge = model.addEdge({ sourceId: external.id, targetId: child.id });
      assertEquals("error" in edge, false);
      if (!("error" in edge)) {
        // validateEdgeConventions takes an edge ID string
        const warnings: string[] = model.validateEdgeConventions(edge.id);
        assert(warnings.some((w: string) => w.includes("targets child") && w.includes("directly")));
      }
    });

    it("should use cell id in warning when parent value is empty", () => {
      const group = model.createGroup({ x: 200, y: 100, width: 200, height: 200, text: "" });
      const child = model.addRectangle({ x: 10, y: 10, width: 48, height: 48, text: "" });
      model.addCellToGroup(child.id, group.id);
      const external = model.addRectangle({ x: 0, y: 0, width: 100, height: 60, text: "Ext" });
      const edge = model.addEdge({ sourceId: external.id, targetId: child.id });
      assertEquals("error" in edge, false);
      if (!("error" in edge)) {
        // validateEdgeConventions takes an edge ID string
        const warnings: string[] = model.validateEdgeConventions(edge.id);
        // When value is empty, should use the cell id instead
        assert(warnings.some((w: string) => w.includes(group.id)));
      }
    });
  });
});
