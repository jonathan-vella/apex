#!/usr/bin/env node
/**
 * safe-shell.mjs
 *
 * Documentation-aid linter that catches forbidden interactive-shell
 * patterns committed to agent, prompt, instruction, skill, AGENTS.md,
 * and README files. The primary control is
 * `.github/instructions/no-interactive-shell.instructions.md`; this
 * script enforces the same rules in committed snippets so they don't
 * drift back in via copy-paste.
 *
 * Forbidden patterns:
 *   - `mv -i`, `rm -i`, `cp -i` (incl. inside `bash -c '...'`)
 *   - `read -p`
 *   - `confirm` shell prompts
 *
 * Usage: node tools/scripts/safe-shell.mjs
 * Exit codes: 0 = clean, 1 = violations found
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(new URL("../..", import.meta.url).pathname);

// Files to scan. We mirror the applyTo glob from
// .github/instructions/no-interactive-shell.instructions.md so the linter
// stays in sync with the instruction file. Notably, skill `references/`
// folders are excluded — they hold longer-form templates (often standalone
// deploy scripts) that are not part of the auto-loaded chat context.
const SCAN_GLOBS = [
  // Agent + prompt + instruction files
  { dir: ".github/agents", suffix: ".md" },
  { dir: ".github/instructions", suffix: ".md" },
  { dir: ".github/prompts", suffix: ".md" },
];
// For skills, only the canonical SKILL files (not nested references/).
const SKILL_FILE_NAMES = new Set(["SKILL.md", "SKILL.digest.md", "SKILL.minimal.md"]);
const SCAN_ROOT_FILES = ["AGENTS.md", "README.md", ".github/copilot-instructions.md"];

// Each rule:
//   id: short rule id for the report
//   pattern: RegExp to match a forbidden snippet
//   why: short explanation
//   fix: what to do instead
const RULES = [
  {
    id: "mv-interactive",
    pattern: /\bmv\s+(?:-[a-zA-Z]*i[a-zA-Z]*\b|--interactive\b)/,
    why: "mv -i prompts for confirmation, which hangs the chat turn",
    fix: "use mv -f or use the file tool to move via create_file/replace_string_in_file",
  },
  {
    id: "rm-interactive",
    pattern: /\brm\s+(?:-[a-zA-Z]*i[a-zA-Z]*\b|--interactive\b)/,
    why: "rm -i prompts for confirmation, which hangs the chat turn",
    fix: "use rm -f (or skip the rm and let the user clean up)",
  },
  {
    id: "cp-interactive",
    pattern: /\bcp\s+(?:-[a-zA-Z]*i[a-zA-Z]*\b|--interactive\b)/,
    why: "cp -i prompts for confirmation, which hangs the chat turn",
    fix: "use cp -f or use the file tool to copy via create_file",
  },
  {
    id: "read-prompt",
    pattern: /\bread\s+(?:-[a-zA-Z]*p[a-zA-Z]*\s+|--prompt\b)/,
    why: "read -p hangs waiting for stdin in a non-interactive context",
    fix: "use the vscode_askQuestions tool to gather user input",
  },
  {
    id: "bash-c-interactive",
    // bash -c '... -i ...' wrapping mv/rm/cp/read with -i flag
    pattern: /\bbash\s+-c\s+['"][^'"]*\b(?:mv|rm|cp|read)\b[^'"]*-i[^'"]*['"]/,
    why: "interactive flag inside bash -c '...' still hangs the chat turn",
    fix: "remove the -i flag; use -f or vscode_askQuestions instead",
  },
];

const SKIP_FILE_NAMES = new Set([
  // The instruction file itself documents the forbidden patterns.
  "no-interactive-shell.instructions.md",
  // The no-heredoc instruction file references shell patterns too.
  "no-heredoc.instructions.md",
  // This script itself.
  "safe-shell.mjs",
]);

function shouldSkipPath(absPath) {
  const base = path.basename(absPath);
  if (SKIP_FILE_NAMES.has(base)) return true;
  return false;
}

function* walkScanDir(dir, suffix) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === "node_modules" ||
        entry.name === ".venv" ||
        entry.name === "venv" ||
        entry.name === "dist" ||
        entry.name === "build"
      ) {
        continue;
      }
      yield* walkScanDir(full, suffix);
    } else if (entry.isFile() && entry.name.endsWith(suffix)) {
      yield full;
    }
  }
}

function* walkSkillFiles(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip references/ and templates/ — they hold long-form material
      // not auto-loaded into chat context.
      if (entry.name === "references" || entry.name === "templates") continue;
      if (
        entry.name === "node_modules" ||
        entry.name === ".venv" ||
        entry.name === "venv" ||
        entry.name === "dist" ||
        entry.name === "build"
      ) {
        continue;
      }
      yield* walkSkillFiles(full);
    } else if (entry.isFile() && SKILL_FILE_NAMES.has(entry.name)) {
      yield full;
    }
  }
}

function collectFiles() {
  const files = new Set();
  for (const { dir, suffix } of SCAN_GLOBS) {
    const abs = path.join(ROOT, dir);
    for (const f of walkScanDir(abs, suffix)) files.add(f);
  }
  // Skill canonical files only.
  for (const f of walkSkillFiles(path.join(ROOT, ".github/skills"))) {
    files.add(f);
  }
  for (const rel of SCAN_ROOT_FILES) {
    const abs = path.join(ROOT, rel);
    if (fs.existsSync(abs)) files.add(abs);
  }
  return [...files].sort();
}

function lintFile(absPath) {
  if (shouldSkipPath(absPath)) return [];
  const findings = [];
  let content;
  try {
    content = fs.readFileSync(absPath, "utf8");
  } catch {
    return [];
  }
  const lines = content.split(/\r?\n/);
  // Track whether we are inside a fenced code block. Inside a fence the
  // patterns ARE intended as commands the agent might emit, so we lint them.
  // Outside a fence the patterns may appear in prose (inside backticks) as
  // *documentation* of forbidden patterns — those are exempt as long as they
  // sit inside inline code spans (`...`).
  let inFence = false;
  let fenceLang = "";
  lines.forEach((line, idx) => {
    const fenceOpen = line.match(/^\s*```([a-zA-Z0-9_-]*)\s*$/);
    if (fenceOpen) {
      if (inFence) {
        inFence = false;
        fenceLang = "";
      } else {
        inFence = true;
        fenceLang = fenceOpen[1].toLowerCase();
      }
      return;
    }
    // Build a "lint-eligible" version of the line. When outside a fence,
    // strip inline code spans (text inside backticks) — they are
    // documentation references, not commands.
    let toScan = line;
    if (!inFence) {
      toScan = line.replace(/`[^`]*`/g, "");
    }
    // Inside a fence, only scan shell-flavored fences. Other fences (json,
    // yaml, text, etc.) cannot be executed as shell commands.
    if (inFence) {
      const SHELL_FENCES = new Set(["", "bash", "sh", "zsh", "shell", "console"]);
      if (!SHELL_FENCES.has(fenceLang)) return;
    }
    for (const rule of RULES) {
      if (rule.pattern.test(toScan)) {
        findings.push({
          rule: rule.id,
          line: idx + 1,
          snippet: line.trim().slice(0, 160),
          why: rule.why,
          fix: rule.fix,
        });
      }
    }
  });
  return findings;
}

function main() {
  const files = collectFiles();
  let totalViolations = 0;
  for (const file of files) {
    const findings = lintFile(file);
    if (findings.length === 0) continue;
    totalViolations += findings.length;
    const rel = path.relative(ROOT, file);
    console.error(`\n❌ ${rel}`);
    for (const f of findings) {
      console.error(`   Line ${f.line} [${f.rule}]: ${f.snippet}\n     why: ${f.why}\n     fix: ${f.fix}`);
    }
  }
  if (totalViolations === 0) {
    console.log(`✅ safe-shell: scanned ${files.length} files, 0 violations`);
    process.exit(0);
  }
  console.error(`\n❌ safe-shell: ${totalViolations} violation(s) across ${files.length} files`);
  console.error("   See .github/instructions/no-interactive-shell.instructions.md for the full ruleset.");
  process.exit(1);
}

main();
