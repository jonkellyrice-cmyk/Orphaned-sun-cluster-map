const SECONDS_PER_JULIAN_YEAR = 31_557_600;
const C_M_S = 299_792_458;
const LIGHT_YEAR_M = C_M_S * SECONDS_PER_JULIAN_YEAR;
const STANDARD_GRAVITY_M_S2 = 9.80665;

/** Convert acceleration in standard gravities to light-years per Julian year². */
export function accelerationGToLyPerYear2(accelerationG) {
  return (accelerationG * STANDARD_GRAVITY_M_S2 * SECONDS_PER_JULIAN_YEAR ** 2) / LIGHT_YEAR_M;
}

export function lorentzGamma(beta) {
  if (!(beta >= 0 && beta < 1)) throw new RangeError("beta must be >= 0 and < 1");
  return 1 / Math.sqrt(1 - beta ** 2);
}

/**
 * Relativistic point-to-point trip with constant proper acceleration, a speed
 * cap, midpoint/cruise transition as needed, and symmetric braking to rest.
 *
 * Units exploit c = 1 light-year / Julian year.
 */
export function calculateTransit(distanceLy, options = {}) {
  const accelerationG = Number(options.accelerationG ?? 200);
  const cruiseBeta = Number(options.cruiseBeta ?? 0.995);

  if (!(distanceLy >= 0)) throw new RangeError("distanceLy must be >= 0");
  if (!(accelerationG > 0)) throw new RangeError("accelerationG must be > 0");
  if (!(cruiseBeta > 0 && cruiseBeta < 1)) throw new RangeError("cruiseBeta must be > 0 and < 1");

  if (distanceLy === 0) {
    return {
      distanceLy: 0,
      accelerationG,
      cruiseBeta,
      peakBeta: 0,
      peakGamma: 1,
      reachesCruise: false,
      clusterYears: 0,
      shipYears: 0,
      contractedDistanceLy: 0,
      accelerationDistanceLy: 0,
      cruiseDistanceLy: 0,
    };
  }

  const alpha = accelerationGToLyPerYear2(accelerationG);
  const cruiseGamma = lorentzGamma(cruiseBeta);
  const accelDistanceOneWay = (cruiseGamma - 1) / alpha;
  const accelDistanceRoundTrip = 2 * accelDistanceOneWay;

  if (distanceLy >= accelDistanceRoundTrip) {
    const accelClusterYearsOneWay = (cruiseGamma * cruiseBeta) / alpha;
    const accelShipYearsOneWay = Math.atanh(cruiseBeta) / alpha;
    const cruiseDistanceLy = distanceLy - accelDistanceRoundTrip;
    const cruiseClusterYears = cruiseDistanceLy / cruiseBeta;
    const cruiseShipYears = cruiseClusterYears / cruiseGamma;

    return {
      distanceLy,
      accelerationG,
      cruiseBeta,
      peakBeta: cruiseBeta,
      peakGamma: cruiseGamma,
      reachesCruise: true,
      clusterYears: 2 * accelClusterYearsOneWay + cruiseClusterYears,
      shipYears: 2 * accelShipYearsOneWay + cruiseShipYears,
      contractedDistanceLy: distanceLy / cruiseGamma,
      accelerationDistanceLy: accelDistanceRoundTrip,
      cruiseDistanceLy,
      accelerationClusterYears: 2 * accelClusterYearsOneWay,
      accelerationShipYears: 2 * accelShipYearsOneWay,
      cruiseClusterYears,
      cruiseShipYears,
    };
  }

  // The ship must flip before reaching the speed cap.
  const halfDistanceLy = distanceLy / 2;
  const peakGamma = 1 + alpha * halfDistanceLy;
  const rapidity = Math.acosh(peakGamma);
  const peakBeta = Math.sqrt(1 - 1 / peakGamma ** 2);
  const halfClusterYears = Math.sinh(rapidity) / alpha;
  const halfShipYears = rapidity / alpha;

  return {
    distanceLy,
    accelerationG,
    cruiseBeta,
    peakBeta,
    peakGamma,
    reachesCruise: false,
    clusterYears: 2 * halfClusterYears,
    shipYears: 2 * halfShipYears,
    contractedDistanceLy: distanceLy / peakGamma,
    accelerationDistanceLy: distanceLy,
    cruiseDistanceLy: 0,
    accelerationClusterYears: 2 * halfClusterYears,
    accelerationShipYears: 2 * halfShipYears,
    cruiseClusterYears: 0,
    cruiseShipYears: 0,
  };
}

export function formatDuration(years) {
  if (!Number.isFinite(years)) return "—";
  if (years === 0) return "0";

  const days = years * 365.25;
  const seconds = days * 86_400;
  if (seconds < 120) return `${seconds.toFixed(1)} sec`;
  if (seconds < 7_200) return `${(seconds / 60).toFixed(1)} min`;
  if (days < 2) return `${(days * 24).toFixed(1)} hr`;
  if (days < 60) return `${days.toFixed(1)} days`;
  if (years < 2) return `${(years * 12).toFixed(2)} mo`;
  return `${years.toFixed(2)} yr`;
}

export function formatLightYears(value, decimals = 2) {
  if (!Number.isFinite(value)) return "—";
  return `${value.toFixed(decimals)} ly`;
}
