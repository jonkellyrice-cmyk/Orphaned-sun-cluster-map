import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseCsv } from "../scripts/system-data.mjs";
import {
  ATMOSPHERE_MODEL_VERSION,
  deriveAtmosphereMetadata,
  validateRaHabitableAtmosphere,
} from "../scripts/atmosphere.mjs";

const rows = parseCsv(readFileSync(new URL("../docs/system-orbital-distances.csv", import.meta.url), "utf8"));
const seededWorlds = rows.filter((row) => row.geography_seed);

function naturalBodyWithAtmosphere(row) {
  const type = String(row.type ?? "").toLowerCase();
  if (!String(row.atmosphere_profile ?? "").trim() && String(row.atmosphere_pressure_atm ?? "").trim() === "") return false;
  if (type.includes("star") || type === "barycenter" || type.includes("belt") || type.includes("anomaly") || type.includes("field")) return false;
  if (["station", "installation", "shipyard", "vessel", "fleet", "carrier", "blinkgate", "megastructure", "tether", "array"].some((token) => type.includes(token))) return false;
  return true;
}

test("all 43 Ra-seeded terrestrial worlds have varied, conservative life-compatible atmospheres", () => {
  assert.equal(seededWorlds.length, 43, "canonical geography registry must still contain exactly 43 Ra-seeded terrestrial worlds");

  const pressures = new Set();
  const oxygenFractions = new Set();
  for (const row of seededWorlds) {
    const result = validateRaHabitableAtmosphere(row);
    assert.equal(result.valid, true, `${row.system}/${row.object}: ${result.errors.join("; ")}`);
    assert.equal(result.atmosphere.modelVersion, ATMOSPHERE_MODEL_VERSION);
    assert.equal(result.atmosphere.breathability.longTermUnassistedHumanCompatible, true);
    assert.equal(result.atmosphere.ozone.present, true);
    assert.equal(result.atmosphere.magneticProtection.sufficientForLongTermSurfaceLife, true);
    pressures.add(result.atmosphere.pressureAtm);
    oxygenFractions.add(result.atmosphere.dryCompositionPct.O2);
  }

  assert.ok(pressures.size >= 10, `expected meaningful canonical pressure variation; found ${pressures.size} distinct pressures`);
  assert.ok(oxygenFractions.size >= 10, `expected oxygen fraction to adapt to differing pressures; found ${oxygenFractions.size} distinct fractions`);
});

test("atmospheric derivation is deterministic and preserves canonical numeric pressure", () => {
  for (const row of rows.filter(naturalBodyWithAtmosphere)) {
    const first = deriveAtmosphereMetadata(row);
    const second = deriveAtmosphereMetadata(row);
    assert.deepEqual(first, second, `${row.system}/${row.object} atmospheric derivation changed between identical calls`);

    const canonicalPressure = Number(row.atmosphere_pressure_atm);
    if (row.atmosphere_pressure_atm !== "" && Number.isFinite(canonicalPressure)) {
      assert.equal(first.pressureAtm, canonicalPressure, `${row.system}/${row.object} changed canonical atmospheric pressure`);
    }
  }
});

test("every natural body with an established atmosphere gets a usable composition classification", () => {
  for (const row of rows.filter(naturalBodyWithAtmosphere)) {
    const atmosphere = deriveAtmosphereMetadata(row);
    assert.ok(atmosphere, `${row.system}/${row.object} returned no atmosphere metadata`);
    const hasNumericComposition = atmosphere.dryCompositionPct && Object.keys(atmosphere.dryCompositionPct).length > 0;
    const hasDominantSpecies = Array.isArray(atmosphere.dominantSpecies) && atmosphere.dominantSpecies.length > 0;
    const isAirless = atmosphere.atmosphericClass === "airless";
    assert.ok(hasNumericComposition || hasDominantSpecies || isAirless, `${row.system}/${row.object} has neither composition, species, nor airless classification`);
  }
});

test("known nonhabitable atmosphere cases remain nonhabitable", () => {
  const eileanVolna = rows.find((row) => row.object === "Eilean Volna");
  const eileanAtmosphere = deriveAtmosphereMetadata(eileanVolna);
  assert.equal(eileanAtmosphere.breathability.longTermUnassistedHumanCompatible, false);
  assert.match(eileanAtmosphere.breathability.classification, /respirator/i);
  assert.ok(eileanAtmosphere.partialPressureAtm.O2 < 0.1);

  const tribune = rows.find((row) => row.object === "Tribune");
  const tribuneAtmosphere = deriveAtmosphereMetadata(tribune);
  assert.equal(tribuneAtmosphere.breathability.longTermUnassistedHumanCompatible, false);
  assert.ok(tribuneAtmosphere.dryCompositionPct.H2 > 70);
});
