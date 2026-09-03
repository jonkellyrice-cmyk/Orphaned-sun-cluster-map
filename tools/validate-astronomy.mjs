import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { buildSystemModel, parseCsv } from "../scripts/system-data.mjs";
import { DAY_MS, UNION_EPOCH_MS } from "../scripts/universal-time.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rows = parseCsv(await readFile(path.join(root, "docs", "system-orbital-distances.csv"), "utf8"));
const orientations = JSON.parse(await readFile(path.join(root, "data", "astronomy", "epoch-orientations.json"), "utf8")).orientations;
const systems = [...new Set(rows.map((row) => row.system))];
const warnings = [];

for (const row of rows) {
  if (!row.tidally_locked.toLowerCase().startsWith("yes")) continue;
  const orbitDays = Number(row.moon_orbital_period_days || row.orbital_period_days);
  const spinDays = Number(row.rotation_hours) / 24;
  if (orbitDays > 0 && spinDays > 0 && Math.abs(spinDays / orbitDays - 1) > .01) {
    warnings.push(`${row.system}/${row.object}: established rotation ${row.rotation_hours} h differs from synchronous orbital period ${orbitDays} d; runtime facing follows the established tidal-lock flag.`);
  }
}

for (const system of systems) {
  for (const timestamp of [UNION_EPOCH_MS, UNION_EPOCH_MS + 10 * 365.25 * DAY_MS, UNION_EPOCH_MS - 5 * 365.25 * DAY_MS]) {
    const model = buildSystemModel(rows, system, { referenceTimestampMs: timestamp, orientations });
    assert.equal(model.objects.length, rows.filter((row) => row.system === system).length);
    for (const object of model.objects) {
      assert.ok(Object.values(object.physical).every(Number.isFinite), `${system}/${object.name} has invalid physical coordinates`);
      assert.ok(Number.isFinite(object.rotationState.rotationDeg), `${system}/${object.name} has invalid rotation`);
    }
  }
}

console.log(`Validated ${rows.length} objects across ${systems.length} systems at epoch, +10 years, and -5 years.`);
for (const warning of warnings) console.warn(`WARNING: ${warning}`);
console.log(`${warnings.length} preserved canonical tidal-period warning(s).`);
