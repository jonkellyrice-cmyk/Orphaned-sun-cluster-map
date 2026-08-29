import test from "node:test";
import assert from "node:assert/strict";
import { BODY_OPERATIONS_MODEL_VERSION, bodyOperationsLod, buildBodyOperationsRenderPlan, canonicalSourceFingerprint, coordinateFrameForKind, inspectBodyOperationFeature, operationSeed, operationalKindForRow, validateBodyOperationsAsset } from "../scripts/body-operations.mjs";
import { generateBodyOperationAsset } from "../tools/generate-body-operations.mjs";

test("operational target classifier covers natural, distributed, artificial and anomalous families", () => {
  assert.equal(operationalKindForRow({ type: "moon" }), "natural-solid");
  assert.equal(operationalKindForRow({ type: "anomalous super-Jovian gas giant" }), "giant");
  assert.equal(operationalKindForRow({ type: "asteroid/debris belt" }), "belt");
  assert.equal(operationalKindForRow({ type: "military range / installation field" }), "station");
  assert.equal(operationalKindForRow({ type: "spatial anomaly region" }), "anomaly");
  assert.equal(operationalKindForRow({ type: "G2V star" }), null);
});

test("seeds, fingerprints and frames are permanent deterministic contracts", () => {
  const a = operationSeed("Amarna", "Akhetan", "blinkgate complex"), b = operationSeed("Amarna", "Akhetan", "blinkgate complex");
  assert.equal(a, b); assert.equal(a.length, 16); assert.equal(canonicalSourceFingerprint("Amarna", "Akhetan", "blinkgate complex").length, 20);
  assert.equal(BODY_OPERATIONS_MODEL_VERSION, "orphaned-sun-body-operations-v1");
  assert.equal(coordinateFrameForKind("belt").geometryKind, "physical reference-epoch snapshot");
  assert.equal(coordinateFrameForKind("anomaly").geometryKind, "uncertain observation volume");
});

test("render planning applies bounded zoom-dependent LOD", () => {
  const asset = generateBodyOperationAsset({ system: "Amarna", object: "Akhetan", type: "blinkgate complex" });
  const orbital = buildBodyOperationsRenderPlan(asset, 1, true), close = buildBodyOperationsRenderPlan(asset, 3, true);
  assert.equal(bodyOperationsLod(1, true).id, "orbital"); assert.equal(bodyOperationsLod(3, true).id, "close");
  assert.ok(orbital.features.length <= close.features.length); assert.ok(close.features.length <= 64);
  assert.deepEqual(validateBodyOperationsAsset(asset), []);
});

test("operational feature inspection surfaces role, resource/hazard and provenance", () => {
  const feature = { id: "mine-1", name: "Claim Seven", type: "mine", operationalRole: "extraction site", resource: "water ice", provenance: "accepted-generated-canon" };
  assert.deepEqual(inspectBodyOperationFeature(feature), { name: "Claim Seven", type: "mine", detail: "extraction site · water ice", provenance: "accepted-generated-canon", scale: null });
});
