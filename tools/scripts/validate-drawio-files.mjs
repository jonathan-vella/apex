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
 * node tools/scripts/validate-drawio-files.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { Reporter } from "./_lib/reporter.mjs";

const _r = new Reporter("Draw.io File Validation");

// Directories to scan for .drawio files
const SCAN_DIRS = ["agent-output", "assets", ".github/skills/drawio", "tmp", "site/public/demo"];

// Architecture deliverables that MUST have Azure icons
const ICON_REQUIRED_PATTERN =
  /(?:^|\/)(03-des-diagram|04-dependency-diagram|04-runtime-diagram|07-ab-diagram|showcase-[^/]+)\.drawio$/;

// APEX visual-quality palette (see .github/skills/drawio/references/style-reference.md).
// Container fills on architecture deliverables should come from this set.
// Advisory in 0.11.x, blocking in 0.12.0 when APEX_DRAWIO_RUBRIC=strict.
const APEX_PALETTE = new Set([
  "#e7f5ff", // compute
  "#fff2cc", // data
  "#ffe6e6", // security
  "#e6f5e6", // networking
  "#f5f5f5", // governance/ops
  // Stock draw.io palette fills allowed for non-container shapes:
  "#dae8fc",
  "#d5e8d4",
  "#f8cecc",
  "#e1d5e7",
  "#ffe6cc",
  "none",
  "default",
  "#ffffff",
  "#fff",
]);

const RUBRIC_MODE = (process.env.APEX_DRAWIO_RUBRIC || "advisory").toLowerCase();

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
        const wrappers = Array.isArray(item[wrapperName]) ? item[wrapperName] : [item[wrapperName]];
        for (const wrapper of wrappers) {
          const id = wrapper["@_id"];
          const innerCell = wrapper.mxCell || {};
          // Spread innerCell FIRST so explicit wrapper keys take precedence
          const { "@_id": _innerId, "@_value": _innerVal, ...safeInnerCell } = innerCell;
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
      console.warn(`⚠️  ${filePath}: Uses simplified mxGraphModel format (no mxfile wrapper)`);
      warnings++;
    } else {
      console.error(`❌ ${filePath}: Root element must be <mxfile> or <mxGraphModel>`);
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
  // File-level aggregators for T-008 type-fit and T-010 legend-presence.
  // These checks need cross-diagram (multi-page) state — e.g., G6 has 3 pages
  // but only the overview should carry the legend; trust boundary applies to
  // the architecture, not each page.
  const fileWide = {
    imageCellCount: 0,
    legendFound: false,
    hasPublicIngress: false,
    hasTrustBoundary: false,
    hasVNetContainer: false, // for sequence type-fit check
    vnetContainerSampleValue: "",
  };

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
    const hasLayer = cells.some((c) => c["@_id"] === "1" && c["@_parent"] === "0");
    if (!hasRoot) {
      console.error(`❌ ${filePath}: Missing structural cell <mxCell id="0"/>`);
      errors++;
    }
    if (!hasLayer) {
      console.error(`❌ ${filePath}: Missing structural cell <mxCell id="1" parent="0"/>`);
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
    const contentCells = cells.filter((c) => c["@_id"] !== "0" && !(c["@_id"] === "1" && c["@_parent"] === "0"));

    for (const cell of contentCells) {
      const id = cell["@_id"] || "unknown";

      // Check 6: Valid parent references
      if (cell["@_parent"]) {
        if (!cellIds.has(cell["@_parent"])) {
          console.error(`❌ ${filePath}: Cell id="${id}" references non-existent parent="${cell["@_parent"]}"`);
          errors++;
        }
      } else if (cell["@_id"] !== "0") {
        const isLayer = cells.some((other) => other["@_parent"] === cell["@_id"]);
        if (!isLayer) {
          console.warn(`⚠️  ${filePath}: Cell id="${id}" has no parent attribute`);
          warnings++;
        }
      }

      // Check 7: vertex/edge exclusive
      const isVertex = cell["@_vertex"] === "1";
      const isEdge = cell["@_edge"] === "1";
      if (isVertex && isEdge) {
        console.error(`❌ ${filePath}: Cell id="${id}" has both vertex="1" and edge="1"`);
        errors++;
      }

      // Check 8: Edge source/target references
      if (isEdge) {
        const source = cell["@_source"];
        const target = cell["@_target"];
        if (source && !cellIds.has(source)) {
          console.error(`❌ ${filePath}: Edge id="${id}" references non-existent source="${source}"`);
          errors++;
        }
        if (target && !cellIds.has(target)) {
          console.error(`❌ ${filePath}: Edge id="${id}" references non-existent target="${target}"`);
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
              console.warn(`⚠️  ${filePath}: Cell id="${id}" has spaces in style key "${key.trim()}"`);
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
          const b64Match = style.match(/image=data:image\/svg\+xml;base64,([A-Za-z0-9+/=\s]+)/);
          if (b64Match) {
            const payload = b64Match[1];
            // Check for whitespace inside the base64 string (corruption indicator)
            if (/\s/.test(payload)) {
              console.error(`❌ ${filePath}: Cell id="${id}" has corrupted base64 icon payload (contains whitespace)`);
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
        for (const [shapeName, expectedPerimeter] of Object.entries(perimeterShapes)) {
          // Check if shape is set as bare token or via shape= key
          const hasShape =
            style.startsWith(`${shapeName};`) ||
            style.includes(`;${shapeName};`) ||
            style.includes(`shape=${shapeName}`);
          if (hasShape && !style.includes(`perimeter=${expectedPerimeter}`)) {
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
          console.warn(`⚠️  ${filePath}: Vertex id="${id}" has no mxGeometry element`);
          warnings++;
        } else {
          const geo = cell.mxGeometry;
          const w = parseFloat(geo["@_width"]);
          const h = parseFloat(geo["@_height"]);
          if (w < 0 || h < 0) {
            console.error(`❌ ${filePath}: Cell id="${id}" has negative dimensions (${w}x${h})`);
            errors++;
          }
        }
      }

      // Check 9 (edges): Verify edge geometry has relative="1"
      if (isEdge && cell.mxGeometry) {
        if (cell.mxGeometry["@_relative"] !== "1") {
          console.warn(`⚠️  ${filePath}: Edge id="${id}" geometry missing relative="1"`);
          warnings++;
        }
      }

      // Check 12: HTML escaping in value attributes
      //
      // We must check the RAW file content here, not the parsed value.
      // `fast-xml-parser` decodes character entities by default
      // (`processEntities: true`), so a properly escaped value like
      // `&lt;font&gt;` shows up as `<font>` in `cell["@_value"]` — which
      // would make the original "decoded contains tags + missing &lt;"
      // heuristic flag every legitimately escaped cell.
      //
      // Instead, find this cell's opening tag in the raw XML and
      // confirm the literal `value="..."` substring contains no
      // unescaped `<` or `>` characters.
      const value = cell["@_value"];
      if (
        value &&
        typeof value === "string" &&
        style &&
        style.includes("html=1") &&
        /<[^>]+>/.test(value) // decoded value has tags — worth a raw check
      ) {
        const idEsc = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const openTagRe = new RegExp(`<(?:mxCell|UserObject|object)\\s+[^>]*\\bid="${idEsc}"[^>]*>`);
        const match = content.match(openTagRe);
        const valueAttrRe = /\bvalue="([^"]*)"/;
        const rawValue = match && match[0].match(valueAttrRe)?.[1];
        // Truly unescaped only if the raw substring contains a `<`
        // followed by characters that look like a tag (not part of
        // `&lt;`).
        if (rawValue && /<[^&>]+>/.test(rawValue)) {
          console.warn(`⚠️  ${filePath}: Cell id="${id}" may have unescaped HTML in value`);
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
      if (childX > parentGeo.w + tolerance || childY > parentGeo.h + tolerance) {
        console.warn(
          `⚠️  ${filePath}: Cell id="${id}" at (${childX},${childY}) may use canvas coords instead of parent-relative (parent "${parentId}" is ${parentGeo.w}×${parentGeo.h})`,
        );
        warnings++;
      }
    }

    // Check 15: Sibling AABB overlap (T-006)
    // Detects axis-aligned bounding-box collisions between sibling icon (image)
    // cells. Catches the dominant failure mode in the T-012 baseline
    // (label collisions: SqlHTTPS, AMIAML SDKace, Web App 1Web App 2).
    //
    // Rules:
    // - Only architecture deliverables (matches ICON_REQUIRED_PATTERN) — same
    //   scope as palette check.
    // - Vertex-vertex only (skip edges, which are paths not boxes).
    // - Both cells must be image cells (have shape=image or image= in style)
    //   — these are the icon vertices whose label collisions cause the
    //   SqlHTTPS-family bug. Container/group cells are skipped.
    // - Significant overlap only: intersection area must exceed MIN_OVERLAP_AREA
    //   (50 px²) AND >=10% of the smaller box's area to filter clipping.
    // - Coordinates resolved to canvas-absolute via parent walk so sibling
    //   comparisons are meaningful across different parent groups.
    // - Cap reports at MAX_REPORTS per file to avoid spam.
    // - Decision D-OQ3: false-positive ceiling fixed at <=5%. Tuned against
    //   the 7 captured baseline diagrams in tools/tests/drawio-baseline/.
    // - Advisory by default; APEX_DRAWIO_RUBRIC=strict promotes to error.
    if (ICON_REQUIRED_PATTERN.test(filePath.replaceAll("\\", "/"))) {
      const MIN_OVERLAP_AREA = 50;
      const OVERLAP_FRACTION = 0.1;
      const MAX_REPORTS = 8;

      const parentMap = new Map();
      for (const cell of cells) {
        if (cell["@_id"]) {
          parentMap.set(cell["@_id"], cell["@_parent"]);
        }
      }
      const absCache = new Map();
      function getAbs(id) {
        if (absCache.has(id)) return absCache.get(id);
        const geo = geoMap.get(id);
        if (!geo) return null;
        let x = geo.x;
        let y = geo.y;
        let pid = parentMap.get(id);
        while (pid && pid !== "0" && pid !== "1") {
          const pGeo = geoMap.get(pid);
          if (!pGeo) break;
          x += pGeo.x;
          y += pGeo.y;
          pid = parentMap.get(pid);
        }
        const abs = { x, y, w: geo.w, h: geo.h };
        absCache.set(id, abs);
        return abs;
      }

      const iconCells = [];
      for (const cell of contentCells) {
        const id = cell["@_id"];
        if (!id) continue;
        if (cell["@_edge"] === "1") continue;
        const style = cell["@_style"] || "";
        const isImage = /(?:^|;)\s*shape\s*=\s*image\b/i.test(style) || /(?:^|;)\s*image\s*=/i.test(style);
        if (!isImage) continue;
        const abs = getAbs(id);
        if (!abs || abs.w <= 0 || abs.h <= 0) continue;
        // Estimate the rendered label box that Draw.io draws below the icon.
        // Default Azure-icon style places the label under the icon
        // (verticalLabelPosition=bottom). Label width is governed by the text
        // length * approximate per-character pixel width at the configured
        // font size; height is a fixed line height.
        // Known root-cause from T-012 baseline: Web App 1 / Web App 2 sat at
        // 48-px-wide icons spaced 10 px apart, but their ~80-px label boxes
        // visually fused into "Web App 1Web App 2".
        const value = (cell["@_value"] || "").toString();
        // Strip HTML tags + entities for a fair character count.
        const valueLen = value.replace(/&[#a-zA-Z0-9]+;/g, "x").replace(/<[^>]+>/g, "").length;
        // Match font-size from style if explicitly set; default 11 (skill convention).
        const fsMatch = style.match(/fontSize\s*=\s*([0-9]+(?:\.[0-9]+)?)/i);
        const fontSize = fsMatch ? parseFloat(fsMatch[1]) : 11;
        // ~0.7 em per character for sans-serif at small sizes (incl. padding);
        // tuned against the T-012 baseline so that Web App 1 / Web App 2 at
        // 48 px icons spaced 10 px apart trigger the check.
        const labelW = Math.max(0, Math.min(240, valueLen * fontSize * 0.7));
        const labelH = Math.round(fontSize * 1.4);
        // Label box is centered horizontally on the icon and sits below it.
        const renderedX = abs.x - Math.max(0, (labelW - abs.w) / 2);
        const renderedW = Math.max(abs.w, labelW);
        const renderedY = abs.y;
        const renderedH = abs.h + labelH;
        iconCells.push({
          id,
          x: renderedX,
          y: renderedY,
          w: renderedW,
          h: renderedH,
          // Keep raw icon AABB available for diagnostics.
          iconBox: abs,
        });
      }

      let reports = 0;
      const reportedPairs = new Set();
      for (let i = 0; i < iconCells.length && reports < MAX_REPORTS; i++) {
        for (let j = i + 1; j < iconCells.length && reports < MAX_REPORTS; j++) {
          const a = iconCells[i];
          const b = iconCells[j];
          const ix1 = Math.max(a.x, b.x);
          const iy1 = Math.max(a.y, b.y);
          const ix2 = Math.min(a.x + a.w, b.x + b.w);
          const iy2 = Math.min(a.y + a.h, b.y + b.h);
          const iw = ix2 - ix1;
          const ih = iy2 - iy1;
          if (iw <= 0 || ih <= 0) continue;
          const overlapArea = iw * ih;
          if (overlapArea < MIN_OVERLAP_AREA) continue;
          const minBoxArea = Math.min(a.w * a.h, b.w * b.h);
          if (overlapArea < OVERLAP_FRACTION * minBoxArea) continue;
          const key = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
          if (reportedPairs.has(key)) continue;
          reportedPairs.add(key);
          const msg = `Sibling icon overlap (T-006): cells "${a.id}" and "${b.id}" share ${Math.round(overlapArea)} px² of bounding-box (${Math.round((overlapArea / minBoxArea) * 100)}% of smaller). Likely label collision — see .github/skills/drawio/references/quality-rubric.md (Dimension 5).`;
          if (RUBRIC_MODE === "strict") {
            console.error(`❌ ${filePath}: ${msg}`);
            errors++;
          } else {
            console.warn(`⚠️  ${filePath}: ${msg}`);
            warnings++;
          }
          reports++;
        }
      }
      if (reports >= MAX_REPORTS) {
        const note = `Sibling icon overlap (T-006): max report cap (${MAX_REPORTS}) reached; further collisions suppressed`;
        if (RUBRIC_MODE === "strict") {
          console.error(`❌ ${filePath}: ${note}`);
        } else {
          console.warn(`⚠️  ${filePath}: ${note}`);
        }
      }
    }

    // Check 16: Per-page density (T-007)
    // Threshold from quality-rubric.md: density.warn_cells_per_sqpx = 1/4000.
    // Density = total cells / (canvas-bounding-box area). Canvas area is
    // computed from the union AABB of all positioned cells. Skip when
    // canvas area is unrealistically small (placeholder diagrams).
    if (ICON_REQUIRED_PATTERN.test(filePath.replaceAll("\\", "/"))) {
      let maxX = 0;
      let maxY = 0;
      let positionedCells = 0;
      for (const [, geo] of geoMap) {
        if (geo.w > 0 && geo.h > 0) {
          maxX = Math.max(maxX, geo.x + geo.w);
          maxY = Math.max(maxY, geo.y + geo.h);
          positionedCells++;
        }
      }
      const canvasArea = maxX * maxY;
      const MIN_CANVAS_AREA = 100000; // 1000 x 100 px sanity floor
      if (canvasArea > MIN_CANVAS_AREA && positionedCells > 0) {
        const density = positionedCells / canvasArea;
        const WARN_DENSITY = 1 / 4000;
        const FAIL_DENSITY = 1 / 2500;
        if (density > FAIL_DENSITY) {
          const msg = `Page density (T-007): ${positionedCells} cells in ${Math.round(canvasArea / 1000)}k px² = 1 cell per ${Math.round(1 / density)} px² (target ≤ 1/2500). Decompose per references/large-architecture-decomposition.md.`;
          if (RUBRIC_MODE === "strict") {
            console.error(`❌ ${filePath}: ${msg}`);
            errors++;
          } else {
            console.warn(`⚠️  ${filePath}: ${msg}`);
            warnings++;
          }
        } else if (density > WARN_DENSITY) {
          console.warn(
            `⚠️  ${filePath}: Page density (T-007): ${positionedCells} cells in ${Math.round(canvasArea / 1000)}k px² = 1 cell per ${Math.round(1 / density)} px² (warn at 1/4000)`,
          );
          warnings++;
        }
      }
    }

    // Check 17: Semantic zone-presence (T-009)
    // When image-cell count exceeds the threshold, require at least one
    // container/group cell. Threshold from quality-rubric.md:
    // semantics.min_resources_for_zone = 10.
    if (ICON_REQUIRED_PATTERN.test(filePath.replaceAll("\\", "/"))) {
      const MIN_FOR_ZONE = 10;
      let imageCellCount = 0;
      let containerCount = 0;
      for (const cell of contentCells) {
        const style = cell["@_style"] || "";
        if (/(?:^|;)\s*shape\s*=\s*image\b/i.test(style) || /(?:^|;)\s*image\s*=/i.test(style)) {
          imageCellCount++;
        }
        if (/(?:^|;)\s*container\s*=\s*1\b/i.test(style)) {
          containerCount++;
        }
      }
      if (imageCellCount >= MIN_FOR_ZONE && containerCount === 0) {
        const msg = `Semantic zone-presence (T-009): ${imageCellCount} icons with no container/group cell. Add a zone per references/semantic-zones.md.`;
        if (RUBRIC_MODE === "strict") {
          console.error(`❌ ${filePath}: ${msg}`);
          errors++;
        } else {
          console.warn(`⚠️  ${filePath}: ${msg}`);
          warnings++;
        }
      }
    }

    // Check 18: Legend presence (T-010) — file-level accumulator
    // When image-cell count exceeds the threshold AND the filename does NOT
    // match a sequence-type pattern (04-runtime-*), require a legend cell
    // somewhere in the file (overview page for decomposed sets per
    // references/legend-template.md). OQ-2 carve-out: sequence diagrams omit
    // the legend. Threshold from quality-rubric.md:
    // labels.min_image_cells_for_legend = 8.
    {
      const legendMarkers = [
        /\blegend\b/i,
        /\u2192/, // → arrow (right)
        /\u2194/, // ↔ left-right arrow
        /\u25b6/, // ▶ play / variant marker
        /\u2933/, // ⤳ wave arrow (async)
        /\u22ef/, // ⋯ horizontal ellipsis (dotted)
      ];
      for (const cell of contentCells) {
        const style = cell["@_style"] || "";
        if (/(?:^|;)\s*shape\s*=\s*image\b/i.test(style) || /(?:^|;)\s*image\s*=/i.test(style)) {
          fileWide.imageCellCount++;
        }
        if (!fileWide.legendFound) {
          const value = (cell["@_value"] || "").toString();
          if (legendMarkers.some((re) => re.test(value))) {
            fileWide.legendFound = true;
          }
        }
      }
    }

    // Check 19: Type-fit signature (T-008) — file-level accumulator
    // Filename pattern → expected diagram type → expected signatures.
    // Per references/diagram-types.md.
    {
      const publicIngressMarkers = [/Front Door/i, /Application Gateway/i, /API Management/i, /\bAPIM\b/];
      for (const cell of contentCells) {
        const value = (cell["@_value"] || "").toString();
        const style = cell["@_style"] || "";
        if (publicIngressMarkers.some((re) => re.test(value))) {
          fileWide.hasPublicIngress = true;
        }
        // Trust boundary: a CONTAINER cell with either red stroke #B85450
        // (per semantic-zones.md trust-boundary template) or "Trust" in value.
        // Restricted to containers to avoid false positives on icons that
        // happen to use red accents.
        const isContainer = /(?:^|;)\s*container\s*=\s*1\b/i.test(style);
        if (isContainer && (/strokeColor\s*=\s*#B85450/i.test(style) || /\bTrust\b/i.test(value))) {
          fileWide.hasTrustBoundary = true;
        }
        // VNet container (for sequence-type warning)
        if (
          /(?:^|;)\s*container\s*=\s*1\b/i.test(style) &&
          (/\bVNet\b/i.test(value) || /\bVirtual Network\b/i.test(value))
        ) {
          if (!fileWide.hasVNetContainer) {
            fileWide.hasVNetContainer = true;
            fileWide.vnetContainerSampleValue = value.slice(0, 60);
          }
        }
      }
    }
  }

  // File-level emission for T-010 legend-presence and T-008 type-fit.
  // These checks aggregate across all diagrams in the file (e.g., G6 has 3
  // pages; only the overview should carry the legend per legend-template.md).
  {
    const norm = filePath.replaceAll("\\", "/");
    const isArch = ICON_REQUIRED_PATTERN.test(norm);
    const isSequence = /(?:^|\/)04-runtime-diagram\.drawio$/.test(norm);
    const isDes = /(?:^|\/)03-des-diagram\.drawio$/.test(norm);
    if (isArch) {
      // T-010 legend presence (skip for sequence per OQ-2 carve-out)
      const MIN_FOR_LEGEND = 8;
      if (!isSequence && fileWide.imageCellCount >= MIN_FOR_LEGEND && !fileWide.legendFound) {
        const msg = `Legend presence (T-010): ${fileWide.imageCellCount} icons across ${diagrams.length} page(s) with no legend cell. Add per references/legend-template.md.`;
        if (RUBRIC_MODE === "strict") {
          console.error(`❌ ${filePath}: ${msg}`);
          errors++;
        } else {
          console.warn(`⚠️  ${filePath}: ${msg}`);
          warnings++;
        }
      }
      // T-008 type-fit signature
      if (isSequence && fileWide.hasVNetContainer) {
        const msg = `Type-fit signature (T-008): sequence diagram has a VNet container ("${fileWide.vnetContainerSampleValue}"). Sequence type uses logical zones (Ingress/Processing/Persistence) per references/diagram-types.md.`;
        if (RUBRIC_MODE === "strict") {
          console.error(`❌ ${filePath}: ${msg}`);
          errors++;
        } else {
          console.warn(`⚠️  ${filePath}: ${msg}`);
          warnings++;
        }
      }
      if (isDes && fileWide.hasPublicIngress && !fileWide.hasTrustBoundary) {
        const msg = `Type-fit signature (T-008): public-ingress shapes (Front Door / App Gateway / APIM) without a trust-boundary cell. Add per references/semantic-zones.md.`;
        if (RUBRIC_MODE === "strict") {
          console.error(`❌ ${filePath}: ${msg}`);
          errors++;
        } else {
          console.warn(`⚠️  ${filePath}: ${msg}`);
          warnings++;
        }
      }
    }
  }

  // Azure icon embedding validation for architecture deliverables
  const normalizedPath = filePath.replaceAll("\\", "/");
  if (ICON_REQUIRED_PATTERN.test(normalizedPath)) {
    if (totalImages === 0) {
      console.error(`❌ ${filePath}: Architecture deliverable has no embedded Azure icons (image cells)`);
      errors++;
    }

    // APEX visual-quality rubric: palette-drift advisory.
    // Collect fillColor values from content cells and flag any that fall
    // outside the approved palette. Advisory-only until 0.12.0 unless
    // APEX_DRAWIO_RUBRIC=strict.
    const offenders = new Set();
    for (const diagram of diagrams) {
      const root = diagram.mxGraphModel?.root;
      if (!root) continue;
      const cells = extractCells(root);
      for (const cell of cells) {
        const style = cell["@_style"] || "";
        const match = style.match(/fillColor=([^;]+)/i);
        if (!match) continue;
        const color = match[1].trim().toLowerCase();
        if (!APEX_PALETTE.has(color)) offenders.add(color);
      }
    }
    if (offenders.size > 0) {
      const msg = `APEX palette drift on architecture deliverable — unexpected fillColor(s): ${[...offenders].join(", ")} (see .github/skills/drawio/references/style-reference.md)`;
      if (RUBRIC_MODE === "strict") {
        console.error(`❌ ${filePath}: ${msg}`);
        errors++;
      } else {
        console.warn(`⚠️  ${filePath}: ${msg}`);
        warnings++;
      }
    }
  }

  filesChecked++;
  console.log(`✅ ${filePath}: Valid (${totalCells} cells, ${totalImages} images)`);
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
_r.exitOnError("Draw.io validation passed", `${errors} draw.io validation error(s) found`);
