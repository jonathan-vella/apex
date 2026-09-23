import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { changelogSince, latestTag } from "../../scripts/report-upstream-skill-drift.mjs";

const script = fileURLToPath(new URL("../../scripts/report-upstream-skill-drift.mjs", import.meta.url));
const plugin = ".github/plugins/azure-skills";

function git(cwd, ...args) {
  const result = spawnSync(
    "git",
    ["-c", "user.name=fixture", "-c", "user.email=fixture@example.com", "-c", "commit.gpgsign=false", ...args],
    { cwd, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function write(root, file, content) {
  mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  writeFileSync(path.join(root, file), content);
}

function fixture(context) {
  const root = mkdtempSync(path.join(tmpdir(), "upstream-drift-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const upstream = path.join(root, "upstream");
  mkdirSync(upstream);
  git(upstream, "init", "-q");
  write(upstream, `${plugin}/CHANGELOG.md`, "# Changelog\n\n## 1.0.0\n\n- feat: first release\n");
  write(upstream, `${plugin}/skills/azure-demo/SKILL.md`, "demo\n");
  write(upstream, `${plugin}/skills/azure-demo/references/guide.md`, 'Remove-Item -Path "temp" -Recurse\n');
  write(upstream, `${plugin}/skills/azure-old/SKILL.md`, "old\n");
  git(upstream, "add", "-A");
  git(upstream, "commit", "-q", "-m", "first");
  git(upstream, "tag", "v1.0.0");
  const reviewed = git(upstream, "rev-parse", "HEAD");
  write(
    upstream,
    `${plugin}/CHANGELOG.md`,
    "# Changelog\n\n## 1.1.0\n\n- fix: drop temp cleanup\n\n## 1.0.0\n\n- feat: first release\n",
  );
  write(upstream, `${plugin}/skills/azure-demo/references/guide.md`, "Clean up only files you created.\n");
  write(upstream, `${plugin}/skills/azure-demo/notes.md`, "not imported\n");
  write(upstream, `${plugin}/skills/azure-new/SKILL.md`, "new\n");
  git(upstream, "rm", "-q", "-r", `${plugin}/skills/azure-old`);
  git(upstream, "add", "-A");
  git(upstream, "commit", "-q", "-m", "second");
  git(upstream, "tag", "v1.1.0");
  git(upstream, "tag", "not-a-release");

  const manifest = path.join(root, "pins.json");
  writeFileSync(
    manifest,
    JSON.stringify({
      upstream: {
        repository: "fixture/azure-skills",
        plugin_path: `${plugin}/skills`,
        reviewed: { tag: "v1.0.0", commit: reviewed },
      },
      skills: [
        {
          apex: "apex-azure-demo",
          upstream: ["azure-demo"],
          status: "fork",
          imports: [{ from: "azure-demo/references/", to: "references/" }],
        },
      ],
      defect_probes: [
        { id: "SK-99", path: "azure-demo/references/guide.md", pattern: "Remove-Item -Path", defect: "Deletes temp" },
      ],
    }),
  );
  const run = (...args) =>
    spawnSync(process.execPath, [script, "--manifest", manifest, "--repo", `file://${upstream}`, ...args], {
      cwd: root,
      encoding: "utf8",
    });
  return { root, run };
}

test("latestTag picks the highest release tag and ignores other refs", () => {
  const refs = ["a\trefs/tags/v1.9.9", "b\trefs/tags/v1.10.0", "c\trefs/tags/latest", "d\trefs/tags/v2.0.0-rc1"];
  assert.equal(latestTag(refs.join("\n")), "v1.10.0");
  assert.equal(latestTag(""), null);
});

test("changelogSince keeps only releases after the reviewed tag", () => {
  const changelog = "# Changelog\n\n## 1.2.0\n\n- c\n\n## 1.1.0\n\n- b\n\n## 1.0.0\n\n- a\n";
  assert.deepEqual(changelogSince(changelog, "v1.0.0", "v1.1.0"), ["## 1.1.0", "- b"]);
});

test("drift report compares pinned and latest trees offline and flags imports and probes", (context) => {
  const { root, run } = fixture(context);
  const result = run("--output", "out/drift.md", "--fail-on-drift");
  assert.equal(result.status, 1, result.stderr);
  const report = readFileSync(path.join(root, "out/drift.md"), "utf8");
  assert.match(report, /\| Latest tag \| v1\.1\.0 /);
  assert.match(report, /- fix: drop temp cleanup/);
  assert.match(report, /\| M \| `azure-demo\/references\/guide\.md` \| yes \|/);
  assert.match(report, /\| A \| `azure-demo\/notes\.md` \| no \|/);
  assert.match(report, /\| `azure-new` \| new \| no \|/);
  assert.match(report, /\| `azure-old` \| retired \| no \|/);
  assert.match(report, /\| SK-99 \| `azure-demo\/references\/guide\.md` \| fixed upstream \|/);
  assert.doesNotMatch(report, /Tag v1\.0\.0 now points/);

  const json = JSON.parse(run("--json").stdout);
  assert.equal(json.drift, true);
  assert.equal(json.skills[0].changes.length, 2);
});

test("drift report skips the clone when no newer tag exists and never writes under .github/skills", (context) => {
  const { root, run } = fixture(context);
  const current = run("--tag", "v1.0.0", "--fail-on-drift");
  assert.equal(current.status, 0, current.stderr);
  assert.match(current.stdout, /No upstream tag is newer than v1\.0\.0\./);

  const guarded = run("--output", ".github/skills/drift.md");
  assert.equal(guarded.status, 2);
  assert.match(guarded.stderr, /Refusing to write the report under/);
  assert.ok(!existsSync(path.join(root, ".github/skills/drift.md")));

  const unreachable = spawnSync(process.execPath, [script, "--repo", `file://${root}/missing`], {
    cwd: fileURLToPath(new URL("../../../", import.meta.url)),
    encoding: "utf8",
  });
  assert.equal(unreachable.status, 2);
  assert.match(unreachable.stderr, /Cannot list upstream tags/);
});
