import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseCsv } from "../scripts/system-data.mjs";
import { createRng, generatePlanetGeography, generatePlateModel } from "../scripts/planet-geography.mjs";

const rows = parseCsv(readFileSync(new URL("../docs/system-orbital-distances.csv", import.meta.url), "utf8"));
const byName = Object.fromEntries(rows.filter((row) => row.geography_seed).map((row) => [row.object, row]));

test("seeded random stream and plate model are reproducible", () => {
  const a = createRng("fixed"), b = createRng("fixed");
  assert.deepEqual(Array.from({ length: 12 }, () => a()), Array.from({ length: 12 }, () => b()));
  assert.deepEqual(generatePlateModel(byName.Eventide), generatePlateModel(byName.Eventide));
});

test("same inputs recreate byte-equivalent literal geography", () => {
  const a = generatePlanetGeography(byName.Eventide, { resolutionDeg: 12 });
  const b = generatePlanetGeography(byName.Eventide, { resolutionDeg: 12 });
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test("sea-level fitting tracks canonical water inventory", () => {
  for (const name of ["Eventide", "Ramses", "Tlaloc", "Keshun"]) {
    const world = generatePlanetGeography(byName[name], { resolutionDeg: 12 });
    assert.ok(Math.abs(world.realizedWaterFraction - Number(byName[name].water_pct) / 100) <= .02, name);
  }
});

test("generated world contains causal physical and human feature layers", () => {
  const world = generatePlanetGeography(byName.Thraximundus, { resolutionDeg: 12 });
  assert.equal(world.plateModel.length, Number(byName.Thraximundus.major_plate_count));
  assert.ok(world.coastlines.length > 10);
  assert.ok(world.rivers.length > 0);
  assert.ok(world.cells.some((cell) => cell.biome.includes("forest")));
  assert.ok(world.cells.some((cell) => cell.resource));
  assert.equal(world.settlements[0].kind, "capital");
  assert.ok(world.transportRoutes.length > 0);
});

test("physical extremes produce distinct deterministic realizations", () => {
  const ocean = generatePlanetGeography(byName.Eventide, { resolutionDeg: 12 });
  const dry = generatePlanetGeography(byName.Nansen, { resolutionDeg: 12 });
  const cold = generatePlanetGeography(byName.Keshun, { resolutionDeg: 12 });
  assert.ok(ocean.realizedWaterFraction > dry.realizedWaterFraction * 5);
  assert.ok(dry.cells.filter((cell) => cell.biome.includes("desert")).length > ocean.cells.filter((cell) => cell.biome.includes("desert")).length);
  assert.ok(cold.cells.filter((cell) => ["ice-cap", "tundra", "cold-desert"].includes(cell.biome)).length > 0);
});
