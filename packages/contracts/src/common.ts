import { Type, type Static } from "@sinclair/typebox";

export const CONTRACT_VERSION = "1.0.0" as const;

export const ContractVersionSchema = Type.Literal(CONTRACT_VERSION);
export const NonEmptyStringSchema = Type.String({ minLength: 1 });
export const Sha256Schema = Type.String({ pattern: "^[0-9a-f]{64}$" });
export const IsoDateTimeSchema = Type.String({ format: "date-time" });
export const ProjectIdSchema = Type.String({ pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" });
export const RunIdSchema = Type.String({ pattern: "^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$" });
export const TaskIdSchema = Type.String({ pattern: "^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$" });
export const EnvironmentSchema = Type.String({ pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" });
export const IacToolSchema = Type.Union([Type.Literal("bicep"), Type.Literal("terraform")]);
export const OperationSchema = Type.Union([Type.Literal("apply"), Type.Literal("destroy")]);
export const SECRET_FIELD_PATTERN =
  /(?:secret|password|passphrase|token|authorization|api[-_]?key|private[-_]?key|connectionString|sasToken)/i;
export const SECRET_VALUE_PATTERN =
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9._~+\/-]{16,}|(?:AccountKey|SharedAccessSignature)=|[?&](?:sig|signature)=[^&\s]{8,}|https?:\/\/[^/\s:@]+:[^@\s/]+@/i;

export type ContractVersion = Static<typeof ContractVersionSchema>;
export type ProjectId = Static<typeof ProjectIdSchema>;
export type RunId = Static<typeof RunIdSchema>;
export type TaskId = Static<typeof TaskIdSchema>;
export type IacTool = Static<typeof IacToolSchema>;
export type Operation = Static<typeof OperationSchema>;
