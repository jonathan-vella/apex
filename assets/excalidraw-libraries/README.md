# Excalidraw Icon Libraries

This directory contains Excalidraw icon libraries for Azure architecture diagrams.

## Contents

### Azure Service Icons

- `azure-icons.excalidrawlib` — Combined library for VS Code Excalidraw extension
- `azure-icons/` — Split icons for AI agent token-efficient lookup
  - `manifest.json` — Metadata (icon count, categories, source version)
  - `reference.md` — Icon name → filename lookup table
  - `icons/` — Individual icon JSON files (SVG-in-image elements)

### Microsoft Fabric Architecture Icons

- `fabric-icons.excalidrawlib` — Combined library for VS Code Excalidraw extension
- `fabric-icons/` — Split icons for AI agent token-efficient lookup
  - `manifest.json` — Metadata (icon count, categories, source)
  - `reference.md` — Icon name → filename lookup table
  - `icons/` — Individual icon JSON files (native Excalidraw vector shapes)

## Generating Icons

1. Download the Azure Public Service Icons ZIP from
   [Microsoft Learn](https://learn.microsoft.com/en-us/azure/architecture/icons/)
   (requires license acceptance)
2. Run the conversion script:

   ```bash
   python scripts/convert-azure-icons-to-excalidraw.py <path-to-zip>
   ```

3. Commit the generated files

## Icon Updates

A monthly GitHub Action (`check-azure-icon-updates.yml`) checks for new icon
releases and opens a GitHub Issue when updates are available.

## License

Azure icons are provided by Microsoft under the
[Microsoft Icon Terms](https://learn.microsoft.com/en-us/azure/architecture/icons/#icon-terms).
Icons may be used in architectural diagrams, training materials, or documentation.

Fabric architecture icons are from the
[mwc360 Excalidraw library](https://libraries.excalidraw.com/libraries/mwc360/microsoft-fabric-architecture-icons)
and are community-contributed under the Excalidraw libraries license.
