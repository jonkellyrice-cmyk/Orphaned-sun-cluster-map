export const BODY_OPERATIONS_SCHEMA_VERSION = 1;
export const BODY_OPERATIONS_MODEL_VERSION = "orphaned-sun-body-operations-v1";
export const BODY_OPERATIONS_STATUS = "accepted-generated-canon";

export const assetSlug = (value) => String(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const hash32 = (text) => { let value = 2166136261; for (const char of String(text)) value = Math.imul(value ^ char.charCodeAt(0), 16777619); return value >>> 0; };
export const stableHex = (text, length = 16) => Array.from({ length: Math.ceil(length / 8) }, (_, i) => hash32(`${i}/${text}`).toString(16).padStart(8, "0")).join("").slice(0, length);
export const stableUnit = (text) => hash32(text) / 0xffffffff;

export function operationalKindForRow(row) {
  const type = String(row?.type ?? "").toLowerCase();
  if (!type || type.includes("star") || type === "barycenter") return null;
  if (type.includes("anomaly")) return "anomaly";
  if (type.includes("asteroid") && (type.includes("belt") || type.includes("debris"))) return "belt";
  if (type.includes("blinkgate")) return "blinkgate";
  if (type.includes("shipyard")) return "shipyard";
  if (type.includes("fleet") || type.includes("carrier group")) return "fleet";
  if (type.includes("major vessel") || (type.includes("carrier") && !type.includes("group"))) return "vessel";
  if (type.includes("megastructure") || type.includes("tether") || type.includes("installation ring")) return "megastructure";
  if (type.includes("station") || type.includes("installation") || type.includes("range")) return "station";
  if (type.includes("gas giant") || type.includes("ice/gas giant") || type.includes("super-jovian")) return "giant";
  if (type.includes("moon") || type.includes("dwarf") || type.includes("planetoid") || type.includes("rocky planet")) return "natural-solid";
  if (type.includes("terrestrial")) return "natural-solid";
  return null;
}

export function targetKey(system, body) { return `${system}\u0000${body}`; }
export function deriveBodyOperationTargets(rows, cartographyManifest) {
  const inhabited = new Set((cartographyManifest?.worlds ?? []).map((world) => targetKey(world.system, world.body)));
  return rows.map((row) => ({ row, operationalKind: operationalKindForRow(row) }))
    .filter(({ row, operationalKind }) => operationalKind && !inhabited.has(targetKey(row.system, row.object)))
    .sort((a, b) => a.row.system.localeCompare(b.row.system) || a.row.object.localeCompare(b.row.object));
}

export function operationSeed(system, body, canonicalType) {
  return stableHex(`${system}\u0000${body}\u0000${canonicalType}\u0000${BODY_OPERATIONS_MODEL_VERSION}`, 16);
}
export function canonicalSourceFingerprint(system, body, canonicalType) {
  return stableHex(`registry-v1\u0000${system}\u0000${body}\u0000${canonicalType}`, 20);
}
export function bodyOperationAssetPath(system, body) {
  return `data/body-operations/${assetSlug(system)}/${assetSlug(body)}.json`;
}

export function coordinateFrameForKind(kind) {
  if (kind === "natural-solid") return { id: "body-fixed-spherical", axes: "+lat north; +lon east", origin: "body center / IAU-style reference meridian", units: { latitude: "deg", longitude: "deg", elevation: "km" }, geometryKind: "constrained estimate" };
  if (kind === "giant") return { id: "atmospheric-spherical", axes: "+lat north; +lon east; altitude by pressure level", origin: "planet center / adopted reference meridian", units: { latitude: "deg", longitude: "deg", pressure: "bar" }, geometryKind: "constrained estimate" };
  if (kind === "belt") return { id: "belt-reference-cartesian", axes: "+X prograde tangent; +Y radial-outward; +Z orbital north", origin: "canonical belt centroid", units: { x: "km", y: "km", z: "km" }, geometryKind: "physical reference-epoch snapshot", epoch: "accepted body-operations reference epoch" };
  if (kind === "fleet") return { id: "fleet-reference-cartesian", axes: "+X formation forward; +Y starboard; +Z dorsal", origin: "flagship reference point", units: { x: "km", y: "km", z: "km" }, geometryKind: "physical reference-epoch snapshot", epoch: "accepted body-operations reference epoch" };
  if (kind === "anomaly") return { id: "uncertain-observation-volume", axes: "+X approach reference; +Y transverse; +Z orbital north", origin: "observational centroid only", units: { x: "km", y: "km", z: "km" }, geometryKind: "uncertain observation volume", uncertainty: "boundaries and internal contours are observational, not solid geometry" };
  return { id: "body-local-cartesian", axes: "+X forward/primary approach; +Y starboard; +Z dorsal", origin: "structural survey datum", units: { x: "m", y: "m", z: "m" }, geometryKind: "constrained estimate" };
}

const LAYERS = Object.freeze({
  "natural-solid": [["terrain","Terrain"],["landmarks","Named landmarks"],["resources","Resources"],["installations","Installations"],["hazards","Hazards"],["routes","Surface routes"]],
  giant: [["atmosphere","Atmosphere"],["storms","Storms"],["radiation","Radiation"],["operations","Operations"]],
  belt: [["mapped-bodies","Mapped bodies"],["resources","Resources"],["hazards","Hazards"],["traffic","Traffic"]],
  station: [["structure","Structure"],["habitation","Habitation"],["industry","Industry"],["docking","Docking"],["hazards","Hazards"],["approaches","Approaches"]],
  shipyard: [["structure","Structure"],["habitation","Habitation"],["industry","Industry"],["docking","Docking"],["hazards","Hazards"],["approaches","Approaches"]],
  vessel: [["structure","Structure"],["habitation","Habitation"],["docking","Docking"],["hazards","Hazards"],["approaches","Approaches"]],
  fleet: [["structure","Formation"],["docking","Formation nodes"],["hazards","Safety zones"],["approaches","Identification corridor"]],
  blinkgate: [["structure","Gate structure"],["habitation","Control stations"],["industry","Power systems"],["docking","Support docks"],["hazards","Transit exclusion"],["approaches","Transit vectors"]],
  megastructure: [["structure","Segments"],["habitation","Occupied nodes"],["industry","Power & maintenance"],["docking","Transfer nodes"],["hazards","Restricted sections"],["approaches","Approach vectors"]],
  anomaly: [["observation","Observation perimeter"],["instability","Instability"],["hazards","Exclusion boundary"],["sensors","Sensor corridors"]],
});
export function operationLayerDefinitions(kind) { return (LAYERS[kind] ?? []).map(([id,label], index) => ({ id, label, defaultVisible: index !== 2 || !["natural-solid","station"].includes(kind) })); }

export function bodyOperationsLod(zoom = 1, mobile = false) {
  if (zoom < 1.2) return { id: "orbital", maxPriority: 1, maxFeatures: mobile ? 18 : 26 };
  if (zoom < 2.2) return { id: "intermediate", maxPriority: 2, maxFeatures: mobile ? 38 : 60 };
  return { id: "close", maxPriority: 3, maxFeatures: mobile ? 64 : 110 };
}
export function buildBodyOperationsRenderPlan(asset, zoom = 1, mobile = false) {
  const lod = bodyOperationsLod(zoom, mobile);
  const visible = asset.features.filter((feature) => (feature.lodPriority ?? 2) <= lod.maxPriority).sort((a,b) => (a.lodPriority ?? 2)-(b.lodPriority ?? 2) || a.id.localeCompare(b.id)).slice(0, lod.maxFeatures);
  return { lod, features: visible, labels: visible.filter((feature) => feature.name && (feature.lodPriority ?? 2) <= Math.min(2, lod.maxPriority)).slice(0, mobile ? 20 : 32) };
}
export function bodyOperationsFeatureBudget(asset, zoom = 3, mobile = false) { return buildBodyOperationsRenderPlan(asset, zoom, mobile).features.length; }
export function featureLookup(asset) { return new Map(asset.features.map((feature) => [feature.id, feature])); }

export function inspectBodyOperationFeature(feature) {
  if (!feature) return null;
  return {
    name: feature.name || feature.id,
    type: feature.type || "operational feature",
    detail: [feature.operationalRole, feature.resource, feature.hazard].filter(Boolean).join(" · ") || feature.description || "Operational survey feature",
    provenance: feature.provenance || BODY_OPERATIONS_STATUS,
  };
}

function finite(value) { return Number.isFinite(Number(value)); }
export function validateBodyOperationsAsset(asset) {
  const errors = [];
  if (asset?.schemaVersion !== BODY_OPERATIONS_SCHEMA_VERSION) errors.push("schemaVersion");
  if (asset?.operationalModelVersion !== BODY_OPERATIONS_MODEL_VERSION) errors.push("operationalModelVersion");
  if (!asset?.system || !asset?.body || !asset?.canonicalType || !asset?.operationalKind) errors.push("identity");
  if (!asset?.permanentOperationalSeed || !asset?.canonicalSourceFingerprint) errors.push("provenance");
  if (!asset?.coordinateFrame?.id || !asset?.coordinateFrame?.geometryKind) errors.push("coordinateFrame");
  if (!Array.isArray(asset?.features) || !asset.features.length) errors.push("features");
  const ids = new Set();
  for (const feature of asset?.features ?? []) {
    if (!feature.id || ids.has(feature.id)) errors.push(`feature-id:${feature.id}`); else ids.add(feature.id);
    if (!feature.type || !feature.layer || !feature.position || !feature.operationalRole || !feature.description) errors.push(`feature-contract:${feature.id}`);
    if (["natural-solid","giant"].includes(asset.operationalKind)) {
      if (!finite(feature.position.lat) || Number(feature.position.lat) < -90 || Number(feature.position.lat) > 90 || !finite(feature.position.lon) || Number(feature.position.lon) < -180 || Number(feature.position.lon) >= 180) errors.push(`spherical-position:${feature.id}`);
    } else if (!finite(feature.position.x) || !finite(feature.position.y) || !finite(feature.position.z)) errors.push(`cartesian-position:${feature.id}`);
    for (const ref of feature.refs ?? []) if (!ids.has(ref) && !asset.features.some((candidate) => candidate.id === ref)) errors.push(`unresolved-ref:${feature.id}:${ref}`);
  }
  return errors;
}

export function projectOperationPosition(asset, feature, yaw = 0, pitch = 0, radius = 250) {
  if (["natural-solid","giant"].includes(asset.operationalKind)) {
    const lat = Number(feature.position.lat) * Math.PI / 180, lon = Number(feature.position.lon) * Math.PI / 180 + yaw;
    const x = Math.cos(lat) * Math.sin(lon), y0 = Math.sin(lat), z0 = Math.cos(lat) * Math.cos(lon);
    const y = y0 * Math.cos(pitch) - z0 * Math.sin(pitch), z = y0 * Math.sin(pitch) + z0 * Math.cos(pitch);
    return { x: 450 + x * radius, y: 340 - y * radius, depth: z, visible: z >= 0 };
  }
  const max = Math.max(1, ...asset.features.flatMap((f) => [Math.abs(Number(f.position.x)||0), Math.abs(Number(f.position.y)||0), Math.abs(Number(f.position.z)||0)]));
  const x0 = Number(feature.position.x) / max, y0 = Number(feature.position.y) / max, z0 = Number(feature.position.z) / max;
  const x1 = x0 * Math.cos(yaw) - z0 * Math.sin(yaw), z1 = x0 * Math.sin(yaw) + z0 * Math.cos(yaw);
  const y1 = y0 * Math.cos(pitch) - z1 * Math.sin(pitch), z2 = y0 * Math.sin(pitch) + z1 * Math.cos(pitch);
  return { x: 450 + x1 * radius, y: 340 - y1 * radius, depth: z2, visible: true };
}

export async function loadBodyOperationAsset(system, body, moduleId = "orphaned-sun-cluster-map") {
  const path = bodyOperationAssetPath(system, body);
  const response = await fetch(`modules/${moduleId}/${path}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Unable to load body operations for ${system}/${body} (${response.status})`);
  const asset = await response.json();
  const errors = validateBodyOperationsAsset(asset); if (errors.length) throw new Error(`Invalid body operations asset ${system}/${body}: ${errors.join(", ")}`);
  return asset;
}
