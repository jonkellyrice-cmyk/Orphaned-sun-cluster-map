import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { buildRefinedHydrology, buildRefinedTerrain } from "../scripts/planet-cartography.mjs";
import { buildCartographicRegions } from "../scripts/cartography-regions.mjs";
import { buildNamedGeography } from "../scripts/cartography-names.mjs";
import { buildSettlementCartography } from "../scripts/cartography-settlements.mjs";
import { parseCsv } from "../scripts/system-data.mjs";

const root = new URL("../", import.meta.url), coarseManifest = JSON.parse(readFileSync(new URL("data/planet-geography/manifest.json", root), "utf8"));
const registryRows = parseCsv(readFileSync(new URL("docs/system-orbital-distances.csv", root), "utf8"));
const registryByWorld = new Map(registryRows.map((row) => [`${row.system}\u0000${row.object}`, row]));
const status = process.argv.includes("--accept") ? "accepted-working-canon" : "derived-working-canon";
const slug = (value) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const hash = (text) => createHash("sha256").update(text).digest("hex");
const encodeByteField = (cells, field) => {
  const categories = [...new Set(cells.map((cell) => cell[field]))].sort(), index = new Map(categories.map((category, i) => [category, i]));
  return { categories, valuesBase64: Buffer.from(cells.map((cell) => index.get(cell[field]))).toString("base64") };
};

const worlds = [];
for (const entry of coarseManifest.worlds) {
  const coarse = JSON.parse(readFileSync(new URL(entry.path, root), "utf8"));
  const terrain = buildRefinedTerrain(coarse), hydrology = buildRefinedHydrology(coarse, terrain), regions = buildCartographicRegions(coarse, hydrology);
  const gazetteer = buildNamedGeography({ coarse, terrain, hydrology, regions });
  const registryRow = registryByWorld.get(`${coarse.system}\u0000${coarse.body}`);
  if (!registryRow) throw new Error(`Missing canonical registry row for ${coarse.system}/${coarse.body}`);
  const civilizationProfile = {
    ownerFaction: registryRow.owner_faction,
    settlementPattern: registryRow.settlement_pattern || "",
    dominantSettlementPattern: registryRow.dominant_settlement_pattern || "",
    majorPopulationCorridors: registryRow.major_population_corridors || "",
    urbanConcentration: registryRow.urban_concentration || "",
    majorCityCountBand: registryRow.major_city_count_band || "",
    likelyTransportGeography: registryRow.likely_transport_geography || "",
  };
  const civilization = buildSettlementCartography({ coarse, hydrology, regions, gazetteer, ownerFaction: registryRow.owner_faction });
  const asset = {
    schemaVersion: 2,
    status,
    modelVersion: "orphaned-sun-cartography-v1",
    system: coarse.system,
    body: coarse.body,
    ownerFaction: registryRow.owner_faction,
    civilizationProfile,
    sourceSeed: coarse.seed,
    sourceFingerprint: coarse.inputFingerprint,
    resolutionDeg: terrain.resolutionDeg,
    grid: terrain.grid,
    terrain: { targetWaterFraction: terrain.targetWaterFraction, realizedWaterFraction: terrain.realizedWaterFraction, coastlines: terrain.coastlines, landPolygons: terrain.landPolygons, elevationMesh: hydrology.elevationMesh, contours: hydrology.contours },
    hydrology: { rivers: hydrology.rivers, lakes: hydrology.lakes, wetlands: hydrology.wetlands, glaciers: hydrology.glaciers },
    regions: { ecoregions: regions.ecoregions, soilRegions: regions.soilRegions, resourceProvinces: regions.resourceProvinces },
    gazetteer: gazetteer.features,
    settlements: civilization.settlements,
    transportRoutes: civilization.routes,
    raster: {
      elevationM: regions.cells.map((cell) => cell.elevationM),
      oceanMaskBase64: Buffer.from(regions.cells.map((cell) => cell.ocean ? 1 : 0)).toString("base64"),
      biome: encodeByteField(regions.cells, "biome"),
      soil: encodeByteField(regions.cells, "soil"),
      resource: encodeByteField(regions.cells, "resource"),
    },
  };
  const text = `${JSON.stringify(asset)}\n`, path = `data/planet-cartography/${slug(coarse.system)}/${slug(coarse.body)}.json`, diskPath = new URL(path, root);
  mkdirSync(dirname(diskPath.pathname), { recursive: true }); writeFileSync(diskPath, text);
  worlds.push({ system: coarse.system, body: coarse.body, path, sourceSeed: coarse.seed, sourceFingerprint: coarse.inputFingerprint, sha256: hash(text), bytes: Buffer.byteLength(text) });
  process.stdout.write(`generated ${coarse.system}/${coarse.body}\n`);
}
const manifest = { schemaVersion: 2, status, modelVersion: "orphaned-sun-cartography-v1", sourceManifest: "data/planet-geography/manifest.json", worlds };
const manifestPath = new URL("data/planet-cartography/manifest.json", root); mkdirSync(dirname(manifestPath.pathname), { recursive: true }); writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${worlds.length} deterministic refined planetary assets.`);
