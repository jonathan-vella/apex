import { describe, it } from "@std/testing/bdd";
import { assert, assertEquals, assertExists } from "@std/assert";
import {
  createPlaceholderCell,
  extractShapeNameFromPlaceholderId,
  findPlaceholdersInXml,
  isPlaceholder,
  resolvePlaceholdersInXml,
  stripImageFromStyle,
} from "../src/placeholder.ts";

describe("placeholder", () => {
  describe("isPlaceholder", () => {
    it("should detect placeholder IDs", () => {
      assert(isPlaceholder("placeholder-front-doors-abc12345"));
      assert(!isPlaceholder("cell-5"));
      assert(!isPlaceholder("layer-1"));
    });
  });

  describe("extractShapeNameFromPlaceholderId", () => {
    it("should extract single-word shape names", () => {
      assertEquals(extractShapeNameFromPlaceholderId("placeholder-redis-abc12345"), "redis");
    });

    it("should extract multi-word shape names", () => {
      assertEquals(extractShapeNameFromPlaceholderId("placeholder-front-doors-abc12345"), "front-doors");
      assertEquals(
        extractShapeNameFromPlaceholderId("placeholder-container-apps-abc12345"),
        "container-apps",
      );
    });

    it("should return null for non-placeholder IDs", () => {
      assertEquals(extractShapeNameFromPlaceholderId("cell-5"), null);
    });

    it("should return null for malformed placeholder IDs", () => {
      assertEquals(extractShapeNameFromPlaceholderId("placeholder-"), null);
    });

    it("should return null when last part is not a hex UUID suffix", () => {
      assertEquals(extractShapeNameFromPlaceholderId("placeholder-name-ZZZZZZZZ"), null);
    });
  });

  describe("createPlaceholderCell", () => {
    it("should create a cell with placeholder marker in style", () => {
      const cell = createPlaceholderCell("Front Doors", "fillColor=#E6F2FA;", {
        x: 100,
        y: 200,
        width: 48,
        height: 48,
      });
      assert(cell.id.startsWith("placeholder-front-doors-"));
      assertEquals(cell.value, "Front Doors");
      assertEquals(cell.x, 100);
      assertEquals(cell.y, 200);
      assert(cell.style!.includes("placeholder=1"));
    });

    it("should not duplicate marker when baseStyle already contains placeholder=1", () => {
      const cell = createPlaceholderCell("Test", "fillColor=#CCC;placeholder=1;", {
        x: 0,
        y: 0,
        width: 48,
        height: 48,
      });
      assertEquals(cell.style, "fillColor=#CCC;placeholder=1;");
    });

    it("should add semicolon before marker when baseStyle does not end with one", () => {
      const cell = createPlaceholderCell("Test", "fillColor=#CCC", {
        x: 0,
        y: 0,
        width: 48,
        height: 48,
      });
      assert(cell.style!.includes(";placeholder=1;"));
      assert(!cell.style!.includes(";;"));
    });
  });

  describe("findPlaceholdersInXml", () => {
    it("should find placeholder cells in XML", () => {
      const xml = `<mxCell id="placeholder-front-doors-abc12345" value="Front Doors" style="fillColor=#E6F2FA;placeholder=1;" vertex="1" parent="1">` +
        `<mxGeometry x="100" y="100" width="48" height="48" as="geometry"/></mxCell>`;
      const result = findPlaceholdersInXml(xml);
      assertEquals(result.length, 1);
      assertEquals(result[0].id, "placeholder-front-doors-abc12345");
      assertEquals(result[0].shapeName, "front-doors");
    });

    it("should not match non-placeholder cells with placeholder=1 style", () => {
      const xml = `<mxCell id="cell-5" value="Test" style="fillColor=#E6F2FA;placeholder=1;" vertex="1" parent="1">` +
        `<mxGeometry x="100" y="100" width="48" height="48" as="geometry"/></mxCell>`;
      const result = findPlaceholdersInXml(xml);
      assertEquals(result.length, 0);
    });
  });

  describe("resolvePlaceholdersInXml", () => {
    it("should replace placeholder styles with resolved styles", () => {
      const xml = `<mxCell id="placeholder-front-doors-abc12345" value="Custom Label" style="fillColor=#d4d4d4;strokeColor=#999999;placeholder=1" vertex="1" parent="1">` +
        `<mxGeometry x="100" y="100" width="48" height="48" as="geometry"/></mxCell>`;

      const result = resolvePlaceholdersInXml(xml, (_shapeName, _id) => ({
        style: "image=data:image/svg+xml,realsvgdata;fillColor=#0078D4;",
      }));

      assert("xml" in result);
      assert(result.xml.includes("image=data:image/svg+xml,realsvgdata"));
      // The value attribute should NOT change — resolution uses ID, not value
      assert(result.xml.includes('value="Custom Label"'));
    });

    it("should preserve custom labels through resolution", () => {
      // This test verifies the key insight: changing value via edit-cells
      // does NOT break finish-diagram because resolution uses cell ID.
      const xml = `<mxCell id="placeholder-front-doors-abc12345" value="My Custom Front Door Name" style="fillColor=#d4d4d4;placeholder=1" vertex="1" parent="1">` +
        `<mxGeometry x="100" y="100" width="48" height="48" as="geometry"/></mxCell>`;

      const result = resolvePlaceholdersInXml(xml, (shapeName, _id) => {
        // shape name comes from ID, not value
        assertEquals(shapeName, "front-doors");
        return { style: "image=resolved;" };
      });

      assert("xml" in result);
      assert(result.xml.includes('value="My Custom Front Door Name"'));
    });

    it("should return error for unresolvable placeholders", () => {
      const xml = `<mxCell id="placeholder-nonexistent-abc12345" value="Nope" style="placeholder=1" vertex="1" parent="1">` +
        `<mxGeometry x="100" y="100" width="48" height="48" as="geometry"/></mxCell>`;

      const result = resolvePlaceholdersInXml(xml, () => null);

      assert("error" in result);
      assert(!("xml" in result));
      assertExists(result.details);
      assertEquals(result.details!.length, 1);
    });

    it("should handle placeholder IDs with regex-special characters safely", () => {
      // Shape names with regex-special chars shouldn't break the regex replacement.
      // The '+' in 'c++' is a regex metacharacter that would break unescaped interpolation.
      const specialId = "placeholder-c++-abc12345";
      const xml = `<mxCell id="${specialId}" value="C++" style="fillColor=#d4d4d4;placeholder=1" vertex="1" parent="1">` +
        `<mxGeometry x="100" y="100" width="48" height="48" as="geometry"/></mxCell>`;

      // The ID has a valid hex UUID suffix, so findPlaceholdersInXml will find it
      const placeholders = findPlaceholdersInXml(xml);
      assertEquals(placeholders.length, 1);

      // resolvePlaceholdersInXml should not throw despite '+' in the ID
      const result = resolvePlaceholdersInXml(xml, () => ({
        style: "image=resolved;",
      }));
      assert("xml" in result);
      assert(result.xml.includes("image=resolved"));
    });

    it("should handle resolver returning svgImage property", () => {
      const xml = `<mxCell id="placeholder-front-doors-abc12345" value="FD" style="fillColor=#d4d4d4;placeholder=1" vertex="1" parent="1">` +
        `<mxGeometry x="100" y="100" width="48" height="48" as="geometry"/></mxCell>`;

      const result = resolvePlaceholdersInXml(xml, (_shapeName, _id) => ({
        style: "image=data:image/svg+xml,realsvg;",
        svgImage: "data:image/svg+xml,realsvg",
      }));

      assert("xml" in result);
      assert(result.xml.includes("image=data:image/svg+xml,realsvg"));
    });
  });

  describe("stripImageFromStyle", () => {
    it("should remove image= attribute from style", () => {
      const style = "fillColor=#0078D4;image=data:image/svg+xml,longsvgdata;strokeColor=#333;";
      const stripped = stripImageFromStyle(style);
      assert(!stripped.includes("image="));
      assert(stripped.includes("fillColor=#0078D4"));
      assert(stripped.includes("strokeColor=#333"));
    });

    it("should handle style without image attribute", () => {
      const style = "fillColor=#0078D4;strokeColor=#333";
      assertEquals(stripImageFromStyle(style), style);
    });
  });
});
