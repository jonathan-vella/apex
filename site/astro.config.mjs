// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import starlightLinksValidator from "starlight-links-validator";
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
      head: [
        {
          tag: "meta",
          attrs: {
            property: "og:image",
            content:
              "https://jonathan-vella.github.io/azure-agentic-infraops/images/og-card.png",
          },
        },
        {
          tag: "meta",
          attrs: { property: "og:type", content: "website" },
        },
        {
          tag: "meta",
          attrs: {
            name: "twitter:card",
            content: "summary_large_image",
          },
        },
        {
          tag: "script",
          attrs: {
            type: "module",
          },
          content: [
            `import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';`,
            `const d=document.documentElement.dataset.theme==='dark'||(!document.documentElement.dataset.theme&&window.matchMedia('(prefers-color-scheme:dark)').matches);`,
            `mermaid.initialize({startOnLoad:true,theme:'base',themeVariables:d?{background:'#0d1117',primaryColor:'#21262d',primaryTextColor:'#f0f6fc',primaryBorderColor:'#0078d4',lineColor:'#484f58',secondaryColor:'#161b22',tertiaryColor:'#30363d',noteBkgColor:'#161b22',noteTextColor:'#d0d7de',noteBorderColor:'#30363d',actorBkg:'#161b22',actorBorder:'#30363d',actorTextColor:'#f0f6fc',actorLineColor:'#484f58',signalColor:'#d0d7de',signalTextColor:'#d0d7de',labelBoxBkgColor:'#21262d',labelBoxBorderColor:'#30363d',labelTextColor:'#d0d7de',loopTextColor:'#8b949e',activationBorderColor:'#0078d4',activationBkgColor:'#21262d',sequenceNumberColor:'#f0f6fc',sectionBkgColor:'#161b22',altSectionBkgColor:'#21262d',sectionBkgColor2:'#21262d',excludeBkgColor:'#30363d',taskBorderColor:'#0078d4',taskBkgColor:'#21262d',taskTextColor:'#f0f6fc',activeTaskBorderColor:'#0078d4',activeTaskBkgColor:'#1e3a5f',gridColor:'#30363d',doneTaskBkgColor:'#1e3a5f',doneTaskBorderColor:'#0078d4',critBorderColor:'#f85149',critBkgColor:'#3d1f28',titleColor:'#f0f6fc',edgeLabelBackground:'#21262d',mainBkg:'#161b22',nodeBorder:'#30363d',clusterBkg:'#21262d',clusterBorder:'#30363d',defaultLinkColor:'#484f58',textColor:'#d0d7de',nodeTextColor:'#f0f6fc'}:{primaryColor:'#dbeafe',primaryTextColor:'#1b1b1f',primaryBorderColor:'#0078d4',lineColor:'#8b949e',secondaryColor:'#eaeef2',tertiaryColor:'#f6f8fa',background:'#ffffff',mainBkg:'#dbeafe',nodeBorder:'#0078d4',nodeTextColor:'#1b1b1f',textColor:'#1b1b1f'}});`,
            `setTimeout(()=>{document.querySelectorAll('.mermaid svg').forEach(s=>{s.removeAttribute('width');s.style.width='auto';s.style.maxWidth='none';});},500);`,
          ].join(""),
        },
      ],
      customCss: [
        "@fontsource/space-grotesk/400.css",
        "@fontsource/space-grotesk/700.css",
        "@fontsource/manrope/400.css",
        "@fontsource/manrope/700.css",
        "@fontsource/ibm-plex-mono/400.css",
        "./src/styles/custom.css",
      ],
      expressiveCode: {
        styleOverrides: { borderRadius: "0.5rem" },
      },
      components: {
        Footer: "./src/components/Footer.astro",
      },
      plugins: [
        starlightLinksValidator({
          errorOnRelativeLinks: false,
          errorOnInvalidHashes: false,
        }),
      ],
      sidebar: [
        {
          label: "Getting Started",
          collapsed: true,
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
          collapsed: true,
          items: [
            {
              label: "How It Works",
              collapsed: true,
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
                { label: "Workflow", slug: "concepts/workflow" },
              ],
            },
          ],
        },
        {
          label: "Guides",
          collapsed: true,
          items: [
            {
              label: "Prompt Guide",
              collapsed: true,
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
            { label: "Troubleshooting", slug: "guides/troubleshooting" },
            { label: "Session Debugging", slug: "guides/session-debugging" },
            { label: "Security Baseline", slug: "guides/security-baseline" },
            { label: "Cost Governance", slug: "guides/cost-governance" },
            { label: "Agent Hooks", slug: "guides/hooks" },
            { label: "E2E Testing", slug: "guides/e2e-testing" },
          ],
        },
        {
          label: "Reference",
          collapsed: true,
          items: [
            { label: "FAQ", slug: "reference/faq" },
            {
              label: "Validation & Linting",
              slug: "reference/validation-reference",
            },
            {
              label: "Architecture Explorer",
              slug: "reference/architecture-explorer",
            },
            { label: "Glossary", slug: "reference/glossary" },
          ],
        },
        {
          label: "Project",
          collapsed: true,
          items: [
            { label: "Contributing", slug: "project/contributing" },
            { label: "Changelog", slug: "project/changelog" },
          ],
        },
        {
          label: "Demo: Nordic Fresh Foods",
          collapsed: true,
          badge: { text: "New", variant: "tip" },
          items: [
            { label: "Overview", slug: "demo" },
            { label: "Step 1 — Requirements", slug: "demo/01-requirements" },
            { label: "Step 2 — Architecture", slug: "demo/02-architecture" },
            { label: "Step 3 — Design", slug: "demo/03-design" },
            { label: "Step 3.5 — Governance", slug: "demo/04-governance" },
            { label: "Step 4 — Plan", slug: "demo/05-plan" },
            { label: "Step 5 — Code", slug: "demo/06-code" },
            { label: "Step 6 — Deploy", slug: "demo/07-deploy" },
            { label: "Step 7 — As-Built", slug: "demo/08-as-built" },
            { label: "Reviews", slug: "demo/09-reviews" },
          ],
        },
      ],
    }),
  ],
});
