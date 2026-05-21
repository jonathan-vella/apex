// remark-glossary-anchors.mjs
//
// Auto-link the first occurrence of well-known APEX acronyms in any docs
// page to their definition in `/reference/glossary/`. Skips:
//   - the glossary page itself
//   - text inside code spans, code blocks, links, and headings
//   - frontmatter (mdast strips it before this plugin runs)
//
// Only the FIRST hit per acronym per file is linked, to avoid visual noise.

const BASE = "/azure-agentic-infraops";

const ACRONYMS = [
  { token: "AVM", anchor: "avm-azure-verified-modules" },
  { token: "RBAC", anchor: "rbac-role-based-access-control" },
  { token: "CAF", anchor: "caf-cloud-adoption-framework" },
  { token: "WAF", anchor: "waf-well-architected-framework" },
  { token: "MCP", anchor: "mcp-model-context-protocol" },
];

const SKIP_TYPES = new Set([
  "code",
  "inlineCode",
  "link",
  "linkReference",
  "heading",
  "yaml",
  "html",
]);

function linkNode(token, anchor) {
  return {
    type: "link",
    url: `${BASE}/reference/glossary/#${anchor}/`,
    title: `Glossary: ${token}`,
    children: [{ type: "text", value: token }],
  };
}

export default function remarkGlossaryAnchors() {
  return (tree, file) => {
    const path = file.history?.[0] || file.path || "";
    if (/reference\/glossary\.mdx?$/.test(path)) return;

    const linked = new Set();

    const walk = (node) => {
      if (!node || typeof node !== "object") return;
      if (SKIP_TYPES.has(node.type)) return;
      if (!Array.isArray(node.children)) return;

      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        if (!child || SKIP_TYPES.has(child.type)) continue;

        if (child.type === "text" && typeof child.value === "string") {
          for (const { token, anchor } of ACRONYMS) {
            if (linked.has(token)) continue;
            const re = new RegExp(`\\b${token}\\b`);
            const match = re.exec(child.value);
            if (!match) continue;
            const before = child.value.slice(0, match.index);
            const after = child.value.slice(match.index + token.length);
            const replacement = [
              before ? { type: "text", value: before } : null,
              linkNode(token, anchor),
              after ? { type: "text", value: after } : null,
            ].filter(Boolean);
            node.children.splice(i, 1, ...replacement);
            linked.add(token);
            // Re-evaluate the same index in case `after` contains another acronym.
            i += replacement.length - 1;
            break;
          }
        } else {
          walk(child);
        }
      }
    };

    walk(tree);
  };
}
