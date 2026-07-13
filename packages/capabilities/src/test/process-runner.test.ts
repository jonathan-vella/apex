import assert from "node:assert/strict";
import test from "node:test";
import { ProcessRunner, ProcessRunnerError, redactProcessOutput } from "../process-runner.js";

const runner = new ProcessRunner();

test("process runner uses explicit argv and redacts obvious secrets", async () => {
  const result = await runner.run({
    executable: process.execPath,
    args: ["-e", "console.log(process.argv[1])", "Bearer abc.def token=hunter2?"],
    timeoutMs: 1_000,
    maxOutputBytes: 1_024,
  });
  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /Bearer \[REDACTED\]/);
  assert.match(result.stdout, /token=\[REDACTED\]/);
  assert.doesNotMatch(result.stdout, /hunter2|abc\.def/);
});

test("process output redaction handles structured secrets, connection strings, and multiline bearer tokens", () => {
  const json = redactProcessOutput(JSON.stringify({ nested: { clientSecret: "classified", safe: "visible" } }));
  assert.deepEqual(JSON.parse(json), { nested: { clientSecret: "[REDACTED]", safe: "visible" } });

  const text = redactProcessOutput(
    "connectionString=Server=db;AccountKey=classified\nAuthorization: Bearer abc.def\nnext line",
  );
  assert.doesNotMatch(text, /classified|abc\.def/);
  assert.match(text, /connectionString=\[REDACTED\]/);
  assert.match(text, /Bearer \[REDACTED\]/);
});

test("process runner returns stable timeout and output-limit errors", async () => {
  await assert.rejects(
    runner.run({
      executable: process.execPath,
      args: ["-e", "setInterval(() => {}, 1000)"],
      timeoutMs: 10,
      maxOutputBytes: 1_024,
    }),
    processError("PROCESS_TIMEOUT"),
  );
  await assert.rejects(
    runner.run({
      executable: process.execPath,
      args: ["-e", "process.stdout.write('x'.repeat(10000))"],
      timeoutMs: 1_000,
      maxOutputBytes: 16,
    }),
    processError("PROCESS_OUTPUT_LIMIT"),
  );
});

function processError(code: string): (error: unknown) => boolean {
  return (error) => error instanceof ProcessRunnerError && error.code === code;
}
