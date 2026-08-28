export const AU_KM = 149_597_870.7;
export const LIGHT_YEAR_KM = 9_460_730_472_580.8;

export function parseCsv(text) {
  const records = [];
  let record = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { record.push(field); field = ""; }
    else if (char === "\n") { record.push(field.replace(/\r$/, "")); records.push(record); record = []; field = ""; }
    else field += char;
  }
  if (field || record.length) { record.push(field.replace(/\r$/, "")); records.push(record); }
  const header = records.shift() ?? [];
  return records.filter((row) => row.some(Boolean)).map((row) => Object.fromEntries(header.map((name, index) => [name, row[index] ?? ""])));
}

function numeric(value) {
  const parsed = Number(value);
  return value !== "" && Number.isFinite(parsed) ? parsed : null;
}

export function distanceToAu(value, unit) {
  if (unit === "AU") return Number(value);
  if (unit === "km") return Number(value) / AU_KM;
  throw new RangeError(`Unsupported system distance unit: ${unit}`);
}

export function vectorFromOrbit(distanceAu, phaseDeg = 0, inclinationDeg = 0) {
  const phase = Number(phaseDeg || 0) * Math.PI / 180;
  const inclination = Number(inclinationDeg || 0) * Math.PI / 180;
  return {
    x: distanceAu * Math.cos(phase),
    y: distanceAu * Math.sin(phase) * Math.cos(inclination),
    z: distanceAu * Math.sin(phase) * Math.sin(inclination),
  };
}

export function classifySystemObject(type) {
  const value = String(type).toLowerCase();
  if (value.includes("star")) return "star";
  if (value === "barycenter") return "barycenter";
  if (value.includes("belt") || value.includes("field")) return value.includes("anomaly") ? "anomaly" : "belt";
  if (value.includes("anomaly")) return "anomaly";
  if (value.includes("station") || value.includes("installation") || value.includes("shipyard") || value.includes("blinkgate") || value.includes("megastructure") || value.includes("tether") || value.includes("ring")) return "installation";
  if (value.includes("vessel") || value.includes("fleet") || value.includes("carrier")) return "vessel";
  if (value.includes("moon")) return "moon";
  if (value.includes("giant")) return "giant";
  return "planet";
}

export function buildSystemModel(rows, systemName) {
  const source = rows.filter((row) => row.system === systemName);
  if (!source.length) throw new RangeError(`Unknown system: ${systemName}`);
  const byName = new Map();
  const objects = source.map((row) => {
    const object = {
      ...row,
      id: `${row.system}:${row.object}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      name: row.object,
      objectClass: classifySystemObject(row.type),
      selectable: String(row.selectable).toLowerCase() === "yes",
      distanceAu: distanceToAu(row.distance_from_parent || 0, row.distance_unit || "AU"),
      phaseDeg: numeric(row.reference_phase_deg) ?? 0,
      inclinationDeg: numeric(row.inclination_deg) ?? 0,
      radiusRe: numeric(row.radius_re),
    };
    byName.set(object.name, object);
    return object;
  });

  const resolving = new Set();
  function resolve(object) {
    if (object.physical) return object.physical;
    if (resolving.has(object.name)) throw new Error(`Orbital parent cycle at ${object.name}`);
    resolving.add(object.name);
    const local = vectorFromOrbit(object.distanceAu, object.phaseDeg, object.inclinationDeg);
    const parent = byName.get(object.parent);
    const parentPosition = parent ? resolve(parent) : { x: 0, y: 0, z: 0 };
    object.physical = { x: parentPosition.x + local.x, y: parentPosition.y + local.y, z: parentPosition.z + local.z };
    object.parentObject = parent ?? null;
    resolving.delete(object.name);
    return object.physical;
  }
  for (const object of objects) resolve(object);
  const maxAu = Math.max(...objects.map((object) => Math.hypot(object.physical.x, object.physical.y, object.physical.z)), 1);
  return { name: systemName, objects, byName, maxAu };
}

export function physicalDistanceAu(a, b) {
  return Math.hypot(b.physical.x - a.physical.x, b.physical.y - a.physical.y, b.physical.z - a.physical.z);
}

export function physicalDistanceLy(a, b) {
  return physicalDistanceAu(a, b) * AU_KM / LIGHT_YEAR_KM;
}

export function formatSystemDistance(distanceAu) {
  const km = distanceAu * AU_KM;
  if (km < 1_000_000) return `${Math.round(km).toLocaleString()} km`;
  if (distanceAu < 0.1) return `${(km / 1_000_000).toFixed(2)} million km`;
  return `${distanceAu.toFixed(distanceAu < 1 ? 3 : 2)} AU`;
}

export function displayPosition(object, model) {
  if (!object.parentObject) return { x: 0, y: 0, z: 0 };
  const parent = displayPosition(object.parentObject, model);
  const local = vectorFromOrbit(object.distanceAu, object.phaseDeg, object.inclinationDeg);
  const localMagnitude = Math.max(object.distanceAu, 1e-12);
  const isLocal = object.distance_unit === "km";
  const displayRadius = isLocal
    ? 0.12 + Math.log1p(localMagnitude * AU_KM / 50_000) * 0.055
    : 0.28 + Math.log1p(localMagnitude * 2.4) / Math.log1p(model.maxAu * 2.4) * 3.35;
  const scale = displayRadius / localMagnitude;
  return { x: parent.x + local.x * scale, y: parent.y + local.y * scale, z: parent.z + local.z * scale };
}

export async function loadSystemRegistry(moduleId = "orphaned-sun-cluster-map") {
  const response = await fetch(`modules/${moduleId}/docs/system-orbital-distances.csv`);
  if (!response.ok) throw new Error(`Unable to load canonical system registry (${response.status})`);
  return parseCsv(await response.text());
}
