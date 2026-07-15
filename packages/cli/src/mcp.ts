import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ApexService, SUPPORTED_ARTIFACT_KINDS } from "./service.js";

const artifactKind = z.enum(
  SUPPORTED_ARTIFACT_KINDS as [
    (typeof SUPPORTED_ARTIFACT_KINDS)[number],
    ...(typeof SUPPORTED_ARTIFACT_KINDS)[number][],
  ],
);
const taskOutput = z.object({ kind: artifactKind, value: z.unknown(), summary: z.string().optional() });
const normalizeOutputs = (outputs: z.infer<typeof taskOutput>[]) =>
  outputs.map(({ kind, value, summary }) => ({
    kind,
    value,
    ...(summary === undefined ? {} : { summary }),
  }));

export function createMcpServer(service: ApexService): McpServer {
  const server = new McpServer({ name: "apex", version: "0.1.0" });
  const result = (value: unknown) => ({
    content: [{ type: "text" as const, text: JSON.stringify(value) }],
    structuredContent: value as Record<string, unknown>,
  });
  server.registerTool("status", { description: "Read selected APEX run status" }, async () =>
    result(await service.status()),
  );
  server.registerTool("capabilityList", { description: "Read capability pack availability" }, async () =>
    result(await service.capabilityList()),
  );
  server.registerTool(
    "capabilityStatus",
    { description: "Read one capability pack status", inputSchema: { pack: z.string() } },
    async ({ pack }) => result(await service.capabilityStatus(pack)),
  );
  server.registerTool("nextTask", { description: "Get the next constrained workflow task" }, async () =>
    result(await service.nextTask()),
  );
  server.registerTool("taskContext", { inputSchema: { taskId: z.string() } }, async ({ taskId }) =>
    result(await service.taskContext(taskId)),
  );
  server.registerTool("recordRequirementsInput", { inputSchema: { value: z.unknown() } }, async ({ value }) => {
    await service.recordRequirementsInput(value);
    return result({ recorded: true });
  });
  server.registerTool(
    "stageArtifact",
    {
      inputSchema: {
        taskId: z.string(),
        kind: artifactKind.optional(),
        value: z.unknown().optional(),
        summary: z.string().optional(),
        outputs: z.array(taskOutput).optional(),
      },
    },
    async ({ taskId, kind, value, summary, outputs }) => {
      if (outputs !== undefined)
        return result(
          await Promise.all(normalizeOutputs(outputs).map((output) => service.stageArtifact(taskId, output))),
        );
      if (kind === undefined) throw new Error("stageArtifact requires kind/value or outputs[]");
      return result(
        await service.stageArtifact(taskId, { kind, value, ...(summary === undefined ? {} : { summary }) }),
      );
    },
  );
  server.registerTool(
    "stageFile",
    {
      inputSchema: {
        taskId: z.string(),
        path: z.string(),
        content: z.string(),
        expectedSha: z
          .string()
          .regex(/^[0-9a-f]{64}$/)
          .optional(),
      },
    },
    async ({ taskId, path, content, expectedSha }) =>
      result(await service.stageFile(taskId, path, content, expectedSha)),
  );
  server.registerTool(
    "generateIac",
    {
      inputSchema: {
        taskId: z.string(),
        existingResources: z.array(z.string()).optional(),
        azurermProviderConstraint: z.string().optional(),
        azapiProviderConstraint: z.string().optional(),
        lockFileContent: z.string().optional(),
      },
    },
    async ({ taskId, existingResources, azurermProviderConstraint, azapiProviderConstraint, lockFileContent }) =>
      result(
        await service.generateIac(taskId, {
          ...(existingResources === undefined ? {} : { existingResources }),
          ...(azurermProviderConstraint === undefined ? {} : { azurermProviderConstraint }),
          ...(azapiProviderConstraint === undefined ? {} : { azapiProviderConstraint }),
          ...(lockFileContent === undefined ? {} : { lockFileContent }),
        }),
      ),
  );
  server.registerTool(
    "validateTask",
    {
      inputSchema: {
        taskId: z.string(),
        kind: artifactKind.optional(),
        value: z.unknown().optional(),
        summary: z.string().optional(),
        outputs: z.array(taskOutput).optional(),
      },
    },
    async ({ taskId, kind, value, summary, outputs }) =>
      result(
        await service.validateTask(
          taskId,
          outputs === undefined
            ? kind === undefined
              ? undefined
              : { kind, value, ...(summary === undefined ? {} : { summary }) }
            : normalizeOutputs(outputs),
        ),
      ),
  );
  server.registerTool(
    "completeTask",
    {
      inputSchema: {
        taskId: z.string(),
        kind: artifactKind.optional(),
        value: z.unknown().optional(),
        summary: z.string().optional(),
        outputs: z.array(taskOutput).optional(),
      },
    },
    async ({ taskId, kind, value, summary, outputs }) => {
      if (outputs !== undefined) return result(await service.completeTaskOutputs(taskId, normalizeOutputs(outputs)));
      if (kind === undefined) throw new Error("completeTask requires kind/value or outputs[]");
      return result(await service.completeTask(taskId, { kind, value, ...(summary === undefined ? {} : { summary }) }));
    },
  );
  server.registerTool("preview", { description: "Read the current operator-created deployment preview" }, async () =>
    result(await service.currentPreview()),
  );
  server.registerTool("reconcile", {}, async () => result(await service.reconcile()));
  server.registerTool("inventory", {}, async () => result(await service.inventory()));
  server.registerTool("diagnose", {}, async () => result(await service.diagnose()));
  server.registerTool(
    "render",
    { inputSchema: { kind: z.enum(["status", "requirements", "preview", "approval", "inventory"]) } },
    async ({ kind }) => result(await service.render(kind)),
  );
  server.registerTool(
    "promote",
    { inputSchema: { environment: z.string(), target: z.string() } },
    async ({ environment, target }) => result(await service.promote(environment, target)),
  );
  server.registerTool(
    "doctor",
    { inputSchema: { fix: z.boolean().optional(), yes: z.boolean().optional() } },
    async ({ fix, yes }) => result(await service.doctor(fix, yes)),
  );
  server.registerTool(
    "submitEvidence",
    {
      inputSchema: {
        taskId: z.string(),
        kind: z.string(),
        value: z.record(z.string(), z.json()),
        required: z.boolean().optional(),
      },
    },
    async ({ taskId, kind, value, required }) => {
      await service.taskContext(taskId);
      return result(
        await service.acceptEvidence({ kind, contentType: "application/json", value, required: required ?? false }),
      );
    },
  );
  return server;
}

export async function serveMcp(service: ApexService): Promise<void> {
  await createMcpServer(service).connect(new StdioServerTransport());
}
