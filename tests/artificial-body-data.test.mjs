import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseCsv } from "../scripts/system-data.mjs";
import { artificialBodyKind, buildArtificialBodyModel, buildArtificialBodyModels } from "../scripts/artificial-body-data.mjs";

const rows = parseCsv(readFileSync(new URL("../docs/system-orbital-distances.csv", import.meta.url), "utf8"));

test("artificial approach models cover all mapped structural families", () => {
  const models = buildArtificialBodyModels(rows);
  assert.deepEqual(new Set(models.map((model) => model.kind)), new Set(["station", "shipyard", "fleet", "vessel", "megastructure", "blinkgate", "anomaly"]));
  assert.equal(models.length, rows.filter((row) => artificialBodyKind(row)).length);
});

test("docking-capable structures expose safe schematic approach geometry", () => {
  for (const model of buildArtificialBodyModels(rows).filter((candidate) => candidate.kind !== "anomaly")) {
    assert.ok(model.approach.mode && model.approach.exclusionRadius > 0, model.body);
    assert.ok(model.approach.dockingNodes.length, model.body);
    assert.ok(model.dimensions && model.visualArchetype && model.function, model.body);
  }
});

test("Akhetan is a legible blinkgate and Thornfield remains non-dockable", () => {
  const akhetan = buildArtificialBodyModel(rows.find((row) => row.object === "Akhetan"));
  const thornfield = buildArtificialBodyModel(rows.find((row) => row.object === "Thornfield"));
  assert.equal(akhetan.kind, "blinkgate"); assert.equal(akhetan.approach.mode, "gate-traffic-vector");
  assert.equal(thornfield.kind, "anomaly"); assert.deepEqual(thornfield.approach.dockingNodes, []);
});
