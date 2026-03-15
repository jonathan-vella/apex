/**
 * Shared H2 Heading Parser
 *
 * Utilities for extracting and comparing H2 headings from markdown.
 * Consolidates duplicate H2 logic across 4+ validators.
 */

/**
 * Extract all H2 heading texts from markdown content.
 * @param {string} content - Markdown text
 * @returns {string[]} Array of heading texts (without "## " prefix)
 */
export function extractH2Headings(content) {
  return content
    .split("\n")
    .filter((line) => /^## /.test(line))
    .map((line) => line.replace(/^## /, "").trim());
}

/**
 * Extract H2 sections with their content lines.
 * @param {string} content - Markdown text
 * @returns {Array<{heading: string, lines: string[]}>}
 */
export function extractH2Sections(content) {
  const lines = content.split("\n");
  const sections = [];
  let current = null;

  for (const line of lines) {
    if (/^## /.test(line)) {
      if (current) sections.push(current);
      current = { heading: line.replace(/^## /, "").trim(), lines: [line] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) sections.push(current);
  return sections;
}

/**
 * Normalize a heading by stripping emoji and extra whitespace.
 * @param {string} heading
 * @returns {string}
 */
export function normalizeHeading(heading) {
  return heading
    .replace(/[\p{Extended_Pictographic}\u{FE0E}\u{FE0F}]+\s*/gu, "")
    .trim();
}
