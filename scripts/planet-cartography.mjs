const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const mod = (value, divisor) => ((value % divisor) + divisor) % divisor;

function hashUnit(text) { let value = 2166136261; for (const char of String(text)) value = Math.imul(value ^ char.charCodeAt(0), 16777619); return (value >>> 0) / 4294967295; }

function anchoredNoise(seed, lat, lon) {
  const phaseA = hashUnit(`${seed}/phase-a`) * Math.PI * 2, phaseB = hashUnit(`${seed}/phase-b`) * Math.PI * 2;
  const a = Math.sin((lon * .21 + lat * .13) * Math.PI / 18 + phaseA);
  const b = Math.cos((lon * .37 - lat * .19) * Math.PI / 18 + phaseB);
  const c = Math.sin((lon * .73 + lat * .51) * Math.PI / 18 + phaseA - phaseB);
  return a * .52 + b * .31 + c * .17;
}

function coarseElevationAt(coarse, lat, lon) {
  return coarseValueAt(coarse, lat, lon, "elevationM");
}

function coarseValueAt(coarse, lat, lon, field) {
  const resolution = coarse.resolutionDeg, { latCount, lonCount } = coarse.grid;
  const latPosition = (lat + 90) / resolution - .5, lonPosition = (lon + 180) / resolution - .5;
  const south = clamp(Math.floor(latPosition), 0, latCount - 1), north = clamp(south + 1, 0, latCount - 1);
  const westRaw = Math.floor(lonPosition), west = mod(westRaw, lonCount), east = mod(westRaw + 1, lonCount);
  const fy = clamp(latPosition - south, 0, 1), fx = lonPosition - Math.floor(lonPosition);
  const value = (i, j) => Number(coarse.cells[i * lonCount + j][field] ?? 0);
  const low = value(south, west) * (1 - fx) + value(south, east) * fx;
  const high = value(north, west) * (1 - fx) + value(north, east) * fx;
  return low * (1 - fy) + high * fy;
}

function cellNeighbors(cell, latCount, lonCount, diagonals = true) {
  const offsets = diagonals
    ? [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]
    : [[-1, 0], [0, -1], [0, 1], [1, 0]];
  return offsets.flatMap(([dy, dx]) => {
    const y = cell.latIndex + dy;
    return y < 0 || y >= latCount ? [] : [y * lonCount + mod(cell.lonIndex + dx, lonCount)];
  });
}

export function buildRefinedTerrain(coarse, { resolutionDeg = 2 } = {}) {
  if (coarse.schemaVersion !== 1 || !coarse.cells?.length) throw new TypeError("A canonical coarse geography asset is required");
  if (coarse.resolutionDeg % resolutionDeg !== 0) throw new RangeError("Refined resolution must evenly subdivide the accepted coarse grid");
  const latCount = Math.round(180 / resolutionDeg), lonCount = Math.round(360 / resolutionDeg), raw = [];
  for (let latIndex = 0; latIndex < latCount; latIndex += 1) for (let lonIndex = 0; lonIndex < lonCount; lonIndex += 1) {
    const lat = -90 + resolutionDeg / 2 + latIndex * resolutionDeg, lon = -180 + resolutionDeg / 2 + lonIndex * resolutionDeg;
    const anchor = coarseElevationAt(coarse, lat, lon);
    // Eventide's canonical land is volcanic arcs, banks and microfragments,
    // never a hidden polar or continental mass. Compress its broad coarse
    // relief so accepted anchors guide many islands instead of joining them.
    const archipelago = coarse.body === "Eventide", coastalDetail = anchoredNoise(coarse.seed, lat, lon) * (archipelago ? 2200 : 310);
    raw.push({ id: raw.length, latIndex, lonIndex, lat, lon, rawElevationM: anchor * (archipelago ? .2 : 1) + coastalDetail - (archipelago ? Math.max(0, Math.abs(lat) - 62) * 24 : 0) });
  }
  const sorted = raw.map((cell) => cell.rawElevationM).sort((a, b) => a - b), targetWater = coarse.realizedWaterFraction;
  const seaLevel = sorted[clamp(Math.round(targetWater * (sorted.length - 1)), 0, sorted.length - 1)];
  const cells = raw.map((cell) => ({ ...cell, elevationM: Math.round(cell.rawElevationM - seaLevel), ocean: cell.rawElevationM <= seaLevel }));
  const realizedWaterFraction = Number((cells.filter((cell) => cell.ocean).length / cells.length).toFixed(5));
  const coastlines = traceClosedCoastlines({ cells, latCount, lonCount, resolutionDeg });
  return { schemaVersion: 1, modelVersion: "orphaned-sun-cartography-v1", sourceFingerprint: coarse.inputFingerprint, sourceSeed: coarse.seed, resolutionDeg, grid: { latCount, lonCount }, targetWaterFraction: targetWater, realizedWaterFraction, seaLevelAdjustmentM: Math.round(seaLevel), cells, coastlines, landPolygons: coastlines.filter((line) => line.areaDeg2 >= resolutionDeg * resolutionDeg * 2) };
}

/**
 * Route water over the accepted refined relief and materialize renderer-ready
 * elevation, contour, river, lake, wetland and glacier geometry. The coarse
 * accepted world remains authoritative for climate; refinement only resolves
 * that field at a denser deterministic grid.
 */
export function buildRefinedHydrology(coarse, refined = buildRefinedTerrain(coarse)) {
  if (refined.sourceSeed !== coarse.seed || refined.sourceFingerprint !== coarse.inputFingerprint) throw new Error("Refined terrain does not match the accepted world");
  const { latCount, lonCount } = refined.grid;
  const cells = refined.cells.map((source) => {
    const precipitationMm = Math.round(coarseValueAt(coarse, source.lat, source.lon, "precipitationMm"));
    const coarseTemperature = coarseValueAt(coarse, source.lat, source.lon, "temperatureC");
    const coarseElevation = coarseElevationAt(coarse, source.lat, source.lon);
    const temperatureC = Number((coarseTemperature - Math.max(-2500, source.elevationM - coarseElevation) * .0058).toFixed(1));
    return { ...source, precipitationMm, temperatureC, runoff: source.ocean ? 0 : Math.max(0.03, precipitationMm / 700), flowAccumulation: 0, downstream: null };
  });
  for (const cell of cells) {
    if (cell.ocean) continue;
    const neighbors = cellNeighbors(cell, latCount, lonCount).map((id) => cells[id]);
    const lower = neighbors.filter((candidate) => candidate.elevationM < cell.elevationM).sort((a, b) => a.elevationM - b.elevationM || a.id - b.id)[0];
    cell.downstream = lower?.id ?? null;
    cell.flowAccumulation = cell.runoff;
  }
  for (const cell of cells.filter((item) => !item.ocean).sort((a, b) => b.elevationM - a.elevationM || a.id - b.id)) {
    if (cell.downstream != null) cells[cell.downstream].flowAccumulation += cell.flowAccumulation;
  }
  const landFlows = cells.filter((cell) => !cell.ocean).map((cell) => cell.flowAccumulation).sort((a, b) => a - b);
  const riverThreshold = landFlows[Math.floor(landFlows.length * .965)] ?? Infinity;
  const riverCells = new Set(cells.filter((cell) => !cell.ocean && cell.downstream != null && cell.flowAccumulation >= riverThreshold).map((cell) => cell.id));
  const upstreamRiverCount = new Map();
  for (const id of riverCells) { const downstream = cells[id].downstream; if (riverCells.has(downstream)) upstreamRiverCount.set(downstream, (upstreamRiverCount.get(downstream) ?? 0) + 1); }
  const sources = [...riverCells].filter((id) => !upstreamRiverCount.has(id)).sort((a, b) => cells[b].flowAccumulation - cells[a].flowAccumulation || a - b);
  const lakeByCell = new Map();
  const rivers = [];
  for (const sourceId of sources.slice(0, 96)) {
    const route = [], seen = new Set(); let current = cells[sourceId];
    while (current && !seen.has(current.id) && route.length < cells.length) {
      seen.add(current.id); route.push(current);
      if (current.ocean) break;
      if (current.downstream == null) {
        if (current.flowAccumulation >= riverThreshold * .55) lakeByCell.set(current.id, current);
        break;
      }
      current = cells[current.downstream];
    }
    if (route.length < 3) continue;
    const terminal = route.at(-1);
    rivers.push({
      id: `river-${rivers.length + 1}`,
      sourceCell: sourceId,
      mouth: terminal.ocean ? "ocean" : "lake",
      dischargeIndex: Number(route.at(-2)?.flowAccumulation.toFixed(2) ?? route[0].flowAccumulation.toFixed(2)),
      points: smoothOpen(route.map((cell) => [cell.lat, unwrapLon(cell.lon, route[0].lon)]), 1),
      elevationsM: route.map((cell) => cell.elevationM),
    });
  }
  for (const cell of cells.filter((item) => !item.ocean && item.downstream == null && item.flowAccumulation >= riverThreshold)) lakeByCell.set(cell.id, cell);
  const lakes = [...lakeByCell.values()].sort((a, b) => b.flowAccumulation - a.flowAccumulation).slice(0, 72).map((cell, index) => ({ id: `lake-${index + 1}`, cellId: cell.id, catchmentIndex: Number(cell.flowAccumulation.toFixed(2)), polygon: circlePolygon(cell.lat, cell.lon, clamp(.3 + Math.log10(cell.flowAccumulation + 1) * .28, .35, 1.8)) }));
  const lakeIds = new Set(lakes.map((lake) => lake.cellId));
  const wetlands = cells.filter((cell) => !cell.ocean && cell.elevationM < 300 && cell.precipitationMm >= 650 && (cell.flowAccumulation >= riverThreshold * .25 || cellNeighbors(cell, latCount, lonCount, false).some((id) => cells[id].ocean || lakeIds.has(id)))).filter((cell, index, all) => all.slice(0, index).every((other) => Math.abs(other.lat - cell.lat) + Math.abs(other.lon - cell.lon) >= refined.resolutionDeg * 2)).slice(0, 96).map((cell, index) => ({ id: `wetland-${index + 1}`, cellId: cell.id, polygon: circlePolygon(cell.lat, cell.lon, refined.resolutionDeg * .7) }));
  const glaciers = cells.filter((cell) => !cell.ocean && cell.temperatureC <= 0 && Math.abs(cell.lat) >= 48).filter((cell, index, all) => all.slice(0, index).every((other) => Math.abs(other.lat - cell.lat) + Math.abs(other.lon - cell.lon) >= refined.resolutionDeg * 3)).slice(0, 96).map((cell, index) => ({ id: `glacier-${index + 1}`, cellId: cell.id, meanTemperatureC: cell.temperatureC, polygon: circlePolygon(cell.lat, cell.lon, refined.resolutionDeg * .9) }));
  return {
    schemaVersion: 1,
    modelVersion: "orphaned-sun-cartography-v1",
    sourceFingerprint: refined.sourceFingerprint,
    sourceSeed: refined.sourceSeed,
    resolutionDeg: refined.resolutionDeg,
    elevationMesh: buildElevationMesh(cells, latCount, lonCount, refined.resolutionDeg),
    contours: buildContours(cells, latCount, lonCount, refined.resolutionDeg),
    riverThreshold: Number(riverThreshold.toFixed(3)),
    rivers, lakes, wetlands, glaciers,
    cells: cells.map(({ rawElevationM: ignoredRaw, ...cell }) => ({ ...cell, flowAccumulation: Number(cell.flowAccumulation.toFixed(3)) })),
  };
}

function unwrapLon(lon, reference) { let value = lon; while (value - reference > 180) value -= 360; while (value - reference < -180) value += 360; return value; }

function smoothOpen(points, iterations) {
  let line = points;
  for (let pass = 0; pass < iterations; pass += 1) {
    const next = [line[0]];
    for (let index = 0; index < line.length - 1; index += 1) {
      const a = line[index], b = line[index + 1];
      next.push([Number((a[0] * .75 + b[0] * .25).toFixed(3)), Number((a[1] * .75 + b[1] * .25).toFixed(3))], [Number((a[0] * .25 + b[0] * .75).toFixed(3)), Number((a[1] * .25 + b[1] * .75).toFixed(3))]);
    }
    next.push(line.at(-1)); line = next;
  }
  return line;
}

function circlePolygon(lat, lon, radiusDeg, count = 12) {
  const points = Array.from({ length: count }, (_, index) => { const angle = index / count * Math.PI * 2; return [Number(clamp(lat + Math.sin(angle) * radiusDeg, -89.9, 89.9).toFixed(3)), Number(unwrapLon(lon + Math.cos(angle) * radiusDeg / Math.max(.2, Math.cos(lat * Math.PI / 180)), lon).toFixed(3))]; });
  return [...points, points[0]];
}

function buildElevationMesh(cells, latCount, lonCount, resolutionDeg) {
  const stride = 2, rows = Math.ceil(latCount / stride), columns = Math.ceil(lonCount / stride);
  const vertices = [];
  for (let y = 0; y < latCount; y += stride) for (let x = 0; x < lonCount; x += stride) { const cell = cells[y * lonCount + x]; vertices.push([cell.lat, cell.lon, cell.elevationM]); }
  const triangles = [];
  for (let y = 0; y < rows - 1; y += 1) for (let x = 0; x < columns - 1; x += 1) { const a = y * columns + x, b = a + 1, c = a + columns, d = c + 1; triangles.push([a, c, b], [b, c, d]); }
  return { resolutionDeg: resolutionDeg * stride, rows, columns, vertices, triangles };
}

function buildContours(cells, latCount, lonCount, resolutionDeg) {
  const levels = [-4000, -2000, 0, 500, 1500, 3000, 5000], lines = [];
  const crossings = (a, b, level) => (a.elevationM < level && b.elevationM >= level) || (b.elevationM < level && a.elevationM >= level);
  for (const levelM of levels) for (const cell of cells) {
    const east = cells[cell.latIndex * lonCount + mod(cell.lonIndex + 1, lonCount)], north = cell.latIndex + 1 < latCount ? cells[(cell.latIndex + 1) * lonCount + cell.lonIndex] : null;
    if (crossings(cell, east, levelM)) lines.push({ levelM, points: [[cell.lat - resolutionDeg / 2, cell.lon + resolutionDeg / 2], [cell.lat + resolutionDeg / 2, cell.lon + resolutionDeg / 2]] });
    if (north && crossings(cell, north, levelM)) lines.push({ levelM, points: [[cell.lat + resolutionDeg / 2, cell.lon - resolutionDeg / 2], [cell.lat + resolutionDeg / 2, cell.lon + resolutionDeg / 2]] });
  }
  return lines;
}

function traceClosedCoastlines({ cells, latCount, lonCount, resolutionDeg }) {
  const at = (i, j) => i < 0 || i >= latCount ? null : cells[i * lonCount + mod(j, lonCount)];
  const vertexKey = ([i, j]) => `${i}:${mod(j, lonCount)}`;
  const edges = [];
  for (const cell of cells) {
    if (cell.ocean) continue;
    const i = cell.latIndex, j = cell.lonIndex;
    if (!at(i - 1, j) || at(i - 1, j).ocean) edges.push([[i, j], [i, j + 1]]);
    if (!at(i, j + 1) || at(i, j + 1).ocean) edges.push([[i, j + 1], [i + 1, j + 1]]);
    if (!at(i + 1, j) || at(i + 1, j).ocean) edges.push([[i + 1, j + 1], [i + 1, j]]);
    if (!at(i, j - 1) || at(i, j - 1).ocean) edges.push([[i + 1, j], [i, j]]);
  }
  const outgoing = new Map(); edges.forEach((edge, index) => { const key = vertexKey(edge[0]); if (!outgoing.has(key)) outgoing.set(key, []); outgoing.get(key).push(index); });
  const used = new Set(), loops = [];
  for (let startIndex = 0; startIndex < edges.length; startIndex += 1) {
    if (used.has(startIndex)) continue;
    const vertices = [], firstKey = vertexKey(edges[startIndex][0]); let edgeIndex = startIndex, guard = 0;
    while (edgeIndex != null && !used.has(edgeIndex) && guard++ < edges.length + 2) {
      used.add(edgeIndex); const edge = edges[edgeIndex]; vertices.push(edge[0]); const nextKey = vertexKey(edge[1]);
      if (nextKey === firstKey) { vertices.push(edges[startIndex][0]); break; }
      edgeIndex = (outgoing.get(nextKey) ?? []).find((candidate) => !used.has(candidate));
    }
    if (vertices.length < 4 || vertexKey(vertices[0]) !== vertexKey(vertices.at(-1))) continue;
    let points = vertices.map(([i, j]) => ({ lat: -90 + i * resolutionDeg, lon: -180 + mod(j, lonCount) * resolutionDeg }));
    for (let index = 1; index < points.length; index += 1) { while (points[index].lon - points[index - 1].lon > 180) points[index].lon -= 360; while (points[index].lon - points[index - 1].lon < -180) points[index].lon += 360; }
    points = chaikinClosed(points, 2); const areaDeg2 = Math.abs(signedArea(points));
    loops.push({ id: `coast-${loops.length + 1}`, closed: true, areaDeg2: Number(areaDeg2.toFixed(2)), points: points.map((point) => [Number(point.lat.toFixed(3)), Number(point.lon.toFixed(3))]) });
  }
  return loops.sort((a, b) => b.areaDeg2 - a.areaDeg2);
}

function chaikinClosed(points, iterations) {
  let ring = points.slice(0, -1);
  for (let pass = 0; pass < iterations; pass += 1) {
    const next = [];
    for (let index = 0; index < ring.length; index += 1) { const a = ring[index], b = ring[(index + 1) % ring.length]; next.push({ lat: a.lat * .75 + b.lat * .25, lon: a.lon * .75 + b.lon * .25 }, { lat: a.lat * .25 + b.lat * .75, lon: a.lon * .25 + b.lon * .75 }); }
    ring = next;
  }
  return [...ring, { ...ring[0] }];
}

function signedArea(points) { let area = 0; for (let index = 0; index < points.length - 1; index += 1) area += points[index].lon * points[index + 1].lat - points[index + 1].lon * points[index].lat; return area / 2; }
