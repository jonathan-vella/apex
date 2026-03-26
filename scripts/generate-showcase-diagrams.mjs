#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const SHOWCASE_DIR = path.resolve(
  ".github/skills/azure-diagrams/references/showcase",
);
const ICON_DIR = path.resolve("assets/excalidraw-libraries/azure-icons/icons");

const COLORS = {
  ink: "#0f172a",
  muted: "#475569",
  shellBlue: "#eef6ff",
  shellCream: "#fff9ef",
  shellCyan: "#f3fbff",
  border: "#0078D4",
  edgeStroke: "#4f8fd8",
  edgeFill: "#dcecff",
  runtimeStroke: "#8b5cf6",
  runtimeFill: "#f0e9ff",
  dataStroke: "#16a34a",
  dataFill: "#e9f9ee",
  supportStroke: "#94a3b8",
  supportFill: "#f8fafc",
  partnerStroke: "#f59e0b",
  partnerFill: "#ffe8c2",
  opsStroke: "#22c55e",
  opsFill: "#c8f8e7",
};

const APP_STATE = {
  gridSize: 20,
  gridStep: 5,
  gridModeEnabled: false,
  viewBackgroundColor: "#ffffff",
};

const FONT = {
  family: 5,
  title: 32,
  subtitle: 17,
  zone: 22,
  cardTitle: 18,
  cardBody: 14,
  shell: 15,
  footer: 18,
  actor: 16,
};

function makeFile(filename, spec) {
  const diagram = {
    type: "excalidraw",
    version: 2,
    source:
      "https://marketplace.visualstudio.com/items?itemName=pomdtr.excalidraw-editor",
    elements: [],
    appState: APP_STATE,
    files: {},
  };
  addHeader(diagram, spec);
  addShell(diagram, spec);
  addActors(diagram, spec.actors);
  addZones(diagram, spec.zones);
  addCards(diagram, spec.cards);
  addArrows(diagram, spec.arrows);
  addSupportCards(diagram, spec.supportCards);
  addFooter(diagram, spec.footer);

  fs.writeFileSync(
    path.join(SHOWCASE_DIR, filename),
    `${JSON.stringify(diagram, null, 2)}\n`,
    "utf-8",
  );
}

function lineCount(text) {
  return text.split("\n").length;
}

function textHeight(text, fontSize) {
  return Math.ceil(lineCount(text) * fontSize * 1.28);
}

function pushElement(diagram, element) {
  diagram.elements.push(element);
}

function addText(diagram, options) {
  const text = options.text;
  pushElement(diagram, {
    id: randomUUID(),
    type: "text",
    x: options.x,
    y: options.y,
    width: options.width,
    height: options.height ?? textHeight(text, options.fontSize),
    angle: 0,
    strokeColor: options.strokeColor ?? COLORS.ink,
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 0,
    opacity: 100,
    fontSize: options.fontSize,
    fontFamily: FONT.family,
    text,
    textAlign: options.textAlign ?? "center",
    verticalAlign: "top",
    originalText: text,
    lineHeight: 1.25,
  });
}

function addRect(diagram, options) {
  pushElement(diagram, {
    id: randomUUID(),
    type: "rectangle",
    x: options.x,
    y: options.y,
    width: options.width,
    height: options.height,
    angle: 0,
    strokeColor: options.strokeColor,
    backgroundColor: options.backgroundColor,
    fillStyle: "solid",
    strokeWidth: options.strokeWidth ?? 2,
    strokeStyle: "solid",
    roughness: 0,
    opacity: options.opacity ?? 100,
    roundness: { type: 3 },
  });
}

function addArrow(diagram, arrow) {
  pushElement(diagram, {
    id: randomUUID(),
    type: "arrow",
    x: arrow.from[0],
    y: arrow.from[1],
    width: arrow.to[0] - arrow.from[0],
    height: arrow.to[1] - arrow.from[1],
    angle: 0,
    strokeColor: arrow.strokeColor,
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: arrow.strokeWidth ?? 3,
    strokeStyle: "solid",
    roughness: 0,
    opacity: 100,
    points: [
      [0, 0],
      [arrow.to[0] - arrow.from[0], arrow.to[1] - arrow.from[1]],
    ],
    startArrowhead: null,
    endArrowhead: "arrow",
  });
}

function normalizeName(value) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function resolveIcon(iconName) {
  const exact = path.join(ICON_DIR, `${iconName}.json`);
  if (fs.existsSync(exact)) {
    return exact;
  }

  const files = fs
    .readdirSync(ICON_DIR)
    .filter((file) => file.endsWith(".json"));
  const wanted = normalizeName(iconName);
  const match = files.find(
    (file) => normalizeName(file.replace(/\.json$/, "")) === wanted,
  );
  if (match) {
    return path.join(ICON_DIR, match);
  }

  const softMatch = files.find((file) => normalizeName(file).includes(wanted));
  if (softMatch) {
    return path.join(ICON_DIR, softMatch);
  }

  throw new Error(`Unable to resolve icon '${iconName}'`);
}

function addIcon(diagram, iconName, x, y, width, height) {
  const iconPath = resolveIcon(iconName);
  const iconData = JSON.parse(fs.readFileSync(iconPath, "utf-8"));
  const imageElement = iconData.elements.find(
    (element) => element.type === "image",
  );
  const [fileId, fileData] = Object.entries(iconData.files ?? {})[0];

  if (!imageElement || !fileId) {
    throw new Error(`Invalid icon payload for '${iconName}'`);
  }

  diagram.files[fileId] = fileData;
  pushElement(diagram, {
    id: randomUUID(),
    type: "image",
    x,
    y,
    width,
    height,
    angle: 0,
    strokeColor: "transparent",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 0,
    strokeStyle: "solid",
    roughness: 0,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: 0,
    version: 1,
    versionNonce: 0,
    isDeleted: false,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    status: "saved",
    fileId,
  });
}

function addHeader(diagram, spec) {
  addText(diagram, {
    x: 560,
    y: 26,
    width: 980,
    fontSize: FONT.title,
    text: spec.title,
  });
  addText(diagram, {
    x: 640,
    y: 74,
    width: 820,
    fontSize: FONT.subtitle,
    strokeColor: COLORS.muted,
    text: spec.subtitle,
  });
}

function addShell(diagram, spec) {
  addRect(diagram, {
    x: 180,
    y: 128,
    width: 1740,
    height: 1240,
    strokeColor: COLORS.border,
    backgroundColor: spec.shellColor,
    strokeWidth: 3,
  });
  addRect(diagram, {
    x: 220,
    y: 148,
    width: 340,
    height: 54,
    strokeColor: spec.shellBadgeStroke,
    backgroundColor: spec.shellBadgeFill,
    strokeWidth: 1,
  });
  addText(diagram, {
    x: 246,
    y: 162,
    width: 288,
    fontSize: FONT.shell,
    text: spec.shellLabel,
  });
  addRect(diagram, {
    x: 270,
    y: 1286,
    width: 1560,
    height: 54,
    strokeColor: COLORS.ink,
    backgroundColor: "#ffffff",
    strokeWidth: 2,
  });
}

function addZones(diagram, zones) {
  for (const zone of zones) {
    addRect(diagram, {
      x: zone.x,
      y: zone.y,
      width: zone.width,
      height: zone.height,
      strokeColor: zone.strokeColor,
      backgroundColor: zone.backgroundColor,
      opacity: 58,
    });
    addText(diagram, {
      x: zone.x + 40,
      y: zone.y + 18,
      width: zone.width - 80,
      fontSize: FONT.zone,
      strokeColor: zone.titleColor,
      text: zone.title,
    });
  }

  addRect(diagram, {
    x: 250,
    y: 972,
    width: 1540,
    height: 244,
    strokeColor: COLORS.supportStroke,
    backgroundColor: COLORS.supportFill,
  });
  addText(diagram, {
    x: 670,
    y: 996,
    width: 700,
    fontSize: 19,
    strokeColor: "#334155",
    text: zones.supportLabel,
  });
}

function addActors(diagram, actors) {
  for (const actor of actors) {
    addRect(diagram, {
      x: actor.x,
      y: actor.y,
      width: 150,
      height: 74,
      strokeColor: actor.strokeColor,
      backgroundColor: actor.backgroundColor,
    });
    addText(diagram, {
      x: actor.x + 16,
      y: actor.y + 24,
      width: 118,
      fontSize: FONT.actor,
      strokeColor: actor.textColor,
      text: actor.label,
    });
  }
}

function addCard(diagram, card) {
  const titleHeight = textHeight(card.title, FONT.cardTitle);
  const bodyY = card.y + 28 + titleHeight + 8;
  addRect(diagram, {
    x: card.x,
    y: card.y,
    width: card.width,
    height: card.height,
    strokeColor: card.strokeColor,
    backgroundColor: "#ffffff",
  });
  addIcon(diagram, card.icon, card.x + 18, card.y + 32, 40, 40);
  addText(diagram, {
    x: card.x + 76,
    y: card.y + 24,
    width: card.width - 96,
    height: titleHeight,
    fontSize: FONT.cardTitle,
    textAlign: "left",
    text: card.title,
  });
  addText(diagram, {
    x: card.x + 76,
    y: bodyY,
    width: card.width - 96,
    fontSize: FONT.cardBody,
    strokeColor: COLORS.muted,
    textAlign: "left",
    text: card.body,
  });
}

function addCards(diagram, cards) {
  for (const card of cards) {
    addCard(diagram, card);
  }
}

function addSupportCards(diagram, cards) {
  for (const card of cards) {
    addCard(diagram, {
      ...card,
      height: 96,
      width: 280,
      strokeColor: COLORS.supportStroke,
    });
  }
}

function addArrows(diagram, arrows) {
  for (const arrow of arrows) {
    addArrow(diagram, arrow);
  }
}

function addFooter(diagram, footer) {
  addText(diagram, {
    x: 540,
    y: 1302,
    width: 1200,
    fontSize: FONT.footer,
    text: footer,
  });
}

function zoneDefinitions() {
  return [
    {
      x: 260,
      y: 236,
      width: 430,
      height: 700,
      strokeColor: COLORS.edgeStroke,
      backgroundColor: COLORS.edgeFill,
      titleColor: "#1d4ed8",
    },
    {
      x: 760,
      y: 236,
      width: 450,
      height: 700,
      strokeColor: COLORS.runtimeStroke,
      backgroundColor: COLORS.runtimeFill,
      titleColor: "#6d28d9",
    },
    {
      x: 1280,
      y: 236,
      width: 510,
      height: 700,
      strokeColor: COLORS.dataStroke,
      backgroundColor: COLORS.dataFill,
      titleColor: "#166534",
    },
  ];
}

const AI_SPEC = {
  title: "Enterprise Azure AI Platform",
  subtitle: "Secure RAG blueprint for enterprise copilots and agent workflows",
  shellColor: COLORS.shellBlue,
  shellBadgeFill: "#dbeafe",
  shellBadgeStroke: "#7aa6d8",
  shellLabel: "Landing zone\nPrivate AI + data services",
  zones: Object.assign(zoneDefinitions(), {
    supportLabel: "Identity, secrets, monitoring, and security",
  }),
  actors: [
    {
      x: 26,
      y: 346,
      label: "Users",
      strokeColor: COLORS.border,
      backgroundColor: "#a5d8ff",
      textColor: COLORS.ink,
    },
    {
      x: 26,
      y: 660,
      label: "Partner apps",
      strokeColor: COLORS.partnerStroke,
      backgroundColor: COLORS.partnerFill,
      textColor: "#7c2d12",
    },
  ],
  cards: [
    {
      x: 300,
      y: 316,
      width: 340,
      height: 120,
      strokeColor: COLORS.edgeStroke,
      icon: "icon-service-Front-Door-and-CDN-Profiles",
      title: "Front Door + WAF",
      body: "Ingress, caching, and edge policy",
    },
    {
      x: 300,
      y: 490,
      width: 340,
      height: 120,
      strokeColor: COLORS.edgeStroke,
      icon: "icon-service-API-Management-Services",
      title: "API Management",
      body: "Auth, rate limits, and AI gateway",
    },
    {
      x: 300,
      y: 664,
      width: 340,
      height: 120,
      strokeColor: COLORS.edgeStroke,
      icon: "icon-service-App-Services",
      title: "Web + Copilot channels",
      body: "Browser, mobile, and conversational entry",
    },
    {
      x: 820,
      y: 392,
      width: 330,
      height: 120,
      strokeColor: COLORS.runtimeStroke,
      icon: "icon-service-Worker-Container-App",
      title: "Container Apps",
      body: "Agent APIs and execution runtime",
    },
    {
      x: 820,
      y: 566,
      width: 330,
      height: 120,
      strokeColor: COLORS.runtimeStroke,
      icon: "icon-service-Event-Grid-Topics",
      title: "Event Grid",
      body: "Async jobs and event fan-out",
    },
    {
      x: 1330,
      y: 316,
      width: 360,
      height: 120,
      strokeColor: COLORS.dataStroke,
      icon: "icon-service-Azure-OpenAI",
      title: "Azure OpenAI",
      body: "Inference, safety, and model access",
    },
    {
      x: 1330,
      y: 490,
      width: 360,
      height: 120,
      strokeColor: COLORS.dataStroke,
      icon: "icon-service-Cognitive-Search",
      title: "Azure AI Search",
      body: "Retrieval, indexing, and grounding",
    },
    {
      x: 1330,
      y: 664,
      width: 360,
      height: 120,
      strokeColor: COLORS.dataStroke,
      icon: "icon-service-Azure-Database-PostgreSQL-Server",
      title: "PostgreSQL\nFlexible Server",
      body: "Conversation state and operational data",
    },
    {
      x: 1330,
      y: 838,
      width: 360,
      height: 120,
      strokeColor: COLORS.dataStroke,
      icon: "icon-service-Storage-Accounts",
      title: "Blob Storage",
      body: "Documents, assets, and source content",
    },
  ],
  supportCards: [
    {
      x: 320,
      y: 1058,
      icon: "icon-service-External-Identities",
      title: "Microsoft Entra",
      body: "Identity and access",
    },
    {
      x: 680,
      y: 1058,
      icon: "icon-service-Key-Vaults",
      title: "Azure Key Vault",
      body: "Secrets and certificates",
    },
    {
      x: 1040,
      y: 1058,
      icon: "icon-service-Monitor",
      title: "Azure Monitor",
      body: "Traces, metrics, and alerts",
    },
    {
      x: 1400,
      y: 1058,
      icon: "icon-service-Microsoft-Defender-for-Cloud",
      title: "Defender for Cloud",
      body: "Posture + threat detection",
    },
  ],
  arrows: [
    { from: [176, 383], to: [300, 376], strokeColor: COLORS.border },
    { from: [176, 697], to: [300, 550], strokeColor: COLORS.partnerStroke },
    { from: [470, 436], to: [470, 490], strokeColor: COLORS.edgeStroke },
    { from: [640, 724], to: [820, 452], strokeColor: COLORS.edgeStroke },
    { from: [640, 550], to: [820, 626], strokeColor: COLORS.runtimeStroke },
    { from: [1150, 452], to: [1330, 376], strokeColor: COLORS.runtimeStroke },
    { from: [1150, 452], to: [1330, 550], strokeColor: COLORS.runtimeStroke },
    { from: [1150, 626], to: [1330, 724], strokeColor: COLORS.runtimeStroke },
    { from: [1150, 626], to: [1330, 898], strokeColor: COLORS.runtimeStroke },
  ],
  footer: "Secure edge, composable agent runtime, private knowledge plane",
};

AI_SPEC.zones[0].title = "Edge + Channels";
AI_SPEC.zones[1].title = "Agent Runtime";
AI_SPEC.zones[2].title = "Knowledge Plane";

const COMMERCE_SPEC = {
  title: "Global Digital Commerce on Azure",
  subtitle:
    "Storefront, ordering, payments, and fulfillment with resilient platform services",
  shellColor: COLORS.shellCream,
  shellBadgeFill: "#fff3bf",
  shellBadgeStroke: "#d1a24a",
  shellLabel: "Retail shell\nShared platform + private data",
  zones: Object.assign(zoneDefinitions(), {
    supportLabel: "Identity, configuration, secrets, and observability",
  }),
  actors: [
    {
      x: 40,
      y: 346,
      label: "Customers",
      strokeColor: COLORS.border,
      backgroundColor: "#a5d8ff",
      textColor: COLORS.ink,
    },
    {
      x: 40,
      y: 726,
      label: "Ops teams",
      strokeColor: COLORS.opsStroke,
      backgroundColor: COLORS.opsFill,
      textColor: "#14532d",
    },
    {
      x: 1768,
      y: 372,
      label: "Payments",
      strokeColor: COLORS.partnerStroke,
      backgroundColor: COLORS.partnerFill,
      textColor: "#7c2d12",
    },
    {
      x: 1768,
      y: 728,
      label: "ERP / WMS",
      strokeColor: COLORS.partnerStroke,
      backgroundColor: COLORS.partnerFill,
      textColor: "#7c2d12",
    },
  ],
  cards: [
    {
      x: 300,
      y: 320,
      width: 330,
      height: 120,
      strokeColor: COLORS.edgeStroke,
      icon: "icon-service-Front-Door-and-CDN-Profiles",
      title: "Front Door + WAF",
      body: "Global edge, routing, and caching",
    },
    {
      x: 300,
      y: 500,
      width: 330,
      height: 120,
      strokeColor: COLORS.edgeStroke,
      icon: "icon-service-Static-Apps",
      title: "Static Web Apps",
      body: "Storefront UI and campaign content",
    },
    {
      x: 820,
      y: 340,
      width: 340,
      height: 120,
      strokeColor: COLORS.runtimeStroke,
      icon: "icon-service-App-Services",
      title: "App Service API",
      body: "Catalog, basket, and order flows",
    },
    {
      x: 820,
      y: 520,
      width: 340,
      height: 120,
      strokeColor: COLORS.runtimeStroke,
      icon: "icon-service-Azure-Service-Bus",
      title: "Service Bus",
      body: "Reliable async messaging",
    },
    {
      x: 820,
      y: 700,
      width: 340,
      height: 120,
      strokeColor: COLORS.runtimeStroke,
      icon: "icon-service-Function-Apps",
      title: "Azure Functions",
      body: "Back-office events and automation",
    },
    {
      x: 1330,
      y: 320,
      width: 360,
      height: 120,
      strokeColor: COLORS.dataStroke,
      icon: "icon-service-Azure-Database-PostgreSQL-Server",
      title: "PostgreSQL\nFlexible Server",
      body: "Transactional system of record",
    },
    {
      x: 1330,
      y: 500,
      width: 360,
      height: 120,
      strokeColor: COLORS.dataStroke,
      icon: "icon-service-Azure-Managed-Redis",
      title: "Managed Redis",
      body: "Low-latency session and cache layer",
    },
    {
      x: 1330,
      y: 680,
      width: 360,
      height: 120,
      strokeColor: COLORS.dataStroke,
      icon: "icon-service-Storage-Accounts",
      title: "Blob Storage",
      body: "Media, exports, and fulfillment files",
    },
  ],
  supportCards: [
    {
      x: 320,
      y: 1058,
      icon: "icon-service-External-Identities",
      title: "External ID",
      body: "Customer sign-in",
    },
    {
      x: 680,
      y: 1058,
      icon: "icon-service-Key-Vaults",
      title: "Azure Key Vault",
      body: "Secrets and signing keys",
    },
    {
      x: 1040,
      y: 1058,
      icon: "icon-service-App-Configuration",
      title: "App Configuration",
      body: "Feature flags and settings",
    },
    {
      x: 1400,
      y: 1058,
      icon: "icon-service-Monitor",
      title: "Azure Monitor",
      body: "Health, traces, and alerting",
    },
  ],
  arrows: [
    { from: [190, 383], to: [300, 380], strokeColor: COLORS.border },
    { from: [465, 440], to: [465, 500], strokeColor: COLORS.edgeStroke },
    { from: [630, 560], to: [820, 400], strokeColor: COLORS.edgeStroke },
    { from: [990, 460], to: [990, 520], strokeColor: COLORS.runtimeStroke },
    { from: [990, 640], to: [990, 700], strokeColor: COLORS.runtimeStroke },
    { from: [1160, 400], to: [1330, 380], strokeColor: COLORS.runtimeStroke },
    { from: [1160, 400], to: [1330, 560], strokeColor: COLORS.runtimeStroke },
    { from: [1160, 760], to: [1330, 740], strokeColor: COLORS.runtimeStroke },
    { from: [1690, 380], to: [1768, 409], strokeColor: COLORS.partnerStroke },
    { from: [1690, 740], to: [1768, 765], strokeColor: COLORS.partnerStroke },
    { from: [190, 763], to: [820, 760], strokeColor: COLORS.opsStroke },
  ],
  footer: "Fast edge, dependable commerce core, partner-ready integrations",
};

COMMERCE_SPEC.zones[0].title = "Digital Edge";
COMMERCE_SPEC.zones[1].title = "Commerce Core";
COMMERCE_SPEC.zones[2].title = "Orders + Fulfillment";

const IIOT_SPEC = {
  title: "Industrial IoT Operations Mesh",
  subtitle:
    "Operational telemetry, digital twins, and plant response for modern connected factories",
  shellColor: COLORS.shellCyan,
  shellBadgeFill: "#dbeafe",
  shellBadgeStroke: "#7aa6d8",
  shellLabel: "Operations zone\nSecure plant telemetry",
  zones: Object.assign(zoneDefinitions(), {
    supportLabel: "Security, monitoring, and incident detection",
  }),
  actors: [
    {
      x: 40,
      y: 360,
      label: "Machines + PLCs",
      strokeColor: COLORS.border,
      backgroundColor: "#a5d8ff",
      textColor: COLORS.ink,
    },
    {
      x: 40,
      y: 734,
      label: "Field engineers",
      strokeColor: COLORS.opsStroke,
      backgroundColor: COLORS.opsFill,
      textColor: "#14532d",
    },
    {
      x: 1768,
      y: 560,
      label: "Business apps",
      strokeColor: COLORS.partnerStroke,
      backgroundColor: COLORS.partnerFill,
      textColor: "#7c2d12",
    },
    {
      x: 1768,
      y: 760,
      label: "Teams alerts",
      strokeColor: COLORS.partnerStroke,
      backgroundColor: COLORS.partnerFill,
      textColor: "#7c2d12",
    },
  ],
  cards: [
    {
      x: 300,
      y: 328,
      width: 330,
      height: 120,
      strokeColor: COLORS.edgeStroke,
      icon: "icon-service-Azure-IoT-Operations",
      title: "Azure IoT Operations",
      body: "Edge messaging and protocol translation",
    },
    {
      x: 300,
      y: 542,
      width: 330,
      height: 120,
      strokeColor: COLORS.edgeStroke,
      icon: "icon-service-IoT-Hub",
      title: "Azure IoT Hub",
      body: "Device connectivity and telemetry ingress",
    },
    {
      x: 820,
      y: 328,
      width: 330,
      height: 120,
      strokeColor: COLORS.runtimeStroke,
      icon: "icon-service-Event-Hubs",
      title: "Event Hubs",
      body: "High-throughput telemetry backbone",
    },
    {
      x: 820,
      y: 542,
      width: 330,
      height: 120,
      strokeColor: COLORS.runtimeStroke,
      icon: "icon-service-Stream-Analytics-Jobs",
      title: "Stream Analytics",
      body: "Windowing and enrichment",
    },
    {
      x: 820,
      y: 756,
      width: 330,
      height: 120,
      strokeColor: COLORS.runtimeStroke,
      icon: "icon-service-Worker-Container-App",
      title: "Container Apps",
      body: "Operations API and response flows",
    },
    {
      x: 1330,
      y: 328,
      width: 360,
      height: 120,
      strokeColor: COLORS.dataStroke,
      icon: "icon-service-Azure-Data-Explorer-Clusters",
      title: "Azure Data Explorer",
      body: "Operational analytics and history",
    },
    {
      x: 1330,
      y: 542,
      width: 360,
      height: 120,
      strokeColor: COLORS.dataStroke,
      icon: "icon-service-Digital-Twins",
      title: "Digital Twins",
      body: "Context model for lines and assets",
    },
    {
      x: 1330,
      y: 756,
      width: 360,
      height: 120,
      strokeColor: COLORS.dataStroke,
      icon: "icon-service-Azure-Managed-Grafana",
      title: "Grafana + Power BI",
      body: "Dashboards, KPIs, and operator views",
    },
  ],
  supportCards: [
    {
      x: 320,
      y: 1058,
      icon: "icon-service-Key-Vaults",
      title: "Azure Key Vault",
      body: "Secrets and device credentials",
    },
    {
      x: 680,
      y: 1058,
      icon: "icon-service-Microsoft-Defender-for-IoT",
      title: "Defender for IoT",
      body: "OT visibility + anomaly detection",
    },
    {
      x: 1040,
      y: 1058,
      icon: "icon-service-Monitor",
      title: "Azure Monitor",
      body: "Logs, metrics, and SRE telemetry",
    },
    {
      x: 1400,
      y: 1058,
      icon: "icon-service-Azure-Sentinel",
      title: "Microsoft Sentinel",
      body: "Incident correlation + response",
    },
  ],
  arrows: [
    { from: [190, 397], to: [300, 388], strokeColor: COLORS.border },
    { from: [465, 448], to: [465, 542], strokeColor: COLORS.edgeStroke },
    { from: [630, 602], to: [820, 388], strokeColor: COLORS.runtimeStroke },
    { from: [985, 448], to: [985, 542], strokeColor: COLORS.runtimeStroke },
    { from: [1150, 602], to: [1330, 388], strokeColor: COLORS.runtimeStroke },
    { from: [190, 771], to: [820, 816], strokeColor: COLORS.opsStroke },
    { from: [1150, 816], to: [1330, 602], strokeColor: COLORS.runtimeStroke },
    { from: [1510, 448], to: [1510, 756], strokeColor: COLORS.dataStroke },
    { from: [1690, 602], to: [1768, 597], strokeColor: COLORS.partnerStroke },
    { from: [1690, 816], to: [1768, 797], strokeColor: COLORS.partnerStroke },
  ],
  footer:
    "Operational visibility, digital context, and actionable plant telemetry",
};

IIOT_SPEC.zones[0].title = "Plant Edge";
IIOT_SPEC.zones[1].title = "Streaming Core";
IIOT_SPEC.zones[2].title = "Analytics + Response";

fs.mkdirSync(SHOWCASE_DIR, { recursive: true });

makeFile("showcase-enterprise-ai-platform.excalidraw", AI_SPEC);
makeFile("showcase-global-commerce.excalidraw", COMMERCE_SPEC);
makeFile("showcase-industrial-iot-operations.excalidraw", IIOT_SPEC);

console.log("Regenerated showcase diagrams.");
