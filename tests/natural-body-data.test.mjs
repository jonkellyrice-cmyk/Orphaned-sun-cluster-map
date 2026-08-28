import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseCsv } from "../scripts/system-data.mjs";
import { buildNaturalBodyModel, buildNaturalBodyModels, naturalBodyKind } from "../scripts/natural-body-data.mjs";

const rows = parseCsv(readFileSync(new URL("../docs/system-orbital-distances.csv", import.meta.url), "utf8"));

test("natural body models cover terrestrial, moon, minor-world, giant, and asteroid-field families", () => {
  const models = buildNaturalBodyModels(rows);
  const kinds = new Set(models.map((model) => model.kind));
  assert.deepEqual(kinds, new Set(["terrestrial", "moon", "minor-world", "giant", "asteroid-field"]));
  assert.equal(models.length, rows.filter((row) => naturalBodyKind(row)).length);
});

test("natural bodies retain useful physical size and approach metadata", () => {
  for (const row of rows.filter((candidate) => naturalBodyKind(candidate))) {
    const model = buildNaturalBodyModel(row);
    assert.ok(model.radiusKm > 0, row.object);
    assert.ok(model.palette && model.composition && model.regions.length, row.object);
    assert.ok(model.resourceProfile && model.radiationProfile, row.object);
  }
});

test("giants and moons receive distinct schematic surface contracts", () => {
  const giant = buildNaturalBodyModel(rows.find((row) => row.type.includes("gas giant")));
  const moon = buildNaturalBodyModel(rows.find((row) => row.type === "moon"));
  assert.ok(giant.regions.some((region) => region.type === "atmospheric-bands"));
  assert.ok(moon.regions.some((region) => region.type === "crater-provinces"));
});
