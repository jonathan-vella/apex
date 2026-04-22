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

    # ── Write commands ──────────────────────────────────────────────────────

    # init
    p_init = sub.add_parser("init", help="Create a fresh session-state for a project")
    p_init.add_argument("project", help="Project name")
    p_init.add_argument("--json", action="store_true", help="Output as JSON")
    p_init.add_argument("--force", action="store_true", help="Overwrite existing session state")

    # start-step
    p_start = sub.add_parser("start-step", help="Mark a step as in_progress")
    p_start.add_argument("project", help="Project name")
    p_start.add_argument("step", help="Step key (1, 2, 3, 3_5, 4, 5, 6, 7)")
    p_start.add_argument("--json", action="store_true", help="Output as JSON")
    p_start.add_argument("--force", action="store_true", help="Re-start a completed step")

    # checkpoint
    p_cp = sub.add_parser("checkpoint", help="Record a sub-step checkpoint")
    p_cp.add_argument("project", help="Project name")
    p_cp.add_argument("step", help="Step key (1, 2, 3, 3_5, 4, 5, 6, 7)")
    p_cp.add_argument("sub_step", help="Sub-step identifier")
    p_cp.add_argument("--json", action="store_true", help="Output as JSON")
    p_cp.add_argument("--artifact", type=str, default=None, help="Artifact path to append")

    # complete-step
    p_complete = sub.add_parser("complete-step", help="Mark a step as complete")
    p_complete.add_argument("project", help="Project name")
    p_complete.add_argument("step", help="Step key (1, 2, 3, 3_5, 4, 5, 6, 7)")
    p_complete.add_argument("--json", action="store_true", help="Output as JSON")

    # decide
    p_decide = sub.add_parser("decide", help="Record a decision or decision_log entry")
    p_decide.add_argument("project", help="Project name")
    p_decide.add_argument("--key", type=str, default=None, help="Decision key (Mode A: decisions object)")
    p_decide.add_argument("--value", type=str, default=None, help="Decision value (Mode A)")
    p_decide.add_argument("--decision", type=str, default=None, help="Decision text (Mode B: decision_log)")
    p_decide.add_argument("--rationale", type=str, default=None, help="Rationale (Mode B)")
    p_decide.add_argument("--step", type=str, default=None, help="Step reference (Mode B)")
    p_decide.add_argument("--json", action="store_true", help="Output as JSON")

    # finding
    p_finding = sub.add_parser("finding", help="Manage open_findings")
    p_finding.add_argument("project", help="Project name")
    p_finding.add_argument("--add", type=str, default=None, help="Add a finding")
    p_finding.add_argument("--remove", type=str, default=None, help="Remove a finding")
    p_finding.add_argument("--json", action="store_true", help="Output as JSON")

    # review-audit
    p_ra = sub.add_parser("review-audit", help="Manage review_audit entries")
    p_ra.add_argument("project", help="Project name")
    p_ra.add_argument("step", help="Step key (1, 2, 3, 3_5, 4, 5, 6, 7)")
    p_ra.add_argument("--complexity", type=str, default=None, help="Complexity level")
    p_ra.add_argument("--passes-planned", type=int, default=None, help="Passes planned")
    p_ra.add_argument("--passes-executed", type=int, default=None, help="Passes executed")
    p_ra.add_argument("--model", action="append", default=None, help="Model name (repeatable)")
    p_ra.add_argument("--skip", action="append", default=None, help="Skip pass number (repeatable)")
    p_ra.add_argument("--skip-reason", action="append", default=None, help="Skip reason (repeatable)")
    p_ra.add_argument("--json", action="store_true", help="Output as JSON")

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
    elif args.command == "init":
        from .commands.init import run
    elif args.command == "start-step":
        from .commands.start_step import run
    elif args.command == "checkpoint":
        from .commands.checkpoint import run
    elif args.command == "complete-step":
        from .commands.complete_step import run
    elif args.command == "decide":
        from .commands.decide import run
    elif args.command == "finding":
        from .commands.finding import run
    elif args.command == "review-audit":
        from .commands.review_audit import run
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
