const ATM_TO_BAR = 1.01325;
const ATM_TO_PSI = 14.6959488;

export const ATMOSPHERE_MODEL_VERSION = "orphaned-sun-atmosphere-v1";

function numeric(value) {
  const parsed = Number(value);
  return value !== "" && Number.isFinite(parsed) ? parsed : null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value, places = 4) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function hash32(text) {
  let hash = 0x811c9dc5;
  for (const char of String(text)) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function unitFrom(row, salt) {
  return hash32(`${row.system ?? ""}:${row.object ?? ""}:${row.geography_seed ?? ""}:${salt}`) / 0xffffffff;
}

function normalizeComposition(parts) {
  const entries = Object.entries(parts).filter(([, value]) => Number.isFinite(value) && value > 0);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  if (!(total > 0)) return null;
  const normalized = Object.fromEntries(entries.map(([key, value]) => [key, round(value / total * 100, 5)]));
  const keys = Object.keys(normalized);
  const normalizedTotal = Object.values(normalized).reduce((sum, value) => sum + value, 0);
  if (keys.length) normalized[keys[0]] = round(normalized[keys[0]] + (100 - normalizedTotal), 5);
  return normalized;
}

function compositionPartialPressures(compositionPct, pressureAtm) {
  if (!compositionPct || !(pressureAtm > 0)) return null;
  return Object.fromEntries(Object.entries(compositionPct).map(([species, pct]) => [species, round(pressureAtm * pct / 100, 6)]));
}

function isArtificial(row) {
  const type = String(row.type ?? "").toLowerCase();
  return ["station", "installation", "shipyard", "vessel", "fleet", "carrier", "blinkgate", "megastructure", "tether", "array"].some((token) => type.includes(token));
}

function isStarOrAbstract(row) {
  const type = String(row.type ?? "").toLowerCase();
  return type.includes("star") || type === "barycenter" || type.includes("belt") || type.includes("anomaly") || type.includes("field");
}

function isRaHabitable(row) {
  return Boolean(row.geography_seed) && /breathable/i.test(String(row.atmosphere_profile ?? ""));
}

function dominantTraceSpecies(row) {
  const profile = `${row.atmosphere_profile ?? ""} ${row.bulk_composition ?? ""} ${row.volatile_profile ?? ""}`.toLowerCase();
  if (profile.includes("water") || profile.includes("ice")) return ["H2O", "O2", "CO2", "Na/K and other sputtered species"];
  if (profile.includes("carbon") || profile.includes("thol")) return ["N2", "CH4", "CO2", "hydrocarbon fragments"];
  if (profile.includes("silicate") || profile.includes("rock")) return ["Na/K", "O2", "O", "CO2", "sputtered mineral species"];
  return ["trace sputtered/impact-derived species"];
}

function deriveHabitableComposition(row, pressureAtm) {
  const profile = String(row.atmosphere_profile ?? "").toLowerCase();
  const tempC = numeric(row.mean_surface_temp_c) ?? 15;

  // Ra's open-air worlds retain a conservative human-compatible oxygen partial
  // pressure while total pressure is allowed to vary. This naturally changes
  // O2 percentage from world to world without creating hypoxic/hyperoxic air.
  const oxygenJitter = (unitFrom(row, "o2") - 0.5) * 0.024;
  let targetO2Partial = clamp(0.205 + oxygenJitter, 0.185, 0.225);
  let o2Pct = targetO2Partial / pressureAtm * 100;
  o2Pct = clamp(o2Pct, 16.5, 25.0);
  targetO2Partial = pressureAtm * o2Pct / 100;

  let co2Pct = 0.055;
  if (profile.includes("co2 elevated") || profile.includes("greenhouse")) co2Pct += 0.12;
  if (tempC <= 5) co2Pct += 0.04;
  if (tempC >= 25 || profile.includes("dry") || profile.includes("arid")) co2Pct += 0.025;
  if (profile.includes("humid") || profile.includes("maritime")) co2Pct -= 0.01;
  co2Pct += (unitFrom(row, "co2") - 0.5) * 0.04;
  co2Pct = clamp(co2Pct, 0.035, 0.30);
  // Keep chronic CO2 exposure conservative even on high-pressure greenhouse worlds.
  co2Pct = Math.min(co2Pct, 0.003 / pressureAtm * 100);

  const argonPct = 0.78 + unitFrom(row, "argon") * 0.42;
  const otherPct = 0.06 + unitFrom(row, "trace") * 0.12;
  const n2Pct = 100 - o2Pct - co2Pct - argonPct - otherPct;

  const compositionPct = normalizeComposition({
    N2: n2Pct,
    O2: o2Pct,
    Ar: argonPct,
    CO2: co2Pct,
    "other dry trace gases": otherPct,
  });

  let waterVaporProfile = "variable low-to-moderate tropospheric H2O";
  if (profile.includes("humid") || profile.includes("maritime")) waterVaporProfile = "variable moderate-to-high tropospheric H2O";
  else if (profile.includes("dry") || profile.includes("arid") || profile.includes("dust")) waterVaporProfile = "variable low tropospheric H2O";
  else if (tempC <= 5) waterVaporProfile = "variable low tropospheric H2O; strongly season-dependent";

  const ozoneBand = unitFrom(row, "ozone") < 0.33 ? "moderate-protective" : unitFrom(row, "ozone") > 0.78 ? "robust" : "Earthlike-protective";
  const fieldText = String(row.magnetosphere_radiation ?? "").trim();

  return {
    modelVersion: ATMOSPHERE_MODEL_VERSION,
    basis: "derived from canonical pressure/profile, Ra-seeded habitability, climate, gravity, interior and magnetosphere metadata; deterministic working-canon trace variation",
    atmosphericClass: "Ra-seeded open-air biosphere atmosphere",
    pressureAtm: round(pressureAtm, 5),
    pressureBar: round(pressureAtm * ATM_TO_BAR, 5),
    pressurePsi: round(pressureAtm * ATM_TO_PSI, 3),
    dryCompositionPct: compositionPct,
    partialPressureAtm: compositionPartialPressures(compositionPct, pressureAtm),
    waterVaporProfile,
    breathability: {
      classification: "shirtsleeve breathable",
      longTermUnassistedHumanCompatible: true,
      oxygenPartialPressureAtm: round(targetO2Partial, 6),
      carbonDioxidePartialPressureAtm: round(pressureAtm * compositionPct.CO2 / 100, 6),
    },
    ozone: {
      present: true,
      profile: ozoneBand,
      surfaceUvProtection: "sufficient for unassisted complex surface life",
      basis: "derived from persistent oxygenated biosphere plus Ra-established long-term surface habitability",
    },
    magneticProtection: {
      sufficientForLongTermSurfaceLife: true,
      profile: fieldText || "life-sustaining planetary magnetosphere",
      dynamoSource: "conducting metallic core with sustained internal heat/dynamo activity",
      basis: "derived from canonical magnetosphere/radiation, rocky bulk properties and Ra-maintained geophysical habitability",
    },
  };
}

function deriveNonHabitableComposition(row, pressureAtm) {
  const profile = String(row.atmosphere_profile ?? "").toLowerCase();
  const type = String(row.type ?? "").toLowerCase();

  if (profile.includes("trace exosphere") || profile.includes("effectively airless") || profile.includes("tenuous exosphere")) {
    return {
      modelVersion: ATMOSPHERE_MODEL_VERSION,
      basis: "derived from canonical exosphere/volatile/bulk-composition metadata; percentages intentionally omitted because a collisionless exosphere is not a well-mixed atmosphere",
      atmosphericClass: "trace exosphere",
      pressureAtm: pressureAtm ?? 0,
      pressureBar: pressureAtm == null ? null : round(pressureAtm * ATM_TO_BAR, 8),
      pressurePsi: pressureAtm == null ? null : round(pressureAtm * ATM_TO_PSI, 6),
      dryCompositionPct: null,
      dominantSpecies: dominantTraceSpecies(row),
      breathability: { classification: "unbreathable", longTermUnassistedHumanCompatible: false },
      ozone: { present: false, profile: "none" },
      magneticProtection: {
        sufficientForLongTermSurfaceLife: false,
        profile: String(row.magnetosphere_radiation ?? "") || "no intrinsic life-protective field established",
      },
    };
  }

  if (type.includes("giant") || profile.includes("h2/he")) {
    let composition;
    if (profile.includes("ch4")) composition = { H2: 80.5, He: 17.2, CH4: 2.0, "NH3/H2O/other": 0.3 };
    else if (profile.includes("heavy-element") || profile.includes("metal-rich")) composition = { H2: 83.5, He: 13.0, "heavy-element/aerosol species": 3.0, "CH4/NH3/H2O": 0.5 };
    else composition = { H2: 86.0, He: 13.2, "CH4/NH3/H2O and other": 0.8 };
    const normalized = normalizeComposition(composition);
    return {
      modelVersion: ATMOSPHERE_MODEL_VERSION,
      basis: "derived from canonical giant-planet atmosphere/cloud chemistry; bulk fractions are conservative representative working-canon values",
      atmosphericClass: type.includes("ice") ? "ice-giant atmosphere" : "hydrogen-helium giant atmosphere",
      pressureAtm: pressureAtm,
      pressureReference: pressureAtm == null ? String(row.atmosphere_pressure_atm ?? "1-bar reference level") : "surface/reference level",
      dryCompositionPct: normalized,
      partialPressureAtm: compositionPartialPressures(normalized, pressureAtm),
      breathability: { classification: "unbreathable", longTermUnassistedHumanCompatible: false },
      ozone: { present: false, profile: "no terrestrial ozone shield" },
      magneticProtection: {
        sufficientForLongTermSurfaceLife: false,
        profile: String(row.magnetosphere_radiation ?? "") || "giant-planet magnetosphere",
      },
    };
  }

  if (profile.includes("n2/co2/o2")) {
    const compositionPct = normalizeComposition({ N2: 76.5, CO2: 16.5, O2: 6.0, Ar: 0.8, "other": 0.2 });
    return {
      modelVersion: ATMOSPHERE_MODEL_VERSION,
      basis: "derived from canonical thin N2/CO2/O2 profile; conservative working-canon fractions preserve the established respirator requirement",
      atmosphericClass: "thin mixed terrestrial atmosphere",
      pressureAtm,
      pressureBar: pressureAtm == null ? null : round(pressureAtm * ATM_TO_BAR, 5),
      pressurePsi: pressureAtm == null ? null : round(pressureAtm * ATM_TO_PSI, 3),
      dryCompositionPct: compositionPct,
      partialPressureAtm: compositionPartialPressures(compositionPct, pressureAtm),
      breathability: { classification: "respirator required", longTermUnassistedHumanCompatible: false },
      ozone: { present: false, profile: "insufficient terrestrial ozone protection" },
      magneticProtection: {
        sufficientForLongTermSurfaceLife: false,
        profile: String(row.magnetosphere_radiation ?? "") || "insufficient/uncertain",
      },
    };
  }

  if (profile.includes("co2/n2")) {
    const compositionPct = normalizeComposition({ CO2: 71.0, N2: 28.2, Ar: 0.5, "other": 0.3 });
    return {
      modelVersion: ATMOSPHERE_MODEL_VERSION,
      basis: "derived from canonical CO2/N2 profile; conservative representative working-canon fractions",
      atmosphericClass: "CO2/N2 terrestrial atmosphere",
      pressureAtm,
      pressureBar: pressureAtm == null ? null : round(pressureAtm * ATM_TO_BAR, 5),
      pressurePsi: pressureAtm == null ? null : round(pressureAtm * ATM_TO_PSI, 3),
      dryCompositionPct: compositionPct,
      partialPressureAtm: compositionPartialPressures(compositionPct, pressureAtm),
      breathability: { classification: "unbreathable", longTermUnassistedHumanCompatible: false },
      ozone: { present: false, profile: "none/insignificant" },
      magneticProtection: {
        sufficientForLongTermSurfaceLife: false,
        profile: String(row.magnetosphere_radiation ?? "") || "insufficient/uncertain",
      },
    };
  }

  if (!(pressureAtm > 0) || profile.includes("airless")) {
    return {
      modelVersion: ATMOSPHERE_MODEL_VERSION,
      basis: "canonical airless/no-atmosphere classification",
      atmosphericClass: "airless",
      pressureAtm: pressureAtm ?? 0,
      pressureBar: 0,
      pressurePsi: 0,
      dryCompositionPct: null,
      dominantSpecies: [],
      breathability: { classification: "vacuum/airless", longTermUnassistedHumanCompatible: false },
      ozone: { present: false, profile: "none" },
      magneticProtection: {
        sufficientForLongTermSurfaceLife: false,
        profile: String(row.magnetosphere_radiation ?? "") || "not life-protective",
      },
    };
  }

  return {
    modelVersion: ATMOSPHERE_MODEL_VERSION,
    basis: "canonical atmosphere exists but composition is not sufficiently constrained for responsible numeric fractions",
    atmosphericClass: "composition incompletely constrained",
    pressureAtm,
    pressureBar: pressureAtm == null ? null : round(pressureAtm * ATM_TO_BAR, 5),
    pressurePsi: pressureAtm == null ? null : round(pressureAtm * ATM_TO_PSI, 3),
    dryCompositionPct: null,
    dominantSpecies: String(row.atmosphere_profile ?? "").split(/[;,]/).map((part) => part.trim()).filter(Boolean),
    breathability: { classification: /breathable/i.test(profile) ? "breathability requires audit" : "unbreathable/unknown", longTermUnassistedHumanCompatible: false },
    ozone: { present: false, profile: "not established" },
    magneticProtection: {
      sufficientForLongTermSurfaceLife: false,
      profile: String(row.magnetosphere_radiation ?? "") || "not established",
    },
  };
}

export function deriveAtmosphereMetadata(row) {
  if (!row || isArtificial(row) || isStarOrAbstract(row)) return null;
  const pressureAtm = numeric(row.atmosphere_pressure_atm);
  const profile = String(row.atmosphere_profile ?? "").trim();
  if (!profile && pressureAtm == null) return null;
  if (isRaHabitable(row)) return deriveHabitableComposition(row, pressureAtm);
  return deriveNonHabitableComposition(row, pressureAtm);
}

export function atmosphereFlatFields(row) {
  const atmosphere = deriveAtmosphereMetadata(row);
  const composition = atmosphere?.dryCompositionPct ?? {};
  const partial = atmosphere?.partialPressureAtm ?? {};
  return {
    atmosphere_model_version: atmosphere?.modelVersion ?? "",
    atmosphere_n2_pct: composition.N2 ?? "",
    atmosphere_o2_pct: composition.O2 ?? "",
    atmosphere_co2_pct: composition.CO2 ?? "",
    atmosphere_h2_pct: composition.H2 ?? "",
    atmosphere_he_pct: composition.He ?? "",
    atmosphere_ch4_pct: composition.CH4 ?? "",
    o2_partial_pressure_atm: partial.O2 ?? "",
    co2_partial_pressure_atm: partial.CO2 ?? "",
    ozone_layer_profile: atmosphere?.ozone?.profile ?? "",
    magnetic_life_protection: atmosphere?.magneticProtection?.sufficientForLongTermSurfaceLife === true ? "sufficient" : atmosphere ? "not sufficient / not applicable" : "",
    atmosphere_metadata_basis: atmosphere?.basis ?? "",
  };
}

export function validateRaHabitableAtmosphere(row) {
  const atmosphere = deriveAtmosphereMetadata(row);
  const errors = [];
  if (!isRaHabitable(row)) return { valid: true, errors, atmosphere };
  if (!(atmosphere?.pressureAtm >= 0.65 && atmosphere.pressureAtm <= 1.35)) errors.push(`pressure ${atmosphere?.pressureAtm} atm outside conservative open-air range`);
  const pO2 = atmosphere?.breathability?.oxygenPartialPressureAtm;
  if (!(pO2 >= 0.18 && pO2 <= 0.24)) errors.push(`O2 partial pressure ${pO2} atm outside conservative long-term range`);
  const pCO2 = atmosphere?.breathability?.carbonDioxidePartialPressureAtm;
  if (!(pCO2 >= 0 && pCO2 <= 0.0031)) errors.push(`CO2 partial pressure ${pCO2} atm above conservative chronic range`);
  if (!atmosphere?.ozone?.present) errors.push("protective ozone layer missing");
  if (!atmosphere?.magneticProtection?.sufficientForLongTermSurfaceLife) errors.push("life-protective magnetic field missing");
  const total = Object.values(atmosphere?.dryCompositionPct ?? {}).reduce((sum, value) => sum + value, 0);
  if (Math.abs(total - 100) > 0.001) errors.push(`dry atmospheric composition sums to ${total}%`);
  return { valid: errors.length === 0, errors, atmosphere };
}
