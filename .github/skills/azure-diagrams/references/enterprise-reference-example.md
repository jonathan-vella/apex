<!-- ref:enterprise-reference-example-v1 -->

# Enterprise Reference Example

Use `enterprise-reference-example.excalidraw` as the canonical visual benchmark for
the enterprise Azure reference-architecture style expected by this skill.

This benchmark applies across Step 3 design diagrams, Step 4 dependency/runtime
diagrams, and Step 7 as-built diagrams.

## What to copy

- Outer shell first, then nested responsibility zones
- Large readable service tiles that still feel dense and intentional at 100% zoom
- Conceptual labels focused on service role, not SKU or inventory metadata
- Anchored ingress, security, and shared-service placement instead of floating tiles
- Calm orthogonal routing with very few connector labels
- Support-band peer cards that share identical width, height, and baseline alignment

## What not to copy blindly

- The exact service list, geography, or workload-specific wording
- Any project-specific naming that does not belong to the current architecture
- Decorative spacing if the target workload needs a different zone balance

## How to use it

Read this example on demand when a prompt asks for a polished enterprise layout,
or when a draft feels compressed, weakly grouped, or visually inconsistent.
Match the composition logic and visual discipline, then rebuild the target diagram
around the current workload.
