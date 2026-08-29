import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url), manifest = JSON.parse(readFileSync(new URL("data/planet-cartography/manifest.json", root), "utf8"));
const coarse = JSON.parse(readFileSync(new URL(manifest.sourceManifest, root), "utf8"));
const coarseByKey = new Map(coarse.worlds.map((world) => [`${world.system}/${world.body}`, world]));
const load = (entry) => JSON.parse(readFileSync(new URL(entry.path, root), "utf8"));

test("refined manifest contains 43 unique fingerprinted worlds", () => {
  assert.equal(manifest.schemaVersion, 2);
  assert.equal(manifest.worlds.length, 43);
  assert.equal(new Set(manifest.worlds.map((world) => `${world.system}/${world.body}`)).size, 43);
  for (const entry of manifest.worlds) {
    const text = readFileSync(new URL(entry.path, root), "utf8");
    assert.equal(createHash("sha256").update(text).digest("hex"), entry.sha256);
    assert.equal(Buffer.byteLength(text), entry.bytes);
  }
});

test("every asset preserves its accepted seed and coarse fingerprint", () => {
  for (const entry of manifest.worlds) {
    const asset = load(entry), source = coarseByKey.get(`${entry.system}/${entry.body}`);
    assert.equal(asset.sourceSeed, source.seed, entry.body);
    assert.equal(asset.sourceFingerprint, source.inputFingerprint, entry.body);
    assert.equal(asset.modelVersion, manifest.modelVersion, entry.body);
  }
});

test("compact two-degree rasters and vector products fit the mobile loading budget", () => {
  for (const entry of manifest.worlds) {
    const asset = load(entry), count = asset.grid.latCount * asset.grid.lonCount;
    assert.ok(entry.bytes <= 1_750_000, `${entry.body}: ${entry.bytes}`);
    assert.equal(asset.raster.elevationM.length, count);
    assert.equal(Buffer.from(asset.raster.oceanMaskBase64, "base64").length, count);
    for (const field of ["biome", "soil", "resource"]) assert.equal(Buffer.from(asset.raster[field].valuesBase64, "base64").length, count);
    assert.ok(asset.terrain.elevationMesh.triangles.length && asset.terrain.coastlines.length && asset.regions.ecoregions.length);
  }
});

test("materialized gazetteers and civilization networks have literal geometry", () => {
  for (const entry of manifest.worlds) {
    const asset = load(entry);
    assert.ok(asset.gazetteer.every((feature) => feature.properName && feature.at.every(Number.isFinite)), entry.body);
    assert.equal(asset.settlements.filter((site) => site.kind === "capital").length, 1, entry.body);
    assert.ok(asset.transportRoutes.every((route) => route.properName && route.points.length >= 2), entry.body);
  }
});

test("Eventide materializes as a named archipelago without a continent", () => {
  const eventide = load(manifest.worlds.find((world) => world.body === "Eventide"));
  assert.equal(eventide.gazetteer.some((feature) => feature.featureClass === "continent"), false);
  assert.ok(eventide.gazetteer.filter((feature) => feature.featureClass === "island").length >= 8);
  assert.ok(eventide.terrain.realizedWaterFraction >= .85);
});
