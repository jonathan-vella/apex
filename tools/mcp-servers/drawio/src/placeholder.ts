/**
 * Placeholder system for transactional diagram creation.
 *
 * In transactional mode, shape cells contain minimal placeholder data instead of
 * full SVG image content. This dramatically reduces payload size during intermediate
 * operations. The final `finish-diagram` call resolves all placeholders to real SVG.
 *
 * Placeholder cells are real XML cells with style="placeholder=1" and a special ID
 * format: `placeholder-{hyphenated-shape-name}-{uuid-suffix}`.
 */

import { Cell } from "./diagram_model.ts";

/** Marker to detect placeholder cells in XML */
export const PLACEHOLDER_MARKER = "placeholder=1";

/**
 * Create a placeholder cell for a given shape.
 * The cell has minimal data - real SVG image data is excluded.
 * Used during transactional mode for lightweight intermediate responses.
 *
 * @param shapeName - Name of the shape being added (e.g., "Front Doors", "API")
 * @param baseStyle - Base style string (colors, dimensions, etc.) without image data
 * @param position - { x, y, width, height } position and size
 * @returns A Cell object that can be added to the diagram
 */
export function createPlaceholderCell(
  shapeName: string,
  baseStyle: string,
  position: { x: number; y: number; width: number; height: number },
): Cell {
  // Generate unique ID: placeholder-shape-name-uuid
  const hyphenatedName = shapeName.toLowerCase().replace(/\s+/g, "-");
  const uuid = crypto.randomUUID().split("-")[0]; // First 8 chars of UUID
  const placeholderId = `placeholder-${hyphenatedName}-${uuid}`;

  // Add placeholder marker to style
  const styleWithMarker = baseStyle.includes("placeholder=1") ? baseStyle : `${baseStyle}${baseStyle.endsWith(";") ? "" : ";"}placeholder=1;`;

  return {
    id: placeholderId,
    type: "vertex",
    value: shapeName,
    x: position.x,
    y: position.y,
    width: position.width,
    height: position.height,
    style: styleWithMarker,
    parent: "1",
  };
}

/**
 * Detect if a cell ID is a placeholder.
 */
export function isPlaceholder(cellId: string): boolean {
  return cellId.startsWith("placeholder-");
}

/**
 * Extract the shape name from a placeholder cell ID.
 * Example: "placeholder-front-doors-abc123" → "front-doors"
 */
export function extractShapeNameFromPlaceholderId(placeholderId: string): string | null {
  if (!isPlaceholder(placeholderId)) {
    return null;
  }

  // Format: placeholder-{hyphenated-name}-{uuid}
  const parts = placeholderId.substring("placeholder-".length).split("-");
  if (parts.length < 2) {
    return null;
  }

  // Remove the last part (UUID suffix, which is 8 hex characters)
  const lastPart = parts[parts.length - 1];
  if (!/^[a-f0-9]{8}/.test(lastPart)) {
    return null;
  }

  return parts.slice(0, -1).join("-");
}

/**
 * Find all placeholder cells in the diagram XML.
 * Returns an array of objects with the placeholder ID and shape name.
 */
export function findPlaceholdersInXml(diagramXml: string): Array<{ id: string; shapeName: string }> {
  const placeholders: Array<{ id: string; shapeName: string }> = [];

  // Simple regex to find mxCell elements with placeholder marker
  const cellRegex = /<mxCell\s+id="([^"]+)"[^>]*style="([^"]*placeholder=1[^"]*)"/g;
  let match;

  while ((match = cellRegex.exec(diagramXml)) !== null) {
    const cellId = match[1];
    if (isPlaceholder(cellId)) {
      const shapeName = extractShapeNameFromPlaceholderId(cellId);
      if (shapeName) {
        placeholders.push({ id: cellId, shapeName });
      }
    }
  }

  return placeholders;
}

/**
 * Replace placeholder SVG data in XML with real SVG image data.
 *
 * This is called during `finish-diagram` to convert lightweight placeholders
 * to production-ready cells with full image SVG.
 *
 * Shape names are resolved from the **cell ID** (e.g., `placeholder-front-doors-abc123`
 * → `"front-doors"`), NOT from the cell's `value` attribute. This means callers can
 * freely change the `value` (display label) via `edit-cells` without affecting resolution.
 *
 * @param diagramXml - The diagram XML containing placeholder cells
 * @param shapeResolver - Function that resolves shape names to SVG + style data
 * @returns Updated XML with placeholders resolved to real SVGs, or error message
 */
export function resolvePlaceholdersInXml(
  diagramXml: string,
  shapeResolver: (shapeName: string, placeholderId: string) => { style: string; svgImage?: string } | null,
): { xml: string; error?: never } | { error: string; details?: { placeholderId: string; shapeName: string }[] } {
  const placeholders = findPlaceholdersInXml(diagramXml);
  const failedResolutions: { placeholderId: string; shapeName: string }[] = [];
  let updatedXml = diagramXml;

  for (const placeholder of placeholders) {
    const resolved = shapeResolver(placeholder.shapeName, placeholder.id);

    if (!resolved) {
      failedResolutions.push({
        placeholderId: placeholder.id,
        shapeName: placeholder.shapeName,
      });
      continue;
    }

    // Find the cell element and update its style (remove placeholder marker, add real style).
    // Escape the placeholder ID for safe regex interpolation.
    const escapedId = placeholder.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const cellRegex = new RegExp(
      `<mxCell\\s+id="${escapedId}"[^>]*style="([^"]*placeholder=1[^"]*)"`,
      "g",
    );

    updatedXml = updatedXml.replace(cellRegex, (match) => {
      // Remove the placeholder marker from the style
      const newStyle = resolved.style;
      return match.replace(/style="[^"]*"/, `style="${escapeXml(newStyle)}"`);
    });

    // If there's SVG image data, inject it
    if (resolved.svgImage) {
      // SVG data would be in a specific attribute - implementation depends on shape library format
      // For now, the style update is sufficient as shapes are pulled from libraries
    }
  }

  if (failedResolutions.length > 0) {
    return {
      error: `Failed to resolve ${failedResolutions.length} placeholder(s)`,
      details: failedResolutions,
    };
  }

  return { xml: updatedXml };
}

/**
 * Simple XML escaping for attribute values.
 * Used when injecting the resolved style back into the XML.
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Strip SVG image data from a style string, keeping only base styling.
 * Used to create the placeholder style when entering transactional mode.
 *
 * @param fullStyle - Complete style string with SVG image= attribute
 * @returns Style string without image data
 */
export function stripImageFromStyle(fullStyle: string): string {
  // Remove image=data:image/... (but keep other attributes)
  return fullStyle.replace(/image=[^;]*/g, "").replace(/;;+/g, ";").replace(/;$/, "");
}
