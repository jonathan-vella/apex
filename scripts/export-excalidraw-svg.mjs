#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";

const DEFAULT_DIRS = [
  "agent-output",
  "assets",
  "site/public",
  ".github/skills/azure-diagrams/references",
];

function findFiles(dir) {
  const resolved = path.resolve(dir);
  if (!fs.existsSync(resolved)) {
    return [];
  }

  const results = [];
  for (const entry of fs.readdirSync(resolved, { withFileTypes: true })) {
    const fullPath = path.join(resolved, entry.name);
    if (entry.isDirectory()) {
      results.push(...findFiles(fullPath));
      continue;
    }

    if (
      entry.name.endsWith(".excalidraw") &&
      !entry.name.endsWith(".excalidraw.svg") &&
      !entry.name.endsWith(".excalidraw.png")
    ) {
      results.push(fullPath);
    }
  }
  return results;
}

async function exportFile(filePath) {
  installDomGlobals();
  const { exportToSvg } = await import("@excalidraw/utils");
  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const svg = await exportToSvg({
    elements: data.elements ?? [],
    appState: data.appState ?? {},
    files: data.files ?? {},
  });
  const svgPath = `${filePath}.svg`;
  fs.writeFileSync(svgPath, svg.outerHTML ?? svg.toString(), "utf-8");
  return svgPath;
}

function installDomGlobals() {
  if (globalThis.window && globalThis.document) {
    return;
  }

  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    pretendToBeVisual: true,
    url: "http://localhost/",
  });

  const { window } = dom;
  globalThis.window = window;
  globalThis.document = window.document;
  Object.defineProperty(globalThis, "navigator", {
    value: window.navigator,
    configurable: true,
  });
  globalThis.self = window;
  globalThis.top = window;
  globalThis.parent = window;
  globalThis.devicePixelRatio = 1;
  window.devicePixelRatio = 1;
  globalThis.Element = window.Element;
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.SVGElement = window.SVGElement;
  globalThis.SVGSVGElement = window.SVGSVGElement;
  globalThis.Node = window.Node;
  globalThis.DOMParser = window.DOMParser;
  globalThis.XMLSerializer = window.XMLSerializer;
  globalThis.getComputedStyle = window.getComputedStyle.bind(window);
  globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window);
  globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
  globalThis.performance = window.performance;
  globalThis.FontFace = class {
    constructor(family, source, descriptors = {}) {
      this.family = family;
      this.source = source;
      this.descriptors = descriptors;
      this.status = "loaded";
    }

    async load() {
      return this;
    }
  };
  document.fonts = {
    add() {},
    delete() {
      return true;
    },
    clear() {},
    has() {
      return false;
    },
    ready: Promise.resolve(),
  };
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  globalThis.matchMedia = () => ({
    matches: false,
    media: "screen",
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return false;
    },
  });
}

async function main() {
  const dirs = process.argv.slice(2);
  const targets = dirs.length > 0 ? dirs : DEFAULT_DIRS;
  const files = targets.flatMap((dir) => findFiles(dir));

  let exported = 0;
  let failed = 0;

  for (const filePath of files) {
    try {
      const svgPath = await exportFile(filePath);
      console.log(
        `Exported: ${path.relative(process.cwd(), filePath)} -> ${path.relative(process.cwd(), svgPath)}`,
      );
      exported += 1;
    } catch (error) {
      console.error(
        `Failed: ${path.relative(process.cwd(), filePath)} -> ${error.message}`,
      );
      failed += 1;
    }
  }

  console.log(`Exported: ${exported} | Failed: ${failed}`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

await main();
