/**
 * Classifier unit tests.
 *
 * Verifies validate-agents.mjs `classifyModel()` resolves every label in
 * the family-support matrix correctly. New families MUST add a case here.
 *
 * Run: node --test tools/tests/validate-agents/classify-model.test.mjs
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { classifyModel, isClaude, isGptOutcomeFamily, isGptFamily } from "../../scripts/validate-agents.mjs";

test("classifyModel: Claude Opus 5.5 → claude-opus-5.5", () => {
  assert.equal(classifyModel("Claude Opus 5.5"), "claude-opus-5.5");
  assert.equal(classifyModel(["Claude Opus 5.5"]), "claude-opus-5.5");
});

test("classifyModel: GPT-6 variants use distinct families", () => {
  assert.equal(classifyModel("GPT-6-Sol"), "gpt-6-sol");
  assert.equal(classifyModel(["GPT-6-Luna"]), "gpt-6-luna");
  assert.equal(classifyModel("GPT-6 Sol (copilot)"), "gpt-6-sol");
});

test("classifyModel: GPT-5.6 Terra → gpt-5.6-terra", () => {
  assert.equal(classifyModel(["GPT-5.6 Terra (copilot)"]), "gpt-5.6-terra");
  assert.equal(classifyModel("GPT-5.6-Terra"), "gpt-5.6-terra");
});

test("classifyModel: MAI-Code-1.1-Flash → mai-code", () => {
  assert.equal(classifyModel("MAI-Code-1.1-Flash"), "mai-code");
  assert.equal(classifyModel(["MAI-Code-1.1-Flash"]), "mai-code");
});

test("classifyModel: retired labels → unknown", () => {
  for (const label of [
    "Claude Opus 5",
    "Claude Opus 4.7",
    "Claude Sonnet 5",
    "Claude Haiku 4.5",
    "GPT-5.6 Sol (copilot)",
    "GPT-5.6 Luna (copilot)",
    "GPT-5.5",
    "GPT-5.4",
    "GPT-5.3-Codex",
    "GPT-4o",
  ]) {
    assert.equal(classifyModel(label), "unknown", label);
  }
});

test("classifyModel: missing or unrecognized → unknown", () => {
  assert.equal(classifyModel(undefined), "unknown");
  assert.equal(classifyModel(null), "unknown");
  assert.equal(classifyModel(""), "unknown");
  assert.equal(classifyModel("Llama 3"), "unknown");
});

test("isClaude: only matches claude-* families", () => {
  assert.equal(isClaude("claude-opus-5.5"), true);
  assert.equal(isClaude("gpt-6-sol"), false);
  assert.equal(isClaude("unknown"), false);
});

test("isGptOutcomeFamily: matches GPT-6 Sol/Luna and GPT-5.6 Terra", () => {
  for (const family of ["gpt-6-sol", "gpt-6-luna", "gpt-5.6-terra"]) assert.equal(isGptOutcomeFamily(family), true);
  assert.equal(isGptOutcomeFamily("claude-opus-5.5"), false);
  assert.equal(isGptOutcomeFamily("mai-code"), false);
});

test("isGptFamily: matches all gpt-* families", () => {
  for (const family of ["gpt-6-sol", "gpt-6-luna", "gpt-5.6-terra"]) assert.equal(isGptFamily(family), true);
  assert.equal(isGptFamily("claude-opus-5.5"), false);
});
