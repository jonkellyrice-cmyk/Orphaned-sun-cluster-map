#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { parseCsv } from "../scripts/system-data.mjs";
import {
  ATMOSPHERE_MODEL_VERSION,
  deriveAtmosphereMetadata,
  validateRaHabitableAtmosphere,
} from "../scripts/atmosphere.mjs";

const rows = parseCsv(readFileSync(new URL("../docs/system-orbital-distances.csv", import.meta.url), "utf8"));
const seededWorlds = rows.filter((row) => row.geography_seed);
if (seededWorlds.length !== 43) throw new Error(`Expected 43 Ra-seeded terrestrial worlds; found ${seededWorlds.length}`);

const failures = [];
const habitableSummary = [];
for (const row of seededWorlds) {
  const validation = validateRaHabitableAtmosphere(row);
  if (!validation.valid) failures.push(`${row.system}/${row.object}: ${validation.errors.join("; ")}`);
  const atmosphere = validation.atmosphere;
  habitableSummary.push({
    system: row.system,
    body: row.object,
    pressureAtm: atmosphere?.pressureAtm,
    pressurePsi: atmosphere?.pressurePsi,
    n2Pct: atmosphere?.dryCompositionPct?.N2,
    o2Pct: atmosphere?.dryCompositionPct?.O2,
    co2Pct: atmosphere?.dryCompositionPct?.CO2,
    o2PartialPressureAtm: atmosphere?.partialPressureAtm?.O2,
    co2PartialPressureAtm: atmosphere?.partialPressureAtm?.CO2,
    ozone: atmosphere?.ozone?.profile,
    magnetosphere: atmosphere?.magneticProtection?.profile,
  });
}

for (const row of rows) {
  const atmosphere = deriveAtmosphereMetadata(row);
  if (!atmosphere) continue;
  const hasComposition = atmosphere.dryCompositionPct && Object.keys(atmosphere.dryCompositionPct).length > 0;
  const hasSpecies = Array.isArray(atmosphere.dominantSpecies) && atmosphere.dominantSpecies.length > 0;
  const airless = atmosphere.atmosphericClass === "airless";
  if (!hasComposition && !hasSpecies && !airless) failures.push(`${row.system}/${row.object}: atmosphere lacks composition/species classification`);
}

if (failures.length) throw new Error(`Atmosphere validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);

console.log(JSON.stringify({
  modelVersion: ATMOSPHERE_MODEL_VERSION,
  validatedRaSeededWorlds: seededWorlds.length,
  status: "passed",
  worlds: habitableSummary,
}, null, 2));
