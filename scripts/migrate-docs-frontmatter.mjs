#!/usr/bin/env node
// Batch-fix Starlight frontmatter and MkDocs syntax in migrated docs
import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const DOCS_DIR = "site/src/content/docs";

// Title mapping for files — extracted from the first H1 heading
const DESCRIPTIONS = {
  "getting-started/quickstart.md":
    "Get started with Agentic InfraOps in minutes",
  "getting-started/dev-containers.md":
    "Set up the VS Code Dev Container environment",
  "concepts/how-it-works/index.md": "Overview of the Agentic InfraOps system",
  "concepts/how-it-works/architecture.md":
    "System architecture and component overview",
  "concepts/how-it-works/four-pillars.md":
    "Core concepts behind the agent framework",
  "concepts/how-it-works/agents.md":
    "Agent roles, orchestration, and delegation model",
  "concepts/how-it-works/skills-and-instructions.md":
    "How skills and instructions guide agents",
  "concepts/how-it-works/workflow-engine.md":
    "Workflow DAG, quality gates, and review cycles",
  "concepts/how-it-works/mcp-integration.md":
    "MCP server integration for real-time data",
  "concepts/workflow.md": "Multi-step workflow from requirements to deployment",
  "guides/prompt-guide/index.md":
    "Guide to effective prompting with InfraOps agents",
  "guides/prompt-guide/best-practices.md":
    "Best practices for writing effective prompts",
  "guides/prompt-guide/workflow-prompts.md":
    "Step-by-step workflow prompt templates",
  "guides/prompt-guide/reference.md": "Complete skills and subagent reference",
  "guides/cost-governance.md":
    "Budget alerts, forecasts, and cost anomaly detection",
  "guides/security-baseline.md": "Non-negotiable security requirements for IaC",
  "guides/session-debugging.md":
    "Diagnose and recover from session state issues",
  "guides/hooks.md": "VS Code Agent Hooks for automated code quality",
  "guides/troubleshooting.md": "Common issues and solutions",
  "guides/e2e-testing.md": "End-to-end testing with the Ralph Loop pattern",
  "reference/validation-reference.md":
    "All validation scripts, linting, and CI workflows",
  "reference/glossary.md": "Terms and definitions used in Agentic InfraOps",
  "reference/faq.md": "Frequently asked questions",
  "reference/azure-skills-plugin.md":
    "Migration guide for the Azure Skills Plugin",
  "project/contributing.md": "How to contribute to Agentic InfraOps",
  "project/changelog.md": "All notable changes to Agentic InfraOps",
};

function walkDir(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...walkDir(full));
    } else if (full.endsWith(".md")) {
      results.push(full);
    }
  }
  return results;
}

function extractTitleFromH1(content) {
  // Find first H1, strip MkDocs emoji
  const match = content.match(/^#\s+(?::material-[^:]+:\s*)?(.+)$/m);
  return match ? match[1].trim() : null;
}

function fixFile(filePath) {
  let content = readFileSync(filePath, "utf-8");
  const relPath = filePath.replace(DOCS_DIR + "/", "");

  // Extract title from first H1
  let title = extractTitleFromH1(content);

  // Remove existing frontmatter (toc_depth etc.)
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (fmMatch) {
    content = content.slice(fmMatch[0].length);
    title = title || extractTitleFromH1(content);
  }

  if (!title) {
    title = relPath.replace(/\.md$/, "").split("/").pop().replace(/-/g, " ");
    title = title.charAt(0).toUpperCase() + title.slice(1);
  }

  const desc = DESCRIPTIONS[relPath] || title;

  // Strip :material-*: emoji syntax from headings
  content = content.replace(/:material-[a-z0-9-]+:\s*/g, "");

  // Strip <div align="center"> wrappers (MkDocs-specific)
  content = content.replace(/<div align="center">\s*\n?/g, "");
  content = content.replace(/<\/div>\s*\n?/g, "");

  // Strip <a id="top"></a> anchors
  content = content.replace(/<a id="top"><\/a>\s*\n?/g, "");

  // Convert MkDocs admonitions: !!! type "title" / ??? type "title"
  // to Starlight: :::type[title]
  content = content.replace(
    /^([!?]{3})\s+(note|tip|warning|caution|danger|info|abstract|success|question|failure|bug|example|quote)\s*(?:"([^"]*)")?\s*\n((?:    .+\n?)*)/gm,
    (match, marker, type, title, body) => {
      const starlightType =
        {
          note: "note",
          tip: "tip",
          warning: "caution",
          caution: "caution",
          danger: "danger",
          info: "note",
          abstract: "note",
          success: "tip",
          question: "note",
          failure: "danger",
          bug: "danger",
          example: "tip",
          quote: "note",
        }[type] || "note";
      const cleanBody = body.replace(/^    /gm, "");
      const titlePart = title ? `[${title}]` : "";
      return `:::${starlightType}${titlePart}\n${cleanBody}:::\n`;
    },
  );

  // Fix image paths: ../assets/images/ -> relative Astro paths
  content = content.replace(
    /src="\.\.\/assets\/images\//g,
    'src="/azure-agentic-infraops/images/',
  );

  // Fix relative links to other docs (adjust for new directory structure)
  // ../VERSION.md, ../QUALITY_SCORE.md etc -> GitHub links
  content = content.replace(
    /\]\(\.\.\/([A-Z_]+\.md)\)/g,
    "](https://github.com/jonathan-vella/azure-agentic-infraops/blob/main/$1)",
  );

  // Remove first H1 if it duplicates the frontmatter title (Starlight renders title from frontmatter)
  const h1Match = content.match(/^#\s+.+\n\n?/);
  if (h1Match) {
    content = content.slice(h1Match[0].length);
  }

  // Build new frontmatter
  const frontmatter = `---\ntitle: "${title.replace(/"/g, '\\"')}"\ndescription: "${desc.replace(/"/g, '\\"')}"\n---\n\n`;

  writeFileSync(filePath, frontmatter + content.trimStart());
  console.log(`✅ ${relPath}: "${title}"`);
}

const files = walkDir(DOCS_DIR);
console.log(`Processing ${files.length} files...\n`);
files.forEach(fixFile);
console.log(`\n✅ Done: ${files.length} files processed`);
