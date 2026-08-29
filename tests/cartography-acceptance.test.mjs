import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url), manifest = JSON.parse(readFileSync(new URL("data/planet-cartography/manifest.json", root), "utf8"));
const load = (entry) => JSON.parse(readFileSync(new URL(entry.path, root), "utf8"));
const expectedProfile = { Abydos: "vadan", Tanis: "vostrann", Saqqara: "vostrann", Iunu: "vostrann", Memphis: "aurethic", Nekhen: "aurethic", Thebes: "xuanhari", Sais: "xuanhari", Seti: "xuanhari", Amarna: "union" };

test("all 43 refined surfaces and hashes are explicitly accepted as working canon", () => {
  assert.equal(manifest.status, "accepted-working-canon");
  assert.equal(manifest.worlds.length, 43);
  for (const entry of manifest.worlds) {
    const text = readFileSync(new URL(entry.path, root), "utf8"), asset = JSON.parse(text);
    assert.equal(asset.status, "accepted-working-canon", entry.body);
    assert.equal(createHash("sha256").update(text).digest("hex"), entry.sha256, entry.body);
    assert.equal(asset.sourceSeed, entry.sourceSeed, entry.body);
    assert.equal(asset.sourceFingerprint, entry.sourceFingerprint, entry.body);
  }
});

test("accepted canon contains detailed physical, ecological and civilization geometry", () => {
  for (const entry of manifest.worlds) {
    const world = load(entry);
    assert.ok(world.terrain.coastlines.length && world.terrain.contours.length && world.terrain.elevationMesh.triangles.length, entry.body);
    assert.ok(world.hydrology.rivers.length && world.hydrology.lakes.length, entry.body);
    assert.ok(world.regions.ecoregions.length && world.regions.soilRegions.length && world.regions.resourceProvinces.length, entry.body);
    assert.equal(world.settlements.filter((site) => site.kind === "capital").length, 1, entry.body);
    assert.equal(world.transportRoutes.length, world.settlements.length - 1, entry.body);
  }
});

test("accepted names follow controlling culture and remain collision-free per world", () => {
  for (const entry of manifest.worlds) {
    const world = load(entry), named = [...world.gazetteer, ...world.settlements, ...world.transportRoutes];
    assert.ok(named.every((feature) => feature.profile === expectedProfile[entry.system]), entry.body);
    assert.equal(new Set(named.map((feature) => feature.properName)).size, named.length, entry.body);
  }
});

test("canonical CSV is unchanged from the audited v0.4.0 base", () => {
  const csv = readFileSync(new URL("docs/system-orbital-distances.csv", root));
  assert.equal(createHash("sha256").update(csv).digest("hex"), "d9367e4dd00f6e8a864d20ce04a396aa0d7938bfd0b35876e2efe2c683fe17b6");
});

test("Eventide's accepted canon remains continent-free and ocean dominated", () => {
  const eventide = load(manifest.worlds.find((world) => world.body === "Eventide"));
  assert.ok(eventide.terrain.realizedWaterFraction >= .85);
  assert.equal(eventide.gazetteer.some((feature) => feature.featureClass === "continent"), false);
  assert.ok(eventide.gazetteer.filter((feature) => feature.featureClass === "island").length >= 8);
});
