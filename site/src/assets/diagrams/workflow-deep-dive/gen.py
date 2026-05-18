"""Workflow Deep-Dive — end-to-end orchestration and lessons-feedback diagrams.

Generates two PNGs alongside this script:

- ``e2e-orchestration.png`` — agents, subagents, gates, artifacts across
  Steps 1 → 7 of the APEX workflow.
- ``lessons-loop.png`` — feedback loop between ``09-lessons-learned`` and
  the next run's Orchestrator init.

Usage::

    python3 site/src/assets/diagrams/workflow-deep-dive/gen.py

Source of truth: ``.github/skills/workflow-engine/templates/workflow-graph.json``.
This script renders an abstract, project-agnostic view — never a specific
``agent-output/{project}/`` run.
"""

from pathlib import Path

from diagrams import Cluster, Diagram, Edge
from diagrams.azure.devops import Pipelines
from diagrams.azure.general import Helpsupport, Resource, Templates
from diagrams.azure.managementgovernance import Policy
from diagrams.azure.web import AppServices  # noqa: F401  (kept for future use)
from diagrams.generic.blank import Blank
from diagrams.generic.storage import Storage
from diagrams.onprem.client import User

OUT_DIR = Path(__file__).resolve().parent

graph_attr = {
    "bgcolor": "#F8F9FA",
    "pad": "1.0",
    "nodesep": "0.6",
    "ranksep": "0.9",
    "splines": "spline",
    "fontname": "Arial Bold",
    "fontsize": "18",
    "dpi": "140",
    "labelloc": "t",
}

node_attr = {
    "fontname": "Arial",
    "fontsize": "10",
}


def _agent(name: str) -> Pipelines:
    return Pipelines(name)


def _gate(name: str) -> Helpsupport:
    return Helpsupport(name)


def _artifact(name: str) -> Storage:
    return Storage(name)


def _data(name: str) -> Templates:
    return Templates(name)


# ---------------------------------------------------------------------------
# Diagram 1 — End-to-end orchestration
# ---------------------------------------------------------------------------
with Diagram(
    "APEX Workflow — End-to-End Orchestration",
    show=False,
    direction="TB",
    filename=str(OUT_DIR / "e2e-orchestration"),
    graph_attr=graph_attr,
    node_attr=node_attr,
):
    human = User("Human approver")

    with Cluster("Shared context surfaces"):
        recall = _data("apex-recall\n(session state)")
        skills = _data("Skills + Instructions\n(auto-loaded)")
        registries = _data(".github/data/\nAVM • deprecations • policy")
        lessons_store = Storage("09-lessons-learned\n(prior runs)")

    with Cluster("Step 1 — Requirements"):
        a1 = _agent("02-Requirements")
        g1 = _gate("gate-1")
        art1 = _artifact("01-requirements.md\nsku-manifest rev 1")

    with Cluster("Step 2 — Architecture"):
        a2 = _agent("03-Architect")
        cost = _agent("cost-estimate\nsubagent")
        g2 = _gate("gate-2")
        art2 = _artifact("02-architecture-assessment\n03-des-cost-estimate")

    with Cluster("Step 3 — Design (optional)"):
        a3 = _agent("04-Design")
        art3 = _artifact("03-des-diagram.drawio\n03-des-adr-*.md")

    with Cluster("Step 3.5 — Governance"):
        a35 = _agent("04g-Governance")
        disc = _agent("discover.py")
        g25 = _gate("gate-2.5")
        art35 = _artifact("04-governance-constraints\n.md + .json")

    with Cluster("Step 4 — IaC Plan"):
        a4 = _agent("05-IaC Planner")
        g3 = _gate("gate-3")
        art4 = _artifact("04-implementation-plan\n04-iac-contract.json")

    with Cluster("Step 5 — Code Generation"):
        a5b = _agent("06b-Bicep\nCodeGen")
        a5t = _agent("06t-Terraform\nCodeGen")
        val = _agent("validate\nsubagents")
        g4 = _gate("gate-4")
        art5 = _artifact("infra/bicep|terraform\n05-iac-handoff.json")

    with Cluster("Step 6 — Deploy"):
        a6b = _agent("07b-Bicep\nDeploy")
        a6t = _agent("07t-Terraform\nDeploy")
        pre = _agent("policy-precheck\nwhatif / plan")
        g5 = _gate("gate-5")
        art6 = _artifact("06-deployment-summary\n06-policy-precheck.json")

    with Cluster("Step 7 — As-Built"):
        a7 = _agent("08-As-Built")
        art7 = _artifact("07-* docs\n(parallel fan-out)")

    with Cluster("Challenger lane"):
        ch = _agent("10-Challenger\n(adversarial review)")

    # Cross-cutting context
    for sink in (a1, a2, a3, a35, a4, a5b, a5t, a6b, a6t, a7):
        skills >> Edge(style="dotted", color="#888") >> sink
        recall >> Edge(style="dotted", color="#888") >> sink
    registries >> Edge(style="dotted", color="#0078d4") >> a2
    registries >> Edge(style="dotted", color="#0078d4") >> a4
    registries >> Edge(style="dotted", color="#0078d4") >> a35
    lessons_store >> Edge(style="dashed", color="#6f42c1", label="seeds next run") >> a1

    # Main flow
    a1 >> art1 >> g1 >> a2
    a2 >> cost >> art2
    a2 >> art2 >> g2 >> a3
    g2 >> a35
    a3 >> art3 >> a35
    a35 >> disc >> art35
    a35 >> art35 >> g25 >> a4
    a4 >> art4 >> g3
    g3 >> a5b
    g3 >> a5t
    a5b >> val
    a5t >> val
    val >> art5 >> g4
    g4 >> a6b
    g4 >> a6t
    a6b >> pre
    a6t >> pre
    pre >> art6 >> g5 >> a7 >> art7

    # Human gates
    human >> Edge(color="#1f883d", label="approves") >> g1
    human >> Edge(color="#1f883d") >> g2
    human >> Edge(color="#1f883d") >> g25
    human >> Edge(color="#1f883d") >> g3
    human >> Edge(color="#1f883d") >> g5

    # Challenger fan-out (mandatory at 1, 2, 4 + governance-reconciliation at 3.5)
    a1 >> Edge(style="dashed", color="#d4351c", label="single-pass") >> ch
    a2 >> Edge(style="dashed", color="#d4351c") >> ch
    a35 >> Edge(style="dashed", color="#d4351c", label="reconciliation") >> ch
    a4 >> Edge(style="dashed", color="#d4351c") >> ch
    ch >> Edge(style="dashed", color="#d4351c", label="findings") >> recall

    # Lessons capture
    a7 >> Edge(style="dashed", color="#6f42c1", label="appends") >> lessons_store


# ---------------------------------------------------------------------------
# Diagram 2 — Lessons-learned feedback loop
# ---------------------------------------------------------------------------
with Diagram(
    "APEX Lessons-Learned Feedback Loop",
    show=False,
    direction="LR",
    filename=str(OUT_DIR / "lessons-loop"),
    graph_attr=graph_attr,
    node_attr=node_attr,
):
    orch = _agent("01-Orchestrator\n(init)")
    run = _agent("Workflow execution\n(Steps 1 → 7)")
    triggers = Blank("Triggers:\n• challenger must_fix\n• user rejection\n• validator NEEDS_REVISION\n• policy violation")
    lessons = Storage("09-lessons-learned\n.json + .md")
    recall_dec = _data("apex-recall\ndecisions + findings")
    next_run = _agent("Next project\n01-Orchestrator init")
    checklists = _data("lessons-to-checklists\n(report:challenger-gaps)")

    orch >> Edge(label="init() creates") >> lessons
    orch >> run
    run >> Edge(style="dashed", color="#d4351c") >> triggers
    triggers >> Edge(label="append") >> lessons
    run >> Edge(style="dotted") >> recall_dec
    recall_dec >> Edge(style="dotted", label="reinforce") >> lessons
    lessons >> Edge(label="query at init", color="#6f42c1") >> next_run
    lessons >> Edge(label="distill", color="#0078d4") >> checklists
    checklists >> Edge(label="harden challenger lenses", color="#0078d4") >> run

print(f"Wrote diagrams to {OUT_DIR}")
