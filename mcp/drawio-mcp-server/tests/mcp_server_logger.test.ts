/**
 * Tests for the MCP server logger.
 * Verifies log levels, sendLoggingMessage dispatch, setLevel / setLevels handlers,
 * invalid level handling, and per-logger level management.
 */
import { beforeEach, describe, it } from "@std/testing/bdd";
import { assert, assertEquals, assertExists } from "@std/assert";
import { assertSpyCallArgs, assertSpyCalls, type Spy, spy } from "@std/testing/mock";
import { create_logger } from "../src/loggers/mcp_server_logger.ts";

describe("create_logger", () => {
  let mockSendLoggingMessage: Spy;
  let mockSetRequestHandler: Spy;
  let mockServer: {
    server: {
      sendLoggingMessage: Spy;
      setRequestHandler: Spy;
    };
  };

  beforeEach(() => {
    mockSendLoggingMessage = spy();
    mockSetRequestHandler = spy();
    mockServer = {
      server: {
        sendLoggingMessage: mockSendLoggingMessage,
        setRequestHandler: mockSetRequestHandler,
      },
    };
  });

  it("should return a Logger object with error, warn, info, and debug methods", () => {
    const logger = create_logger(mockServer as any);

    assert(logger !== undefined);
    assertEquals(typeof logger.error, "function");
    assertEquals(typeof logger.warn, "function");
    assertEquals(typeof logger.info, "function");
    assertEquals(typeof logger.debug, "function");
  });

  it("info should call sendLoggingMessage with info level and data", () => {
    const logger = create_logger(mockServer as any);
    const testMessage = "test message";
    const testData = { key: "value" };

    logger.info(testMessage, testData);

    assertSpyCalls(mockSendLoggingMessage, 1);
    assertSpyCallArgs(mockSendLoggingMessage, 0, [{
      level: "info",
      logger: ".",
      data: { message: testMessage, data: [testData] },
    }]);
  });

  it("debug should call sendLoggingMessage with debug level and data", async () => {
    const logger = create_logger(mockServer as any);
    const testMessage = "debug message";
    const testData = { debug: true };

    // Enable debug logging via the setLevel handler (second registered handler)
    const setLevelHandler = mockSetRequestHandler.calls[1].args[1] as any;
    await setLevelHandler({
      method: "logging/setLevel",
      params: { level: "debug" },
    });

    // Track calls after enabling debug
    const callsBefore = mockSendLoggingMessage.calls.length;

    logger.debug(testMessage, testData);

    assertEquals(mockSendLoggingMessage.calls.length, callsBefore + 1);
    const lastCall = mockSendLoggingMessage.calls[mockSendLoggingMessage.calls.length - 1];
    assertEquals(lastCall.args[0], {
      level: "debug",
      logger: ".",
      data: { message: testMessage, data: [testData] },
    });
  });

  it("should handle no additional data parameters", async () => {
    const logger = create_logger(mockServer as any);
    const testMessage = "message without data";

    logger.warn(testMessage);
    assertSpyCallArgs(mockSendLoggingMessage, 0, [{
      level: "warning",
      logger: ".",
      data: { message: testMessage, data: [] },
    }]);

    // Enable debug logging
    const setLevelHandler = mockSetRequestHandler.calls[1].args[1] as any;
    await setLevelHandler({
      method: "logging/setLevel",
      params: { level: "debug" },
    });

    logger.debug(testMessage);

    const lastCall = mockSendLoggingMessage.calls[mockSendLoggingMessage.calls.length - 1];
    assertEquals(lastCall.args[0], {
      level: "debug",
      logger: ".",
      data: { message: testMessage, data: [] },
    });
  });

  it("should handle multiple data parameters", async () => {
    const logger = create_logger(mockServer as any);
    const testMessage = "message with multiple data";
    const data1 = { key1: "value1" };
    const data2 = { key2: "value2" };
    const data3 = "string data";

    logger.error(testMessage, data1, data2, data3);
    assertSpyCallArgs(mockSendLoggingMessage, 0, [{
      level: "error",
      logger: ".",
      data: { message: testMessage, data: [data1, data2, data3] },
    }]);

    // Enable debug logging
    const setLevelHandler = mockSetRequestHandler.calls[1].args[1] as any;
    await setLevelHandler({
      method: "logging/setLevel",
      params: { level: "debug" },
    });

    logger.debug(testMessage, data1, data2, data3);

    const lastCall = mockSendLoggingMessage.calls[mockSendLoggingMessage.calls.length - 1];
    assertEquals(lastCall.args[0], {
      level: "debug",
      logger: ".",
      data: { message: testMessage, data: [data1, data2, data3] },
    });
  });

  it("should log a warning if logging/setLevel receives an invalid log level", async () => {
    create_logger(mockServer as any);

    const setLevelHandler = mockSetRequestHandler.calls[1].args[1] as any;
    await setLevelHandler({
      method: "logging/setLevel",
      params: { level: "not_a_level" },
    });

    // Find the warning call
    const warningCall = mockSendLoggingMessage.calls.find(
      (c: any) => c.args[0]?.level === "warning" && c.args[0]?.data?.message?.includes("Invalid log level"),
    );
    assertExists(warningCall);
    assertEquals(warningCall!.args[0], {
      level: "warning",
      logger: "logging",
      data: {
        message: "Invalid log level 'not_a_level' received",
      },
    });
  });

  it("should support valid per-logger setLevels, and emit debug message", async () => {
    create_logger(mockServer as any);

    const setLevelsHandler = mockSetRequestHandler.calls[0].args[1] as any;
    const setLevelHandler = mockSetRequestHandler.calls[1].args[1] as any;

    // Enable debug logging first
    await setLevelHandler({
      method: "logging/setLevel",
      params: { level: "debug" },
    });
    const callsBefore = mockSendLoggingMessage.calls.length;

    await setLevelsHandler({
      method: "logging/setLevels",
      params: { levels: { app: "error" } },
    });

    // Find the debug message about setting the level
    const debugCall = mockSendLoggingMessage.calls.find(
      (c: any, i: number) =>
        i >= callsBefore &&
        c.args[0]?.level === "debug" &&
        c.args[0]?.data?.message?.includes("Set log level for logger 'app'"),
    );
    assertExists(debugCall);
    assertEquals(debugCall!.args[0], {
      level: "debug",
      logger: "logging",
      data: {
        message: "Set log level for logger 'app' to 'error'",
      },
    });
  });

  it("should reset per-logger level to default when null is provided", async () => {
    create_logger(mockServer as any);

    const setLevelsHandler = mockSetRequestHandler.calls[0].args[1] as any;
    const setLevelHandler = mockSetRequestHandler.calls[1].args[1] as any;

    // Enable debug logging
    await setLevelHandler({
      method: "logging/setLevel",
      params: { level: "debug" },
    });

    await setLevelsHandler({
      method: "logging/setLevels",
      params: { levels: { app: "warning" } },
    });

    await setLevelsHandler({
      method: "logging/setLevels",
      params: { levels: { app: null } },
    });

    // Find the reset message
    const resetCall = mockSendLoggingMessage.calls.find(
      (c: any) =>
        c.args[0]?.level === "debug" &&
        c.args[0]?.logger === "logging" &&
        c.args[0]?.data?.message === "Reset log level for logger: app",
    );
    assertExists(resetCall);
  });

  it("should log a warning for invalid per-logger level in setLevels", async () => {
    create_logger(mockServer as any);

    const setLevelsHandler = mockSetRequestHandler.calls[0].args[1] as any;
    const setLevelHandler = mockSetRequestHandler.calls[1].args[1] as any;

    // Enable debug logging
    await setLevelHandler({
      method: "logging/setLevel",
      params: { level: "debug" },
    });

    await setLevelsHandler({
      method: "logging/setLevels",
      params: { levels: { "my.logger": "invalid" } },
    });

    // Find the warning message
    const warningCall = mockSendLoggingMessage.calls.find(
      (c: any) =>
        c.args[0]?.level === "warning" &&
        c.args[0]?.data?.message?.includes("Invalid log level 'invalid'"),
    );
    assertExists(warningCall);
    assertEquals(warningCall!.args[0], {
      level: "warning",
      logger: "logging",
      data: {
        message: "Invalid log level 'invalid' received for logger 'my.logger'",
      },
    });
  });

  it("should not delete root logger when null is provided for '.' in setLevels", async () => {
    create_logger(mockServer as any);

    const setLevelsHandler = mockSetRequestHandler.calls[0].args[1] as any;

    // Try to reset the root logger — should be silently ignored
    await setLevelsHandler({
      method: "logging/setLevels",
      params: { levels: { ".": null } },
    });

    // No error or warning should be logged, and root logger level should remain unchanged
    const warningCall = mockSendLoggingMessage.calls.find(
      (c: any) => c.args[0]?.data?.message?.includes("Reset log level for logger: ."),
    );
    assertEquals(warningCall, undefined);
  });
});
