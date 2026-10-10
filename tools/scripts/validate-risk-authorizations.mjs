#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Reporter } from "./_lib/reporter.mjs";

export function validateProject(root, project, invoke = spawnSync) {
  const statePath = path.join(root, "agent-output", project, "00-session-state.json");
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  const exceptionMarker =
    state.decisions?.plan_status === "EXCEPTION_AUTHORIZED" ||
    state.decision_log?.some((entry) => entry.choice === "EXCEPTION_AUTHORIZED");
  if (exceptionMarker && (!state.risk_authorizations || !Object.keys(state.risk_authorizations).length))
    return ["Exception-authorized state lacks preserved risk authorization history"];
  if (state.risk_authorizations === undefined) return [];
  if (
    !state.risk_authorizations ||
    typeof state.risk_authorizations !== "object" ||
    Array.isArray(state.risk_authorizations)
  )
    return ["Invalid risk authorization map"];
  const errors = [];
  if (!Object.keys(state.risk_authorizations).length) return errors;
  const active = String(state.current_step);
  const status = state.steps?.[active]?.status;
  const action =
    active === "4" && ["in_progress", "complete"].includes(status)
      ? "plan-complete"
      : active === "5" && status === "in_progress"
        ? "codegen"
        : active === "5" && status === "complete"
          ? "code-complete"
          : active === "6" && status === "in_progress"
            ? "deploy"
            : (active === "6" && status === "complete") || (active === "7" && state.steps?.[6]?.status === "complete")
              ? "deployment-complete"
              : null;
  if (!action) return ["Exception workflow has unsupported active step/status; explicit owner recovery required"];
  const actions = new Set([action]);
  for (const action of actions) {
    const result = invoke("apex-recall", ["check-gate", project, "--action", action, "--json"], {
      cwd: root,
      env: { ...process.env, APEX_ROOT: root },
      encoding: "utf8",
      timeout: 30000,
    });
    if (result.error || result.status !== 0)
      errors.push(
        `${action}: authorization/runtime validation failed: ${result.error?.message || result.stdout || result.stderr}`,
      );
  }
  return errors;
}

export function main(argv = process.argv.slice(2)) {
  const reporter = new Reporter("Risk Authorization Validator");
  const root = process.cwd();
  const directory = path.join(root, "agent-output");
  const projects = argv.length
    ? argv
    : fs.existsSync(directory)
      ? fs
          .readdirSync(directory)
          .filter(
            (name) =>
              fs.lstatSync(path.join(directory, name)).isDirectory() &&
              fs.existsSync(path.join(directory, name, "00-session-state.json")),
          )
      : [];
  for (const project of projects) {
    try {
      if (!/^[a-zA-Z0-9_-]+$/.test(project)) throw new Error("Invalid project identity");
      for (const error of validateProject(root, project)) reporter.warn(project, `${error} (warning only)`);
    } catch (error) {
      reporter.warn(project, `${error.message} (warning only)`);
    }
  }
  reporter.summary();
  return reporter.errors ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main();
