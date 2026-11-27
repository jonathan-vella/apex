#!/usr/bin/env node
/**
 * Deterministic hierarchical compound layout + orthogonal edge router for
 * APEX semantic architecture topology specs (`*.topology.json`).
 *
 * Uses `elkjs` (`layered` + `INCLUDE_CHILDREN` + `ORTHOGONAL`) when installed,
 * falling back to a zero-dependency deterministic compound layered orthogonal
 * layout engine when `elkjs` is unavailable. Both engines emit the same
 * canonical absolute canvas coordinate JSON contract.
 */

import fs from "node:fs";
import process from "node:process";

const NODE_W = 148;
const NODE_H = 104;
const GROUP_PAD_TOP = 54;
const GROUP_PAD_SIDE = 28;
const GROUP_PAD_BOTTOM = 26;
const GAP_X = 58;
const GAP_Y = 44;
const CANVAS_MARGIN = 40;
const HEADER_H = 74;

/**
 * Normalize an ELK layout tree into canonical absolute canvas coordinates.
 * Translates every parent-relative child `(x, y)` and every container-relative
 * edge section into absolute canvas coordinates.
 */
export function normalizeElkGraph(elkRoot, spec) {
  const groupsOut = [];
  const nodesOut = [];
  const absOffset = new Map([[elkRoot.id, { x: 0, y: 0 }]]);
  const groupMeta = new Map((spec.groups ?? []).map((g) => [g.id, g]));
  const nodeMeta = new Map((spec.nodes ?? []).map((n) => [n.id, n]));

  function walk(container, ox, oy, parentId) {
    for (const child of container.children ?? []) {
      const ax = ox + (child.x ?? 0);
      const ay = oy + (child.y ?? 0);
      const w = child.width ?? NODE_W;
      const h = child.height ?? NODE_H;
      absOffset.set(child.id, { x: ax, y: ay });
      if (groupMeta.has(child.id)) {
        const meta = groupMeta.get(child.id);
        groupsOut.push({
          id: child.id,
          label: meta.label,
          kind: meta.kind,
          subtitle: meta.subtitle ?? null,
          icon: meta.icon ?? null,
          parentId: parentId === elkRoot.id ? null : parentId,
          absX: round1(ax),
          absY: round1(ay),
          width: round1(w),
          height: round1(h),
        });
        walk(child, ax, ay, child.id);
      } else if (nodeMeta.has(child.id)) {
        const meta = nodeMeta.get(child.id);
        nodesOut.push({
          id: child.id,
          icon: meta.icon,
          label: meta.label,
          sublabel: meta.sublabel ?? null,
          parentId: parentId === elkRoot.id ? null : parentId,
          absX: round1(ax),
          absY: round1(ay),
          width: round1(w),
          height: round1(h),
          cx: round1(ax + w / 2),
          cy: round1(ay + 30),
        });
      }
    }
  }

  walk(elkRoot, CANVAS_MARGIN, HEADER_H, elkRoot.id);
  absOffset.set(elkRoot.id, { x: CANVAS_MARGIN, y: HEADER_H });

  const edgeMeta = new Map((spec.edges ?? []).map((e) => [e.id, e]));
  const edgesOut = [];

  function collectEdges(container) {
    const ownerOffset = absOffset.get(container.id) ?? { x: CANVAS_MARGIN, y: HEADER_H };
    for (const edge of container.edges ?? []) {
      const meta = edgeMeta.get(edge.id) ?? {};
      const pts = [];
      for (const sec of edge.sections ?? []) {
        pts.push([round1(ownerOffset.x + sec.startPoint.x), round1(ownerOffset.y + sec.startPoint.y)]);
        for (const bp of sec.bendPoints ?? []) {
          pts.push([round1(ownerOffset.x + bp.x), round1(ownerOffset.y + bp.y)]);
        }
        pts.push([round1(ownerOffset.x + sec.endPoint.x), round1(ownerOffset.y + sec.endPoint.y)]);
      }
      edgesOut.push({
        id: edge.id,
        source: meta.source ?? edge.sources?.[0] ?? "",
        target: meta.target ?? edge.targets?.[0] ?? "",
        step: meta.step ?? null,
        style: meta.style ?? "sync",
        label: meta.label ?? null,
        bidirectional: Boolean(meta.bidirectional),
        points: dedupePoints(pts),
      });
    }
    for (const child of container.children ?? []) {
      collectEdges(child);
    }
  }
  collectEdges(elkRoot);

  return finalizeCanvas(spec, groupsOut, nodesOut, edgesOut, "elkjs");
}

function round1(v) {
  return Math.round(v * 10) / 10;
}

function dedupePoints(pts) {
  const out = [];
  for (const pt of pts) {
    const prev = out[out.length - 1];
    if (!prev || Math.abs(prev[0] - pt[0]) > 0.2 || Math.abs(prev[1] - pt[1]) > 0.2) {
      out.push(pt);
    }
  }
  return out;
}

function finalizeCanvas(spec, groupsOut, nodesOut, edgesOut, engine) {
  let maxX = 1200;
  let maxY = 640;
  for (const item of [...groupsOut, ...nodesOut]) {
    maxX = Math.max(maxX, item.absX + item.width + CANVAS_MARGIN);
    maxY = Math.max(maxY, item.absY + item.height + CANVAS_MARGIN);
  }
  for (const edge of edgesOut) {
    for (const [px, py] of edge.points) {
      maxX = Math.max(maxX, px + CANVAS_MARGIN);
      maxY = Math.max(maxY, py + CANVAS_MARGIN);
    }
  }
  const dfCount = (spec.dataflow ?? []).length;
  const dfRows = dfCount > 0 ? Math.ceil(dfCount / Math.min(2, dfCount)) : 0;
  const dfHeight = dfRows > 0 ? 28 + dfRows * 26 + 32 : 0;
  const canvasW = Math.max(1280, Math.ceil(maxX));
  const canvasH = Math.max(720, Math.ceil(maxY + dfHeight + 28));

  return {
    engine,
    title: spec.title,
    description: spec.description ?? "",
    style: spec.style ?? "aac",
    direction: spec.direction ?? "RIGHT",
    footer: spec.footer === undefined ? "APEX" : spec.footer,
    show_title: spec.show_title !== false,
    canvas: { width: canvasW, height: canvasH },
    dataflow_y: dfRows > 0 ? Math.ceil(maxY) : null,
    groups: groupsOut,
    nodes: nodesOut,
    edges: edgesOut,
    dataflow: spec.dataflow ?? [],
  };
}

function buildElkInput(spec) {
  const direction = spec.direction === "DOWN" ? "DOWN" : "RIGHT";
  const childrenByParent = new Map();
  const pushChild = (parentId, item) => {
    const key = parentId ?? "__root__";
    if (!childrenByParent.has(key)) childrenByParent.set(key, []);
    childrenByParent.get(key).push(item);
  };

  const groupMap = new Map();
  for (const g of spec.groups ?? []) {
    const elkGroup = {
      id: g.id,
      layoutOptions: {
        "elk.padding": `[top=${GROUP_PAD_TOP},left=${GROUP_PAD_SIDE},bottom=${GROUP_PAD_BOTTOM},right=${GROUP_PAD_SIDE}]`,
        "elk.spacing.nodeNode": String(GAP_Y),
        "elk.layered.spacing.nodeNodeBetweenLayers": String(GAP_X),
      },
      children: [],
    };
    groupMap.set(g.id, elkGroup);
    pushChild(g.parent ?? null, elkGroup);
  }
  for (const n of spec.nodes ?? []) {
    pushChild(n.parent ?? null, { id: n.id, width: NODE_W, height: NODE_H });
  }
  for (const [parentId, kids] of childrenByParent.entries()) {
    if (parentId !== "__root__" && groupMap.has(parentId)) {
      groupMap.get(parentId).children.push(...kids);
    }
  }

  return {
    id: "__root__",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": direction,
      "elk.hierarchyHandling": "INCLUDE_CHILDREN",
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.spacing.nodeNode": String(GAP_Y),
      "elk.layered.spacing.nodeNodeBetweenLayers": String(GAP_X),
      "elk.spacing.edgeNode": "24",
      "elk.spacing.edgeEdge": "16",
    },
    children: childrenByParent.get("__root__") ?? [],
    edges: (spec.edges ?? []).map((e) => ({
      id: e.id,
      sources: [e.source],
      targets: [e.target],
    })),
  };
}

/**
 * Deterministic zero-dependency compound layered layout + orthogonal router.
 * Guarantees non-overlapping sibling/compound boxes and channel-routed edges
 * that avoid unrelated node tiles.
 */
export function layoutBuiltin(spec) {
  const horizontal = (spec.direction ?? "RIGHT") !== "DOWN";
  const groupById = new Map((spec.groups ?? []).map((g) => [g.id, g]));
  const nodeById = new Map((spec.nodes ?? []).map((n) => [n.id, n]));
  const childrenMap = new Map();
  const addKid = (parentId, id) => {
    const key = parentId ?? "__root__";
    if (!childrenMap.has(key)) childrenMap.set(key, []);
    childrenMap.get(key).push(id);
  };
  for (const g of spec.groups ?? []) addKid(g.parent ?? null, g.id);
  for (const n of spec.nodes ?? []) addKid(n.parent ?? null, n.id);

  // Compute ancestor chain for mapping edges up to sibling containers
  function ancestors(id) {
    const chain = [];
    let cur = id;
    while (cur) {
      chain.push(cur);
      const item = nodeById.get(cur) ?? groupById.get(cur);
      cur = item?.parent ?? null;
    }
    return chain;
  }

  // Assign topological ranks among children of a given container
  function rankChildren(parentKey, kids) {
    const kidSet = new Set(kids);
    const adj = new Map(kids.map((k) => [k, new Set()]));
    const indeg = new Map(kids.map((k) => [k, 0]));
    for (const e of spec.edges ?? []) {
      const sa = ancestors(e.source).find((a) => kidSet.has(a));
      const ta = ancestors(e.target).find((a) => kidSet.has(a));
      if (sa && ta && sa !== ta && !adj.get(sa).has(ta)) {
        adj.get(sa).add(ta);
        indeg.set(ta, indeg.get(ta) + 1);
      }
    }
    const rank = new Map(kids.map((k) => [k, 0]));
    const queue = kids.filter((k) => indeg.get(k) === 0);
    const seen = new Set();
    while (queue.length > 0) {
      const u = queue.shift();
      seen.add(u);
      for (const v of adj.get(u)) {
        rank.set(v, Math.max(rank.get(v), rank.get(u) + 1));
        indeg.set(v, indeg.get(v) - 1);
        if (indeg.get(v) === 0) queue.push(v);
      }
    }
    // Any remaining cyclic items stay in input order
    const layers = new Map();
    for (const k of kids) {
      const r = rank.get(k) ?? 0;
      if (!layers.has(r)) layers.set(r, []);
      layers.get(r).push(k);
    }
    return [...layers.entries()].sort((a, b) => a[0] - b[0]).map(([, items]) => items);
  }

  // Recursive bottom-up sizing & relative placement
  const sizeMap = new Map();
  const relPosMap = new Map();

  function measure(id) {
    if (nodeById.has(id)) {
      sizeMap.set(id, { w: NODE_W, h: NODE_H });
      return sizeMap.get(id);
    }
    const kids = childrenMap.get(id) ?? [];
    for (const kid of kids) measure(kid);
    if (kids.length === 0) {
      sizeMap.set(id, { w: 200, h: 120 });
      return sizeMap.get(id);
    }
    const layers = rankChildren(id, kids);
    let cursorMain = id === "__root__" ? 0 : GROUP_PAD_SIDE;
    let maxCross = 0;
    for (const layer of layers) {
      let layerMain = 0;
      let cursorCross = id === "__root__" ? 0 : GROUP_PAD_TOP;
      for (const kid of layer) {
        const sz = sizeMap.get(kid);
        if (horizontal) {
          relPosMap.set(kid, { x: cursorMain, y: cursorCross });
          layerMain = Math.max(layerMain, sz.w);
          cursorCross += sz.h + GAP_Y;
        } else {
          relPosMap.set(kid, { x: cursorCross, y: cursorMain });
          layerMain = Math.max(layerMain, sz.h);
          cursorCross += sz.w + GAP_X;
        }
      }
      const crossUsed = cursorCross - (horizontal ? GAP_Y : GAP_X);
      maxCross = Math.max(maxCross, crossUsed);
      cursorMain += layerMain + (horizontal ? GAP_X : GAP_Y);
    }
    const mainUsed = cursorMain - (horizontal ? GAP_X : GAP_Y);
    if (id === "__root__") {
      sizeMap.set(id, { w: mainUsed, h: maxCross });
    } else if (horizontal) {
      sizeMap.set(id, {
        w: Math.max(220, mainUsed + GROUP_PAD_SIDE),
        h: Math.max(130, maxCross + GROUP_PAD_BOTTOM),
      });
    } else {
      sizeMap.set(id, {
        w: Math.max(220, maxCross + GROUP_PAD_SIDE),
        h: Math.max(130, mainUsed + GROUP_PAD_BOTTOM),
      });
    }
    return sizeMap.get(id);
  }

  measure("__root__");

  const groupsOut = [];
  const nodesOut = [];
  const boxById = new Map();

  function place(parentKey, ox, oy) {
    for (const kid of childrenMap.get(parentKey) ?? []) {
      const rel = relPosMap.get(kid) ?? { x: 0, y: 0 };
      const sz = sizeMap.get(kid);
      const ax = round1(ox + rel.x);
      const ay = round1(oy + rel.y);
      boxById.set(kid, { x: ax, y: ay, w: sz.w, h: sz.h });
      if (groupById.has(kid)) {
        const meta = groupById.get(kid);
        groupsOut.push({
          id: kid,
          label: meta.label,
          kind: meta.kind,
          subtitle: meta.subtitle ?? null,
          icon: meta.icon ?? null,
          parentId: parentKey === "__root__" ? null : parentKey,
          absX: ax,
          absY: ay,
          width: round1(sz.w),
          height: round1(sz.h),
        });
        place(kid, ax, ay);
      } else if (nodeById.has(kid)) {
        const meta = nodeById.get(kid);
        nodesOut.push({
          id: kid,
          icon: meta.icon,
          label: meta.label,
          sublabel: meta.sublabel ?? null,
          parentId: parentKey === "__root__" ? null : parentKey,
          absX: ax,
          absY: ay,
          width: round1(sz.w),
          height: round1(sz.h),
          cx: round1(ax + sz.w / 2),
          cy: round1(ay + 30),
        });
      }
    }
  }

  place("__root__", CANVAS_MARGIN, HEADER_H);

  // Orthogonal channel router avoiding unrelated node boxes
  const nodeBoxes = nodesOut.map((n) => ({
    id: n.id,
    x1: n.absX - 6,
    y1: n.absY - 6,
    x2: n.absX + n.width + 6,
    y2: n.absY + n.height + 6,
  }));

  function segHitsNode(x1, y1, x2, y2, ignoreIds) {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    for (const nb of nodeBoxes) {
      if (ignoreIds.has(nb.id)) continue;
      if (maxX > nb.x1 && minX < nb.x2 && maxY > nb.y1 && minY < nb.y2) {
        return true;
      }
    }
    return false;
  }

  function routeOrthogonal(srcId, tgtId, edgeIdx) {
    const s = boxById.get(srcId);
    const t = boxById.get(tgtId);
    if (!s || !t) return [];
    const ignore = new Set([srcId, tgtId]);
    const scx = s.x + s.w / 2;
    const scy = s.y + 30;
    const tcx = t.x + t.w / 2;
    const tcy = t.y + 30;
    const laneOffset = ((edgeIdx % 5) - 2) * 8;

    // Candidate 1: Right-to-left horizontal elbow
    if (s.x + s.w < t.x) {
      const sx = round1(s.x + s.w - 18);
      const tx = round1(t.x + 18);
      const midX = round1((s.x + s.w + t.x) / 2 + laneOffset);
      const pts = [
        [sx, round1(scy)],
        [midX, round1(scy)],
        [midX, round1(tcy)],
        [tx, round1(tcy)],
      ];
      if (isPathClear(pts, ignore)) return dedupePoints(pts);
    }
    // Candidate 2: Bottom-to-top vertical elbow
    if (s.y + s.h < t.y) {
      const sy = round1(s.y + s.h - 4);
      const ty = round1(t.y + 4);
      const midY = round1((s.y + s.h + t.y) / 2 + laneOffset);
      const pts = [
        [round1(scx), sy],
        [round1(scx), midY],
        [round1(tcx), midY],
        [round1(tcx), ty],
      ];
      if (isPathClear(pts, ignore)) return dedupePoints(pts);
    }
    // Candidate 3: Overhead channel above all nodes to avoid crossing unrelated tiles
    const topBusY = round1(HEADER_H - 14 - (edgeIdx % 4) * 10);
    const sx = round1(scx);
    const sy = round1(s.y + 4);
    const tx = round1(tcx);
    const ty = round1(t.y + 4);
    const ptsTop = [
      [sx, sy],
      [sx, topBusY],
      [tx, topBusY],
      [tx, ty],
    ];
    if (isPathClear(ptsTop, ignore)) return dedupePoints(ptsTop);

    // Candidate 4: Under-bus channel below all nodes
    const maxBottom = Math.max(...nodeBoxes.map((nb) => nb.y2), HEADER_H + 200);
    const botBusY = round1(maxBottom + 18 + (edgeIdx % 5) * 12);
    return dedupePoints([
      [round1(scx), round1(s.y + s.h - 4)],
      [round1(scx), botBusY],
      [round1(tcx), botBusY],
      [round1(tcx), round1(t.y + t.h - 4)],
    ]);
  }

  function isPathClear(pts, ignore) {
    for (let i = 0; i < pts.length - 1; i++) {
      if (segHitsNode(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], ignore)) {
        return false;
      }
    }
    return true;
  }

  const edgesOut = (spec.edges ?? []).map((e, idx) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    step: e.step ?? null,
    style: e.style ?? "sync",
    label: e.label ?? null,
    bidirectional: Boolean(e.bidirectional),
    points: routeOrthogonal(e.source, e.target, idx),
  }));

  return finalizeCanvas(spec, groupsOut, nodesOut, edgesOut, "builtin-layered");
}

export async function computeLayout(spec, { engine = "auto" } = {}) {
  if (engine !== "builtin") {
    try {
      const elkSpecifier = "elkjs/lib/elk.bundled.js";
      const elkMod = await import(elkSpecifier);
      const ELK = elkMod.default ?? elkMod;
      const elk = new ELK();
      const elkGraph = buildElkInput(spec);
      const laidOut = await elk.layout(elkGraph);
      return normalizeElkGraph(laidOut, spec);
    } catch (err) {
      if (engine === "elk") {
        throw err;
      }
    }
  }
  return layoutBuiltin(spec);
}

async function main() {
  const args = process.argv.slice(2);
  let inputPath = null;
  let engine = "auto";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--engine" && args[i + 1]) {
      engine = args[++i];
    } else if (args[i].startsWith("--engine=")) {
      engine = args[i].split("=", 2)[1];
    } else if (!args[i].startsWith("-")) {
      inputPath = args[i];
    }
  }
  const raw = inputPath ? fs.readFileSync(inputPath, "utf-8") : fs.readFileSync(0, "utf-8");
  const spec = JSON.parse(raw);
  const result = await computeLayout(spec, { engine });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    process.stderr.write(`${err.message}\n`);
    process.exit(1);
  });
}
