/** Resolve leaf npm scripts through run-p aggregates and validate-all delegation. */

import { createRequire } from "node:module";
import parseCLIArgs from "npm-run-all2/bin/common/parse-cli-args.js";
import matchTasks from "npm-run-all2/lib/match-tasks.js";

const require = createRequire(import.meta.url);
const { parse } = createRequire(require.resolve("npm-run-all2"))("shell-quote");

export function expandScript(scripts, name, seen = new Set()) {
  if (seen.has(name)) throw new Error(`npm script cycle detected at ${name}`);
  const command = scripts[name];
  if (!Object.hasOwn(scripts, name) || typeof command !== "string" || !command.trim()) {
    throw new Error(`Unknown or empty npm script: ${name}`);
  }

  const nextSeen = new Set(seen).add(name);
  const delegated = command.match(/\bvalidate-all\.mjs\b[^\n]*--suite=([^\s]+)/)?.[1];
  if (delegated) return expandScript(scripts, delegated, nextSeen);

  if (/^\s*run-p(?:\s|$)/.test(command)) {
    const tokens = parse(command).map((token) => (token?.op === "glob" ? token.pattern : token));
    const boundary = tokens.findIndex((token) => typeof token !== "string");
    const descriptorRedirection =
      [">", ">>", "<", ">&", "<&"].includes(tokens[boundary]?.op) &&
      /^\d+$/.test(tokens[boundary - 1]) &&
      Array.from(command.matchAll(/(?:^|\s)\d+(?:>>|[<>]&|[<>])/g)).some((match) => {
        const prefix = parse(command.slice(0, match.index + match[0].length));
        return (
          prefix.length === boundary + 1 &&
          prefix.at(-1)?.op === tokens[boundary].op &&
          prefix.at(-2) === tokens[boundary - 1]
        );
      });
    const args = (boundary < 0 ? tokens : tokens.slice(0, boundary - Number(descriptorRedirection))).slice(1);
    const parsed = parseCLIArgs(args, { parallel: true }, { singleMode: true });
    const patterns = parsed.groups.flatMap((group) => group.patterns);
    if (!patterns.length) throw new Error(`Empty npm aggregate: ${name}`);
    const taskNames = Object.keys(scripts);
    for (const pattern of patterns) {
      const matched = matchTasks(taskNames, [pattern]);
      if (!matched.length) throw new Error(`Unknown npm aggregate member: ${pattern}`);
    }
    const members = matchTasks(taskNames, patterns);
    const leaves = members.flatMap((member) => expandScript(scripts, member.split(" ")[0], nextSeen));
    const requiresNativeRunner =
      boundary >= 0 || args.some((arg) => arg.startsWith("-")) || members.some((member) => member.includes(" "));
    return requiresNativeRunner ? [name] : leaves;
  }

  return [name];
}
