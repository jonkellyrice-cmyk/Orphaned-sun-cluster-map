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
  const resolution = coarse.resolutionDeg, { latCount, lonCount } = coarse.grid;
  const latPosition = (lat + 90) / resolution - .5, lonPosition = (lon + 180) / resolution - .5;
  const south = clamp(Math.floor(latPosition), 0, latCount - 1), north = clamp(south + 1, 0, latCount - 1);
  const westRaw = Math.floor(lonPosition), west = mod(westRaw, lonCount), east = mod(westRaw + 1, lonCount);
  const fy = clamp(latPosition - south, 0, 1), fx = lonPosition - Math.floor(lonPosition);
  const value = (i, j) => coarse.cells[i * lonCount + j].elevationM;
  const low = value(south, west) * (1 - fx) + value(south, east) * fx;
  const high = value(north, west) * (1 - fx) + value(north, east) * fx;
  return low * (1 - fy) + high * fy;
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
