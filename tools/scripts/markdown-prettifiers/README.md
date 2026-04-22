# Markdown Prettifier Scripts

This directory contains various Python scripts that were used to procedurally format and prettify the repository's markdown documentation while adhering strictly to existing content intactness rules.

## What These Scripts Do

These scripts programmatically update `.md` files to:

- Translate standard `---` separators into vibrant `<img src="...rainbow.png">` dividers.
- Auto-insert `<a id="top"></a>` hooks at the top of the file.
- Dynamically calculate and inject appropriately aligned `⬆️ Back to Top` links above main `##` headings and securely at the end of files.
- Ensure Emoji-fied headers where required.
- Do so recursively through root directories and sub-folders like `docs/`.

## Using AI to Prettify Docs

If you want an AI agent like Copilot to perform bulk documentation formatting using standard styles encoded in these scripts, you can provide the following prompt:

### Suggested Prompt

```text
Please procedurally prettify all `.md` files in the [folder_path] directory using the styles established by the Python scripts in `scripts/markdown-prettifiers/`.

Required Formatting Constraints:
1. Do not alter any of the core text, explanations, or code blocks.
2. Insert top anchors `<a id="top"></a>`.
3. Add right-aligned `⬆️ Back to Top` links anchored to the top hook, right before `##` headings.
4. Replace standalone `---` horizontal rules with the standard `rainbow.png` `<img />` tag.
```
