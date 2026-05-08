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

import { classifyModel, isClaude, isGpt55, isGptFamily } from "../../scripts/validate-agents.mjs";

test("classifyModel: Claude Opus 4.7 → claude-opus", () => {
  assert.equal(classifyModel("Claude Opus 4.7"), "claude-opus");
  assert.equal(classifyModel(["Claude Opus 4.7"]), "claude-opus");
});

test("classifyModel: Claude Sonnet 4.6 → claude-sonnet", () => {
  assert.equal(classifyModel("Claude Sonnet 4.6"), "claude-sonnet");
});

test("classifyModel: Claude Haiku 4.5 → claude-haiku", () => {
  assert.equal(classifyModel("Claude Haiku 4.5"), "claude-haiku");
});

test("classifyModel: bare Claude → claude (generic)", () => {
  assert.equal(classifyModel("Claude"), "claude");
});

test("classifyModel: GPT-5.5 → gpt-5.5 (current default)", () => {
  assert.equal(classifyModel("GPT-5.5"), "gpt-5.5");
  assert.equal(classifyModel(["GPT-5.5"]), "gpt-5.5");
});

test("classifyModel: GPT-5.4 → gpt-5.4", () => {
  assert.equal(classifyModel("GPT-5.4"), "gpt-5.4");
});

test("classifyModel: GPT-5.3-Codex → gpt-codex", () => {
  assert.equal(classifyModel("GPT-5.3-Codex"), "gpt-codex");
  assert.equal(classifyModel("My Codex Variant"), "gpt-codex");
});

test("classifyModel: GPT-4o → gpt-4o", () => {
  assert.equal(classifyModel("GPT-4o"), "gpt-4o");
});

test("classifyModel: unknown / missing → unknown", () => {
  assert.equal(classifyModel(undefined), "unknown");
  assert.equal(classifyModel(null), "unknown");
  assert.equal(classifyModel(""), "unknown");
  assert.equal(classifyModel("Llama 3"), "unknown");
});

test("classifyModel: GPT-5.5 ordering does not collide with GPT-5.4", () => {
  // Substring 'gpt-5.5' must match BEFORE 'gpt-5.4' branch (no false 5.4 match).
  assert.equal(classifyModel("GPT-5.5"), "gpt-5.5");
  assert.notEqual(classifyModel("GPT-5.5"), "gpt-5.4");
});

test("isClaude: only matches claude-* families", () => {
  assert.equal(isClaude("claude-opus"), true);
  assert.equal(isClaude("claude-sonnet"), true);
  assert.equal(isClaude("claude-haiku"), true);
  assert.equal(isClaude("claude"), true);
  assert.equal(isClaude("gpt-5.5"), false);
  assert.equal(isClaude("unknown"), false);
});

test("isGpt55: only true for gpt-5.5", () => {
  assert.equal(isGpt55("gpt-5.5"), true);
  assert.equal(isGpt55("gpt-5.4"), false);
  assert.equal(isGpt55("claude-opus"), false);
});

test("isGptFamily: matches all gpt-* families", () => {
  assert.equal(isGptFamily("gpt-5.5"), true);
  assert.equal(isGptFamily("gpt-5.4"), true);
  assert.equal(isGptFamily("gpt-codex"), true);
  assert.equal(isGptFamily("gpt-4o"), true);
  assert.equal(isGptFamily("claude-opus"), false);
});
