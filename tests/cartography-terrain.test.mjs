import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildRefinedTerrain } from "../scripts/planet-cartography.mjs";

const root = new URL("../", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("data/planet-geography/manifest.json", root), "utf8"));
const load = (body) => JSON.parse(readFileSync(new URL(manifest.worlds.find((world) => world.body === body).path, root), "utf8"));

test("accepted coarse geography deterministically anchors a two-degree terrain mesh", () => {
  const eventide = load("Eventide"), first = buildRefinedTerrain(eventide), second = buildRefinedTerrain(eventide);
  assert.equal(first.grid.latCount, 90); assert.equal(first.grid.lonCount, 180); assert.equal(first.cells.length, 16_200);
  assert.deepEqual(first, second);
  assert.equal(first.sourceSeed, eventide.seed); assert.equal(first.sourceFingerprint, eventide.inputFingerprint);
});

test("sea-level fitting preserves canonical water coverage at refined resolution", () => {
  for (const body of ["Eventide", "Ramses", "Tlaloc", "Keshun"]) {
    const coarse = load(body), refined = buildRefinedTerrain(coarse);
    assert.ok(Math.abs(refined.realizedWaterFraction - coarse.realizedWaterFraction) <= .001, body);
  }
});

test("coastlines are smoothed closed vectors rather than coarse cell markers", () => {
  const refined = buildRefinedTerrain(load("Thraximundus"));
  assert.ok(refined.coastlines.length); assert.ok(refined.landPolygons.length);
  for (const coast of refined.coastlines) { assert.equal(coast.closed, true); assert.deepEqual(coast.points[0], coast.points.at(-1)); assert.ok(coast.points.length >= 9); }
});

test("Eventide remains an oceanic archipelago rather than gaining a replacement continent", () => {
  const refined = buildRefinedTerrain(load("Eventide"));
  assert.ok(refined.realizedWaterFraction >= .85);
  assert.ok(refined.landPolygons.length >= 8);
  assert.ok(refined.landPolygons[0].areaDeg2 < refined.landPolygons.reduce((sum, polygon) => sum + polygon.areaDeg2, 0) * .55);
});

test("refinement rejects resolutions that cannot preserve accepted grid alignment", () => {
  assert.throws(() => buildRefinedTerrain(load("Eventide"), { resolutionDeg: 4 }), /evenly subdivide/);
});
