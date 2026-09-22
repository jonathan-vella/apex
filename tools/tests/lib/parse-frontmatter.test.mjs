import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getBody, getRawFrontmatter, parseFrontmatter } from "../../scripts/_lib/parse-frontmatter.mjs";

describe("_lib/parse-frontmatter", () => {
  it("preserves mixed bare and quoted multiline tools and model priorities", () => {
    const content = `---
Name: Example
tools:
  [
    read,
    "edit",
    'search',
    azure-mcp/*,
  ]
model: [gpt-5.6-sol, GPT-5.6-Luna]
agents: []
user-invocable: false
disable-model-invocation: true
---
Body`;
    assert.deepEqual(parseFrontmatter(content), {
      name: "Example",
      tools: ["read", "edit", "search", "azure-mcp/*"],
      model: ["gpt-5.6-sol", "GPT-5.6-Luna"],
      agents: [],
      "user-invocable": false,
      "disable-model-invocation": true,
    });
  });

  it("preserves nested hooks, structured handoffs and literal strings", () => {
    const content = `---
tools:
  - read
  - 'tool,with,commas'
handoffs:
  - label: Review
    agent: Reviewer
    send: false
    prompt: |
      Keep this line.
      And this one.
hooks:
  PreToolUse:
    - type: command
      command: 'node check.mjs'
description: >-
  Fold this
  description.
released: 2026-09-11
---`;
    const parsed = parseFrontmatter(content);
    assert.deepEqual(parsed.tools, ["read", "tool,with,commas"]);
    assert.deepEqual(parsed.handoffs, [
      {
        label: "Review",
        agent: "Reviewer",
        send: false,
        prompt: "Keep this line.\nAnd this one.\n",
      },
    ]);
    assert.deepEqual(parsed.hooks, { PreToolUse: [{ type: "command", command: "node check.mjs" }] });
    assert.equal(parsed.description, "Fold this description.");
    assert.equal(parsed.released, "2026-09-11");
  });

  it("rejects malformed YAML, duplicate keys and non-mapping headers", () => {
    for (const header of ["tools: [read", "tools: []\ntools: [edit]", "Tools: []\ntools: [edit]", "- read"]) {
      assert.throws(() => parseFrontmatter(`---\n${header}\n---\nBody`));
    }
  });

  it("preserves absent-frontmatter API and requires a complete closing delimiter", () => {
    for (const content of ["Body", "---\ntools: []\n---invalid\nBody"]) {
      assert.equal(parseFrontmatter(content), null);
      assert.equal(getRawFrontmatter(content), "");
      assert.equal(getBody(content), content);
    }
    assert.deepEqual(parseFrontmatter("---\n\n---"), {});
    assert.deepEqual(parseFrontmatter("---\n---\nBody"), {});
    assert.equal(getBody("---\n---\nBody"), "Body");
    assert.equal(getRawFrontmatter("---\n---\nBody"), "");
  });

  for (const newline of ["\n", "\r\n"]) {
    it(`parses ${JSON.stringify(newline)} delimiters`, () => {
      const content = ["---", "title: APEX", 'description: "Example"', "---", "Body"].join(newline);
      assert.deepEqual(parseFrontmatter(content), { title: "APEX", description: "Example" });
      assert.equal(getRawFrontmatter(content), ["title: APEX", 'description: "Example"'].join(newline));
      assert.equal(getBody(content), "Body");
    });
  }
});
