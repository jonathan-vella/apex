/** Resolve leaf npm scripts through run-p aggregates and validate-all delegation. */

export function expandScript(scripts, name, seen = new Set()) {
  if (seen.has(name)) throw new Error(`npm script cycle detected at ${name}`);
  const command = scripts[name];
  if (!command) return [];

  const nextSeen = new Set(seen).add(name);
  const delegated = command.match(/\bvalidate-all\.mjs\b[^\n]*--suite=([^\s]+)/)?.[1];
  if (delegated) return expandScript(scripts, delegated, nextSeen);

  if (command.startsWith("run-p ")) {
    return command
      .slice("run-p ".length)
      .trim()
      .split(/\s+/)
      .filter((token) => scripts[token])
      .flatMap((token) => expandScript(scripts, token, nextSeen));
  }

  return [name];
}
