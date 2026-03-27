/**
 * Tool handlers that generate Draw.io XML directly
 * without requiring the browser extension.
 *
 * Tool handlers are stateless across invocations.
 *
 * For diagram-dependent tools, callers must pass `diagram_xml` with the full
 * current state. Handlers load a fresh DiagramModel per call and return an
 * updated `diagram_xml` in successful responses.
 */

import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { DiagramModel, StructuredError } from "./diagram_model.ts";
import { displayTitle, getAzureCategories, getAzureShapeByName, getShapesInCategory, searchAzureIcons } from "./shapes/azure_icon_library.ts";
import { BASIC_SHAPE_CATEGORIES, BASIC_SHAPES, getBasicShape } from "./shapes/basic_shapes.ts";
import { findPlaceholdersInXml, resolvePlaceholdersInXml } from "./placeholder.ts";
import { DEV_SAVED_PATH, devSaveDiagram } from "./utils.ts";
const allBasicShapes = Object.values(BASIC_SHAPES);
const allBasicShapesLower = allBasicShapes.map((s) => ({ ...s, nameLower: s.name.toLowerCase() }));
const INTERNAL_SUCCESS_DATA = Symbol("internal_success_data");

type InternalSuccessResult = CallToolResult & { [INTERNAL_SUCCESS_DATA]?: unknown };

/**
 * Resolved shape with unified dimensions and style, regardless of source (basic or Azure).
 */
interface ResolvedShape {
  name: string;
  style: string;
  width: number;
  height: number;
  source: "basic" | "azure-exact" | "azure-fuzzy";
  score?: number;
}

/**
 * Resolve a shape name to its definition by checking:
 * 1. Basic shapes (exact match, case-insensitive)
 * 2. Azure icon library (exact match by title/ID)
 * 3. Azure icon library (fuzzy search, top result)
 *
 * Results are cached because shape libraries are immutable once loaded.
 * Returns undefined if no match is found.
 */
const resolveShapeCache = new Map<string, ResolvedShape | undefined>();

/** Maximum entries before the resolve cache is cleared and rebuilt on demand. */
let maxResolveCacheSize = 10_000;

/**
 * Clear the resolveShape cache. Must be called whenever the underlying
 * shape libraries change (e.g., after resetAzureIconLibrary or initializeShapes
 * in tests).
 */
export function clearResolveShapeCache(): void {
  resolveShapeCache.clear();
}

/**
 * Override the maximum resolve-cache size. Intended for tests that need
 * to exercise the eviction branch without inserting thousands of entries.
 */
export function setMaxResolveCacheSize(size: number): void {
  maxResolveCacheSize = size;
}

/** Return the current number of entries in the resolve cache (for test assertions). */
export function getResolveCacheSize(): number {
  return resolveShapeCache.size;
}

function resolveShape(shapeName: string): ResolvedShape | undefined {
  const cacheKey = shapeName.toLowerCase();
  const cached = resolveShapeCache.get(cacheKey);
  if (cached !== undefined) return cached;
  // Distinguish "cached as not-found" from "not yet cached"
  if (resolveShapeCache.has(cacheKey)) return undefined;

  // Evict cache if it has grown too large (prevents unbounded memory growth)
  if (resolveShapeCache.size >= maxResolveCacheSize) {
    resolveShapeCache.clear();
  }

  // 1. Basic shapes first (prevents fuzzy search from hijacking names like 'start', 'end')
  const basic = getBasicShape(shapeName);
  if (basic) {
    const result: ResolvedShape = {
      name: basic.name,
      style: basic.style,
      width: basic.defaultWidth,
      height: basic.defaultHeight,
      source: "basic",
    };
    resolveShapeCache.set(cacheKey, result);
    return result;
  }

  // 2. Azure exact match by title or ID
  const azureExact = getAzureShapeByName(shapeName);
  if (azureExact) {
    const result: ResolvedShape = {
      name: displayTitle(azureExact.title),
      style: azureExact.style ?? "",
      width: azureExact.width,
      height: azureExact.height,
      source: "azure-exact",
    };
    resolveShapeCache.set(cacheKey, result);
    return result;
  }

  // 3. Azure fuzzy search as last resort
  const searchResults = searchAzureIcons(shapeName, 1);
  if (searchResults.length > 0) {
    const shape = searchResults[0];
    const result: ResolvedShape = {
      name: displayTitle(shape.title),
      style: shape.style ?? "",
      width: shape.width,
      height: shape.height,
      source: "azure-fuzzy",
      score: shape.score,
    };
    resolveShapeCache.set(cacheKey, result);
    return result;
  }

  resolveShapeCache.set(cacheKey, undefined);
  return undefined;
}

function successResult(data: any): CallToolResult {
  const result: InternalSuccessResult = {
    content: [{ type: "text", text: JSON.stringify({ success: true, data }) }],
  };
  result[INTERNAL_SUCCESS_DATA] = data;
  return result;
}

function errorResult(error: StructuredError): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify({ success: false, error }) }],
    isError: true,
  };
}

type StatefulArgs = { diagram_xml?: string; active_layer_id?: string; transactional?: boolean };

function withDiagramState<T extends StatefulArgs>(
  args: T | undefined,
  operation: (diagram: DiagramModel) => CallToolResult,
  options?: { readOnly?: boolean },
): CallToolResult {
  const normalizedArgs: StatefulArgs = args ?? {};
  const diagram = new DiagramModel();
  const transactional = normalizedArgs.transactional ?? false;

  if (normalizedArgs.diagram_xml) {
    const importResult = diagram.importXml(normalizedArgs.diagram_xml);
    if ("error" in importResult) {
      return errorResult(importResult.error);
    }
  }

  if (normalizedArgs.active_layer_id) {
    const setLayerResult = diagram.setActiveLayer(normalizedArgs.active_layer_id);
    if ("error" in setLayerResult) {
      return errorResult(setLayerResult.error);
    }
  }

  const result = operation(diagram);
  if (result.isError) {
    return result;
  }

  const internalResult = result as InternalSuccessResult;
  const dataFromInternal = internalResult[INTERNAL_SUCCESS_DATA] as
    | Record<string, unknown>
    | undefined;
  if (dataFromInternal) {
    const diagramXml = options?.readOnly ? (normalizedArgs.diagram_xml ?? diagram.toXml({ transactional })) : diagram.toXml({ transactional });

    return {
      ...result,
      content: [{
        type: "text",
        text: JSON.stringify({
          success: true,
          data: {
            ...dataFromInternal,
            diagram_xml: diagramXml,
            active_layer_id: diagram.getActiveLayer().id,
          },
        }),
      }],
    };
    // deno-coverage-ignore
  }

  // deno-coverage-ignore
  return result;
}

export interface ToolLogger {
  debug: (...args: any[]) => void;
}

export function createHandlers(logger?: ToolLogger) {
  const log = logger || { debug: () => {} };
  return {
    "delete-cell-by-id": (args: {
      diagram_xml?: string;
      cell_id: string;
    }): CallToolResult => {
      return withDiagramState(args, (diagram) => {
        const { deleted, cascadedEdgeIds } = diagram.deleteCell(args.cell_id);
        if (!deleted) {
          return errorResult({
            code: "CELL_NOT_FOUND",
            message: `Cell '${args.cell_id}' not found`,
            cell_id: args.cell_id,
            suggestion: "Use list-paged-model to see available cells",
          });
        }
        const stats = diagram.getStats();
        return successResult({
          deleted: args.cell_id,
          ...(cascadedEdgeIds.length > 0 && { cascaded_edges: cascadedEdgeIds }),
          remaining: { total_cells: stats.total_cells, vertices: stats.vertices, edges: stats.edges },
        });
      });
    },

    "edit-edges": (args: {
      diagram_xml?: string;
      edges: Array<{
        cell_id: string;
        text?: string;
        source_id?: string;
        target_id?: string;
        style?: string;
      }>;
    }): CallToolResult => {
      if (!args.edges || args.edges.length === 0) {
        return errorResult({
          code: "INVALID_INPUT",
          message: "Must provide a non-empty 'edges' array",
        });
      }
      return withDiagramState(args, (diagram) => {
        // Strip caller-provided edge anchor properties so the server's
        // symmetric anchor calculation always runs
        const sanitized = args.edges.map((e) => {
          if (e.style) {
            return {
              ...e,
              style: e.style.replace(
                /\b(exit[XY]|entry[XY]|exitD[xy]|entryD[xy])=[^;]*;?/gi,
                "",
              ),
            };
          }
          return e;
        });
        const results = diagram.batchEditEdges(sanitized);

        // Validate edge conventions and attach warnings to successful results
        const enrichedResults = results.map((r) => {
          if (r.success && r.cell?.id) {
            const warnings = diagram.validateEdgeConventions(r.cell.id);
            if (warnings.length > 0) {
              return { ...r, warnings };
            }
          }
          return r;
        });

        const successCount = enrichedResults.reduce((n, r) => n + (r.success ? 1 : 0), 0);
        const errorCount = enrichedResults.length - successCount;
        return successResult({
          summary: { total: enrichedResults.length, succeeded: successCount, failed: errorCount },
          results: enrichedResults,
        });
      });
    },

    "list-paged-model": (args: {
      diagram_xml?: string;
      page?: number;
      page_size?: number;
      filter?: { cell_type?: string };
    }): CallToolResult => {
      return withDiagramState(args, (diagram) => {
        const page = args.page ?? 0;
        const pageSize = args.page_size ?? 50;

        let cells = diagram.listCells();

        // Apply filter
        if (args.filter?.cell_type === "vertex") {
          cells = cells.filter((c) => c.type === "vertex");
        } else if (args.filter?.cell_type === "edge") {
          cells = cells.filter((c) => c.type === "edge");
        }

        // Paginate
        const start = page * pageSize;
        const pagedCells = cells.slice(start, start + pageSize);

        return successResult({
          page,
          pageSize,
          totalCells: cells.length,
          totalPages: Math.ceil(cells.length / pageSize),
          active_layer: diagram.getActiveLayer(),
          cells: pagedCells,
        });
      }, { readOnly: true });
    },

    "list-layers": (args: {
      diagram_xml?: string;
    }): CallToolResult => {
      return withDiagramState(args, (diagram) => {
        return successResult({
          layers: diagram.listLayers(),
          active_layer_id: diagram.getActiveLayer().id,
        });
      }, { readOnly: true });
    },

    "set-active-layer": (args: {
      diagram_xml?: string;
      layer_id: string;
    }): CallToolResult => {
      return withDiagramState(args, (diagram) => {
        const result = diagram.setActiveLayer(args.layer_id);
        if ("error" in result) {
          return errorResult(result.error);
        }
        return successResult({ layer: result });
      });
    },

    "create-layer": (args: {
      diagram_xml?: string;
      name: string;
    }): CallToolResult => {
      return withDiagramState(args, (diagram) => {
        const layer = diagram.createLayer(args.name);
        return successResult({ layer, total_layers: diagram.listLayers().length });
      });
    },

    "move-cell-to-layer": (args: {
      diagram_xml?: string;
      cell_id: string;
      target_layer_id: string;
    }): CallToolResult => {
      return withDiagramState(args, (diagram) => {
        const result = diagram.moveCellToLayer(args.cell_id, args.target_layer_id);
        if ("error" in result) {
          return errorResult(result.error);
        }
        return successResult({ cell: result });
      });
    },

    "export-diagram": (args: { diagram_xml?: string; compress?: boolean }): CallToolResult => {
      let savedPath: string | null = null;
      const result = withDiagramState(args, (diagram) => {
        const compressed = args?.compress ?? false;
        const xml = diagram.toXml({ compress: compressed, watermark: true });
        const stats = diagram.getStats();

        // ⚠️ DEV MODE ONLY — Save diagram to local file if SAVE_DIAGRAMS=true
        savedPath = devSaveDiagram(xml, "export-diagram");

        return successResult({
          xml,
          stats,
          compression: compressed ? { enabled: true, algorithm: "deflate-raw", encoding: "base64" } : { enabled: false },
        });
      }, { readOnly: true });
      if (savedPath) (result as any)[DEV_SAVED_PATH] = savedPath;
      return result;
    },

    "finish-diagram": (args: { diagram_xml?: string; compress?: boolean }): CallToolResult => {
      // finish-diagram replaces placeholder cells (marked with placeholder=1) with real SVG icon data
      // and optionally compresses the final XML. It does NOT use withDiagramState because it
      // works directly with XML to resolve placeholders created during transactional operations.
      if (!args?.diagram_xml) {
        return errorResult({
          code: "INVALID_INPUT",
          message: "diagram_xml is required for finish-diagram",
        });
      }

      try {
        const compress = args.compress ?? true;

        // Find all placeholders in the XML
        const placeholders = findPlaceholdersInXml(args.diagram_xml);

        if (placeholders.length === 0) {
          // No placeholders - just return the XML as-is, optionally compressed
          const diagram = new DiagramModel();
          const importResult = diagram.importXml(args.diagram_xml);
          if ("error" in importResult) {
            return errorResult(importResult.error);
          }
          const xml = diagram.toXml({ compress, watermark: true });
          const stats = diagram.getStats();

          // ⚠️ DEV MODE ONLY — Save diagram to local file if SAVE_DIAGRAMS=true
          const savedPath = devSaveDiagram(xml, "finish-diagram");

          const result = successResult({
            message: "No placeholders found - diagram already complete",
            xml,
            stats,
            resolved_count: 0,
            compression: compress ? { enabled: true, algorithm: "deflate-raw", encoding: "base64" } : { enabled: false },
          });
          // deno-coverage-ignore
          if (savedPath) (result as any)[DEV_SAVED_PATH] = savedPath;
          return result;
        }

        // Resolve placeholders to real shapes
        const shapeResolver = (shapeName: string, _placeholderId: string) => {
          const resolved = resolveShape(shapeName);
          if (resolved) {
            return {
              style: resolved.style,
              source: resolved.source,
            };
          }
          return null;
        };

        const resolutionResult = resolvePlaceholdersInXml(args.diagram_xml, shapeResolver);

        // Check if resolution failed (has error property)
        if ("xml" in resolutionResult === false) {
          // deno-coverage-ignore
          const detailsMsg = resolutionResult.details && resolutionResult.details.length > 0
            // deno-coverage-ignore
            ? `Could not resolve placeholders: ${
              // deno-coverage-ignore
              resolutionResult.details
                // deno-coverage-ignore
                .map((d: { placeholderId: string; shapeName: string }) => `"${d.shapeName}"`)
                // deno-coverage-ignore
                .join(", ")
              // deno-coverage-ignore
            }`
            // deno-coverage-ignore
            : undefined;
          return errorResult({
            code: "PLACEHOLDER_RESOLUTION_FAILED",
            message: resolutionResult.error,
            suggestion: detailsMsg,
          });
        }

        // Load the resolved XML and prepare final output
        const diagram = new DiagramModel();
        const importResult = diagram.importXml(resolutionResult.xml);
        // deno-coverage-ignore
        if ("error" in importResult) {
          // deno-coverage-ignore
          return errorResult(importResult.error);
          // deno-coverage-ignore
        }

        // Generate final XML with compression if requested
        // Note: We generate without transactional=true to get the real SVG images
        const finalXml = diagram.toXml({ compress, watermark: true });
        const stats = diagram.getStats();

        // ⚠️ DEV MODE ONLY — Save diagram to local file if SAVE_DIAGRAMS=true
        const savedPath = devSaveDiagram(finalXml, "finish-diagram");

        const result = successResult({
          message: `Resolved ${placeholders.length} ${placeholders.length === 1 ? "placeholder" : "placeholders"} to real shapes`,
          xml: finalXml,
          stats,
          resolved_count: placeholders.length,
          compression: compress ? { enabled: true, algorithm: "deflate-raw", encoding: "base64" } : { enabled: false },
        });
        // deno-coverage-ignore
        if (savedPath) (result as any)[DEV_SAVED_PATH] = savedPath;
        return result;
        // deno-coverage-ignore
      } catch (err) {
        // deno-coverage-ignore
        log.debug(`[finish-diagram] Caught error: ${err instanceof Error ? err.message : String(err)}`);
        // deno-coverage-ignore
        return errorResult({
          // deno-coverage-ignore
          code: "FINISH_DIAGRAM_ERROR",
          // deno-coverage-ignore
          message: err instanceof Error ? err.message : "Unknown error during diagram finishing",
          // deno-coverage-ignore
        });
        // deno-coverage-ignore
      }
    },

    "get-diagram-stats": (args: {
      diagram_xml?: string;
    }): CallToolResult => {
      return withDiagramState(args, (diagram) => {
        const stats = diagram.getStats();
        return successResult({ stats });
      }, { readOnly: true });
    },

    "clear-diagram": (args: {
      diagram_xml?: string;
    }): CallToolResult => {
      return withDiagramState(args, (diagram) => {
        const cleared = diagram.clear();
        return successResult({ message: "Diagram cleared", cleared });
      });
    },

    // ─── Group / Container Handlers ─────────────────────────────────

    "create-groups": (args: {
      diagram_xml?: string;
      groups: Array<{
        x?: number;
        y?: number;
        width?: number;
        height?: number;
        text: string;
        style?: string;
        temp_id?: string;
      }>;
    }): CallToolResult => {
      if (!args.groups || args.groups.length === 0) {
        return errorResult({
          code: "INVALID_INPUT",
          message: "Must provide a non-empty 'groups' array",
        });
      }

      return withDiagramState(args, (diagram) => {
        const items = args.groups.map((g) => ({
          x: g.x,
          y: g.y,
          width: g.width,
          height: g.height,
          text: g.text,
          style: g.style,
          tempId: g.temp_id,
        }));
        const results = diagram.batchCreateGroups(items);
        return successResult({
          summary: { total: results.length, succeeded: results.length, failed: 0 },
          results: results.map((r) => ({
            success: r.success,
            cell: r.cell,
            temp_id: r.tempId,
          })),
        });
      });
    },

    "add-cells-to-group": (args: {
      diagram_xml?: string;
      assignments: Array<{
        cell_id: string;
        group_id: string;
      }>;
    }): CallToolResult => {
      if (!args.assignments || args.assignments.length === 0) {
        return errorResult({
          code: "INVALID_INPUT",
          message: "Must provide a non-empty 'assignments' array",
        });
      }

      return withDiagramState(args, (diagram) => {
        const items = args.assignments.map((a) => ({
          cellId: a.cell_id,
          groupId: a.group_id,
        }));
        const results = diagram.batchAddCellsToGroup(items);
        const successCount = results.reduce((n, r) => n + (r.success ? 1 : 0), 0);
        const errorCount = results.length - successCount;
        return successResult({
          summary: { total: results.length, succeeded: successCount, failed: errorCount },
          results: results.map((r) => ({
            success: r.success,
            cell_id: r.cellId,
            group_id: r.groupId,
            ...(r.cell && { cell: r.cell }),
            // deno-coverage-ignore
            ...(r.warnings && { warnings: r.warnings }),
            ...(r.error && { error: r.error }),
          })),
        });
      });
    },

    "remove-cell-from-group": (args: {
      diagram_xml?: string;
      cell_id: string;
    }): CallToolResult => {
      return withDiagramState(args, (diagram) => {
        const result = diagram.removeCellFromGroup(args.cell_id);
        if ("error" in result) {
          return errorResult(result.error);
        }
        return successResult({ cell: result });
      });
    },

    "list-group-children": (args: {
      diagram_xml?: string;
      group_id: string;
    }): CallToolResult => {
      return withDiagramState(args, (diagram) => {
        const result = diagram.listGroupChildren(args.group_id);
        if ("error" in result) {
          return errorResult(result.error);
        }
        return successResult({ children: result, total: result.length });
      }, { readOnly: true });
    },

    "validate-group-containment": (args: {
      diagram_xml?: string;
      group_id: string;
    }): CallToolResult => {
      return withDiagramState(args, (diagram) => {
        const result = diagram.validateGroupContainment(args.group_id);
        if ("error" in result) {
          return errorResult(result.error);
        }
        return successResult({
          group: result.group,
          summary: {
            total_children: result.totalChildren,
            in_bounds_children: result.inBoundsChildren,
            out_of_bounds_children: result.outOfBoundsChildren,
          },
          warnings: result.warnings,
        });
      }, { readOnly: true });
    },

    "suggest-group-sizing": (args: {
      child_count: number;
      child_width?: number;
      child_height?: number;
      vertical_spacing?: number;
      horizontal_padding?: number;
      vertical_padding?: number;
      min_width?: number;
      min_height?: number;
    }): CallToolResult => {
      const childCount = args.child_count;
      const childWidth = args.child_width ?? 48;
      const childHeight = args.child_height ?? 48;
      const verticalSpacing = args.vertical_spacing ?? 40;
      const horizontalPadding = args.horizontal_padding ?? 40;
      const verticalPadding = args.vertical_padding ?? 40;
      const minWidth = args.min_width ?? 180;
      const minHeight = args.min_height ?? 120;

      const stackedChildrenHeight = childCount * childHeight;
      const spacingHeight = Math.max(0, childCount - 1) * verticalSpacing;
      const contentHeight = stackedChildrenHeight + spacingHeight;
      const rawWidth = childWidth + horizontalPadding * 2;
      const rawHeight = contentHeight + verticalPadding * 2;

      const recommendedWidth = Math.max(minWidth, Math.ceil(rawWidth));
      const recommendedHeight = Math.max(minHeight, Math.ceil(rawHeight));

      return successResult({
        inputs: {
          child_count: childCount,
          child_width: childWidth,
          child_height: childHeight,
          vertical_spacing: verticalSpacing,
          horizontal_padding: horizontalPadding,
          vertical_padding: verticalPadding,
          min_width: minWidth,
          min_height: minHeight,
        },
        recommended: {
          width: recommendedWidth,
          height: recommendedHeight,
        },
        formula: {
          width: "max(min_width, child_width + 2*horizontal_padding)",
          height: "max(min_height, label_height + (child_count*child_height) + ((child_count-1)*vertical_spacing) + 2*vertical_padding)",
        },
      });
    },

    // ─── Import Handler ─────────────────────────────────────────────

    "import-diagram": (args: {
      diagram_xml?: string;
      xml: string;
    }): CallToolResult => {
      return withDiagramState(args, (diagram) => {
        const result = diagram.importXml(args.xml);
        if ("error" in result) {
          return errorResult(result.error);
        }
        return successResult({
          message: `Imported ${result.pages} page(s) with ${result.cells} cell(s) and ${result.layers} layer(s)`,
          ...result,
        });
      });
    },

    "get-shape-categories": (): CallToolResult => {
      const basicCategories = [
        { id: "general", name: "General" },
        { id: "flowchart", name: "Flowchart" },
      ];
      const azureCategories = getAzureCategories().map((cat) => ({
        id: cat.toLowerCase().replace(/\s+/g, "-"),
        name: cat,
      }));

      return successResult({
        categories: [...basicCategories, ...azureCategories],
        info: "Includes basic shapes and 700+ Azure architecture icons from dwarfered/azure-architecture-icons-for-drawio.",
      });
    },

    "get-shapes-in-category": (args: {
      category_id: string;
    }): CallToolResult => {
      const categoryId = args.category_id.toLowerCase();

      // Check basic shape categories first
      const basicShapeNames = BASIC_SHAPE_CATEGORIES[categoryId];
      if (basicShapeNames) {
        const shapes = basicShapeNames
          .map((name) => BASIC_SHAPES[name])
          .filter(Boolean)
          .map((s) => ({ name: s.name, style: s.style, width: s.defaultWidth, height: s.defaultHeight }));
        return successResult({ category: categoryId, shapes, total: shapes.length });
      }

      // Check Azure categories
      const azureCategories = getAzureCategories();
      const matchingCategory = azureCategories.find(
        (cat) => cat.toLowerCase().replace(/\s+/g, "-") === categoryId,
      );

      if (matchingCategory) {
        const shapes = getShapesInCategory(matchingCategory);
        return successResult({
          category: categoryId,
          shapes: shapes.map((shape) => ({
            name: displayTitle(shape.title),
            id: shape.id,
            width: shape.width,
            height: shape.height,
          })),
          total: shapes.length,
        });
      }

      return errorResult({
        code: "CATEGORY_NOT_FOUND",
        message: `Category '${args.category_id}' not found`,
        suggestion: "Use get-shape-categories to list available categories",
      });
    },

    "set-cell-shape": (args: {
      diagram_xml?: string;
      cells: Array<{ cell_id: string; shape_name: string }>;
    }): CallToolResult => {
      if (!args.cells || args.cells.length === 0) {
        return errorResult({
          code: "INVALID_INPUT",
          message: "Must provide a non-empty 'cells' array",
        });
      }

      const getShapeStyle = (shapeName: string): string | null => {
        const resolved = resolveShape(shapeName);
        return resolved ? resolved.style : null;
      };

      return withDiagramState(args, (diagram) => {
        const results = args.cells.map((item) => {
          const style = getShapeStyle(item.shape_name);
          if (!style) {
            return {
              success: false,
              cell_id: item.cell_id,
              shape_name: item.shape_name,
              error: {
                code: "SHAPE_NOT_FOUND",
                message: `Unknown shape '${item.shape_name}'`,
                suggestion: "Use search-shapes to find available shapes",
              },
            };
          }

          const result = diagram.editCell(item.cell_id, { style });
          if ("error" in result) {
            return {
              success: false,
              cell_id: item.cell_id,
              shape_name: item.shape_name,
              error: result.error,
            };
          }

          return {
            success: true,
            cell_id: item.cell_id,
            shape_name: item.shape_name,
            cell: result,
          };
        });

        const successCount = results.reduce((n, r) => n + (r.success ? 1 : 0), 0);
        const errorCount = results.length - successCount;

        return successResult({
          summary: {
            total: results.length,
            succeeded: successCount,
            failed: errorCount,
          },
          results,
        });
      });
    },

    "add-cells": (args: {
      diagram_xml?: string;
      cells: Array<{
        type: "vertex" | "edge";
        x?: number;
        y?: number;
        width?: number;
        height?: number;
        text?: string;
        style?: string;
        shape_name?: string;
        source_id?: string;
        target_id?: string;
        temp_id?: string;
      }>;
      dry_run?: boolean;
      transactional?: boolean;
    }): CallToolResult => {
      return withDiagramState(args, (diagram) => {
        // Pre-resolve shapes and track per-cell metadata
        const resolvedMap = new Map<number, NonNullable<ReturnType<typeof resolveShape>>>();
        const failedMap = new Map<number, object>();
        const batchItems: Array<{
          type: "vertex" | "edge";
          x?: number;
          y?: number;
          width?: number;
          height?: number;
          text?: string;
          style?: string;
          sourceId?: string;
          targetId?: string;
          tempId?: string;
        }> = [];
        const batchToInput: number[] = [];
        // In transactional mode, vertex temp_ids are replaced with placeholder IDs.
        // This map lets edges resolve their source_id/target_id references to the new IDs.
        const placeholderIdMap = new Map<string, string>();

        for (let i = 0; i < args.cells.length; i++) {
          const c = args.cells[i];
          let style = c.style;
          let width = c.width;
          let height = c.height;
          let text = c.text;
          let cellId = c.temp_id; // Preserve temp_id for batch cross-references

          if (c.type === "vertex" && c.shape_name) {
            const resolved = resolveShape(c.shape_name);
            if (!resolved) {
              failedMap.set(i, {
                success: false,
                tempId: c.temp_id,
                shape_name: c.shape_name,
                error: {
                  code: "SHAPE_NOT_FOUND",
                  message: `Unknown shape '${c.shape_name}'`,
                  suggestion: "Use search-shapes to find available shapes",
                },
              });
              continue;
            }
            resolvedMap.set(i, resolved);
            // In transactional mode, use minimal placeholder style to save bandwidth
            // Otherwise, use the full resolved style with image data
            if (args.transactional) {
              // Minimal placeholder: just a simple box with border + placeholder marker
              style = "fillColor=#d4d4d4;strokeColor=#999999;placeholder=1";
              // Use placeholder ID format so finish-diagram can extract shape name
              // Format: placeholder-{hyphenated-shape-name}-{uuid-suffix}
              const hyphenatedName = c.shape_name.toLowerCase().replace(/\s+/g, "-");
              const uuid = crypto.randomUUID().split("-")[0];
              cellId = `placeholder-${hyphenatedName}-${uuid}`;
              // Track mapping so edges can resolve original temp_id → placeholder ID
              if (c.temp_id) {
                placeholderIdMap.set(c.temp_id, cellId);
              }
            } else {
              style = resolved.style;
            }
            // ALWAYS use resolved dimensions when shape_name is specified
            // This ensures placeholders have exact final dimensions (critical in transactional mode)
            // and icons maintain correct aspect ratios
            width = resolved.width;
            height = resolved.height;
            // For non-basic shapes: fall back to the shape's display name when text is
            // missing, empty, or whitespace-only.  The ?? operator alone doesn't
            // catch "" which callers sometimes send unintentionally.
            if (!text?.trim() && resolved.source !== "basic") {
              text = resolved.name;
            }
          }

          // Strip caller-provided edge anchor properties so the server's
          // symmetric anchor calculation always runs (withSymmetricEdgeAnchors
          // skips edges that already have explicit anchors).
          if (c.type === "edge" && style) {
            style = style.replace(
              /\b(exit[XY]|entry[XY]|exitD[xy]|entryD[xy])=[^;]*;?/gi,
              "",
            );
          }

          batchToInput.push(i);
          batchItems.push({
            type: c.type,
            x: c.x,
            y: c.y,
            width,
            height,
            text,
            style,
            sourceId: placeholderIdMap.get(c.source_id!) ?? c.source_id,
            targetId: placeholderIdMap.get(c.target_id!) ?? c.target_id,
            tempId: cellId,
          });
        }

        const batchResults = diagram.batchAddCells(batchItems, { dryRun: args.dry_run });

        // Reassemble results in original input order, enriching with shape metadata
        const results: object[] = new Array(args.cells.length);
        for (const [i, failure] of failedMap) {
          results[i] = failure;
        }
        for (let j = 0; j < batchResults.length; j++) {
          const origIdx = batchToInput[j];
          const resolved = resolvedMap.get(origIdx);
          if (resolved && batchResults[j].success) {
            results[origIdx] = {
              ...batchResults[j],
              ...(resolved.source === "azure-exact" && { info: `Added Azure icon: ${resolved.name}` }),
              ...(resolved.source === "azure-fuzzy" && {
                info: `Added Azure icon (matched from search): ${resolved.name}`,
                confidence: parseFloat(resolved.score!.toFixed(3)),
              }),
            };
          } else {
            results[origIdx] = batchResults[j];
          }
        }

        // Validate edge conventions and attach warnings to successful edge results
        for (let j = 0; j < batchResults.length; j++) {
          const origIdx = batchToInput[j];
          const result = results[origIdx] as Record<string, unknown>;
          const cell = result.cell as { type?: string; id?: string } | undefined;
          if (result.success && cell?.type === "edge" && cell.id) {
            const warnings = diagram.validateEdgeConventions(cell.id);
            if (warnings.length > 0) {
              results[origIdx] = { ...result, warnings };
            }
          }
        }

        const successCount = results.reduce((n, r: any) => n + (r.success ? 1 : 0), 0);
        const errorCount = results.length - successCount;
        return successResult({
          success: errorCount === 0,
          summary: { total: results.length, succeeded: successCount, failed: errorCount },
          results,
          dry_run: args.dry_run ?? false,
        });
      });
    },

    "edit-cells": (args: {
      diagram_xml?: string;
      cells: Array<{
        cell_id: string;
        text?: string;
        x?: number;
        y?: number;
        width?: number;
        height?: number;
        style?: string;
      }>;
    }): CallToolResult => {
      return withDiagramState(args, (diagram) => {
        const results = diagram.batchEditCells(args.cells);
        const successCount = results.reduce((n, r) => n + (r.success ? 1 : 0), 0);
        const errorCount = results.length - successCount;
        return successResult({
          summary: { total: results.length, succeeded: successCount, failed: errorCount },
          results,
        });
      });
    },

    "get-style-presets": (): CallToolResult => {
      const presets = {
        azure: {
          primary: "fillColor=#0078D4;strokeColor=#0078D4;fontColor=#ffffff;",
          secondary: "fillColor=#50E6FF;strokeColor=#0078D4;fontColor=#000000;",
          container: "fillColor=#E6F2FA;strokeColor=#0078D4;rounded=1;dashed=1;",
        },
        flowchart: {
          process: "whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;",
          decision: "rhombus;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;",
          start: "ellipse;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;",
          end: "ellipse;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;",
          data: "shape=parallelogram;whiteSpace=wrap;html=1;fillColor=#e1d5e7;strokeColor=#9673a6;",
        },
        general: {
          blue: "fillColor=#dae8fc;strokeColor=#6c8ebf;",
          green: "fillColor=#d5e8d4;strokeColor=#82b366;",
          orange: "fillColor=#ffe6cc;strokeColor=#d79b00;",
          red: "fillColor=#f8cecc;strokeColor=#b85450;",
          purple: "fillColor=#e1d5e7;strokeColor=#9673a6;",
          yellow: "fillColor=#fff2cc;strokeColor=#d6b656;",
          gray: "fillColor=#f5f5f5;strokeColor=#666666;",
        },
        edges: {
          solid: "edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;",
          dashed: "edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;dashed=1;",
          curved: "edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;",
          arrow: "edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;endArrow=block;endFill=1;",
        },
      };
      return successResult({ presets });
    },

    "search-shapes": (args: {
      queries: string[];
      limit?: number;
    }): CallToolResult => {
      const limit = args.limit ?? 10;

      if (!args.queries || args.queries.length === 0) {
        return errorResult({
          code: "INVALID_INPUT",
          message: "Must provide a non-empty 'queries' array",
        });
      }

      const results = args.queries.map((q) => {
        // Check basic shapes first (exact, case-insensitive)
        const qLower = q.toLowerCase();
        const basicMatches = allBasicShapesLower
          .filter((s) => s.nameLower.includes(qLower))
          .map((s) => ({
            name: s.name,
            id: s.name,
            category: "basic",
            width: s.defaultWidth,
            height: s.defaultHeight,
            confidence: s.nameLower === qLower ? 1.0 : 0.8,
          }));

        // Then search Azure icons
        const azureMatches = searchAzureIcons(q, limit).map((r) => ({
          name: displayTitle(r.title),
          id: r.id,
          category: r.category,
          width: r.width,
          height: r.height,
          confidence: parseFloat(r.score.toFixed(3)),
        }));

        // Combine: basic shapes first (higher priority), then Azure, respect limit
        const matches = [...basicMatches, ...azureMatches].slice(0, limit);

        return {
          query: q,
          matches,
          total: matches.length,
        };
      });

      return successResult({
        results,
        totalQueries: args.queries.length,
      });
    },
  };
}

/** Default handlers instance for backward compatibility in tests. */
export const handlers = createHandlers();

/**
 * Run a throwaway search-shapes handler call to JIT-compile the full
 * handler path (basic shape filtering, displayTitle mapping, score
 * formatting, JSON serialization).  Call once at startup after
 * initializeShapes() so the first real search-shapes call doesn't
 * pay ~15ms of compilation overhead.
 */
export function warmupSearchPath(): void {
  handlers["search-shapes"]({ queries: ["rectangle", "front door"] });
}
