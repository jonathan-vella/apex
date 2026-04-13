#!/usr/bin/env node
/**
 * Skill Digest Generator
 *
 * Generates SKILL.digest.md and SKILL.minimal.md from SKILL.md for each skill.
 * - Digest: key sections only, <60% of source line count
 * - Minimal: decision summaries, <50% of digest line count
 * Both include the required auto-generated header.
 *
 * @example
 * node scripts/generate-skill-digests.mjs              # all skills
 * node scripts/generate-skill-digests.mjs azure-validate  # single skill
 */

import fs from "node:fs";
import path from "node:path";
import { SKILLS_DIR } from "./_lib/paths.mjs";
import { extractH2Sections } from "./_lib/h2-parser.mjs";

const AUTO_GEN_HEADER =
  "<!-- digest:auto-generated from SKILL.md — do not edit manually -->";

const PRIORITY_HEADINGS = new Set(["Mandatory Icon Embedding"]);

function extractFrontmatterName(content) {
  const match = content.match(/^---\n(?:[\s\S]*?\n)?name:\s*["']?([^"'\n]+)["']?/m);
  return match ? match[1].trim() : null;
}

function extractTitle(content) {
  const match = content.match(/^# (.+)$/m);
  if (match) return match[1].trim();

  const frontmatterName = extractFrontmatterName(content);
  return frontmatterName || "Skill";
}

function countCodeFenceMarkers(lines) {
  return lines.filter((line) => /^```/.test(line.trim())).length;
}

function trimSection(section, maxLines) {
  const lines = section.lines.map((l) => l.trimEnd());
  if (lines.length <= maxLines) return lines;

  const trimmed = lines.slice(0, Math.max(2, maxLines - 1));
  while (trimmed.length > 1 && countCodeFenceMarkers(trimmed) % 2 !== 0) {
    trimmed.pop();
  }
  while (trimmed.length > 1 && trimmed.at(-1)?.trim() === "") {
    trimmed.pop();
  }
  trimmed.push("> _See SKILL.md for full content._");
  return trimmed;
}

function prioritizeSections(sections) {
  const prioritized = sections.filter((section) =>
    PRIORITY_HEADINGS.has(section.heading),
  );
  const remaining = sections.filter(
    (section) => !PRIORITY_HEADINGS.has(section.heading),
  );
  return [...prioritized, ...remaining];
}

function generateDigest(skillDir) {
  const sourcePath = path.join(skillDir, "SKILL.md");
  if (!fs.existsSync(sourcePath)) return null;

  const content = fs.readFileSync(sourcePath, "utf-8");
  const sourceLines = content.split("\n").length;
  const isShortSkill = sourceLines < 60;
  const targetLines = Math.max(
    isShortSkill ? 8 : 12,
    Math.floor(sourceLines * (isShortSkill ? 0.5 : 0.55)),
  );
  const title = extractTitle(content);
  const sections = prioritizeSections(extractH2Sections(content));

  const digestLines = [AUTO_GEN_HEADER, "", `# ${title} (Digest)`, ""];
  if (!isShortSkill) {
    digestLines.push(
      "Compact reference for agent startup. Read full `SKILL.md` for details.",
    );
    digestLines.push("");
  }

  let remaining = targetLines - digestLines.length;
  const maxPerSection = Math.max(
    isShortSkill ? 4 : 8,
    Math.floor(remaining / Math.max(sections.length, 1)),
  );

  for (const section of sections) {
    if (remaining <= 2) break;
    const trimmed = trimSection(section, Math.min(maxPerSection, remaining));
    digestLines.push(...trimmed);
    remaining -= trimmed.length;
    if (remaining > 1) {
      digestLines.push("");
      remaining -= 1;
    }
  }

  return (
    digestLines
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trimEnd() + "\n"
  );
}

function generateMinimal(skillDir, digestContent) {
  if (!digestContent) return null;

  const content = fs.readFileSync(path.join(skillDir, "SKILL.md"), "utf-8");
  const title = extractTitle(content);
  const sections = prioritizeSections(extractH2Sections(content));

  const digestLineCount = digestContent.split("\n").length;
  if (digestLineCount < 14) {
    return (
      [
        AUTO_GEN_HEADER,
        `# ${title} (Minimal)`,
        "Read `SKILL.md` for full content.",
      ].join("\n") + "\n"
    );
  }

  const targetLines = Math.max(7, Math.floor(digestLineCount * 0.4));

  const minimalLines = [AUTO_GEN_HEADER, "", `# ${title} (Minimal)`, ""];

  let remaining = targetLines - minimalLines.length;

  for (const section of sections) {
    if (remaining <= 2) break;
    minimalLines.push(`**${section.heading}**:`);

    const firstContent = section.lines
      .slice(1)
      .find((l) => l.trim().length > 0 && !/^[|>-]/.test(l.trim()));
    if (firstContent) {
      minimalLines.push(firstContent.trim().slice(0, 120).trimEnd());
    }
    minimalLines.push("");
    remaining -= 3;
  }

  if (remaining > 1) {
    minimalLines.push("");
  }
  minimalLines.push("Read `SKILL.md` or `SKILL.digest.md` for full content.");

  return (
    minimalLines
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trimEnd() + "\n"
  );
}

const targetSkill = process.argv[2];
const skillDirs = fs
  .readdirSync(SKILLS_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .filter((d) => !targetSkill || d.name === targetSkill)
  .map((d) => d.name);

let generated = 0;
let skipped = 0;

for (const skillName of skillDirs) {
  const skillDir = path.join(SKILLS_DIR, skillName);
  const sourcePath = path.join(skillDir, "SKILL.md");

  if (!fs.existsSync(sourcePath)) {
    skipped++;
    continue;
  }

  const digestPath = path.join(skillDir, "SKILL.digest.md");
  const minimalPath = path.join(skillDir, "SKILL.minimal.md");

  if (fs.existsSync(digestPath) && !targetSkill) {
    skipped++;
    continue;
  }

  const digest = generateDigest(skillDir);
  if (digest) {
    fs.writeFileSync(digestPath, digest);
    const minimal = generateMinimal(skillDir, digest);
    if (minimal) {
      fs.writeFileSync(minimalPath, minimal);
    }
    generated++;
    console.log(`✅ ${skillName}: digest + minimal generated`);
  }
}

console.log(
  `\n📊 Generated: ${generated}, Skipped (already exists): ${skipped}`,
);
