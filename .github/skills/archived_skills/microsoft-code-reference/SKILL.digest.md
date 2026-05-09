<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Microsoft Code Reference (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

## Tools

| Need                    | Tool                           | Example                                                                 |
| ----------------------- | ------------------------------ | ----------------------------------------------------------------------- |
| API method/class lookup | `microsoft_docs_search`        | `"BlobClient UploadAsync Azure.Storage.Blobs"`                          |
| Working code sample     | `microsoft_code_sample_search` | `query: "upload blob managed identity", language: "python"`             |
| Full API reference      | `microsoft_docs_fetch`         | Fetch URL from `microsoft_docs_search` (for overloads, full signatures) |

## Finding Code Samples

Use `microsoft_code_sample_search` to get official, working examples:

````text
microsoft_code_sample_search(query: "upload file to blob storage", language: "csharp")
microsoft_code_sample_search(query: "authenticate with managed identity", language: "python")
microsoft_code_sample_search(query: "send message service bus", language: "javascript")

> _See SKILL.md for full content._

## API Lookups

```text
# Verify method exists (include namespace for precision)
"BlobClient UploadAsync Azure.Storage.Blobs"
"GraphServiceClient Users Microsoft.Graph"

# Find class/interface

> _See SKILL.md for full content._

## Error Troubleshooting

Use `microsoft_code_sample_search` to find working code samples and compare
with your implementation. For specific errors, use `microsoft_docs_search`
and `microsoft_docs_fetch`:

| Error Type         | Query                                          |
| ------------------ | ---------------------------------------------- |

> _See SKILL.md for full content._

## When to Verify

Always verify when method names seem \"too convenient\", mixing SDK versions,
package name doesn't follow conventions, or using an API for the first time.

> _See SKILL.md for full content._

## Validation Workflow

Before generating code using Microsoft SDKs, verify it's correct:

1. **Confirm method or package exists** — `microsoft_docs_search(query: "[ClassName] [MethodName] [Namespace]")`
2. **Fetch full details** (for overloads/complex params) — `microsoft_docs_fetch(url: "...")`
3. **Find working sample** — `microsoft_code_sample_search(query: "[task]", language: "[lang]")`

> _See SKILL.md for full content._
````
