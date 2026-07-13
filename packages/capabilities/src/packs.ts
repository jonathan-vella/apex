import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

export interface CapabilityPackRequirement {
  readonly packageName: string;
  readonly version: string;
  readonly optional?: boolean;
}

export interface CapabilityPackManifest {
  readonly name: string;
  readonly version: string;
  readonly capabilities: readonly string[];
  readonly requires?: readonly CapabilityPackRequirement[];
}

export interface CapabilityPackStatus {
  readonly packageName: string;
  readonly requiredVersion: string;
  readonly installedVersion?: string;
  readonly available: boolean;
  readonly compatible: boolean;
  readonly actionableMessage: string;
}

export interface CapabilityPackLoaderOptions {
  readonly resolvePackageJson?: (packageName: string) => Promise<string | undefined>;
}

const require = createRequire(import.meta.url);

async function defaultResolvePackageJson(packageName: string): Promise<string | undefined> {
  try {
    return require.resolve(`${packageName}/package.json`);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "MODULE_NOT_FOUND") {
      return undefined;
    }
    throw error;
  }
}

export class CapabilityPackLoader {
  readonly #resolvePackageJson: (packageName: string) => Promise<string | undefined>;

  constructor(options: CapabilityPackLoaderOptions = {}) {
    this.#resolvePackageJson = options.resolvePackageJson ?? defaultResolvePackageJson;
  }

  async check(requirement: CapabilityPackRequirement): Promise<CapabilityPackStatus> {
    const packageJsonPath = await this.#resolvePackageJson(requirement.packageName);
    if (packageJsonPath === undefined) {
      return {
        packageName: requirement.packageName,
        requiredVersion: requirement.version,
        available: false,
        compatible: false,
        actionableMessage:
          requirement.optional === true
            ? `Optional capability pack '${requirement.packageName}' is not installed; install version ${requirement.version} to enable it`
            : `Required capability pack '${requirement.packageName}' is missing; install version ${requirement.version}`,
      };
    }
    const parsed = JSON.parse(await readFile(packageJsonPath, "utf8")) as { version?: unknown };
    const installedVersion = typeof parsed.version === "string" ? parsed.version : "unknown";
    const compatible = installedVersion === requirement.version;
    return {
      packageName: requirement.packageName,
      requiredVersion: requirement.version,
      installedVersion,
      available: true,
      compatible,
      actionableMessage: compatible
        ? `Capability pack '${requirement.packageName}' ${installedVersion} is available`
        : `Capability pack '${requirement.packageName}' is ${installedVersion}; install required version ${requirement.version}`,
    };
  }

  async checkManifest(manifest: CapabilityPackManifest): Promise<readonly CapabilityPackStatus[]> {
    return await Promise.all((manifest.requires ?? []).map(async (requirement) => await this.check(requirement)));
  }
}
