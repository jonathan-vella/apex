import { sha256Json, type JsonValue } from "./canonical.js";
import { workflowValidatorOwnership } from "./workflow-validator-ownership.js";

const OPERATORS = new Set(["all", "equals", "in", "exists", "not"]);

export type WorkflowCondition =
  | { all: WorkflowCondition[] }
  | { equals: [{ path: string }, JsonValue] }
  | { in: [{ path: string }, JsonValue[]] }
  | { exists: { path: string } }
  | { not: WorkflowCondition };

export interface WorkflowNode {
  id: string;
  kind: string;
  ownerRole: string;
  gateNumber?: number;
  condition?: WorkflowCondition;
  sourceDependencies: string[];
  outputs: string[];
  validators: string[];
  invalidates: string[];
}

export interface WorkflowEdge {
  from: string;
  to: string;
  condition?: WorkflowCondition;
  fanout?: boolean;
}

export interface WorkflowManifest {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  returnRoutes?: WorkflowEdge[];
  terminalStates: string[];
  blockedStates: string[];
}

export interface WorkflowState {
  run: Record<string, JsonValue>;
  artifacts: Record<string, JsonValue>;
  completedNodes?: string[];
  gateStates?: Record<string, string>;
  state?: string;
}

export interface WorkflowRoute {
  currentNode: string | null;
  nextTask: string | null;
  ownerRole: string | null;
  blockers: string[];
  terminal: boolean;
}

export interface InvalidationEntry {
  nodeId: string;
  reason: string;
}

export function composeDependencyHash(dependencies: Record<string, JsonValue>): string {
  return sha256Json(dependencies);
}

export class WorkflowEngine {
  readonly manifest: WorkflowManifest;
  private readonly nodes: Map<string, WorkflowNode>;

  constructor(manifest: unknown) {
    this.manifest = validateWorkflowManifest(manifest);
    this.nodes = new Map(this.manifest.nodes.map((node) => [node.id, node]));
  }

  route(state: WorkflowState): WorkflowRoute {
    if (state.state !== undefined && this.manifest.terminalStates.includes(state.state)) {
      return { currentNode: state.state, nextTask: null, ownerRole: null, blockers: [], terminal: true };
    }
    if (state.state !== undefined && this.manifest.blockedStates.includes(state.state)) {
      const blocked = this.nodes.get("blocked");
      return {
        currentNode: state.state,
        nextTask: null,
        ownerRole: blocked?.ownerRole ?? null,
        blockers: [state.state],
        terminal: false,
      };
    }
    const completed = new Set(state.completedNodes ?? []);
    for (const node of this.manifest.nodes) {
      if (node.kind === "terminal" || completed.has(node.id) || !evaluateCondition(node.condition, state)) {
        continue;
      }
      const blockers = node.sourceDependencies.filter(
        (dependency) => !this.dependencySatisfied(dependency, state, completed),
      );
      if (blockers.length === 0) {
        return { currentNode: node.id, nextTask: node.id, ownerRole: node.ownerRole, blockers: [], terminal: false };
      }
      const hasActivePredecessor = this.manifest.edges.some((edge) => edge.to === node.id && completed.has(edge.from));
      if (hasActivePredecessor || node === this.manifest.nodes[0]) {
        return {
          currentNode: node.id,
          nextTask: null,
          ownerRole: node.ownerRole,
          blockers: blockers.sort(),
          terminal: false,
        };
      }
    }
    return { currentNode: null, nextTask: null, ownerRole: null, blockers: ["no-eligible-node"], terminal: false };
  }

  activeValidatorIds(state: WorkflowState): string[] {
    return this.manifest.nodes
      .filter((node) => evaluateCondition(node.condition, state))
      .flatMap(({ validators }) => validators);
  }

  invalidationPlan(changedNodeId: string, reason: string): InvalidationEntry[] {
    const start = this.nodes.get(changedNodeId);
    if (start === undefined) {
      throw new Error(`Unknown workflow node ${changedNodeId}`);
    }
    const pending = [...start.invalidates];
    const seen = new Set<string>();
    const plan: InvalidationEntry[] = [];
    while (pending.length > 0) {
      const nodeId = pending.shift();
      if (nodeId === undefined || seen.has(nodeId)) continue;
      seen.add(nodeId);
      const node = this.nodes.get(nodeId);
      if (node === undefined) throw new Error(`Unknown invalidation target ${nodeId}`);
      plan.push({ nodeId, reason: `${changedNodeId}: ${reason}` });
      pending.push(...node.invalidates);
    }
    return plan;
  }

  private dependencySatisfied(dependency: string, state: WorkflowState, completed: Set<string>): boolean {
    const root = dependency.split(".")[0] ?? dependency;
    if (completed.has(root)) return true;
    if (root.startsWith("gate-")) {
      const gateState = state.gateStates?.[root];
      return gateState === "approved" || gateState === "inherited";
    }
    if (dependency.startsWith("run-config.")) {
      return getPath(state.run, dependency.slice("run-config.".length)) !== undefined;
    }
    return (
      getPath({ run: state.run, artifacts: state.artifacts }, `artifacts.${dependency}`) !== undefined ||
      getPath({ run: state.run, artifacts: state.artifacts }, dependency) !== undefined
    );
  }
}

export function validateWorkflowManifest(value: unknown): WorkflowManifest {
  if (!isRecord(value) || !Array.isArray(value.nodes) || !Array.isArray(value.edges)) {
    throw new Error("Workflow manifest requires nodes and edges");
  }
  const nodes = value.nodes.map(parseNode);
  const ids = new Set<string>();
  const gates = new Set<number>();
  for (const node of nodes) {
    if (ids.has(node.id)) throw new Error(`Duplicate workflow node ${node.id}`);
    ids.add(node.id);
    if (node.gateNumber !== undefined) {
      if (node.gateNumber < 1 || node.gateNumber > 4 || gates.has(node.gateNumber))
        throw new Error(`Invalid or duplicate gate ${node.gateNumber}`);
      gates.add(node.gateNumber);
    }
  }
  for (const node of nodes) {
    for (const target of node.invalidates) {
      if (!ids.has(target)) throw new Error(`Workflow node ${node.id} invalidates unknown node ${target}`);
    }
  }
  if ([1, 2, 3, 4].some((gate) => !gates.has(gate))) throw new Error("Workflow requires unique gates 1-4");
  const edges = value.edges.map(parseEdge);
  const returnRoutes = Array.isArray(value.returnRoutes) ? value.returnRoutes.map(parseEdge) : [];
  for (const edge of [...edges, ...returnRoutes]) {
    if (!ids.has(edge.from) || !ids.has(edge.to))
      throw new Error(`Workflow edge references unknown node ${edge.from}->${edge.to}`);
  }
  assertAcyclic(ids, edges);
  const tracks = new Set(nodes.flatMap((node) => conditionTrack(node.condition)));
  if (!tracks.has("bicep") || !tracks.has("terraform"))
    throw new Error("Workflow requires bicep and terraform track conditions");
  const terminalStates = stringArray(value.terminalStates, "terminalStates");
  const blockedStates = stringArray(value.blockedStates, "blockedStates");
  if (terminalStates.length === 0 || blockedStates.length === 0)
    throw new Error("Workflow requires terminal and blocked states");
  return { nodes, edges, returnRoutes, terminalStates, blockedStates };
}

function parseNode(value: unknown): WorkflowNode {
  if (!isRecord(value)) throw new Error("Workflow node must be an object");
  const condition = value.condition === undefined ? undefined : parseCondition(value.condition);
  const validators = optionalStringArray(value.validators, "validators");
  if (new Set(validators).size !== validators.length) {
    throw new Error(`Duplicate workflow validator on node ${requiredString(value.id, "node id")}`);
  }
  for (const validator of validators) {
    if (workflowValidatorOwnership(validator) === undefined) {
      throw new Error(`Unknown workflow validator ${validator}`);
    }
  }
  return {
    id: requiredString(value.id, "node id"),
    kind: requiredString(value.kind, "node kind"),
    ownerRole: requiredString(value.ownerRole, "ownerRole"),
    ...(value.gateNumber === undefined ? {} : { gateNumber: requiredInteger(value.gateNumber, "gateNumber") }),
    ...(condition === undefined ? {} : { condition }),
    sourceDependencies: optionalStringArray(value.sourceDependencies, "sourceDependencies"),
    outputs: optionalStringArray(value.outputs, "outputs"),
    validators,
    invalidates: optionalStringArray(value.invalidates, "invalidates"),
  };
}

function parseEdge(value: unknown): WorkflowEdge {
  if (!isRecord(value)) throw new Error("Workflow edge must be an object");
  const condition = value.condition === undefined ? undefined : parseCondition(value.condition);
  return {
    from: requiredString(value.from, "edge from"),
    to: requiredString(value.to, "edge to"),
    ...(condition === undefined ? {} : { condition }),
    ...(value.fanout === true ? { fanout: true } : {}),
  };
}

function parseCondition(value: unknown): WorkflowCondition {
  if (!isRecord(value)) throw new Error("Workflow condition must be an object");
  const keys = Object.keys(value);
  if (keys.length !== 1 || !OPERATORS.has(keys[0] ?? ""))
    throw new Error(`Unsupported workflow condition operator ${keys.join(",")}`);
  const operator = keys[0];
  if (operator === "all") return { all: array(value.all, "all").map(parseCondition) };
  if (operator === "not") return { not: parseCondition(value.not) };
  if (operator === "exists") return { exists: parsePath(value.exists) };
  const operands = array(value[operator ?? ""], operator ?? "condition");
  if (operands.length !== 2) throw new Error(`${operator} requires two operands`);
  const path = parsePath(operands[0]);
  if (operator === "in") return { in: [path, array(operands[1], "in values") as JsonValue[]] };
  return { equals: [path, operands[1] as JsonValue] };
}

function evaluateCondition(condition: WorkflowCondition | undefined, state: WorkflowState): boolean {
  if (condition === undefined) return true;
  if ("all" in condition) return condition.all.every((item) => evaluateCondition(item, state));
  if ("not" in condition) return !evaluateCondition(condition.not, state);
  if ("exists" in condition) return getPath(state, condition.exists.path) !== undefined;
  if ("equals" in condition) return getPath(state, condition.equals[0].path) === condition.equals[1];
  return condition.in[1].includes(getPath(state, condition.in[0].path) as JsonValue);
}

function getPath(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => (isRecord(current) ? current[key] : undefined), value);
}

function assertAcyclic(ids: Set<string>, edges: WorkflowEdge[]): void {
  const incoming = new Map([...ids].map((id) => [id, 0]));
  const outgoing = new Map([...ids].map((id) => [id, [] as string[]]));
  for (const edge of edges) {
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
    outgoing.get(edge.from)?.push(edge.to);
  }
  const pending = [...ids].filter((id) => incoming.get(id) === 0);
  let visited = 0;
  while (pending.length > 0) {
    const id = pending.shift();
    if (id === undefined) break;
    visited += 1;
    for (const target of outgoing.get(id) ?? []) {
      const count = (incoming.get(target) ?? 0) - 1;
      incoming.set(target, count);
      if (count === 0) pending.push(target);
    }
  }
  if (visited !== ids.size) throw new Error("Workflow contains a cycle outside declared return routes");
}

function conditionTrack(condition: WorkflowCondition | undefined): string[] {
  if (condition === undefined) return [];
  if ("equals" in condition && condition.equals[0].path === "run.iacTool" && typeof condition.equals[1] === "string")
    return [condition.equals[1]];
  if ("all" in condition) return condition.all.flatMap(conditionTrack);
  if ("not" in condition) return conditionTrack(condition.not);
  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function requiredString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${name} must be a string`);
  return value;
}
function requiredInteger(value: unknown, name: string): number {
  if (!Number.isInteger(value)) throw new Error(`${name} must be an integer`);
  return value as number;
}
function array(value: unknown, name: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${name} must be an array`);
  return value;
}
function stringArray(value: unknown, name: string): string[] {
  return array(value, name).map((item) => requiredString(item, name));
}
function optionalStringArray(value: unknown, name: string): string[] {
  return value === undefined ? [] : stringArray(value, name);
}
function parsePath(value: unknown): { path: string } {
  if (!isRecord(value)) throw new Error("Condition path must be an object");
  return { path: requiredString(value.path, "condition path") };
}
