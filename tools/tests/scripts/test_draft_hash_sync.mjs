import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import test from "node:test";
import { syncDraft } from "../../scripts/sync-draft-contract-hashes.mjs";

test("draft hash sync computes full digests without writing or touching approved inputs", (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "draft-hashes-"));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const contract = path.join(directory, "04-iac-contract.json");
  fs.writeFileSync(path.join(directory, "04-implementation-plan.md"), "draft");
  fs.writeFileSync(path.join(directory, "04-policy-property-map.json"), "{}");
  fs.writeFileSync(
    contract,
    JSON.stringify({
      plan_ref: { path: "04-implementation-plan.md" },
      l1m_ref: { path: "04-policy-property-map.json" },
    }),
  );
  const before = fs.readFileSync(contract);
  const options = {
    expectedSha: crypto.createHash("sha256").update(before).digest("hex"),
    reason: "owner repair",
    state: { steps: { 4: { status: "in_progress" } }, decisions: {} },
  };
  const result = syncDraft(contract, options);
  assert.equal(JSON.parse(result.text).plan_ref.sha256, crypto.createHash("sha256").update("draft").digest("hex"));
  assert.deepEqual(fs.readFileSync(contract), before);
  options.state.decisions.plan_status = "APPROVED";
  assert.throws(() => syncDraft(contract, options), /unapproved draft/);
  assert.deepEqual(fs.readFileSync(contract), before);
});
