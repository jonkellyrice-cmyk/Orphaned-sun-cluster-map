import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url), args = new Set(process.argv.slice(2));
const manifest = JSON.parse(readFileSync(new URL("data/planet-cartography/manifest.json", root), "utf8"));
const coarseManifest = JSON.parse(readFileSync(new URL(manifest.sourceManifest, root), "utf8"));
const coarseByKey = new Map(coarseManifest.worlds.map((world) => [`${world.system}/${world.body}`, world]));
const fail = (message) => { throw new Error(message); };
const SETTLEMENT_SCALE_CLASSES = new Set(["superstructure", "metropolitan", "regional"]);
const CORRIDOR_CLASSES = new Set(["trunk", "primary", "regional"]);
const ROUTING_DOCTRINES = new Set(["direct", "ecological-avoidance", "least-resistance", "not-applicable"]);
if (manifest.schemaVersion !== 2 || manifest.worlds.length !== 43) fail("refined manifest must contain 43 schema-v2 worlds");
if (args.has("--accepted") && manifest.status !== "accepted-working-canon") fail("manifest is not accepted working canon");
if (new Set(manifest.worlds.map((world) => `${world.system}/${world.body}`)).size !== 43) fail("duplicate refined world identity");
for (const entry of manifest.worlds) {
  const text = readFileSync(new URL(entry.path, root), "utf8"), asset = JSON.parse(text), key = `${entry.system}/${entry.body}`, source = coarseByKey.get(key);
  if (!source) fail(`${key}: missing accepted coarse source`);
  if (createHash("sha256").update(text).digest("hex") !== entry.sha256) fail(`${key}: content hash mismatch`);
  if (Buffer.byteLength(text) !== entry.bytes) fail(`${key}: byte count mismatch`);
  if (args.has("--strict") && entry.bytes > 1_750_000) fail(`${key}: exceeds 1.75 MB orbital-view budget`);
  if (asset.system !== entry.system || asset.body !== entry.body || asset.sourceSeed !== source.seed || asset.sourceFingerprint !== source.inputFingerprint) fail(`${key}: canonical provenance mismatch`);
  if (args.has("--accepted") && asset.status !== "accepted-working-canon") fail(`${key}: asset is not accepted working canon`);
  if (asset.grid.latCount * asset.grid.lonCount !== asset.raster.elevationM.length) fail(`${key}: incomplete refined raster`);
  if (!asset.terrain.coastlines.length || !asset.terrain.elevationMesh.vertices.length || !asset.hydrology.rivers.length || !asset.regions.ecoregions.length) fail(`${key}: missing physical geometry`);
  if (asset.settlements.filter((site) => site.kind === "capital").length !== 1 || !asset.transportRoutes.length) fail(`${key}: incomplete civilization geometry`);
  if (!asset.ownerFaction || asset.civilizationProfile?.ownerFaction !== asset.ownerFaction) fail(`${key}: missing authoritative civilization ownership/profile`);
  if (asset.settlements.some((site) => !SETTLEMENT_SCALE_CLASSES.has(site.scaleClass))) fail(`${key}: missing or invalid settlement scale class`);
  if (asset.transportRoutes.some((route) => !CORRIDOR_CLASSES.has(route.corridorClass) || !ROUTING_DOCTRINES.has(route.routingDoctrine))) fail(`${key}: missing or invalid transport corridor metadata`);
  if (asset.transportRoutes.some((route) => route.mode === "surface" && route.routingDoctrine === "not-applicable")) fail(`${key}: surface route lacks a routing doctrine`);
  if (new Set(asset.gazetteer.map((feature) => feature.properName)).size !== asset.gazetteer.length) fail(`${key}: duplicate geographic name`);
  if (entry.body === "Eventide" && asset.gazetteer.some((feature) => feature.featureClass === "continent")) fail("Eventide cannot acquire a continent");
}
console.log(`Validated ${manifest.worlds.length} refined planetary assets (${manifest.status}).`);
