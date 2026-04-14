/**
 * Regex Helpers
 *
 * Safe regex utilities that avoid manual lastIndex management.
 * Eliminates fragile `pattern.lastIndex = 0` calls across validators.
 *
 * @example
 *   import { findAllMatches } from "./_lib/regex-helpers.mjs";
 *   const matches = findAllMatches(/pattern/g, content);
 */

/**
 * Find all regex matches in a string without manual lastIndex management.
 * Always resets the regex before and after use.
 *
 * @param {RegExp} regex - Must have the /g flag
 * @param {string} content - String to search
 * @returns {RegExpExecArray[]} Array of match results
 */
export function findAllMatches(regex, content) {
  if (!regex.global) {
    throw new Error(`findAllMatches requires a global regex, got: ${regex}`);
  }
  regex.lastIndex = 0;
  const matches = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    matches.push(match);
  }
  regex.lastIndex = 0;
  return matches;
}
