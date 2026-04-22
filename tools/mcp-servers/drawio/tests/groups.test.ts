import { beforeEach, describe, it } from "@std/testing/bdd";
import { assert, assertEquals, assertExists, assertNotEquals } from "@std/assert";
import { DiagramModel } from "../src/diagram_model.ts";

describe("DiagramModel groups", () => {
  let model: DiagramModel;

  beforeEach(() => {
    model = new DiagramModel();
  });

  describe("createGroup", () => {
    it("should create a group with default properties", () => {
      const group = model.createGroup({});
      assertEquals(group.type, "vertex");
      assertEquals(group.isGroup, true);
      assertEquals(group.children, []);
      assertEquals(group.width, 400);
      assertEquals(group.height, 300);
      assert(group.style!.includes("container=1"));
    });

    it("should create a group with custom properties", () => {
      const group = model.createGroup({
        x: 50,
        y: 75,
        width: 600,
        height: 400,
        text: "VNet",
        style: "fillColor=#e6f2fa;strokeColor=#0078d4;",
      });
      assertEquals(group.x, 50);
      assertEquals(group.y, 75);
      assertEquals(group.width, 600);
      assertEquals(group.height, 400);
      assertEquals(group.value, "VNet");
      assertEquals(group.style, "fillColor=#e6f2fa;strokeColor=#0078d4;");
    });

    it("should be retrievable as a regular cell", () => {
      const group = model.createGroup({ text: "My Group" });
      const cell = model.getCell(group.id);
      assertExists(cell);
      assertEquals(cell!.isGroup, true);
    });

    it("should appear in listCells", () => {
      model.createGroup({ text: "G1" });
      model.addRectangle({ text: "R1" });
      const cells = model.listCells();
      assertEquals(cells.length, 2);
    });
  });

  describe("addCellToGroup", () => {
    it("should add a cell to a group", () => {
      const group = model.createGroup({ text: "VNet" });
      const cell = model.addRectangle({ text: "Subnet" });

      const result = model.addCellToGroup(cell.id, group.id);
      assertEquals("error" in result, false);
      if (!("error" in result)) {
        assertEquals(result.parent, group.id);
      }
    });

    it("should add cell ID to group's children list", () => {
      const group = model.createGroup({ text: "VNet" });
      const cell = model.addRectangle({ text: "Subnet" });

      model.addCellToGroup(cell.id, group.id);
      assert(group.children!.includes(cell.id));
    });

    it("should not duplicate child IDs", () => {
      const group = model.createGroup({ text: "VNet" });
      const cell = model.addRectangle({ text: "Subnet" });

      model.addCellToGroup(cell.id, group.id);
      model.addCellToGroup(cell.id, group.id); // duplicate
      assertEquals(group.children!.filter((id) => id === cell.id).length, 1);
    });

    it("should return error for non-existent cell", () => {
      const group = model.createGroup({ text: "G" });
      const result = model.addCellToGroup("nonexistent", group.id);
      assertEquals("error" in result, true);
      if ("error" in result) {
        assertEquals(result.error.code, "CELL_NOT_FOUND");
      }
    });

    it("should return error for non-existent group", () => {
      const cell = model.addRectangle({ text: "A" });
      const result = model.addCellToGroup(cell.id, "nonexistent");
      assertEquals("error" in result, true);
      if ("error" in result) {
        assertEquals(result.error.code, "GROUP_NOT_FOUND");
      }
    });

    it("should return error when target is not a group", () => {
      const cell1 = model.addRectangle({ text: "A" });
      const cell2 = model.addRectangle({ text: "B" });
      const result = model.addCellToGroup(cell1.id, cell2.id);
      assertEquals("error" in result, true);
      if ("error" in result) {
        assertEquals(result.error.code, "NOT_A_GROUP");
      }
    });

    it("should return error when adding group to itself", () => {
      const group = model.createGroup({ text: "G" });
      const result = model.addCellToGroup(group.id, group.id);
      assertEquals("error" in result, true);
      if ("error" in result) {
        assertEquals(result.error.code, "SELF_REFERENCE");
      }
    });

    it("should initialize children array when it is undefined", () => {
      const group = model.createGroup({ text: "G" });
      // Manually delete the children array to test the defensive branch
      delete (group as any).children;
      const cell = model.addRectangle({ text: "A" });

      const result = model.addCellToGroup(cell.id, group.id);
      assertEquals("error" in result, false);
      // children should have been re-created
      assert(group.children!.includes(cell.id));
    });

    it("should preserve visual position when reparenting to a group", () => {
      const group = model.createGroup({ x: 300, y: 120, width: 300, height: 220, text: "Env" });
      const cell = model.addRectangle({ x: 360, y: 180, width: 80, height: 50, text: "App" });

      const result = model.addCellToGroup(cell.id, group.id);
      assertEquals("error" in result, false);
      if (!("error" in result)) {
        // Relative coordinates should be converted from absolute to group-relative:
        // (360,180) absolute with group origin (300,120) => (60,60)
        assertEquals(result.x, 60);
        assertEquals(result.y, 60);
      }
    });

    it("should remove child from previous parent group when moving between groups", () => {
      const g1 = model.createGroup({ x: 200, y: 100, width: 260, height: 200, text: "G1" });
      const g2 = model.createGroup({ x: 520, y: 100, width: 260, height: 200, text: "G2" });
      const cell = model.addRectangle({ x: 260, y: 160, width: 60, height: 40, text: "App" });

      model.addCellToGroup(cell.id, g1.id);
      model.addCellToGroup(cell.id, g2.id);

      assert(!g1.children!.includes(cell.id));
      assert(g2.children!.includes(cell.id));
    });
  });

  describe("removeCellFromGroup", () => {
    it("should remove a cell from its group", () => {
      const group = model.createGroup({ text: "VNet" });
      const cell = model.addRectangle({ text: "Subnet" });
      model.addCellToGroup(cell.id, group.id);

      const result = model.removeCellFromGroup(cell.id);
      assertEquals("error" in result, false);
      if (!("error" in result)) {
        assertEquals(result.parent, "1"); // Back to default layer
      }
      assert(!group.children!.includes(cell.id));
    });

    it("should return error for non-existent cell", () => {
      const result = model.removeCellFromGroup("nonexistent");
      assertEquals("error" in result, true);
      if ("error" in result) {
        assertEquals(result.error.code, "CELL_NOT_FOUND");
      }
    });

    it("should return error when cell is not in a group", () => {
      const cell = model.addRectangle({ text: "A" });
      const result = model.removeCellFromGroup(cell.id);
      assertEquals("error" in result, true);
      if ("error" in result) {
        assertEquals(result.error.code, "NOT_IN_GROUP");
      }
    });

    it("should preserve visual position when moving from group back to layer", () => {
      const group = model.createGroup({ x: 250, y: 150, width: 300, height: 220, text: "Env" });
      const cell = model.addRectangle({ x: 320, y: 240, width: 60, height: 40, text: "App" });
      model.addCellToGroup(cell.id, group.id);

      const result = model.removeCellFromGroup(cell.id);
      assertEquals("error" in result, false);
      if (!("error" in result)) {
        // Should restore to same absolute screen position.
        assertEquals(result.x, 320);
        assertEquals(result.y, 240);
      }
    });
  });

  describe("validateGroupContainment", () => {
    it("should report all children in bounds when group fully contains them", () => {
      const group = model.createGroup({ x: 300, y: 100, width: 320, height: 260, text: "Env" });
      const c1 = model.addRectangle({ x: 340, y: 150, width: 50, height: 50, text: "A" });
      const c2 = model.addRectangle({ x: 340, y: 230, width: 50, height: 50, text: "B" });
      model.addCellToGroup(c1.id, group.id);
      model.addCellToGroup(c2.id, group.id);

      const result = model.validateGroupContainment(group.id);
      assertEquals("error" in result, false);
      if (!("error" in result)) {
        assertEquals(result.totalChildren, 2);
        assertEquals(result.inBoundsChildren, 2);
        assertEquals(result.outOfBoundsChildren, 0);
        assertEquals(result.warnings.length, 0);
      }
    });

    it("should report out-of-bounds children with warning details", () => {
      const group = model.createGroup({ x: 300, y: 100, width: 180, height: 140, text: "Env" });
      const cell = model.addRectangle({ x: 450, y: 190, width: 90, height: 60, text: "Too Big" });
      model.addCellToGroup(cell.id, group.id);

      // Force overflow by shifting cell inside group to a point that exceeds group bounds
      const child = model.getCell(cell.id)!;
      child.x = 140;
      child.y = 100;

      const result = model.validateGroupContainment(group.id);
      assertEquals("error" in result, false);
      if (!("error" in result)) {
        assertEquals(result.outOfBoundsChildren, 1);
        assertEquals(result.warnings.length, 1);
        assertEquals(result.warnings[0].code, "OUTSIDE_GROUP_BOUNDS");
      }
    });
  });

  describe("listGroupChildren", () => {
    it("should list children of a group", () => {
      const group = model.createGroup({ text: "VNet" });
      const c1 = model.addRectangle({ text: "Subnet A" });
      const c2 = model.addRectangle({ text: "Subnet B" });
      model.addCellToGroup(c1.id, group.id);
      model.addCellToGroup(c2.id, group.id);

      const result = model.listGroupChildren(group.id);
      assertEquals(Array.isArray(result), true);
      if (Array.isArray(result)) {
        assertEquals(result.length, 2);
        assert(result.map((c) => c.value).includes("Subnet A"));
        assert(result.map((c) => c.value).includes("Subnet B"));
      }
    });

    it("should return empty array for group with no children", () => {
      const group = model.createGroup({ text: "Empty" });
      const result = model.listGroupChildren(group.id);
      assertEquals(Array.isArray(result), true);
      if (Array.isArray(result)) {
        assertEquals(result.length, 0);
      }
    });

    it("should return error for non-existent group", () => {
      const result = model.listGroupChildren("nonexistent");
      assertEquals("error" in result, true);
      if ("error" in result) {
        assertEquals(result.error.code, "GROUP_NOT_FOUND");
      }
    });

    it("should return error when cell is not a group", () => {
      const cell = model.addRectangle({ text: "Not a group" });
      const result = model.listGroupChildren(cell.id);
      assertEquals("error" in result, true);
      if ("error" in result) {
        assertEquals(result.error.code, "NOT_A_GROUP");
      }
    });

    it("should handle removed children gracefully", () => {
      const group = model.createGroup({ text: "G" });
      const cell = model.addRectangle({ text: "C" });
      model.addCellToGroup(cell.id, group.id);
      // Delete the child cell directly
      model.deleteCell(cell.id);

      const result = model.listGroupChildren(group.id);
      assertEquals(Array.isArray(result), true);
      if (Array.isArray(result)) {
        assertEquals(result.length, 0);
      }
    });
  });

  describe("toXml with groups", () => {
    it("should render group cells with connectable attribute", () => {
      const group = model.createGroup({ text: "Container" });
      model.addRectangle({ text: "Child" });

      const xml = model.toXml();
      assert(xml.includes(`id="${group.id}"`));
      assert(xml.includes('connectable="0"'));
      assert(xml.includes("container=1"));
    });

    it("should render children with group as parent", () => {
      const group = model.createGroup({ text: "VNet" });
      const child = model.addRectangle({ text: "Subnet" });
      model.addCellToGroup(child.id, group.id);

      const xml = model.toXml();
      assert(xml.includes(`parent="${group.id}"`));
    });

    it("should not duplicate container=1 in style if already present", () => {
      const group = model.createGroup({}); // default style includes container=1
      const xml = model.toXml();
      const styleMatch = xml.match(new RegExp(`id="${group.id}"[^>]*style="([^"]*)"`));
      assertNotEquals(styleMatch, null);
      if (styleMatch) {
        const occurrences = (styleMatch[1].match(/container=1/g) || []).length;
        assertEquals(occurrences, 1);
      }
    });

    it("should append container=1 to group style if not present", () => {
      model.createGroup({ text: "VNet", style: "fillColor=#e6f2fa;strokeColor=#0078d4;" });
      const xml = model.toXml();
      assert(xml.includes("fillColor=#e6f2fa;strokeColor=#0078d4;container=1;"));
    });

    it("should add edge waypoints when an unrelated edge would cross a group", () => {
      const group = model.createGroup({ x: 200, y: 120, width: 260, height: 180, text: "Container Apps Environment" });
      const left = model.addRectangle({ x: 20, y: 170, width: 100, height: 60, text: "Front Door" });
      const right = model.addRectangle({ x: 560, y: 170, width: 100, height: 60, text: "App Service" });

      const edge = model.addEdge({ sourceId: left.id, targetId: right.id, text: "https" });
      assertEquals("error" in edge, false);
      if (!("error" in edge)) {
        const xml = model.toXml();
        const pointMatch = xml.match(
          new RegExp(
            `id=\\"${edge.id}\\"[^>]*><mxGeometry[^>]*><Array as=\\"points\\"><mxPoint x=\\"([^\\"]+)\\" y=\\"([^\\"]+)\\"/><mxPoint x=\\"([^\\"]+)\\" y=\\"([^\\"]+)\\"/>`,
          ),
        );
        assertExists(pointMatch);
        if (pointMatch) {
          const firstY = parseFloat(pointMatch[2]);
          const secondY = parseFloat(pointMatch[4]);
          assertEquals(firstY, secondY);

          const groupTop = group.y!;
          const groupBottom = group.y! + group.height!;
          assert(firstY < groupTop || firstY > groupBottom);
        }
        // Sanity check that the group exists in the test shape
        assert(xml.includes(`id="${group.id}"`));
      }
    });

    it("should allow routing when edge endpoint belongs to the group", () => {
      const group = model.createGroup({ x: 200, y: 120, width: 260, height: 180, text: "Container Apps Environment" });
      const inside = model.addRectangle({ x: 240, y: 170, width: 110, height: 60, text: "Container App" });
      model.addCellToGroup(inside.id, group.id);
      const outside = model.addRectangle({ x: 560, y: 160, width: 100, height: 60, text: "Front Door" });

      const edge = model.addEdge({ sourceId: outside.id, targetId: inside.id, text: "https" });
      assertEquals("error" in edge, false);
      if (!("error" in edge)) {
        const xml = model.toXml();
        assert(xml.includes(`id=\"${edge.id}\"`));
      }
    });
  });

  describe("getStats includes group count", () => {
    it("should report group count", () => {
      model.createGroup({ text: "G1" });
      model.createGroup({ text: "G2" });
      model.addRectangle({ text: "R1" });

      const stats = model.getStats();
      assertEquals(stats.groups, 2);
      assertEquals(stats.vertices, 3); // Groups are also vertices
    });
  });

  describe("batchCreateGroups", () => {
    it("should create multiple groups in one call", () => {
      const results = model.batchCreateGroups([
        { text: "VNet", width: 600, height: 400, tempId: "vnet" },
        { text: "Subnet A", x: 50, y: 50, width: 250, height: 200, tempId: "subnet-a" },
      ]);
      assertEquals(results.length, 2);
      assertEquals(results[0].success, true);
      assertEquals(results[0].cell.isGroup, true);
      assertEquals(results[0].cell.value, "VNet");
      assertEquals(results[0].tempId, "vnet");
      assertEquals(results[1].cell.value, "Subnet A");
      assertEquals(results[1].tempId, "subnet-a");
    });

    it("should create groups with defaults when no params given", () => {
      const results = model.batchCreateGroups([{}]);
      assertEquals(results.length, 1);
      assertEquals(results[0].cell.width, 400);
      assertEquals(results[0].cell.height, 300);
    });

    it("should create groups that appear in listCells", () => {
      model.batchCreateGroups([{ text: "G1" }, { text: "G2" }]);
      const cells = model.listCells();
      assertEquals(cells.length, 2);
      assertEquals(cells.every((c) => c.isGroup), true);
    });

    it("should create multiple groups", () => {
      const results = model.batchCreateGroups([
        { text: "G1", x: 0, y: 0 },
        { text: "G2", x: 500, y: 0 },
      ]);
      assertEquals(results.length, 2);
      assertEquals(results[0].success, true);
      assertEquals(results[0].cell.isGroup, true);
      assertEquals(results[0].cell.value, "G1");
      assertEquals(results[1].cell.value, "G2");
    });

    it("should preserve tempId in results", () => {
      const results = model.batchCreateGroups([
        { text: "G1", tempId: "tmp-1" },
        { text: "G2", tempId: "tmp-2" },
      ]);
      assertEquals(results[0].tempId, "tmp-1");
      assertEquals(results[1].tempId, "tmp-2");
    });

    it("should handle single group", () => {
      const results = model.batchCreateGroups([{ text: "Solo" }]);
      assertEquals(results.length, 1);
      assertEquals(results[0].cell.value, "Solo");
    });
  });

  describe("validateEdgeConventions", () => {
    it("should return no warnings for a normal left-to-right edge", () => {
      const left = model.addRectangle({ x: 100, y: 100, width: 50, height: 50, text: "A" });
      const right = model.addRectangle({ x: 400, y: 100, width: 50, height: 50, text: "B" });
      const edge = model.addEdge({ sourceId: left.id, targetId: right.id });
      assert(!("error" in edge));
      if (!("error" in edge)) {
        const warnings = model.validateEdgeConventions(edge.id);
        assertEquals(warnings.length, 0);
      }
    });

    it("should warn when edge flows leftward", () => {
      const right = model.addRectangle({ x: 400, y: 100, width: 50, height: 50, text: "Source" });
      const left = model.addRectangle({ x: 100, y: 100, width: 50, height: 50, text: "Target" });
      const edge = model.addEdge({ sourceId: right.id, targetId: left.id });
      assert(!("error" in edge));
      if (!("error" in edge)) {
        const warnings = model.validateEdgeConventions(edge.id);
        assert(warnings.length > 0);
        assert(warnings.some((w) => w.includes("leftward")));
      }
    });

    it("should warn when edge flows upward (same column)", () => {
      const bottom = model.addRectangle({ x: 100, y: 400, width: 50, height: 50, text: "Source" });
      const top = model.addRectangle({ x: 100, y: 100, width: 50, height: 50, text: "Target" });
      const edge = model.addEdge({ sourceId: bottom.id, targetId: top.id });
      assert(!("error" in edge));
      if (!("error" in edge)) {
        const warnings = model.validateEdgeConventions(edge.id);
        assert(warnings.length > 0);
        assert(warnings.some((w) => w.includes("upward")));
      }
    });

    it("should not warn when edge flows rightward and upward (primary direction is right)", () => {
      const source = model.addRectangle({ x: 100, y: 300, width: 50, height: 50, text: "Source" });
      const target = model.addRectangle({ x: 500, y: 100, width: 50, height: 50, text: "Target" });
      const edge = model.addEdge({ sourceId: source.id, targetId: target.id });
      assert(!("error" in edge));
      if (!("error" in edge)) {
        const warnings = model.validateEdgeConventions(edge.id);
        assertEquals(warnings.length, 0);
      }
    });

    it("should warn when external source targets a child inside a group", () => {
      const group = model.createGroup({ x: 200, y: 100, width: 300, height: 200, text: "Container Apps Env" });
      const child = model.addRectangle({ x: 30, y: 30, width: 50, height: 50, text: "App 1" });
      model.addCellToGroup(child.id, group.id);
      const external = model.addRectangle({ x: 10, y: 150, width: 50, height: 50, text: "Front Door" });
      const edge = model.addEdge({ sourceId: external.id, targetId: child.id });
      assert(!("error" in edge));
      if (!("error" in edge)) {
        const warnings = model.validateEdgeConventions(edge.id);
        assert(warnings.length > 0);
        assert(warnings.some((w) => w.includes("group cell")));
      }
    });

    it("should not warn when edge targets the group cell itself", () => {
      const group = model.createGroup({ x: 200, y: 100, width: 300, height: 200, text: "Container Apps Env" });
      const child = model.addRectangle({ x: 30, y: 30, width: 50, height: 50, text: "App 1" });
      model.addCellToGroup(child.id, group.id);
      const external = model.addRectangle({ x: 10, y: 150, width: 50, height: 50, text: "Front Door" });
      const edge = model.addEdge({ sourceId: external.id, targetId: group.id });
      assert(!("error" in edge));
      if (!("error" in edge)) {
        const warnings = model.validateEdgeConventions(edge.id);
        const groupTargetWarnings = warnings.filter((w) => w.includes("group cell"));
        assertEquals(groupTargetWarnings.length, 0);
      }
    });

    it("should not warn for intra-group edges between siblings", () => {
      const group = model.createGroup({ x: 200, y: 100, width: 300, height: 200, text: "Container Apps Env" });
      const child1 = model.addRectangle({ x: 30, y: 30, width: 50, height: 50, text: "App 1" });
      const child2 = model.addRectangle({ x: 30, y: 120, width: 50, height: 50, text: "App 2" });
      model.addCellToGroup(child1.id, group.id);
      model.addCellToGroup(child2.id, group.id);
      const edge = model.addEdge({ sourceId: child1.id, targetId: child2.id });
      assert(!("error" in edge));
      if (!("error" in edge)) {
        const warnings = model.validateEdgeConventions(edge.id);
        const groupTargetWarnings = warnings.filter((w) => w.includes("group cell"));
        assertEquals(groupTargetWarnings.length, 0);
      }
    });

    it("should return empty array for non-existent edge", () => {
      const warnings = model.validateEdgeConventions("nonexistent");
      assertEquals(warnings.length, 0);
    });

    it("should return empty array for a vertex cell", () => {
      const cell = model.addRectangle({ text: "Not an edge" });
      const warnings = model.validateEdgeConventions(cell.id);
      assertEquals(warnings.length, 0);
    });
  });

  describe("batchAddCellsToGroup", () => {
    it("should assign multiple cells to groups in one call", () => {
      const g1 = model.createGroup({ text: "Group 1" });
      const g2 = model.createGroup({ text: "Group 2" });
      const c1 = model.addRectangle({ text: "A" });
      const c2 = model.addRectangle({ text: "B" });
      const c3 = model.addRectangle({ text: "C" });

      const results = model.batchAddCellsToGroup([
        { cellId: c1.id, groupId: g1.id },
        { cellId: c2.id, groupId: g1.id },
        { cellId: c3.id, groupId: g2.id },
      ]);
      assertEquals(results.length, 3);
      assertEquals(results.every((r) => r.success), true);
      assertEquals(results[0].cell!.parent, g1.id);
      assertEquals(results[2].cell!.parent, g2.id);
      assert(g1.children!.includes(c1.id));
      assert(g1.children!.includes(c2.id));
      assert(g2.children!.includes(c3.id));
    });

    it("should handle mixed success and failure", () => {
      const g = model.createGroup({ text: "G" });
      const c = model.addRectangle({ text: "A" });

      const results = model.batchAddCellsToGroup([
        { cellId: c.id, groupId: g.id },
        { cellId: "nonexistent", groupId: g.id },
      ]);
      assertEquals(results.length, 2);
      assertEquals(results[0].success, true);
      assertEquals(results[1].success, false);
      assertEquals(results[1].error!.code, "CELL_NOT_FOUND");
    });

    it("should report cellId and groupId in results", () => {
      const g = model.createGroup({ text: "G" });
      const c = model.addRectangle({ text: "A" });

      const results = model.batchAddCellsToGroup([
        { cellId: c.id, groupId: g.id },
      ]);
      assertEquals(results[0].cellId, c.id);
      assertEquals(results[0].groupId, g.id);
    });

    it("should add multiple cells to a group", () => {
      const group = model.createGroup({ text: "G" });
      const cell1 = model.addRectangle({ text: "A" });
      const cell2 = model.addRectangle({ text: "B" });

      const results = model.batchAddCellsToGroup([
        { cellId: cell1.id, groupId: group.id },
        { cellId: cell2.id, groupId: group.id },
      ]);
      assertEquals(results.length, 2);
      assertEquals(results[0].success, true);
      assertEquals(results[0].cell!.parent, group.id);
      assertEquals(results[1].success, true);
    });

    it("should report errors for invalid assignments", () => {
      const group = model.createGroup({ text: "G" });

      const results = model.batchAddCellsToGroup([
        { cellId: "nonexistent", groupId: group.id },
      ]);
      assertEquals(results[0].success, false);
      assertEquals(results[0].error!.code, "CELL_NOT_FOUND");
      assertEquals(results[0].cellId, "nonexistent");
      assertEquals(results[0].groupId, group.id);
    });

    it("should handle mixed success and failure alt", () => {
      const group = model.createGroup({ text: "G" });
      const cell1 = model.addRectangle({ text: "A" });

      const results = model.batchAddCellsToGroup([
        { cellId: cell1.id, groupId: group.id },
        { cellId: "nonexistent", groupId: group.id },
      ]);
      assertEquals(results[0].success, true);
      assertEquals(results[1].success, false);
    });
  });
});
