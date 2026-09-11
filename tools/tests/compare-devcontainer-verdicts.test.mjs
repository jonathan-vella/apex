import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { load } from "js-yaml";

import { compareVerdicts, loadVerdicts, renderMarkdown } from "../scripts/compare-devcontainer-verdicts.mjs";

function verdict(variant, arch, overrides = {}) {
  return {
    schema_version: 1,
    variant,
    expected_arch: arch,
    observed_arch: arch,
    expected_os: variant === "baseline" ? "24.04" : "26.04",
    observed_os: variant === "baseline" ? "24.04" : "26.04",
    status: "PASS",
    warnings: ["known warning"],
    checks: [],
    ...overrides,
  };
}

function passingVerdicts() {
  return [
    verdict("baseline", "amd64"),
    verdict("candidate", "amd64"),
    verdict("baseline", "arm64"),
    verdict("candidate", "arm64"),
  ];
}

describe("compareDevcontainerVerdicts", () => {
  it("passes when every leg passes and candidates add no warnings", () => {
    const summary = compareVerdicts(passingVerdicts());

    assert.equal(summary.status, "PASS");
    assert.deepEqual(summary.blockers, []);
    assert.deepEqual(summary.new_warnings, { amd64: [], arm64: [] });
  });

  it("blocks on a candidate-only warning", () => {
    const verdicts = passingVerdicts();
    verdicts[1].warnings.push("new Ubuntu 26.04 warning");

    const summary = compareVerdicts(verdicts);

    assert.equal(summary.status, "BLOCKED");
    assert.deepEqual(summary.new_warnings.amd64, ["new Ubuntu 26.04 warning"]);
    assert.match(summary.blockers.join("\n"), /new setup warning/);
  });

  it("blocks when a candidate command fails", () => {
    const verdicts = passingVerdicts();
    verdicts[3].status = "FAIL";
    verdicts[3].checks = [{ name: "terraform-validate", status: "FAIL", category: "compatibility" }];

    const summary = compareVerdicts(verdicts);

    assert.equal(summary.status, "BLOCKED");
    assert.match(summary.blockers.join("\n"), /candidate-arm64: validation status is FAIL/);
  });

  it("blocks when a baseline fails", () => {
    const verdicts = passingVerdicts();
    verdicts[0].status = "FAIL";

    const summary = compareVerdicts(verdicts);

    assert.equal(summary.status, "BLOCKED");
    assert.match(summary.blockers.join("\n"), /baseline-amd64: validation status is FAIL/);
  });

  it("blocks when a verdict is missing", () => {
    const summary = compareVerdicts(passingVerdicts().slice(0, 3));

    assert.equal(summary.status, "BLOCKED");
    assert.match(summary.blockers.join("\n"), /missing verdict for candidate-arm64/);
  });

  it("blocks when the observed architecture does not match", () => {
    const verdicts = passingVerdicts();
    verdicts[1].observed_arch = "arm64";

    const summary = compareVerdicts(verdicts);

    assert.equal(summary.status, "BLOCKED");
    assert.match(summary.blockers.join("\n"), /expected architecture amd64, observed arm64/);
  });

  it("reports malformed verdict JSON as a blocker", () => {
    const inputDir = fs.mkdtempSync(path.join(os.tmpdir(), "apex-devcontainer-verdicts-"));
    fs.mkdirSync(path.join(inputDir, "candidate-amd64"));
    fs.writeFileSync(path.join(inputDir, "candidate-amd64", "verdict.json"), "{not-json");

    const loaded = loadVerdicts(inputDir);
    const summary = compareVerdicts(loaded.verdicts, loaded.errors);

    assert.equal(loaded.verdicts.length, 0);
    assert.equal(summary.status, "BLOCKED");
    assert.match(summary.blockers.join("\n"), /malformed JSON/);
  });

  it("renders a concise Markdown result table", () => {
    const markdown = renderMarkdown(
      compareVerdicts(passingVerdicts(), [], {
        candidateImage: "example/base:26.04",
        candidateDigest: "sha256:abc",
      }),
    );

    assert.match(markdown, /Overall verdict:\*\* PASS/);
    assert.match(markdown, /example\/base:26\.04/);
    assert.match(markdown, /candidate \| arm64 \| 26\.04 \| 26\.04 \| PASS/);
  });
});

describe("devcontainer setup log contract", () => {
  const source = fs.readFileSync(new URL("../scripts/validate-devcontainer.sh", import.meta.url), "utf8");
  const boundary = "# Environment metadata and invariants.";
  assert.ok(source.includes(boundary));
  const consumer = source.slice(0, source.indexOf(boundary));

  for (const [name, log, expected] of [
    ["new success sentinel", "Setup complete.\n", 0],
    ["legacy success", "Setup complete!\n", 0],
    ["legacy warnings", "  ⚠️ optional tool (2s)\nSetup complete with warnings: 1\n", 0],
    ["legacy errors", "Setup complete with errors: 1\n", 1],
    ["later errors", "Setup complete.\nSetup complete with errors: 1\n", 1],
    ["missing log", null, 1],
    ["unfinished setup", "Installing dependencies\n", 1],
    ["embedded sentinel", "echo Setup complete.\n", 1],
    ["sentinel suffix", "Setup complete. failed\n", 1],
  ]) {
    it(name, (context) => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), "apex-setup-contract-"));
      context.after(() => fs.rmSync(root, { recursive: true, force: true }));
      if (log !== null) fs.writeFileSync(path.join(root, ".devcontainer-install.log"), log);
      const output = path.join(root, "output");
      const result = spawnSync(
        "bash",
        [
          "-s",
          "--",
          "--variant",
          "candidate",
          "--expected-os",
          "26.04",
          "--expected-arch",
          "arm64",
          "--output-dir",
          output,
        ],
        {
          input: `${consumer}\ncheck_post_create_log\n`,
          encoding: "utf8",
          env: { ...process.env, HOME: root },
        },
      );
      assert.equal(result.status, expected, result.stdout + result.stderr);
      if (log !== null) assert.equal(fs.readFileSync(path.join(output, "post-create.log"), "utf8"), log);
      if (name === "legacy warnings") {
        assert.equal(fs.readFileSync(path.join(output, "warnings.txt"), "utf8"), "optional tool\n");
      }
    });
  }
});

describe("devcontainer workflow base-image consumers", () => {
  const workflow = load(
    fs.readFileSync(new URL("../../.github/workflows/validate-devcontainer-base.yml", import.meta.url), "utf8"),
  );
  const resolve = workflow.jobs.preflight.steps.find((step) => step.id === "images").run;
  const rewrite = workflow.jobs.validate.steps.find(
    (step) => step.name === "Create repo-relative validation config",
  ).run;
  const restore = workflow.jobs.validate.steps.find(
    (step) => step.name === "Restore original dev container config",
  ).run;
  const oldImage = "mcr.microsoft.com/devcontainers/base:ubuntu-24.04";
  const newImage = "mcr.microsoft.com/devcontainers/base:ubuntu26.04";
  const buildConfig =
    '{/* image is deliberately absent */"build":{"dockerfile":"layers/Base.Dockerfile","context":"."},"features":{"example":{}},"postCreateCommand":"bash .devcontainer/post-create.sh",}';
  const imageConfig = `{/* "image": "decoy" */"nested":{"image":"decoy"},"image"\t:\n${JSON.stringify(oldImage)},}`;
  const layers =
    '\nUSER root\nRUN printf "FROM is not an instruction here"\nCOPY tools /tmp/tools\nRUN bash /tmp/tools/install.sh\n';
  const dockerfile = `FROM ${newImage}${layers}`;

  function fixture(
    context,
    config = buildConfig,
    docker = dockerfile,
    baseline = imageConfig,
    baselineDocker = dockerfile,
  ) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "apex-workflow-base-"));
    context.after(() => fs.rmSync(root, { recursive: true, force: true }));
    for (const directory of [".devcontainer/layers", "tools/scripts/_lib", "bin", "runner"]) {
      fs.mkdirSync(path.join(root, directory), { recursive: true });
    }
    fs.symlinkSync(new URL("../../node_modules", import.meta.url), path.join(root, "node_modules"));
    fs.copyFileSync(
      new URL("../scripts/_lib/parse-jsonc.mjs", import.meta.url),
      path.join(root, "tools/scripts/_lib/parse-jsonc.mjs"),
    );
    fs.writeFileSync(path.join(root, ".devcontainer/devcontainer.json"), config);
    if (docker !== null) fs.writeFileSync(path.join(root, ".devcontainer/layers/Base.Dockerfile"), docker);
    fs.writeFileSync(path.join(root, "baseline-config"), baseline);
    fs.writeFileSync(path.join(root, "baseline-dockerfile"), baselineDocker);
    fs.writeFileSync(
      path.join(root, "git-fixture.mjs"),
      String.raw`
      import fs from "node:fs";
      const args = process.argv.slice(2);
      fs.appendFileSync("git-calls.jsonl", JSON.stringify(args) + "\n");
      if (args[0] !== "show" || args.length !== 2) process.exit(99);
      const files = {
        "baseline-fixture:.devcontainer/devcontainer.json": "baseline-config",
        "baseline-fixture:.devcontainer/layers/Base.Dockerfile": "baseline-dockerfile",
      };
      if (!files[args[1]]) process.exit(98);
      process.stdout.write(fs.readFileSync(files[args[1]], "utf8"));
    `,
    );
    fs.writeFileSync(
      path.join(root, "bin/git"),
      `#!/bin/sh\nexec "${process.execPath}" "${path.join(root, "git-fixture.mjs")}" "$@"\n`,
      { mode: 0o755 },
    );
    const syntax = spawnSync(process.execPath, ["--check", path.join(root, "git-fixture.mjs")], { encoding: "utf8" });
    assert.equal(syntax.status, 0, syntax.stderr);
    return {
      root,
      read(file) {
        return fs.readFileSync(path.join(root, file), "utf8");
      },
      run(script, env = {}) {
        return spawnSync("bash", ["--noprofile", "--norc", "-e", "-o", "pipefail", "-c", script], {
          cwd: root,
          encoding: "utf8",
          env: {
            ...process.env,
            PATH: `${path.join(root, "bin")}:${process.env.PATH}`,
            DEVCONTAINER_BASE_SCRIPT: workflow.env.DEVCONTAINER_BASE_SCRIPT,
            RUNNER_TEMP: path.join(root, "runner"),
            GITHUB_OUTPUT: path.join(root, "outputs"),
            EVENT_NAME: "pull_request",
            BASE_SHA: "baseline-fixture",
            SELECTED_IMAGE: oldImage,
            ...env,
          },
        });
      },
    };
  }

  it("resolves an image baseline and build candidate from the actual PR consumer", (context) => {
    const setup = fixture(context);
    const result = setup.run(resolve);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      setup.read("outputs"),
      `baseline_image=${oldImage}\nbaseline_os=24.04\ncandidate_image=${newImage}\ncandidate_os=26.04\n`,
    );
    assert.deepEqual(setup.read("git-calls.jsonl").trim().split("\n").map(JSON.parse), [
      ["show", "baseline-fixture:.devcontainer/devcontainer.json"],
    ]);
  });

  it("reads a build baseline Dockerfile from the base revision, not the checkout", (context) => {
    const setup = fixture(context, buildConfig, dockerfile, buildConfig, `FROM ${oldImage}${layers}`);
    const result = setup.run(resolve);
    assert.equal(result.status, 0, result.stderr);
    assert.match(setup.read("outputs"), new RegExp(`baseline_image=${oldImage}\\nbaseline_os=24.04`));
    assert.deepEqual(setup.read("git-calls.jsonl").trim().split("\n").map(JSON.parse), [
      ["show", "baseline-fixture:.devcontainer/devcontainer.json"],
      ["show", "baseline-fixture:.devcontainer/layers/Base.Dockerfile"],
    ]);
  });

  it("preserves JSONC comments and nested image values when rewriting an image config", (context) => {
    const setup = fixture(context, imageConfig);
    const result = setup.run(rewrite, { SELECTED_IMAGE: newImage });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      setup.read(".devcontainer/devcontainer.json"),
      imageConfig.replace(JSON.stringify(oldImage), JSON.stringify(newImage)),
    );
    assert.equal(setup.run(restore).status, 0);
    assert.equal(setup.read(".devcontainer/devcontainer.json"), imageConfig);
  });

  for (const selected of [oldImage, newImage, "ubuntu:25.10"]) {
    it(`rewrites only FROM and restores custom layers for ${selected}`, (context) => {
      const setup = fixture(context);
      const result = setup.run(rewrite, { SELECTED_IMAGE: selected });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(setup.read(".devcontainer/devcontainer.json"), buildConfig);
      assert.equal(setup.read(".devcontainer/layers/Base.Dockerfile"), `FROM ${selected}${layers}`);
      assert.equal(setup.run(restore).status, 0);
      assert.equal(setup.read(".devcontainer/layers/Base.Dockerfile"), dockerfile);
    });
  }

  it("preserves FROM platform, stage alias, casing and CRLF", (context) => {
    const original = `  from --platform=$BUILDPLATFORM ${newImage} AS base\r\nRUN true\r\n`;
    const setup = fixture(context, buildConfig, original);
    const result = setup.run(rewrite);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(setup.read(".devcontainer/layers/Base.Dockerfile"), original.replace(newImage, oldImage));
  });

  it("keeps dispatch inputs while extracting an official Ubuntu build baseline", (context) => {
    const setup = fixture(context, buildConfig, `FROM ubuntu:25.10${layers}`);
    const result = setup.run(resolve, {
      EVENT_NAME: "workflow_dispatch",
      INPUT_CANDIDATE_IMAGE: newImage,
      INPUT_CANDIDATE_OS: "26.04",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      setup.read("outputs"),
      `baseline_image=ubuntu:25.10\nbaseline_os=25.10\ncandidate_image=${newImage}\ncandidate_os=26.04\n`,
    );
  });

  for (const [name, config, docker] of [
    ["missing base", "{}", dockerfile],
    ["conflicting sources", '{"image":"ubuntu:24.04","build":{"dockerfile":"Dockerfile"}}', dockerfile],
    ["malformed JSONC", '{"build":', dockerfile],
    ["missing Dockerfile", buildConfig, null],
    ["ARG base", buildConfig, "ARG BASE=ubuntu:24.04\nFROM ${BASE}\n"],
    ["multiple stages", buildConfig, "FROM ubuntu:24.04 AS base\nFROM base\n"],
    ["no FROM", buildConfig, "RUN true\n"],
    ["outside repository", '{"build":{"dockerfile":"../../external"}}', dockerfile],
  ]) {
    it(`fails extraction and rewrite closed for ${name}`, (context) => {
      const setup = fixture(context, config, docker);
      assert.notEqual(setup.run(resolve).status, 0);
      assert.notEqual(setup.run(rewrite).status, 0);
      assert.equal(setup.read(".devcontainer/devcontainer.json"), config);
      if (docker !== null) assert.equal(setup.read(".devcontainer/layers/Base.Dockerfile"), docker);
    });
  }

  it("fails unresolved Ubuntu versions rather than successfully skipping validation", (context) => {
    const setup = fixture(context, buildConfig, `FROM ubuntu:latest${layers}`);
    assert.notEqual(setup.run(resolve).status, 0);
    assert.equal(fs.existsSync(path.join(setup.root, "outputs")), false);
  });

  it("retains native dual architecture, same-repository PR and fail-closed CI gates", () => {
    const legs = workflow.jobs.validate.strategy.matrix.include;
    assert.deepEqual(legs.map(({ variant, arch }) => `${variant}-${arch}`).sort(), [
      "baseline-amd64",
      "baseline-arm64",
      "candidate-amd64",
      "candidate-arm64",
    ]);
    assert.ok(legs.filter(({ arch }) => arch === "arm64").every(({ runner }) => runner.endsWith("-arm")));
    assert.match(workflow.jobs.preflight.if, /head\.repo\.full_name == github\.repository/);
    for (const job of [workflow.jobs.preflight, workflow.jobs.validate]) {
      const setupIndex = job.steps.findIndex((step) => step.uses === "./.github/actions/setup-node-repo");
      const consumerIndex = job.steps.findIndex((step) => step.run?.includes("$DEVCONTAINER_BASE_SCRIPT"));
      assert.ok(setupIndex >= 0 && setupIndex < consumerIndex, "parser dependencies must be installed before use");
    }
    const build = workflow.jobs.validate.steps.find((step) => step.uses === "devcontainers/ci@v0.3");
    assert.equal(build["continue-on-error"], undefined);
    assert.equal(build.with.push, "never");
    assert.equal(build.with.useNativeRunner, true);
    assert.match(build.with.runCmd, /bash tools\/scripts\/validate-devcontainer\.sh/);
    const gate = workflow.jobs.compare.steps.find((step) => step.name === "Enforce fail-closed verdict");
    assert.match(gate.if, /needs\.preflight\.result != 'success'/);
    assert.match(gate.if, /needs\.validate\.result != 'success'/);
    assert.match(gate.if, /steps\.comparison\.outcome != 'success'/);
    assert.equal(gate.run, "exit 1");
  });
});
