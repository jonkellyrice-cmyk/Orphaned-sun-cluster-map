import test from "node:test";
import assert from "node:assert/strict";
import {
  BODY_OPERATIONS_MODEL_VERSION,
  BODY_OPERATIONS_SCHEMA_VERSION,
  BODY_OPERATIONS_STATUS,
  bodyOperationAssetPath,
  bodyOperationsLod,
  buildBodyOperationsRenderPlan,
  canonicalRowFingerprint,
  canonicalSourceFingerprint,
  coordinateFrameForKind,
  deriveBodyOperationTargets,
  inspectBodyOperationFeature,
  operationLayerDefinitions,
  operationSeed,
  operationalKindForRow,
  projectOperationPosition,
  validateBodyOperationsAsset,
} from "../scripts/body-operations.mjs";

test("operational target classifier covers all Phase-2 families", () => {
  assert.equal(operationalKindForRow({ type: "moon" }), "natural-solid");
  assert.equal(operationalKindForRow({ type: "anomalous super-Jovian gas giant" }), "giant");
  assert.equal(operationalKindForRow({ type: "asteroid/debris belt" }), "belt");
  assert.equal(operationalKindForRow({ type: "major station" }), "station");
  assert.equal(operationalKindForRow({ type: "military range / installation field" }), "station");
  assert.equal(operationalKindForRow({ type: "shipyard" }), "shipyard");
  assert.equal(operationalKindForRow({ type: "carrier/fleet group" }), "fleet");
  assert.equal(operationalKindForRow({ type: "major vessel" }), "vessel");
  assert.equal(operationalKindForRow({ type: "linear megastructure/tether" }), "megastructure");
  assert.equal(operationalKindForRow({ type: "blinkgate complex" }), "blinkgate");
  assert.equal(operationalKindForRow({ type: "spatial anomaly region" }), "anomaly");
  assert.equal(operationalKindForRow({ type: "G2V star" }), null);
});

test("target derivation excludes worlds already represented by inhabited cartography", () => {
  const rows = [
    { system: "Abydos", object: "Ramses", type: "terrestrial world" },
    { system: "Abydos", object: "Cataphract", type: "barren rocky planet" },
    { system: "Seti", object: "Arrowfall Range", type: "military range / installation field" },
  ];
  const cartography = { worlds: [{ system: "Abydos", body: "Ramses" }] };
  const targets = deriveBodyOperationTargets(rows, cartography);
  assert.deepEqual(targets.map(({ row }) => `${row.system}/${row.object}`), ["Abydos/Cataphract", "Seti/Arrowfall Range"]);
});

test("seeds, fingerprints, paths and model identity are deterministic contracts", () => {
  assert.equal(BODY_OPERATIONS_SCHEMA_VERSION, 1);
  assert.equal(BODY_OPERATIONS_MODEL_VERSION, "orphaned-sun-body-operations-v1");
  assert.equal(BODY_OPERATIONS_STATUS, "accepted-generated-canon");
  const seed = operationSeed("Amarna", "Akhetan", "blinkgate complex");
  assert.equal(seed, operationSeed("Amarna", "Akhetan", "blinkgate complex"));
  assert.notEqual(seed, operationSeed("Amarna", "Akhetan", "major station"));
  assert.equal(seed.length, 16);
  assert.equal(canonicalSourceFingerprint("Amarna", "Akhetan", "blinkgate complex").length, 20);
  const row = { system: "Amarna", object: "Akhetan", type: "blinkgate complex", strategic_role: "gateway" };
  assert.equal(canonicalRowFingerprint(row), canonicalRowFingerprint({ strategic_role: "gateway", type: "blinkgate complex", object: "Akhetan", system: "Amarna" }));
  assert.notEqual(canonicalRowFingerprint(row), canonicalRowFingerprint({ ...row, strategic_role: "changed" }));
  assert.equal(bodyOperationAssetPath("Memphis", "Pilgrim’s Lantern"), "data/body-operations/memphis/pilgrim-s-lantern.json");
});

test("coordinate frames distinguish fixed surfaces, reference-epoch geometry and uncertainty", () => {
  assert.equal(coordinateFrameForKind("natural-solid").id, "body-fixed-spherical");
  assert.equal(coordinateFrameForKind("giant").id, "atmospheric-spherical");
  assert.equal(coordinateFrameForKind("belt").geometryKind, "physical reference-epoch snapshot");
  assert.equal(coordinateFrameForKind("fleet").geometryKind, "physical reference-epoch snapshot");
  assert.equal(coordinateFrameForKind("anomaly").geometryKind, "uncertain observation volume");
  assert.equal(coordinateFrameForKind("station").id, "body-local-cartesian");
});

test("family layer definitions and LOD budgets are bounded and deterministic", () => {
  for (const kind of ["natural-solid", "giant", "belt", "station", "shipyard", "vessel", "fleet", "blinkgate", "megastructure", "anomaly"]) {
    assert.ok(operationLayerDefinitions(kind).length >= 4, kind);
  }
  assert.equal(bodyOperationsLod(1, true).id, "orbital");
  assert.equal(bodyOperationsLod(1.5, true).id, "intermediate");
  assert.equal(bodyOperationsLod(3, true).id, "close");
  assert.equal(bodyOperationsLod(3, true).maxFeatures, 64);
});

test("asset validator, inspection and render planning honor the Phase-2 schema", () => {
  const asset = {
    schemaVersion: 1,
    system: "Seti",
    body: "Arrowfall Range",
    canonicalType: "military range / installation field",
    operationalKind: "station",
    permanentOperationalSeed: operationSeed("Seti", "Arrowfall Range", "military range / installation field"),
    operationalModelVersion: BODY_OPERATIONS_MODEL_VERSION,
    canonicalSourceFingerprint: canonicalSourceFingerprint("Seti", "Arrowfall Range", "military range / installation field"),
    coordinateFrame: coordinateFrameForKind("station"),
    features: [
      { id: "range-control", name: "Range Control", type: "control node", layer: "structure", position: { x: 0, y: 0, z: 0 }, operationalRole: "range coordination", description: "Reference control point", lodPriority: 1 },
      { id: "danger-volume", name: "Live-Fire Volume", type: "hazard volume", layer: "hazards", position: { x: 1200, y: -400, z: 100 }, operationalRole: "restricted training volume", description: "Reference-epoch hazard volume", hazard: "live fire", lodPriority: 2, refs: ["range-control"] },
    ],
  };
  assert.deepEqual(validateBodyOperationsAsset(asset), []);
  const plan = buildBodyOperationsRenderPlan(asset, 1.5, true);
  assert.equal(plan.lod.id, "intermediate");
  assert.equal(plan.features.length, 2);
  assert.equal(projectOperationPosition(asset, asset.features[0]).visible, true);
  assert.deepEqual(inspectBodyOperationFeature(asset.features[1]), {
    name: "Live-Fire Volume",
    type: "hazard volume",
    detail: "restricted training volume · live fire",
    provenance: "accepted-generated-canon",
    scale: null,
  });
});
