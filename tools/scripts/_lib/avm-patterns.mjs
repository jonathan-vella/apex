/** Shared AVM module path fragments and regex factories. */

export const AVM_BICEP_PATH_SOURCE = String.raw`avm\/(?:res|ptn)\/[a-z0-9-]+(?:\/[a-z0-9-]+)+`;
export const AVM_TERRAFORM_PATH_SOURCE = String.raw`Azure\/avm-(?:res|ptn)-[a-z0-9-]+\/azurerm`;
export const SEMVER_SOURCE = String.raw`\d+\.\d+\.\d+(?:-[a-z0-9.]+)?`;

export function createAvmBicepReferenceRegex(flags = "gi") {
  return new RegExp(String.raw`br\/public:${AVM_BICEP_PATH_SOURCE}`, flags);
}

export function createPinnedAvmBicepRegex(flags = "gi") {
  return new RegExp(String.raw`(['"])?(br\/public:${AVM_BICEP_PATH_SOURCE}):(${SEMVER_SOURCE})\1?`, flags);
}

export function createAvmTerraformReferenceRegex(flags = "gi") {
  return new RegExp(AVM_TERRAFORM_PATH_SOURCE, flags);
}

export function createAvmTerraformSourceRegex(flags = "gi") {
  return new RegExp(String.raw`source\s*=\s*"(${AVM_TERRAFORM_PATH_SOURCE})"`, flags);
}
