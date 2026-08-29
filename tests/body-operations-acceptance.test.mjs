import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseCsv } from "../scripts/system-data.mjs";
import { bodyOperationAssetPath, deriveBodyOperationTargets } from "../scripts/body-operations.mjs";
import { generateBodyOperationAsset, serializeAsset } from "../tools/generate-body-operations.mjs";
const root = new URL("../", import.meta.url), rows = parseCsv(readFileSync(new URL("docs/system-orbital-distances.csv", root), "utf8")), cartography = JSON.parse(readFileSync(new URL("data/planet-cartography/manifest.json", root), "utf8"));
const targets = deriveBodyOperationTargets(rows, cartography);
const assetFor = (body) => { const row = targets.find(({ row }) => row.object === body)?.row; assert.ok(row, body); return JSON.parse(readFileSync(new URL(bodyOperationAssetPath(row.system, row.object), root), "utf8")); };

test("all accepted assets regenerate byte-for-byte from the current canonical registry", () => {
  for (const { row } of targets) assert.equal(readFileSync(new URL(bodyOperationAssetPath(row.system, row.object), root), "utf8"), serializeAsset(generateBodyOperationAsset(row)), `${row.system}/${row.object}`);
});

test("special natural worlds retain their constrained operational identities", () => {
  const eilean = assetFor("Eilean Volna"), kestrel = assetFor("Old Kestrel"), kalong = assetFor("Kalong");
  assert.ok(eilean.features.some((feature) => feature.name === "Volna Thaw Enclave"));
  assert.ok(!eilean.features.some((feature) => /\bforest\b|\bhighway\b/i.test(`${feature.name} ${feature.description}`)));
  assert.ok(!eilean.features.some((feature) => feature.type === "city"));
  assert.ok(kestrel.features.some((feature) => feature.name === "Black Kestrel Cut")); assert.ok(kestrel.features.some((feature) => /mass driver/i.test(feature.name)));
  assert.equal(kalong.operationalKind, "giant"); assert.ok(kalong.features.some((feature) => feature.name === "Ember Crown")); assert.ok(!kalong.features.some((feature) => feature.layer === "routes"));
});

test("Akhetan, Thornfield, Long Hook and Arrowfall satisfy strategic/distributed contracts", () => {
  const akhetan = assetFor("Akhetan"), thornfield = assetFor("Thornfield"), hook = assetFor("The Long Hook"), arrowfall = assetFor("Arrowfall Range");
  assert.ok(akhetan.features.some((feature) => feature.type === "aperture")); assert.ok(akhetan.features.filter((feature) => feature.lodPriority === 1).length >= 8);
  assert.equal(thornfield.coordinateFrame.geometryKind, "uncertain observation volume"); assert.ok(!thornfield.features.some((feature) => feature.type === "dock"));
  assert.ok(hook.features.some((feature) => feature.name === "Hookhead Transfer Node"));
  assert.ok(arrowfall.features.some((feature) => /live-fire/i.test(feature.hazard ?? ""))); assert.ok(arrowfall.features.some((feature) => feature.name === "Arrowfall Safe Ingress"));
});

test("cultural naming profiles cover all ten systems without apostrophe-heavy fantasy names", () => {
  assert.deepEqual(new Set(targets.map(({ row }) => row.system)), new Set(["Abydos","Tanis","Saqqara","Iunu","Memphis","Nekhen","Thebes","Sais","Amarna","Seti"]));
  for (const { row } of targets) { const asset = assetFor(row.object); assert.ok(asset.namingProfile); assert.ok(asset.features.every((feature) => (feature.name.match(/[’']/g) ?? []).length <= 1)); }
});
