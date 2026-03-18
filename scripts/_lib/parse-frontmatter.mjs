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
  let pendingKey = null;

  for (const line of lines) {
    // Handle key with empty value followed by indented [ or - on next line
    if (pendingKey && !inArray && !inMultilineString) {
      const trimmed = line.trim();
      if (trimmed === "[" || trimmed.startsWith("[")) {
        currentKey = pendingKey;
        inArray = true;
        currentValue = [];
        pendingKey = null;
        if (trimmed.includes("]")) {
          const values = trimmed
            .replace(/[\[\]]/g, "")
            .split(",")
            .map((v) => v.trim().replace(/"/g, ""))
            .filter(Boolean);
          frontmatter[currentKey] = values;
          inArray = false;
          currentKey = null;
        }
        continue;
      } else if (trimmed.startsWith("-")) {
        currentKey = pendingKey;
        inArray = true;
        currentValue = [];
        pendingKey = null;
        const value = trimmed
          .replace(/^-\s*/, "")
          .replace(/["\[\],]/g, "")
          .trim();
        if (value) currentValue.push(value);
        continue;
      } else {
        frontmatter[pendingKey] = "";
        pendingKey = null;
      }
    }

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

      if (/^[>|][-+]?$/.test(rawValue)) {
        inMultilineString = true;
        currentValue = [];
        continue;
      }

      frontmatter[currentKey] = rawValue.replace(/^["']|["']$/g, "");
      if (rawValue === "") {
        pendingKey = currentKey;
        delete frontmatter[currentKey];
      }
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

/**
 * Extract body content after YAML frontmatter delimiters.
 * @param {string} content - Full file content with --- delimiters
 * @returns {string} Body text after closing ---
 */
export function getBody(content) {
  const match = content.match(/^---\n[\s\S]*?\n---\n?([\s\S]*)$/);
  return match ? match[1] : content;
}
