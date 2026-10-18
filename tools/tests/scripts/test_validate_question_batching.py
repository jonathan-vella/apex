"""Native question batching without heading or field-name coupling."""

from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
SCRIPT = REPO_ROOT / "tools" / "scripts" / "validate_question_batching.py"
AGENT = REPO_ROOT / ".github" / "agents" / "02-requirements.agent.md"
DIRECTIVE = "Use ask_user to batch independent fields with message and requestedSchema.properties.\n"


def _load():
    spec = importlib.util.spec_from_file_location("validate_question_batching", SCRIPT)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _form():
    return {
        "message": "Provide the missing inputs",
        "requestedSchema": {
            "properties": {
                "region": {"type": "string", "title": "Region"},
                "features": {"type": "array", "title": "Features", "items": {"type": "string"}},
            },
        },
    }


def test_current_requirements_passes():
    assert _load().validate(AGENT) == []


def test_example_is_optional(tmp_path):
    fixture = tmp_path / "native.agent.md"
    fixture.write_text(DIRECTIVE)
    assert _load().validate(fixture) == []


def test_role_specific_fields_and_array_questions_pass(tmp_path):
    fixture = tmp_path / "native.agent.md"
    fixture.write_text("Use ask_user to batch independent inputs.\n```json\n" + json.dumps(_form()) + "\n```\n")
    assert _load().validate(fixture) == []


@pytest.mark.parametrize(
    "form",
    [
        {"message": "", "requestedSchema": {"properties": {}}},
        {"message": "Missing questions", "requestedSchema": {"properties": {}}},
        {"message": "Wrong properties", "requestedSchema": {"properties": []}},
        {"message": "Untyped", "requestedSchema": {"properties": {"field": {"title": "Field"}}}},
        {"message": "Untitled", "requestedSchema": {"properties": {"field": {"type": "string"}}}},
        {"message": "Bad type", "requestedSchema": {"properties": {"field": {"type": "choice", "title": "Field"}}}},
        {"message": "No items", "requestedSchema": {"properties": {"field": {"type": "array", "title": "Field"}}}},
        {"message": "Retired", "questions": [{"header": "old"}]},
    ],
)
def test_invalid_question_examples_fail(tmp_path, form):
    fixture = tmp_path / "native.agent.md"
    fixture.write_text(DIRECTIVE + "```json\n" + json.dumps(form) + "\n```\n")
    assert any("invalid ask_user example" in failure for failure in _load().validate(fixture))


def test_malformed_json_fails(tmp_path):
    fixture = tmp_path / "native.agent.md"
    fixture.write_text(DIRECTIVE + '```json\n{"message": broken}\n```\n')
    assert _load().validate(fixture)


@pytest.mark.parametrize("field", ["required", "pattern", "additionalProperties", "type"])
def test_full_json_schema_keywords_are_not_native_form_parameters(tmp_path, field):
    form = _form()
    form["requestedSchema"][field] = "unsupported"
    fixture = tmp_path / "native.agent.md"
    fixture.write_text(DIRECTIVE + "```json\n" + json.dumps(form) + "\n```\n")
    assert any("only properties" in failure for failure in _load().validate(fixture))


@pytest.mark.parametrize("field", ["pattern", "required", "minLength"])
def test_property_constraints_are_validated_by_the_parent_not_sent_to_the_tool(tmp_path, field):
    form = _form()
    form["requestedSchema"]["properties"]["region"][field] = "unsupported"
    fixture = tmp_path / "native.agent.md"
    fixture.write_text(DIRECTIVE + "```json\n" + json.dumps(form) + "\n```\n")
    assert any("unsupported native form fields" in failure for failure in _load().validate(fixture))


@pytest.mark.parametrize("fragment", ["ask_user", "message", "requestedSchema.properties", "batch independent"])
def test_missing_question_contract_fails(tmp_path, fragment):
    fixture = tmp_path / "native.agent.md"
    fixture.write_text(DIRECTIVE.replace(fragment, "removed"))
    assert _load().validate(fixture)


def test_cli_exit_codes_and_missing_path(tmp_path):
    passing = subprocess.run([sys.executable, str(SCRIPT)], capture_output=True, text=True)
    assert passing.returncode == 0, passing.stderr
    failing = subprocess.run([sys.executable, str(SCRIPT), str(tmp_path / "missing")], capture_output=True, text=True)
    assert failing.returncode == 1
