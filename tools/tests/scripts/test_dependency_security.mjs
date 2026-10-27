import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import test from "node:test";

const linkCheckRequire = createRequire(import.meta.resolve("markdown-link-check"));
const getUriRequire = createRequire(linkCheckRequire.resolve("get-uri"));
const { getUri } = await import(linkCheckRequire.resolve("get-uri"));
const { Client, parseList } = await import(getUriRequire.resolve("basic-ftp"));
const jsdomRequire = createRequire(import.meta.resolve("jsdom"));
const { fetch } = await import(jsdomRequire.resolve("undici"));
const ajvRequire = createRequire(import.meta.resolve("ajv"));
const fastUri = ajvRequire("fast-uri");
const fastUriPkg = ajvRequire("fast-uri/package.json");

function probe(source) {
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", source], {
    cwd: new URL("../../../", import.meta.url),
    encoding: "utf8",
    timeout: 5000,
  });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stdout + result.stderr);
}

test("ip-address rejects oversized zone identifiers within a bounded runtime", () => {
  probe(`
import assert from "node:assert/strict";
import { Address6 } from "ip-address";
assert.equal(Address6.isValid("fe80::1%eth0"), true);
for (const terminator of ["\\n", "\\r", "\\u2028", "\\u2029"]) {
  assert.equal(Address6.isValid("%".repeat(1024 * 1024) + terminator), false);
}
`);
});

test("markdown-it handles unclosed multiline reference definitions within a bounded runtime", () => {
  probe(`
import assert from "node:assert/strict";
import MarkdownIt from "markdown-it";
const markdown = new MarkdownIt();
assert.equal(markdown.render("[link][ref]\\n\\n[ref]: /target\\n"), '<p><a href="/target">link</a></p>\\n');
for (const prefix of ['[a]: /u "', "["]) {
  assert.equal(typeof markdown.render(prefix + "x\\n".repeat(100000)), "string");
}
`);
});

test("undici verifies mixed-case integrity algorithms instead of silently accepting a mismatch", async () => {
  const payload = "fixture";
  const digest = createHash("sha256").update(payload).digest("base64");
  const mismatch = createHash("sha256").update("different").digest("base64");
  for (const algorithm of ["sha256", "SHA256", "Sha256"]) {
    const response = await fetch("data:text/plain,fixture", { integrity: `${algorithm}-${digest}` });
    assert.equal(await response.text(), payload);
    await assert.rejects(
      fetch("data:text/plain,fixture", { integrity: `${algorithm}-${mismatch}` }),
      (error) => error instanceof TypeError && /integrity mismatch/.test(error.cause?.message),
    );
  }
});

test("basic-ftp retains directory parsing and the get-uri LIST fallback and download contract", async (context) => {
  const [entry] = parseList("-rw-r--r-- 1 owner group 7 Oct 16 2026 fixture.txt\r\n");
  assert.equal(entry.name, "fixture.txt");
  assert.equal(entry.size, 7);

  const calls = [];
  const modifiedAt = new Date("2026-10-16T00:00:00Z");
  context.mock.method(Client.prototype, "access", async (options) => {
    assert.equal(options.host, "127.0.0.1");
    calls.push("access");
  });
  context.mock.method(Client.prototype, "lastMod", async () => {
    throw new Error("MDTM unsupported");
  });
  context.mock.method(Client.prototype, "list", async (directory) => {
    assert.equal(directory, "/");
    calls.push("list");
    return [{ name: entry.name, modifiedAt }];
  });
  context.mock.method(Client.prototype, "downloadTo", async (destination, filename) => {
    assert.equal(filename, "/fixture.txt");
    calls.push("download");
    destination.end("fixture");
    return { message: "226 Transfer complete" };
  });
  context.mock.method(Client.prototype, "close", () => calls.push("close"));

  const stream = await getUri("ftp://127.0.0.1/fixture.txt");
  assert.equal(stream.lastModified, modifiedAt);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  assert.equal(Buffer.concat(chunks).toString(), "fixture");
  assert.deepEqual(calls, ["access", "list", "download", "close"]);
});

test("get-uri preserves FTP not-found errors after the basic-ftp override", async (context) => {
  context.mock.method(Client.prototype, "access", async () => {});
  context.mock.method(Client.prototype, "lastMod", async () => {
    throw Object.assign(new Error("Missing file"), { code: 550 });
  });
  const close = context.mock.method(Client.prototype, "close", () => {});
  await assert.rejects(getUri("ftp://127.0.0.1/missing.txt"), { code: "ENOTFOUND" });
  assert.equal(close.mock.callCount(), 1);
});

test("fast-uri resolves to 3.1.9 and does not decode percent-encoded scheme prefixes", () => {
  assert.equal(fastUriPkg.version, "3.1.9");
  const parsed = fastUri.parse("ht%74ps://example.com/path");
  assert.notEqual(parsed.scheme, "https");
});
