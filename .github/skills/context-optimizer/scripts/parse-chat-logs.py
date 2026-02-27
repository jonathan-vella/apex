#!/usr/bin/env python3
"""Parse VS Code Copilot Chat debug logs into structured JSON for context analysis."""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path

CCREQ_PATTERN = re.compile(
    r"(?P<timestamp>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\s+"
    r"\[(?P<level>\w+)\]\s+"
    r"ccreq:(?P<request_id>[\w.]+)\s+\|\s+"
    r"(?P<status>\w+)\s+\|\s+"
    r"(?P<model>[^|]+?)\s+\|\s+"
    r"(?P<latency_ms>\d+)ms\s+\|\s+"
    r"\[(?P<request_type>[^\]]+)\]"
)

ERROR_PATTERN = re.compile(
    r"(?P<timestamp>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\s+"
    r"\[error\]\s+(?P<message>.+)"
)


@dataclass
class Request:
    timestamp: str
    request_id: str
    status: str
    model_requested: str
    model_actual: str
    latency_ms: int
    request_type: str
    session_dir: str


@dataclass
class ErrorEntry:
    timestamp: str
    message: str
    session_dir: str


@dataclass
class SessionSummary:
    session_dir: str
    log_path: str
    time_range: str
    total_requests: int
    total_errors: int
    models: dict[str, int]
    request_types: dict[str, int]
    avg_latency_ms: float
    max_latency_ms: int
    p95_latency_ms: int
    long_turns: int  # > 15s
    burst_count: int  # gaps < 2s between consecutive requests
    latency_trend: str  # escalating, stable, decreasing
    requests: list[dict]
    errors: list[dict]


def parse_model_field(raw: str) -> tuple[str, str]:
    """Split 'claude-opus-4.6 -> claude-opus-4-6' into (requested, actual)."""
    raw = raw.strip()
    if " -> " in raw:
        parts = raw.split(" -> ", 1)
        return parts[0].strip(), parts[1].strip()
    return raw, raw


def parse_log_file(log_path: Path, session_dir: str) -> tuple[list[Request], list[ErrorEntry]]:
    """Extract request completions and errors from a single log file."""
    requests: list[Request] = []
    errors: list[ErrorEntry] = []

    try:
        text = log_path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return requests, errors

    for line in text.splitlines():
        m = CCREQ_PATTERN.search(line)
        if m:
            model_requested, model_actual = parse_model_field(m.group("model"))
            requests.append(
                Request(
                    timestamp=m.group("timestamp"),
                    request_id=m.group("request_id"),
                    status=m.group("status"),
                    model_requested=model_requested,
                    model_actual=model_actual,
                    latency_ms=int(m.group("latency_ms")),
                    request_type=m.group("request_type"),
                    session_dir=session_dir,
                )
            )
            continue

        em = ERROR_PATTERN.search(line)
        if em:
            errors.append(
                ErrorEntry(
                    timestamp=em.group("timestamp"),
                    message=em.group("message")[:500],
                    session_dir=session_dir,
                )
            )

    return requests, errors


def percentile(sorted_values: list[int], pct: float) -> int:
    """Return the value at the given percentile from a sorted list."""
    if not sorted_values:
        return 0
    idx = int(len(sorted_values) * pct / 100)
    return sorted_values[min(idx, len(sorted_values) - 1)]


def detect_latency_trend(requests: list[Request]) -> str:
    """Determine if latency is escalating, stable, or decreasing over the session."""
    agent_reqs = [r for r in requests if r.request_type == "panel/editAgent"]
    if len(agent_reqs) < 4:
        return "insufficient-data"

    half = len(agent_reqs) // 2
    first_half_avg = sum(r.latency_ms for r in agent_reqs[:half]) / half
    second_half_avg = sum(r.latency_ms for r in agent_reqs[half:]) / (len(agent_reqs) - half)

    ratio = second_half_avg / first_half_avg if first_half_avg > 0 else 1.0
    if ratio > 1.3:
        return "escalating"
    if ratio < 0.7:
        return "decreasing"
    return "stable"


def count_bursts(requests: list[Request]) -> int:
    """Count rapid sequential requests (gap < 2 seconds)."""
    bursts = 0
    timestamps = []
    for r in requests:
        try:
            ts = datetime.strptime(r.timestamp, "%Y-%m-%d %H:%M:%S.%f")
            timestamps.append(ts)
        except ValueError:
            continue

    for i in range(1, len(timestamps)):
        gap = (timestamps[i] - timestamps[i - 1]).total_seconds()
        if gap < 2.0:
            bursts += 1
    return bursts


def summarize_session(
    session_dir: str, log_path: str, requests: list[Request], errors: list[ErrorEntry]
) -> SessionSummary:
    """Build a session summary from parsed requests."""
    models: dict[str, int] = {}
    request_types: dict[str, int] = {}
    latencies: list[int] = []

    for r in requests:
        models[r.model_actual] = models.get(r.model_actual, 0) + 1
        request_types[r.request_type] = request_types.get(r.request_type, 0) + 1
        latencies.append(r.latency_ms)

    sorted_lat = sorted(latencies)
    time_range = ""
    if requests:
        time_range = f"{requests[0].timestamp} — {requests[-1].timestamp}"

    return SessionSummary(
        session_dir=session_dir,
        log_path=log_path,
        time_range=time_range,
        total_requests=len(requests),
        total_errors=len(errors),
        models=models,
        request_types=request_types,
        avg_latency_ms=round(sum(latencies) / len(latencies), 1) if latencies else 0,
        max_latency_ms=max(latencies) if latencies else 0,
        p95_latency_ms=percentile(sorted_lat, 95),
        long_turns=sum(1 for lat in latencies if lat > 15000),
        burst_count=count_bursts(requests),
        latency_trend=detect_latency_trend(requests),
        requests=[asdict(r) for r in requests],
        errors=[asdict(e) for e in errors],
    )


def discover_log_files(log_dir: Path) -> list[tuple[Path, str]]:
    """Find all Copilot Chat log files under the VS Code log directory."""
    results = []
    pattern = "**/GitHub.copilot-chat/GitHub Copilot Chat.log"
    for log_path in sorted(log_dir.glob(pattern)):
        session_dir = log_path.parent.parent.parent.name
        results.append((log_path, session_dir))
    return results


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Parse Copilot Chat debug logs for context optimization analysis"
    )
    parser.add_argument(
        "--log-dir",
        type=Path,
        default=Path.home() / ".vscode-server/data/logs",
        help="VS Code log directory (default: ~/.vscode-server/data/logs)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Output JSON file path (default: stdout)",
    )
    parser.add_argument(
        "--latest",
        type=int,
        default=0,
        help="Only analyze the N most recent sessions (0 = all)",
    )
    parser.add_argument(
        "--summary-only",
        action="store_true",
        help="Omit individual request details from output",
    )
    args = parser.parse_args()

    log_files = discover_log_files(args.log_dir)
    if not log_files:
        print(f"No Copilot Chat logs found under {args.log_dir}", file=sys.stderr)
        sys.exit(1)

    if args.latest > 0:
        log_files = log_files[-args.latest :]

    sessions = []
    for log_path, session_dir in log_files:
        requests, errors = parse_log_file(log_path, session_dir)
        if not requests:
            continue
        summary = summarize_session(session_dir, str(log_path), requests, errors)
        if args.summary_only:
            summary.requests = []
            summary.errors = []
        sessions.append(asdict(summary))

    output = {
        "generated": datetime.now().isoformat(),
        "log_directory": str(args.log_dir),
        "sessions_analyzed": len(sessions),
        "sessions": sessions,
    }

    text = json.dumps(output, indent=2, default=str)
    if args.output:
        args.output.write_text(text, encoding="utf-8")
        print(f"Wrote {len(sessions)} sessions to {args.output}", file=sys.stderr)
    else:
        print(text)


if __name__ == "__main__":
    main()
