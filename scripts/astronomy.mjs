import { DAY_MS, UNION_EPOCH_MS } from "./universal-time.mjs";

export const ASTRONOMY_MODEL_VERSION = "kepler-snapshot-v1";
export const TWO_PI = Math.PI * 2;

const radians = (degrees) => Number(degrees) * Math.PI / 180;
const degrees = (value) => value * 180 / Math.PI;
const finiteNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return value !== "" && Number.isFinite(parsed) ? parsed : fallback;
};

export function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

export function normalizeDegrees(value) {
  return positiveModulo(Number(value), 360);
}

export function orbitalPeriodDays(body) {
  const moonPeriod = finiteNumber(body.moon_orbital_period_days, null);
  const generalPeriod = finiteNumber(body.orbital_period_days, null);
  return moonPeriod > 0 ? moonPeriod : generalPeriod > 0 ? generalPeriod : null;
}

export function isAnalyticalOrbiter(body) {
  return finiteNumber(body.distanceAu ?? body.distance_from_parent, 0) > 0 && orbitalPeriodDays(body) > 0;
}

export function trueToEccentricAnomaly(trueAnomalyRad, eccentricity) {
  if (eccentricity === 0) return positiveModulo(trueAnomalyRad, TWO_PI);
  return positiveModulo(2 * Math.atan2(
    Math.sqrt(1 - eccentricity) * Math.sin(trueAnomalyRad / 2),
    Math.sqrt(1 + eccentricity) * Math.cos(trueAnomalyRad / 2),
  ), TWO_PI);
}

export function eccentricToTrueAnomaly(eccentricAnomalyRad, eccentricity) {
  if (eccentricity === 0) return positiveModulo(eccentricAnomalyRad, TWO_PI);
  return positiveModulo(2 * Math.atan2(
    Math.sqrt(1 + eccentricity) * Math.sin(eccentricAnomalyRad / 2),
    Math.sqrt(1 - eccentricity) * Math.cos(eccentricAnomalyRad / 2),
  ), TWO_PI);
}

export function solveKeplerEquation(meanAnomalyRad, eccentricity, tolerance = 1e-13) {
  const mean = positiveModulo(meanAnomalyRad, TWO_PI);
  let eccentric = eccentricity < .8 ? mean : Math.PI;
  for (let iteration = 0; iteration < 20; iteration += 1) {
    const correction = (eccentric - eccentricity * Math.sin(eccentric) - mean)
      / (1 - eccentricity * Math.cos(eccentric));
    eccentric -= correction;
    if (Math.abs(correction) <= tolerance) break;
  }
  return positiveModulo(eccentric, TWO_PI);
}

export function orbitalStateAt(body, referenceTimestampMs, epochTimestampMs = UNION_EPOCH_MS) {
  const semiMajorAxisAu = finiteNumber(body.semiMajorAxisAu ?? body.distanceAu ?? body.distance_from_parent, 0);
  const referencePhaseDeg = normalizeDegrees(body.referencePhaseDeg ?? body.phaseDeg ?? body.reference_phase_deg ?? 0);
  const inclinationDeg = finiteNumber(body.inclinationDeg ?? body.inclination_deg, 0);
  const eccentricity = finiteNumber(body.eccentricity ?? body.orbital_eccentricity, 0);
  const periodDays = orbitalPeriodDays(body);
  if (!(eccentricity >= 0 && eccentricity < 1)) throw new RangeError(`${body.name ?? body.object}: eccentricity must satisfy 0 <= e < 1`);

  if (!(semiMajorAxisAu > 0) || !(periodDays > 0)) {
    return {
      analytical: false,
      trueAnomalyDeg: referencePhaseDeg,
      meanAnomalyDeg: referencePhaseDeg,
      eccentricAnomalyDeg: referencePhaseDeg,
      radiusAu: semiMajorAxisAu,
      semiMajorAxisAu,
      eccentricity,
      inclinationDeg,
      orbitalPeriodDays: null,
      orbitalVelocityKmS: null,
    };
  }

  const epochTrue = radians(referencePhaseDeg);
  const epochEccentric = trueToEccentricAnomaly(epochTrue, eccentricity);
  const epochMean = epochEccentric - eccentricity * Math.sin(epochEccentric);
  const elapsedDays = (Number(referenceTimestampMs) - Number(epochTimestampMs)) / DAY_MS;
  const mean = epochMean + TWO_PI * elapsedDays / periodDays;
  const eccentric = solveKeplerEquation(mean, eccentricity);
  const trueAnomaly = eccentricToTrueAnomaly(eccentric, eccentricity);
  const radiusAu = semiMajorAxisAu * (1 - eccentricity * Math.cos(eccentric));
  const muAu3Day2 = 4 * Math.PI ** 2 * semiMajorAxisAu ** 3 / periodDays ** 2;
  const velocityAuDay = Math.sqrt(muAu3Day2 * (2 / radiusAu - 1 / semiMajorAxisAu));

  return {
    analytical: true,
    trueAnomalyDeg: normalizeDegrees(degrees(trueAnomaly)),
    meanAnomalyDeg: normalizeDegrees(degrees(mean)),
    eccentricAnomalyDeg: normalizeDegrees(degrees(eccentric)),
    meanAnomalyAtEpochDeg: normalizeDegrees(degrees(epochMean)),
    radiusAu,
    semiMajorAxisAu,
    eccentricity,
    inclinationDeg,
    orbitalPeriodDays: periodDays,
    orbitalVelocityKmS: velocityAuDay * 149_597_870.7 / 86_400,
  };
}

export function rotationStateAt(body, referenceTimestampMs, orientation = {}, orbitalState = null, epochTimestampMs = UNION_EPOCH_MS) {
  const axialTiltDeg = finiteNumber(body.axialTiltDeg ?? body.axial_tilt_deg, 0);
  const tidallyLocked = String(body.tidallyLocked ?? body.tidally_locked).toLowerCase().startsWith("yes") || body.tidallyLocked === true;
  const axialSeasonPhaseAtEpochDeg = normalizeDegrees(orientation.axialSeasonPhaseAtEpochDeg ?? 0);
  if (tidallyLocked && orbitalState?.analytical) {
    return {
      rotationDeg: normalizeDegrees(orbitalState.trueAnomalyDeg + 180),
      primeMeridianAngleDeg: normalizeDegrees(orbitalState.trueAnomalyDeg + 180),
      spinPhaseAtEpochDeg: null,
      axialTiltDeg,
      axialSeasonPhaseAtEpochDeg,
      tidallyLocked: true,
      basis: "derived-tidal-lock",
    };
  }

  const rotationHours = finiteNumber(body.rotationHours ?? body.rotation_hours, null);
  const spinPhaseAtEpochDeg = normalizeDegrees(orientation.spinPhaseAtEpochDeg ?? 0);
  const elapsedHours = (Number(referenceTimestampMs) - Number(epochTimestampMs)) / 3_600_000;
  const rotationDeg = rotationHours > 0
    ? normalizeDegrees(spinPhaseAtEpochDeg + 360 * elapsedHours / rotationHours)
    : spinPhaseAtEpochDeg;
  return {
    rotationDeg,
    primeMeridianAngleDeg: rotationDeg,
    spinPhaseAtEpochDeg,
    axialTiltDeg,
    axialSeasonPhaseAtEpochDeg,
    rotationHours: rotationHours > 0 ? rotationHours : null,
    tidallyLocked: false,
    basis: rotationHours > 0 ? "established-period-deterministic-epoch-phase" : "static-orientation",
  };
}

export class AstronomySnapshotCache {
  constructor(limit = 12) {
    this.limit = Math.max(1, Number(limit) || 12);
    this.entries = new Map();
  }

  key(systemName, referenceTimestampMs, fingerprint = ASTRONOMY_MODEL_VERSION) {
    return `${fingerprint}|${systemName}|${Number(referenceTimestampMs)}`;
  }

  get(systemName, referenceTimestampMs, fingerprint = ASTRONOMY_MODEL_VERSION) {
    const key = this.key(systemName, referenceTimestampMs, fingerprint);
    const value = this.entries.get(key);
    if (!value) return null;
    this.entries.delete(key);
    this.entries.set(key, value);
    return value;
  }

  set(systemName, referenceTimestampMs, value, fingerprint = ASTRONOMY_MODEL_VERSION) {
    const key = this.key(systemName, referenceTimestampMs, fingerprint);
    this.entries.delete(key);
    this.entries.set(key, value);
    while (this.entries.size > this.limit) this.entries.delete(this.entries.keys().next().value);
    return value;
  }

  getOrCreate(systemName, referenceTimestampMs, factory, fingerprint = ASTRONOMY_MODEL_VERSION) {
    return this.get(systemName, referenceTimestampMs, fingerprint)
      ?? this.set(systemName, referenceTimestampMs, factory(), fingerprint);
  }

  clear() { this.entries.clear(); }
}

export async function loadAstronomyOrientations(moduleId = "orphaned-sun-cluster-map") {
  const response = await fetch(`modules/${moduleId}/data/astronomy/epoch-orientations.json`);
  if (!response.ok) throw new Error(`Unable to load astronomy epoch orientations (${response.status})`);
  const document = await response.json();
  if (document.schemaVersion !== 1) throw new Error(`Unsupported astronomy orientation schema: ${document.schemaVersion}`);
  return document;
}
