/**
 * Centralized tool definitions — name, description, hasArgs, and input schema
 * for every MCP tool, in a single iterable list.
 *
 * tool_registrations.ts loops over TOOL_DEFINITIONS to call server.registerTool().
 */

import { z } from "zod";

// ─── Tool Definition Types ───────────────────────────────────

interface ToolDefinitionBase {
  /** UPPER_SNAKE_CASE key for the TOOL_NAMES lookup object */
  key: string;
  /** kebab-case name exposed to MCP clients */
  name: string;
  /** Human-readable description shown to MCP clients */
  description: string;
}

export interface ToolDefinitionWithArgs extends ToolDefinitionBase {
  hasArgs: true;
  inputSchema: { [key: string]: z.ZodTypeAny };
}

export interface ToolDefinitionWithoutArgs extends ToolDefinitionBase {
  hasArgs: false;
}

export type ToolDefinition = ToolDefinitionWithArgs | ToolDefinitionWithoutArgs;

const diagramXmlSchema = z
  .string()
  .optional()
  .describe(
    "Full Draw.io XML for the current diagram state from the previous tool call. Omit to start from an empty diagram. Prefer transactional mode for multi-step workflows.",
  );

const transactionalSchema = z
  .boolean()
  .optional()
  .describe(
    "Prefer true for multi-step workflows to minimize payload size. When true, responses include placeholders and MUST be finalized with finish-diagram. CRITICAL: If you use transactional mode, you MUST call finish-diagram at the end to get the actual diagram.",
  );

// ─── Tool Definitions ────────────────────────────────────────

export const TOOL_DEFINITIONS: readonly ToolDefinition[] = [
  // ─── Cell Tools ──────────────────────────────────────────────

  {
    key: "DELETE_CELL_BY_ID",
    name: "delete-cell-by-id",
    description:
      "Delete a cell (vertex or edge) by its ID. Prefer transactional: true for multi-step workflows; finalize with finish-diagram. When a vertex is deleted, all connected edges are automatically cascade-deleted and reported in the response.",
    hasArgs: true,
    inputSchema: {
      diagram_xml: diagramXmlSchema,
      transactional: transactionalSchema,
      cell_id: z
        .string()
        .describe(
          "The ID of a cell to delete. The cell can be either vertex or edge. The ID is located in `id` attribute.",
        ),
    },
  },

  {
    key: "EDIT_EDGES",
    name: "edit-edges",
    description:
      "Edit one or more edges. Prefer transactional: true for multi-step workflows; finalize with finish-diagram. Always pass ALL updates in a single call — never call this tool repeatedly. Only updates specified properties on each edge.",
    hasArgs: true,
    inputSchema: {
      diagram_xml: diagramXmlSchema,
      transactional: transactionalSchema,
      edges: z.array(z.object({
        cell_id: z
          .string()
          .describe(
            "Identifier (`id` attribute) of the edge cell to update. The ID must reference an edge.",
          ),
        text: z.string().optional().describe("Replace the edge's label text."),
        source_id: z
          .string()
          .optional()
          .describe("Reassign the edge's source terminal to a different cell ID."),
        target_id: z
          .string()
          .optional()
          .describe("Reassign the edge's target terminal to a different cell ID."),
        style: z
          .string()
          .optional()
          .describe(
            "Replace the edge's style string (semi-colon separated `key=value` pairs).",
          ),
      })).describe(
        "Array of edge updates. Example: [{cell_id: 'cell-3', text: 'HTTPS'}, {cell_id: 'cell-4', style: 'dashed=1;'}]",
      ),
    },
  },

  // ─── Add / Edit Cells ─────────────────────────────────────────

  {
    key: "ADD_CELLS",
    name: "add-cells",
    description:
      "Add vertices and/or edges to the diagram. Prefer transactional: true for multi-step workflows and finish with finish-diagram. Always pass ALL cells you need in a single call — never call this tool repeatedly. Use temp_id to reference cells within the same batch (e.g., an edge referencing a vertex created in the same call). For vertices that need a shape-library icon (Azure icons, basic shapes), set shape_name and the server will resolve the style automatically.",
    hasArgs: true,
    inputSchema: {
      diagram_xml: diagramXmlSchema,
      transactional: transactionalSchema,
      cells: z.array(z.object({
        type: z.enum(["vertex", "edge"]).describe("Cell type: 'vertex' for shapes, 'edge' for connections"),
        x: z.number().optional().describe("X position (vertices only)"),
        y: z.number().optional().describe("Y position (vertices only)"),
        width: z.number().optional().describe("Width (vertices only, ignored when shape_name is set)"),
        height: z.number().optional().describe("Height (vertices only, ignored when shape_name is set)"),
        text: z.string().optional().describe(
          "Text label for the cell. For shaped vertices (shape_name set): provide a descriptive label like 'Web', 'API', 'Azure Monitor'. Omit this parameter to use the shape's display name automatically. NEVER pass an empty string.",
        ),
        style: z.string().optional().describe(
          "Draw.io style string (ignored when shape_name is set). For edges: do NOT set entryX/entryY/exitX/exitY anchor points — the server calculates these automatically.",
        ),
        shape_name: z.string().optional().describe(
          "Shape library name (e.g. 'Front Doors', 'Container Apps'). When set, the server resolves the full icon style and dimensions automatically — do NOT also set style, width, or height.",
        ),
        source_id: z.string().optional().describe("Source cell ID for edges (can use temp_id from same batch)"),
        target_id: z.string().optional().describe("Target cell ID for edges (can use temp_id from same batch)"),
        temp_id: z.string().optional().describe("Temporary ID to reference this cell within the batch"),
      })).describe(
        "Array of cells to create. Gather ALL cells you need and submit them in ONE call. Example: [{type:'vertex', x:100, y:100, shape_name:'Front Doors', temp_id:'node1'}, {type:'edge', source_id:'node1', target_id:'node2'}]",
      ),
      dry_run: z.boolean().optional().describe(
        "If true, validates the batch without persisting changes. Use to check for errors before committing.",
      ),
    },
  },
  {
    key: "EDIT_CELLS",
    name: "edit-cells",
    description:
      "Edit one or more vertex cells. Prefer transactional: true for multi-step workflows; finalize with finish-diagram. Always pass ALL updates in a single call — never call this tool repeatedly. Only updates specified properties on each cell.",
    hasArgs: true,
    inputSchema: {
      diagram_xml: diagramXmlSchema,
      transactional: transactionalSchema,
      cells: z.array(z.object({
        cell_id: z.string().describe("ID of the cell to update"),
        text: z.string().optional().describe("New text label"),
        x: z.number().optional().describe("New X position"),
        y: z.number().optional().describe("New Y position"),
        width: z.number().optional().describe("New width"),
        height: z.number().optional().describe("New height"),
        style: z.string().optional().describe("New style string"),
      })).describe(
        "Array of cell updates. Example: [{cell_id: 'cell-1', x: 200, y: 150}, {cell_id: 'cell-2', text: 'Updated'}]",
      ),
    },
  },

  // ─── Shape Tools ───────────────────────────────────────────────

  {
    key: "GET_SHAPE_CATEGORIES",
    name: "get-shape-categories",
    description: "Get available shape categories (General, Flowchart, Azure icons). For discovering specific shapes, prefer search-shapes.",
    hasArgs: false,
  },
  {
    key: "GET_SHAPES_IN_CATEGORY",
    name: "get-shapes-in-category",
    description: "List all shapes in a category. Returns shape names and styles for use with add-cells.",
    hasArgs: true,
    inputSchema: {
      category_id: z
        .string()
        .describe(
          "Identifier (ID / key) of the category from which all the shapes should be retrieved.",
        ),
    },
  },

  {
    key: "SET_CELL_SHAPE",
    name: "set-cell-shape",
    description:
      "Update one or more cells' visual styles to match library shapes. Prefer transactional: true for multi-step workflows; finalize with finish-diagram. Always pass ALL updates in a single call. Use search-shapes to find shape names first.",
    hasArgs: true,
    inputSchema: {
      diagram_xml: diagramXmlSchema,
      transactional: transactionalSchema,
      cells: z
        .array(
          z.object({
            cell_id: z.string().describe("Cell ID to update"),
            shape_name: z.string().describe("Shape name to apply"),
          }),
        )
        .describe(
          "Array of cell-shape pairs. Example: [{cell_id: 'cell-1', shape_name: 'App Services'}, {cell_id: 'cell-2', shape_name: 'SQL Database'}]",
        ),
    },
  },
  {
    key: "SEARCH_SHAPES",
    name: "search-shapes",
    description:
      "Search for any shape — basic shapes (rectangle, circle, diamond, start, end, process, cylinder, etc.) and 700+ Azure icons. This is the primary way to discover shapes for use with add-cells. Call this tool once with all shape names in the queries array — include cross-cutting services (Monitor, Entra ID, Key Vault, Azure Policy, Defender for Cloud, Container Registry) in the SAME call.",
    hasArgs: true,
    inputSchema: {
      queries: z.array(z.string()).describe(
        "Array of ALL search terms — main flow AND cross-cutting services. Gather every shape you need and pass them all here in a SINGLE call. Example: ['front door', 'container apps', 'app service', 'key vault', 'monitor', 'entra id', 'azure policy', 'container registry']",
      ),
      limit: z.number().min(1).max(50).optional().default(10).describe("Maximum results to return per query (1-50)"),
    },
  },
  {
    key: "GET_STYLE_PRESETS",
    name: "get-style-presets",
    description: "Get style presets (Azure colors, flowchart shapes, edges) for consistent styling.",
    hasArgs: false,
  },

  // ─── Model / Query Tools ───────────────────────────────────────

  {
    key: "LIST_PAGED_MODEL",
    name: "list-paged-model",
    description: "Get a paginated list of cells in the diagram. Returns layer context alongside results. Use this to inspect diagram structure or find cells by type.",
    hasArgs: true,
    inputSchema: {
      diagram_xml: diagramXmlSchema,
      transactional: transactionalSchema,
      page: z
        .number()
        .optional()
        .describe(
          "Zero-based page number for pagination. Page 0 returns the first batch of cells, page 1 returns the next batch, etc. Default is 0.",
        )
        .default(0),
      page_size: z
        .number()
        .optional()
        .describe(
          "Maximum number of cells to return in a single page. Controls response size and performance. Must be between 1 and 1000. Default is 50.",
        )
        .default(50),
      filter: z
        .object({
          cell_type: z
            .enum(["edge", "vertex"])
            .optional()
            .describe(
              "Filter by cell type: 'edge' for connection lines, 'vertex' for vertices/shapes",
            ),
        })
        .optional()
        .describe("Optional filter criteria to apply to cells before pagination")
        .default({}),
    },
  },
  {
    key: "GET_DIAGRAM_STATS",
    name: "get-diagram-stats",
    description:
      "Get comprehensive statistics about the current diagram including cell counts, bounds, layer distribution, and more. Useful for understanding diagram state before making changes.",
    hasArgs: true,
    inputSchema: {
      diagram_xml: diagramXmlSchema,
      transactional: transactionalSchema,
    },
  },

  // ─── Layer Tools ───────────────────────────────────────────────

  {
    key: "LIST_LAYERS",
    name: "list-layers",
    description: "List all layers in the diagram with IDs and names. Also returns the active layer ID.",
    hasArgs: true,
    inputSchema: {
      diagram_xml: diagramXmlSchema,
      transactional: transactionalSchema,
    },
  },

  {
    key: "SET_ACTIVE_LAYER",
    name: "set-active-layer",
    description: "Set the active layer for new elements.",
    hasArgs: true,
    inputSchema: {
      diagram_xml: diagramXmlSchema,
      transactional: transactionalSchema,
      layer_id: z.string().describe("ID of the layer to set as active"),
    },
  },
  {
    key: "CREATE_LAYER",
    name: "create-layer",
    description: "Create a new layer in the diagram. Layers organize cells into separate visual planes that can be shown or hidden.",
    hasArgs: true,
    inputSchema: {
      diagram_xml: diagramXmlSchema,
      transactional: transactionalSchema,
      name: z.string().describe("Name for the new layer"),
    },
  },
  {
    key: "MOVE_CELL_TO_LAYER",
    name: "move-cell-to-layer",
    description: "Move a cell to a different layer. Updates the cell's parent reference and returns the updated cell.",
    hasArgs: true,
    inputSchema: {
      diagram_xml: diagramXmlSchema,
      transactional: transactionalSchema,
      cell_id: z.string().describe("ID of the cell to move"),
      target_layer_id: z
        .string()
        .describe("ID of the target layer where the cell will be moved"),
    },
  },

  // ─── Group / Container Tools ───────────────────────────────────

  {
    key: "CREATE_GROUPS",
    name: "create-groups",
    description:
      "Create one or more group/container cells. Prefer transactional: true for multi-step workflows; finalize with finish-diagram. Always pass ALL groups in a single call — never call this tool repeatedly. Each group gets a unique ID for use with add-cells-to-group. Children are positioned relative to the group.",
    hasArgs: true,
    inputSchema: {
      diagram_xml: diagramXmlSchema,
      transactional: transactionalSchema,
      groups: z.array(z.object({
        x: z.number().optional().describe("X-axis position of the group").default(0),
        y: z.number().optional().describe("Y-axis position of the group").default(0),
        width: z.number().optional().describe("Width of the group container").default(400),
        height: z.number().optional().describe("Height of the group container").default(300),
        text: z.string().optional().default("").describe("Label text for the group. Leave empty if using a separate text cell above the group."),
        style: z.string().optional().describe("Draw.io style string for the group container"),
        temp_id: z.string().optional().describe(
          "Temporary ID for referencing this group later (e.g., in add-cells-to-group)",
        ),
      })).describe(
        "Array of groups to create. Example: [{text: '', width: 600, height: 400, temp_id: 'vnet'}, {text: '', width: 300, height: 200, temp_id: 'subnet'}]",
      ),
    },
  },
  {
    key: "ADD_CELLS_TO_GROUP",
    name: "add-cells-to-group",
    description:
      "Assign one or more cells to groups. Prefer transactional: true for multi-step workflows; finalize with finish-diagram. Always pass ALL assignments in a single call — never call this tool repeatedly. Supports assigning cells to different groups in a single call.",
    hasArgs: true,
    inputSchema: {
      diagram_xml: diagramXmlSchema,
      transactional: transactionalSchema,
      assignments: z.array(z.object({
        cell_id: z.string().describe("ID of the cell to add to a group"),
        group_id: z.string().describe("ID of the group/container cell"),
      })).describe(
        "Array of cell-to-group assignments. Example: [{cell_id: 'cell-5', group_id: 'cell-2'}, {cell_id: 'cell-6', group_id: 'cell-3'}]",
      ),
    },
  },
  {
    key: "REMOVE_CELL_FROM_GROUP",
    name: "remove-cell-from-group",
    description: "Remove a cell from its group, returning it to the active layer. Prefer transactional: true for multi-step workflows; finalize with finish-diagram.",
    hasArgs: true,
    inputSchema: {
      diagram_xml: diagramXmlSchema,
      transactional: transactionalSchema,
      cell_id: z.string().describe("ID of the cell to remove from its group"),
    },
  },
  {
    key: "LIST_GROUP_CHILDREN",
    name: "list-group-children",
    description: "List all cells that are children of a group/container. Prefer transactional: true for multi-step workflows; finalize with finish-diagram.",
    hasArgs: true,
    inputSchema: {
      diagram_xml: diagramXmlSchema,
      transactional: transactionalSchema,
      group_id: z.string().describe("ID of the group/container cell"),
    },
  },
  {
    key: "VALIDATE_GROUP_CONTAINMENT",
    name: "validate-group-containment",
    description: "Validate that all child cells of a group are visually inside the group's boundary. Returns out-of-bounds warnings and guidance for fixing placement.",
    hasArgs: true,
    inputSchema: {
      diagram_xml: diagramXmlSchema,
      transactional: transactionalSchema,
      group_id: z.string().describe("ID of the group/container cell to validate"),
    },
  },
  {
    key: "SUGGEST_GROUP_SIZING",
    name: "suggest-group-sizing",
    description: "Suggest group/container width and height based on vertically stacked children, spacing, and padding. Use before create-groups to avoid overflow.",
    hasArgs: true,
    inputSchema: {
      child_count: z.number().int().min(1).describe("Number of children that will be placed in the group"),
      child_width: z.number().positive().optional().default(48).describe("Typical child width in pixels"),
      child_height: z.number().positive().optional().default(48).describe("Typical child height in pixels"),
      vertical_spacing: z.number().min(0).optional().default(40).describe("Vertical spacing between stacked children in pixels"),
      horizontal_padding: z.number().min(0).optional().default(40).describe("Left/right padding inside the group in pixels"),
      vertical_padding: z.number().min(0).optional().default(40).describe("Top/bottom padding inside the group in pixels"),
      min_width: z.number().positive().optional().default(180).describe("Minimum recommended group width"),
      min_height: z.number().positive().optional().default(120).describe("Minimum recommended group height"),
    },
  },

  // ─── Import / Export Tools ─────────────────────────────────────

  {
    key: "IMPORT_DIAGRAM",
    name: "import-diagram",
    description:
      "Import a Draw.io XML string, replacing the current diagram. Prefer transactional: true for multi-step workflows; finalize with finish-diagram. Multi-page documents are supported — all pages are merged into a single flat model. Use this to load and modify existing .drawio files.",
    hasArgs: true,
    inputSchema: {
      diagram_xml: diagramXmlSchema,
      transactional: transactionalSchema,
      xml: z.string().describe("The Draw.io XML string to import"),
    },
  },
  {
    key: "FINISH_DIAGRAM",
    name: "finish-diagram",
    description:
      "CRITICAL: You MUST call this tool at the end of any transactional workflow to resolve placeholders to real SVG shapes and return production-ready XML. If you do not call this, the user will receive an incomplete diagram. Use this after a transactional workflow and before export-diagram. Compressed output is recommended for large diagrams.",
    hasArgs: true,
    inputSchema: {
      diagram_xml: diagramXmlSchema,
      compress: z.boolean().optional().default(true).describe(
        "When true, deflate-compress and base64-encode the diagram content inside the <diagram> element (Draw.io native format). Defaults to true for efficient output.",
      ),
    },
  },
  {
    key: "EXPORT_DIAGRAM",
    name: "export-diagram",
    description:
      "Export the diagram as Draw.io XML with diagram statistics. The XML is in the response payload's `xml` property. Save the output to a .drawio file. If you used transactional mode, call finish-diagram first to resolve placeholders. When `compress` is true, the mxGraphModel content inside the <diagram> element is deflate-compressed and base64-encoded (the format used by the Draw.io desktop app), typically achieving 60-80% size reduction. Compressed output is fully compatible with Draw.io and can be re-imported.",
    hasArgs: true,
    inputSchema: {
      diagram_xml: diagramXmlSchema,
      transactional: transactionalSchema,
      compress: z.boolean().optional().default(false).describe(
        "When true, deflate-compress and base64-encode the diagram content inside the <diagram> element (Draw.io native format). Reduces output size by 60-80%. Defaults to false (plain XML).",
      ),
    },
  },
  {
    key: "CLEAR_DIAGRAM",
    name: "clear-diagram",
    description: "Clear all cells and layers, resetting the diagram to its initial empty state. Prefer transactional: true for multi-step workflows; finalize with finish-diagram.",
    hasArgs: true,
    inputSchema: {
      diagram_xml: diagramXmlSchema,
      transactional: transactionalSchema,
    },
  },
];

// ─── Derived Constants ───────────────────────────────────────

/** Tool name constants derived from TOOL_DEFINITIONS (UPPER_SNAKE_CASE key → kebab-case value) */
export const TOOL_NAMES: { readonly [key: string]: string } = Object.freeze(
  Object.fromEntries(TOOL_DEFINITIONS.map((t) => [t.key, t.name])),
);
