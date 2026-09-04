import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildRefinedHydrology, buildRefinedTerrain } from "../scripts/planet-cartography.mjs";
import { buildCartographicRegions } from "../scripts/cartography-regions.mjs";
import { buildNamedGeography } from "../scripts/cartography-names.mjs";
import { buildSettlementCartography } from "../scripts/cartography-settlements.mjs";
import { parseCsv } from "../scripts/system-data.mjs";

const root = new URL("../", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("data/planet-geography/manifest.json", root), "utf8"));
const registry = parseCsv(readFileSync(new URL("docs/system-orbital-distances.csv", root), "utf8"));
const ownerByWorld = new Map(registry.map((row) => [`${row.system}\u0000${row.object}`, row.owner_faction]));
const load = (body) => JSON.parse(readFileSync(new URL(manifest.worlds.find((world) => world.body === body).path, root), "utf8"));
const cache = new Map();
function build(body) {
  if (cache.has(body)) return cache.get(body);
  const coarse = load(body), terrain = buildRefinedTerrain(coarse), hydrology = buildRefinedHydrology(coarse, terrain), regions = buildCartographicRegions(coarse, hydrology), gazetteer = buildNamedGeography({ coarse, terrain, hydrology, regions });
  const ownerFaction = ownerByWorld.get(`${coarse.system}\u0000${coarse.body}`) ?? "";
  const civilization = buildSettlementCartography({ coarse, hydrology, regions, gazetteer, ownerFaction });
  const result = { coarse, hydrology, regions, gazetteer, ownerFaction, civilization }; cache.set(body, result); return result;
}

test("civilization geometry is deterministic, provenance-bound and complete", () => {
  const world = build("Serapha"), second = buildSettlementCartography(world);
  assert.deepEqual(world.civilization, second);
  assert.equal(world.civilization.settlements.length, 18);
  assert.equal(world.civilization.routes.length, 17);
  assert.throws(() => buildSettlementCartography({ ...world, coarse: load("Eventide") }), /does not match/);
});

test("each inhabited world receives one named capital and a useful city hierarchy", () => {
  for (const body of ["Eventide", "Krasna Brae", "Serapha", "Jinyara", "Nansen"]) {
    const { coarse, civilization } = build(body);
    assert.equal(civilization.settlements.filter((site) => site.kind === "capital").length, 1, body);
    assert.ok(civilization.settlements.some((site) => site.role === "major city"), body);
    assert.ok(civilization.settlements.some((site) => site.role === "regional city"), body);
    assert.ok(civilization.settlements.every((site) => site.properName && site.generatedFrom.seed === coarse.seed && site.drivers.length), body);
    assert.equal(new Set(civilization.settlements.map((site) => site.properName)).size, civilization.settlements.length, body);
  }
});

test("surface corridors follow literal land cells and link named sites", () => {
  const { regions, civilization } = build("Serapha"), byCoordinate = new Map(regions.cells.map((cell) => [`${cell.lat}:${cell.lon}`, cell]));
  const sites = new Set(civilization.settlements.map((site) => site.id));
  assert.ok(civilization.routes.some((route) => route.mode === "surface"));
  for (const route of civilization.routes) {
    assert.ok(sites.has(route.from) && sites.has(route.to));
    assert.ok(route.properName && route.points.length >= 2);
    if (route.mode === "surface") for (const point of route.points) assert.equal(byCoordinate.get(`${point[0]}:${point[1]}`)?.ocean, false, route.id);
  }
});

test("Eventide's separated archipelagos generate explicit maritime/air lanes", () => {
  const { civilization } = build("Eventide"), lanes = civilization.routes.filter((route) => route.mode === "sea-or-air");
  assert.ok(lanes.length > 0);
  assert.ok(lanes.every((lane) => lane.points.length === 21));
  assert.ok(civilization.settlements.some((site) => site.role === "major port city"));
});

test("capital placement follows suitability and recorded geographic drivers", () => {
  const { civilization } = build("Thraximundus"), capital = civilization.settlements.find((site) => site.kind === "capital");
  const median = civilization.settlements.map((site) => site.suitability).sort((a, b) => a - b)[Math.floor(civilization.settlements.length / 2)];
  assert.ok(capital.suitability >= median);
  assert.ok(capital.drivers.some((driver) => ["coastal access", "river/freshwater access", "strategic resources", "fertile soils"].includes(driver)));
});


test("settlements expose deterministic built-environment scale classes", () => {
  const { civilization } = build("Jinyara");
  const capital = civilization.settlements.find((site) => site.kind === "capital");
  assert.equal(capital.scaleClass, "superstructure");
  assert.ok(civilization.settlements.filter((site) => ["major city", "major port city"].includes(site.role)).every((site) => site.scaleClass === "superstructure"));
  assert.ok(civilization.settlements.some((site) => site.scaleClass === "metropolitan"));
  assert.ok(civilization.settlements.some((site) => site.scaleClass === "regional"));
  assert.ok(civilization.routes.every((route) => ["trunk", "primary", "regional"].includes(route.corridorClass)));
});

test("surface routes carry faction-specific routing doctrine", () => {
  const mandate = build("Jinyara").civilization.routes.filter((route) => route.mode === "surface");
  const conclave = build("Thessaron").civilization.routes.filter((route) => route.mode === "surface");
  const accords = build("Kilmorov").civilization.routes.filter((route) => route.mode === "surface");
  assert.ok(mandate.length && mandate.every((route) => route.routingDoctrine === "direct"));
  assert.ok(conclave.length && conclave.every((route) => route.routingDoctrine === "ecological-avoidance"));
  assert.ok(accords.length && accords.every((route) => route.routingDoctrine === "least-resistance"));
});
