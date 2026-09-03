import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createAtlasBundle, sha256, snapshotOperational, snapshotPlanet } from "../scripts/atlas-snapshot.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = path.join(ROOT, "exports", "generated-maps.bundle.json");
const PLANET_MANIFEST = "data/planet-cartography/manifest.json";
const OPERATIONS_MANIFEST = "data/body-operations/manifest.json";

const read = (relative) => fs.readFileSync(path.join(ROOT, relative), "utf8");

function buildBundle() {
  const planetManifestText = read(PLANET_MANIFEST), operationsManifestText = read(OPERATIONS_MANIFEST);
  const planetManifest = JSON.parse(planetManifestText), operationsManifest = JSON.parse(operationsManifestText);
  const planetEntries = planetManifest.worlds.map((item) => snapshotPlanet(JSON.parse(read(item.path)), item.path, read(item.path)));
  const operationalEntries = operationsManifest.assets.map((item) => snapshotOperational(JSON.parse(read(item.path)), item.path, read(item.path)));
  return createAtlasBundle(planetEntries, operationalEntries, [
    { path: PLANET_MANIFEST, sha256: sha256(planetManifestText), modelVersion: planetManifest.modelVersion },
    { path: OPERATIONS_MANIFEST, sha256: sha256(operationsManifestText), modelVersion: operationsManifest.modelVersion },
  ]);
}

function main() {
  const output = `${JSON.stringify(buildBundle())}\n`;
  if (process.argv.includes("--check")) {
    if (!fs.existsSync(OUTPUT) || fs.readFileSync(OUTPUT, "utf8") !== output) {
      throw new Error("Frozen atlas snapshot is stale. Run npm run atlas:snapshot.");
    }
    console.log(`[atlas:snapshot] verified ${JSON.parse(output).counts.total} frozen reference sheets`);
    return;
  }
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, output);
  const counts = JSON.parse(output).counts;
  console.log(`[atlas:snapshot] wrote ${path.relative(ROOT, OUTPUT)} (${counts.planetary} planetary + ${counts.operational} operational = ${counts.total})`);
}

main();
