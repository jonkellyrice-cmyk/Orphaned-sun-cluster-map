const SVG_NS = "http://www.w3.org/2000/svg";

function svgElement(name, attrs = {}) {
  const el = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
  return el;
}

/**
 * Low-resolution territorial volumes extrapolated from the Orphaned Sun
 * Manger faction-control map. The XY footprints preserve the map's broad
 * topology and borders; Z-depth is deliberately inferred rather than treated
 * as a surveyed political boundary.
 *
 * Depths are centered near the campaign-map plane and sized to be comparable
 * to each territory's planar dimensions while still containing the known
 * systems shown inside that territory on the source map.
 */
export const FACTION_TERRITORIES = Object.freeze([
  Object.freeze({
    id: "eventide",
    name: "Eventide",
    color: "#9b55d6",
    zMin: -3.5,
    zMax: 3.5,
    footprint: Object.freeze([
      Object.freeze({ x: -8.0, y: 8.0 }),
      Object.freeze({ x: 3.0, y: 8.0 }),
      Object.freeze({ x: 2.2, y: 6.3 }),
      Object.freeze({ x: 0.7, y: 5.3 }),
      Object.freeze({ x: -0.8, y: 4.7 }),
      Object.freeze({ x: -2.5, y: 4.8 }),
      Object.freeze({ x: -3.3, y: 4.4 }),
      Object.freeze({ x: -4.7, y: 4.5 }),
      Object.freeze({ x: -5.8, y: 5.0 }),
      Object.freeze({ x: -6.6, y: 5.3 }),
      Object.freeze({ x: -8.0, y: 6.2 }),
    ]),
  }),
  Object.freeze({
    id: "accords",
    name: "Signatories of the Accords",
    color: "#49bf58",
    zMin: -4.0,
    zMax: 4.0,
    footprint: Object.freeze([
      Object.freeze({ x: -5.8, y: 5.0 }),
      Object.freeze({ x: -4.7, y: 4.5 }),
      Object.freeze({ x: -3.3, y: 4.4 }),
      Object.freeze({ x: -2.2, y: 3.9 }),
      Object.freeze({ x: -3.0, y: 2.8 }),
      Object.freeze({ x: -2.65, y: 1.8 }),
      Object.freeze({ x: -2.3, y: 1.05 }),
      Object.freeze({ x: -2.32, y: 0.25 }),
      Object.freeze({ x: -2.45, y: -0.6 }),
      Object.freeze({ x: -2.25, y: -1.3 }),
      Object.freeze({ x: -2.5, y: -2.25 }),
      Object.freeze({ x: -2.65, y: -3.9 }),
      Object.freeze({ x: -2.1, y: -4.5 }),
      Object.freeze({ x: -3.2, y: -4.8 }),
      Object.freeze({ x: -4.3, y: -5.4 }),
      Object.freeze({ x: -5.0, y: -5.7 }),
      Object.freeze({ x: -5.3, y: -4.5 }),
      Object.freeze({ x: -5.2, y: -3.3 }),
      Object.freeze({ x: -6.0, y: -2.5 }),
      Object.freeze({ x: -6.8, y: -1.5 }),
      Object.freeze({ x: -7.0, y: 0.2 }),
      Object.freeze({ x: -6.7, y: 1.0 }),
      Object.freeze({ x: -5.8, y: 1.8 }),
      Object.freeze({ x: -5.2, y: 2.5 }),
      Object.freeze({ x: -5.4, y: 3.5 }),
    ]),
  }),
  Object.freeze({
    id: "conclave",
    name: "Adainian Conclave",
    color: "#dfc51f",
    zMin: -3.25,
    zMax: 3.25,
    footprint: Object.freeze([
      Object.freeze({ x: -2.2, y: 3.9 }),
      Object.freeze({ x: -1.3, y: 4.0 }),
      Object.freeze({ x: -0.8, y: 3.7 }),
      Object.freeze({ x: -0.4, y: 3.2 }),
      Object.freeze({ x: 0.3, y: 2.5 }),
      Object.freeze({ x: 0.5, y: 1.5 }),
      Object.freeze({ x: 0.2, y: 0.5 }),
      Object.freeze({ x: 0.4, y: -0.6 }),
      Object.freeze({ x: 0.4, y: -1.8 }),
      Object.freeze({ x: -0.1, y: -2.5 }),
      Object.freeze({ x: -0.6, y: -3.4 }),
      Object.freeze({ x: -1.2, y: -4.1 }),
      Object.freeze({ x: -2.1, y: -4.5 }),
      Object.freeze({ x: -2.65, y: -3.9 }),
      Object.freeze({ x: -2.5, y: -2.25 }),
      Object.freeze({ x: -2.25, y: -1.3 }),
      Object.freeze({ x: -2.45, y: -0.6 }),
      Object.freeze({ x: -2.32, y: 0.25 }),
      Object.freeze({ x: -2.3, y: 1.05 }),
      Object.freeze({ x: -2.65, y: 1.8 }),
      Object.freeze({ x: -3.0, y: 2.8 }),
    ]),
  }),
  Object.freeze({
    id: "mandate",
    name: "XUANJIA Mandate",
    color: "#df3f38",
    zMin: -5.25,
    zMax: 5.25,
    footprint: Object.freeze([
      Object.freeze({ x: -1.0, y: 3.6 }),
      Object.freeze({ x: -0.8, y: 4.8 }),
      Object.freeze({ x: 0.8, y: 4.5 }),
      Object.freeze({ x: 1.6, y: 4.7 }),
      Object.freeze({ x: 2.5, y: 5.5 }),
      Object.freeze({ x: 3.1, y: 6.6 }),
      Object.freeze({ x: 4.0, y: 7.1 }),
      Object.freeze({ x: 4.5, y: 8.0 }),
      Object.freeze({ x: 8.0, y: 8.0 }),
      Object.freeze({ x: 8.0, y: -4.2 }),
      Object.freeze({ x: 6.6, y: -4.3 }),
      Object.freeze({ x: 5.1, y: -3.7 }),
      Object.freeze({ x: 3.9, y: -3.6 }),
      Object.freeze({ x: 2.5, y: -3.7 }),
      Object.freeze({ x: 1.3, y: -3.8 }),
      Object.freeze({ x: -0.6, y: -4.1 }),
      Object.freeze({ x: -0.1, y: -2.5 }),
      Object.freeze({ x: 0.4, y: -1.8 }),
      Object.freeze({ x: 0.4, y: -0.6 }),
      Object.freeze({ x: 0.2, y: 0.5 }),
      Object.freeze({ x: 0.5, y: 1.5 }),
      Object.freeze({ x: 0.3, y: 2.5 }),
      Object.freeze({ x: -0.4, y: 3.2 }),
    ]),
  }),
  Object.freeze({
    id: "union",
    name: "Union",
    color: "#168bd0",
    zMin: -4.5,
    zMax: 4.5,
    footprint: Object.freeze([
      Object.freeze({ x: -5.8, y: -8.0 }),
      Object.freeze({ x: 8.0, y: -8.0 }),
      Object.freeze({ x: 8.0, y: -4.2 }),
      Object.freeze({ x: 6.6, y: -4.3 }),
      Object.freeze({ x: 5.1, y: -3.7 }),
      Object.freeze({ x: 3.9, y: -3.6 }),
      Object.freeze({ x: 2.5, y: -3.7 }),
      Object.freeze({ x: 1.3, y: -3.8 }),
      Object.freeze({ x: -0.6, y: -4.1 }),
      Object.freeze({ x: -1.8, y: -4.1 }),
      Object.freeze({ x: -3.2, y: -4.8 }),
      Object.freeze({ x: -4.3, y: -5.4 }),
      Object.freeze({ x: -5.0, y: -5.7 }),
      Object.freeze({ x: -5.3, y: -6.5 }),
    ]),
  }),
  Object.freeze({
    id: "grayspace",
    name: "Grayspace (Unclaimed / Unsurveyed)",
    color: "#808991",
    zMin: -4.25,
    zMax: 4.25,
    footprint: Object.freeze([
      Object.freeze({ x: -8.0, y: -8.0 }),
      Object.freeze({ x: -5.8, y: -8.0 }),
      Object.freeze({ x: -5.3, y: -6.5 }),
      Object.freeze({ x: -5.0, y: -5.7 }),
      Object.freeze({ x: -5.3, y: -4.5 }),
      Object.freeze({ x: -5.2, y: -3.3 }),
      Object.freeze({ x: -6.0, y: -2.5 }),
      Object.freeze({ x: -6.8, y: -1.5 }),
      Object.freeze({ x: -7.0, y: 0.2 }),
      Object.freeze({ x: -6.7, y: 1.0 }),
      Object.freeze({ x: -5.8, y: 1.8 }),
      Object.freeze({ x: -5.2, y: 2.5 }),
      Object.freeze({ x: -5.4, y: 3.5 }),
      Object.freeze({ x: -5.8, y: 5.0 }),
      Object.freeze({ x: -6.6, y: 5.3 }),
      Object.freeze({ x: -8.0, y: 6.2 }),
    ]),
  }),
]);

export function buildTerritoryFaces(territory) {
  const lower = territory.footprint.map(({ x, y }) => ({ x, y, z: territory.zMin }));
  const upper = territory.footprint.map(({ x, y }) => ({ x, y, z: territory.zMax }));
  const faces = [
    { kind: "cap", points: lower },
    { kind: "cap", points: upper },
  ];

  for (let i = 0; i < territory.footprint.length; i += 1) {
    const next = (i + 1) % territory.footprint.length;
    faces.push({
      kind: "side",
      points: [lower[i], lower[next], upper[next], upper[i]],
    });
  }
  return faces;
}

function project(view, point) {
  const { yaw, pitch, zoom, panX, panY } = view.state;
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);
  const x1 = point.x * cosY + point.z * sinY;
  const z1 = -point.x * sinY + point.z * cosY;
  const y2 = point.y * cosP - z1 * sinP;
  const z2 = point.y * sinP + z1 * cosP;
  const focal = 34;
  const perspective = focal / (focal - z2);
  const scale = 36 * zoom;
  return {
    x: 500 + panX + x1 * scale * perspective,
    y: 350 + panY - y2 * scale * perspective,
    z: z2,
  };
}

/**
 * Adds the faction volumes as a non-interactive layer behind the cube lattice.
 * ClusterView intentionally stays renderer-agnostic; this adapter mirrors its
 * projection math and wraps the public render method so the fields rotate and
 * zoom with the cluster.
 */
export function attachFactionTerritories(view, territories = FACTION_TERRITORIES) {
  if (!view?.svg || !view?.state) return null;

  const layer = svgElement("g", { class: "oscm-territory-layer", "aria-hidden": "true" });
  const gridLayer = view.svg.querySelector(".oscm-grid-layer");
  if (gridLayer) view.svg.insertBefore(layer, gridLayer);
  else view.svg.append(layer);

  const faceNodes = [];
  for (const territory of territories) {
    for (const face of buildTerritoryFaces(territory)) {
      const polygon = svgElement("polygon", {
        class: `oscm-territory-face is-${face.kind}`,
        "data-territory-id": territory.id,
      });
      polygon.style.setProperty("--oscm-territory-color", territory.color);
      layer.append(polygon);
      faceNodes.push({ territory, face, polygon });
    }
  }

  const renderTerritories = () => {
    const projected = faceNodes.map((node) => {
      const points = node.face.points.map((point) => project(view, point));
      node.polygon.setAttribute("points", points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" "));
      return {
        ...node,
        depth: points.reduce((sum, point) => sum + point.z, 0) / points.length,
      };
    });

    // Transparent SVG faces still need painter ordering: far faces first.
    projected.sort((a, b) => a.depth - b.depth);
    for (const { polygon } of projected) layer.append(polygon);
  };

  const baseRender = view.render.bind(view);
  view.render = (...args) => {
    const result = baseRender(...args);
    renderTerritories();
    return result;
  };

  renderTerritories();
  return layer;
}
