/**
 * JSONC Parser
 *
 * Parses JSON with comments (block and single-line) and trailing commas.
 * Handles devcontainer.json and other VS Code config formats.
 *
 * @param {string} content - Raw JSONC file content
 * @returns {any} Parsed JSON object
 */
export function parseJsonc(content) {
  // Remove block comments /* ... */
  let result = content.replace(/\/\*[\s\S]*?\*\//g, "");

  // Remove single-line comments // ... (not inside strings)
  const lines = result.split("\n");
  const processedLines = lines.map((line) => {
    let inString = false;
    let escapeNext = false;
    for (let i = 0; i < line.length - 1; i++) {
      const char = line[i];
      if (escapeNext) { escapeNext = false; continue; }
      if (char === "\\") { escapeNext = true; continue; }
      if (char === '"') { inString = !inString; continue; }
      if (!inString && char === "/" && line[i + 1] === "/") {
        return line.substring(0, i);
      }
    }
    return line;
  });

  result = processedLines.join("\n");

  // Remove trailing commas before } or ]
  result = result.replace(/,(\s*[\]}])/g, "$1");

  return JSON.parse(result);
}
