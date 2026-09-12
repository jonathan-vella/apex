import * as yaml from "js-yaml";

const FRONTMATTER = /^---\r?\n((?:[^\r\n]*(?:\r?\n))*?)---(?:\r?\n|$)/;

/**
 * Parse YAML frontmatter, preserving nested values and lowercasing top-level keys.
 * @param {string} content - Markdown file content
 * @returns {Record<string, unknown> | null} Parsed mapping, or null when absent
 */
export function parseFrontmatter(content) {
  const match = content.match(FRONTMATTER);
  if (!match) return null;
  if (!match[1].trim()) return {};
  const parsed = yaml.load(match[1], { schema: yaml.JSON_SCHEMA });
  if (parsed == null) return {};
  if (typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new TypeError("Frontmatter must be a YAML mapping");
  }
  const entries = Object.entries(parsed).map(([key, value]) => [key.toLowerCase(), value]);
  if (new Set(entries.map(([key]) => key)).size !== entries.length) {
    throw new TypeError("Frontmatter keys must be unique ignoring case");
  }
  return Object.fromEntries(entries);
}

/**
 * Extract body content after YAML frontmatter delimiters.
 * @param {string} content - Full file content
 * @returns {string} Body text, unchanged when frontmatter is absent
 */
export function getBody(content) {
  return content.replace(FRONTMATTER, "");
}

/**
 * Extract the raw YAML block without parsing it.
 * @param {string} content - Full file content
 * @returns {string} Raw frontmatter, or an empty string when absent
 */
export function getRawFrontmatter(content) {
  return content.match(FRONTMATTER)?.[1].replace(/\r?\n$/, "") ?? "";
}
