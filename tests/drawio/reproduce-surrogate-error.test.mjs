// Drawio MCP surrogate-pair / non-BMP encoding reproducer.
//
// Phase D5a of the nordic-foods lessons plan. Captures the exact byte
// pattern that previously crashed the Deno-hosted Drawio MCP server with
// "failed to decode message" / surrogate errors near column 9879.
//
// This test does NOT exercise the live MCP server — it's a static
// reproducer over the offending payload pattern so that:
//   1. A pre-write validator can be added that rejects malformed UTF-16
//      half-pairs in shape names / cell text before they reach the
//      server.
//   2. CI gates the regression so a future "fix" that re-introduces
//      raw \uD800-class half-pairs fails fast.
//
// When the root cause is identified (Deno surrogate encoding, VS Code
// LSP transport corruption, or MCP server malformed UTF-16), update
// /memories/repo/drawio-mcp-surrogate-trap.md with the resolution.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Sample non-BMP characters that have historically appeared in shape
// names and emoji-laced cell text. The pair-encoding rules:
//   - U+1F4E6 (📦) → surrogate pair D83D DCE6
//   - U+1F680 (🚀) → surrogate pair D83D DE80
//   - U+1F4CA (📊) → surrogate pair D83D DCCA
//
// A lone half-pair (e.g. "\uD83D" with no following low-surrogate)
// is malformed UTF-16 and breaks Deno's text decoder.

const VALID_PAIR = "\uD83D\uDCE6"; // 📦
const LONE_HIGH = "\uD83D"; // half-pair — must be rejected pre-write
const LONE_LOW = "\uDCE6"; // half-pair — must be rejected pre-write

function isMalformedUtf16(s) {
  // Walk the string; every high surrogate (U+D800..U+DBFF) must be
  // immediately followed by a low surrogate (U+DC00..U+DFFF), and no
  // low surrogate may appear without a preceding high.
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    const isHigh = code >= 0xd800 && code <= 0xdbff;
    const isLow = code >= 0xdc00 && code <= 0xdfff;
    if (isHigh) {
      const next = s.charCodeAt(i + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      i++; // consume the pair
    } else if (isLow) {
      return true; // lone low surrogate
    }
  }
  return false;
}

describe("Drawio MCP surrogate-pair reproducer (D5a)", () => {
  it("accepts well-formed surrogate pair (📦)", () => {
    assert.equal(isMalformedUtf16(VALID_PAIR), false);
    assert.equal(VALID_PAIR.length, 2, "surrogate pair occupies 2 code units");
  });

  it("rejects lone high surrogate (the original crash signature)", () => {
    assert.equal(isMalformedUtf16(LONE_HIGH), true);
  });

  it("rejects lone low surrogate", () => {
    assert.equal(isMalformedUtf16(LONE_LOW), true);
  });

  it("accepts a normal ASCII payload at the original ~9879-byte size", () => {
    const payload = "x".repeat(10000);
    assert.equal(isMalformedUtf16(payload), false);
  });

  it("detects malformed half-pair embedded mid-payload (positional reproducer)", () => {
    // Build a payload where the malformed half-pair sits near column
    // 9879 — the exact location the nordic-p1 chat captured.
    const padding = "x".repeat(9878);
    const payload = `${padding}${LONE_HIGH}trailing`;
    assert.equal(isMalformedUtf16(payload), true);
    // Sanity: removing the half-pair makes it valid
    const fixed = `${padding}${VALID_PAIR}trailing`;
    assert.equal(isMalformedUtf16(fixed), false);
  });

  it("handles a realistic shape-name payload with emoji", () => {
    const goodName = "📦 Container Apps";
    assert.equal(isMalformedUtf16(goodName), false);
    // Stripping one half of the surrogate pair must trip the detector
    const broken = "\uD83D Container Apps";
    assert.equal(isMalformedUtf16(broken), true);
  });
});

// Exported for the eventual pre-write validator in
// tools/mcp-servers/drawio/ — when the fix lands, this becomes the
// canonical encoding guard.
export { isMalformedUtf16 };
