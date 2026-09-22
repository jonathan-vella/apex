/**
 * JSONC Parser
 *
 * Parses JSON with comments (block and single-line) and trailing commas.
 * Handles devcontainer.json and other VS Code config formats.
 *
 * @param {string} content - Raw JSONC file content
 * @returns {object|string|number|boolean|null} Parsed JSON object
 */
import { parseTree, printParseErrorCode } from "jsonc-parser";

export function parseJsonc(content) {
  const errors = [];
  const tree = parseTree(content, errors, { allowTrailingComma: true });
  if (errors.length) {
    const first = errors[0];
    throw new SyntaxError(`Invalid JSONC: ${printParseErrorCode(first.error)} at offset ${first.offset}`);
  }
  const valueOf = (node) => {
    if (node.type === "object") {
      return Object.fromEntries(
        node.children.map((property) => [property.children[0].value, valueOf(property.children[1])]),
      );
    }
    if (node.type === "array") return node.children.map(valueOf);
    return node.value;
  };
  return valueOf(tree);
}
