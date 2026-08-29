import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildRefinedHydrology, buildRefinedTerrain } from "../scripts/planet-cartography.mjs";

const root = new URL("../", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("data/planet-geography/manifest.json", root), "utf8"));
const load = (body) => JSON.parse(readFileSync(new URL(manifest.worlds.find((world) => world.body === body).path, root), "utf8"));
const build = (body) => { const coarse = load(body); return buildRefinedHydrology(coarse, buildRefinedTerrain(coarse)); };

test("refined hydrology is deterministic and remains bound to accepted geography", () => {
  const coarse = load("Ramses"), terrain = buildRefinedTerrain(coarse);
  const first = buildRefinedHydrology(coarse, terrain), second = buildRefinedHydrology(coarse, terrain);
  assert.deepEqual(first, second);
  assert.equal(first.sourceSeed, coarse.seed);
  assert.equal(first.sourceFingerprint, coarse.inputFingerprint);
  assert.throws(() => buildRefinedHydrology(load("Eventide"), terrain), /does not match/);
});

test("elevation mesh and contour geometry are finite and renderer-ready", () => {
  const world = build("Thraximundus");
  assert.equal(world.elevationMesh.resolutionDeg, 4);
  assert.ok(world.elevationMesh.vertices.length >= 4_000);
  assert.ok(world.elevationMesh.triangles.length >= 7_000);
  assert.ok(world.elevationMesh.vertices.every((vertex) => vertex.length === 3 && vertex.every(Number.isFinite)));
  assert.ok(world.elevationMesh.triangles.every((triangle) => triangle.every((index) => index >= 0 && index < world.elevationMesh.vertices.length)));
  assert.ok(world.contours.some((contour) => contour.levelM === 0));
});

test("river centerlines follow decreasing relief to an ocean or a registered lake", () => {
  for (const body of ["Ramses", "Tlaloc", "Keshun"]) {
    const world = build(body);
    assert.ok(world.rivers.length > 0, body);
    for (const river of world.rivers) {
      assert.ok(river.points.length >= 5, `${body}/${river.id}`);
      assert.ok(["ocean", "lake"].includes(river.mouth));
      for (let index = 1; index < river.elevationsM.length; index += 1) assert.ok(river.elevationsM[index] < river.elevationsM[index - 1], `${body}/${river.id} must descend`);
    }
  }
});

test("lakes, wetlands and glaciers obey their physical classification", () => {
  const wet = build("Thraximundus"), cold = build("Keshun");
  assert.ok(wet.wetlands.length > 0);
  for (const wetland of wet.wetlands) {
    const cell = wet.cells[wetland.cellId];
    assert.ok(cell.elevationM < 300);
    assert.ok(cell.precipitationMm >= 650);
    assert.deepEqual(wetland.polygon[0], wetland.polygon.at(-1));
  }
  assert.ok(cold.glaciers.length > 0);
  for (const glacier of cold.glaciers) {
    const cell = cold.cells[glacier.cellId];
    assert.ok(Math.abs(cell.lat) >= 48);
    assert.ok(cell.temperatureC <= 0);
  }
  for (const lake of wet.lakes) assert.deepEqual(lake.polygon[0], lake.polygon.at(-1));
});

test("ocean-rich Eventide receives routed island hydrology without a synthetic continent", () => {
  const world = build("Eventide");
  assert.ok(world.rivers.length > 0);
  assert.ok(world.cells.filter((cell) => cell.ocean).length / world.cells.length >= .85);
  assert.ok(world.rivers.every((river) => river.points.length < 100));
});
