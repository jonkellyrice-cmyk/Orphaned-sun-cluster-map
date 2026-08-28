/**
 * Canonical Orphaned Sun cluster coordinates.
 *
 * Coordinate convention:
 *   X: east-west axis from the 2D campaign map
 *   Y: north-south axis from the 2D campaign map
 *   Z: inferred depth axis (positive = rear, negative = front)
 *
 * The original 2D map geometry was rescaled so the Abydos-Amarna projected
 * separation is exactly 15 light-years, then recentered without changing
 * pairwise distances. Z-depths use the conservative five-band model discussed
 * for the campaign: -3, -1.5, 0, +1.5, +3 ly.
 */
export const SYSTEMS = Object.freeze([
  { id: "abydos", name: "Abydos", x: -4.252, y: 7.319, z: 0.0 },
  { id: "tanis", name: "Tanis", x: -4.182, y: 4.182, z: 1.5 },
  { id: "thebes", name: "Thebes", x: -0.209, y: 4.252, z: -1.5 },
  { id: "memphis", name: "Memphis", x: 0.070, y: 1.603, z: 0.0 },
  { id: "iunu", name: "Iunu", x: -2.649, y: 0.139, z: 1.5 },
  { id: "saqqara", name: "Saqqara", x: -5.019, y: -1.464, z: 3.0 },
  { id: "nekhen", name: "Nekhen", x: 0.209, y: -1.464, z: 0.0 },
  { id: "sais", name: "Sais", x: 5.019, y: -1.743, z: -3.0 },
  { id: "seti", name: "Seti", x: -0.976, y: -2.928, z: 1.5 },
  { id: "amarna", name: "Amarna", x: -0.976, y: -7.319, z: 0.0 },
]);

export const CLUSTER = Object.freeze({
  halfExtentLy: 8,
  defaultGridSpacingLy: 1,
  axisLabels: Object.freeze({ x: "X", y: "Y", z: "Z" }),
});

export function getSystem(id) {
  return SYSTEMS.find((system) => system.id === id) ?? null;
}

export function projectedDistanceLy(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function spatialDistanceLy(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
}
