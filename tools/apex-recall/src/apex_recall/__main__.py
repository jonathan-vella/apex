"""CLI entry point for apex-recall."""

from __future__ import annotations

import argparse
import sys

from . import __version__


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="apex-recall",
        description="Progressive session recall CLI for APEX agent-output artifacts.",
    )
    parser.add_argument("--version", action="version", version=f"apex-recall {__version__}")

    sub = parser.add_subparsers(dest="command", help="Available commands")

    # files
    p_files = sub.add_parser("files", help="List recently modified artifact files")
    p_files.add_argument("--json", action="store_true", help="Output as JSON")
    p_files.add_argument("--limit", type=int, default=10, help="Max results (default: 10)")
    p_files.add_argument("--days", type=int, default=None, help="Only files modified within N days")

    # sessions
    p_sessions = sub.add_parser("sessions", help="List session states across projects")
    p_sessions.add_argument("--json", action="store_true", help="Output as JSON")
    p_sessions.add_argument("--limit", type=int, default=10, help="Max results (default: 10)")
    p_sessions.add_argument("--days", type=int, default=None, help="Only sessions updated within N days")

    # search
    p_search = sub.add_parser("search", help="Full-text search across indexed content")
    p_search.add_argument("term", help="Search term")
    p_search.add_argument("--json", action="store_true", help="Output as JSON")
    p_search.add_argument("--days", type=int, default=None, help="Only results within N days")
    p_search.add_argument("--project", type=str, default=None, help="Filter by project name")

    # show
    p_show = sub.add_parser("show", help="Full context dump for one project")
    p_show.add_argument("project", help="Project name")
    p_show.add_argument("--json", action="store_true", help="Output as JSON")

    # decisions
    p_decisions = sub.add_parser("decisions", help="Query decision logs across projects")
    p_decisions.add_argument("--json", action="store_true", help="Output as JSON")
    p_decisions.add_argument("--project", type=str, default=None, help="Filter by project name")

    # reindex
    p_reindex = sub.add_parser("reindex", help="Force rebuild of the index")
    p_reindex.add_argument("--json", action="store_true", help="Output as JSON")

    # health
    p_health = sub.add_parser("health", help="Health dashboard for the index")
    p_health.add_argument("--json", action="store_true", help="Output as JSON")

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.command is None:
        parser.print_help()
        return 0

    # Lazy imports to keep startup fast
    if args.command == "files":
        from .commands.files import run
    elif args.command == "sessions":
        from .commands.sessions import run
    elif args.command == "search":
        from .commands.search import run
    elif args.command == "show":
        from .commands.show import run
    elif args.command == "decisions":
        from .commands.decisions import run
    elif args.command == "reindex":
        from .commands.reindex import run
    elif args.command == "health":
        from .commands.health import run
    else:
        parser.print_help()
        return 1

    try:
        return run(args)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
