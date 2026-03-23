#!/usr/bin/env -S deno run --allow-net --allow-read --allow-env
/**
 * Entry point — server lifecycle, transport setup, and shutdown.
 *
 * This file is the only place with side effects (signal handlers, I/O).
 * All business logic lives in the other modules.
 *
 * Transports:
 *   - stdio  — for IDE / CLI integrations (via MCP SDK StdioServerTransport)
 *   - http   — Streamable HTTP via Deno.serve + Hono router
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { load as loadEnv } from "@std/dotenv";

import { buildConfig, parseLoggerType, type ServerConfig, shouldShowHelp, VERSION } from "./config.ts";
import { create_logger as create_console_logger } from "./loggers/mcp_console_logger.ts";
import { create_logger as create_server_logger, validLogLevels } from "./loggers/mcp_server_logger.ts";
import { createHandlers, warmupSearchPath } from "./tools.ts";
import { createToolHandlerFactory } from "./tool_handler.ts";
import { initializeShapes, resetAzureIconLibrary } from "./shapes/azure_icon_library.ts";
import { registerTools, TOOL_DEFINITIONS } from "./tool_registrations.ts";
import { readRelativeFile } from "./utils.ts";

/**
 * Display help message and exit.
 */
function showHelp(): never {
  console.log(`
Draw.io MCP Server (${VERSION})

Usage: drawio-mcp-server [options]

Options:
  --http-port <number>     HTTP server port for MCP clients (default: 8080)
  --transport <type>       Transport type: stdio, http, or stdio,http (default: stdio)
  --help, -h              Show this help message

Environment variables:
  HTTP_PORT                Same as --http-port (CLI takes precedence)
  TRANSPORT                Same as --transport (CLI takes precedence)
  LOGGER_TYPE              Logger type: console or mcp_server (default: console)
  AZURE_ICON_LIBRARY_PATH  Path to Azure icon library XML file (auto-detected if unset)

Examples:
  drawio-mcp-server                           # Use stdio transport
  drawio-mcp-server --transport http          # Use HTTP transport on port 8080
  drawio-mcp-server --http-port 4000          # Use HTTP on port 4000
  drawio-mcp-server --transport stdio,http    # Use both transports
  `);
  Deno.exit(0);
}

// ─── Logger Setup ────────────────────────────────────────────
// Resolve logger type early so server capabilities are set correctly.
// Validation is centralized in config.ts via parseLoggerType.
const loggerTypeResult = parseLoggerType(Deno.env.get("LOGGER_TYPE"));
const loggerType = loggerTypeResult instanceof Error ? "console" : loggerTypeResult;

// deno-lint-ignore no-explicit-any
let capabilities: any = {
  resources: {},
  tools: {},
};
if (loggerType === "mcp_server") {
  capabilities = {
    ...capabilities,
    logging: {
      setLevels: true,
      levels: validLogLevels,
    },
  };
}

// Console logger is used regardless — it's the primary log sink.
// MCP-server logging (log-level handlers, notifications) is attached
// per-server in createMcpServer() when LOGGER_TYPE=mcp_server.
const log = create_console_logger();
// Loaded from src/instructions.md and sent to MCP clients during
// initialization so the calling model follows diagram-generation
// conventions without extra round trips.
const SERVER_INSTRUCTIONS = readRelativeFile(import.meta.url, "instructions.md");

/**
 * Create a fully configured McpServer instance.
 * Each transport needs its own instance because the MCP SDK
 * only allows one transport per server.
 */
function createMcpServer(): McpServer {
  const srv = new McpServer(
    {
      name: "drawio-mcp-server",
      version: VERSION,
    },
    {
      capabilities,
      instructions: SERVER_INSTRUCTIONS,
    },
  );

  // Attach MCP-server logger if configured (registers setLevel/setLevels handlers)
  if (loggerType === "mcp_server") {
    create_server_logger(srv);
  }

  // Log protocol/transport errors to the server console
  srv.server.onerror = (error: Error) => {
    log.error(`MCP server error: ${error.message}`);
  };

  // Register all MCP tools (schemas + descriptions)
  const handlers = createHandlers(log);
  const createToolHandler = createToolHandlerFactory(handlers, log);
  registerTools(srv, createToolHandler);

  return srv;
}

/** Track all server instances for shutdown */
const servers: McpServer[] = [];

// ─── Shutdown Infrastructure ───────────────────────────────────

/** HTTP server reference, captured for graceful shutdown */
let httpServer: Deno.HttpServer | undefined;

/** Guard against double-shutdown (signal re-delivery, etc.) */
let isShuttingDown = false;

/**
 * Gracefully shut down all resources.
 * Idempotent — safe to call more than once.
 */
async function shutdown(reason: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  log.debug(`Shutting down (reason: ${reason})`);

  // 1. Close all MCP server instances (flushes pending messages, disconnects transports)
  log.debug(`Closing ${servers.length} MCP server instance(s)`);
  for (const srv of servers) {
    try {
      await srv.close();
    } catch {
      // best-effort — transport may already be gone
    }
  }
  log.debug("MCP server(s) closed");

  // 2. Stop accepting new HTTP connections
  if (httpServer) {
    try {
      await httpServer.shutdown();
    } catch {
      // best-effort — server may already be closed
    }
    httpServer = undefined;
    log.debug("HTTP server closed");
  }

  // 3. Clear HTTP sessions
  if (httpSessions.size > 0) {
    log.debug(`Closing ${httpSessions.size} active HTTP session(s)`);
  }
  httpSessions.clear();

  // 4. Release cached resources so memory is freed immediately
  resetAzureIconLibrary();

  log.debug("Shutdown complete");
}

// ─── Signal & Error Handlers ──────────────────────────────────
// Deno uses `addSignalListener` instead of Node's `process.on`.
// Windows only supports SIGINT and SIGBREAK; SIGTERM and SIGHUP are Unix-only.
Deno.addSignalListener("SIGINT", () => {
  shutdown("SIGINT").finally(() => Deno.exit(0));
});

// On Unix, also listen for SIGTERM (graceful termination) and SIGHUP (terminal hangup)
if (Deno.build.os !== "windows") {
  for (const signal of ["SIGTERM", "SIGHUP"] as const) {
    Deno.addSignalListener(signal, () => {
      shutdown(signal).finally(() => Deno.exit(0));
    });
  }
}

// Global error handlers — Deno equivalents of Node's uncaughtException / unhandledRejection
globalThis.addEventListener("error", (event) => {
  log.error("Uncaught exception:", event.error);
  event.preventDefault();
  shutdown("uncaughtException").finally(() => Deno.exit(1));
});

globalThis.addEventListener("unhandledrejection", (event) => {
  log.error("Unhandled rejection:", event.reason);
  event.preventDefault();
  shutdown("unhandledRejection").finally(() => Deno.exit(1));
});

// ─── Transport Startup ────────────────────────────────────────

async function start_stdio_transport() {
  const srv = createMcpServer();
  servers.push(srv);
  const transport = new StdioServerTransport();
  transport.onerror = (error: Error) => {
    log.error(`STDIO transport error: ${error.message}`);
  };
  await srv.connect(transport);
  log.info(`Draw.io MCP Server STDIO transport active`);
}

/** Active HTTP sessions — maps session ID → transport + server */
const httpSessions = new Map<string, {
  transport: WebStandardStreamableHTTPServerTransport;
  server: McpServer;
}>();

async function start_streamable_http_transport(http_port: number) {
  // Create the Hono app
  const app = new Hono();

  // Enable CORS for all origins
  app.use(
    "*",
    cors({
      origin: "*",
      allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
      allowHeaders: [
        "Content-Type",
        "mcp-session-id",
        "Last-Event-ID",
        "mcp-protocol-version",
      ],
      exposeHeaders: ["mcp-session-id", "mcp-protocol-version"],
    }),
  );

  // ─── Request body size limit (10 MB) ────────────────────────
  const MAX_BODY_SIZE = 10 * 1024 * 1024;
  app.use("*", async (c, next) => {
    const contentLength = c.req.header("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
      return c.json({ error: "Request body too large" }, 413);
    }
    await next();
    return;
  });

  app.get("/health", (c) => c.json({ status: "ok" }));

  // Stateful HTTP sessions — route requests to the correct transport
  // by session ID so the MCP SDK can track request/session metadata.
  app.all("/mcp", async (c) => {
    try {
      const sessionId = c.req.header("mcp-session-id");

      // New session — log initial HTTP contact
      if (!sessionId) {
        log.debug(`New session HTTP connection request received`);
      }

      // Existing session — reuse its transport
      if (sessionId) {
        const session = httpSessions.get(sessionId);
        if (session) {
          try {
            return await session.transport.handleRequest(c.req.raw);
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            log.error(`HTTP request error [${sessionId.slice(-6)}]: ${errorMsg}`);
            throw error;
          }
        }
        // Unknown session ID — the SDK's handleRequest will reject with 404
      }

      // New session — create transport with session ID generator
      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
        onsessioninitialized: (id: string) => {
          httpSessions.set(id, { transport, server: srv });
          // Session created — logging happens after first request is handled
        },
        onsessionclosed: (id: string) => {
          httpSessions.delete(id);
          log.debug(`HTTP session closed : ${id.slice(-6)} (${httpSessions.size} active)`);
        },
      });
      transport.onerror = (error: Error) => {
        log.error(`HTTP transport error: ${error.message}`);
      };
      const srv = createMcpServer();
      servers.push(srv);
      await srv.connect(transport);

      // Handle request with error logging for network failures
      let response: Response;
      try {
        response = await transport.handleRequest(c.req.raw);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        log.error(`HTTP request error: ${errorMsg}`);
        throw error; // Re-throw to let Hono handle the 500 response
      }

      // Log session creation only after successfully handling the first request
      const newSessionId = c.req.raw.headers.get("mcp-session-id") ||
        response.headers.get("mcp-session-id");
      if (newSessionId && httpSessions.has(newSessionId)) {
        log.debug(`HTTP session created: ${newSessionId.slice(-6)} (${httpSessions.size} active)`);
      }

      return response;
    } catch (error) {
      // Unexpected errors at route level — log and return 500
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error(`Unexpected error in /mcp route: ${errorMsg}`);
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  // Deno.serve replaces @hono/node-server — zero extra dependencies
  httpServer = Deno.serve({ port: http_port, onListen: () => {} }, app.fetch);
  log.info(`Draw.io MCP Server Streamable HTTP transport active`);
  log.debug(`Health check: http://localhost:${http_port}/health`);
  log.info(`MCP endpoint: http://localhost:${http_port}/mcp`);
}

async function main() {
  // ── Load .env file if present ──────────────────────────────────────────
  // Loads variables from .env file into Deno.env (no-op if file missing)
  await loadEnv({ export: true });

  // Check if help was requested (before parsing config)
  if (shouldShowHelp(Deno.args)) {
    showHelp();
    // never returns
  }

  // Build configuration from Deno.args + Deno.env
  const configResult = buildConfig();

  // Handle errors from configuration parsing
  if (configResult instanceof Error) {
    log.error(configResult.message);
    Deno.exit(1);
  }

  const config: ServerConfig = configResult;

  log.info(`Draw.io MCP Server v${VERSION} starting`);

  // Log environment variables with aligned colons
  const envVars: [string, string | undefined][] = [
    ["AZURE_ICON_LIBRARY_PATH", Deno.env.get("AZURE_ICON_LIBRARY_PATH")],
    ["HTTP_PORT", Deno.env.get("HTTP_PORT")],
    ["LOGGER_TYPE", Deno.env.get("LOGGER_TYPE")],
    ["SAVE_DIAGRAMS", Deno.env.get("SAVE_DIAGRAMS")],
    ["TRANSPORT", Deno.env.get("TRANSPORT")],
  ];
  const maxKeyLen = Math.max(...envVars.map(([k]) => k.length));
  for (const [key, value] of envVars) {
    log.debug(`  ${key.padEnd(maxKeyLen)} : ${value ?? "(not set)"}`);
  }

  log.debug(`  ${"Transports".padEnd(maxKeyLen)} : ${config.transports.join(", ")}`);
  log.debug(`  ${"Tools".padEnd(maxKeyLen)} : ${TOOL_DEFINITIONS.length}`);

  // Eagerly load all shapes and build the fuzzy-search index at startup so
  // they are ready for the first tool call with no cold-start penalty.
  // initializeShapes also verifies the file is readable; getAzureIconLibrary()
  // will re-attempt loading on subsequent calls if shapes are still empty.
  const shapeLoadStart = performance.now();
  const shapeLibrary = initializeShapes(config.azureIconLibraryPath);
  const shapeLoadMs = (performance.now() - shapeLoadStart).toFixed(1);
  warmupSearchPath();
  log.debug(
    `Loaded ${shapeLibrary.shapes.length} Azure icon(s) across ${shapeLibrary.categories.size} categories in ${shapeLoadMs}ms (includes search index + JIT warm-up)`,
  );

  if (config.transports.indexOf("stdio") > -1) {
    await start_stdio_transport();
  }
  if (config.transports.indexOf("http") > -1) {
    await start_streamable_http_transport(config.httpPort);
  }

  log.info(`Draw.io MCP Server v${VERSION} is ready`);
  log.info("-------------------------------------------");
}

main().catch((error) => {
  log.error("Fatal error in main():", error);
  Deno.exit(1);
});
