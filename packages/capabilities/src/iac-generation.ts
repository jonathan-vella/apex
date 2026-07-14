import { lstat, mkdir, open, realpath, rename, rm } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import type { IacBindingV1, ImplementationIntentV1, LogicalResourceManifestV1 } from "@apex/contracts";
import type { CommandPlan } from "./command-plans.js";
import type { ProcessResult, ProcessRunnerLike } from "./process-runner.js";
import { sha256 } from "./iac.js";

export interface VirtualTreeFile {
  readonly path: string;
  readonly content: string;
}

export interface GeneratedVirtualTree {
  readonly files: readonly VirtualTreeFile[];
  readonly logicalManifest: LogicalResourceManifestV1;
  readonly treeHash: string;
}

export interface BicepGenerationOptions {
  readonly existingResources?: readonly string[];
}

export interface TerraformGenerationOptions {
  readonly azurermProviderConstraint?: string;
  readonly azapiProviderConstraint?: string;
  readonly lockFileContent?: string;
  readonly existingResources?: readonly string[];
}

export interface WriteVirtualTreeOptions {
  readonly overwrite?: boolean;
}

export interface LogicalParityDifference {
  readonly logicalId: string;
  readonly field: "dependsOn" | "implementation" | "missing" | "type";
  readonly bicep?: unknown;
  readonly terraform?: unknown;
}

export interface LogicalParityResult {
  readonly equal: boolean;
  readonly differences: readonly LogicalParityDifference[];
}

export interface GeneratedTreeValidationOptions {
  readonly runner?: ProcessRunnerLike;
  readonly cwd?: string;
  readonly timeoutMs?: number;
  readonly maxOutputBytes?: number;
}

export interface GeneratedTreeValidationResult {
  readonly valid: boolean;
  readonly issues: readonly string[];
  readonly commandPlans: readonly CommandPlan[];
  readonly commandResults: readonly ProcessResult[];
}

interface ParsedBinding {
  readonly kind: "avm" | "native";
  readonly source: string;
  readonly version: string;
}

interface ResourceContext {
  readonly binding: IacBindingV1["resourceBindings"][string];
  readonly declaration: string;
  readonly parsed: ParsedBinding;
  readonly resource: ImplementationIntentV1["resources"][number];
}

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const EXACT_VERSION = /^(?:=\s*)?[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/;
const NATIVE_IMPLEMENTATION = /^native:([A-Za-z0-9.]+\/[A-Za-z0-9.]+)@([0-9]{4}-[0-9]{2}-[0-9]{2}(?:-preview)?)$/;
const AVM_IMPLEMENTATION = /^avm:([^@\s]+)@([^@\s]+)$/;

function assertIdentifier(value: string, label: string): void {
  if (!IDENTIFIER.test(value)) throw new TypeError(`${label} '${value}' is not a valid IaC identifier`);
}

function normalizeRelativePath(value: string): string {
  const normalized = value.replaceAll("\\", "/");
  if (normalized.length === 0 || normalized.startsWith("/") || /^[A-Za-z]:\//.test(normalized)) {
    throw new TypeError(`Virtual tree path '${value}' must be relative`);
  }
  const segments = normalized.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new TypeError(`Virtual tree path '${value}' contains an invalid segment`);
  }
  return segments.join("/");
}

function parseBinding(implementation: string, declaredVersion: string): ParsedBinding {
  const native = NATIVE_IMPLEMENTATION.exec(implementation);
  if (native !== null) {
    if (declaredVersion !== "legacy" && declaredVersion !== native[2]) {
      throw new TypeError(`Binding version '${declaredVersion}' does not match implementation pin '${native[2]}'`);
    }
    return { kind: "native", source: native[1]!, version: native[2]! };
  }
  const avm = AVM_IMPLEMENTATION.exec(implementation);
  if (avm === null) throw new TypeError(`Unsupported binding implementation '${implementation}'`);
  const version = avm[2]!;
  if (!EXACT_VERSION.test(version))
    throw new TypeError(`AVM implementation '${implementation}' must use an exact version`);
  if (declaredVersion !== "legacy" && declaredVersion !== version) {
    throw new TypeError(`Binding version '${declaredVersion}' does not match implementation pin '${version}'`);
  }
  return { kind: "avm", source: avm[1]!, version };
}

function resourceContexts(intent: ImplementationIntentV1, binding: IacBindingV1): ResourceContext[] {
  if (intent.projectId !== binding.projectId || intent.runId !== binding.runId) {
    throw new TypeError("Intent and binding identities do not match");
  }
  const intentIds = new Set(intent.resources.map(({ id }) => id));
  const bindingIds = Object.keys(binding.resourceBindings);
  if (bindingIds.length !== intentIds.size || bindingIds.some((id) => !intentIds.has(id))) {
    throw new TypeError("Binding must cover every logical resource exactly once");
  }
  return [...intent.resources]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((resource) => {
      assertIdentifier(resource.id, "Logical resource id");
      for (const dependency of resource.dependsOn) {
        assertIdentifier(dependency, "Dependency id");
        if (!intentIds.has(dependency))
          throw new TypeError(`Resource '${resource.id}' has unknown dependency '${dependency}'`);
      }
      const resourceBinding = binding.resourceBindings[resource.id]!;
      return {
        resource,
        binding: resourceBinding,
        declaration: resource.id,
        parsed: parseBinding(resourceBinding.implementation, resourceBinding.version),
      };
    });
}

function requiredGenericParameters(context: ResourceContext): {
  name: string;
  location: string;
  parentId: string;
  properties: unknown;
  bodyFields: Readonly<Record<string, unknown>>;
} {
  const { name, location, parentId, properties } = context.binding.parameters;
  if (typeof name !== "string" || name.length === 0)
    throw new TypeError(`Native resource '${context.resource.id}' requires parameter 'name'`);
  if (typeof location !== "string" || location.length === 0)
    throw new TypeError(`Native resource '${context.resource.id}' requires parameter 'location'`);
  if (typeof parentId !== "string" || parentId.length === 0)
    throw new TypeError(`Native resource '${context.resource.id}' requires parameter 'parentId'`);
  if (properties === null || typeof properties !== "object" || Array.isArray(properties)) {
    throw new TypeError(`Native resource '${context.resource.id}' requires object parameter 'properties'`);
  }
  const {
    name: _name,
    location: _location,
    parentId: _parentId,
    properties: _properties,
    ...bodyFields
  } = context.binding.parameters;
  return { name, location, parentId, properties, bodyFields };
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(",")}}`;
  }
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new TypeError("IaC values must be JSON-compatible");
  return encoded;
}

function bicepString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function bicepObjectKey(value: string): string {
  return IDENTIFIER.test(value) ? value : bicepString(value);
}

function renderBicepValue(value: unknown, indent = 0): string {
  if (value === null) return "null";
  if (typeof value === "string") return bicepString(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Bicep numbers must be finite");
    return String(value);
  }
  if (typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const padding = " ".repeat(indent + 2);
    return `[\n${value.map((entry) => `${padding}${renderBicepValue(entry, indent + 2)}`).join("\n")}\n${" ".repeat(indent)}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
    if (entries.length === 0) return "{}";
    const padding = " ".repeat(indent + 2);
    return `{\n${entries.map(([key, entry]) => `${padding}${bicepObjectKey(key)}: ${renderBicepValue(entry, indent + 2)}`).join("\n")}\n${" ".repeat(indent)}}`;
  }
  throw new TypeError("Bicep values must be JSON-compatible");
}

function renderHclValue(value: unknown, indent = 0): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("HCL numbers must be finite");
    return String(value);
  }
  if (typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `[${value.map((entry) => renderHclValue(entry, indent)).join(", ")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
    if (entries.length === 0) return "{}";
    const padding = " ".repeat(indent + 2);
    return `{\n${entries.map(([key, entry]) => `${padding}${JSON.stringify(key)} = ${renderHclValue(entry, indent + 2)}`).join("\n")}\n${" ".repeat(indent)}}`;
  }
  throw new TypeError("HCL values must be JSON-compatible");
}

function secureStorageProperties(type: string, properties: unknown): unknown {
  if (type.toLowerCase() !== "microsoft.storage/storageaccounts") return properties;
  return {
    ...(properties as Record<string, unknown>),
    allowBlobPublicAccess: false,
    allowSharedKeyAccess: false,
    minimumTlsVersion: "TLS1_2",
    supportsHttpsTrafficOnly: true,
  };
}

function secureBicepParameters(context: ResourceContext): Readonly<Record<string, unknown>> {
  if (context.resource.type.toLowerCase() !== "microsoft.storage/storageaccounts") return context.binding.parameters;
  return {
    ...context.binding.parameters,
    allowBlobPublicAccess: false,
    allowSharedKeyAccess: false,
    minimumTlsVersion: "TLS1_2",
    supportsHttpsTrafficOnly: true,
  };
}

function secureTerraformParameters(context: ResourceContext): Readonly<Record<string, unknown>> {
  if (context.resource.type.toLowerCase() !== "microsoft.storage/storageaccounts") return context.binding.parameters;
  return {
    ...context.binding.parameters,
    allow_nested_items_to_be_public: false,
    https_traffic_only_enabled: true,
    min_tls_version: "TLS1_2",
    shared_access_key_enabled: false,
  };
}

function virtualTree(
  files: readonly VirtualTreeFile[],
  logicalManifest: LogicalResourceManifestV1,
): GeneratedVirtualTree {
  const normalized = files
    .map((file) => ({ path: normalizeRelativePath(file.path), content: file.content }))
    .sort((left, right) => left.path.localeCompare(right.path));
  if (new Set(normalized.map(({ path }) => path)).size !== normalized.length)
    throw new TypeError("Virtual tree paths must be unique");
  return { files: normalized, logicalManifest, treeHash: sha256(normalized) };
}

function manifest(
  intent: ImplementationIntentV1,
  binding: IacBindingV1,
  sourcePath: string,
  existing: ReadonlySet<string>,
): LogicalResourceManifestV1 {
  return {
    schemaVersion: intent.schemaVersion,
    projectId: intent.projectId,
    runId: intent.runId,
    track: binding.track,
    resources: [...intent.resources]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((resource) => ({
        logicalId: resource.id,
        type: resource.type,
        implementationAddress: binding.resourceBindings[resource.id]!.implementation,
        implementationKind: existing.has(resource.id)
          ? binding.track === "terraform"
            ? ("data" as const)
            : ("existing" as const)
          : binding.resourceBindings[resource.id]!.implementation.startsWith("avm:")
            ? ("module" as const)
            : ("resource" as const),
        ownership: existing.has(resource.id) ? ("existing" as const) : ("managed" as const),
        dependsOn: [...resource.dependsOn].sort(),
        generatedDependencies: [...resource.dependsOn].sort(),
        sourcePath,
      })),
  };
}

function assertTrack(binding: IacBindingV1, expected: IacBindingV1["track"]): void {
  if (binding.track !== expected) throw new TypeError(`Binding track '${binding.track}' is not '${expected}'`);
}

export function generateBicepTree(
  intent: ImplementationIntentV1,
  binding: IacBindingV1,
  options: BicepGenerationOptions = {},
): GeneratedVirtualTree {
  assertTrack(binding, "bicep");
  const contexts = resourceContexts(intent, binding);
  const existing = new Set(options.existingResources ?? []);
  const logicalIds = new Set(contexts.map(({ resource }) => resource.id));
  for (const logicalId of existing) {
    assertIdentifier(logicalId, "Existing resource id");
    if (!logicalIds.has(logicalId))
      throw new TypeError(`Existing resource '${logicalId}' is not present in the intent`);
  }
  const parameterNames = new Set<string>();
  const blocks = contexts.map((context) => {
    if (context.parsed.kind === "native") {
      const parameters = requiredGenericParameters(context);
      const existingKeyword = existing.has(context.resource.id) ? " existing" : "";
      if (existingKeyword !== "") {
        return `resource ${context.declaration} '${context.parsed.source}@${context.parsed.version}' existing = {\n  name: ${bicepString(parameters.name)}\n}`;
      }
      const dependencies =
        context.resource.dependsOn.length === 0
          ? ""
          : `\n  dependsOn: [\n${[...context.resource.dependsOn]
              .sort()
              .map((id) => `    ${id}`)
              .join("\n")}\n  ]`;
      const bodyFields = Object.entries(parameters.bodyFields)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([name, value]) => `  ${bicepObjectKey(name)}: ${renderBicepValue(value, 2)}`)
        .join("\n");
      return `resource ${context.declaration} '${context.parsed.source}@${context.parsed.version}' = {\n  name: ${bicepString(parameters.name)}\n  location: ${bicepString(parameters.location)}${bodyFields.length === 0 ? "" : `\n${bodyFields}`}\n  properties: ${renderBicepValue(secureStorageProperties(context.resource.type, parameters.properties), 2)}${dependencies}\n}`;
    }
    if (existing.has(context.resource.id)) {
      throw new TypeError(`Existing AVM resource '${context.resource.id}' is unsupported; use a native binding`);
    }
    const source = context.parsed.source;
    const moduleReference = source.startsWith("br/") ? source : `br/public:${source}`;
    const renderedParameters = Object.entries(secureBicepParameters(context))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, value]) => {
        assertIdentifier(name, "Bicep parameter name");
        parameterNames.add(name);
        return `    ${name}: ${renderBicepValue(value, 4)}`;
      });
    const dependencies =
      context.resource.dependsOn.length === 0
        ? ""
        : `\n  dependsOn: [\n${[...context.resource.dependsOn]
            .sort()
            .map((id) => `    ${id}`)
            .join("\n")}\n  ]`;
    return `module ${context.declaration} '${moduleReference}:${context.parsed.version}' = {\n  name: ${bicepString(`${context.resource.id}-deployment`)}\n  params: {\n${renderedParameters.join("\n")}\n  }${dependencies}\n}`;
  });
  const descriptions = [...parameterNames]
    .sort()
    .map((name) => `@description(${bicepString(`Deployment value for ${name}`)})\nparam ${name} string`)
    .join("\n\n");
  const content =
    ["targetScope = 'resourceGroup'", descriptions, blocks.join("\n\n")]
      .filter((part) => part.length > 0)
      .join("\n\n") + "\n";
  return virtualTree([{ path: "main.bicep", content }], manifest(intent, binding, "main.bicep", existing));
}

function exactProviderConstraint(value: string | undefined, fallback: string, label: string): string {
  const constraint = value ?? fallback;
  if (!EXACT_VERSION.test(constraint)) throw new TypeError(`${label} must be an exact semantic version constraint`);
  return constraint.startsWith("=") ? constraint : `= ${constraint}`;
}

function terraformDependency(
  context: ResourceContext,
  contexts: readonly ResourceContext[],
  existing: ReadonlySet<string>,
): string {
  const byId = new Map(contexts.map((entry) => [entry.resource.id, entry]));
  const dependencies = [...context.resource.dependsOn].sort().map((id) => {
    const dependency = byId.get(id)!;
    return dependency.parsed.kind === "native"
      ? existing.has(id)
        ? `data.azapi_resource.${dependency.declaration}`
        : `azapi_resource.${dependency.declaration}`
      : `module.${dependency.declaration}`;
  });
  return dependencies.length === 0 ? "" : `\n  depends_on = [${dependencies.join(", ")}]`;
}

export function generateTerraformTree(
  intent: ImplementationIntentV1,
  binding: IacBindingV1,
  options: TerraformGenerationOptions = {},
): GeneratedVirtualTree {
  assertTrack(binding, "terraform");
  const contexts = resourceContexts(intent, binding);
  const existing = new Set(options.existingResources ?? []);
  const logicalIds = new Set(contexts.map(({ resource }) => resource.id));
  for (const logicalId of existing) {
    assertIdentifier(logicalId, "Existing resource id");
    if (!logicalIds.has(logicalId))
      throw new TypeError(`Existing resource '${logicalId}' is not present in the intent`);
  }
  const azurerm = exactProviderConstraint(options.azurermProviderConstraint, "= 4.0.0", "azurerm provider constraint");
  const azapi = exactProviderConstraint(options.azapiProviderConstraint, "= 2.0.0", "azapi provider constraint");
  const versions = `terraform {\n  required_providers {\n    azapi = {\n      source  = "Azure/azapi"\n      version = "${azapi}"\n    }\n    azurerm = {\n      source  = "hashicorp/azurerm"\n      version = "${azurerm}"\n    }\n  }\n}\n`;
  const variables = [
    ...new Set(
      contexts.flatMap((context) =>
        Object.keys(context.parsed.kind === "avm" ? secureTerraformParameters(context) : context.binding.parameters),
      ),
    ),
  ]
    .sort()
    .map((name) => {
      assertIdentifier(name, "Terraform variable name");
      return `variable "${name}" {\n  description = "Deployment value for ${name}"\n  type        = any\n  default     = null\n}`;
    })
    .join("\n\n");
  const main =
    contexts
      .map((context) => {
        if (context.parsed.kind === "native") {
          const parameters = requiredGenericParameters(context);
          if (existing.has(context.resource.id)) {
            return `data "azapi_resource" "${context.declaration}" {\n  type      = "${context.parsed.source}@${context.parsed.version}"\n  name      = ${JSON.stringify(parameters.name)}\n  parent_id = ${JSON.stringify(parameters.parentId)}\n}`;
          }
          const body = {
            ...parameters.bodyFields,
            properties: secureStorageProperties(context.resource.type, parameters.properties),
          };
          return `resource "azapi_resource" "${context.declaration}" {\n  type      = "${context.parsed.source}@${context.parsed.version}"\n  name      = ${JSON.stringify(parameters.name)}\n  location  = ${JSON.stringify(parameters.location)}\n  parent_id = ${JSON.stringify(parameters.parentId)}\n  body      = ${renderHclValue(body, 2)}${terraformDependency(context, contexts, existing)}\n}`;
        }
        if (existing.has(context.resource.id)) {
          throw new TypeError(`Existing AVM resource '${context.resource.id}' is unsupported; use a native binding`);
        }
        const argumentsText = Object.entries(secureTerraformParameters(context))
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([name, value]) => `  ${name} = ${renderHclValue(value, 2)}`)
          .join("\n");
        return `module "${context.declaration}" {\n  source  = "${context.parsed.source}"\n  version = "${context.parsed.version}"\n${argumentsText}${terraformDependency(context, contexts, existing)}\n}`;
      })
      .join("\n\n") + "\n";
  const outputs = [...intent.outputs]
    .sort()
    .map((name) => {
      assertIdentifier(name, "Terraform output name");
      return `output "${name}" {\n  value = null\n}`;
    })
    .join("\n\n");
  const files: VirtualTreeFile[] = [
    { path: "main.tf", content: main },
    { path: "outputs.tf", content: outputs.length === 0 ? "" : `${outputs}\n` },
    { path: "provider.tf", content: 'provider "azurerm" {\n  features {}\n}\n\nprovider "azapi" {}\n' },
    { path: "variables.tf", content: variables.length === 0 ? "" : `${variables}\n` },
    { path: "versions.tf", content: versions },
  ];
  if (options.lockFileContent !== undefined)
    files.push({ path: ".terraform.lock.hcl", content: options.lockFileContent });
  return virtualTree(files, manifest(intent, binding, "main.tf", existing));
}

function logicalImplementation(value: string): string {
  const parsed = parseBinding(value, "legacy");
  return `${parsed.kind}:${parsed.source}@${parsed.version}`;
}

export function compareLogicalParity(
  bicep: GeneratedVirtualTree | LogicalResourceManifestV1,
  terraform: GeneratedVirtualTree | LogicalResourceManifestV1,
): LogicalParityResult {
  const left = "logicalManifest" in bicep ? bicep.logicalManifest : bicep;
  const right = "logicalManifest" in terraform ? terraform.logicalManifest : terraform;
  const leftById = new Map(left.resources.map((resource) => [resource.logicalId, resource]));
  const rightById = new Map(right.resources.map((resource) => [resource.logicalId, resource]));
  const differences: LogicalParityDifference[] = [];
  for (const logicalId of [...new Set([...leftById.keys(), ...rightById.keys()])].sort()) {
    const bicepResource = leftById.get(logicalId);
    const terraformResource = rightById.get(logicalId);
    if (bicepResource === undefined || terraformResource === undefined) {
      differences.push({
        logicalId,
        field: "missing",
        ...(bicepResource === undefined ? {} : { bicep: bicepResource }),
        ...(terraformResource === undefined ? {} : { terraform: terraformResource }),
      });
      continue;
    }
    if (bicepResource.type !== terraformResource.type)
      differences.push({ logicalId, field: "type", bicep: bicepResource.type, terraform: terraformResource.type });
    if (canonicalJson([...bicepResource.dependsOn].sort()) !== canonicalJson([...terraformResource.dependsOn].sort())) {
      differences.push({
        logicalId,
        field: "dependsOn",
        bicep: bicepResource.dependsOn,
        terraform: terraformResource.dependsOn,
      });
    }
    if (
      bicepResource.ownership !== terraformResource.ownership ||
      canonicalJson([...bicepResource.generatedDependencies].sort()) !==
        canonicalJson([...terraformResource.generatedDependencies].sort())
    ) {
      differences.push({
        logicalId,
        field: "implementation",
        bicep: { ownership: bicepResource.ownership, dependencies: bicepResource.generatedDependencies },
        terraform: { ownership: terraformResource.ownership, dependencies: terraformResource.generatedDependencies },
      });
    }
    const leftImplementation = logicalImplementation(bicepResource.implementationAddress);
    const rightImplementation = logicalImplementation(terraformResource.implementationAddress);
    if (leftImplementation !== rightImplementation) {
      const bothNative = leftImplementation.startsWith("native:") && rightImplementation.startsWith("native:");
      const bothAvm = leftImplementation.startsWith("avm:") && rightImplementation.startsWith("avm:");
      if (!bothNative && !bothAvm)
        differences.push({
          logicalId,
          field: "implementation",
          bicep: leftImplementation,
          terraform: rightImplementation,
        });
    }
  }
  return { equal: differences.length === 0, differences };
}

function validationPlans(tree: GeneratedVirtualTree, cwd: string): CommandPlan[] {
  const paths = new Set(tree.files.map(({ path }) => path));
  if (paths.has("main.bicep")) return [{ executable: "bicep", args: ["build", "main.bicep"], cwd }];
  if (paths.has("main.tf")) {
    return [
      { executable: "terraform", args: ["fmt", "-check"], cwd },
      { executable: "terraform", args: ["init", "-backend=false", "-input=false"], cwd },
      { executable: "terraform", args: ["validate"], cwd },
    ];
  }
  return [];
}

interface StorageSecurityInvariant {
  readonly diagnostic: string;
  readonly keys: readonly string[];
  readonly values: ReadonlySet<string>;
}

const BOOLEAN_TRUE = new Set(["true"]);
const BOOLEAN_FALSE = new Set(["false"]);
const TLS_1_2 = new Set(["'TLS1_2'", '"TLS1_2"']);
const BICEP_STORAGE_INVARIANTS: readonly StorageSecurityInvariant[] = [
  {
    diagnostic: "minimumTlsVersion[^\\n]*['\"]TLS1_2['\"]|minimumTlsVersion[\\s\\S]*['\"]TLS1_2['\"]",
    keys: ["minimumTlsVersion"],
    values: TLS_1_2,
  },
  {
    diagnostic: "supportsHttpsTrafficOnly[^\\n]*true",
    keys: ["supportsHttpsTrafficOnly"],
    values: BOOLEAN_TRUE,
  },
  {
    diagnostic: "allowBlobPublicAccess[^\\n]*false",
    keys: ["allowBlobPublicAccess"],
    values: BOOLEAN_FALSE,
  },
  {
    diagnostic: "allowSharedKeyAccess[^\\n]*false",
    keys: ["allowSharedKeyAccess"],
    values: BOOLEAN_FALSE,
  },
];
const TERRAFORM_STORAGE_INVARIANTS: readonly StorageSecurityInvariant[] = [
  {
    diagnostic:
      "(?:minimumTlsVersion|min_tls_version)[^\\n]*['\"]TLS1_2['\"]|(?:minimumTlsVersion|min_tls_version)[\\s\\S]*['\"]TLS1_2['\"]",
    keys: ["minimumTlsVersion", "min_tls_version"],
    values: TLS_1_2,
  },
  {
    diagnostic: "(?:supportsHttpsTrafficOnly|https_traffic_only_enabled)[^\\n]*true",
    keys: ["supportsHttpsTrafficOnly", "https_traffic_only_enabled"],
    values: BOOLEAN_TRUE,
  },
  {
    diagnostic: "(?:allowBlobPublicAccess|allow_nested_items_to_be_public)[^\\n]*false",
    keys: ["allowBlobPublicAccess", "allow_nested_items_to_be_public"],
    values: BOOLEAN_FALSE,
  },
  {
    diagnostic: "(?:allowSharedKeyAccess|shared_access_key_enabled)[^\\n]*false",
    keys: ["allowSharedKeyAccess", "shared_access_key_enabled"],
    values: BOOLEAN_FALSE,
  },
];

function assignmentToken(line: string): readonly [key: string, value: string] | undefined {
  const colon = line.indexOf(":");
  const equals = line.indexOf("=");
  const separator = colon < 0 ? equals : equals < 0 ? colon : Math.min(colon, equals);
  if (separator < 0) return undefined;
  const rawKey = line.slice(0, separator).trim();
  const remainder = line.slice(separator + 1).trimStart();
  if (rawKey.length === 0 || remainder.length === 0) return undefined;
  const keyQuote = rawKey[0];
  const key = (keyQuote === "'" || keyQuote === '"') && rawKey.at(-1) === keyQuote ? rawKey.slice(1, -1) : rawKey;
  const quote = remainder[0];
  if (quote === "'" || quote === '"') {
    const end = remainder.indexOf(quote, 1);
    return end < 0 ? undefined : [key, remainder.slice(0, end + 1)];
  }
  let end = 0;
  while (end < remainder.length && !" \t\r,}]".includes(remainder[end]!)) end += 1;
  return [key, remainder.slice(0, end)];
}

function missingStorageInvariants(
  source: string,
  invariants: readonly StorageSecurityInvariant[],
): readonly StorageSecurityInvariant[] {
  const invariantsByKey = new Map<string, StorageSecurityInvariant[]>();
  for (const invariant of invariants) {
    for (const key of invariant.keys) {
      const entries = invariantsByKey.get(key) ?? [];
      entries.push(invariant);
      invariantsByKey.set(key, entries);
    }
  }
  const found = new Set<StorageSecurityInvariant>();
  for (const line of source.split("\n")) {
    const assignment = assignmentToken(line);
    if (assignment === undefined) continue;
    const [key, value] = assignment;
    for (const invariant of invariantsByKey.get(key) ?? []) {
      if (invariant.values.has(value)) found.add(invariant);
    }
  }
  return invariants.filter((invariant) => !found.has(invariant));
}

export async function validateGeneratedTree(
  tree: GeneratedVirtualTree,
  options: GeneratedTreeValidationOptions = {},
): Promise<GeneratedTreeValidationResult> {
  const issues: string[] = [];
  const paths = tree.files.map(({ path }) => {
    try {
      return normalizeRelativePath(path);
    } catch (error) {
      issues.push((error as Error).message);
      return path;
    }
  });
  if (new Set(paths).size !== paths.length) issues.push("Generated tree contains duplicate paths");
  if (
    sha256(
      [...tree.files]
        .map(({ path, content }) => ({ path: normalizeRelativePath(path), content }))
        .sort((left, right) => left.path.localeCompare(right.path)),
    ) !== tree.treeHash
  ) {
    issues.push("Generated tree hash does not match its files");
  }
  const manifestIds = new Set(tree.logicalManifest.resources.map(({ logicalId }) => logicalId));
  if (manifestIds.size !== tree.logicalManifest.resources.length)
    issues.push("Logical manifest contains duplicate resources");
  for (const resource of tree.logicalManifest.resources) {
    const source = tree.files.find(({ path }) => path === resource.sourcePath);
    if (source === undefined) {
      issues.push(`Logical resource '${resource.logicalId}' source path is missing`);
      continue;
    }
    const declaration =
      tree.logicalManifest.track === "bicep"
        ? new RegExp(`(?:resource|module)\\s+${resource.logicalId}\\s`)
        : new RegExp(`(?:resource\\s+"[^"]+"|data\\s+"[^"]+"|module)\\s+"${resource.logicalId}"`);
    if (!declaration.test(source.content))
      issues.push(`Logical resource '${resource.logicalId}' declaration is missing`);
  }
  const storageResources = tree.logicalManifest.resources.filter(
    ({ type }) => type.toLowerCase() === "microsoft.storage/storageaccounts",
  );
  if (storageResources.length > 0) {
    const source = tree.files.map(({ content }) => content).join("\n");
    const required = tree.logicalManifest.track === "bicep" ? BICEP_STORAGE_INVARIANTS : TERRAFORM_STORAGE_INVARIANTS;
    for (const invariant of missingStorageInvariants(source, required))
      issues.push(`Storage security invariant '${invariant.diagnostic}' is missing`);
  }
  const plans = validationPlans(tree, options.cwd ?? ".");
  const commandResults: ProcessResult[] = [];
  if (options.runner !== undefined) {
    for (const plan of plans) {
      commandResults.push(
        await options.runner.run({
          ...plan,
          timeoutMs: options.timeoutMs ?? 120_000,
          maxOutputBytes: options.maxOutputBytes ?? 1_048_576,
        }),
      );
    }
  }
  return { valid: issues.length === 0, issues, commandPlans: plans, commandResults };
}

async function assertNoSymlinkParents(root: string, destination: string): Promise<void> {
  const rootResolved = resolve(root);
  const relativePath = relative(rootResolved, destination);
  let current = rootResolved;
  for (const segment of relativePath.split(sep).slice(0, -1)) {
    current = join(current, segment);
    try {
      if ((await lstat(current)).isSymbolicLink())
        throw new TypeError(`Refusing to write through symlink parent '${current}'`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}

export async function writeVirtualTree(
  root: string,
  tree: GeneratedVirtualTree,
  options: WriteVirtualTreeOptions = {},
): Promise<void> {
  if (isAbsolute(root) === false && root.trim().length === 0) throw new TypeError("Virtual tree root is required");
  const rootResolved = resolve(root);
  await mkdir(rootResolved, { recursive: true });
  if ((await lstat(rootResolved)).isSymbolicLink()) throw new TypeError("Virtual tree root must not be a symlink");
  const canonicalRoot = await realpath(rootResolved);
  const staged: Array<{ destination: string; temporary: string }> = [];
  try {
    for (const file of tree.files) {
      const normalized = normalizeRelativePath(file.path);
      const destination = resolve(canonicalRoot, normalized);
      if (destination !== canonicalRoot && !destination.startsWith(`${canonicalRoot}${sep}`))
        throw new TypeError(`Path '${file.path}' escapes the root`);
      await assertNoSymlinkParents(canonicalRoot, destination);
      await mkdir(dirname(destination), { recursive: true });
      await assertNoSymlinkParents(canonicalRoot, destination);
      const temporary = `${destination}.apex-${process.pid}-${sha256([normalized, file.content]).slice(0, 12)}.tmp`;
      const handle = await open(temporary, "wx", 0o600);
      try {
        await handle.writeFile(file.content, "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }
      staged.push({ destination, temporary });
    }
    if (options.overwrite !== true) {
      for (const { destination } of staged) {
        try {
          await lstat(destination);
          throw new TypeError(`Refusing to overwrite '${destination}'`);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
      }
    }
    for (const { destination, temporary } of staged) {
      await rename(temporary, destination);
    }
  } catch (error) {
    await Promise.all(staged.map(async ({ temporary }) => await rm(temporary, { force: true })));
    throw error;
  }
}
