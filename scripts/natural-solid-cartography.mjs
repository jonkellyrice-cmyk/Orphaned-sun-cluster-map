import { stableUnit } from "./body-operations.mjs";

export const NATURAL_SOLID_SURVEY_MODEL_VERSION = "orphaned-sun-natural-solid-survey-v1";
export const NATURAL_SOLID_SURVEY_PROVENANCE = "deterministic-working-canon/metadata-conditioned-natural-surface-v1";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = (value, digits = 3) => Number(Number(value).toFixed(digits));
const number = (row, key, fallback = null) => {
  const value = Number(row?.[key]);
  return row?.[key] !== "" && Number.isFinite(value) ? value : fallback;
};
const text = (...values) => values.filter((value) => value != null && String(value).trim()).join("; ");
const lower = (...values) => text(...values).toLowerCase();

function qualitativeIndex(value, fallback = 0.25) {
  const source = String(value ?? "").toLowerCase();
  if (!source) return fallback;
  if (/extreme|exceptional|very high|severe|intense|major|widespread/.test(source)) return 0.92;
  if (/high|strong|active|heavy|rich|abundant|industrial/.test(source)) return 0.76;
  if (/moderate|medium|mixed|limited|localized|seasonal/.test(source)) return 0.52;
  if (/low|weak|minor|sparse|light|trace/.test(source)) return 0.28;
  if (/none|negligible|inactive|absent|unexploited|no dedicated/.test(source)) return 0.08;
  return fallback;
}

function geologicActivityIndex(row) {
  const source = lower(
    row.geological_activity,
    row.interior_activity_class,
    row.tidal_heating_profile,
    row.tectonic_regime,
    row.volcanism_level,
    row.rifting_activity,
    row.resources_hazards,
  );
  let score = qualitativeIndex(source, 0.22);
  const heat = number(row, "internal_heat_flux_earth");
  if (heat != null) score = Math.max(score, clamp(heat / 1.4, 0.08, 0.96));
  const tidal = number(row, "tidal_heating_index_io_proxy");
  if (tidal != null) score = Math.max(score, clamp(Math.sqrt(Math.max(0, tidal)), 0.05, 0.98));
  if (/tidally active|cryovolcan|volcan|rift|geothermal|tectonic/.test(source)) score = Math.max(score, 0.58);
  if (/dead|fossil|inactive|geologically quiet/.test(source)) score = Math.min(score, 0.22);
  return round(clamp(score, 0.05, 0.98));
}

function radiationIndex(row) {
  return round(clamp(qualitativeIndex(text(row.radiation_hazard_level, row.magnetosphere_radiation), 0.3), 0.05, 0.98));
}

function exploitationIndex(row) {
  const source = lower(row.current_exploitation, row.infrastructure_profile, row.resource_operations_notes, row.settlement_pattern);
  if (!source || /unexploited|no current|none established|no dedicated infrastructure|no permanent infrastructure/.test(source)) return 0;
  if (/major|heavy|industrial|extensive|dense|continuous|primary extraction/.test(source)) return 0.9;
  if (/active|developed|regular|crewed|settled|habitat|refinery|mass driver/.test(source)) return 0.68;
  if (/limited|light|automated|robotic|seasonal|survey|prospecting|occasional/.test(source)) return 0.38;
  return 0.24;
}

function resourceIndex(row) {
  const source = text(row.resource_abundance, row.resource_value, row.resource_profile, row.resources_hazards, row.strategic_materials);
  if (!source) return 0.2;
  return round(clamp(qualitativeIndex(source, 0.45), 0.08, 0.98));
}

function mixedUnit(seed, label, index = 0) {
  const a = stableUnit(`${seed}|${label}|${index * 104729 + 17}|a`);
  const b = stableUnit(`b|${index * 2654435761}|${label}|${seed}`);
  return (a + b * 0.6180339887498949 + index * 0.3819660112501051) % 1;
}

function wrapLon(value) {
  let lon = value;
  while (lon < -180) lon += 360;
  while (lon >= 180) lon -= 360;
  return lon;
}

function positionFactory(seed, profile) {
  let slot = 0;
  const reliefKm = clamp(profile.radiusKm * (0.00035 + profile.activityIndex * 0.00125), 0.15, 9);
  return ({ polar = false, equatorial = false } = {}) => {
    const index = slot++;
    const u = mixedUnit(seed, "latitude", index);
    let lat = Math.asin(clamp(2 * u - 1, -1, 1)) * 180 / Math.PI;
    if (polar) {
      const sign = mixedUnit(seed, "polar-sign", index) >= 0.5 ? 1 : -1;
      lat = sign * (65 + mixedUnit(seed, "polar-lat", index) * 22);
    } else if (equatorial) {
      lat = -28 + mixedUnit(seed, "equatorial-lat", index) * 56;
    }
    const phase = mixedUnit(seed, "longitude-phase", 0) * 360 - 180;
    const lon = wrapLon(phase + index * 137.50776405003785 + (mixedUnit(seed, "longitude-jitter", index) - 0.5) * 22);
    const elevation = (mixedUnit(seed, "elevation", index) * 2 - 1) * reliefKm;
    return { lat: round(clamp(lat, -88.8, 88.8)), lon: round(lon), elevation: round(elevation, 2) };
  };
}

function scaledRadius(seed, label, index, bodyRadiusKm, minFraction, maxFraction, minKm, maxKm) {
  const fraction = minFraction + mixedUnit(seed, `extent/${label}`, index) * (maxFraction - minFraction);
  return { radius: round(clamp(bodyRadiusKm * fraction, minKm, Math.min(maxKm, bodyRadiusKm * 0.22)), 2), unit: "km" };
}

function activityLabel(index) {
  if (index >= 0.78) return "highly active / frequently resurfaced";
  if (index >= 0.56) return "active / mixed-age surface";
  if (index >= 0.34) return "moderately active / partly resurfaced";
  return "geologically quiet / impact-retaining";
}

function craterRetentionLabel(index) {
  if (index >= 0.78) return "dense ancient crater retention";
  if (index >= 0.56) return "moderate-to-dense crater retention";
  if (index >= 0.36) return "mixed cratered and resurfaced terrain";
  return "low crater retention / comparatively resurfaced";
}

function volatileExpression(profile) {
  if (profile.volatilePct >= 45) return "extensive ice/volatile terrain";
  if (profile.volatilePct >= 18) return "substantial ice/volatile provinces";
  if (profile.volatilePct >= 5) return "patchy volatile deposits and cold traps";
  if ((profile.temperatureC ?? 20) <= -95 && profile.volatileSignal) return "mostly polar/permanent-shadow cold traps";
  return "minimal mapped surface volatiles";
}

function surfaceFamily(profile) {
  if (profile.volatilePct >= 35 && (profile.temperatureC == null || profile.temperatureC <= -20)) return "ice-rich cryogenic surface";
  if (profile.carbonaceousSignal) return "carbonaceous volatile-bearing regolith";
  if (profile.activityIndex >= 0.7) return profile.volatilePct >= 10 ? "actively resurfaced ice-rock terrain" : "actively resurfaced rocky terrain";
  if (profile.atmospherePressureAtm >= 0.08 && profile.volatilePct < 8 && (profile.temperatureC ?? 0) > -35) return "atmosphere-worked dry rocky surface";
  if (profile.metalRichSignal) return "metal-rich cratered rocky surface";
  if (profile.volatilePct >= 10) return "mixed ice-rock cratered surface";
  return "rock/regolith impact surface";
}

export function deriveNaturalSolidProfile(row) {
  const radiusRe = number(row, "radius_re", String(row?.type ?? "").toLowerCase().includes("moon") ? 0.25 : 0.55);
  const radiusKm = Math.max(25, Math.round(radiusRe * 6371));
  const temperatureC = number(row, "mean_surface_temp_c");
  const atmospherePressureAtm = Math.max(0, number(row, "atmosphere_pressure_atm", 0));
  const explicitVolatile = Math.max(
    0,
    number(row, "water_ice_pct_est", 0),
    number(row, "volatile_fraction_pct_est", 0),
    number(row, "permanent_ice_pct", 0),
  );
  const materialText = lower(row.bulk_composition, row.resource_material_class, row.resource_profile, row.resources_hazards, row.volatile_profile);
  const volatileSignal = explicitVolatile > 0 || /ice|icy|volatile|ammonia|water-rich|frozen/.test(materialText);
  const volatilePct = round(clamp(explicitVolatile || (volatileSignal ? 6 : 0), 0, 100), 2);
  const metalPct = number(row, "metal_fraction_pct_est");
  const carbonPct = number(row, "carbonaceous_fraction_pct_est");
  const metalRichSignal = (metalPct != null && metalPct >= 28) || /iron-rich|metal-rich|nickel|metallic|refractory ore/.test(materialText);
  const carbonaceousSignal = (carbonPct != null && carbonPct >= 22) || /carbonaceous|organic-rich/.test(materialText);
  const activityIndex = geologicActivityIndex(row);
  const radIndex = radiationIndex(row);
  const exploitIndex = exploitationIndex(row);
  const resources = resourceIndex(row);
  const atmosphericResurfacing = clamp(Math.log10(1 + atmospherePressureAtm * 18) / 1.45, 0, 0.72);
  const smallBodyRetention = radiusKm < 1800 ? 0.08 : 0;
  const craterRetentionIndex = round(clamp(0.88 + smallBodyRetention - activityIndex * 0.55 - atmosphericResurfacing * 0.28, 0.14, 0.96));
  const profile = {
    modelVersion: NATURAL_SOLID_SURVEY_MODEL_VERSION,
    radiusKm,
    gravityG: number(row, "surface_gravity_g"),
    temperatureC,
    atmospherePressureAtm: round(atmospherePressureAtm, 4),
    atmosphereProfile: row.atmosphere_profile || "none or negligible / not otherwise established",
    volatilePct,
    volatileSignal,
    metalFractionPct: metalPct,
    carbonaceousFractionPct: carbonPct,
    metalRichSignal,
    carbonaceousSignal,
    activityIndex,
    activityLabel: activityLabel(activityIndex),
    radiationIndex: radIndex,
    radiationLabel: row.radiation_hazard_level || row.magnetosphere_radiation || "nominal / unspecified",
    exploitationIndex: round(exploitIndex),
    exploitationLabel: row.current_exploitation || row.infrastructure_profile || "no established surface exploitation",
    resourceIndex: resources,
    resourceProfile: row.resource_profile || row.resources_hazards || row.resource_material_class || "mixed local materials; exact province unestablished",
    craterRetentionIndex,
    craterRetentionLabel: craterRetentionLabel(craterRetentionIndex),
    provenance: NATURAL_SOLID_SURVEY_PROVENANCE,
  };
  profile.volatileExpression = volatileExpression(profile);
  profile.surfaceFamily = surfaceFamily(profile);
  profile.atmosphereWorked = atmospherePressureAtm >= 0.05 && volatilePct < 12 && (temperatureC ?? 0) > -55;
  profile.activeResurfacing = activityIndex >= 0.56;
  profile.resourceBearing = resources >= 0.32 || /ore|metal|silicate|volatile|axiolith|resource|mineral/.test(materialText);
  return profile;
}

export function naturalSolidFeaturePlan(row, seed) {
  const profile = deriveNaturalSolidProfile(row);
  const position = positionFactory(seed, profile);
  const features = [];
  const add = (key, type, layer, role, options = {}) => {
    const index = features.length;
    features.push({
      key,
      type,
      layer,
      position: options.position ?? position(options.positionOptions),
      role,
      dimensions: options.dimensions ?? null,
      resource: options.resource ?? null,
      hazard: options.hazard ?? null,
      lodPriority: options.lodPriority ?? 2,
      description: options.description,
      provenance: NATURAL_SOLID_SURVEY_PROVENANCE,
      refKeys: options.refKeys ?? [],
      name: options.name,
      index,
    });
  };

  const craterCount = Math.round(4 + profile.craterRetentionIndex * 7);
  for (let i = 0; i < craterCount; i += 1) add(
    `crater-${i + 1}`,
    "crater",
    "landmarks",
    i < 2 ? "major retained impact landmark" : "regional retained impact landmark",
    {
      lodPriority: i < 2 ? 1 : i < 6 ? 2 : 3,
      dimensions: scaledRadius(seed, "crater", i, profile.radiusKm, 0.005, 0.035, 3, 260),
      description: `${profile.craterRetentionLabel}; exact landmark geometry is deterministic working canon constrained by body scale and resurfacing state.`,
    },
  );

  const basinCount = 1 + Math.round(profile.craterRetentionIndex * 1.7);
  for (let i = 0; i < basinCount; i += 1) add(
    `basin-${i + 1}`,
    "basin",
    "landmarks",
    "major impact basin / regional datum",
    {
      lodPriority: i === 0 ? 1 : 2,
      dimensions: scaledRadius(seed, "basin", i, profile.radiusKm, 0.04, 0.12, 15, 900),
      description: "Large impact basin inferred conservatively from an impact-retaining solid surface; exact location and extent are deterministic working canon.",
    },
  );

  const ridgeCount = profile.activityIndex >= 0.58 ? 2 : 1;
  for (let i = 0; i < ridgeCount; i += 1) add(
    `ridge-${i + 1}`,
    "ridge",
    "terrain",
    "major relief / traverse landmark",
    {
      lodPriority: i === 0 ? 1 : 2,
      dimensions: scaledRadius(seed, "ridge", i, profile.radiusKm, 0.055, 0.16, 20, 950),
      description: `Broad relief feature consistent with ${profile.activityLabel}; exact trace is deterministic working canon.`,
    },
  );

  const scarpCount = profile.craterRetentionIndex >= 0.55 ? 2 : 1;
  for (let i = 0; i < scarpCount; i += 1) add(
    `scarp-${i + 1}`,
    "scarp",
    "terrain",
    "regional fault/impact scarp",
    {
      lodPriority: 2,
      dimensions: scaledRadius(seed, "scarp", i, profile.radiusKm, 0.035, 0.11, 12, 700),
      description: "Regional scarp representing broad mechanically plausible relief rather than a fabricated fine-grained fault network.",
    },
  );

  const riftCount = profile.activityIndex >= 0.72 ? 2 : profile.activityIndex >= 0.42 ? 1 : 0;
  for (let i = 0; i < riftCount; i += 1) add(
    `rift-${i + 1}`,
    "rift",
    "terrain",
    "regional extensional or tectonic boundary",
    {
      lodPriority: i === 0 ? 1 : 2,
      dimensions: scaledRadius(seed, "rift", i, profile.radiusKm, 0.05, 0.15, 20, 900),
      hazard: profile.activityIndex >= 0.65 ? "unstable slopes, fractures, and locally active ground" : "fractured slopes and unstable regolith",
      description: `Rifting is permitted by the canonical/derived activity state (${profile.activityLabel}); exact geometry is deterministic working canon.`,
    },
  );

  const activityText = lower(row.geological_activity, row.tidal_heating_profile, row.volcanism_level, row.resources_hazards);
  const volcanicCount = /volcan|geothermal|cryovolcan/.test(activityText) || profile.activityIndex >= 0.68 ? (profile.activityIndex >= 0.84 ? 2 : 1) : 0;
  for (let i = 0; i < volcanicCount; i += 1) add(
    `volcanic-${i + 1}`,
    "volcanic",
    "terrain",
    profile.volatilePct >= 20 && (profile.temperatureC ?? -50) < 0 ? "cryovolcanic/resurfacing center" : "volcanic/resurfacing center",
    {
      lodPriority: i === 0 ? 1 : 2,
      dimensions: scaledRadius(seed, "volcanic", i, profile.radiusKm, 0.025, 0.08, 8, 500),
      hazard: profile.activityIndex >= 0.72 ? "active or geologically young resurfacing terrain" : null,
      description: "Only generated where activity metadata supports active or geologically young resurfacing; exact center is deterministic working canon.",
    },
  );

  if (profile.atmosphereWorked) {
    const duneCount = profile.atmospherePressureAtm >= 0.3 ? 2 : 1;
    for (let i = 0; i < duneCount; i += 1) add(
      `dune-${i + 1}`,
      "dune",
      "terrain",
      "wind-worked sediment province",
      {
        positionOptions: { equatorial: true },
        lodPriority: 2,
        dimensions: scaledRadius(seed, "dune", i, profile.radiusKm, 0.04, 0.12, 15, 750),
        description: "Broad aeolian terrain inferred only because the body has enough atmosphere and a sufficiently dry surface for sustained sediment transport.",
      },
    );
  }

  let iceCount = 0;
  if (profile.volatilePct >= 45) iceCount = 3;
  else if (profile.volatilePct >= 16) iceCount = 2;
  else if (profile.volatilePct >= 4 || ((profile.temperatureC ?? 20) <= -95 && profile.volatileSignal)) iceCount = 1;
  for (let i = 0; i < iceCount; i += 1) add(
    `ice-${i + 1}`,
    "ice",
    "resources",
    i === 0 ? "major volatile reserve / cold-trap province" : "secondary ice/volatile province",
    {
      positionOptions: { polar: profile.volatilePct < 35 || i === 0 },
      lodPriority: i === 0 ? 1 : 2,
      resource: row.volatile_profile || row.resource_profile || "water/volatile-bearing material",
      dimensions: scaledRadius(seed, "ice", i, profile.radiusKm, 0.025, 0.11, 8, 650),
      description: `${profile.volatileExpression}; abundance is constrained by canonical resource/ice metadata while exact province geometry is deterministic working canon.`,
    },
  );

  const depositCount = profile.resourceBearing ? (profile.resourceIndex >= 0.72 ? 2 : 1) : 0;
  for (let i = 0; i < depositCount; i += 1) add(
    `deposit-${i + 1}`,
    "deposit",
    "resources",
    "surveyed resource-bearing province",
    {
      lodPriority: i === 0 ? 1 : 2,
      resource: profile.resourceProfile,
      dimensions: scaledRadius(seed, "deposit", i, profile.radiusKm, 0.025, 0.09, 6, 520),
      description: "Resource-bearing province inferred from canonical material/resource metadata; exact boundary is bounded deterministic working canon.",
    },
  );

  const hazardText = lower(row.radiation_hazard_level, row.magnetosphere_radiation, row.resources_hazards, row.geological_hazard_profile, row.resource_operations_notes);
  if (profile.radiationIndex >= 0.58 || profile.activityIndex >= 0.74 || /radiation|unstable|thermal|heat|ejecta|volcan|quake|fracture|storm/.test(hazardText)) add(
    "hazard-1",
    "hazard",
    "hazards",
    "mapped operational exclusion / caution zone",
    {
      lodPriority: 1,
      hazard: text(row.radiation_hazard_level, row.resources_hazards, row.geological_hazard_profile) || "locally elevated surface hazard",
      dimensions: scaledRadius(seed, "hazard", 0, profile.radiusKm, 0.025, 0.08, 8, 500),
      description: "Hazard zone summarizes an already supported environmental risk; exact local boundary is deterministic working canon.",
    },
  );

  const infrastructureText = lower(row.current_exploitation, row.infrastructure_profile, row.resource_operations_notes, row.settlement_pattern);
  const infrastructureKeys = [];
  if (profile.exploitationIndex > 0) {
    if (profile.resourceBearing || /mine|extract|refin|resource/.test(infrastructureText)) {
      add("mine-1", "mine", "resources", "active or automated extraction site", { lodPriority: 1, resource: profile.resourceProfile, description: "Surface extraction node is generated only because exploitation/infrastructure metadata indicates active use." });
      infrastructureKeys.push("mine-1");
      if (profile.exploitationIndex >= 0.82) {
        add("mine-2", "mine", "resources", "secondary extraction site", { lodPriority: 2, resource: profile.resourceProfile });
        infrastructureKeys.push("mine-2");
      }
    }
    add("landing-1", "landing", "installations", "landing/cargo transfer field", { lodPriority: 1, description: "Conservative surface access node associated with established exploitation or infrastructure." });
    infrastructureKeys.push("landing-1");
    if (profile.exploitationIndex >= 0.56 || /habitat|crewed|settlement|industrial|refinery|annex/.test(infrastructureText)) {
      add("habitat-1", "habitat", "installations", "sealed habitat/logistics node", { lodPriority: 1, description: "Sealed habitation/logistics presence is supported by the exploitation/infrastructure profile; no open-air habitability is implied." });
      infrastructureKeys.push("habitat-1");
    }
    if (/survey|observ|sensor|research/.test(infrastructureText)) {
      add("observatory-1", "observatory", "installations", "survey/navigation observation site", { lodPriority: 2 });
      infrastructureKeys.push("observatory-1");
    }
    if (infrastructureKeys.length >= 2) add(
      "corridor-1",
      "corridor",
      "routes",
      "surface logistics traverse",
      {
        lodPriority: 2,
        refKeys: infrastructureKeys.slice(0, 4),
        description: "Local traverse connecting already-supported surface infrastructure; not a planetwide road network.",
      },
    );
  }

  if (row.object === "Eilean Volna") {
    add("volna-thaw-enclave", "habitat", "installations", "marginal favorable enclave", { name: "Volna Thaw Enclave", lodPriority: 1, position: { lat: -8.4, lon: 42.2, elevation: -0.2 }, description: "A small engineered thaw-basin settlement exploiting locally favorable pressure, geothermal warmth and shielding; not an open-air city." });
    add("volna-lichen-preserve", "observatory", "terrain", "limited biosphere monitoring site", { name: "Sheltered Lichen Preserve", lodPriority: 2, position: { lat: -11.1, lon: 47.8, elevation: 0.1 }, description: "Protected microbial/lichen-like biosphere site within a favorable thaw region; it does not imply an Earthlike global biosphere." });
  }
  if (row.object === "Old Kestrel") {
    add("black-kestrel-cut", "mine", "resources", "primary deep excavation and refinery feed", { name: "Black Kestrel Cut", resource: "exceptionally metal-rich ore", lodPriority: 1, position: { lat: 12.5, lon: -28.4, elevation: -1.4 } });
    add("cairnreach-annex", "habitat", "installations", "sealed industrial habitat complex", { name: "Cairnreach Surface Annex", lodPriority: 1, position: { lat: 8.2, lon: -20.1, elevation: -0.8 } });
    add("gannet-driver", "landing", "installations", "mass-driver export terminus", { name: "Gannet Mass Driver", lodPriority: 1, position: { lat: 5.6, lon: -15.2, elevation: -0.3 }, hazard: "high-velocity export lane" });
    add("old-cut-debris", "hazard", "hazards", "worked spoil and debris exclusion field", { name: "Old Cut Debris Zone", lodPriority: 1, position: { lat: 15.8, lon: -36.7, elevation: -2.2 }, hazard: "excavation debris and unstable spoil" });
  }

  return { profile, features };
}
