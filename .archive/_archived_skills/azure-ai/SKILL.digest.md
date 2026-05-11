<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Azure AI Services (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

## Services

| Service               | Use When                         | MCP Tools       | CLI                    |
| --------------------- | -------------------------------- | --------------- | ---------------------- |
| AI Search             | Full-text, vector, hybrid search | `azure__search` | `az search`            |
| Speech                | Speech-to-text, text-to-speech   | `azure__speech` | -                      |
| OpenAI                | GPT models, embeddings, DALL-E   | -               | `az cognitiveservices` |
| Document Intelligence | Form extraction, OCR             | -               | -                      |

> _See SKILL.md for full content._

## MCP Server (Preferred)

When Azure MCP is enabled:

### AI Search

- `azure__search` with command `search_index_list` - List search indexes
- `azure__search` with command `search_index_get` - Get index details
- `azure__search` with command `search_query` - Query search index

> _See SKILL.md for full content._

## AI Search Capabilities

| Feature          | Description                         |
| ---------------- | ----------------------------------- |
| Full-text search | Linguistic analysis, stemming       |
| Vector search    | Semantic similarity with embeddings |
| Hybrid search    | Combined keyword + vector           |
| AI enrichment    | Entity extraction, OCR, sentiment   |

> _See SKILL.md for full content._

## Speech Capabilities

| Feature        | Description                       |
| -------------- | --------------------------------- |
| Speech-to-text | Real-time and batch transcription |
| Text-to-speech | Neural voices, SSML support       |
