import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { operationSeed, operationalKindForRow } from "../scripts/body-operations.mjs";
import { NATURAL_SOLID_SURVEY_MODEL_VERSION, deriveNaturalSolidProfile, naturalSolidFeaturePlan } from "../scripts/natural-solid-cartography.mjs";
import { parseCsv } from "../scripts/system-data.mjs";

const root = new URL("../", import.meta.url);
const rows = parseCsv(readFileSync(new URL("docs/system-orbital-distances.csv", root), "utf8"));
const solidRows = rows.filter((row) => operationalKindForRow(row) === "natural-solid");

const planFor = (row) => naturalSolidFeaturePlan(row, operationSeed(row.system, row.object, row.type));

test("natural-solid metadata profiles are bounded and deterministic", () => {
  assert.ok(solidRows.length > 10);
  for (const row of solidRows) {
    const first = deriveNaturalSolidProfile(row);
    const second = deriveNaturalSolidProfile(row);
    assert.deepEqual(first, second, `${row.system}/${row.object}`);
    assert.equal(first.modelVersion, NATURAL_SOLID_SURVEY_MODEL_VERSION);
    assert.ok(first.radiusKm > 0);
    for (const key of ["activityIndex", "radiationIndex", "exploitationIndex", "resourceIndex", "craterRetentionIndex"]) assert.ok(first[key] >= 0 && first[key] <= 1, `${row.object}:${key}`);
    assert.ok(first.surfaceFamily && first.craterRetentionLabel && first.volatileExpression);
  }
});

test("generated natural-solid feature plans are globally dispersed, bounded, and reproducible", () => {
  for (const row of solidRows) {
    const first = planFor(row), second = planFor(row);
    assert.deepEqual(first, second, `${row.system}/${row.object}`);
    assert.ok(first.features.length >= 7 && first.features.length <= 64, `${row.object}: ${first.features.length}`);
    for (const feature of first.features) {
      assert.ok(feature.position.lat >= -90 && feature.position.lat <= 90, `${row.object}:${feature.key}:lat`);
      assert.ok(feature.position.lon >= -180 && feature.position.lon < 180, `${row.object}:${feature.key}:lon`);
    }
    const naturalLandmarks = first.features.filter((feature) => ["crater", "basin", "ridge", "scarp", "rift", "volcanic", "dune", "ice", "deposit"].includes(feature.type));
    if (naturalLandmarks.length >= 8) {
      const lons = naturalLandmarks.map((feature) => feature.position.lon).sort((a, b) => a - b);
      assert.ok(lons.at(-1) - lons[0] > 150, `${row.object}: natural landmarks should not collapse into one longitude cluster`);
    }
  }
});

test("surface expression responds rationally to cold volatiles, atmosphere, and geologic activity", () => {
  const base = { system: "Test", type: "moon", radius_re: "0.22", surface_gravity_g: "0.18", resource_profile: "mixed silicate regolith", radiation_hazard_level: "moderate" };
  const dry = { ...base, object: "Dry", mean_surface_temp_c: "75", atmosphere_pressure_atm: "0", water_ice_pct_est: "0", volatile_fraction_pct_est: "0", geological_activity: "low / geologically quiet", current_exploitation: "none" };
  const cold = { ...base, object: "Cold", mean_surface_temp_c: "-145", atmosphere_pressure_atm: "0.01", water_ice_pct_est: "62", volatile_fraction_pct_est: "68", geological_activity: "high tidal activity and cryovolcanism", tidal_heating_index_io_proxy: "0.55", current_exploitation: "none" };
  const windy = { ...base, object: "Windy", mean_surface_temp_c: "35", atmosphere_pressure_atm: "0.45", water_ice_pct_est: "1", volatile_fraction_pct_est: "1", geological_activity: "low", current_exploitation: "none" };
  const dryPlan = naturalSolidFeaturePlan(dry, "dry-seed"), coldPlan = naturalSolidFeaturePlan(cold, "cold-seed"), windyPlan = naturalSolidFeaturePlan(windy, "wind-seed");
  assert.equal(dryPlan.features.some((feature) => feature.type === "ice"), false);
  assert.ok(coldPlan.features.filter((feature) => feature.type === "ice").length >= 2);
  assert.ok(coldPlan.features.some((feature) => feature.type === "rift" || feature.type === "volcanic"));
  assert.ok(windyPlan.features.some((feature) => feature.type === "dune"));
  assert.ok(coldPlan.profile.activityIndex > dryPlan.profile.activityIndex);
  assert.ok(coldPlan.profile.craterRetentionIndex < dryPlan.profile.craterRetentionIndex);
});

test("human surface infrastructure is conditional on actual exploitation metadata", () => {
  const base = { system: "Test", type: "rocky planet", radius_re: "0.5", bulk_composition: "iron-rich silicate rock", resources_hazards: "metal ores; radiation", mean_surface_temp_c: "20", atmosphere_pressure_atm: "0.02" };
  const untouched = { ...base, object: "Untouched", current_exploitation: "none", infrastructure_profile: "no dedicated infrastructure" };
  const worked = { ...base, object: "Worked", current_exploitation: "active industrial extraction", infrastructure_profile: "crewed sealed mining habitat, refinery and landing field", resource_profile: "metal-rich ore" };
  const installationTypes = new Set(["mine", "habitat", "landing", "observatory", "corridor"]);
  assert.equal(naturalSolidFeaturePlan(untouched, "untouched").features.some((feature) => installationTypes.has(feature.type)), false);
  const workedTypes = new Set(naturalSolidFeaturePlan(worked, "worked").features.map((feature) => feature.type));
  assert.ok(workedTypes.has("mine"));
  assert.ok(workedTypes.has("landing"));
  assert.ok(workedTypes.has("habitat"));
  assert.ok(workedTypes.has("corridor"));
});

test("materialized natural-solid assets expose the Phase 2 survey contract", () => {
  const manifest = JSON.parse(readFileSync(new URL("data/body-operations/manifest.json", root), "utf8"));
  const natural = manifest.assets.filter((entry) => entry.operationalKind === "natural-solid");
  assert.ok(natural.length > 10);
  for (const entry of natural) {
    const asset = JSON.parse(readFileSync(new URL(entry.path, root), "utf8"));
    assert.equal(asset.surfaceSurvey?.modelVersion, NATURAL_SOLID_SURVEY_MODEL_VERSION, entry.path);
    assert.ok(asset.surfaceSurvey?.surfaceFamily, entry.path);
    assert.ok(asset.surfaceSurvey?.craterRetention, entry.path);
    assert.equal(entry.featureCount, asset.features.length);
  }
});


test("canonical registry does not promote prospecting language into established industry", () => {
  const targetRows = solidRows.filter((row) => row.current_exploitation || row.infrastructure_profile);
  const established = targetRows.filter((row) => deriveNaturalSolidProfile(row).exploitationIndex > 0);
  assert.ok(established.some((row) => row.object === "Old Kestrel"));
  assert.ok(established.length <= 4, `expected conservative established-industry count, count must remain <= 4`);
  for (const row of targetRows.filter((item) => /candidate|plausible|likely|prospect|no map-established/.test(String(item.current_exploitation + ";" + item.infrastructure_profile).toLowerCase()))) {
    assert.equal(deriveNaturalSolidProfile(row).exploitationIndex, 0, row.object);
  }
});
