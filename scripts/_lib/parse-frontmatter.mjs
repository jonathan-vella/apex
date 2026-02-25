/**
 * Shared YAML-like Frontmatter Parser
 *
 * Handles arrays (inline and multi-line), multiline strings (> and |),
 * and quoted values. Not a full YAML parser — covers the subset used
 * in agent and skill frontmatter.
 *
 * @param {string} content - Markdown file content
 * @returns {Record<string, string | string[]> | null} Parsed frontmatter or null
 */
export function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const frontmatter = {};
  const lines = match[1].split("\n");
  let currentKey = null;
  let currentValue = [];
  let inArray = false;
  let inMultilineString = false;

  for (const line of lines) {
    if (inArray) {
      if (line.trim().startsWith("-") || line.trim().startsWith('"')) {
        const value = line
          .trim()
          .replace(/^-\s*/, "")
          .replace(/["\[\],]/g, "")
          .trim();
        if (value) currentValue.push(value);
        continue;
      } else if (line.trim() === "]" || line.trim().endsWith("]")) {
        frontmatter[currentKey] = currentValue;
        inArray = false;
        currentKey = null;
        currentValue = [];
        continue;
      } else if (line.trim() && !line.startsWith(" ") && line.includes(":")) {
        frontmatter[currentKey] = currentValue;
        inArray = false;
        currentValue = [];
      }
    }

    if (inMultilineString) {
      if (line.startsWith("  ")) {
        currentValue.push(line.trim());
        continue;
      } else {
        frontmatter[currentKey] = currentValue.join(" ");
        inMultilineString = false;
        currentKey = null;
        currentValue = [];
      }
    }

    const keyMatch = line.match(/^([a-z-]+):\s*(.*)/i);
    if (keyMatch) {
      currentKey = keyMatch[1].toLowerCase();
      const rawValue = keyMatch[2].trim();

      if (rawValue === "[" || rawValue.startsWith("[")) {
        inArray = true;
        currentValue = [];
        if (rawValue.includes("]")) {
          const values = rawValue
            .replace(/[\[\]]/g, "")
            .split(",")
            .map((v) => v.trim().replace(/"/g, ""))
            .filter(Boolean);
          frontmatter[currentKey] = values;
          inArray = false;
          currentKey = null;
        }
        continue;
      }

      if (rawValue === ">" || rawValue === "|") {
        inMultilineString = true;
        currentValue = [];
        continue;
      }

      frontmatter[currentKey] = rawValue.replace(/^["']|["']$/g, "");
    }
  }

  if (inArray && currentKey) {
    frontmatter[currentKey] = currentValue;
  }
  if (inMultilineString && currentKey) {
    frontmatter[currentKey] = currentValue.join(" ");
  }

  return frontmatter;
}
