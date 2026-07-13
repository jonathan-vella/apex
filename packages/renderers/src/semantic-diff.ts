import { markdownTable } from "./markdown.js";

export type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { readonly [key: string]: JsonValue };

export interface SemanticDiffChange {
  readonly path: string;
  readonly before: JsonValue;
  readonly after: JsonValue;
}

export interface SemanticDiffResult {
  readonly added: readonly string[];
  readonly removed: readonly string[];
  readonly changed: readonly SemanticDiffChange[];
}

function pointerSegment(segment: string): string {
  return segment.replace(/~/g, "~0").replace(/\//g, "~1");
}

function childPath(path: string, segment: string): string {
  return `${path}/${pointerSegment(segment)}`;
}

function isObject(value: JsonValue): value is { readonly [key: string]: JsonValue } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collectLeafPaths(value: JsonValue, path: string): string[] {
  if (Array.isArray(value)) {
    return value.length === 0
      ? [path]
      : value.flatMap((item, index) => collectLeafPaths(item, childPath(path, String(index))));
  }
  if (isObject(value)) {
    const keys = Object.keys(value).sort();
    return keys.length === 0 ? [path] : keys.flatMap((key) => collectLeafPaths(value[key]!, childPath(path, key)));
  }
  return [path];
}

export function semanticDiff(before: JsonValue, after: JsonValue): SemanticDiffResult {
  const added: string[] = [];
  const removed: string[] = [];
  const changed: SemanticDiffChange[] = [];

  function visit(left: JsonValue, right: JsonValue, path: string): void {
    if (Object.is(left, right)) return;
    if (Array.isArray(left) && Array.isArray(right)) {
      const sharedLength = Math.min(left.length, right.length);
      for (let index = 0; index < sharedLength; index += 1) {
        visit(left[index]!, right[index]!, childPath(path, String(index)));
      }
      for (let index = sharedLength; index < left.length; index += 1) {
        removed.push(...collectLeafPaths(left[index]!, childPath(path, String(index))));
      }
      for (let index = sharedLength; index < right.length; index += 1) {
        added.push(...collectLeafPaths(right[index]!, childPath(path, String(index))));
      }
      return;
    }
    if (isObject(left) && isObject(right)) {
      const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
      for (const key of keys) {
        const nextPath = childPath(path, key);
        if (!(key in left)) added.push(...collectLeafPaths(right[key]!, nextPath));
        else if (!(key in right)) removed.push(...collectLeafPaths(left[key]!, nextPath));
        else visit(left[key]!, right[key]!, nextPath);
      }
      return;
    }
    changed.push({ path, before: left, after: right });
  }

  visit(before, after, "");
  return {
    added: added.sort(),
    removed: removed.sort(),
    changed: changed.sort((left, right) => left.path.localeCompare(right.path)),
  };
}

function conciseJson(value: JsonValue): string {
  return JSON.stringify(value);
}

export function renderSemanticDiff(diff: SemanticDiffResult): string {
  const rows: unknown[][] = [];
  for (const path of diff.added) rows.push(["Added", path || "/", "", ""]);
  for (const path of diff.removed) rows.push(["Removed", path || "/", "", ""]);
  for (const item of diff.changed) {
    rows.push(["Changed", item.path || "/", conciseJson(item.before), conciseJson(item.after)]);
  }
  rows.sort((left, right) => `${left[1]}\u0000${left[0]}`.localeCompare(`${right[1]}\u0000${right[0]}`));
  return rows.length === 0 ? "No semantic changes." : markdownTable(["Change", "Path", "Before", "After"], rows);
}
