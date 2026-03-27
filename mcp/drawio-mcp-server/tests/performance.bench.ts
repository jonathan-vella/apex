import { DiagramModel } from "../src/diagram_model.ts";
import { initializeShapes, searchAzureIcons } from "../src/shapes/azure_icon_library.ts";

let shapesInitialized = false;

function ensureShapesInitialized(): void {
  if (!shapesInitialized) {
    initializeShapes();
    shapesInitialized = true;
  }
}

Deno.bench("diagram delete cascade (1000 edges)", () => {
  const model = new DiagramModel();
  const hub = model.addRectangle({ text: "Hub" });

  for (let i = 0; i < 1000; i++) {
    const leaf = model.addRectangle({ text: `Leaf-${i}` });
    model.addEdge({ sourceId: hub.id, targetId: leaf.id });
  }

  model.deleteCell(hub.id);
});

Deno.bench("diagram getStats warm cache (1000 reads)", () => {
  const model = new DiagramModel();

  for (let i = 0; i < 500; i++) {
    model.addRectangle({ x: i, y: i, text: `Node-${i}` });
  }

  model.getStats();
  for (let i = 0; i < 1000; i++) {
    model.getStats();
  }
});

Deno.bench("shape search cached query (1000 reads)", () => {
  ensureShapesInitialized();

  searchAzureIcons("storage", 10);
  for (let i = 0; i < 1000; i++) {
    searchAzureIcons("storage", 10);
  }
});
