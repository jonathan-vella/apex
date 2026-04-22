"""'apex-recall reindex' command — force rebuild of the index."""

from __future__ import annotations

import json

from ..indexer import reindex as do_reindex


def run(args) -> int:
    """Force rebuild of the SQLite index."""
    count = do_reindex()

    if getattr(args, "json", False):
        print(json.dumps({"reindexed": True, "artifacts": count}))
    else:
        print(f"Reindexed {count} artifact(s).")

    return 0
