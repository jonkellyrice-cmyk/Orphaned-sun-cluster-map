import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { applyNaturalBodyArtDirection } from "../scripts/atlas-art-direction.mjs";
import { createAtlasBundle, sha256, snapshotPlanet } from "../scripts/atlas-snapshot.mjs";
import { snapshotOperationalRich } from "../scripts/atlas-snapshot-v2.mjs";
import { buildArtificialBodyModel } from "../scripts/artificial-body-data.mjs";
import { buildNaturalBodyModel, naturalBodyKind } from "../scripts/natural-body-data.mjs";
import { parseCsv } from "../scripts/system-data.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = path.join(ROOT, "exports", "generated-maps.bundle.json");
const AUTHORITY_MANIFEST = path.join(ROOT, "exports", "generated-maps.manifest.json");
const PLANET_MANIFEST = "data/planet-cartography/manifest.json";
const OPERATIONS_MANIFEST = "data/body-operations/manifest.json";
const REGISTRY = "docs/system-orbital-distances.csv";

const read = (relative) => fs.readFileSync(path.join(ROOT, relative), "utf8");
const key = (system, body) => `${system}\u0000${body}`;

function fallbackOperationalPresentationModel(row, asset) {
  return {
    schemaVersion: 1,
    system: row.system,
    body: row.object,
    kind: asset.operationalKind,
    dimensions: row.dimensions_estimate || "schematic; exact dimensions unestablished",
    structureClass: row.structure_class || row.type,
    visualArchetype: row.visual_archetype || asset.operationalKind,
    palette: row.visual_palette || "campaign interface neutral",
    population: row.population_crew_scale || "operational population unspecified",
    gravity: row.artificial_gravity || "varies by occupied section",
    power: row.power_axiolith || "canonical infrastructure power",
    mobility: row.mobility || "fixed reference-epoch position",
    function: row.primary_function || row.resource_profile || "mapped infrastructure",
    strategicRole: row.strategic_role || row.resource_value || "local operations",
    presentationBasis: "canonical registry + body-operations operational taxonomy",
  };
}

function presentationModel(row, asset) {
  if (naturalBodyKind(row)) return buildNaturalBodyModel(row);
  try {
    return buildArtificialBodyModel(row, asset);
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    return fallbackOperationalPresentationModel(row, asset);
  }
}

function buildBundle() {
  const planetManifestText = read(PLANET_MANIFEST), operationsManifestText = read(OPERATIONS_MANIFEST);
  const planetManifest = JSON.parse(planetManifestText), operationsManifest = JSON.parse(operationsManifestText);
  const rows = parseCsv(read(REGISTRY));
  const rowByBody = new Map(rows.map((row) => [key(row.system, row.object), row]));
  const planetEntries = planetManifest.worlds.map((item) => snapshotPlanet(JSON.parse(read(item.path)), item.path, read(item.path)));
  const operationalEntries = operationsManifest.assets.map((item) => {
    const sourceText = read(item.path), asset = JSON.parse(sourceText);
    const row = rowByBody.get(key(asset.system, asset.body));
    if (!row) throw new Error(`Missing canonical registry row for ${asset.system}/${asset.body}`);
    return snapshotOperationalRich(asset, presentationModel(row, asset), item.path, sourceText);
  });
  return applyNaturalBodyArtDirection(createAtlasBundle(planetEntries, operationalEntries, [
    { path: PLANET_MANIFEST, sha256: sha256(planetManifestText), modelVersion: planetManifest.modelVersion },
    { path: OPERATIONS_MANIFEST, sha256: sha256(operationsManifestText), modelVersion: operationsManifest.modelVersion },
    { path: REGISTRY, sha256: sha256(read(REGISTRY)), modelVersion: "canonical-registry" },
  ]));
}

function authorityManifest(bundleText, bundle) {
  return `${JSON.stringify({
    schemaVersion: 1,
    authority: "jonkellyrice-cmyk/Orphaned-sun-cluster-map",
    branch: "main",
    bundlePath: "exports/generated-maps.bundle.json",
    bundleSha256: sha256(bundleText),
    bundleSchemaVersion: bundle.schemaVersion,
    counts: bundle.counts,
    sourceManifests: bundle.sourceManifests,
  })}\n`;
}

function main() {
  const bundle = buildBundle();
  const output = `${JSON.stringify(bundle)}\n`;
  const manifest = authorityManifest(output, bundle);
  if (process.argv.includes("--check")) {
    if (!fs.existsSync(OUTPUT) || fs.readFileSync(OUTPUT, "utf8") !== output) throw new Error("Frozen atlas snapshot is stale. Run npm run atlas:snapshot.");
    if (!fs.existsSync(AUTHORITY_MANIFEST) || fs.readFileSync(AUTHORITY_MANIFEST, "utf8") !== manifest) throw new Error("Generated Maps authority manifest is stale. Run npm run atlas:snapshot.");
    console.log(`[atlas:snapshot] verified ${bundle.counts.total} authoritative reference sheets + manifest`);
    return;
  }
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, output);
  fs.writeFileSync(AUTHORITY_MANIFEST, manifest);
  console.log(`[atlas:snapshot] wrote ${path.relative(ROOT, OUTPUT)} + ${path.relative(ROOT, AUTHORITY_MANIFEST)} (${bundle.counts.planetary} planetary + ${bundle.counts.operational} operational = ${bundle.counts.total})`);
}

main();
