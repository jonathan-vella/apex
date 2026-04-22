"""Type definitions for apex-recall."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class IndexedArtifact:
    """A single indexed artifact from agent-output."""

    project: str
    step: str
    file_path: str
    artifact_type: str
    modified_time: float
    content: str


@dataclass
class SessionInfo:
    """Summary of a project session from session-state JSON."""

    project: str
    current_step: int
    status: str
    iac_tool: str
    region: str
    updated: str
    complexity: str
    file_path: str


@dataclass
class DecisionEntry:
    """A single decision from a session's decision log."""

    project: str
    step: str
    decision: str
    rationale: str
    timestamp: str


@dataclass
class HealthReport:
    """Health check results for the apex-recall index."""

    db_exists: bool
    db_size_bytes: int
    total_artifacts: int
    total_projects: int
    index_mtime: float
    agent_output_mtime: float
    stale: bool
    projects: list[str] = field(default_factory=list)
    schema_ok: bool = True
    error: str = ""
