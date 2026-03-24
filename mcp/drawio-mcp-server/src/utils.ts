/**
 * Shared utility functions.
 *
 * Small, reusable helpers that appear in multiple modules.
 * Keeps path-resolution boilerplate out of business-logic files.
 *
 * Uses Deno-native APIs:
 *   - `@std/path` for path manipulation and `file://` URL conversion
 *   - `Deno.readTextFileSync` for synchronous file reads
 */

import { dirname, fromFileUrl, join, resolve } from "@std/path";
import { create_logger } from "./loggers/mcp_console_logger.ts";

const log = create_logger();

/**
 * Symbol key used to attach a dev-saved diagram filepath to a CallToolResult.
 * tool_handler.ts reads this to log the save with the standard formatted prefix.
 */
export const DEV_SAVED_PATH: unique symbol = Symbol("dev_saved_path");

/**
 * ESM equivalent of the CommonJS `__dirname` global.
 *
 * Converts a `file://` URL (from `import.meta.url`) to its parent directory path.
 *
 * Usage:
 * ```ts
 * const __dirname = esmDirname(import.meta.url);
 * ```
 *
 * @param importMetaUrl — pass `import.meta.url` from the calling module.
 */
export function esmDirname(importMetaUrl: string): string {
  return dirname(fromFileUrl(importMetaUrl));
}

/**
 * Read a UTF-8 text file resolved relative to the calling module's directory.
 *
 * Combines `esmDirname`, `resolve`, and `Deno.readTextFileSync` into one call
 * so callers don't need to import multiple modules individually.
 *
 * @param importMetaUrl — pass `import.meta.url` from the calling module.
 * @param pathSegments  — path segments joined via `resolve` (same API as `path.join`).
 */
export function readRelativeFile(importMetaUrl: string, ...pathSegments: string[]): string {
  return Deno.readTextFileSync(resolve(esmDirname(importMetaUrl), ...pathSegments));
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️  DEV MODE ONLY — NOT FOR PRODUCTION USE ⚠️
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Save diagram XML to local diagrams/ folder for debugging.
 *
 * This function is ONLY active when the SAVE_DIAGRAMS environment variable
 * is set to "true" or "1". It is intended for development and debugging only.
 *
 * Errors during file operations are logged but do NOT halt the tool operation.
 * This ensures that diagram generation succeeds even if local saving fails.
 *
 * Usage:
 *   Set environment variable: SAVE_DIAGRAMS=true
 *   When set, all export-diagram and finish-diagram calls will automatically
 *   save their XML output to ./diagrams/<timestamp>.drawio
 *
 * @param xml      — diagram XML content to save
 * @param toolName — name of the tool that generated the XML (for filename)
 * @returns the saved filepath, or `null` if saving was disabled or failed
 */
export function devSaveDiagram(
  xml: string,
  toolName: string,
): string | null {
  // ⚠️ DEV MODE CHECK — Only execute if explicitly enabled via environment variable
  const devMode = Deno.env.get("SAVE_DIAGRAMS");
  if (devMode !== "true" && devMode !== "1") {
    return null; // Feature disabled — do nothing
  }

  try {
    // Create diagrams/ directory if it doesn't exist
    const diagramsDir = "./diagrams";
    try {
      Deno.mkdirSync(diagramsDir, { recursive: true });
      // deno-coverage-ignore
    } catch (error) {
      // deno-coverage-ignore
      // Ignore error if directory already exists
      // deno-coverage-ignore
      if (!(error instanceof Deno.errors.AlreadyExists)) {
        // deno-coverage-ignore
        throw error;
        // deno-coverage-ignore
      }
      // deno-coverage-ignore
    }

    // Generate filename with timestamp: YYYYMMDD_HHMMSS_toolname.drawio
    const now = new Date();
    const timestamp = now.toISOString()
      .replace(/[-:]/g, "")
      .replace(/T/, "_")
      .split(".")[0]; // Format: YYYYMMDD_HHMMSS
    const filename = `${timestamp}_${toolName}.drawio`;
    const filepath = join(diagramsDir, filename);

    // Write XML to file
    Deno.writeTextFileSync(filepath, xml);

    return filepath;
  } catch (error) {
    // Log error but do NOT fail the tool operation
    // Local file saves are strictly a dev convenience feature
    // deno-coverage-ignore
    const errorMsg = error instanceof Error ? error.message : String(error);
    log.error(`Failed to save diagram: ${errorMsg}`);
    return null;
  }
}
