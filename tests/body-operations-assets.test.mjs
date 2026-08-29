import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseCsv } from "../scripts/system-data.mjs";
import { canonicalRowFingerprint, deriveBodyOperationTargets, operationSeed, targetKey, validateBodyOperationsAsset } from "../scripts/body-operations.mjs";

const root = new URL("../", import.meta.url);
const rows = parseCsv(readFileSync(new URL("docs/system-orbital-distances.csv", root), "utf8"));
const cartography = JSON.parse(readFileSync(new URL("data/planet-cartography/manifest.json", root), "utf8"));
const manifest = JSON.parse(readFileSync(new URL("data/body-operations/manifest.json", root), "utf8"));
const assets = manifest.assets.map((entry) => ({ entry, asset: JSON.parse(readFileSync(new URL(entry.path, root), "utf8")) }));
const rowsByKey = new Map(rows.map((row) => [targetKey(row.system, row.object), row]));

test("manifest covers every eligible non-cartographic operational target exactly once", () => {
  const targets = deriveBodyOperationTargets(rows, cartography);
  assert.equal(rows.length, 126); assert.equal(cartography.worlds.length, 43); assert.equal(targets.length, 71); assert.equal(manifest.targetCount, 71);
  assert.equal(new Set(manifest.assets.map((entry) => targetKey(entry.system, entry.body))).size, 71);
  assert.deepEqual(new Set(manifest.assets.map((entry) => targetKey(entry.system, entry.body))), new Set(targets.map(({ row }) => targetKey(row.system, row.object))));
});

test("every accepted asset has valid deterministic identity, frame and bounded coordinates", () => {
  for (const { entry, asset } of assets) {
    const row = rowsByKey.get(targetKey(asset.system, asset.body));
    assert.deepEqual(validateBodyOperationsAsset(asset), [], entry.path);
    assert.equal(asset.canonicalType, row.type);
    assert.equal(asset.permanentOperationalSeed, operationSeed(asset.system, asset.body, asset.canonicalType));
    assert.equal(asset.canonicalSourceFingerprint, canonicalRowFingerprint(row));
    assert.equal(entry.seed, asset.permanentOperationalSeed); assert.equal(entry.fingerprint, asset.canonicalSourceFingerprint);
    assert.equal(entry.featureCount, asset.features.length); assert.ok(asset.features.length <= 64, entry.path);
  }
});

test("no star, barycenter or inhabited cartographic world is duplicated", () => {
  const cartKeys = new Set(cartography.worlds.map((world) => targetKey(world.system, world.body)));
  assert.ok(assets.every(({ asset }) => !cartKeys.has(targetKey(asset.system, asset.body))));
  assert.ok(assets.every(({ asset }) => !/star|barycenter/i.test(asset.canonicalType)));
});
