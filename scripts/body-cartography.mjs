const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function decodeBase64(value) {
  if (typeof Buffer !== "undefined") return Uint8Array.from(Buffer.from(value, "base64"));
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

export function decodeCartographyRaster(asset) {
  if (asset.schemaVersion !== 2) throw new TypeError("A schema-v2 refined cartography asset is required");
  const count = asset.grid.latCount * asset.grid.lonCount, ocean = decodeBase64(asset.raster.oceanMaskBase64);
  const decodeCategory = (field) => { const indices = decodeBase64(asset.raster[field].valuesBase64), categories = asset.raster[field].categories; return { indices, categories, at: (index) => categories[indices[index]] }; };
  if (ocean.length !== count || asset.raster.elevationM.length !== count) throw new Error("Refined cartography raster is incomplete");
  const biome = decodeCategory("biome"), soil = decodeCategory("soil"), resource = decodeCategory("resource");
  return { count, ocean, elevationM: Int32Array.from(asset.raster.elevationM), biome, soil, resource };
}

export function cartographyLod(zoom, mobile = false) {
  if (zoom < 1.15) return { id: "orbital", minRegionCells: 42, labels: mobile ? 12 : 18, resourceRegions: 0, rasterStride: 3 };
  if (zoom < 2.15) return { id: "regional", minRegionCells: 10, labels: mobile ? 26 : 40, resourceRegions: mobile ? 80 : 140, rasterStride: 2 };
  return { id: "surface", minRegionCells: 1, labels: mobile ? 48 : 80, resourceRegions: mobile ? 150 : 240, rasterStride: 1 };
}

export function selectCartographyLabels(asset, zoom, mobile = false) {
  const lod = cartographyLod(zoom, mobile), priority = { capital: 100, continent: 95, ocean: 94, city: 82, port: 81, sea: 78, range: 70, river: 65, lake: 60, mountain: 58, island: 55, desert: 48, forest: 46, wetland: 40, glacier: 40 };
  const settlements = asset.settlements.map((site) => ({ ...site, featureClass: site.featureClass ?? site.kind, labelSource: "settlement", scale: site.kind === "capital" ? 10_000 : site.suitability * 1_000 }));
  return [...asset.gazetteer.map((feature) => ({ ...feature, labelSource: "gazetteer" })), ...settlements].sort((a, b) => (priority[b.featureClass] ?? 0) - (priority[a.featureClass] ?? 0) || (b.scale ?? 0) - (a.scale ?? 0) || a.properName.localeCompare(b.properName)).slice(0, lod.labels);
}

export function orthographicGeoPoint(latDeg, lonDeg, yaw = 0, pitch = 0, radius = 250) {
  const lat = latDeg * Math.PI / 180, lon = lonDeg * Math.PI / 180 + yaw;
  const x = Math.cos(lat) * Math.sin(lon), y0 = Math.sin(lat), z0 = Math.cos(lat) * Math.cos(lon);
  const y = y0 * Math.cos(pitch) - z0 * Math.sin(pitch), z = y0 * Math.sin(pitch) + z0 * Math.cos(pitch);
  return { x: x * radius, y: -y * radius, z, visible: z >= 0 };
}

/** Project a geographic polyline, breaking it whenever it crosses the limb. */
export function projectGeoPath(points, yaw = 0, pitch = 0, radius = 250, center = [450, 340], closed = false) {
  if (!points?.length) return "";
  const projected = points.map(([lat, lon]) => orthographicGeoPoint(lat, lon, yaw, pitch, radius)), commands = []; let drawing = false, visibleCount = 0;
  for (const point of projected) {
    if (!point.visible) { drawing = false; continue; }
    commands.push(`${drawing ? "L" : "M"}${(center[0] + point.x).toFixed(2)},${(center[1] + point.y).toFixed(2)}`); drawing = true; visibleCount += 1;
  }
  if (closed && visibleCount === projected.length && commands.length) commands.push("Z");
  return commands.join(" ");
}

export function buildCartographyRenderPlan(asset, zoom = 1, mobile = false) {
  const lod = cartographyLod(zoom, mobile);
  return {
    lod,
    ecoregions: asset.regions.ecoregions.filter((region) => region.cellCount >= lod.minRegionCells),
    resources: asset.regions.resourceProvinces.filter((region) => region.cellCount >= lod.minRegionCells).slice(0, lod.resourceRegions),
    coastlines: asset.terrain.coastlines,
    rivers: asset.hydrology.rivers,
    waterbodies: [...asset.hydrology.lakes, ...asset.hydrology.wetlands, ...asset.hydrology.glaciers],
    settlements: asset.settlements,
    routes: asset.transportRoutes,
    labels: selectCartographyLabels(asset, zoom, mobile),
  };
}

export function cartographyFeatureBudget(plan) {
  return plan.ecoregions.length + plan.resources.length + plan.coastlines.length + plan.rivers.length + plan.waterbodies.length + plan.settlements.length + plan.routes.length + plan.labels.length;
}
