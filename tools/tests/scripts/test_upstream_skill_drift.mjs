import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { changelogSince, latestTag, tagCommits } from "../../scripts/report-upstream-skill-drift.mjs";

const script = fileURLToPath(new URL("../../scripts/report-upstream-skill-drift.mjs", import.meta.url));
const plugin = ".github/plugins/azure-skills";
const extra = ".github/plugins/azure-extra";

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
  write(upstream, `${plugin}/skills/azure-moved/SKILL.md`, "Remove-Item -Path temp\n");
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
  git(upstream, "rm", "-q", "-r", `${plugin}/skills/azure-moved`);
  write(upstream, `${extra}/skills/moved-split/SKILL.md`, "Clean up only your files.\n");
  write(upstream, `${extra}/skills/moved-extra/SKILL.md`, "untracked\n");
  git(upstream, "add", "-A");
  git(upstream, "commit", "-q", "-m", "second");
  git(upstream, "tag", "v1.1.0");
  git(upstream, "tag", "not-a-release");

  const manifest = path.join(root, "pins.json");
  writeFileSync(
    manifest,
    JSON.stringify({
      schema_version: 2,
      upstream: {
        repository: "fixture/azure-skills",
        plugins_root: ".github/plugins",
        primary_plugin: "azure-skills",
        plugins: ["azure-skills", "azure-extra"],
        reviewed: { tag: "v1.0.0", commit: reviewed },
      },
      skills: [
        {
          apex: "apex-azure-demo",
          upstream: ["azure-demo"],
          status: "fork",
          imports: [{ from: "azure-demo/references/", to: "references/" }],
        },
        {
          apex: "apex-azure-moved",
          plugin: "azure-extra",
          upstream: ["moved-split"],
          status: "fork",
          imports: [{ from: "moved-split/SKILL.md", to: "SKILL.md" }],
        },
      ],
      defect_probes: [
        { id: "SK-99", path: "azure-demo/references/guide.md", pattern: "Remove-Item -Path", defect: "Deletes temp" },
        {
          id: "SK-98",
          plugin: "azure-extra",
          path: "moved-split/SKILL.md",
          pattern: "Remove-Item",
          defect: "Deletes temp",
          fixed_upstream_in: "v1.1.0",
        },
      ],
    }),
  );
  const run = (...args) =>
    spawnSync(process.execPath, [script, "--manifest", manifest, "--repo", `file://${upstream}`, ...args], {
      cwd: root,
      encoding: "utf8",
    });
  return { root, run, upstream };
}

test("latestTag picks the highest release tag and ignores other refs", () => {
  const refs = ["a\trefs/tags/v1.9.9", "b\trefs/tags/v1.10.0", "c\trefs/tags/latest", "d\trefs/tags/v2.0.0-rc1"];
  assert.equal(latestTag(refs.join("\n")), "v1.10.0");
  assert.equal(latestTag(""), null);
  assert.equal(latestTag("t\trefs/tags/v1.2.0\nc\trefs/tags/v1.2.0^{}"), "v1.2.0");
});

test("tagCommits resolves annotated tags to their peeled commit", () => {
  const commits = tagCommits("tagobj\trefs/tags/v1.2.0\ncommit1\trefs/tags/v1.2.0^{}\ncommit2\trefs/tags/v1.3.0");
  assert.equal(commits.get("v1.2.0"), "commit1");
  assert.equal(commits.get("v1.3.0"), "commit2");
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
  assert.match(report, /\| `azure-moved` \| retired \| no \|/);
  assert.match(report, /\| `azure-extra` \| new plugin \| yes \|/);
  assert.match(report, /\| `azure-extra:moved-split` \| new \| yes \|/);
  assert.match(report, /\| `azure-extra:moved-extra` \| new \| no \|/);
  assert.match(report, /### apex-azure-moved\n\nStatus `fork`; plugin `azure-extra`; upstream `moved-split`\./);
  assert.match(report, /\| A \| `moved-split\/SKILL\.md` \| yes \|/);
  assert.match(report, /\| SK-99 \| `azure-demo\/references\/guide\.md` \| fixed upstream \|/);
  assert.match(
    report,
    /\| SK-98 \| `azure-extra:moved-split\/SKILL\.md` \| fixed upstream \(reviewed in v1\.1\.0\) \|/,
  );
  assert.match(report, /- 1 defect probes differ from their reviewed state/);
  assert.doesNotMatch(report, /Tag v1\.0\.0 now points/);

  const json = JSON.parse(run("--json").stdout);
  assert.equal(json.drift, true);
  assert.equal(json.skills[0].changes.length, 2);
  assert.deepEqual(
    json.probes.map(({ id, result, expected }) => [id, result, expected]),
    [
      ["SK-99", "fixed upstream", "still present"],
      ["SK-98", "fixed upstream", "fixed upstream"],
    ],
  );
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

test("drift report flags a reviewed upstream fix that regressed and rejects unknown plugins", (context) => {
  const { root, run } = fixture(context);
  const manifestPath = path.join(root, "pins.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.defect_probes[1].pattern = "Clean up only";
  writeFileSync(manifestPath, JSON.stringify(manifest));
  const regressed = JSON.parse(run("--json").stdout).probes[1];
  assert.equal(regressed.result, "still present");
  assert.match(run().stdout, /\| SK-98 \| .* \| still present \(was fixed in v1\.1\.0\) \|/);

  manifest.skills[1].plugin = "azure-unknown";
  writeFileSync(manifestPath, JSON.stringify(manifest));
  const invalid = run();
  assert.equal(invalid.status, 2);
  assert.match(invalid.stderr, /plugin azure-unknown is not listed/);
});

test("drift report flags a force-moved reviewed tag even without a newer release", (context) => {
  const { run, upstream } = fixture(context);
  git(upstream, "tag", "-f", "v1.0.0", "HEAD");
  const moved = run("--tag", "v1.0.0", "--fail-on-drift");
  assert.equal(moved.status, 1, moved.stderr);
  assert.match(moved.stdout, /Tag v1\.0\.0 now points to `[0-9a-f]{8}`, not the reviewed commit/);
});

test("drift report refuses symlinked outputs into .github/skills and invalid manifests", (context) => {
  const { root, run } = fixture(context);
  mkdirSync(path.join(root, ".github/skills"), { recursive: true });
  symlinkSync(path.join(root, ".github/skills"), path.join(root, "reports"));
  const linked = run("--output", "reports/drift.md");
  assert.equal(linked.status, 2);
  assert.ok(!existsSync(path.join(root, ".github/skills/drift.md")));

  writeFileSync(path.join(root, "bad.json"), JSON.stringify({ upstream: { repository: "x" } }));
  const invalid = spawnSync(process.execPath, [script, "--manifest", "bad.json"], { cwd: root, encoding: "utf8" });
  assert.equal(invalid.status, 2);
  assert.match(invalid.stderr, /Invalid manifest bad\.json/);
});
