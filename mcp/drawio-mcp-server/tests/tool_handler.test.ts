/**
 * Tests for the tool handler factory.
 * Verifies handler dispatch, structured errors for unknown tools,
 * logging (tool prefix padding, duration, payload size), and helper functions.
 */
import { beforeEach, describe, it } from "@std/testing/bdd";
import { assert, assertEquals, assertExists } from "@std/assert";
import { assertSpyCalls, type Spy, spy } from "@std/testing/mock";
import { createToolHandlerFactory, formatBytes, timestamp, type ToolHandlerMap, type ToolLogger } from "../src/tool_handler.ts";
import { DEV_SAVED_PATH } from "../src/utils.ts";

describe("createToolHandlerFactory", () => {
  let debugSpy: Spy;
  let log: ToolLogger;
  const mockExtra = { sessionId: "test-session", requestId: "req-1" };

  beforeEach(() => {
    debugSpy = spy((..._args: any[]) => {});
    log = { debug: debugSpy };
  });

  describe("formatBytes", () => {
    it("should format small values in KB", () => {
      assertEquals(formatBytes(500), "0.49 KB");
    });

    it("should format exact kilobytes", () => {
      assertEquals(formatBytes(2048), "2.00 KB");
    });

    it("should format large values in KB", () => {
      assertEquals(formatBytes(1048576), "1024.00 KB");
    });
  });

  describe("timestamp", () => {
    it("should return an ISO 8601 string", () => {
      const ts = timestamp();
      assert(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(ts));
    });

    it("should return a recent timestamp", () => {
      const before = Date.now();
      const ts = timestamp();
      const after = Date.now();
      const parsed = new Date(ts).getTime();
      assert(parsed >= before);
      assert(parsed <= after);
    });
  });

  describe("handler dispatch", () => {
    it("should dispatch to the correct handler with args when hasArgs=true", async () => {
      const mockResult = {
        content: [{ type: "text" as const, text: '{"success":true}' }],
      };
      const handlerSpy = spy((_args: any) => Promise.resolve(mockResult));
      const handlerMap: ToolHandlerMap = { "my-tool": handlerSpy };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("my-tool", true);
      const result = await handler({ x: 100, y: 200 }, mockExtra);

      assertSpyCalls(handlerSpy, 1);
      assertEquals(handlerSpy.calls[0].args[0], { x: 100, y: 200 });
      assertEquals(result, mockResult);
    });

    it("should pass empty args when hasArgs is false", async () => {
      const mockResult = {
        content: [{ type: "text" as const, text: '{"data":"ok"}' }],
      };
      const handlerSpy = spy((_args: any) => Promise.resolve(mockResult));
      const handlerMap: ToolHandlerMap = { "no-args-tool": handlerSpy };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("no-args-tool");
      const result = await handler(mockExtra);

      assertSpyCalls(handlerSpy, 1);
      assertEquals(handlerSpy.calls[0].args[0], {});
      assertEquals(result, mockResult);
    });

    it("should return structured error for unknown tool name", async () => {
      const createToolHandler = createToolHandlerFactory({}, log);
      const handler = createToolHandler("nonexistent-tool", true);
      const result = await handler({}, mockExtra);

      assertEquals(result.isError, true);
      assertEquals(result.content[0].type, "text");
      const parsed = JSON.parse(result.content[0].text);
      assert(parsed.error.includes("nonexistent-tool"));
      assert(parsed.error.includes("not available"));
    });

    it("should return structured error for unknown tool without args", async () => {
      const createToolHandler = createToolHandlerFactory({}, log);
      const handler = createToolHandler("missing-tool");
      const result = await handler(mockExtra);

      assertEquals(result.isError, true);
      const parsed = JSON.parse(result.content[0].text);
      assert(parsed.error.includes("missing-tool"));
    });

    it("should catch handler exceptions and return structured error", async () => {
      const handlerSpy = spy((_args: any) => {
        throw new Error("unexpected boom");
      });
      const handlerMap: ToolHandlerMap = { "throwing-tool": handlerSpy };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("throwing-tool", true);
      const result = await handler({ x: 1 }, mockExtra);

      assertSpyCalls(handlerSpy, 1);
      assertEquals(result.isError, true);
      const parsed = JSON.parse(result.content[0].text);
      assertEquals(parsed.success, false);
      assertEquals(parsed.error.code, "INTERNAL_ERROR");
      assertEquals(parsed.error.message, "unexpected boom");
    });

    it("should catch async handler rejections and return structured error", async () => {
      const handlerSpy = spy((_args: any) => Promise.reject(new Error("async failure")));
      const handlerMap: ToolHandlerMap = { "rejecting-tool": handlerSpy };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("rejecting-tool", true);
      const result = await handler({}, mockExtra);

      assertSpyCalls(handlerSpy, 1);
      assertEquals(result.isError, true);
      const parsed = JSON.parse(result.content[0].text);
      assertEquals(parsed.error.code, "INTERNAL_ERROR");
      assertEquals(parsed.error.message, "async failure");
    });

    it("should handle non-Error throws and stringify them", async () => {
      const handlerSpy = spy((_args: any) => {
        throw "string error";
      });
      const handlerMap: ToolHandlerMap = { "string-throw": handlerSpy };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("string-throw", true);
      const result = await handler({}, mockExtra);

      assertEquals(result.isError, true);
      const parsed = JSON.parse(result.content[0].text);
      assertEquals(parsed.error.message, "string error");
    });
  });

  describe("logging", () => {
    it("should log tool call with session and request IDs", async () => {
      const mockResult = {
        content: [{ type: "text" as const, text: "{}" }],
      };
      const handlerSpy = spy((_args: any) => Promise.resolve(mockResult));
      const handlerMap: ToolHandlerMap = { "logged-tool": handlerSpy };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("logged-tool", true);
      await handler({}, mockExtra);

      const firstCallMsg = debugSpy.calls[0].args[0] as string;
      assert(!firstCallMsg.includes("session="));
      assert(firstCallMsg.includes("req:req-1"));
    });

    it("should handle missing sessionId without logging session", async () => {
      const mockResult = {
        content: [{ type: "text" as const, text: "{}" }],
      };
      const handlerSpy = spy((_args: any) => Promise.resolve(mockResult));
      const handlerMap: ToolHandlerMap = { "tool": handlerSpy };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("tool", true);
      await handler({}, { requestId: "r1" });

      const firstCallMsg = debugSpy.calls[0].args[0] as string;
      assert(!firstCallMsg.includes("session="));
      assert(firstCallMsg.includes("req:000r1"));
    });

    it("should handle undefined extra without logging session", async () => {
      const mockResult = {
        content: [{ type: "text" as const, text: "{}" }],
      };
      const handlerSpy = spy((_args: any) => Promise.resolve(mockResult));
      const handlerMap: ToolHandlerMap = { "tool": handlerSpy };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("tool");
      await handler(undefined);

      const firstCallMsg = debugSpy.calls[0].args[0] as string;
      assert(!firstCallMsg.includes("session="));
    });

    it("should log the called line without args by default", async () => {
      const mockResult = {
        content: [{ type: "text" as const, text: "{}" }],
      };
      const handlerSpy = spy((_args: any) => Promise.resolve(mockResult));
      const handlerMap: ToolHandlerMap = { "args-tool": handlerSpy };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("args-tool", true);
      await handler({ x: 100, text: "hello" }, mockExtra);

      const calledCall = debugSpy.calls.find(
        (c: any) => (c.args[0] as string).includes("called"),
      );
      assertExists(calledCall);
      assertEquals(calledCall!.args.length, 1);
    });

    it("should log called line without args when hasArgs is false", async () => {
      const mockResult = {
        content: [{ type: "text" as const, text: "{}" }],
      };
      const handlerSpy = spy((_args: any) => Promise.resolve(mockResult));
      const handlerMap: ToolHandlerMap = { "no-args": handlerSpy };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("no-args");
      await handler(mockExtra);

      const calledCall = debugSpy.calls.find(
        (c: any) => (c.args[0] as string).includes("called"),
      );
      assertExists(calledCall);
      assertEquals(calledCall!.args.length, 1);
    });

    it("should log 'ok' with payload size for successful handler results", async () => {
      const successResult = {
        content: [{ type: "text" as const, text: "{}" }],
      };
      const handlerSpy = spy((_args: any) => Promise.resolve(successResult));
      const handlerMap: ToolHandlerMap = { "ok-tool": handlerSpy };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("ok-tool", true);
      await handler({}, mockExtra);

      const debugMessages = debugSpy.calls.map((c: any) => c.args[0] as string);
      const resultLog = debugMessages.find((msg: string) => msg.includes("ok in"));
      assertExists(resultLog);
      assert(resultLog!.includes("[tool:ok-tool]"));
      assert(/[\d.]+ KB/.test(resultLog!));
    });

    it("should log 'error' with payload size for handler results with isError=true", async () => {
      const errorResult = {
        content: [{ type: "text" as const, text: '{"error":"fail"}' }],
        isError: true,
      };
      const handlerSpy = spy((_args: any) => Promise.resolve(errorResult));
      const handlerMap: ToolHandlerMap = { "error-tool": handlerSpy };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("error-tool", true);
      await handler({}, mockExtra);

      const debugMessages = debugSpy.calls.map((c: any) => c.args[0] as string);
      const resultLog = debugMessages.find((msg: string) => msg.includes("error in"));
      assertExists(resultLog);
      assert(resultLog!.includes("[tool:error-tool]"));
      assert(/[\d.]+ KB/.test(resultLog!));
    });

    it("should log 'not found' for unknown tools", async () => {
      const createToolHandler = createToolHandlerFactory({}, log);
      const handler = createToolHandler("missing", true);
      await handler({}, mockExtra);

      const hasNotFound = debugSpy.calls.some(
        (c: any) => typeof c.args[0] === "string" && (c.args[0] as string).includes("not found"),
      );
      assert(hasNotFound);
    });

    it("should format payload size in KB for larger payloads", async () => {
      const largeText = "x".repeat(2048);
      const largeResult = {
        content: [{ type: "text" as const, text: largeText }],
      };
      const handlerSpy = spy((_args: any) => Promise.resolve(largeResult));
      const handlerMap: ToolHandlerMap = { "large-tool": handlerSpy };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("large-tool", true);
      await handler({}, mockExtra);

      const debugMessages = debugSpy.calls.map((c: any) => c.args[0] as string);
      const resultLog = debugMessages.find((msg: string) => msg.includes("ok in"));
      assertExists(resultLog);
      assert(/[\d.]+ KB/.test(resultLog!));
    });

    it("should log 0.00 KB when content has no text property", async () => {
      const imageResult = {
        content: [{ type: "image" as const, data: "abc", mimeType: "image/png" }],
      };
      const handlerSpy = spy((_args: any) => Promise.resolve(imageResult));
      const handlerMap: ToolHandlerMap = { "img-tool": handlerSpy };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("img-tool", true);
      await handler({}, mockExtra);

      const debugMessages = debugSpy.calls.map((c: any) => c.args[0] as string);
      const resultLog = debugMessages.find((msg: string) => msg.includes("ok in"));
      assertExists(resultLog);
      assert(resultLog!.includes("0.00 KB"));
    });

    it("should include duration in success log", async () => {
      const mockResult = {
        content: [{ type: "text" as const, text: "{}" }],
      };
      const handlerSpy = spy((_args: any) => Promise.resolve(mockResult));
      const handlerMap: ToolHandlerMap = { "timed-tool": handlerSpy };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("timed-tool", true);
      await handler({}, mockExtra);

      const debugMessages = debugSpy.calls.map((c: any) => c.args[0] as string);
      const resultLog = debugMessages.find((msg: string) => msg.includes("ms"));
      assertExists(resultLog);
      assert(/\d+\s*ms/.test(resultLog!));
    });

    it("should pad tool prefix to align status words", async () => {
      const mockResult = {
        content: [{ type: "text" as const, text: "{}" }],
      };
      const handlerSpy = spy((_args: any) => Promise.resolve(mockResult));
      const handlerMap: ToolHandlerMap = { "a": handlerSpy };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("a", true);
      await handler({}, mockExtra);

      const debugMessages = debugSpy.calls.map((c: any) => c.args[0] as string);
      const calledLog = debugMessages.find((msg: string) => msg.includes("called"));
      const okLog = debugMessages.find((msg: string) => msg.includes("ok in"));
      // Both lines should start with an ISO timestamp followed by padded req tag and padded tool prefix
      assert(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z: \[req:.+?\] \[tool:a\]\s+called/.test(calledLog!));
      assert(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z: \[req:.+?\] \[tool:a\]\s+ok in/.test(okLog!));
      // "called" and "ok in" should start at the same column (aligned by padEnd)
      assertEquals(calledLog!.indexOf("called"), okLog!.indexOf("ok in"));
    });

    it("should log DEV_SAVED_PATH with formatted prefix when present on result", async () => {
      const mockResult: any = {
        content: [{ type: "text" as const, text: '{"success":true}' }],
      };
      mockResult[DEV_SAVED_PATH] = "diagrams/20260219_182125_finish-diagram.drawio";
      const handlerSpy = spy((_args: any) => Promise.resolve(mockResult));
      const handlerMap: ToolHandlerMap = { "save-tool": handlerSpy };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("save-tool", true);
      const result = await handler({}, mockExtra);

      const debugMessages = debugSpy.calls.map((c: any) => c.args[0] as string);
      const devLog = debugMessages.find((msg: string) => msg.includes("diagram saved to"));
      assertExists(devLog);
      assert(devLog!.includes("[tool:save-tool]"));
      assert(devLog!.includes("[req:req-1]"));
      assert(devLog!.includes("[ses:ession]"));
      assert(devLog!.includes("diagrams/20260219_182125_finish-diagram.drawio"));
      // Symbol should be cleaned from the result
      assertEquals((result as any)[DEV_SAVED_PATH], undefined);
    });

    it("should not log DEV_SAVED_PATH when not present on result", async () => {
      const mockResult = {
        content: [{ type: "text" as const, text: '{"success":true}' }],
      };
      const handlerSpy = spy((_args: any) => Promise.resolve(mockResult));
      const handlerMap: ToolHandlerMap = { "no-save-tool": handlerSpy };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("no-save-tool", true);
      await handler({}, mockExtra);

      const debugMessages = debugSpy.calls.map((c: any) => c.args[0] as string);
      const devLog = debugMessages.find((msg: string) => msg.includes("diagram saved to"));
      assertEquals(devLog, undefined);
    });

    it("should log (txn) suffix when args.transactional is true", async () => {
      const mockResult = {
        content: [{ type: "text" as const, text: '{"success":true}' }],
      };
      const handlerSpy = spy((_args: any) => Promise.resolve(mockResult));
      const handlerMap: ToolHandlerMap = { "txn-tool": handlerSpy };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("txn-tool", true);
      await handler({ transactional: true }, mockExtra);

      const calledMsg = debugSpy.calls[0].args[0] as string;
      assert(calledMsg.includes("(txn)"));
    });

    it("should log resolved_count when present in response text", async () => {
      const mockResult = {
        content: [{ type: "text" as const, text: '{"resolved_count":3}' }],
      };
      const handlerSpy = spy((_args: any) => Promise.resolve(mockResult));
      const handlerMap: ToolHandlerMap = { "resolve-tool": handlerSpy };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("resolve-tool", true);
      await handler({}, mockExtra);

      const debugMessages = debugSpy.calls.map((c: any) => c.args[0] as string);
      const resolvedLog = debugMessages.find((msg: string) => msg.includes("resolved 3 placeholders"));
      assertExists(resolvedLog);
    });

    it("should log singular placeholder when resolved_count is 1", async () => {
      const mockResult = {
        content: [{ type: "text" as const, text: '{"resolved_count":1}' }],
      };
      const handlerSpy = spy((_args: any) => Promise.resolve(mockResult));
      const handlerMap: ToolHandlerMap = { "resolve-tool": handlerSpy };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("resolve-tool", true);
      await handler({}, mockExtra);

      const debugMessages = debugSpy.calls.map((c: any) => c.args[0] as string);
      const resolvedLog = debugMessages.find((msg: string) => msg.includes("resolved 1 placeholder"));
      assertExists(resolvedLog);
      assert(!resolvedLog!.includes("placeholders"));
    });

    it("should extract error.message from error result JSON", async () => {
      const errorResult = {
        content: [{ type: "text" as const, text: '{"error":{"message":"detailed failure"}}' }],
        isError: true,
      };
      const handlerSpy = spy((_args: any) => Promise.resolve(errorResult));
      const handlerMap: ToolHandlerMap = { "err-msg-tool": handlerSpy };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("err-msg-tool", true);
      await handler({}, mockExtra);

      const debugMessages = debugSpy.calls.map((c: any) => c.args[0] as string);
      const errorLog = debugMessages.find((msg: string) => msg.includes("detailed failure"));
      assertExists(errorLog);
    });

    it("should fall back to data.error string when error.message is absent", async () => {
      const errorResult = {
        content: [{ type: "text" as const, text: '{"error":"plain error string"}' }],
        isError: true,
      };
      const handlerSpy = spy((_args: any) => Promise.resolve(errorResult));
      const handlerMap: ToolHandlerMap = { "err-str-tool": handlerSpy };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("err-str-tool", true);
      await handler({}, mockExtra);

      const debugMessages = debugSpy.calls.map((c: any) => c.args[0] as string);
      const errorLog = debugMessages.find((msg: string) => msg.includes("plain error string"));
      assertExists(errorLog);
    });

    it("should log error without message when result text is not JSON", async () => {
      const errorResult = {
        content: [{ type: "text" as const, text: "not valid json" }],
        isError: true,
      };
      const handlerSpy = spy((_args: any) => Promise.resolve(errorResult));
      const handlerMap: ToolHandlerMap = { "bad-json-err": handlerSpy };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("bad-json-err", true);
      await handler({}, mockExtra);

      const debugMessages = debugSpy.calls.map((c: any) => c.args[0] as string);
      const errorLog = debugMessages.find((msg: string) => msg.includes("error in") && !msg.includes("not valid json"));
      assertExists(errorLog);
    });

    it("should skip resolved_count logging when text is not JSON", async () => {
      const mockResult = {
        content: [{ type: "text" as const, text: "not json" }],
      };
      const handlerSpy = spy((_args: any) => Promise.resolve(mockResult));
      const handlerMap: ToolHandlerMap = { "non-json-tool": handlerSpy };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("non-json-tool", true);
      await handler({}, mockExtra);

      const debugMessages = debugSpy.calls.map((c: any) => c.args[0] as string);
      const resolvedLog = debugMessages.find((msg: string) => msg.includes("resolved"));
      assertEquals(resolvedLog, undefined);
    });

    it("should fall back to 'Unknown error' when error has no message or string", async () => {
      const errorResult = {
        content: [{ type: "text" as const, text: '{"error":null}' }],
        isError: true,
      };
      const handlerSpy = spy((_args: any) => Promise.resolve(errorResult));
      const handlerMap: ToolHandlerMap = { "null-err-tool": handlerSpy };

      const createToolHandler = createToolHandlerFactory(handlerMap, log);
      const handler = createToolHandler("null-err-tool", true);
      await handler({}, mockExtra);

      const debugMessages = debugSpy.calls.map((c: any) => c.args[0] as string);
      const errorLog = debugMessages.find((msg: string) => msg.includes("Unknown error"));
      assertExists(errorLog);
    });
  });
});
