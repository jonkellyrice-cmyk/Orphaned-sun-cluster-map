#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "../scripts/system-data.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CSV_PATH = path.join(ROOT, "docs/system-orbital-distances.csv");
const CARTOGRAPHY_MANIFEST_PATH = path.join(ROOT, "data/planet-cartography/manifest.json");
const SETTLEMENT_SOURCE_PATH = path.join(ROOT, "scripts/cartography-settlements.mjs");
const OUTPUT_PATH = path.join(ROOT, "artifacts/planetary-civilization-metadata-audit.json");
const EXPECTED_WORLD_COUNT = 43;

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const key = (system, body) => `${system}/${body}`;
const fail = (message) => { throw new Error(`[planetary-civilization-audit] ${message}`); };

const rows = parseCsv(fs.readFileSync(CSV_PATH, "utf8"));
const seededRows = rows.filter((row) => row.geography_seed);
const cartographyManifest = readJson(CARTOGRAPHY_MANIFEST_PATH);
if (seededRows.length !== EXPECTED_WORLD_COUNT) fail(`Expected ${EXPECTED_WORLD_COUNT} geography-seeded worlds; found ${seededRows.length}.`);
if (cartographyManifest.worlds?.length !== EXPECTED_WORLD_COUNT) fail(`Expected ${EXPECTED_WORLD_COUNT} cartography assets; found ${cartographyManifest.worlds?.length}.`);

const rowByKey = new Map(seededRows.map((row) => [key(row.system, row.object), row]));
const assets = cartographyManifest.worlds.map((entry) => {
  const sourceRow = rowByKey.get(key(entry.system, entry.body));
  if (!sourceRow) fail(`${entry.system}/${entry.body}: no geography-seeded CSV source row.`);
  const asset = readJson(path.join(ROOT, entry.path));
  return { entry, sourceRow, asset };
});

const jinyara = assets.find(({ entry }) => entry.system === "Thebes" && entry.body === "Jinyara");
if (!jinyara) fail("Jinyara cartography asset was not found.");

const settlementSource = fs.readFileSync(SETTLEMENT_SOURCE_PATH, "utf8");
const expectedLegacyPathFormula = "const step = 1 + Math.abs(next.elevationM - cell.elevationM) / 450 + Math.max(0, next.elevationM - 1_800) / 4_000;";
const expectedLegacyHierarchy = "kind: surface ? (index < 7 ? \"primary surface corridor\" : \"regional surface corridor\") : \"sea/air lane\"";

const fieldPresence = {
  assetOwnerFaction: assets.filter(({ asset }) => typeof asset.ownerFaction === "string" && asset.ownerFaction.length > 0).length,
  settlementScaleClass: assets.flatMap(({ asset }) => asset.settlements ?? []).filter((site) => site.scaleClass != null).length,
  routeCorridorClass: assets.flatMap(({ asset }) => asset.transportRoutes ?? []).filter((route) => route.corridorClass != null).length,
  routeRoutingDoctrine: assets.flatMap(({ asset }) => asset.transportRoutes ?? []).filter((route) => route.routingDoctrine != null).length,
};

const settlementCounts = assets.map(({ entry, asset }) => ({ system: entry.system, body: entry.body, count: asset.settlements?.length ?? 0 }));
const routeCounts = assets.map(({ entry, asset }) => ({ system: entry.system, body: entry.body, count: asset.transportRoutes?.length ?? 0 }));
const ownerFactionCounts = [...seededRows.reduce((map, row) => map.set(row.owner_faction || "(blank)", (map.get(row.owner_faction || "(blank)") ?? 0) + 1), new Map()).entries()].sort((a, b) => a[0].localeCompare(b[0]));
const roles = [...new Set(assets.flatMap(({ asset }) => (asset.settlements ?? []).map((site) => site.role)))].sort();
const routeKinds = [...new Set(assets.flatMap(({ asset }) => (asset.transportRoutes ?? []).map((route) => route.kind)))].sort();

const jinyaraRow = jinyara.sourceRow;
const jinyaraAsset = jinyara.asset;
const report = {
  generatedAt: new Date().toISOString(),
  worldCount: assets.length,
  schemaVersion: cartographyManifest.schemaVersion,
  exemplar: {
    system: "Thebes",
    body: "Jinyara",
    ownerFactionUpstream: jinyaraRow.owner_faction,
    upstreamCivilizationMetadata: {
      settlementPattern: jinyaraRow.settlement_pattern,
      dominantSettlementPattern: jinyaraRow.dominant_settlement_pattern,
      majorPopulationCorridors: jinyaraRow.major_population_corridors,
      urbanConcentration: jinyaraRow.urban_concentration,
      majorCityCountBand: jinyaraRow.major_city_count_band,
      likelyTransportGeography: jinyaraRow.likely_transport_geography,
    },
    generatedSettlementCount: jinyaraAsset.settlements?.length ?? 0,
    generatedRouteCount: jinyaraAsset.transportRoutes?.length ?? 0,
    settlementRoles: [...new Set((jinyaraAsset.settlements ?? []).map((site) => site.role))].sort(),
    routeKinds: [...new Set((jinyaraAsset.transportRoutes ?? []).map((route) => route.kind))].sort(),
    settlementSampleKeys: Object.keys(jinyaraAsset.settlements?.[0] ?? {}).sort(),
    routeSampleKeys: Object.keys(jinyaraAsset.transportRoutes?.[0] ?? {}).sort(),
  },
  allWorlds: {
    ownerFactionCounts,
    settlementCountRange: [Math.min(...settlementCounts.map((item) => item.count)), Math.max(...settlementCounts.map((item) => item.count))],
    routeCountRange: [Math.min(...routeCounts.map((item) => item.count)), Math.max(...routeCounts.map((item) => item.count))],
    settlementRoles: roles,
    routeKinds,
    fieldPresence,
  },
  generatorAudit: {
    sharedLeastResistanceSurfacePath: settlementSource.includes(expectedLegacyPathFormula),
    indexBasedPrimaryRegionalHierarchy: settlementSource.includes(expectedLegacyHierarchy),
    referencesOwnerFaction: /ownerFaction|owner_faction/.test(settlementSource),
    referencesRoutingDoctrine: /routingDoctrine/.test(settlementSource),
  },
  gaps: [
    "Generated settlements have role/kind/location but no explicit physical scale class for built-environment magnitude.",
    "Generated transport routes have kind/mode/geometry but no explicit corridor scale class tied to endpoint settlement magnitude.",
    "Authoritative owner_faction exists upstream but is not propagated into planetary cartography assets.",
    "Surface-road routing currently uses one shared terrain-cost pathfinder for every faction; Mandate directness and Conclave ecological avoidance are not represented.",
    "Authoritative settlement/transport descriptors already exist upstream and can be propagated rather than inventing a parallel lore source.",
  ],
};

fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`);

console.log(`Planetary cartography assets: ${report.worldCount}`);
console.log(`Jinyara owner faction upstream: ${report.exemplar.ownerFactionUpstream}`);
console.log(`Jinyara settlements/routes: ${report.exemplar.generatedSettlementCount}/${report.exemplar.generatedRouteCount}`);
console.log(`All-world settlement count range: ${report.allWorlds.settlementCountRange.join("–")}`);
console.log(`All-world route count range: ${report.allWorlds.routeCountRange.join("–")}`);
console.log(`Existing settlement roles: ${roles.join(" | ")}`);
console.log(`Existing route kinds: ${routeKinds.join(" | ")}`);
console.log(`Assets carrying ownerFaction: ${fieldPresence.assetOwnerFaction}/${assets.length}`);
console.log(`Settlements carrying scaleClass: ${fieldPresence.settlementScaleClass}`);
console.log(`Routes carrying corridorClass: ${fieldPresence.routeCorridorClass}`);
console.log(`Routes carrying routingDoctrine: ${fieldPresence.routeRoutingDoctrine}`);
console.log(`Single shared least-resistance surface pathfinder: ${report.generatorAudit.sharedLeastResistanceSurfacePath}`);
console.log(`Faction routing referenced by generator: ${report.generatorAudit.referencesOwnerFaction || report.generatorAudit.referencesRoutingDoctrine}`);
console.log("\nUpstream Jinyara civilization metadata:");
for (const [name, value] of Object.entries(report.exemplar.upstreamCivilizationMetadata)) console.log(`  ${name}: ${value}`);
console.log("\nIdentified gaps:");
for (const gap of report.gaps) console.log(`  - ${gap}`);
