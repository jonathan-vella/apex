export function escapeMarkdown(value: unknown): string {
  const text = value === null ? "null" : String(value);
  return text
    .replace(
      /[\u0000-\u0009\u000b\u000c\u000e-\u001f\u007f]/g,
      (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`,
    )
    .replace(/\r\n?|\n/g, "<br>")
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|");
}

export function markdownTable(headers: readonly string[], rows: readonly (readonly unknown[])[]): string {
  const header = `| ${headers.map(escapeMarkdown).join(" | ")} |`;
  const separator = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${row.map(escapeMarkdown).join(" | ")} |`);
  return [header, separator, ...body].join("\n");
}

export function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    const encoded = JSON.stringify(value);
    return encoded === undefined ? "null" : encoded;
  }
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const entries = Object.entries(value as Readonly<Record<string, unknown>>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
}

export function optional(value: unknown): string {
  return value === undefined ? "-" : String(value);
}
