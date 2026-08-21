import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createAvmBicepReferenceRegex,
  createAvmTerraformReferenceRegex,
  createPinnedAvmBicepRegex,
} from "../../scripts/_lib/avm-patterns.mjs";
import { extractH2Headings } from "../../scripts/_lib/h2-parser.mjs";
import { findSkillReferences } from "../../scripts/_lib/skill-references.mjs";

describe("shared parsing helpers", () => {
  it("extracts stripped or prefixed H2 headings across line endings", () => {
    const markdown = "# H1\r\n## First  \r\ntext\r\n## Second\r\n";
    assert.deepEqual(extractH2Headings(markdown), ["First", "Second"]);
    assert.deepEqual(extractH2Headings(markdown, { prefixed: true }), ["## First", "## Second"]);
  });

  it("extracts canonical skill references", () => {
    const refs = findSkillReferences(
      "Read .github/skills/azure-defaults/SKILL.md and skills/context-management/SKILL.md",
    );
    assert.deepEqual([...refs], ["azure-defaults", "context-management"]);
  });

  it("matches Bicep and Terraform AVM resource and pattern modules", () => {
    assert.deepEqual("br/public:avm/ptn/network/hub-networking:1.2.3".match(createAvmBicepReferenceRegex()), [
      "br/public:avm/ptn/network/hub-networking",
    ]);
    assert.deepEqual("Azure/avm-ptn-network-hubnetworking/azurerm".match(createAvmTerraformReferenceRegex()), [
      "Azure/avm-ptn-network-hubnetworking/azurerm",
    ]);
    const pinned = createPinnedAvmBicepRegex().exec("'br/public:avm/res/storage/storage-account:0.29.0'");
    assert.equal(pinned?.[2], "br/public:avm/res/storage/storage-account");
    assert.equal(pinned?.[3], "0.29.0");
  });
});
