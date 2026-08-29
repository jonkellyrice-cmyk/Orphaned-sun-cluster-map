import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildRefinedHydrology, buildRefinedTerrain } from "../scripts/planet-cartography.mjs";
import { buildCartographicRegions } from "../scripts/cartography-regions.mjs";
import { buildNamedGeography } from "../scripts/cartography-names.mjs";

const root = new URL("../", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("data/planet-geography/manifest.json", root), "utf8"));
const load = (body) => JSON.parse(readFileSync(new URL(manifest.worlds.find((world) => world.body === body).path, root), "utf8"));
const cache = new Map();
function build(body) {
  if (cache.has(body)) return cache.get(body);
  const coarse = load(body), terrain = buildRefinedTerrain(coarse), hydrology = buildRefinedHydrology(coarse, terrain), regions = buildCartographicRegions(coarse, hydrology);
  const result = { coarse, terrain, hydrology, regions, names: buildNamedGeography({ coarse, terrain, hydrology, regions }) }; cache.set(body, result); return result;
}

test("the five controlling cultures govern permanent physical-feature names", () => {
  const expected = { Eventide: ["vadan", "Vadan"], "Krasna Brae": ["vostrann", "Vostrann"], Serapha: ["aurethic", "Aurethic"], Jinyara: ["xuanhari", "Xuānhari"], Nansen: ["union", "Union cosmopolitan"] };
  for (const [body, [profile, language]] of Object.entries(expected)) {
    const { names } = build(body);
    assert.equal(names.namingProfile, profile, body);
    assert.equal(names.language, language, body);
    assert.ok(names.features.every((feature) => feature.profile === profile && feature.language === language));
  }
});

test("gazetteer identities and names are stable, unique and tied to literal geometry", () => {
  const first = build("Serapha"), second = buildNamedGeography(first);
  assert.deepEqual(first.names, second);
  assert.equal(new Set(first.names.features.map((feature) => feature.properName)).size, first.names.features.length);
  assert.ok(first.names.features.every((feature) => feature.at?.length === 2 && feature.at.every(Number.isFinite)));
  assert.ok(first.names.features.every((feature) => feature.generatedFrom.seed === first.coarse.seed));
});

test("major physical layers receive proper names without renaming scientific identities", () => {
  const { names } = build("Thraximundus");
  const classes = new Set(names.features.map((feature) => feature.featureClass));
  for (const required of ["continent", "island", "ocean", "sea", "river", "lake", "wetland", "glacier", "mountain", "desert", "forest"]) assert.ok(classes.has(required), required);
  assert.ok(names.features.every((feature) => !feature.id.startsWith("plate-")));
  assert.ok(names.features.every((feature) => feature.scientificClassification && feature.properName !== feature.scientificClassification));
});

test("Eventide remains named as an archipelago world with no invented continent", () => {
  const { names } = build("Eventide");
  assert.equal(names.features.filter((feature) => feature.featureClass === "continent").length, 0);
  assert.ok(names.features.filter((feature) => feature.featureClass === "island").length >= 8);
  assert.ok(names.features.some((feature) => feature.featureClass === "ocean"));
});

test("wrong-world geometry is rejected before names can become canon", () => {
  const eventide = build("Eventide"), ramses = build("Ramses");
  assert.throws(() => buildNamedGeography({ coarse: eventide.coarse, terrain: ramses.terrain, hydrology: eventide.hydrology, regions: eventide.regions }), /does not match/);
});
