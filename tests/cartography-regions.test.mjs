import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildRefinedHydrology, buildRefinedTerrain } from "../scripts/planet-cartography.mjs";
import { buildCartographicRegions } from "../scripts/cartography-regions.mjs";

const root = new URL("../", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("data/planet-geography/manifest.json", root), "utf8"));
const load = (body) => JSON.parse(readFileSync(new URL(manifest.worlds.find((world) => world.body === body).path, root), "utf8"));
const build = (body) => { const coarse = load(body); const terrain = buildRefinedTerrain(coarse); return { coarse, regions: buildCartographicRegions(coarse, buildRefinedHydrology(coarse, terrain)) }; };

function proportions(cells, field, ocean) {
  const domain = cells.filter((cell) => Boolean(cell.ocean) === ocean), result = {};
  for (const cell of domain) result[cell[field]] = (result[cell[field]] ?? 0) + 1 / domain.length;
  return result;
}

test("ecoregion, soil and resource geometry is deterministic and provenance-bound", () => {
  const coarse = load("Eventide"), terrain = buildRefinedTerrain(coarse), hydrology = buildRefinedHydrology(coarse, terrain);
  const first = buildCartographicRegions(coarse, hydrology), second = buildCartographicRegions(coarse, hydrology);
  assert.deepEqual(first, second);
  assert.equal(first.sourceSeed, coarse.seed);
  assert.equal(first.sourceFingerprint, coarse.inputFingerprint);
  assert.throws(() => buildCartographicRegions(load("Ramses"), hydrology), /does not match/);
});

test("refinement preserves accepted categorical proportions within raster rounding", () => {
  for (const body of ["Eventide", "Thraximundus", "Tlaloc", "Keshun"]) {
    const { coarse, regions } = build(body);
    for (const field of ["biome", "soil", "resource"]) for (const ocean of [false, true]) {
      const accepted = proportions(coarse.cells, field, ocean), refined = proportions(regions.cells, field, ocean);
      for (const category of new Set([...Object.keys(accepted), ...Object.keys(refined)])) assert.ok(Math.abs((accepted[category] ?? 0) - (refined[category] ?? 0)) <= 1 / regions.cells.filter((cell) => Boolean(cell.ocean) === ocean).length + 1e-9, `${body}/${field}/${ocean}/${category}`);
    }
  }
});

test("coastline displacement cannot put marine categories on land or land soils at sea", () => {
  for (const body of ["Eventide", "Ramses", "Nansen"]) {
    const { regions } = build(body);
    for (const cell of regions.cells) {
      assert.equal(cell.biome.includes("ocean") || cell.biome === "sea-ice", cell.ocean, `${body}/${cell.id}/biome`);
      assert.equal(cell.soil === "marine-sediment", cell.ocean, `${body}/${cell.id}/soil`);
    }
  }
});

test("all categorical regions materialize as closed coordinate polygons", () => {
  const { regions } = build("Thraximundus");
  for (const layer of [regions.ecoregions, regions.soilRegions, regions.resourceProvinces]) {
    assert.ok(layer.length > 0);
    assert.equal(layer.reduce((sum, region) => sum + region.cellCount, 0), layer === regions.soilRegions ? regions.cells.filter((cell) => !cell.ocean).length : regions.cells.length);
    for (const region of layer) for (const polygon of region.polygons) {
      assert.ok(polygon.length >= 4);
      assert.deepEqual(polygon[0], polygon.at(-1));
      assert.ok(polygon.flat().every(Number.isFinite));
    }
  }
});

test("world extremes retain distinct canonical ecological identities", () => {
  const eventide = build("Eventide").regions, nansen = build("Nansen").regions, keshun = build("Keshun").regions;
  assert.ok(eventide.cells.filter((cell) => cell.biome.includes("ocean")).length > nansen.cells.filter((cell) => cell.biome.includes("ocean")).length * 4);
  assert.ok(nansen.cells.filter((cell) => cell.biome.includes("desert")).length > eventide.cells.filter((cell) => cell.biome.includes("desert")).length);
  assert.ok(keshun.cells.some((cell) => ["ice-cap", "tundra", "cold-desert"].includes(cell.biome)));
});
