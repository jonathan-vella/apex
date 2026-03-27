/**
 * Factory for creating MCP tool handlers with logging.
 * Extracted for testability and reuse.
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { DEV_SAVED_PATH } from "./utils.ts";

/**
 * Minimal logger interface for tool handler logging.
 */
export interface ToolLogger {
  debug: (...args: any[]) => void;
}

/**
 * Map of tool names to their handler functions.
 * Handlers may be synchronous or asynchronous — the factory `await`s
 * the result regardless, which is safe for both.
 */
export type ToolHandlerMap = Record<string, (args: any) => CallToolResult | Promise<CallToolResult>>;

/**
 * Creates a factory function that produces MCP tool handlers with logging.
 *
 * Each returned handler:
 * 1. Extracts request metadata from the `extra` parameter
 * 2. Logs the tool invocation
 * 3. Dispatches to the matching handler in `handlerMap`
 * 4. Logs success/error and duration
 * 5. Returns a structured error if the tool name is not found
 *
 * @param handlerMap - Map of tool names to handler functions
 * @param log - Logger instance for debug output
 * @returns A `createToolHandler` function for registering tools
 */
export function formatBytes(bytes: number): string {
  return `${(bytes / 1024).toFixed(2)} KB`;
}

export function timestamp(): string {
  return new Date().toISOString();
}

export function createToolHandlerFactory(handlerMap: ToolHandlerMap, log: ToolLogger) {
  function createToolHandler(toolName: string, hasArgs: true): (args: any, extra: any) => Promise<any>;
  function createToolHandler(toolName: string, hasArgs?: false): (extra: any) => Promise<any>;
  function createToolHandler(toolName: string, hasArgs = false) {
    return async (...params: any[]) => {
      const extra = hasArgs ? params[1] : params[0];
      const args = hasArgs ? params[0] : {};
      const requestId = extra?.requestId;
      const sessionId = extra?.sessionId;
      const reqTag = `[req:${String(requestId ?? 0).padStart(5, "0")}]`;
      const sesTag = sessionId ? ` [ses:${sessionId.slice(-6)}]` : "";
      const txnTag = args?.transactional ? " (txn)" : "";
      const prefix = `[tool:${toolName}]`.padEnd(30);
      //log.debug(`${timestamp()}: ${reqTag} ${prefix} called`, JSON.stringify(args));  // good for troubleshooting
      log.debug(`${timestamp()}: ${reqTag}${sesTag} ${prefix} called${txnTag}`);

      const handler = handlerMap[toolName];
      if (handler) {
        const start = Date.now();
        let result: CallToolResult;
        try {
          result = await handler(args);
        } catch (err) {
          const duration = Date.now() - start;
          const durationStr = `${duration} ms`.padStart(7);
          const errorMessage = err instanceof Error ? err.message : String(err);
          log.debug(
            `${timestamp()}: ${reqTag}${sesTag} ${prefix} uncaught error in ${durationStr}: ${errorMessage}`,
          );
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                error: {
                  code: "INTERNAL_ERROR",
                  message: errorMessage,
                  suggestion:
                    "This is an unexpected server error. Do not retry with the same parameters — the error is deterministic. Report the issue at https://github.com/simonkurtz-MSFT/drawio-mcp-server/issues",
                },
              }),
            }],
            isError: true,
          };
        }
        const duration = Date.now() - start;
        const isError = result.isError ?? false;
        // Measure payload from the already-serialized text content to avoid re-serializing
        const textContent = result.content?.[0];
        const payloadLength = textContent && "text" in textContent ? textContent.text.length : 0;

        // Log placeholder resolution count when present (e.g. finish-diagram)
        if (textContent && "text" in textContent) {
          try {
            const data = JSON.parse(textContent.text);
            if (typeof data.resolved_count === "number") {
              log.debug(
                `${timestamp()}: ${reqTag}${sesTag} ${prefix} resolved ${data.resolved_count} ${data.resolved_count === 1 ? "placeholder" : "placeholders"}`,
              );
            }
          } catch { /* not JSON — skip */ }
        }

        // Log dev-mode diagram save with the standard formatted prefix
        const devSavedPath = (result as any)[DEV_SAVED_PATH];
        if (devSavedPath) {
          log.debug(
            `${timestamp()}: ${reqTag}${sesTag} ${prefix} diagram saved to ${devSavedPath}`,
          );
          delete (result as any)[DEV_SAVED_PATH];
        }

        const payloadSize = formatBytes(payloadLength);
        const durationStr = `${duration} ms`.padStart(7);
        const sizeStr = payloadSize.padStart(10);

        if (isError && textContent && "text" in textContent) {
          try {
            const data = JSON.parse(textContent.text);
            const errorMsg = data.error?.message || data.error || "Unknown error";
            log.debug(
              `${timestamp()}: ${reqTag}${sesTag} ${prefix} error in ${durationStr}, ${sizeStr}: ${errorMsg}`,
            );
          } catch {
            log.debug(
              `${timestamp()}: ${reqTag}${sesTag} ${prefix} error in ${durationStr}, ${sizeStr}`,
            );
          }
        } else {
          log.debug(
            `${timestamp()}: ${reqTag}${sesTag} ${prefix} ok in ${durationStr}, ${sizeStr}`,
          );
        }

        return result;
      }
      log.debug(`${timestamp()}: ${reqTag}${sesTag} ${prefix} not found`);
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: `Tool ${toolName} not available` }) }],
        isError: true,
      };
    };
  }

  return createToolHandler;
}
