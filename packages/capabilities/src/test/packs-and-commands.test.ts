import assert from "node:assert/strict";
import test from "node:test";
import { AzureCliReadAdapter, BicepCommandAdapter, TerraformCommandAdapter } from "../command-plans.js";
import { CapabilityPackLoader } from "../packs.js";

test("optional absent capability packs are reported without import", async () => {
  let resolutions = 0;
  const loader = new CapabilityPackLoader({
    async resolvePackageJson() {
      resolutions += 1;
      return undefined;
    },
  });
  const status = await loader.check({ packageName: "@apex/optional-azure", version: "1.2.3", optional: true });
  assert.equal(resolutions, 1);
  assert.equal(status.available, false);
  assert.equal(status.compatible, false);
  assert.match(status.actionableMessage, /install version 1\.2\.3/);
});

test("Bicep and Azure read adapters generate safe argv arrays", () => {
  const bicep = new BicepCommandAdapter();
  const target = {
    resourceGroup: "rg; echo unsafe",
    deploymentName: "deployment",
    templateFile: "main.bicep",
    parametersFile: "main.bicepparam",
  };
  assert.deepEqual(bicep.validate(target.templateFile), {
    executable: "bicep",
    args: ["build", "main.bicep"],
  });
  const preview = bicep.preview(target);
  assert.equal(preview.executable, "az");
  assert.equal(preview.args[4], "rg; echo unsafe");
  assert.equal(preview.args.includes("what-if"), true);
  assert.equal(bicep.apply(target).args.includes("create"), true);

  const azure = new AzureCliReadAdapter();
  assert.deepEqual(azure.resourceGraph("Resources | take 1").args.slice(0, 3), ["graph", "query", "--graph-query"]);
  assert.deepEqual(azure.armGet("/subscriptions/sub/resourceGroups/rg", "2025-01-01").args.slice(0, 4), [
    "rest",
    "--method",
    "get",
    "--url",
  ]);
});

test("Terraform requires and applies an exact saved plan", () => {
  const terraform = new TerraformCommandAdapter();
  assert.deepEqual(terraform.preview("/iac", ".apex/local/run.tfplan").args, [
    "plan",
    "-out=.apex/local/run.tfplan",
    "-input=false",
  ]);
  assert.deepEqual(terraform.applyExact("/iac", ".apex/local/run.tfplan").args, [
    "apply",
    "-input=false",
    ".apex/local/run.tfplan",
  ]);
  assert.throws(() => terraform.applyExact("/iac", ""), /saved Terraform plan path/);
  assert.equal(typeof terraform.applyExact, "function");
  assert.equal(Reflect.has(terraform, "apply"), false);
  assert.equal(Reflect.has(terraform, "applyImplicit"), false);
});

test("native stack and Terraform command plans use exact noninteractive argv", () => {
  const bicep = new BicepCommandAdapter();
  const target = {
    resourceGroup: "rg",
    deploymentName: "preview",
    stackName: "workload",
    templateFile: "main.bicep",
    parametersFile: "main.bicepparam",
    actionOnUnmanage: "deleteResources" as const,
    ownershipAuthorizesDeleteResources: true,
    denySettingsMode: "denyWriteAndDelete" as const,
  };
  assert.deepEqual(bicep.stackApply(target).args, [
    "stack",
    "group",
    "create",
    "--resource-group",
    "rg",
    "--name",
    "workload",
    "--template-file",
    "main.bicep",
    "--action-on-unmanage",
    "deleteResources",
    "--deny-settings-mode",
    "denyWriteAndDelete",
    "--yes",
    "--output",
    "json",
    "--parameters",
    "main.bicepparam",
  ]);
  assert.deepEqual(bicep.stackDestroy(target).args, [
    "stack",
    "group",
    "delete",
    "--resource-group",
    "rg",
    "--name",
    "workload",
    "--action-on-unmanage",
    "deleteResources",
    "--yes",
    "--output",
    "json",
  ]);
  assert.equal(bicep.stackApply(target).args.includes("--bypass-stack-out-of-sync-error"), false);

  const terraform = new TerraformCommandAdapter();
  assert.deepEqual(terraform.init("/iac", false).args, ["init", "-backend=false", "-input=false"]);
  assert.deepEqual(terraform.init("/iac", true).args, ["init", "-backend=true", "-input=false"]);
  assert.deepEqual(terraform.preview("/iac", "/plans/destroy.tfplan", true).args, [
    "plan",
    "-destroy",
    "-out=/plans/destroy.tfplan",
    "-input=false",
  ]);
  assert.deepEqual(terraform.showJson("/iac", "/plans/apply.tfplan").args, ["show", "-json", "/plans/apply.tfplan"]);
});
