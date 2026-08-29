export const BODY_LAYER_DEFINITIONS = Object.freeze([
  { id: "terrain", label: "Terrain & biomes", defaultVisible: true },
  { id: "hydrology", label: "Rivers & lakes", defaultVisible: true },
  { id: "resources", label: "Resources & soils", defaultVisible: false },
  { id: "settlements", label: "Cities & capital", defaultVisible: true },
  { id: "transport", label: "Transport corridors", defaultVisible: true },
]);

export function buildBodyLayers(geography) {
  const sites = new Map(geography.settlements.map((site) => [site.id, site]));
  return {
    terrain: geography.cells.map((cell) => ({ id: `cell-${cell.id}`, at: [cell.lat, cell.lon], biome: cell.biome, elevationM: cell.elevationM })),
    hydrology: [...geography.rivers.map((river, index) => ({ id: `river-${index}`, kind: "river", from: river.from, to: river.to, flow: river.flow })), ...geography.lakes.map((lake, index) => ({ id: `lake-${index}`, kind: "lake", at: lake.at, catchment: lake.catchment }))],
    resources: geography.cells.filter((cell) => !cell.ocean).map((cell) => ({ id: `resource-${cell.id}`, at: [cell.lat, cell.lon], resource: cell.resource, soil: cell.soil })),
    settlements: geography.settlements.map((site) => ({ ...site, label: site.kind === "capital" ? "Capital" : "City" })),
    transport: geography.transportRoutes.map((route, index) => ({ id: `route-${index}`, ...route, fromSite: sites.get(route.from), toSite: sites.get(route.to) })),
  };
}

export function inspectSurfaceFeature(feature) {
  if (!feature) return null;
  if (feature.inspection) return feature.inspection;
  if (feature.operationalRole) return {
    name: feature.name || feature.properName || feature.label || feature.id || "Operational feature",
    type: feature.type || feature.role || "operational feature",
    detail: [feature.operationalRole, feature.resource, feature.hazard].filter(Boolean).join(" · ") || feature.description || "Operational survey feature",
    provenance: feature.provenance || "accepted-generated-canon",
  };
  return {
    name: feature.properName || feature.label || feature.id || feature.biome || feature.type || "Mapped feature",
    type: feature.role || feature.kind || feature.featureClass || feature.biome || feature.type || "surface feature",
    detail: feature.scientificClassification || feature.resource || feature.soil || feature.mode || (feature.elevationM != null ? `${feature.elevationM} m elevation` : "Orbital survey feature"),
  };
}
