/**
 * Canonical Orphaned Sun cluster coordinates and stellar appearances.
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
 *
 * Stellar colors are intentionally presentation colors: approximate visible
 * appearance to human eyes rather than literal blackbody wavelength colors.
 * Memphis is the deliberate paracausal exception.
 */
export const SYSTEMS = Object.freeze([
  {
    id: "abydos",
    name: "Abydos",
    x: -4.252,
    y: 7.319,
    z: 0.0,
    configuration: "single",
    stars: Object.freeze([
      Object.freeze({ id: "A", spectralType: "K2V", visibleColor: "Warm amber-orange", color: "#f2a04b", coreColor: "#ffd7a0", radiusScale: 1.0 }),
    ]),
  },
  {
    id: "tanis",
    name: "Tanis",
    x: -4.182,
    y: 4.182,
    z: 1.5,
    configuration: "close-binary",
    stars: Object.freeze([
      Object.freeze({ id: "A", spectralType: "G8V", visibleColor: "Golden-yellow", color: "#f2c35b", coreColor: "#fff0b5", radiusScale: 1.08, markerOffsetX: -4.2 }),
      Object.freeze({ id: "B", spectralType: "K4V", visibleColor: "Orange / amber-orange", color: "#e8883f", coreColor: "#ffc37e", radiusScale: 0.78, markerOffsetX: 5.2 }),
    ]),
  },
  {
    id: "thebes",
    name: "Thebes",
    x: -0.209,
    y: 4.252,
    z: -1.5,
    configuration: "single",
    stars: Object.freeze([
      Object.freeze({ id: "A", spectralType: "F8V", visibleColor: "Bright pale yellow-white", color: "#fff1c9", coreColor: "#fffbed", radiusScale: 1.08 }),
    ]),
  },
  {
    id: "memphis",
    name: "Memphis",
    x: 0.070,
    y: 1.603,
    z: 0.0,
    configuration: "single-anomalous",
    stars: Object.freeze([
      Object.freeze({ id: "A", spectralType: "K1V (anomalous)", visibleColor: "Deep emerald / viridian green", color: "#159a63", coreColor: "#c8ffe0", radiusScale: 1.06, anomalous: true }),
    ]),
  },
  {
    id: "iunu",
    name: "Iunu",
    x: -2.649,
    y: 0.139,
    z: 1.5,
    configuration: "single",
    stars: Object.freeze([
      Object.freeze({ id: "A", spectralType: "F9V", visibleColor: "Radiant pale yellow-white", color: "#ffefc4", coreColor: "#fffbea", radiusScale: 1.06 }),
    ]),
  },
  {
    id: "saqqara",
    name: "Saqqara",
    x: -5.019,
    y: -1.464,
    z: 3.0,
    configuration: "single",
    stars: Object.freeze([
      Object.freeze({ id: "A", spectralType: "G0V", visibleColor: "Bright pale yellow-white", color: "#ffe9aa", coreColor: "#fff8da", radiusScale: 1.04 }),
    ]),
  },
  {
    id: "nekhen",
    name: "Nekhen",
    x: 0.209,
    y: -1.464,
    z: 0.0,
    configuration: "single",
    stars: Object.freeze([
      Object.freeze({ id: "A", spectralType: "G8V", visibleColor: "Warm deep yellow, slightly orange", color: "#eeb94f", coreColor: "#ffe9a4", radiusScale: 1.0 }),
    ]),
  },
  {
    id: "sais",
    name: "Sais",
    x: 5.019,
    y: -1.743,
    z: -3.0,
    configuration: "single",
    stars: Object.freeze([
      Object.freeze({ id: "A", spectralType: "G4V", visibleColor: "Familiar warm yellow", color: "#f4ce68", coreColor: "#fff0b7", radiusScale: 1.02 }),
    ]),
  },
  {
    id: "seti",
    name: "Seti",
    x: -0.976,
    y: -2.928,
    z: 1.5,
    configuration: "single",
    stars: Object.freeze([
      Object.freeze({ id: "A", spectralType: "K3V", visibleColor: "Orange / amber-orange", color: "#e98d43", coreColor: "#ffc687", radiusScale: 0.98 }),
    ]),
  },
  {
    id: "amarna",
    name: "Amarna",
    x: -0.976,
    y: -7.319,
    z: 0.0,
    configuration: "single",
    stars: Object.freeze([
      Object.freeze({ id: "A", spectralType: "G2V", visibleColor: "Sol-like yellow-white", color: "#f8dc88", coreColor: "#fff5c9", radiusScale: 1.03 }),
    ]),
  },
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
