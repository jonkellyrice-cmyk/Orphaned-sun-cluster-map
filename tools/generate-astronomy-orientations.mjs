import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createRng } from "../scripts/planet-geography.mjs";
import { classifySystemObject, parseCsv } from "../scripts/system-data.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(root, "data", "astronomy", "epoch-orientations.json");
const check = process.argv.includes("--check");
const rows = parseCsv(await readFile(path.join(root, "docs", "system-orbital-distances.csv"), "utf8"));
const naturalClasses = new Set(["planet", "giant", "moon"]);
const slug = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const angle = (seed, salt) => Number((createRng(`${seed}|${salt}`)() * 360).toFixed(9));

const orientations = {};
for (const row of rows) {
  const objectClass = classifySystemObject(row.type);
  if (!naturalClasses.has(objectClass) || !(Number(row.rotation_hours) > 0)) continue;
  const id = slug(`${row.system}:${row.object}`);
  const stableSeed = row.geography_seed || [row.system, row.object, row.type, row.parent, row.distance_from_parent, row.reference_phase_deg, row.rotation_hours].join("|");
  const tidallyLocked = row.tidally_locked.toLowerCase().startsWith("yes");
  orientations[id] = {
    ...(tidallyLocked ? {} : { spinPhaseAtEpochDeg: angle(stableSeed, "rotation-epoch-phase-v1") }),
    axialSeasonPhaseAtEpochDeg: angle(stableSeed, "axial-season-phase-v1"),
    spinPhaseProvenance: tidallyLocked ? "DERIVED: synchronous tidal lock to orbital geometry" : "DETERMINISTIC WORKING CANON: stable body seed + rotation-epoch-phase-v1",
    axialSeasonPhaseProvenance: "DETERMINISTIC WORKING CANON: stable body seed + axial-season-phase-v1",
    seedBasis: row.geography_seed ? "ESTABLISHED: geography_seed" : "DERIVED: immutable canonical identity fingerprint",
  };
}

const values = Object.values(orientations);
const freeSpins = values.flatMap((entry) => entry.spinPhaseAtEpochDeg == null ? [] : [entry.spinPhaseAtEpochDeg]);
assert(freeSpins.length >= 40, "Expected the canonical registry's free rotators");
assert(new Set(freeSpins.map((value) => Math.floor(value / 15))).size >= 12, "Generated spin phases are pathologically clustered");
assert(freeSpins.every((value) => value >= 0 && value < 360), "Spin phase outside [0, 360)");

const document = `${JSON.stringify({
  schemaVersion: 1,
  epoch: "5016-09-03T10:38:00.000Z Cradle Standard Reckoning",
  modelVersion: "kepler-snapshot-v1",
  note: "Only genuinely unconstrained epoch orientations are generated. Registry periods, tilts, reference orbital phases, and tidal locks remain authoritative.",
  orientations,
}, null, 2)}\n`;

if (check) {
  assert.equal(await readFile(outputPath, "utf8"), document, "Astronomy orientation catalog is stale; run npm run astronomy:generate");
} else {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, document);
  console.log(`Wrote ${Object.keys(orientations).length} deterministic orientation records to ${path.relative(root, outputPath)}.`);
}
