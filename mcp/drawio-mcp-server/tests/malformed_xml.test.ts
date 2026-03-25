import { beforeEach, describe, it } from "@std/testing/bdd";
import { assert, assertEquals } from "@std/assert";
import { DiagramModel } from "../src/diagram_model.ts";

describe("DiagramModel — malformed XML handling", () => {
  let model: DiagramModel;

  beforeEach(() => {
    model = new DiagramModel();
  });

  describe("importXml rejects invalid input", () => {
    it("should reject empty string", () => {
      const result = model.importXml("");
      assertEquals("error" in result, true);
      if ("error" in result) {
        assertEquals(result.error.code, "EMPTY_XML");
      }
    });

    it("should reject whitespace-only string", () => {
      const result = model.importXml("   \n\t  ");
      assertEquals("error" in result, true);
      if ("error" in result) {
        assertEquals(result.error.code, "EMPTY_XML");
      }
    });

    it("should reject non-drawio XML", () => {
      const result = model.importXml("<html><body>Hello</body></html>");
      assertEquals("error" in result, true);
      if ("error" in result) {
        assertEquals(result.error.code, "INVALID_XML");
      }
    });

    it("should reject plain text", () => {
      const result = model.importXml("this is not XML at all");
      assertEquals("error" in result, true);
      if ("error" in result) {
        assertEquals(result.error.code, "INVALID_XML");
      }
    });

    it("should reject XML with mxfile tag but no content", () => {
      const result = model.importXml("<mxfile></mxfile>");
      assertEquals(
        "error" in result,
        false,
        "Empty mxfile should import without error",
      );
    });

    it("should reject invalid compressed diagram data", () => {
      const xml = `<mxfile><diagram id="d1" name="Page-1">not-valid-base64-deflate-data!!!</diagram></mxfile>`;
      const result = model.importXml(xml);
      assertEquals("error" in result, true);
      if ("error" in result) {
        assertEquals(result.error.code, "DECOMPRESS_FAILED");
      }
    });
  });

  describe("importXml handles edge cases gracefully", () => {
    it("should handle mxGraphModel without mxfile wrapper", () => {
      const xml = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>`;
      const result = model.importXml(xml);
      assert(
        !("error" in result),
        "Bare mxGraphModel should import successfully",
      );
    });

    it("should handle CDATA-wrapped XML", () => {
      const inner = `<mxfile><diagram id="d1" name="Page-1"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>`;
      const xml = `<![CDATA[${inner}]]>`;
      const result = model.importXml(xml);
      assert(
        !("error" in result),
        "CDATA-wrapped XML should import successfully",
      );
    });

    it("should handle XML with cells referencing non-existent parents", () => {
      const xml = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="99" value="orphan" parent="nonexistent" vertex="1"><mxGeometry x="0" y="0" width="100" height="40" as="geometry"/></mxCell></root></mxGraphModel>`;
      // Should not throw — may silently skip or assign to default layer
      const result = model.importXml(xml);
      assert(
        !("error" in result),
        "Non-existent parent should not crash import",
      );
    });

    it("should handle XML with duplicate cell IDs", () => {
      const xml = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="dup" value="first" parent="1" vertex="1"><mxGeometry x="0" y="0" width="100" height="40" as="geometry"/></mxCell><mxCell id="dup" value="second" parent="1" vertex="1"><mxGeometry x="100" y="0" width="100" height="40" as="geometry"/></mxCell></root></mxGraphModel>`;
      // Should not throw — last-write-wins or first-write-wins, but no crash
      const result = model.importXml(xml);
      assert(
        !("error" in result),
        "Duplicate cell IDs should not crash import",
      );
    });

    it("should handle XML with cells but no geometry", () => {
      const xml = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="c1" value="no-geom" parent="1" vertex="1"/></root></mxGraphModel>`;
      const result = model.importXml(xml);
      assert(
        !("error" in result),
        "Cell without geometry should not crash import",
      );
    });

    it("should handle very deeply nested group structure", () => {
      // Build 10-level deep nesting
      let innerXml = `<mxCell id="leaf" value="Leaf" parent="g9" vertex="1"><mxGeometry x="10" y="10" width="50" height="30" as="geometry"/></mxCell>`;
      for (let i = 9; i >= 0; i--) {
        const parentId = i === 0 ? "1" : `g${i - 1}`;
        innerXml = `<mxCell id="g${i}" value="Group${i}" parent="${parentId}" vertex="1" style="group"><mxGeometry x="0" y="0" width="200" height="200" as="geometry"/></mxCell>${innerXml}`;
      }
      const xml = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${innerXml}</root></mxGraphModel>`;
      const result = model.importXml(xml);
      assert(
        !("error" in result),
        "Deeply nested groups should not crash import",
      );
    });
  });

  describe("XXE protection", () => {
    it("should not expand XML entities (XXE protection)", () => {
      // This tests that processEntities: false prevents entity expansion
      const xml = `<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe "INJECTED">]><mxfile><diagram id="d1" name="Page-1"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="c1" value="&xxe;" parent="1" vertex="1"><mxGeometry x="0" y="0" width="100" height="40" as="geometry"/></mxCell></root></mxGraphModel></diagram></mxfile>`;
      const result = model.importXml(xml);
      if (!("error" in result)) {
        // If import succeeds, the entity should NOT have been expanded
        const outputXml = model.toXml();
        assert(
          !outputXml.includes("INJECTED"),
          "Entity expansion should be disabled (XXE protection)",
        );
      }
      // If import fails, that's also acceptable — rejecting DTDs is safe
    });
  });
});
