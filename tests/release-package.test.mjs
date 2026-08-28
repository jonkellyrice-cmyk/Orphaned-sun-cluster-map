import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);

test("release workflow packages runtime planetary geography assets", () => {
  const workflow = readFileSync(new URL(".github/workflows/release.yml", root), "utf8");
  assert.match(workflow, /module\.json scripts templates styles lang README\.md docs data/);
  for (const required of [
    "data/planet-geography/manifest.json",
    "data/planet-geography/sais/nalini.json",
    "data/planet-geography/sais/shanvara.json",
  ]) assert.match(workflow, new RegExp(required.replace(/[./-]/g, "\\$&")));
});

test("Foundry and package versions agree on the v0.3.1 release archive", () => {
  const manifest = JSON.parse(readFileSync(new URL("module.json", root), "utf8"));
  const packageJson = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));
  assert.equal(manifest.version, packageJson.version);
  assert.equal(manifest.version, "0.3.1");
  assert.match(manifest.download, /v0\.3\.1\/orphaned-sun-cluster-map-v0\.3\.1\.zip$/);
});
