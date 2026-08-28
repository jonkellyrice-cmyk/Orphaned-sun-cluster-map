import { classifySystemObject } from "./system-data.mjs";

export function artificialBodyKind(row) {
  const objectClass = classifySystemObject(row.type);
  if (objectClass === "anomaly") return "anomaly";
  if (objectClass === "vessel") return row.type.includes("fleet") ? "fleet" : "vessel";
  if (objectClass !== "installation") return null;
  if (row.type.includes("blinkgate")) return "blinkgate";
  if (row.type.includes("shipyard")) return "shipyard";
  if (row.type.includes("megastructure") || row.type.includes("ring") || row.type.includes("tether")) return "megastructure";
  return "station";
}

function approachGeometry(kind) {
  if (kind === "anomaly") return { mode: "observation-perimeter", dockingNodes: [], exclusionRadius: 1 };
  if (kind === "blinkgate") return { mode: "gate-traffic-vector", dockingNodes: [{ id: "control", bearingDeg: 90 }, { id: "support", bearingDeg: 270 }], exclusionRadius: .72 };
  if (kind === "fleet" || kind === "vessel") return { mode: "formation-intercept", dockingNodes: [{ id: "primary", bearingDeg: 180 }], exclusionRadius: .38 };
  if (kind === "shipyard") return { mode: "yard-approach", dockingNodes: [{ id: "dock-a", bearingDeg: 45 }, { id: "dock-b", bearingDeg: 135 }, { id: "dock-c", bearingDeg: 225 }], exclusionRadius: .55 };
  return { mode: "orbital-docking", dockingNodes: [{ id: "port", bearingDeg: 90 }, { id: "starboard", bearingDeg: 270 }], exclusionRadius: .4 };
}

export function buildArtificialBodyModel(row) {
  const kind = artificialBodyKind(row);
  if (!kind) throw new TypeError(`${row.object} is not an artificial or anomalous body`);
  return {
    schemaVersion: 1,
    system: row.system,
    body: row.object,
    kind,
    dimensions: row.dimensions_estimate || "schematic; exact dimensions unestablished",
    structureClass: row.structure_class || row.type,
    visualArchetype: row.visual_archetype || kind,
    palette: row.visual_palette || "campaign interface neutral",
    population: row.population_crew_scale || "operational population unspecified",
    gravity: row.artificial_gravity || "varies by occupied section",
    power: row.power_axiolith || "canonical infrastructure power",
    mobility: row.mobility || "fixed reference-epoch position",
    function: row.primary_function || row.resource_profile || "mapped infrastructure",
    strategicRole: row.strategic_role || row.resource_value || "local operations",
    approach: approachGeometry(kind),
  };
}

export function buildArtificialBodyModels(rows) {
  return rows.filter((row) => artificialBodyKind(row)).map(buildArtificialBodyModel);
}
