// Nordic-foods replay J2 + J3 grep tests.
//
// Per-PR gate: validates that the canonical
// `expected-transcript.md` fixture passes both the J2 forbidden-pattern
// grep (every pattern must be ABSENT) and the J3 affirmative checks
// (every check's regex must be PRESENT).
//
// If this test fails on a PR that touches the fixture, the fixture is
// stale relative to the lessons-plan behaviour and must be re-recorded.
// If it fails on a PR that doesn't touch the fixture, a regex in
// forbidden-patterns.json / affirmative-checks.json drifted out of sync
// with the actual agent definitions.
//
// Phase J5 of the nordic-foods lessons plan.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TRANSCRIPT_PATH = path.join(HERE, "expected-transcript.md");
const FORBIDDEN_PATH = path.join(HERE, "forbidden-patterns.json");
const AFFIRMATIVE_PATH = path.join(HERE, "affirmative-checks.json");

const transcript = fs.readFileSync(TRANSCRIPT_PATH, "utf-8");
const forbidden = JSON.parse(fs.readFileSync(FORBIDDEN_PATH, "utf-8"));
const affirmative = JSON.parse(fs.readFileSync(AFFIRMATIVE_PATH, "utf-8"));

describe("Nordic-foods replay — forbidden patterns (J2)", () => {
  for (const f of forbidden) {
    it(`is absent: ${f.id} (${f.origin})`, () => {
      const re = new RegExp(f.regex, "i");
      const m = transcript.match(re);
      assert.equal(
        m,
        null,
        `Forbidden pattern '${f.regex}' (${f.id}) MUST NOT appear in the canonical transcript.\n` +
          `Origin: ${f.origin}\nFix: ${f.fixed_by}\nMatch: ${m && m[0]}`,
      );
    });
  }
});

describe("Nordic-foods replay — affirmative checks (J3)", () => {
  for (const a of affirmative) {
    it(`is present: ${a.id} (phase ${a.source_phase})`, () => {
      const re = new RegExp(a.regex, "i");
      assert.ok(
        re.test(transcript),
        `Affirmative regex '${a.regex}' (${a.id}) MUST appear in the canonical transcript.\n` +
          `Intended observation: ${a.intended_observation}`,
      );
    });
  }
});
