import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TestContext } from "node:test";

export async function tempWorkspace(context: Pick<TestContext, "after">, prefix = "apex-testkit-"): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), prefix));
  context.after(async () => {
    await rm(root, { recursive: true, force: true });
  });
  return root;
}
