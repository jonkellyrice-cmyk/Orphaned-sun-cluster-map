import { assignFeatureNames } from "./cartography-toponymy.mjs";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const mod = (value, divisor) => ((value % divisor) + divisor) % divisor;

function neighbors(cell, grid, diagonals = true) {
  const offsets = diagonals ? [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]] : [[-1, 0], [1, 0], [0, -1], [0, 1]];
  return offsets.flatMap(([dy, dx]) => { const y = cell.latIndex + dy; return y < 0 || y >= grid.latCount ? [] : [y * grid.lonCount + mod(cell.lonIndex + dx, grid.lonCount)]; });
}

function angularDistance(a, b) {
  const dx = Math.min(Math.abs(a.lon - b.lon), 360 - Math.abs(a.lon - b.lon)) * Math.cos((a.lat + b.lat) * Math.PI / 360);
  return Math.hypot(a.lat - b.lat, dx);
}

const ECOLOGY_ROUTE_PENALTY = new Map([
  ["tropical-rainforest", 4.0],
  ["temperate-rainforest", 3.5],
  ["seasonal-forest", 2.6],
  ["temperate-forest", 2.6],
  ["taiga", 1.8],
  ["savanna", 0.8],
  ["tundra", 0.6],
]);

function settlementScaleClass(role, index) {
  if (["planetary capital", "major city", "major port city"].includes(role)) return "superstructure";
  return index < 12 ? "metropolitan" : "regional";
}

function corridorClass(origin, destination) {
  const scales = new Set([origin.scaleClass, destination.scaleClass]);
  if (origin.scaleClass === "superstructure" && destination.scaleClass === "superstructure") return "trunk";
  if (scales.has("superstructure") || scales.has("metropolitan")) return "primary";
  return "regional";
}

export function routingDoctrineForFaction(ownerFaction = "") {
  const owner = String(ownerFaction).toLowerCase();
  if (owner.includes("xuanjia") || owner.includes("mandate")) return "direct";
  if (owner.includes("adanian") || owner.includes("conclave")) return "ecological-avoidance";
  return "least-resistance";
}

function routingStepCost(cell, next, routingDoctrine) {
  const reliefPenalty = Math.abs(next.elevationM - cell.elevationM) / 450;
  const altitudePenalty = Math.max(0, next.elevationM - 1_800) / 4_000;
  if (routingDoctrine === "direct") {
    // Mandate corridors privilege geometric directness; terrain remains a weak engineering cost rather than a controlling obstacle.
    return 1 + reliefPenalty * 0.08 + altitudePenalty * 0.08;
  }
  const baseline = 1 + reliefPenalty + altitudePenalty;
  if (routingDoctrine !== "ecological-avoidance") return baseline;
  // Conclave corridors preserve natural systems where practical, accepting detours around high-value living terrain and drainage.
  const biomePenalty = ECOLOGY_ROUTE_PENALTY.get(next.biome) ?? 0;
  const freshwaterPenalty = next.flowAccumulation > 6 ? 0.9 : next.flowAccumulation > 3 ? 0.35 : 0;
  const fertilePenalty = ["alluvial-fertile", "volcanic-fertile", "temperate-loam"].includes(next.soil) ? 0.45 : 0;
  return baseline + biomePenalty + freshwaterPenalty + fertilePenalty;
}

function classifyLand(cells, grid) {
  const components = new Int32Array(cells.length).fill(-1); let component = 0;
  for (const origin of cells) {
    if (origin.ocean || components[origin.id] >= 0) continue;
    const queue = [origin.id]; components[origin.id] = component;
    for (let cursor = 0; cursor < queue.length; cursor += 1) for (const id of neighbors(cells[queue[cursor]], grid, false)) if (!cells[id].ocean && components[id] < 0) { components[id] = component; queue.push(id); }
    component += 1;
  }
  return components;
}

function settlementScore(cell, cells, grid) {
  if (cell.ocean) return 0;
  const adjacent = neighbors(cell, grid, true).map((id) => cells[id]), coast = adjacent.some((item) => item.ocean), river = cell.flowAccumulation > 4 || adjacent.some((item) => item.flowAccumulation > 6);
  const comfort = clamp(1 - Math.abs(cell.temperatureC - 18) / 34, 0, 1), moisture = clamp(cell.precipitationMm / 900, .12, 1), relief = clamp(1 - Math.max(0, cell.elevationM - 900) / 4_500, .15, 1);
  const fertile = ["alluvial-fertile", "volcanic-fertile", "temperate-loam"].includes(cell.soil) ? 1 : .58;
  const resource = ["orogenic-metallic", "upland-mineral", "geothermal", "sedimentary-basin"].includes(cell.resource) ? .12 : 0;
  return { value: Number((comfort * moisture * relief * fertile + (coast ? .17 : 0) + (river ? .16 : 0) + resource).toFixed(4)), coast, river, resource: resource > 0 };
}

function chooseSites(cells, grid, count = 18) {
  const candidates = cells.filter((cell) => !cell.ocean).map((cell) => ({ cell, ...settlementScore(cell, cells, grid) })).sort((a, b) => b.value - a.value || a.cell.id - b.cell.id), selected = [];
  for (const candidate of candidates) {
    if (selected.every((site) => angularDistance(site, candidate.cell) >= 7)) selected.push({ ...candidate.cell, settlementSuitability: candidate.value, drivers: [candidate.coast && "coastal access", candidate.river && "river/freshwater access", candidate.resource && "strategic resources", candidate.cell.soil?.includes("fertile") && "fertile soils"].filter(Boolean) });
    if (selected.length >= count) break;
  }
  if (selected.length < count) for (const candidate of candidates) { if (!selected.some((site) => site.id === candidate.cell.id)) selected.push({ ...candidate.cell, settlementSuitability: candidate.value, drivers: [candidate.coast && "coastal access", candidate.river && "river/freshwater access"].filter(Boolean) }); if (selected.length >= count) break; }
  return selected;
}

class MinHeap {
  constructor() { this.items = []; }
  push(item) { this.items.push(item); let i = this.items.length - 1; while (i) { const p = Math.floor((i - 1) / 2); if (this.items[p][0] <= item[0]) break; this.items[i] = this.items[p]; i = p; } this.items[i] = item; }
  pop() { const root = this.items[0], last = this.items.pop(); if (this.items.length) { let i = 0; while (true) { let child = i * 2 + 1; if (child >= this.items.length) break; if (child + 1 < this.items.length && this.items[child + 1][0] < this.items[child][0]) child += 1; if (this.items[child][0] >= last[0]) break; this.items[i] = this.items[child]; i = child; } this.items[i] = last; } return root; }
  get length() { return this.items.length; }
}

function surfacePath(cells, grid, start, goal, routingDoctrine = "least-resistance") {
  const heap = new MinHeap(), costs = new Float64Array(cells.length).fill(Infinity), prior = new Int32Array(cells.length).fill(-1);
  costs[start.id] = 0; heap.push([0, start.id]);
  while (heap.length) {
    const [priority, id] = heap.pop(), cell = cells[id];
    if (id === goal.id) break;
    if (priority > costs[id] + angularDistance(cell, goal)) continue;
    for (const nextId of neighbors(cell, grid, true)) {
      const next = cells[nextId]; if (next.ocean) continue;
      const step = routingStepCost(cell, next, routingDoctrine);
      const cost = costs[id] + step;
      if (cost < costs[nextId]) { costs[nextId] = cost; prior[nextId] = id; heap.push([cost + angularDistance(next, goal) / 2, nextId]); }
    }
  }
  if (prior[goal.id] < 0) return null;
  const ids = []; for (let id = goal.id; id >= 0; id = prior[id]) { ids.push(id); if (id === start.id) break; } ids.reverse();
  return ids.map((id) => [cells[id].lat, cells[id].lon]);
}

function seaLane(a, b, samples = 20) {
  let targetLon = b.lon; while (targetLon - a.lon > 180) targetLon -= 360; while (targetLon - a.lon < -180) targetLon += 360;
  return Array.from({ length: samples + 1 }, (_, index) => { const t = index / samples; return [Number((a.lat + (b.lat - a.lat) * t).toFixed(3)), Number((a.lon + (targetLon - a.lon) * t).toFixed(3))]; });
}

export function buildSettlementCartography({ coarse, hydrology, regions, gazetteer, ownerFaction = "", siteCount = 18 }) {
  for (const layer of [hydrology, regions, gazetteer]) if (layer.sourceSeed !== coarse.seed || layer.sourceFingerprint !== coarse.inputFingerprint) throw new Error("Cartographic layer does not match the accepted world");
  const cells = regions.cells, grid = { latCount: Math.round(180 / regions.resolutionDeg), lonCount: Math.round(360 / regions.resolutionDeg) }, components = classifyLand(cells, grid);
  const selected = chooseSites(cells, grid, siteCount);
  const siteFeatures = selected.map((cell, index) => {
    const role = index === 0 ? "planetary capital" : (cell.drivers.includes("coastal access") && index % 3 === 0 ? "major port city" : index < 6 ? "major city" : "regional city");
    return {
      id: `settlement-${index + 1}`,
      featureClass: index === 0 ? "capital" : (role === "major port city" ? "port" : "city"),
      kind: index === 0 ? "capital" : "city",
      role,
      scaleClass: settlementScaleClass(role, index),
      lat: cell.lat,
      lon: cell.lon,
      at: [cell.lat, cell.lon],
      cellId: cell.id,
      landComponent: components[cell.id],
      suitability: cell.settlementSuitability,
      drivers: cell.drivers,
    };
  });
  const settlements = assignFeatureNames({ system: coarse.system, world: coarse.body, seed: coarse.seed, features: siteFeatures });
  const routeFeatures = [];
  const routingDoctrine = routingDoctrineForFaction(ownerFaction);
  for (let index = 1; index < settlements.length; index += 1) {
    const destination = settlements[index], origin = settlements.slice(0, index).sort((a, b) => angularDistance(a, destination) - angularDistance(b, destination) || a.id.localeCompare(b.id))[0];
    const surface = origin.landComponent === destination.landComponent ? surfacePath(cells, grid, cells[origin.cellId], cells[destination.cellId], routingDoctrine) : null;
    routeFeatures.push({
      id: `transport-${routeFeatures.length + 1}`,
      featureClass: "road",
      kind: surface ? (index < 7 ? "primary surface corridor" : "regional surface corridor") : "sea/air lane",
      mode: surface ? "surface" : "sea-or-air",
      from: origin.id,
      to: destination.id,
      points: surface ?? seaLane(origin, destination),
      distanceDeg: Number(angularDistance(origin, destination).toFixed(3)),
      corridorClass: corridorClass(origin, destination),
      routingDoctrine: surface ? routingDoctrine : "not-applicable",
    });
  }
  const routes = assignFeatureNames({ system: coarse.system, world: coarse.body, seed: `${coarse.seed}|transport`, features: routeFeatures });
  return { schemaVersion: 1, modelVersion: "orphaned-sun-cartography-v1", sourceFingerprint: coarse.inputFingerprint, sourceSeed: coarse.seed, system: coarse.system, body: coarse.body, ownerFaction, routingDoctrine, settlements, routes };
}
