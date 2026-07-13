import type { TSchema } from "@sinclair/typebox";
import { contractMetadata, contractSchemas, type ContractMetadata } from "./index.js";

export const JSON_SCHEMA_DIALECT = "https://json-schema.org/draft/2020-12/schema";
export const CONTRACT_METADATA_FILENAME = "contract-metadata.json";

export interface ContractSchemaFile {
  filename: string;
  contents: string;
  schema: TSchema;
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortJsonValue(child)]),
    );
  }
  return value;
}

export function serializeDeterministicJson(value: unknown): string {
  return `${JSON.stringify(sortJsonValue(value), null, 2)}\n`;
}

export function contractSchemaFilename(schema: TSchema): string {
  if (typeof schema.$id !== "string") {
    throw new Error("Cannot export a contract schema without a string $id");
  }
  const basename = new URL(schema.$id).pathname
    .split("/")
    .at(-1)
    ?.replace(/\.json$/, "");
  if (!basename) {
    throw new Error(`Cannot derive a schema filename from $id: ${schema.$id}`);
  }
  return `${basename}.schema.json`;
}

export function createPersistedContractSchema(schema: TSchema): TSchema {
  return { ...schema, $schema: JSON_SCHEMA_DIALECT };
}

export function createContractSchemaFiles(): readonly ContractSchemaFile[] {
  return contractSchemas
    .map((schema) => {
      const persistedSchema = createPersistedContractSchema(schema);
      return {
        filename: contractSchemaFilename(schema),
        contents: serializeDeterministicJson(persistedSchema),
        schema: persistedSchema,
      };
    })
    .sort((left, right) => left.filename.localeCompare(right.filename));
}

export function createContractMetadataFile(
  metadata: Readonly<Record<string, ContractMetadata>> = contractMetadata,
): string {
  return serializeDeterministicJson(metadata);
}
