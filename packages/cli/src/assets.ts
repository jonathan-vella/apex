import { sha256Bytes } from "@apex/kernel";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface BundledAssetManifest {
  version: 1;
  sources: { customizations: string; config: string };
  files: Array<{ path: string; sha256: string; bytes: number }>;
}

export interface BundledAssets {
  root: string;
  customizations: string;
  config: string;
  capabilityPacks: string;
  capabilityPackRegistry: string;
  manifest: BundledAssetManifest;
}

export async function resolveBundledAssets(): Promise<BundledAssets> {
  const root = fileURLToPath(new URL("../assets/", import.meta.url));
  const manifest = JSON.parse(await readFile(join(root, "manifest.json"), "utf8")) as BundledAssetManifest;
  if (manifest.version !== 1 || !Array.isArray(manifest.files)) throw new Error("Unsupported bundled asset manifest");
  for (const file of manifest.files) {
    if (file.path.startsWith("/") || file.path.split("/").includes(".."))
      throw new Error(`Unsafe bundled asset path: ${file.path}`);
    const bytes = await readFile(join(root, file.path));
    if (bytes.byteLength !== file.bytes || sha256Bytes(bytes) !== file.sha256)
      throw new Error(`Bundled asset hash mismatch: ${file.path}`);
  }
  return {
    root: dirname(join(root, "manifest.json")),
    customizations: join(root, "customizations"),
    config: join(root, "config"),
    capabilityPacks: join(root, "capability-packs"),
    capabilityPackRegistry: join(root, "capability-packs", "registry.v1.json"),
    manifest,
  };
}
