import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getBody, getRawFrontmatter, parseFrontmatter } from "../../scripts/_lib/parse-frontmatter.mjs";

describe("_lib/parse-frontmatter", () => {
  for (const newline of ["\n", "\r\n"]) {
    it(`parses ${JSON.stringify(newline)} delimiters`, () => {
      const content = ["---", "title: APEX", 'description: "Example"', "---", "Body"].join(newline);
      assert.deepEqual(parseFrontmatter(content), { title: "APEX", description: "Example" });
      assert.equal(getRawFrontmatter(content), ["title: APEX", 'description: "Example"'].join(newline));
      assert.equal(getBody(content), "Body");
    });
  }
});
