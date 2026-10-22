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
                "features": {"type": "array", "title": "Features", "items": {"type": "string", "enum": ["A", "B"]}},
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


def test_native_rich_choices_and_suggested_defaults_are_supported():
    form = _form()
    form["requestedSchema"]["properties"]["region"] = {
        "type": "string",
        "title": "Region",
        "oneOf": [{"const": "swedencentral", "title": "Sweden Central"}],
        "default": "swedencentral",
    }
    form["requestedSchema"]["properties"]["features"] = {
        "type": "array",
        "title": "Features",
        "items": {"type": "string", "anyOf": [{"const": "A", "title": "Option A"}]},
        "default": ["A"],
    }
    _load()._validate_example(form)


def test_delegated_form_rejects_full_schema_wrapper_observed_in_cli_output():
    form = _form()
    form.update(status="USER_INPUT_REQUIRED", request_id="fictional-business-001", needed_inputs=["region", "features"])
    form["requestedSchema"].update(type="object", required=["region", "features"])
    with pytest.raises(ValueError, match="supports only properties"):
        _load()._validate_example(form)


@pytest.mark.parametrize(
    "field",
    [
        {"type": "object", "title": "Unsupported object"},
        {"type": "string", "title": "Broken labels", "enum": ["A", "B"], "enumNames": ["Only one"]},
        {"type": "string", "title": "Ambiguous", "enum": ["A"], "oneOf": [{"const": "A", "title": "A"}]},
        {"type": "array", "title": "No choices", "items": {"type": "string"}},
        {"type": "string", "title": "Bad choice", "oneOf": [{"const": "A"}]},
    ],
)
def test_invalid_native_choice_shapes_are_rejected(field):
    form = _form()
    form["requestedSchema"]["properties"]["region"] = field
    with pytest.raises(ValueError):
        _load()._validate_example(form)


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


def _review_form() -> dict:
    return {
        "message": "Choose a disposition or enter custom guidance in the finding field.",
        "requestedSchema": {
            "properties": {
                "requirements-pass1-abc12345": {
                    "type": "string",
                    "title": "Availability measurement window",
                    "oneOf": [
                        {"const": "accept", "title": "Accept (apply mitigation)"},
                        {"const": "reject", "title": "Reject (do not apply)"},
                        {"const": "defer", "title": "Defer (carry to handoff)"},
                        {"const": "edit", "title": "Edit (custom guidance)"},
                    ],
                }
            }
        },
    }


def test_observed_review_form_with_repeated_clarification_fields_is_rejected() -> None:
    properties = {}
    for index in range(1, 5):
        properties[f"f{index}"] = {
            "type": "string",
            "title": f"Finding {index}",
            "enum": ["Accept", "Reject", "Defer", "Edit"],
        }
        properties[f"f{index}_note"] = {"type": "string", "title": "Clarifying answer / note"}
    with pytest.raises(ValueError, match="duplicate question title|redundant companion"):
        _load()._validate_example({"message": "Review findings", "requestedSchema": {"properties": properties}})


@pytest.mark.parametrize("suffix", ["_note", "_notes", "-note", "-guidance", "_clarification"])
@pytest.mark.parametrize("choice_format", ["oneOf", "enum"])
def test_review_companion_fields_are_rejected_even_with_distinct_titles(suffix: str, choice_format: str) -> None:
    form = _review_form()
    properties = form["requestedSchema"]["properties"]
    key = next(iter(properties))
    if choice_format == "enum":
        properties[key]["enum"] = [choice["title"] for choice in properties[key].pop("oneOf")]
    properties[key + suffix] = {"type": "string", "title": "Extra availability guidance"}
    with pytest.raises(ValueError, match="redundant companion"):
        _load()._validate_example(form)


def test_one_field_per_finding_and_separate_targeted_followups_are_valid() -> None:
    form = _review_form()
    original = json.dumps(form, sort_keys=True)
    _load()._validate_example(form)
    assert json.dumps(form, sort_keys=True) == original
    followups = {
        "message": "Provide guidance for the findings where you selected Edit without guidance.",
        "requestedSchema": {
            "properties": {
                "requirements-pass1-abc12345_note": {
                    "type": "string",
                    "title": "Custom guidance: availability measurement window",
                },
                "requirements-pass1-def67890_note": {
                    "type": "string",
                    "title": "Custom guidance: recovery scope",
                },
            }
        },
    }
    _load()._validate_example(followups)


def test_repeated_followup_titles_are_rejected_after_normalizing_case_and_whitespace() -> None:
    form = _form()
    form["requestedSchema"]["properties"] = {
        "f1_note": {"type": "string", "title": "Clarifying answer / note"},
        "f2_note": {"type": "string", "title": "  CLARIFYING   answer / note  "},
    }
    with pytest.raises(ValueError, match="duplicate question title"):
        _load()._validate_example(form)


@pytest.mark.parametrize(
    "field",
    [
        {"type": "string", "title": "Region", "enum": ["Sweden Central", "West Europe"]},
        {"type": "string", "title": "Region", "oneOf": [{"const": "se", "title": "Sweden Central"}]},
        {"type": "string", "title": "Project name"},
        {"type": "integer", "title": "Volunteer count"},
        {"type": "number", "title": "Monthly budget"},
        {"type": "boolean", "title": "Enable notifications"},
        {"type": "array", "title": "Environments", "items": {"type": "string", "enum": ["dev", "prod"]}},
    ],
)
def test_companion_notes_are_rejected_for_every_native_question_type(field: dict) -> None:
    form = _form()
    form["requestedSchema"]["properties"] = {
        "input": field,
        "input_note": {"type": "string", "title": "Additional guidance for this input"},
    }
    with pytest.raises(ValueError, match="redundant companion"):
        _load()._validate_example(form)


def test_distinct_discovery_questions_and_triggered_followups_remain_supported() -> None:
    form = _form()
    form["requestedSchema"]["properties"]["regional_constraints"] = {
        "type": "string",
        "title": "Data residency constraints",
    }
    form["requestedSchema"]["properties"]["notes"] = {"type": "string", "title": "Other deployment constraints"}
    _load()._validate_example(form)
    form["requestedSchema"]["properties"] = {
        "region_note": {"type": "string", "title": "Clarify the requested failover geography"}
    }
    _load()._validate_example(form)


def test_form_cli_validates_payloads_without_echoing_answers(tmp_path: Path) -> None:
    form_path = tmp_path / "review-form.json"

    def run(*args: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, str(SCRIPT), "--form", str(form_path), *args], capture_output=True, text=True
        )

    form_path.write_text(json.dumps(_review_form()))
    passing = run()
    assert passing.returncode == 0, passing.stderr
    assert "native form valid" in passing.stdout
    assert "Availability measurement window" not in passing.stdout + passing.stderr
    assert list(tmp_path.iterdir()) == [form_path]
    invalid = _review_form()
    key = next(iter(invalid["requestedSchema"]["properties"]))
    invalid["requestedSchema"]["properties"][key + "_note"] = {"type": "string", "title": "Extra guidance"}
    form_path.write_text(json.dumps(invalid))
    failing = run()
    assert failing.returncode == 1
    assert "redundant companion" in failing.stderr
    for content in ["{", "null", "{}"]:
        form_path.write_text(content)
        assert run().returncode == 1
    envelope = _review_form()
    envelope.update(status="USER_INPUT_REQUIRED", request_id="requirements-review")
    form_path.write_text(json.dumps(envelope))
    assert run().returncode == 1
    form_path.unlink()
    assert run().returncode == 1
    assert run(str(AGENT)).returncode == 2


@pytest.mark.parametrize("fragment", ["ask_user", "message", "requestedSchema.properties", "batch independent"])
def test_missing_question_contract_fails(tmp_path, fragment):
    fixture = tmp_path / "native.agent.md"
    fixture.write_text(DIRECTIVE.replace(fragment, "removed"))
    assert _load().validate(fixture)


def test_context_rejects_renamed_guidance_until_literal_edit_is_captured() -> None:
    module = _load()
    form = {
        "message": "Resolve the requested custom guidance",
        "requestedSchema": {"properties": {"edit_guidance": {"type": "string", "title": "Availability guidance"}}},
    }
    context = {
        "answers": {},
        "fields": {
            "edit_guidance": {
                "input_id": "availability_guidance",
                "kind": "follow_up",
                "when": {"input_id": "availability", "equals": "edit"},
            }
        },
    }
    assert module.validate_payload(form) == []
    assert module.validate_payload(form, context)
    context["answers"]["availability"] = "Use a 24x7 measurement window"
    assert module.validate_payload(form, context)
    context["answers"]["availability"] = "edit"
    assert module.validate_payload(form, context, require_context=True) == []
    context["answers"]["availability_guidance"] = "Use a 24x7 window"
    assert module.validate_payload(form, context)


def test_context_preserves_independent_notes_and_rejects_duplicate_material_inputs() -> None:
    form = _form()
    form["requestedSchema"]["properties"] = {
        "region": {"type": "string", "title": "Deployment region"},
        "region_note": {"type": "string", "title": "Data residency constraint"},
    }
    context = {
        "answers": {},
        "fields": {
            "region": {"input_id": "region", "kind": "input"},
            "region_note": {"input_id": "data_residency", "kind": "input"},
        },
    }
    assert _load().validate_payload(form, context, require_context=True) == []
    context["fields"]["region_note"]["input_id"] = "region"
    assert any("duplicates material" in error for error in _load().validate_payload(form, context))


@pytest.mark.parametrize("answer", [0, False, "Not sure", ["dev"]])
def test_context_reuses_captured_values_without_treating_false_or_zero_as_missing(answer: object) -> None:
    form = {
        "message": "Missing input",
        "requestedSchema": {"properties": {"value": {"type": "string", "title": "Value"}}},
    }
    context = {"answers": {"value": answer}, "fields": {"value": {"input_id": "value", "kind": "input"}}}
    assert any("already answered" in error for error in _load().validate_payload(form, context))


@pytest.mark.parametrize("answer", ["", " ", "\t\n", "\u00a0"])
def test_whitespace_only_answers_remain_missing_for_discovery_and_preflight(answer: str) -> None:
    form = {
        "message": "Provide the missing industry",
        "requestedSchema": {"properties": {"industry": {"type": "string", "title": "Industry"}}},
    }
    context = {"answers": {"industry": answer}, "fields": {"industry": {"input_id": "industry", "kind": "input"}}}
    assert _load().validate_payload(form, context, require_context=True) == []


def test_context_checks_branch_choice_and_approval_defaults(tmp_path: Path) -> None:
    form = _form()
    form["requestedSchema"]["properties"] = {"existing": {"type": "string", "title": "Existing VNet resource"}}
    context = {
        "answers": {"vnet_mode": "create-new"},
        "fields": {
            "existing": {
                "input_id": "existing_vnet",
                "kind": "input",
                "when": {"input_id": "vnet_mode", "equals": "existing"},
            }
        },
    }
    assert _load().validate_payload(form, context)
    context["answers"]["vnet_mode"] = "existing"
    assert _load().validate_payload(form, context) == []
    context["fields"]["existing"] = {"input_id": "approval", "kind": "approval"}
    form["requestedSchema"]["properties"]["existing"]["default"] = "Approve"
    assert any("cannot preselect" in error for error in _load().validate_payload(form, context))
    assert _load().validate_payload(_form(), require_context=True)
    context["fields"] = {}
    assert _load().validate_payload(form, context)


def test_context_cli_requires_explicit_context_and_keeps_it_out_of_native_payload(tmp_path: Path) -> None:
    form_path, context_path = tmp_path / "form.json", tmp_path / "context.json"
    form_path.write_text(json.dumps(_form()))
    context_path.write_text(
        json.dumps(
            {
                "answers": {},
                "fields": {key: {"input_id": key, "kind": "input"} for key in _form()["requestedSchema"]["properties"]},
            }
        )
    )
    command = [sys.executable, str(SCRIPT), "--form", str(form_path), "--require-context"]
    assert subprocess.run(command, capture_output=True).returncode == 1
    result = subprocess.run([*command, "--context", str(context_path)], capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
    assert "explicit applicability" in result.stdout


def test_cli_exit_codes_and_missing_path(tmp_path):
    passing = subprocess.run([sys.executable, str(SCRIPT)], capture_output=True, text=True)
    assert passing.returncode == 0, passing.stderr
    failing = subprocess.run([sys.executable, str(SCRIPT), str(tmp_path / "missing")], capture_output=True, text=True)
    assert failing.returncode == 1
