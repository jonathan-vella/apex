/**
 * Tests for the MCP console logger.
 * Verifies that error(), warn(), info(), and debug() correctly delegate
 * to console.error with proper level prefixes, timestamps, and spread data arguments.
 */
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { assert, assertEquals } from "@std/assert";
import { assertSpyCalls, type Spy, spy } from "@std/testing/mock";
import { create_logger } from "../src/loggers/mcp_console_logger.ts";

describe("create_logger", () => {
  let originalConsoleError: typeof console.error;
  let mockConsoleError: Spy;

  beforeEach(() => {
    // Save original console.error and replace with a spy
    originalConsoleError = console.error;
    mockConsoleError = spy();
    console.error = mockConsoleError;
  });

  afterEach(() => {
    // Restore original console.error
    console.error = originalConsoleError;
  });

  const ISO_PREFIX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z: /;

  it("should return a Logger object with error, warn, info, and debug methods", () => {
    const logger = create_logger();

    assert(logger !== undefined);
    assertEquals(typeof logger.error, "function");
    assertEquals(typeof logger.warn, "function");
    assertEquals(typeof logger.info, "function");
    assertEquals(typeof logger.debug, "function");
  });

  it("info method should call console.error with timestamp, message and data", () => {
    const logger = create_logger();
    const testMessage = "test message";
    const testData = { key: "value" };

    logger.info(testMessage, testData);

    assertSpyCalls(mockConsoleError, 1);
    const firstArg = mockConsoleError.calls[0].args[0] as string;
    assert(ISO_PREFIX.test(firstArg), "should start with ISO timestamp");
    assert(firstArg.endsWith(`INFO      : ${testMessage}`));
    assertEquals(mockConsoleError.calls[0].args[1], testData);
  });

  it("debug method should call console.error with timestamp, message and data", () => {
    const logger = create_logger();
    const testMessage = "debug message";
    const testData = { debug: true };

    logger.debug(testMessage, testData);

    assertSpyCalls(mockConsoleError, 1);
    const firstArg = mockConsoleError.calls[0].args[0] as string;
    assert(ISO_PREFIX.test(firstArg), "should start with ISO timestamp");
    assert(firstArg.endsWith(`DEBUG     : ${testMessage}`));
    assertEquals(mockConsoleError.calls[0].args[1], testData);
  });

  it("should handle no additional data parameters", () => {
    const logger = create_logger();
    const testMessage = "message without data";

    logger.warn(testMessage);
    const logArg = mockConsoleError.calls[0].args[0] as string;
    assert(ISO_PREFIX.test(logArg));
    assert(logArg.includes(`WARNING ⚠️: ${testMessage}`));
    assertEquals(mockConsoleError.calls[0].args.length, 1);

    // Reset by creating a fresh spy
    mockConsoleError = spy();
    console.error = mockConsoleError;

    logger.debug(testMessage);
    const debugArg = mockConsoleError.calls[0].args[0] as string;
    assert(ISO_PREFIX.test(debugArg));
    assert(debugArg.endsWith(`DEBUG     : ${testMessage}`));
    assertEquals(mockConsoleError.calls[0].args.length, 1);
  });

  it("should handle multiple data parameters", () => {
    const logger = create_logger();
    const testMessage = "message with multiple data";
    const data1 = { key1: "value1" };
    const data2 = { key2: "value2" };
    const data3 = "string data";

    logger.error(testMessage, data1, data2, data3);
    const logArg = mockConsoleError.calls[0].args[0] as string;
    assert(logArg.includes(`ERROR ❌   : ${testMessage}`));
    assertEquals(mockConsoleError.calls[0].args.slice(1), [data1, data2, data3]);

    // Reset by creating a fresh spy
    mockConsoleError = spy();
    console.error = mockConsoleError;

    logger.debug(testMessage, data1, data2, data3);
    const debugArg = mockConsoleError.calls[0].args[0] as string;
    assert(debugArg.endsWith(`DEBUG     : ${testMessage}`));
    assertEquals(mockConsoleError.calls[0].args.slice(1), [data1, data2, data3]);
  });
});
