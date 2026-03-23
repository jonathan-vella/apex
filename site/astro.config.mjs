// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import rehypeMermaid from "rehype-mermaid-lite";

// https://astro.build/config
export default defineConfig({
  site: "https://jonathan-vella.github.io",
  base: "/azure-agentic-infraops",
  trailingSlash: "always",
  markdown: {
    rehypePlugins: [rehypeMermaid],
  },
  integrations: [
    starlight({
      title: "Agentic InfraOps",
      description:
        "Azure infrastructure engineered by AI agents — from requirements to deploy-ready IaC",
      favicon: "/images/favicon.svg",
      logo: {
        src: "./src/assets/images/logo.svg",
      },
      editLink: {
        baseUrl:
          "https://github.com/jonathan-vella/azure-agentic-infraops/edit/main/site/",
      },
      lastUpdated: true,
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/jonathan-vella/azure-agentic-infraops",
        },
      ],
      customCss: [
        "@fontsource/space-grotesk/400.css",
        "@fontsource/space-grotesk/500.css",
        "@fontsource/space-grotesk/700.css",
        "@fontsource/manrope/400.css",
        "@fontsource/manrope/500.css",
        "@fontsource/manrope/600.css",
        "@fontsource/manrope/700.css",
        "@fontsource/ibm-plex-mono/400.css",
        "@fontsource/ibm-plex-mono/500.css",
        "./src/styles/custom.css",
      ],
      expressiveCode: {
        styleOverrides: { borderRadius: "0.5rem" },
      },
      sidebar: [
        {
          label: "Getting Started",
          items: [
            { label: "Quickstart", slug: "getting-started/quickstart" },
            {
              label: "Dev Container Setup",
              slug: "getting-started/dev-containers",
            },
          ],
        },
        {
          label: "Concepts",
          items: [
            {
              label: "How It Works",
              items: [
                {
                  label: "Overview",
                  slug: "concepts/how-it-works",
                },
                {
                  label: "System Architecture",
                  slug: "concepts/how-it-works/architecture",
                },
                {
                  label: "Core Concepts",
                  slug: "concepts/how-it-works/four-pillars",
                },
                {
                  label: "Agent Architecture",
                  slug: "concepts/how-it-works/agents",
                },
                {
                  label: "Skills & Instructions",
                  slug: "concepts/how-it-works/skills-and-instructions",
                },
                {
                  label: "Workflow Engine & Quality",
                  slug: "concepts/how-it-works/workflow-engine",
                },
                {
                  label: "MCP Integration",
                  slug: "concepts/how-it-works/mcp-integration",
                },
              ],
            },
            { label: "Workflow", slug: "concepts/workflow" },
          ],
        },
        {
          label: "Guides",
          items: [
            {
              label: "Prompt Guide",
              items: [
                { label: "Overview", slug: "guides/prompt-guide" },
                {
                  label: "Best Practices",
                  slug: "guides/prompt-guide/best-practices",
                },
                {
                  label: "Workflow Prompts",
                  slug: "guides/prompt-guide/workflow-prompts",
                },
                {
                  label: "Skill & Subagent Reference",
                  slug: "guides/prompt-guide/reference",
                },
              ],
            },
            { label: "Cost Governance", slug: "guides/cost-governance" },
            { label: "Security Baseline", slug: "guides/security-baseline" },
            { label: "Session Debugging", slug: "guides/session-debugging" },
            { label: "Agent Hooks", slug: "guides/hooks" },
            { label: "Troubleshooting", slug: "guides/troubleshooting" },
            { label: "E2E Testing", slug: "guides/e2e-testing" },
          ],
        },
        {
          label: "Reference",
          items: [
            {
              label: "Validation & Linting",
              slug: "reference/validation-reference",
            },
            { label: "Glossary", slug: "reference/glossary" },
            { label: "FAQ", slug: "reference/faq" },
            {
              label: "Architecture Explorer",
              slug: "reference/architecture-explorer",
            },
          ],
        },
        {
          label: "Project",
          items: [
            { label: "Contributing", slug: "project/contributing" },
            { label: "Changelog", slug: "project/changelog" },
          ],
        },
      ],
    }),
  ],
});
