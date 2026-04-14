#!/usr/bin/env node
/**
 * Validate .drawio files for well-formed XML structure and draw.io conventions.
 *
 * Checks based on the official draw.io validation checklist:
 *   https://www.drawio.com/doc/faq/drawio-style-reference#15-validation-checklist-for-ai-generated-files
 *
 * 1. Valid XML                    8. Edge source/target refs
 * 2. Root <mxfile> element        9. Geometry present
 * 3. Unique diagram IDs          10. Style format
 * 4. Structural cells            11. Perimeter match
 * 5. Unique cell IDs             12. HTML escaping
 * 6. Valid parent references     13. No negative dimensions
 * 7. vertex/edge exclusive       14. Group coord hierarchy
 *
 * Also validates Azure icon embedding for architecture deliverables.
 *
 * @example
 * node scripts/validate-drawio-files.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { Reporter } from "./_lib/reporter.mjs";

const _r = new Reporter("Draw.io File Validation");

// Directories to scan for .drawio files
const SCAN_DIRS = [
  "agent-output",
  "assets",
  ".github/skills/drawio",
  "tmp",
  "site/public/demo",
];

// Architecture deliverables that MUST have Azure icons
const ICON_REQUIRED_PATTERN =
  /(?:^|\/)(03-des-diagram|04-dependency-diagram|04-runtime-diagram|07-ab-diagram|showcase-[^/]+)\.drawio$/;

// Error/warning counters — synced to Reporter at summary time.
let errors = 0;
let warnings = 0;
let filesChecked = 0;

/**
 * Find all .drawio files recursively in a directory.
 */
function findDrawioFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findDrawioFiles(fullPath));
    } else if (entry.name.endsWith(".drawio")) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Simple XML parser using fast-xml-parser (already a devDependency).
 */
async function parseXml(content) {
  const { XMLParser } = await import("fast-xml-parser");
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    allowBooleanAttributes: true,
    parseAttributeValue: false,
    trimValues: false,
  });
  return parser.parse(content);
}

/**
 * Extract all mxCell and UserObject/object elements from parsed XML.
 */
function extractCells(root) {
  const cells = [];
  if (!root) return cells;

  // Handle both array and single element cases
  const items = Array.isArray(root) ? root : [root];
  for (const item of items) {
    if (!item) continue;
    // Direct mxCell elements
    if (item.mxCell) {
      const mxCells = Array.isArray(item.mxCell) ? item.mxCell : [item.mxCell];
      for (const cell of mxCells) {
        cells.push({ type: "mxCell", ...cell });
      }
    }
    // UserObject/object wrappers
    for (const wrapperName of ["UserObject", "object"]) {
      if (item[wrapperName]) {
        const wrappers = Array.isArray(item[wrapperName])
          ? item[wrapperName]
          : [item[wrapperName]];
        for (const wrapper of wrappers) {
          const id = wrapper["@_id"];
          const innerCell = wrapper.mxCell || {};
          // Spread innerCell FIRST so explicit wrapper keys take precedence
          const {
            "@_id": _innerId,
            "@_value": _innerVal,
            ...safeInnerCell
          } = innerCell;
          cells.push({
            type: "UserObject",
            ...safeInnerCell,
            "@_id": id,
            "@_value": wrapper["@_label"] || wrapper["@_value"],
          });
        }
      }
    }
  }
  return cells;
}

/**
 * Validate a single .drawio file.
 */
async function validateDrawioFile(filePath) {
  const content = fs.readFileSync(filePath, "utf-8").trim();

  if (!content) {
    console.error(`❌ ${filePath}: Empty file`);
    errors++;
    return;
  }

  // Check 1: Valid XML
  let parsed;
  try {
    parsed = await parseXml(content);
  } catch (e) {
    console.error(`❌ ${filePath}: Invalid XML — ${e.message}`);
    errors++;
    return;
  }

  // Check 2: Root element is <mxfile>
  if (!parsed.mxfile) {
    // Allow bare <mxGraphModel> as simplified format
    if (parsed.mxGraphModel) {
      console.warn(
        `⚠️  ${filePath}: Uses simplified mxGraphModel format (no mxfile wrapper)`,
      );
      warnings++;
    } else {
      console.error(
        `❌ ${filePath}: Root element must be <mxfile> or <mxGraphModel>`,
      );
      errors++;
      return;
    }
  }

  // Get diagrams
  const mxfile = parsed.mxfile || {};
  let diagrams = mxfile.diagram;
  if (!diagrams && parsed.mxGraphModel) {
    // Simplified format — wrap in a synthetic diagram
    diagrams = [{ "@_id": "synthetic", mxGraphModel: parsed.mxGraphModel }];
  }
  if (!diagrams) {
    console.error(`❌ ${filePath}: No <diagram> elements found`);
    errors++;
    return;
  }
  diagrams = Array.isArray(diagrams) ? diagrams : [diagrams];

  // Check 3: Unique diagram IDs
  const diagramIds = new Set();
  for (const diagram of diagrams) {
    const id = diagram["@_id"];
    if (id && diagramIds.has(id)) {
      console.error(`❌ ${filePath}: Duplicate diagram id="${id}"`);
      errors++;
    }
    if (id) diagramIds.add(id);
  }

  let totalCells = 0;
  let totalImages = 0;

  for (const diagram of diagrams) {
    const model = diagram.mxGraphModel;
    if (!model) {
      console.warn(`⚠️  ${filePath}: Diagram has no mxGraphModel`);
      warnings++;
      continue;
    }

    const rootElem = model.root;
    if (!rootElem) {
      console.error(`❌ ${filePath}: mxGraphModel missing <root>`);
      errors++;
      continue;
    }

    const cells = extractCells(rootElem);
    totalCells += cells.length;

    // Check 4: Structural cells (id="0" and id="1")
    const hasRoot = cells.some((c) => c["@_id"] === "0");
    const hasLayer = cells.some(
      (c) => c["@_id"] === "1" && c["@_parent"] === "0",
    );
    if (!hasRoot) {
      console.error(`❌ ${filePath}: Missing structural cell <mxCell id="0"/>`);
      errors++;
    }
    if (!hasLayer) {
      console.error(
        `❌ ${filePath}: Missing structural cell <mxCell id="1" parent="0"/>`,
      );
      errors++;
    }

    // Check 5: Unique cell IDs
    const cellIds = new Set();
    let duplicateCells = 0;
    for (const cell of cells) {
      const id = cell["@_id"];
      if (!id) continue;
      if (cellIds.has(id)) {
        duplicateCells++;
      } else {
        cellIds.add(id);
      }
    }
    if (duplicateCells > 0) {
      console.error(`❌ ${filePath}: ${duplicateCells} duplicate cell ID(s)`);
      errors++;
    }

    // Content cells (not structural)
    const contentCells = cells.filter(
      (c) => c["@_id"] !== "0" && !(c["@_id"] === "1" && c["@_parent"] === "0"),
    );

    for (const cell of contentCells) {
      const id = cell["@_id"] || "unknown";

      // Check 6: Valid parent references
      if (cell["@_parent"]) {
        if (!cellIds.has(cell["@_parent"])) {
          console.error(
            `❌ ${filePath}: Cell id="${id}" references non-existent parent="${cell["@_parent"]}"`,
          );
          errors++;
        }
      } else if (cell["@_id"] !== "0") {
        const isLayer = cells.some(
          (other) => other["@_parent"] === cell["@_id"],
        );
        if (!isLayer) {
          console.warn(
            `⚠️  ${filePath}: Cell id="${id}" has no parent attribute`,
          );
          warnings++;
        }
      }

      // Check 7: vertex/edge exclusive
      const isVertex = cell["@_vertex"] === "1";
      const isEdge = cell["@_edge"] === "1";
      if (isVertex && isEdge) {
        console.error(
          `❌ ${filePath}: Cell id="${id}" has both vertex="1" and edge="1"`,
        );
        errors++;
      }

      // Check 8: Edge source/target references
      if (isEdge) {
        const source = cell["@_source"];
        const target = cell["@_target"];
        if (source && !cellIds.has(source)) {
          console.error(
            `❌ ${filePath}: Edge id="${id}" references non-existent source="${source}"`,
          );
          errors++;
        }
        if (target && !cellIds.has(target)) {
          console.error(
            `❌ ${filePath}: Edge id="${id}" references non-existent target="${target}"`,
          );
          errors++;
        }
      }

      // Check 10: Style format (basic validation)
      const style = cell["@_style"];
      if (style && typeof style === "string") {
        // Check for spaces around = in key=value pairs (common AI mistake)
        // Split by semicolons and check each key=value pair individually
        // to avoid false positives on data URI content
        const styleParts = style.split(";").filter((p) => p.trim());
        for (const part of styleParts) {
          // Skip parts that contain data URIs (base64 content)
          if (part.includes("data:") || part.includes("base64,")) continue;
          // Check for space around = in the key name (before any value content)
          const eqIdx = part.indexOf("=");
          if (eqIdx > 0) {
            const key = part.substring(0, eqIdx);
            if (/\s/.test(key)) {
              console.warn(
                `⚠️  ${filePath}: Cell id="${id}" has spaces in style key "${key.trim()}"`,
              );
              warnings++;
            }
          }
        }

        // Track image cells (data URI icons, draw.io built-in icons, and mxgraph stencils)
        if (
          style.includes("shape=image") ||
          style.includes("image=data:") ||
          style.includes("image=img/lib/") ||
          style.includes("shape=mxgraph.azure.")
        ) {
          totalImages++;

          // Validate base64 payload integrity (catch silent corruption)
          const b64Match = style.match(
            /image=data:image\/svg\+xml;base64,([A-Za-z0-9+/=\s]+)/,
          );
          if (b64Match) {
            const payload = b64Match[1];
            // Check for whitespace inside the base64 string (corruption indicator)
            if (/\s/.test(payload)) {
              console.error(
                `❌ ${filePath}: Cell id="${id}" has corrupted base64 icon payload (contains whitespace)`,
              );
              errors++;
            }
            // Check minimum viable SVG payload length (a real Azure icon is >200 chars)
            if (payload.replace(/[=\s]/g, "").length < 100) {
              console.warn(
                `⚠️  ${filePath}: Cell id="${id}" has suspiciously short base64 icon payload (${payload.length} chars)`,
              );
              warnings++;
            }
          }
        }

        // Check 11: Perimeter match for non-rectangular shapes
        const perimeterShapes = {
          ellipse: "ellipsePerimeter",
          rhombus: "rhombusPerimeter",
          triangle: "trianglePerimeter",
          hexagon: "hexagonPerimeter2",
          parallelogram: "parallelogramPerimeter",
          trapezoid: "trapezoidPerimeter",
        };
        for (const [shapeName, expectedPerimeter] of Object.entries(
          perimeterShapes,
        )) {
          // Check if shape is set as bare token or via shape= key
          const hasShape =
            style.startsWith(shapeName + ";") ||
            style.includes(";" + shapeName + ";") ||
            style.includes("shape=" + shapeName);
          if (hasShape && !style.includes("perimeter=" + expectedPerimeter)) {
            console.warn(
              `⚠️  ${filePath}: Cell id="${id}" uses shape "${shapeName}" without perimeter=${expectedPerimeter}`,
            );
            warnings++;
          }
        }
      }

      // Check 9 & 13: Geometry validation for vertices
      if (isVertex) {
        if (!cell.mxGeometry) {
          console.warn(
            `⚠️  ${filePath}: Vertex id="${id}" has no mxGeometry element`,
          );
          warnings++;
        } else {
          const geo = cell.mxGeometry;
          const w = parseFloat(geo["@_width"]);
          const h = parseFloat(geo["@_height"]);
          if (w < 0 || h < 0) {
            console.error(
              `❌ ${filePath}: Cell id="${id}" has negative dimensions (${w}x${h})`,
            );
            errors++;
          }
        }
      }

      // Check 9 (edges): Verify edge geometry has relative="1"
      if (isEdge && cell.mxGeometry) {
        if (cell.mxGeometry["@_relative"] !== "1") {
          console.warn(
            `⚠️  ${filePath}: Edge id="${id}" geometry missing relative="1"`,
          );
          warnings++;
        }
      }

      // Check 12: HTML escaping in value attributes
      const value = cell["@_value"];
      if (
        value &&
        typeof value === "string" &&
        style &&
        style.includes("html=1")
      ) {
        if (
          /<[^>]+>/.test(value) &&
          !value.includes("&lt;") &&
          !value.includes("&gt;")
        ) {
          // Raw HTML tags in value attribute with html=1 — these should be XML-escaped
          // Note: fast-xml-parser already unescapes, so we check the raw file for this
          // This check catches the most obvious case where HTML is present but not escaped
          console.warn(
            `⚠️  ${filePath}: Cell id="${id}" may have unescaped HTML in value`,
          );
          warnings++;
        }
      }
    }

    // Check 14: Group coordinate hierarchy
    // Children of groups/containers must use coordinates relative to the parent,
    // not the canvas. If a child's x or y exceeds the parent's width or height,
    // it's likely using canvas coordinates by mistake.
    const geoMap = new Map();
    for (const cell of cells) {
      if (cell["@_id"] && cell.mxGeometry) {
        const geo = cell.mxGeometry;
        geoMap.set(cell["@_id"], {
          x: parseFloat(geo["@_x"] || geo["@_x"] || 0),
          y: parseFloat(geo["@_y"] || 0),
          w: parseFloat(geo["@_width"] || 0),
          h: parseFloat(geo["@_height"] || 0),
        });
      }
    }

    for (const cell of contentCells) {
      const parentId = cell["@_parent"];
      const id = cell["@_id"] || "unknown";
      // Skip layer-level cells and edges
      if (!parentId || parentId === "0" || parentId === "1") continue;
      if (cell["@_edge"] === "1") continue;
      if (!cell.mxGeometry) continue;

      const parentGeo = geoMap.get(parentId);
      if (!parentGeo || parentGeo.w === 0 || parentGeo.h === 0) continue;

      const childX = parseFloat(cell.mxGeometry["@_x"] || 0);
      const childY = parseFloat(cell.mxGeometry["@_y"] || 0);

      // A child positioned far outside its parent likely used canvas coords
      // Allow small overshoot (labels can extend slightly beyond container)
      const tolerance = 50;
      if (
        childX > parentGeo.w + tolerance ||
        childY > parentGeo.h + tolerance
      ) {
        console.warn(
          `⚠️  ${filePath}: Cell id="${id}" at (${childX},${childY}) may use canvas coords instead of parent-relative (parent "${parentId}" is ${parentGeo.w}×${parentGeo.h})`,
        );
        warnings++;
      }
    }
  }

  // Azure icon embedding validation for architecture deliverables
  const normalizedPath = filePath.replaceAll("\\", "/");
  if (ICON_REQUIRED_PATTERN.test(normalizedPath)) {
    if (totalImages === 0) {
      console.error(
        `❌ ${filePath}: Architecture deliverable has no embedded Azure icons (image cells)`,
      );
      errors++;
    }
  }

  filesChecked++;
  console.log(
    `✅ ${filePath}: Valid (${totalCells} cells, ${totalImages} images)`,
  );
}

// Main
const allFiles = [];
for (const dir of SCAN_DIRS) {
  allFiles.push(...findDrawioFiles(dir));
}

if (allFiles.length === 0) {
  console.log("ℹ️  No .drawio files found to validate");
  process.exit(0);
}

for (const file of allFiles) {
  await validateDrawioFile(file);
}

// Sync local counters to Reporter for consistent summary output
_r.errors = errors;
_r.warnings = warnings;
_r.checked = filesChecked;
_r.summary("Draw.io validation");
_r.exitOnError(
  "Draw.io validation passed",
  `${errors} draw.io validation error(s) found`,
);
