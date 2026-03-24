# Transactional Diagram Creation Mode Design

## Problem

Large diagrams with embedded SVG images create massive XML payloads. Every tool call (`add-cells`, `edit-cells`, etc.) returns the full diagram XML, causing:

- Network payload bloat (200KB+ per call for 50+ shapes)
- Client timeouts and hangs
- Poor UX during batch diagram creation

## Solution: Optional Transactional Mode

A stateless, two-phase diagram creation pattern that reduces payloads by 70-90% during intermediate operations.

### Core Concept

**Phase 1: Transactional Mode** (lightweight placeholders)

- Client passes `transactional: true` on each tool call
- Server detects this flag and uses **placeholder SVGs** instead of full image data
- Intermediate responses are ~2-5KB instead of 200KB+
- Client passes the placeholder XML back on each subsequent call
- No server-side session state required (fully stateless)

**Phase 2: Finish** (resolution to production XML)

- Client calls `finish-diagram` with the final placeholder XML
- Server resolves all placeholders to real SVG data
- Server compresses and returns production-ready XML
- Caller can now export directly

### Placeholder Format

Placeholders are real XML cells with a special marker:

```xml
<!-- Placeholder for Azure Front Door shape -->
<mxCell 
  id="placeholder-front-doors-a1b2c3" 
  value="Front Door" 
  style="fillColor=#E6F2FA;placeholder=1;" 
  vertex="1" 
  parent="1">
  <mxGeometry x="100" y="100" width="48" height="48" as="geometry"/>
</mxCell>
```

**Placeholder ID**: `placeholder-{hyphenated-shape-name}-{uuid-suffix}`

- Unique across any diagram
- Shape name encoded for easy reverse-lookup
- Distinguishable from normal cell IDs (`cell-N`)

## Implementation Architecture

### 1. New Module: `src/placeholder.ts`

Functions for creating/resolving placeholders:

```typescript
// Create a placeholder cell from shape definition
export function createPlaceholderCell(
  shapeDefinition: { name: string; width: number; height: number; style: string },
  position: { x: number; y: number },
): Cell;

// Resolve all placeholders in XML to real SVG
export function resolvePlaceholdersInXml(
  diagramXml: string,
  shapeResolver: (shapeName: string) => ResolvedShape | undefined,
): string;

// Detect if XML contains placeholders
export function containsPlaceholders(diagramXml: string): boolean;
```

### 2. Modify `DiagramModel.toXml()`

Add transactional option:

```typescript
toXml(options?: {
  compress?: boolean;
  transactional?: boolean;  // NEW: Use placeholder SVGs instead of real images
}): string;
```

When `transactional: true`:

- SVG image data is stripped/replaced with minimal placeholder style
- Regular cell structure, geometry, and styling preserved
- Result is ~50-100 bytes per shape instead of 5KB+

### 3. Modify Tool Handlers

Add `transactional?: boolean` parameter to all stateful tools:

- `add-cells`
- `add-cells-of-shape`
- `add-cells-to-group`
- `create-groups`
- `edit-cells`
- `edit-edges`
- `set-cell-shape`
- `delete-cell-by-id`
- `import-diagram`
- `export-diagram` (when operating transitionally)

Update `withDiagramState` to pass the flag:

```typescript
function withDiagramState<T extends StatefulArgs>(
  args: T & { transactional?: boolean },
  operation: (diagram: DiagramModel) => CallToolResult,
): CallToolResult {
  // ... load diagram ...
  const result = operation(diagram);
  // ... apply transaction flag when converting to XML ...
  const diagramXml = diagram.toXml({ transactional: args.transactional });
  // ...
}
```

### 4. New Tool: `finish-diagram`

Completes transactional diagram creation:

```typescript
"finish-diagram": (args: {
  diagram_xml: string;
  compress?: boolean;  // default: true
}): CallToolResult => {
  // Parse XML
  // Detect all placeholder cells
  // Resolve each placeholder to its real shape
  // Replace placeholder style/SVG with real SVG
  // Compress if requested
  // Return production-ready XML
}
```

## Stateless Design

All state is in the client-provided `diagram_xml`:

1. Client: `add-cells(..., transactional: true, diagram_xml: null)`
   - Server: Creates diagram, adds shapes as placeholders
   - Returns: `{ diagram_xml: "<with placeholders>", ... }`
   - Payload: ~2KB

2. Client: `add-cells(..., transactional: true, diagram_xml: "<from step 1>")`
   - Server: Loads placeholder XML, adds more shapes
   - Returns: `{ diagram_xml: "<more placeholders>", ... }`
   - Payload: ~2KB

3. ... More tools ...

4. Client: `finish-diagram(diagram_xml: "<from last call>")`
   - Server: Resolves all placeholders to real SVG
   - Compresses
   - Returns: `{ diagram_xml: "<full production XML, compressed>", ... }`
   - Payload: ~50-100KB for a complex diagram (was 500KB+ without transactional)

## Instructions Update

`src/instructions.md` will document two clear workflows:

### Workflow A: Default (Non-Transactional)

```
For simple diagrams or single operations:
1. search-shapes
2. add-cells (without transactional flag) → returns full XML
3. export-diagram → full production XML
```

### Workflow B: Transactional (For Batch Operations)

```
For large diagrams with many shape additions:
1. search-shapes
2. Set diagram_xml = null
3. add-cells(..., transactional: true, diagram_xml) → returns XML with placeholders
4. add-cells(..., transactional: true, diagram_xml) → returns updated placeholder XML
5. edit-cells(..., transactional: true, diagram_xml) → returns updated placeholder XML
6. ... more operations with same pattern ...
7. finish-diagram(diagram_xml, compress: true) → returns final, compressed production XML
8. export to .drawio file
```

### Error Recovery

If any operation fails:

- Error message includes the operation that failed
- Diagram state is preserved (client still has valid XML from prior call)
- Retry sequence:
  - Correct the failed operation parameters
  - Re-submit with same diagram_xml
  - Resume from that point

If `finish-diagram` fails:

- Error lists which shapes couldn't be resolved
- Diagram XML is still valid with placeholders (not corrupted)
- Retry with corrected shape names or add missing shapes first

## Benefits

| Aspect                   | Without Transactional           | With Transactional        |
| ------------------------ | ------------------------------- | ------------------------- |
| Payload per operation    | 150-300KB                       | 2-5KB                     |
| 10 operations            | 1.5-3MB                         | 20-50KB                   |
| Network latency impact   | High (multiple large requests)  | Low (many small requests) |
| Client UI responsiveness | Poor (waits for huge responses) | Good (quick feedback)     |
| Complexity               | Simple                          | Clear two-phase flow      |

## Migration Path

1. Default mode unchanged - existing clients continue to work
2. Transactional mode is opt-in via `transactional: true` parameter
3. Instructions clearly document both paths
4. No breaking changes to existing tools
5. Clients can mix modes (though not recommended within same diagram)

## Testing Strategy

Phase 1: Unit tests for placeholder creation/resolution
Phase 2: Integration test: full workflow (add shapes → finish → export)
Phase 3: Stress test: 100+ shapes with transactional mode
Phase 4: Error scenarios (missing shapes, invalid XML, etc.)
