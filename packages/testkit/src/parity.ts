import assert from "node:assert/strict";
import type { ResourceInventoryV1 } from "@apex/contracts";

interface LogicalResource {
  logicalId: string;
  type: string;
  location: string;
  properties: Record<string, unknown>;
}

function logicalResources(inventory: ResourceInventoryV1): LogicalResource[] {
  return inventory.resources
    .map(({ logicalId, type, location, properties }) => ({ logicalId, type, location, properties }))
    .sort((left, right) => left.logicalId.localeCompare(right.logicalId));
}

export function assertLogicalInventoryParity(bicep: ResourceInventoryV1, terraform: ResourceInventoryV1): void {
  assert.deepStrictEqual(logicalResources(bicep), logicalResources(terraform));
}
