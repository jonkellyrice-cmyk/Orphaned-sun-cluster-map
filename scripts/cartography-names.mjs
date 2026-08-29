import { assignFeatureNames } from "./cartography-toponymy.mjs";

const isForest = (category) => category?.includes("forest") || category === "taiga";
const isDesert = (category) => category?.includes("desert") || category === "steppe";

function centroid(points) {
  const ring = points.slice(0, -1), divisor = Math.max(1, ring.length);
  return [Number((ring.reduce((sum, point) => sum + point[0], 0) / divisor).toFixed(3)), Number((ring.reduce((sum, point) => sum + point[1], 0) / divisor).toFixed(3))];
}

function pickRegions(regions, predicate, limit, featureClass) {
  return regions.filter((region) => predicate(region.category)).sort((a, b) => b.cellCount - a.cellCount || a.id.localeCompare(b.id)).slice(0, limit).map((region) => ({
    id: region.id,
    featureClass,
    geometryType: "multipolygon",
    geometryRef: region.id,
    at: centroid(region.polygons[0]),
    scale: region.cellCount,
    scientificClassification: region.category,
  }));
}

function localSummits(cells, resolutionDeg) {
  const latCount = Math.round(180 / resolutionDeg), lonCount = Math.round(360 / resolutionDeg), mod = (value) => (value + lonCount) % lonCount;
  return cells.filter((cell) => !cell.ocean && cell.elevationM >= 1_500).filter((cell) => {
    for (const [dy, dx] of [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]) {
      const y = cell.latIndex + dy; if (y < 0 || y >= latCount) continue;
      if (cells[y * lonCount + mod(cell.lonIndex + dx)].elevationM > cell.elevationM) return false;
    }
    return true;
  }).sort((a, b) => b.elevationM - a.elevationM || a.id - b.id).slice(0, 16);
}

/** Build the permanent, culture-aware gazetteer over literal generated geometry. */
export function buildNamedGeography({ coarse, terrain, hydrology, regions }) {
  for (const layer of [terrain, hydrology, regions]) if (layer.sourceSeed !== coarse.seed || layer.sourceFingerprint !== coarse.inputFingerprint) throw new Error("Cartographic layer does not match the accepted world");
  const landTotal = terrain.landPolygons.reduce((sum, polygon) => sum + polygon.areaDeg2, 0);
  const land = terrain.landPolygons.slice(0, 24).map((polygon) => {
    const continental = coarse.body !== "Eventide" && polygon.areaDeg2 >= Math.max(200, landTotal * .09);
    return { id: polygon.id, featureClass: continental ? "continent" : "island", geometryType: "polygon", geometryRef: polygon.id, at: centroid(polygon.points), scale: polygon.areaDeg2, scientificClassification: continental ? "major continental landmass" : "island or microcontinental fragment" };
  });
  const oceanRegions = regions.ecoregions.filter((region) => ["open-ocean", "tropical-ocean", "sea-ice"].includes(region.category)).sort((a, b) => b.cellCount - a.cellCount || a.id.localeCompare(b.id));
  const waters = oceanRegions.slice(0, 8).map((region, index) => ({ id: region.id, featureClass: index < Math.min(2, oceanRegions.length) && region.cellCount >= 80 ? "ocean" : "sea", geometryType: "multipolygon", geometryRef: region.id, at: centroid(region.polygons[0]), scale: region.cellCount, scientificClassification: region.category }));
  const rivers = hydrology.rivers.slice().sort((a, b) => b.dischargeIndex - a.dischargeIndex || a.id.localeCompare(b.id)).slice(0, 28).map((river) => ({ id: river.id, featureClass: "river", geometryType: "polyline", geometryRef: river.id, at: river.points[Math.floor(river.points.length / 2)], scale: river.dischargeIndex, scientificClassification: `${river.mouth}-draining river system` }));
  const lakes = hydrology.lakes.slice(0, 18).map((lake) => ({ id: lake.id, featureClass: "lake", geometryType: "polygon", geometryRef: lake.id, at: centroid(lake.polygon), scale: lake.catchmentIndex, scientificClassification: "surface freshwater basin" }));
  const wetlands = hydrology.wetlands.slice(0, 12).map((wetland) => ({ id: wetland.id, featureClass: "wetland", geometryType: "polygon", geometryRef: wetland.id, at: centroid(wetland.polygon), scale: 1, scientificClassification: "hydrologically sustained wetland" }));
  const glaciers = hydrology.glaciers.slice(0, 12).map((glacier) => ({ id: glacier.id, featureClass: "glacier", geometryType: "polygon", geometryRef: glacier.id, at: centroid(glacier.polygon), scale: Math.abs(glacier.meanTemperatureC), scientificClassification: "persistent surface ice" }));
  const summits = localSummits(regions.cells, regions.resolutionDeg).map((cell, index) => ({ id: `summit-${index + 1}`, featureClass: "mountain", geometryType: "point", at: [cell.lat, cell.lon], scale: cell.elevationM, elevationM: cell.elevationM, scientificClassification: "local elevation maximum" }));
  const ranges = regions.resourceProvinces.filter((region) => region.category === "orogenic-metallic" && region.cellCount >= 3).slice(0, 10).map((region) => ({ id: `range-${region.id}`, featureClass: "range", geometryType: "multipolygon", geometryRef: region.id, at: centroid(region.polygons[0]), scale: region.cellCount, scientificClassification: "orogenic belt" }));
  const deserts = pickRegions(regions.ecoregions, isDesert, 12, "desert");
  const forests = pickRegions(regions.ecoregions, isForest, 12, "forest");
  const features = [...land, ...waters, ...rivers, ...lakes, ...wetlands, ...glaciers, ...summits, ...ranges, ...deserts, ...forests];
  const named = assignFeatureNames({ system: coarse.system, world: coarse.body, seed: coarse.seed, features });
  return {
    schemaVersion: 1,
    modelVersion: "orphaned-sun-cartography-v1",
    sourceFingerprint: coarse.inputFingerprint,
    sourceSeed: coarse.seed,
    system: coarse.system,
    body: coarse.body,
    language: named[0]?.language,
    namingProfile: named[0]?.profile,
    namingBasis: named[0]?.namingBasis,
    features: named,
  };
}
