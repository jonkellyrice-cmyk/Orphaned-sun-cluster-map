import { SYSTEMS } from "./cluster-data.mjs";

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
 * zMin/zMax are the nominal depth envelope. Front/rear depth is warped
 * independently, and the footprint is lofted through multiple depth slices so
 * shared frontiers can wander laterally as Z changes instead of reading as
 * straight extruded curtains.
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

const TERRITORY_DEPTH_WARP = Object.freeze({
  eventide: Object.freeze({ frontAmplitude: 1.15, rearAmplitude: 1.25, phase: 0.25, anchors: ["abydos"] }),
  accords: Object.freeze({ frontAmplitude: 1.30, rearAmplitude: 1.15, phase: 1.10, anchors: ["tanis", "iunu", "saqqara"] }),
  conclave: Object.freeze({ frontAmplitude: 1.00, rearAmplitude: 1.20, phase: 2.15, anchors: ["memphis", "nekhen", "seti"] }),
  mandate: Object.freeze({ frontAmplitude: 1.55, rearAmplitude: 1.45, phase: 3.05, anchors: ["thebes", "sais"] }),
  union: Object.freeze({ frontAmplitude: 1.35, rearAmplitude: 1.50, phase: 4.20, anchors: ["amarna"] }),
  grayspace: Object.freeze({ frontAmplitude: 1.80, rearAmplitude: 1.70, phase: 5.10, anchors: [] }),
});

const SYSTEM_BY_ID = new Map(SYSTEMS.map((system) => [system.id, system]));
const ANCHOR_RADIUS_LY = 1.35;
const LATERAL_ANCHOR_RADIUS_LY = 0.78;
const LATERAL_EDGE_FADE_LY = 1.25;
const LATERAL_WARP_AMPLITUDE_LY = 1.10;
const MIN_DEPTH_THICKNESS_LY = 1.5;
export const TERRITORY_LOFT_SLICES = 9;

function smoothstep01(value) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

function anchorWarpDamping(territoryId, x, y) {
  const anchors = TERRITORY_DEPTH_WARP[territoryId]?.anchors ?? [];
  let strongestInfluence = 0;

  for (const systemId of anchors) {
    const system = SYSTEM_BY_ID.get(systemId);
    if (!system) continue;
    const distanceSquared = (x - system.x) ** 2 + (y - system.y) ** 2;
    const influence = Math.exp(-distanceSquared / (2 * ANCHOR_RADIUS_LY ** 2));
    strongestInfluence = Math.max(strongestInfluence, influence);
  }

  return 1 - strongestInfluence;
}

function allSystemLateralDamping(x, y) {
  let strongestInfluence = 0;

  for (const system of SYSTEMS) {
    const distanceSquared = (x - system.x) ** 2 + (y - system.y) ** 2;
    const influence = Math.exp(-distanceSquared / (2 * LATERAL_ANCHOR_RADIUS_LY ** 2));
    strongestInfluence = Math.max(strongestInfluence, influence);
  }

  return 1 - strongestInfluence;
}

function clusterEdgeDamping(x, y) {
  const distanceToEdge = Math.min(8 - Math.abs(x), 8 - Math.abs(y));
  return smoothstep01(distanceToEdge / LATERAL_EDGE_FADE_LY);
}

function frontDepthWave(x, y, phase) {
  return 0.62 * Math.sin(0.72 * x + 0.43 * y + phase)
    + 0.38 * Math.cos(-0.31 * x + 0.81 * y - phase * 0.60);
}

function rearDepthWave(x, y, phase) {
  return 0.55 * Math.cos(0.59 * x - 0.47 * y + phase * 1.17)
    + 0.45 * Math.sin(0.36 * x + 0.77 * y - phase * 0.40);
}

/**
 * Returns the local front/rear Z boundary at an XY point. Independent smooth
 * waves move the two depth surfaces so a territory can bulge farther forward
 * in one area and recede in another. Warp is suppressed around owned systems,
 * keeping those systems as stable political anchor points.
 */
export function territoryDepthAt(territory, x, y) {
  const warp = TERRITORY_DEPTH_WARP[territory.id]
    ?? { frontAmplitude: 0, rearAmplitude: 0, phase: 0, anchors: [] };
  const damping = anchorWarpDamping(territory.id, x, y);

  let front = territory.zMin + warp.frontAmplitude * damping * frontDepthWave(x, y, warp.phase);
  let rear = territory.zMax + warp.rearAmplitude * damping * rearDepthWave(x, y, warp.phase);

  if (rear - front < MIN_DEPTH_THICKNESS_LY) {
    const midpoint = (front + rear) / 2;
    front = midpoint - MIN_DEPTH_THICKNESS_LY / 2;
    rear = midpoint + MIN_DEPTH_THICKNESS_LY / 2;
  }

  return { zMin: front, zMax: rear, warpDamping: damping };
}

/**
 * Shared lateral frontier field. It is deliberately independent of faction id:
 * two territories that share the same source-map seam receive the same XY
 * displacement at a given Z, so one polity's bulge is the neighboring polity's
 * recession rather than a crack between two separately randomized shapes.
 *
 * The field is exactly zero on the original z=0 map plane, fades to zero at the
 * cluster-box exterior, and is strongly suppressed around every Big Ten system.
 */
export function territoryLateralOffsetAt(x, y, z) {
  const damping = allSystemLateralDamping(x, y) * clusterEdgeDamping(x, y);
  const amplitude = LATERAL_WARP_AMPLITUDE_LY * damping;

  const dx = amplitude * (
    0.62 * Math.sin(0.72 * z) * Math.sin(0.47 * x + 0.31 * y + 0.35)
    + 0.38 * Math.sin(1.11 * z) * Math.cos(0.24 * x - 0.63 * y - 0.55)
  );
  const dy = amplitude * (
    0.58 * Math.sin(0.63 * z) * Math.cos(0.29 * x + 0.57 * y - 0.20)
    + 0.42 * Math.sin(1.03 * z) * Math.sin(0.66 * x - 0.21 * y + 0.80)
  );

  return { x: dx, y: dy, damping };
}

function warpedBoundaryPoint(territory, point, fraction) {
  const depth = territoryDepthAt(territory, point.x, point.y);
  const z = depth.zMin + (depth.zMax - depth.zMin) * fraction;
  const offset = territoryLateralOffsetAt(point.x, point.y, z);
  return {
    x: Math.max(-8, Math.min(8, point.x + offset.x)),
    y: Math.max(-8, Math.min(8, point.y + offset.y)),
    z,
  };
}

/**
 * XY frontier at a specific absolute Z. Primarily useful for containment tests
 * and diagnostics; it also makes explicit that the same political border is a
 * different curve at different depths.
 */
export function territoryFootprintAtZ(territory, z) {
  return territory.footprint.map((point) => {
    const offset = territoryLateralOffsetAt(point.x, point.y, z);
    return {
      x: Math.max(-8, Math.min(8, point.x + offset.x)),
      y: Math.max(-8, Math.min(8, point.y + offset.y)),
    };
  });
}

export function buildTerritoryFaces(territory) {
  const slices = Array.from({ length: TERRITORY_LOFT_SLICES }, (_, index) => {
    const fraction = index / (TERRITORY_LOFT_SLICES - 1);
    return territory.footprint.map((point) => warpedBoundaryPoint(territory, point, fraction));
  });

  const faces = [
    { kind: "cap", points: slices[0] },
    { kind: "cap", points: slices[slices.length - 1] },
  ];

  for (let i = 0; i < territory.footprint.length; i += 1) {
    const next = (i + 1) % territory.footprint.length;
    const points = slices.map((slice) => slice[i]);
    for (let sliceIndex = slices.length - 1; sliceIndex >= 0; sliceIndex -= 1) {
      points.push(slices[sliceIndex][next]);
    }
    faces.push({ kind: "side", points });
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
