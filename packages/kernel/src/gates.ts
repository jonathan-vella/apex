import type { GateRecordV1, RunId } from "@apex/contracts";

export function openGate(gate: GateRecordV1, dependencyHash: string): GateRecordV1 {
  if (gate.state !== "closed" && gate.state !== "invalidated") {
    throw new Error(`Gate ${gate.gate} cannot open from ${gate.state}`);
  }
  return { gate: gate.gate, state: "open", dependencyHash };
}

export function decideGate(
  gate: GateRecordV1,
  decision: "approved" | "rejected",
  decidedAt: string,
  reason?: string,
): GateRecordV1 {
  if (gate.state !== "open") {
    throw new Error(`Gate ${gate.gate} is not open`);
  }
  return { ...gate, state: decision, decidedAt, ...(reason === undefined ? {} : { reason }) };
}

export function invalidateGate(gate: GateRecordV1, dependencyHash: string, reason: string): GateRecordV1 {
  return { gate: gate.gate, state: "invalidated", dependencyHash, reason };
}

export function inheritGate(
  gate: GateRecordV1,
  fromRunId: RunId,
  dependencyHash: string,
  decidedAt: string,
): GateRecordV1 {
  if (gate.gate === 4) {
    throw new Error("Gate 4 cannot be inherited");
  }
  if (gate.dependencyHash !== dependencyHash || (gate.state !== "approved" && gate.state !== "inherited")) {
    throw new Error(`Gate ${gate.gate} dependencies are not approved for inheritance`);
  }
  return { gate: gate.gate, state: "inherited", dependencyHash, inheritedFromRunId: fromRunId, decidedAt };
}
