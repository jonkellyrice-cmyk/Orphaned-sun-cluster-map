import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildBodyOperationsRenderPlan, targetKey } from "../scripts/body-operations.mjs";

const root = new URL("../", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("data/body-operations/manifest.json", root), "utf8"));
const cartography = JSON.parse(readFileSync(new URL("data/planet-cartography/manifest.json", root), "utf8"));
const accepted = manifest.assets.map((entry) => {
  const serialized = readFileSync(new URL(entry.path, root), "utf8");
  return { entry, serialized, bytes: Buffer.byteLength(serialized), asset: JSON.parse(serialized) };
});

test("accepted operational assets stay within bounded on-demand loading budgets", () => {
  assert.equal(accepted.length, 71);
  assert.ok(accepted.every(({ bytes }) => bytes <= 16 * 1024));
  assert.ok(accepted.reduce((sum, { bytes }) => sum + bytes, 0) <= 1024 * 1024);
});

test("mobile and desktop render plans remain bounded at every operational LOD", () => {
  const envelopes = [
    { zoom: 1, mobile: true, features: 18, labels: 18 },
    { zoom: 1.5, mobile: true, features: 38, labels: 20 },
    { zoom: 3, mobile: true, features: 64, labels: 20 },
    { zoom: 1, mobile: false, features: 26, labels: 26 },
    { zoom: 1.5, mobile: false, features: 60, labels: 32 },
    { zoom: 3, mobile: false, features: 110, labels: 32 },
  ];
  for (const { entry, asset } of accepted) {
    for (const envelope of envelopes) {
      const plan = buildBodyOperationsRenderPlan(asset, envelope.zoom, envelope.mobile);
      assert.ok(plan.features.length <= envelope.features, `${entry.path} ${plan.lod.id} features`);
      assert.ok(plan.labels.length <= envelope.labels, `${entry.path} ${plan.lod.id} labels`);
      assert.ok(plan.labels.every((feature) => plan.features.includes(feature)), `${entry.path} labels must be visible features`);
    }
  }
});

test("operational canon never overlaps the 43 accepted inhabited cartography products", () => {
  const inhabited = new Set(cartography.worlds.map((world) => targetKey(world.system, world.body)));
  assert.equal(inhabited.size, 43);
  for (const { asset, entry } of accepted) assert.ok(!inhabited.has(targetKey(asset.system, asset.body)), entry.path);
});
