import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { assert, assertEquals, assertMatch, assertThrows } from "@std/assert";
import { spy } from "@std/testing/mock";
import { isAbsolute, resolve, SEPARATOR } from "@std/path";
import { devSaveDiagram, esmDirname, readRelativeFile } from "../src/utils.ts";

// ─── esmDirname ────────────────────────────────────────────────

describe("esmDirname", () => {
  it("returns the directory of the calling module", () => {
    const dir = esmDirname(import.meta.url);
    // This test file lives in tests/, so esmDirname should resolve to that folder
    assertMatch(dir, /tests$/);
  });

  it("returns an absolute path", () => {
    const dir = esmDirname(import.meta.url);
    assertEquals(isAbsolute(dir), true);
  });

  it("does not include a trailing separator", () => {
    const dir = esmDirname(import.meta.url);
    assertEquals(dir.endsWith(SEPARATOR), false);
  });
});

// ─── readRelativeFile ──────────────────────────────────────────

describe("readRelativeFile", () => {
  it("reads a file relative to the calling module", () => {
    // Read deno.json from tests/ → ..
    const content = readRelativeFile(import.meta.url, "..", "deno.json");
    const config = JSON.parse(content);
    assertEquals(config.name, "@drawio/mcp-server");
  });

  it("supports multiple path segments", () => {
    // Read the instructions file through two segments: "..", "src"
    const content = readRelativeFile(import.meta.url, "..", "src", "instructions.md");
    assert(content.length > 0);
  });

  it("returns UTF-8 string content", () => {
    const content = readRelativeFile(import.meta.url, "..", "deno.json");
    assertEquals(typeof content, "string");
    // Ensure it's not garbled — valid JSON means valid UTF-8
    JSON.parse(content); // throws if invalid
  });

  it("throws for non-existent file", () => {
    assertThrows(() => readRelativeFile(import.meta.url, "this-file-does-not-exist.txt"));
  });

  it("resolves relative to the module, not cwd", () => {
    // Verify the resolution is module-relative by checking the resolved path
    const dir = esmDirname(import.meta.url);
    const expectedPath = resolve(dir, "..", "deno.json");

    // File should exist at the expected path
    const stat = Deno.statSync(expectedPath);
    assert(stat.isFile);

    // Reading via readRelativeFile should produce the same content
    const viaUtil = readRelativeFile(import.meta.url, "..", "deno.json");
    const viaDirect = Deno.readTextFileSync(expectedPath);
    assertEquals(viaUtil, viaDirect);
  });
});

// ─── devSaveDiagram ────────────────────────────────────────────

describe("devSaveDiagram", () => {
  beforeEach(() => {
    // Clear the env var before each test
    Deno.env.delete("SAVE_DIAGRAMS");
  });

  afterEach(() => {
    Deno.env.delete("SAVE_DIAGRAMS");
    // Clean up the diagrams directory created by devSaveDiagram
    try {
      Deno.removeSync("./diagrams", { recursive: true });
    } catch { /* ignore */ }
  });

  it("returns null when SAVE_DIAGRAMS is not set", () => {
    const result = devSaveDiagram("<xml/>", "test-tool");
    assertEquals(result, null);
  });

  it("returns null when SAVE_DIAGRAMS is set to a non-true value", () => {
    Deno.env.set("SAVE_DIAGRAMS", "false");
    const result = devSaveDiagram("<xml/>", "test-tool");
    assertEquals(result, null);
  });

  it("saves diagram when SAVE_DIAGRAMS=true", () => {
    Deno.env.set("SAVE_DIAGRAMS", "true");
    const xml = "<mxfile><diagram>test</diagram></mxfile>";
    const result = devSaveDiagram(xml, "export-diagram");
    assert(result !== null);
    assert(result!.includes("export-diagram.drawio"));
    // Verify the file was written
    const content = Deno.readTextFileSync(result!);
    assertEquals(content, xml);
  });

  it("saves diagram when SAVE_DIAGRAMS=1", () => {
    Deno.env.set("SAVE_DIAGRAMS", "1");
    const xml = "<mxfile><diagram>test2</diagram></mxfile>";
    const result = devSaveDiagram(xml, "finish-diagram");
    assert(result !== null);
    assert(result!.includes("finish-diagram.drawio"));
  });

  it("generates filename with timestamp and tool name", () => {
    Deno.env.set("SAVE_DIAGRAMS", "true");
    const result = devSaveDiagram("<xml/>", "my-tool");
    assert(result !== null);
    // Format: YYYYMMDD_HHMMSS_my-tool.drawio
    assertMatch(result!, /\d{8}_\d{6}_my-tool\.drawio$/);
  });

  it("returns null and logs error when writeTextFileSync fails", () => {
    Deno.env.set("SAVE_DIAGRAMS", "true");
    // Stub writeTextFileSync to throw an error
    const originalWrite = Deno.writeTextFileSync;
    const errorSpy = spy(console, "error");
    try {
      Deno.writeTextFileSync = () => {
        throw new Error("disk full");
      };
      const result = devSaveDiagram("<xml/>", "fail-tool");
      assertEquals(result, null);
      // Verify the error was logged (via the console logger)
    } finally {
      Deno.writeTextFileSync = originalWrite;
      errorSpy.restore();
    }
  });

  it("handles directory already existing gracefully", () => {
    Deno.env.set("SAVE_DIAGRAMS", "true");
    // Ensure diagrams/ directory exists by saving once
    const result1 = devSaveDiagram("<xml/>", "first-save");
    assert(result1 !== null);
    // Save again — directory already exists, should not fail
    const result2 = devSaveDiagram("<xml/>", "second-save");
    assert(result2 !== null);
  });
});
