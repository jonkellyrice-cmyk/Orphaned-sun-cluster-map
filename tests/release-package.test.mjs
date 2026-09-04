import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);

test("release workflow packages runtime geography, cartography, operational, and astronomy assets", () => {
  const workflow = readFileSync(new URL(".github/workflows/release.yml", root), "utf8");
  assert.match(workflow, /module\.json scripts templates styles lang README\.md docs data/);
  for (const required of [
    "data/planet-geography/manifest.json",
    "data/planet-geography/sais/nalini.json",
    "data/planet-geography/sais/shanvara.json",
    "data/planet-cartography/manifest.json",
    "data/planet-cartography/abydos/eventide.json",
    "data/planet-cartography/amarna/cordoba.json",
    "data/body-operations/manifest.json",
    "data/body-operations/abydos/cataphract.json",
    "data/body-operations/amarna/akhetan.json",
    "data/body-operations/seti/arrowfall-range.json",
    "data/astronomy/epoch-orientations.json",
  ]) assert.match(workflow, new RegExp(required.replace(/[./-]/g, "\\$&")));
  assert.match(workflow, /npm run astronomy:validate && npm run astronomy:check/);
});

test("Foundry and package versions agree on the v0.11.0 release archive", () => {
  const manifest = JSON.parse(readFileSync(new URL("module.json", root), "utf8"));
  const packageJson = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));
  assert.equal(manifest.version, packageJson.version);
  assert.equal(manifest.version, "0.11.0");
  assert.equal(manifest.manifest, "https://github.com/jonkellyrice-cmyk/Orphaned-sun-cluster-map/releases/latest/download/module.json");
  assert.match(manifest.download, /v0\.11\.0\/orphaned-sun-cluster-map-v0\.11\.0\.zip$/);
});
