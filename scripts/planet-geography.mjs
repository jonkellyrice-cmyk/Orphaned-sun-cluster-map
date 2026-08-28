const DEG = Math.PI / 180;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const number = (row, field, fallback = 0) => Number.isFinite(Number(row[field])) ? Number(row[field]) : fallback;

export function seedToUint32(seed) {
  let hash = 2166136261;
  for (const char of String(seed)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createRng(seed) {
  let state = seedToUint32(seed) || 0x9e3779b9;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function vector(lat, lon) {
  const latitude = lat * DEG, longitude = lon * DEG, cos = Math.cos(latitude);
  return { x: cos * Math.cos(longitude), y: Math.sin(latitude), z: cos * Math.sin(longitude) };
}

function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }

function coordinateNoise(seed, lat, lon, octave = 0) {
  const value = Math.sin((lat + 91.17) * (12.9898 + octave) + (lon + 181.31) * (78.233 - octave) + seedToUint32(seed) * .000013) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
}

export function generatePlateModel(row) {
  const rng = createRng(`${row.geography_seed}|plates|${row.geography_model_version}`);
  const count = Math.max(4, Math.round(number(row, "major_plate_count", 9)));
  const continentalFraction = clamp(number(row, "continental_crust_pct", 35) / 100, .03, .95);
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: count }, (_, index) => {
    const y = 1 - 2 * (index + .5) / count;
    const radius = Math.sqrt(1 - y * y);
    const angle = index * goldenAngle + rng() * .55;
    const center = { x: Math.cos(angle) * radius, y, z: Math.sin(angle) * radius };
    const motionAngle = rng() * Math.PI * 2;
    return {
      id: index,
      center,
      crust: index < Math.round(count * continentalFraction) ? "continental" : "oceanic",
      buoyancy: (rng() - .5) * .34,
      motion: { x: Math.cos(motionAngle), y: (rng() - .5) * .45, z: Math.sin(motionAngle), speed: .35 + rng() * .9 },
    };
  });
}

function gridCells(resolutionDeg) {
  const latCount = Math.round(180 / resolutionDeg), lonCount = Math.round(360 / resolutionDeg);
  const cells = [];
  for (let latIndex = 0; latIndex < latCount; latIndex += 1) {
    const lat = -90 + resolutionDeg * (latIndex + .5);
    for (let lonIndex = 0; lonIndex < lonCount; lonIndex += 1) {
      const lon = -180 + resolutionDeg * (lonIndex + .5);
      cells.push({ id: latIndex * lonCount + lonIndex, latIndex, lonIndex, lat, lon, vector: vector(lat, lon) });
    }
  }
  return { cells, latCount, lonCount };
}

function neighbors(cell, latCount, lonCount) {
  const result = [];
  for (const [dy, dx] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const y = cell.latIndex + dy;
    if (y < 0 || y >= latCount) continue;
    const x = (cell.lonIndex + dx + lonCount) % lonCount;
    result.push(y * lonCount + x);
  }
  return result;
}

function assignPlate(cell, plates) {
  let first = null, second = null;
  for (const plate of plates) {
    const score = dot(cell.vector, plate.center);
    if (!first || score > first.score) { second = first; first = { plate, score }; }
    else if (!second || score > second.score) second = { plate, score };
  }
  return { plate: first.plate, boundaryGap: first.score - second.score, neighborPlate: second.plate };
}

function biomeFor(cell) {
  if (cell.ocean) return cell.temperatureC < 1 ? "sea-ice" : cell.temperatureC > 23 ? "tropical-ocean" : "open-ocean";
  if (cell.temperatureC < -7) return "ice-cap";
  if (cell.temperatureC < 2) return cell.precipitationMm > 450 ? "tundra" : "cold-desert";
  if (cell.precipitationMm < 220) return cell.temperatureC > 18 ? "hot-desert" : "cold-desert";
  if (cell.precipitationMm < 520) return cell.temperatureC > 18 ? "savanna" : "steppe";
  if (cell.precipitationMm > 1500 && cell.temperatureC > 20) return "tropical-rainforest";
  if (cell.precipitationMm > 900) return cell.temperatureC > 14 ? "temperate-rainforest" : "taiga";
  return cell.temperatureC > 17 ? "seasonal-forest" : "temperate-forest";
}

function soilFor(cell, volcanism) {
  if (cell.ocean) return "marine-sediment";
  if (cell.biome === "ice-cap") return "glacial-mineral";
  if (cell.boundary > .72 && volcanism > .7) return "volcanic-fertile";
  if (cell.riverAccumulation > 6) return "alluvial-fertile";
  if (cell.biome.includes("desert")) return "arid-mineral";
  if (cell.precipitationMm > 1300) return "leached-humid";
  return "temperate-loam";
}

function resourceFor(cell, row) {
  if (cell.ocean) return cell.boundary > .7 ? "hydrothermal-seafloor" : "marine-biological";
  if (cell.boundary > .78) return "orogenic-metallic";
  if (cell.elevationM > 1800) return "upland-mineral";
  if (cell.riverAccumulation > 8) return "alluvial-agricultural";
  if (number(row, "internal_heat_flux_earth", 1) > 1.15) return "geothermal";
  return "sedimentary-basin";
}

function segment(a, b, resolutionDeg) {
  const half = resolutionDeg / 2;
  if (a.latIndex === b.latIndex) {
    const lon = a.lon < b.lon || Math.abs(a.lon - b.lon) > 180 ? a.lon + half : a.lon - half;
    return [[a.lat - half, lon], [a.lat + half, lon]];
  }
  const lat = (a.lat + b.lat) / 2;
  return [[lat, a.lon - half], [lat, a.lon + half]];
}

export function generatePlanetGeography(row, options = {}) {
  const resolutionDeg = Number(options.resolutionDeg ?? 6);
  if (360 % resolutionDeg || 180 % resolutionDeg) throw new RangeError("resolutionDeg must divide 180 and 360");
  if (!row.geography_seed) throw new Error(`Missing geography seed for ${row.system}/${row.object}`);
  const plates = generatePlateModel(row);
  const { cells, latCount, lonCount } = gridCells(resolutionDeg);
  const heat = number(row, "internal_heat_flux_earth", 1), gravity = number(row, "surface_gravity_g", 1);
  const targetWater = clamp(number(row, "water_pct", 50) / 100, .01, .99);
  const baseTemp = number(row, "mean_surface_temp_c", 15), meanPrecip = number(row, "mean_annual_precipitation_mm", 850);
  const maxLand = number(row, "maximum_land_elevation_m", 7000), maxOcean = number(row, "maximum_ocean_depth_m", 9000);
  const seed = row.geography_seed;

  for (const cell of cells) {
    const assignment = assignPlate(cell, plates);
    const boundary = Math.exp(-assignment.boundaryGap * 24);
    const relative = dot(assignment.plate.motion, assignment.neighborPlate.center) - dot(assignment.neighborPlate.motion, assignment.plate.center);
    const tectonic = boundary * clamp(relative * 1.7, -1, 1) * heat;
    const continentalBase = assignment.plate.crust === "continental" ? 1.05 : -1.05;
    const broadNoise = coordinateNoise(seed, Math.round(cell.lat / 12) * 12, Math.round(cell.lon / 12) * 12, 1);
    const localNoise = coordinateNoise(seed, cell.lat, cell.lon, 2);
    cell.plateId = assignment.plate.id;
    cell.boundary = boundary;
    cell.rawElevation = continentalBase + assignment.plate.buoyancy + broadNoise * .42 + localNoise * .18 + tectonic * 1.25;
  }

  const sorted = cells.map((cell) => cell.rawElevation).sort((a, b) => a - b);
  const seaIndex = clamp(Math.round(targetWater * (sorted.length - 1)), 0, sorted.length - 1);
  const seaLevel = sorted[seaIndex];
  const landMax = Math.max(...cells.map((cell) => cell.rawElevation - seaLevel));
  const oceanMax = Math.max(...cells.map((cell) => seaLevel - cell.rawElevation));
  for (const cell of cells) {
    cell.ocean = cell.rawElevation <= seaLevel;
    cell.elevationM = Math.round(cell.ocean
      ? -(seaLevel - cell.rawElevation) / Math.max(oceanMax, .001) * maxOcean
      : (cell.rawElevation - seaLevel) / Math.max(landMax, .001) * maxLand);
    const latitudeCooling = Math.pow(Math.abs(cell.lat) / 90, 1.28) * 31;
    const lapse = Math.max(0, cell.elevationM) * .0062;
    const climateNoise = coordinateNoise(`${seed}|climate`, cell.lat, cell.lon, 3) * 3.2;
    cell.temperatureC = Number((baseTemp + 10.5 - latitudeCooling - lapse + climateNoise).toFixed(1));
    const latitudeMoisture = .62 + Math.pow(Math.cos(cell.lat * DEG), 2) * .56;
    const elevationDrying = cell.ocean ? 1.15 : clamp(1 - Math.max(0, cell.elevationM) / 11000, .38, 1);
    const rainNoise = .72 + (coordinateNoise(`${seed}|rain`, cell.lat, cell.lon, 4) + 1) * .28;
    cell.precipitationMm = Math.round(clamp(meanPrecip * latitudeMoisture * elevationDrying * rainNoise, 40, 3600));
    cell.neighbors = neighbors(cell, latCount, lonCount);
    cell.riverAccumulation = cell.ocean ? 0 : cell.precipitationMm / 700;
  }

  const landDescending = cells.filter((cell) => !cell.ocean).sort((a, b) => b.elevationM - a.elevationM);
  for (const cell of landDescending) {
    const lower = cell.neighbors.map((id) => cells[id]).filter((neighbor) => neighbor.elevationM < cell.elevationM).sort((a, b) => a.elevationM - b.elevationM)[0];
    cell.downstream = lower?.id ?? null;
    if (lower) lower.riverAccumulation += cell.riverAccumulation;
  }
  const accumulationValues = landDescending.map((cell) => cell.riverAccumulation).sort((a, b) => a - b);
  const riverThreshold = accumulationValues[Math.floor(accumulationValues.length * .94)] ?? Infinity;
  for (const cell of cells) {
    cell.river = !cell.ocean && cell.riverAccumulation >= riverThreshold && cell.downstream !== null;
    cell.lake = !cell.ocean && cell.downstream === null && cell.riverAccumulation > riverThreshold * .55;
    cell.biome = biomeFor(cell);
    cell.soil = soilFor(cell, heat);
    cell.resource = resourceFor(cell, row);
    const comfort = clamp(1 - Math.abs(cell.temperatureC - 18) / 32, 0, 1);
    const moisture = clamp(cell.precipitationMm / 1000, .1, 1.15);
    const terrain = clamp(1 - Math.max(0, cell.elevationM - 1200) / 5000, .1, 1);
    const fertility = ["volcanic-fertile", "alluvial-fertile", "temperate-loam"].includes(cell.soil) ? 1 : .55;
    cell.suitability = cell.ocean ? 0 : Number((comfort * moisture * terrain * fertility).toFixed(3));
  }

  const coastlines = [];
  for (const cell of cells) for (const neighborId of cell.neighbors) {
    const neighbor = cells[neighborId];
    if (cell.id < neighbor.id && cell.ocean !== neighbor.ocean) coastlines.push(segment(cell, neighbor, resolutionDeg));
  }
  const rivers = cells.filter((cell) => cell.river).map((cell) => ({ from: [cell.lat, cell.lon], to: cells[cell.downstream] ? [cells[cell.downstream].lat, cells[cell.downstream].lon] : null, flow: Number(cell.riverAccumulation.toFixed(2)) })).filter((river) => river.to);
  const lakes = cells.filter((cell) => cell.lake).map((cell) => ({ at: [cell.lat, cell.lon], catchment: Number(cell.riverAccumulation.toFixed(2)) }));
  const habitableCandidates = cells.filter((cell) => !cell.ocean).sort((a, b) => b.suitability - a.suitability);
  // Every target is canonically inhabited. Harsh worlds still need a stable
  // best-available settlement pattern, even when no cell clears an Earthlike
  // comfort threshold.
  const preferredCandidates = habitableCandidates.filter((cell) => cell.suitability > .18);
  const candidates = preferredCandidates.length >= 4 ? preferredCandidates : habitableCandidates;
  const sites = [];
  for (const cell of candidates) {
    if (sites.every((site) => Math.abs(site.lat - cell.lat) + Math.abs(site.lon - cell.lon) > resolutionDeg * 4)) sites.push({ id: `site-${sites.length + 1}`, lat: cell.lat, lon: cell.lon, suitability: cell.suitability, kind: sites.length ? "city" : "capital" });
    if (sites.length >= 18) break;
  }
  const routes = sites.slice(1).map((site) => {
    const prior = sites.slice(0, sites.indexOf(site));
    const target = prior.sort((a, b) => Math.hypot(a.lat - site.lat, a.lon - site.lon) - Math.hypot(b.lat - site.lat, b.lon - site.lon))[0];
    return { from: site.id, to: target.id, mode: waterRouteBetween(site, target, cells, resolutionDeg) ? "sea-or-air" : "surface-corridor" };
  });

  return {
    schemaVersion: 1,
    modelVersion: row.geography_model_version,
    inputFingerprint: row.geography_input_fingerprint,
    seed,
    system: row.system,
    body: row.object,
    resolutionDeg,
    grid: { latCount, lonCount },
    plateModel: plates,
    seaLevelRaw: Number(seaLevel.toFixed(6)),
    realizedWaterFraction: Number((cells.filter((cell) => cell.ocean).length / cells.length).toFixed(4)),
    cells: cells.map(({ vector: ignoredVector, neighbors: ignoredNeighbors, rawElevation: ignoredRaw, ...cell }) => cell),
    coastlines,
    rivers,
    lakes,
    settlements: sites,
    transportRoutes: routes,
  };
}

function waterRouteBetween(a, b, cells, resolutionDeg) {
  const samples = 8;
  for (let index = 1; index < samples; index += 1) {
    const lat = a.lat + (b.lat - a.lat) * index / samples, lon = a.lon + (b.lon - a.lon) * index / samples;
    const nearest = cells.reduce((best, cell) => Math.abs(cell.lat - lat) + Math.abs(cell.lon - lon) < best.distance ? { cell, distance: Math.abs(cell.lat - lat) + Math.abs(cell.lon - lon) } : best, { cell: null, distance: Infinity }).cell;
    if (nearest?.ocean) return true;
  }
  return false;
}

export function summarizeGeography(world) {
  const counts = (field) => Object.fromEntries([...new Set(world.cells.map((cell) => cell[field]))].map((value) => [value, world.cells.filter((cell) => cell[field] === value).length]));
  return { waterFraction: world.realizedWaterFraction, plates: world.plateModel.length, coastSegments: world.coastlines.length, rivers: world.rivers.length, lakes: world.lakes.length, settlements: world.settlements.length, biomes: counts("biome"), resources: counts("resource") };
}
