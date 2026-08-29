const mod = (value, divisor) => ((value % divisor) + divisor) % divisor;

function hash(text) {
  let value = 2166136261;
  for (const char of String(text)) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return value >>> 0;
}

function nearestCoarse(coarse, cell) {
  const y = Math.max(0, Math.min(coarse.grid.latCount - 1, Math.floor((cell.lat + 90) / coarse.resolutionDeg)));
  const x = mod(Math.floor((cell.lon + 180) / coarse.resolutionDeg), coarse.grid.lonCount);
  return coarse.cells[y * coarse.grid.lonCount + x];
}

function targetCounts(coarse, refinedCells, field, ocean) {
  const source = coarse.cells.filter((cell) => Boolean(cell.ocean) === ocean);
  const targetTotal = refinedCells.filter((cell) => Boolean(cell.ocean) === ocean).length;
  const counts = new Map();
  for (const cell of source) counts.set(cell[field], (counts.get(cell[field]) ?? 0) + 1);
  const quotas = [...counts].map(([category, count]) => {
    const exact = count / source.length * targetTotal;
    return { category, count: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });
  let missing = targetTotal - quotas.reduce((sum, quota) => sum + quota.count, 0);
  quotas.sort((a, b) => b.remainder - a.remainder || a.category.localeCompare(b.category));
  for (let index = 0; index < missing; index += 1) quotas[index % quotas.length].count += 1;
  return new Map(quotas.map(({ category, count }) => [category, count]));
}

function assignCanonicalField(coarse, cells, field, ocean) {
  const domain = cells.filter((cell) => Boolean(cell.ocean) === ocean);
  const targets = targetCounts(coarse, cells, field, ocean);
  const assigned = new Map(domain.map((cell) => {
    const anchor = nearestCoarse(coarse, cell);
    return [cell.id, Boolean(anchor.ocean) === ocean && targets.has(anchor[field]) ? anchor[field] : null];
  }));
  const current = () => { const counts = new Map(); for (const value of assigned.values()) if (value != null) counts.set(value, (counts.get(value) ?? 0) + 1); return counts; };
  // Fill coast-displaced cells and then rebalance to exact accepted category
  // quotas. Hash ordering is stable, while same-category neighbours keep
  // provinces spatially coherent instead of scattering pixels at random.
  for (const cell of domain.filter((item) => assigned.get(item.id) == null)) {
    const counts = current();
    const category = [...targets].filter(([name, target]) => (counts.get(name) ?? 0) < target).sort((a, b) => (b[1] - (counts.get(b[0]) ?? 0)) - (a[1] - (counts.get(a[0]) ?? 0)) || hash(`${coarse.seed}|${field}|${cell.id}|${a[0]}`) - hash(`${coarse.seed}|${field}|${cell.id}|${b[0]}`))[0]?.[0];
    assigned.set(cell.id, category ?? [...targets.keys()][0]);
  }
  let counts = current();
  for (const [needed, target] of targets) while ((counts.get(needed) ?? 0) < target) {
    const donors = [...targets].filter(([name, quota]) => (counts.get(name) ?? 0) > quota).map(([name]) => name);
    const candidate = domain.filter((cell) => donors.includes(assigned.get(cell.id))).sort((a, b) => adjacencyScore(b, needed, assigned, cells) - adjacencyScore(a, needed, assigned, cells) || hash(`${coarse.seed}|rebalance|${field}|${needed}|${a.id}`) - hash(`${coarse.seed}|rebalance|${field}|${needed}|${b.id}`))[0];
    if (!candidate) break;
    const prior = assigned.get(candidate.id); assigned.set(candidate.id, needed);
    counts.set(prior, counts.get(prior) - 1); counts.set(needed, (counts.get(needed) ?? 0) + 1);
  }
  return assigned;
}

function adjacencyScore(cell, category, assigned, cells) {
  const { latCount, lonCount } = cells.grid;
  let score = 0;
  for (const [dy, dx] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const y = cell.latIndex + dy;
    if (y >= 0 && y < latCount && assigned.get(y * lonCount + mod(cell.lonIndex + dx, lonCount)) === category) score += 1;
  }
  return score;
}

function polygonize(cells, field, resolutionDeg, grid) {
  const { latCount, lonCount } = grid, byId = new Map(cells.map((cell) => [cell.id, cell])), visited = new Set(), regions = [];
  const neighborIds = (cell) => [[-1, 0], [1, 0], [0, -1], [0, 1]].flatMap(([dy, dx]) => { const y = cell.latIndex + dy; return y < 0 || y >= latCount ? [] : [y * lonCount + mod(cell.lonIndex + dx, lonCount)]; });
  for (const origin of cells) {
    if (visited.has(origin.id)) continue;
    const category = origin[field], stack = [origin], component = []; visited.add(origin.id);
    while (stack.length) { const cell = stack.pop(); component.push(cell); for (const id of neighborIds(cell)) { const neighbor = byId.get(id); if (neighbor && !visited.has(id) && neighbor[field] === category) { visited.add(id); stack.push(neighbor); } } }
    const member = new Set(component.map((cell) => cell.id)), edges = [];
    for (const cell of component) {
      const i = cell.latIndex, j = cell.lonIndex;
      if (!member.has((i - 1) * lonCount + j)) edges.push([[i, j], [i, j + 1]]);
      if (!member.has(i * lonCount + mod(j + 1, lonCount))) edges.push([[i, j + 1], [i + 1, j + 1]]);
      if (!member.has((i + 1) * lonCount + j)) edges.push([[i + 1, j + 1], [i + 1, j]]);
      if (!member.has(i * lonCount + mod(j - 1, lonCount))) edges.push([[i + 1, j], [i, j]]);
    }
    const key = ([i, j]) => `${i}:${mod(j, lonCount)}`, outgoing = new Map();
    edges.forEach((edge, index) => { const k = key(edge[0]); if (!outgoing.has(k)) outgoing.set(k, []); outgoing.get(k).push(index); });
    const used = new Set(), rings = [];
    for (let start = 0; start < edges.length; start += 1) {
      if (used.has(start)) continue;
      const points = [], first = key(edges[start][0]); let edgeIndex = start, guard = 0;
      while (edgeIndex != null && !used.has(edgeIndex) && guard++ <= edges.length) { used.add(edgeIndex); const edge = edges[edgeIndex]; points.push(edge[0]); const next = key(edge[1]); if (next === first) { points.push(edges[start][0]); break; } edgeIndex = (outgoing.get(next) ?? []).find((id) => !used.has(id)); }
      if (points.length >= 4 && key(points[0]) === key(points.at(-1))) {
        const coordinates = points.map(([i, j]) => [-90 + i * resolutionDeg, -180 + mod(j, lonCount) * resolutionDeg]);
        for (let index = 1; index < coordinates.length; index += 1) { while (coordinates[index][1] - coordinates[index - 1][1] > 180) coordinates[index][1] -= 360; while (coordinates[index][1] - coordinates[index - 1][1] < -180) coordinates[index][1] += 360; }
        coordinates[coordinates.length - 1] = [...coordinates[0]];
        rings.push(coordinates);
      }
    }
    if (rings.length) regions.push({ id: `${field}-${regions.length + 1}`, category, cellCount: component.length, polygons: rings });
  }
  return regions.sort((a, b) => b.cellCount - a.cellCount || a.category.localeCompare(b.category));
}

export function buildCartographicRegions(coarse, hydrology) {
  if (hydrology.sourceSeed !== coarse.seed || hydrology.sourceFingerprint !== coarse.inputFingerprint) throw new Error("Hydrology does not match the accepted world");
  const cells = hydrology.cells.map((cell) => ({ ...cell }));
  cells.grid = hydrology.elevationMesh ? { latCount: Math.round(180 / hydrology.resolutionDeg), lonCount: Math.round(360 / hydrology.resolutionDeg) } : null;
  for (const field of ["biome", "soil", "resource"]) for (const ocean of [false, true]) {
    const assignment = assignCanonicalField(coarse, cells, field, ocean);
    for (const cell of cells) if (Boolean(cell.ocean) === ocean) cell[field] = assignment.get(cell.id);
  }
  const grid = cells.grid; delete cells.grid;
  const summary = {};
  for (const field of ["biome", "soil", "resource"]) { summary[field] = {}; for (const cell of cells) summary[field][cell[field]] = (summary[field][cell[field]] ?? 0) + 1; }
  return {
    schemaVersion: 1,
    modelVersion: "orphaned-sun-cartography-v1",
    sourceFingerprint: hydrology.sourceFingerprint,
    sourceSeed: hydrology.sourceSeed,
    resolutionDeg: hydrology.resolutionDeg,
    categorySummary: summary,
    ecoregions: polygonize(cells, "biome", hydrology.resolutionDeg, grid),
    soilRegions: polygonize(cells.filter((cell) => !cell.ocean), "soil", hydrology.resolutionDeg, grid),
    resourceProvinces: polygonize(cells, "resource", hydrology.resolutionDeg, grid),
    cells: cells.map(({ rawElevationM: ignoredRaw, ...cell }) => cell),
  };
}
