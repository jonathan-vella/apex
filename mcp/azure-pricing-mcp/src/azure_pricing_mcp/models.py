"""Domain models and type definitions for Azure Pricing MCP Server."""

from dataclasses import dataclass
from enum import Enum


class RetirementStatus(Enum):
    """VM series retirement status levels."""

    CURRENT = "current"
    PREVIOUS_GEN = "previous_gen"
    RETIREMENT_ANNOUNCED = "retirement_announced"
    RETIRED = "retired"


@dataclass
class VMSeriesRetirementInfo:
    """Information about a VM series retirement status."""

    series_name: str
    status: RetirementStatus
    retirement_date: str | None = None
    replacement: str | None = None
    migration_guide_url: str | None = None
