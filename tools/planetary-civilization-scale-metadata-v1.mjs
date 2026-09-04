#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APPLY = process.argv.includes("--apply");
const CHECK = process.argv.includes("--check");
if (APPLY === CHECK) throw new Error("Use exactly one of --apply or --check.");

const SETTLEMENTS_PATH = path.join(ROOT, "scripts/cartography-settlements.mjs");
const GENERATOR_PATH = path.join(ROOT, "tools/generate-planet-cartography.mjs");
const SNAPSHOT_PATH = path.join(ROOT, "scripts/atlas-snapshot.mjs");
const TEST_PATH = path.join(ROOT, "tests/cartography-settlements.test.mjs");
const VALIDATOR_PATH = path.join(ROOT, "tools/validate-planet-cartography.mjs");
const AUDIT_PATH = path.join(ROOT, "tools/audit-planetary-civilization-metadata.mjs");
const MANIFEST_PATH = path.join(ROOT, "data/planet-cartography/manifest.json");
const EXPECTED_WORLDS = 43;
const EXPECTED_SETTLEMENTS = 43 * 18;
const EXPECTED_ROUTES = 43 * 17;

function fail(message) {
  throw new Error(`[planetary-civilization-scale-metadata-v1] ${message}`);
}

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function replaceOnce(source, before, after, label) {
  if (source.includes(after)) return source;
  const count = source.split(before).length - 1;
  if (count !== 1) fail(`${label}: expected exactly one source anchor, found ${count}.`);
  return source.replace(before, after);
}

function replaceBlock(source, startMarker, endMarker, replacement, sentinel, label) {
  if (source.includes(sentinel)) return source;
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) fail(`${label}: expected source block was not found.`);
  if (source.indexOf(startMarker, start + 1) >= 0) fail(`${label}: start marker is not unique.`);
  return source.slice(0, start) + replacement + source.slice(end);
}

function patchSettlements(source) {
  const angularDistance = `function angularDistance(a, b) {\n  const dx = Math.min(Math.abs(a.lon - b.lon), 360 - Math.abs(a.lon - b.lon)) * Math.cos((a.lat + b.lat) * Math.PI / 360);\n  return Math.hypot(a.lat - b.lat, dx);\n}`;
  const helpers = `${angularDistance}\n\nconst ECOLOGY_ROUTE_PENALTY = new Map([\n  ["tropical-rainforest", 4.0],\n  ["temperate-rainforest", 3.5],\n  ["seasonal-forest", 2.6],\n  ["temperate-forest", 2.6],\n  ["taiga", 1.8],\n  ["savanna", 0.8],\n  ["tundra", 0.6],\n]);\n\nfunction settlementScaleClass(role, index) {\n  if (["planetary capital", "major city", "major port city"].includes(role)) return "superstructure";\n  return index < 12 ? "metropolitan" : "regional";\n}\n\nfunction corridorClass(origin, destination) {\n  const scales = new Set([origin.scaleClass, destination.scaleClass]);\n  if (origin.scaleClass === "superstructure" && destination.scaleClass === "superstructure") return "trunk";\n  if (scales.has("superstructure") || scales.has("metropolitan")) return "primary";\n  return "regional";\n}\n\nexport function routingDoctrineForFaction(ownerFaction = "") {\n  const owner = String(ownerFaction).toLowerCase();\n  if (owner.includes("xuanjia") || owner.includes("mandate")) return "direct";\n  if (owner.includes("adanian") || owner.includes("conclave")) return "ecological-avoidance";\n  return "least-resistance";\n}\n\nfunction routingStepCost(cell, next, routingDoctrine) {\n  const reliefPenalty = Math.abs(next.elevationM - cell.elevationM) / 450;\n  const altitudePenalty = Math.max(0, next.elevationM - 1_800) / 4_000;\n  if (routingDoctrine === "direct") {\n    // Mandate corridors privilege geometric directness; terrain remains a weak engineering cost rather than a controlling obstacle.\n    return 1 + reliefPenalty * 0.08 + altitudePenalty * 0.08;\n  }\n  const baseline = 1 + reliefPenalty + altitudePenalty;\n  if (routingDoctrine !== "ecological-avoidance") return baseline;\n  // Conclave corridors preserve natural systems where practical, accepting detours around high-value living terrain and drainage.\n  const biomePenalty = ECOLOGY_ROUTE_PENALTY.get(next.biome) ?? 0;\n  const freshwaterPenalty = next.flowAccumulation > 6 ? 0.9 : next.flowAccumulation > 3 ? 0.35 : 0;\n  const fertilePenalty = ["alluvial-fertile", "volcanic-fertile", "temperate-loam"].includes(next.soil) ? 0.45 : 0;\n  return baseline + biomePenalty + freshwaterPenalty + fertilePenalty;\n}`;
  let next = replaceOnce(source, angularDistance, helpers, "civilization scale/doctrine helpers");
  next = replaceOnce(next, "function surfacePath(cells, grid, start, goal) {", "function surfacePath(cells, grid, start, goal, routingDoctrine = \"least-resistance\") {", "surfacePath doctrine parameter");
  next = replaceOnce(
    next,
    "      const step = 1 + Math.abs(next.elevationM - cell.elevationM) / 450 + Math.max(0, next.elevationM - 1_800) / 4_000;",
    "      const step = routingStepCost(cell, next, routingDoctrine);",
    "surfacePath doctrine cost",
  );
  next = replaceOnce(
    next,
    "export function buildSettlementCartography({ coarse, hydrology, regions, gazetteer, siteCount = 18 }) {",
    "export function buildSettlementCartography({ coarse, hydrology, regions, gazetteer, ownerFaction = \"\", siteCount = 18 }) {",
    "civilization owner faction input",
  );
  const siteBlock = `  const siteFeatures = selected.map((cell, index) => {\n    const role = index === 0 ? "planetary capital" : (cell.drivers.includes("coastal access") && index % 3 === 0 ? "major port city" : index < 6 ? "major city" : "regional city");\n    return {\n      id: \`settlement-\${index + 1}\`,\n      featureClass: index === 0 ? "capital" : (role === "major port city" ? "port" : "city"),\n      kind: index === 0 ? "capital" : "city",\n      role,\n      scaleClass: settlementScaleClass(role, index),\n      lat: cell.lat,\n      lon: cell.lon,\n      at: [cell.lat, cell.lon],\n      cellId: cell.id,\n      landComponent: components[cell.id],\n      suitability: cell.settlementSuitability,\n      drivers: cell.drivers,\n    };\n  });\n`;
  next = replaceBlock(next, "  const siteFeatures = selected.map((cell, index) => ({", "  const settlements = assignFeatureNames", siteBlock, "scaleClass: settlementScaleClass(role, index)", "settlement scale classification");
  const routeBlock = `  const routeFeatures = [];\n  const routingDoctrine = routingDoctrineForFaction(ownerFaction);\n  for (let index = 1; index < settlements.length; index += 1) {\n    const destination = settlements[index], origin = settlements.slice(0, index).sort((a, b) => angularDistance(a, destination) - angularDistance(b, destination) || a.id.localeCompare(b.id))[0];\n    const surface = origin.landComponent === destination.landComponent ? surfacePath(cells, grid, cells[origin.cellId], cells[destination.cellId], routingDoctrine) : null;\n    routeFeatures.push({\n      id: \`transport-\${routeFeatures.length + 1}\`,\n      featureClass: "road",\n      kind: surface ? (index < 7 ? "primary surface corridor" : "regional surface corridor") : "sea/air lane",\n      mode: surface ? "surface" : "sea-or-air",\n      from: origin.id,\n      to: destination.id,\n      points: surface ?? seaLane(origin, destination),\n      distanceDeg: Number(angularDistance(origin, destination).toFixed(3)),\n      corridorClass: corridorClass(origin, destination),\n      routingDoctrine: surface ? routingDoctrine : "not-applicable",\n    });\n  }\n`;
  next = replaceBlock(next, "  const routeFeatures = [];", "  const routes = assignFeatureNames", routeBlock, "routingDoctrine: surface ? routingDoctrine : \"not-applicable\"", "corridor hierarchy and routing doctrine");
  next = replaceOnce(
    next,
    "  return { schemaVersion: 1, modelVersion: \"orphaned-sun-cartography-v1\", sourceFingerprint: coarse.inputFingerprint, sourceSeed: coarse.seed, system: coarse.system, body: coarse.body, settlements, routes };",
    "  return { schemaVersion: 1, modelVersion: \"orphaned-sun-cartography-v1\", sourceFingerprint: coarse.inputFingerprint, sourceSeed: coarse.seed, system: coarse.system, body: coarse.body, ownerFaction, routingDoctrine, settlements, routes };",
    "civilization metadata return",
  );
  return next;
}

function patchGenerator(source) {
  let next = source;
  next = replaceOnce(
    next,
    'import { buildSettlementCartography } from "../scripts/cartography-settlements.mjs";',
    'import { buildSettlementCartography } from "../scripts/cartography-settlements.mjs";\nimport { parseCsv } from "../scripts/system-data.mjs";',
    "registry parser import",
  );
  next = replaceOnce(
    next,
    'const root = new URL("../", import.meta.url), coarseManifest = JSON.parse(readFileSync(new URL("data/planet-geography/manifest.json", root), "utf8"));',
    'const root = new URL("../", import.meta.url), coarseManifest = JSON.parse(readFileSync(new URL("data/planet-geography/manifest.json", root), "utf8"));\nconst registryRows = parseCsv(readFileSync(new URL("docs/system-orbital-distances.csv", root), "utf8"));\nconst registryByWorld = new Map(registryRows.map((row) => [`${row.system}\\u0000${row.object}`, row]));',
    "planetary registry index",
  );
  next = replaceOnce(
    next,
    '  const gazetteer = buildNamedGeography({ coarse, terrain, hydrology, regions });\n  const civilization = buildSettlementCartography({ coarse, hydrology, regions, gazetteer });',
    '  const gazetteer = buildNamedGeography({ coarse, terrain, hydrology, regions });\n  const registryRow = registryByWorld.get(`${coarse.system}\\u0000${coarse.body}`);\n  if (!registryRow) throw new Error(`Missing canonical registry row for ${coarse.system}/${coarse.body}`);\n  const civilizationProfile = {\n    ownerFaction: registryRow.owner_faction,\n    settlementPattern: registryRow.settlement_pattern || "",\n    dominantSettlementPattern: registryRow.dominant_settlement_pattern || "",\n    majorPopulationCorridors: registryRow.major_population_corridors || "",\n    urbanConcentration: registryRow.urban_concentration || "",\n    majorCityCountBand: registryRow.major_city_count_band || "",\n    likelyTransportGeography: registryRow.likely_transport_geography || "",\n  };\n  const civilization = buildSettlementCartography({ coarse, hydrology, regions, gazetteer, ownerFaction: registryRow.owner_faction });',
    "authoritative civilization profile propagation",
  );
  next = replaceOnce(
    next,
    '    body: coarse.body,\n    sourceSeed: coarse.seed,',
    '    body: coarse.body,\n    ownerFaction: registryRow.owner_faction,\n    civilizationProfile,\n    sourceSeed: coarse.seed,',
    "cartography civilization metadata fields",
  );
  return next;
}

function patchSnapshot(source) {
  let next = source;
  next = replaceOnce(
    next,
    '    `# ${world.body} — Frozen Cartographic Reference`, "", `- System: ${world.system}`,\n    `- Projection: Equirectangular`,',
    '    `# ${world.body} — Frozen Cartographic Reference`, "", `- System: ${world.system}`, `- Owner faction: ${world.ownerFaction}`,\n    `- Projection: Equirectangular`,',
    "packet owner faction",
  );
  next = replaceOnce(
    next,
    '    "Treat the attached snapshot as structurally authoritative. Preserve the relative positions and topology of continents, coastlines, named regions, waterways, settlements, and routes. Add fine visual detail and polish without relocating or replacing established features.", "",\n    "## Legend",',
    '    "Treat the attached snapshot as structurally authoritative. Preserve the relative positions and topology of continents, coastlines, named regions, waterways, settlements, and routes. Add fine visual detail and polish without relocating or replacing established features.", "",\n    "## Civilization profile", "",\n    `- Settlement pattern: ${world.civilizationProfile.settlementPattern}`,\n    `- Dominant settlement pattern: ${world.civilizationProfile.dominantSettlementPattern}`,\n    `- Major population corridors: ${world.civilizationProfile.majorPopulationCorridors}`,\n    `- Urban concentration: ${world.civilizationProfile.urbanConcentration}`,\n    `- Major city count band: ${world.civilizationProfile.majorCityCountBand}`,\n    `- Likely transport geography: ${world.civilizationProfile.likelyTransportGeography}`, "",\n    "## Legend",',
    "packet civilization profile",
  );
  next = replaceOnce(
    next,
    '    ...world.settlements.map((item, index) => `${index + 1}. **${item.properName}** — ${item.role}; ${item.kind}; ${item.lat}°, ${item.lon}°`), "",',
    '    ...world.settlements.map((item, index) => `${index + 1}. **${item.properName}** — ${item.role}; ${item.kind}; built-environment scale: ${item.scaleClass}; ${item.lat}°, ${item.lon}°`), "",',
    "packet settlement scale metadata",
  );
  next = replaceOnce(
    next,
    '  lines.push("## Transport routes", "", ...world.transportRoutes.map((item) => `- **${item.properName}** — ${item.kind}; ${item.from} → ${item.to}`), "");',
    '  lines.push("## Transport routes", "", ...world.transportRoutes.map((item) => `- **${item.properName}** — ${item.kind}; corridor scale: ${item.corridorClass}; routing doctrine: ${item.routingDoctrine}; ${item.from} → ${item.to}`), "");',
    "packet route scale/doctrine metadata",
  );
  return next;
}

function patchTests(source) {
  let next = source;
  next = replaceOnce(
    next,
    'import { buildSettlementCartography } from "../scripts/cartography-settlements.mjs";',
    'import { buildSettlementCartography } from "../scripts/cartography-settlements.mjs";\nimport { parseCsv } from "../scripts/system-data.mjs";',
    "settlement test registry import",
  );
  next = replaceOnce(
    next,
    'const manifest = JSON.parse(readFileSync(new URL("data/planet-geography/manifest.json", root), "utf8"));\nconst load = (body) => JSON.parse(readFileSync(new URL(manifest.worlds.find((world) => world.body === body).path, root), "utf8"));',
    'const manifest = JSON.parse(readFileSync(new URL("data/planet-geography/manifest.json", root), "utf8"));\nconst registry = parseCsv(readFileSync(new URL("docs/system-orbital-distances.csv", root), "utf8"));\nconst ownerByWorld = new Map(registry.map((row) => [`${row.system}\\u0000${row.object}`, row.owner_faction]));\nconst load = (body) => JSON.parse(readFileSync(new URL(manifest.worlds.find((world) => world.body === body).path, root), "utf8"));',
    "settlement test owner index",
  );
  next = replaceOnce(
    next,
    '  const coarse = load(body), terrain = buildRefinedTerrain(coarse), hydrology = buildRefinedHydrology(coarse, terrain), regions = buildCartographicRegions(coarse, hydrology), gazetteer = buildNamedGeography({ coarse, terrain, hydrology, regions });\n  const civilization = buildSettlementCartography({ coarse, hydrology, regions, gazetteer });\n  const result = { coarse, hydrology, regions, gazetteer, civilization }; cache.set(body, result); return result;',
    '  const coarse = load(body), terrain = buildRefinedTerrain(coarse), hydrology = buildRefinedHydrology(coarse, terrain), regions = buildCartographicRegions(coarse, hydrology), gazetteer = buildNamedGeography({ coarse, terrain, hydrology, regions });\n  const ownerFaction = ownerByWorld.get(`${coarse.system}\\u0000${coarse.body}`) ?? "";\n  const civilization = buildSettlementCartography({ coarse, hydrology, regions, gazetteer, ownerFaction });\n  const result = { coarse, hydrology, regions, gazetteer, ownerFaction, civilization }; cache.set(body, result); return result;',
    "settlement test owner propagation",
  );
  const append = `\n\ntest("settlements expose deterministic built-environment scale classes", () => {\n  const { civilization } = build("Jinyara");\n  const capital = civilization.settlements.find((site) => site.kind === "capital");\n  assert.equal(capital.scaleClass, "superstructure");\n  assert.ok(civilization.settlements.filter((site) => ["major city", "major port city"].includes(site.role)).every((site) => site.scaleClass === "superstructure"));\n  assert.ok(civilization.settlements.some((site) => site.scaleClass === "metropolitan"));\n  assert.ok(civilization.settlements.some((site) => site.scaleClass === "regional"));\n  assert.ok(civilization.routes.every((route) => ["trunk", "primary", "regional"].includes(route.corridorClass)));\n});\n\ntest("surface routes carry faction-specific routing doctrine", () => {\n  const mandate = build("Jinyara").civilization.routes.filter((route) => route.mode === "surface");\n  const conclave = build("Thessaron").civilization.routes.filter((route) => route.mode === "surface");\n  const accords = build("Kilmorov").civilization.routes.filter((route) => route.mode === "surface");\n  assert.ok(mandate.length && mandate.every((route) => route.routingDoctrine === "direct"));\n  assert.ok(conclave.length && conclave.every((route) => route.routingDoctrine === "ecological-avoidance"));\n  assert.ok(accords.length && accords.every((route) => route.routingDoctrine === "least-resistance"));\n});\n`;
  if (!next.includes('test("surface routes carry faction-specific routing doctrine"')) next += append;
  return next;
}

function patchValidator(source) {
  let next = source;
  next = replaceOnce(
    next,
    'const fail = (message) => { throw new Error(message); };',
    'const fail = (message) => { throw new Error(message); };\nconst SETTLEMENT_SCALE_CLASSES = new Set(["superstructure", "metropolitan", "regional"]);\nconst CORRIDOR_CLASSES = new Set(["trunk", "primary", "regional"]);\nconst ROUTING_DOCTRINES = new Set(["direct", "ecological-avoidance", "least-resistance", "not-applicable"]);',
    "cartography civilization validator enums",
  );
  next = replaceOnce(
    next,
    '  if (asset.settlements.filter((site) => site.kind === "capital").length !== 1 || !asset.transportRoutes.length) fail(`${key}: incomplete civilization geometry`);',
    '  if (asset.settlements.filter((site) => site.kind === "capital").length !== 1 || !asset.transportRoutes.length) fail(`${key}: incomplete civilization geometry`);\n  if (!asset.ownerFaction || asset.civilizationProfile?.ownerFaction !== asset.ownerFaction) fail(`${key}: missing authoritative civilization ownership/profile`);\n  if (asset.settlements.some((site) => !SETTLEMENT_SCALE_CLASSES.has(site.scaleClass))) fail(`${key}: missing or invalid settlement scale class`);\n  if (asset.transportRoutes.some((route) => !CORRIDOR_CLASSES.has(route.corridorClass) || !ROUTING_DOCTRINES.has(route.routingDoctrine))) fail(`${key}: missing or invalid transport corridor metadata`);\n  if (asset.transportRoutes.some((route) => route.mode === "surface" && route.routingDoctrine === "not-applicable")) fail(`${key}: surface route lacks a routing doctrine`);',
    "cartography civilization metadata validation",
  );
  return next;
}

function patchAudit(source) {
  let next = source;
  const marker = 'const routeKinds = [...new Set(assets.flatMap(({ asset }) => (asset.transportRoutes ?? []).map((route) => route.kind)))].sort();';
  const expanded = `${marker}\nconst totalSettlements = assets.reduce((sum, { asset }) => sum + (asset.settlements?.length ?? 0), 0);\nconst totalRoutes = assets.reduce((sum, { asset }) => sum + (asset.transportRoutes?.length ?? 0), 0);\nconst gaps = [];\nif (fieldPresence.assetOwnerFaction !== assets.length) gaps.push("Authoritative owner_faction is not propagated into every planetary cartography asset.");\nif (fieldPresence.settlementScaleClass !== totalSettlements) gaps.push("Not every generated settlement carries an explicit built-environment scale class.");\nif (fieldPresence.routeCorridorClass !== totalRoutes) gaps.push("Not every generated transport route carries an explicit corridor scale class.");\nif (fieldPresence.routeRoutingDoctrine !== totalRoutes) gaps.push("Not every generated transport route carries routing-doctrine metadata.");\nif (!/routingStepCost/.test(settlementSource) || !/routingDoctrineForFaction/.test(settlementSource)) gaps.push("Surface-road geometry does not yet apply faction-aware routing doctrine.");`;
  next = replaceOnce(next, marker, expanded, "audit dynamic gap calculation");
  const staticGaps = `  gaps: [\n    "Generated settlements have role/kind/location but no explicit physical scale class for built-environment magnitude.",\n    "Generated transport routes have kind/mode/geometry but no explicit corridor scale class tied to endpoint settlement magnitude.",\n    "Authoritative owner_faction exists upstream but is not propagated into planetary cartography assets.",\n    "Surface-road routing currently uses one shared terrain-cost pathfinder for every faction; Mandate directness and Conclave ecological avoidance are not represented.",\n    "Authoritative settlement/transport descriptors already exist upstream and can be propagated rather than inventing a parallel lore source.",\n  ],`;
  next = replaceOnce(next, staticGaps, "  gaps,", "audit current gaps");
  if (!next.includes('process.argv.includes("--strict")')) next += '\nif (process.argv.includes("--strict") && report.gaps.length) fail(`Audit still has ${report.gaps.length} civilization metadata gap(s).`);\n';
  return next;
}

const sourceTargets = [
  [SETTLEMENTS_PATH, patchSettlements(read(SETTLEMENTS_PATH))],
  [GENERATOR_PATH, patchGenerator(read(GENERATOR_PATH))],
  [SNAPSHOT_PATH, patchSnapshot(read(SNAPSHOT_PATH))],
  [TEST_PATH, patchTests(read(TEST_PATH))],
  [VALIDATOR_PATH, patchValidator(read(VALIDATOR_PATH))],
  [AUDIT_PATH, patchAudit(read(AUDIT_PATH))],
];

let differences = 0;
for (const [file, expected] of sourceTargets) {
  const current = read(file);
  if (current === expected) continue;
  differences += 1;
  const relative = path.relative(ROOT, file);
  if (CHECK) console.error(`OUT OF DATE: ${relative}`);
  else {
    fs.writeFileSync(file, expected);
    console.log(`UPDATED: ${relative}`);
  }
}

function run(command, args = []) {
  console.log(`[planetary-civilization-scale-metadata-v1] ${command} ${args.join(" ")}`.trim());
  execFileSync(command, args, { cwd: ROOT, stdio: "inherit" });
}

function verifyMaterializedMetadata() {
  const manifest = JSON.parse(read(MANIFEST_PATH));
  if (manifest.worlds?.length !== EXPECTED_WORLDS) fail(`Expected ${EXPECTED_WORLDS} cartography worlds; found ${manifest.worlds?.length}.`);
  let settlements = 0, routes = 0;
  for (const entry of manifest.worlds) {
    const asset = JSON.parse(read(path.join(ROOT, entry.path)));
    if (!asset.ownerFaction || !asset.civilizationProfile?.ownerFaction) fail(`${entry.system}/${entry.body}: civilization owner/profile missing.`);
    settlements += asset.settlements.length;
    routes += asset.transportRoutes.length;
    if (asset.settlements.some((site) => !["superstructure", "metropolitan", "regional"].includes(site.scaleClass))) fail(`${entry.system}/${entry.body}: settlement scale metadata incomplete.`);
    if (asset.transportRoutes.some((route) => !["trunk", "primary", "regional"].includes(route.corridorClass))) fail(`${entry.system}/${entry.body}: corridor scale metadata incomplete.`);
    if (asset.transportRoutes.some((route) => !["direct", "ecological-avoidance", "least-resistance", "not-applicable"].includes(route.routingDoctrine))) fail(`${entry.system}/${entry.body}: route doctrine metadata incomplete.`);
  }
  if (settlements !== EXPECTED_SETTLEMENTS) fail(`Expected ${EXPECTED_SETTLEMENTS} settlements; found ${settlements}.`);
  if (routes !== EXPECTED_ROUTES) fail(`Expected ${EXPECTED_ROUTES} routes; found ${routes}.`);
  console.log(`Verified ${EXPECTED_WORLDS} worlds / ${settlements} settlements / ${routes} routes.`);
}

if (CHECK && differences) process.exitCode = 1;
if (CHECK && differences) process.exit();

if (APPLY) {
  run("node", ["tools/generate-planet-cartography.mjs", "--accept"]);
  run("node", ["tools/export-atlas-snapshots.mjs"]);
}

verifyMaterializedMetadata();
run("npm", ["test"]);
run("node", ["tools/validate-planet-cartography.mjs", "--accepted", "--strict"]);
run("node", ["tools/export-atlas-snapshots.mjs", "--check"]);
run("node", ["tools/audit-planetary-civilization-metadata.mjs", "--strict"]);
console.log(`Planetary civilization scale metadata v1 is current: ${EXPECTED_WORLDS} worlds.`);
