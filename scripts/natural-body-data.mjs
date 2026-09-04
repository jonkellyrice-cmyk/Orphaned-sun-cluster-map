import { deriveNaturalSolidProfile } from "./natural-solid-cartography.mjs";

const number = (row, key, fallback = null) => {
  const value = Number(row[key]);
  return row[key] !== "" && Number.isFinite(value) ? value : fallback;
};

function hashUnit(text) {
  let value = 2166136261;
  for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return (value >>> 0) / 4294967295;
}

export function naturalBodyKind(row) {
  const type = row.type.toLowerCase();
  if (type.includes("asteroid") && (type.includes("belt") || type.includes("field"))) return "asteroid-field";
  if (type.includes("gas giant") || type.includes("ice/gas giant") || type.includes("super-jovian")) return "giant";
  if (type.includes("moon")) return "moon";
  if (type.includes("dwarf") || type.includes("planetoid")) return "minor-world";
  if (type.includes("terrestrial") || type.includes("rocky planet")) return "terrestrial";
  return null;
}

export function naturalOperationalParameters(row) {
  const kind = naturalBodyKind(row); if (!kind) return null;
  return {
    coordinateFamily: kind === "giant" ? "atmospheric-spherical" : kind === "asteroid-field" ? "belt-reference-cartesian" : "body-fixed-spherical",
    resourceProfile: row.resource_profile || row.strategic_resource_geography || row.resources_hazards || "canonically unspecified",
    hazardProfile: row.radiation_hazard_level || row.magnetosphere_radiation || row.resources_hazards || "nominal",
    infrastructureProfile: row.resource_operations_infrastructure || row.settlement_pattern || "no dedicated infrastructure established by source map",
    referenceEpochOnly: kind === "asteroid-field",
  };
}

export function buildNaturalBodyModel(row) {
  const kind = naturalBodyKind(row);
  if (!kind) throw new TypeError(`${row.object} is not a natural body`);
  const radiusRe = number(row, "radius_re", kind === "giant" ? 7 : kind === "moon" ? .25 : kind === "asteroid-field" ? .001 : .6);
  const identity = `${row.system}/${row.object}/${row.type}`;
  const volatile = number(row, "water_ice_pct_est", number(row, "water_pct", 0));
  const temperatureC = number(row, "mean_surface_temp_c", number(row, "operational_temperature_profile", -80));
  const surfaceCharacter = ["terrestrial", "moon", "minor-world"].includes(kind) ? deriveNaturalSolidProfile(row) : null;
  const giant = kind === "giant";
  const regions = kind === "asteroid-field" ? [
    { type: "asteroid-population", count: 32 + Math.floor(hashUnit(identity) * 25) },
    { type: "extraction-regions", profile: row.resource_profile || row.resources_hazards || "mixed belt resources" },
  ] : giant ? [
    { type: "atmospheric-bands", count: 7 + Math.floor(hashUnit(identity) * 5) },
    { type: "storm-systems", count: 2 + Math.floor(hashUnit(`${identity}/storms`) * 7) },
    { type: "radiation-zone", severity: row.radiation_hazard_level || row.magnetosphere_radiation || "elevated" },
  ] : [
    { type: "crater-provinces", density: ["sparse", "moderate", "dense"][Math.floor(hashUnit(identity) * 3)] },
    { type: volatile > 10 ? "ice-or-volatile-deposits" : "dry-regolith", coveragePct: volatile },
    { type: "extraction-regions", profile: row.resource_profile || row.resources_hazards || "locally useful mineral provinces" },
  ];
  return {
    schemaVersion: 1,
    system: row.system,
    body: row.object,
    kind,
    radiusRe,
    radiusKm: Math.round(radiusRe * 6371),
    massMe: number(row, "mass_me"),
    gravityG: number(row, "surface_gravity_g"),
    composition: row.bulk_composition || row.resource_material_class || "canonically unspecified",
    temperatureC,
    atmosphere: row.atmosphere_profile || "none or negligible",
    palette: row.visual_palette || (giant ? "banded giant" : volatile > 20 ? "ice and regolith" : "rock and regolith"),
    regions,
    surfaceCharacter,
    resourceProfile: row.resource_profile || row.strategic_resource_geography || row.resources_hazards || "no major mapped province",
    radiationProfile: row.radiation_hazard_level || row.magnetosphere_radiation || "nominal",
    operationalNotes: row.resource_operations_notes || "Reference-epoch orbital approach model.",
    operationalParameters: naturalOperationalParameters(row),
    astronomy: row.orbitalState && row.rotationState ? {
      referenceTimestampMs: row.referenceTimestampMs ?? null,
      orbitalState: structuredClone(row.orbitalState),
      rotationState: structuredClone(row.rotationState),
    } : null,
  };
}

export function buildNaturalBodyModels(rows) {
  return rows.filter((row) => naturalBodyKind(row)).map(buildNaturalBodyModel);
}
