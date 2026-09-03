import { calculateTransit, evaluateTrajectoryAtProperTime, properTimeAtRouteFraction, SECONDS_PER_JULIAN_YEAR } from "./relativity.mjs";
import { UNION_EPOCH_MS } from "./universal-time.mjs";

export const CAMPAIGN_TIME_SETTING = "campaignTimeState";
export const DEFAULT_CAMPAIGN_TIME_STATE = Object.freeze({
  properBaseMs: UNION_EPOCH_MS,
  referenceBaseMs: UNION_EPOCH_MS,
  anchorRealMs: 0,
  running: true,
  activeVoyage: null,
});

const YEARS_PER_MS = 1 / (SECONDS_PER_JULIAN_YEAR * 1000);
const MS_PER_YEAR = SECONDS_PER_JULIAN_YEAR * 1000;
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function normalizeCampaignTimeState(state) {
  const source = state && typeof state === "object" ? state : DEFAULT_CAMPAIGN_TIME_STATE;
  return {
    properBaseMs: finite(source.properBaseMs, UNION_EPOCH_MS),
    referenceBaseMs: finite(source.referenceBaseMs, UNION_EPOCH_MS),
    anchorRealMs: Math.max(0, finite(source.anchorRealMs, 0)),
    running: source.running !== false,
    activeVoyage: source.activeVoyage && typeof source.activeVoyage === "object" ? structuredClone(source.activeVoyage) : null,
  };
}

export function voyageTrajectory(voyage) {
  if (!voyage) return null;
  return calculateTransit(voyage.distanceLy, { accelerationG: voyage.accelerationG, cruiseBeta: voyage.cruiseBeta });
}

export function evaluateVoyage(voyage, properTimestampMs) {
  if (!voyage) return null;
  const transit = voyageTrajectory(voyage);
  const elapsedYears = Math.max(0, (Number(properTimestampMs) - voyage.departureProperMs) * YEARS_PER_MS);
  return { ...evaluateTrajectoryAtProperTime(transit, elapsedYears), transit };
}

export function advanceCampaignTime(state, deltaProperMs) {
  const current = normalizeCampaignTimeState(state);
  const delta = Number(deltaProperMs) || 0;
  const nextProperMs = current.properBaseMs + delta;
  let referenceDeltaMs = delta;
  let activeVoyage = current.activeVoyage;
  if (activeVoyage && activeVoyage.status !== "arrived") {
    if (nextProperMs < activeVoyage.departureProperMs) throw new RangeError("Proper time cannot be set before the active voyage departure.");
    const before = evaluateVoyage(activeVoyage, current.properBaseMs);
    const after = evaluateVoyage(activeVoyage, nextProperMs);
    referenceDeltaMs = (after.referenceElapsed - before.referenceElapsed) * MS_PER_YEAR;
    const arrivalProperMs = activeVoyage.departureProperMs + after.transit.shipYears * MS_PER_YEAR;
    if (nextProperMs > arrivalProperMs) referenceDeltaMs += nextProperMs - arrivalProperMs;
    if (after.phase === "arrived") activeVoyage = { ...activeVoyage, status: "arrived", arrivedProperMs: arrivalProperMs };
  }
  return { ...current, properBaseMs: nextProperMs, referenceBaseMs: current.referenceBaseMs + referenceDeltaMs, activeVoyage };
}

export function currentCampaignTime(state, realNowMs = Date.now()) {
  const current = normalizeCampaignTimeState(state);
  if (!current.running || current.anchorRealMs <= 0) return current;
  return { ...advanceCampaignTime(current, Math.max(0, Number(realNowMs) - current.anchorRealMs)), anchorRealMs: Number(realNowMs) };
}

export function settleCampaignTime(state, realNowMs = Date.now()) {
  const settled = currentCampaignTime(state, realNowMs);
  return { ...settled, anchorRealMs: Number(realNowMs) };
}

export function resumeCampaignTimeSession(state, realNowMs = Date.now()) {
  return { ...normalizeCampaignTimeState(state), anchorRealMs: Number(realNowMs) };
}

export function setCampaignTimeRunning(state, running, realNowMs = Date.now()) {
  return { ...settleCampaignTime(state, realNowMs), running: Boolean(running) };
}

export function adjustCampaignProperTime(state, deltaMs, realNowMs = Date.now()) {
  const settled = settleCampaignTime(state, realNowMs);
  return { ...advanceCampaignTime(settled, deltaMs), anchorRealMs: Number(realNowMs) };
}

export function setCampaignProperTimestamp(state, properMs, realNowMs = Date.now()) {
  const settled = settleCampaignTime(state, realNowMs);
  return { ...advanceCampaignTime(settled, Number(properMs) - settled.properBaseMs), anchorRealMs: Number(realNowMs) };
}

export function engageVoyage(state, route, realNowMs = Date.now()) {
  const settled = settleCampaignTime(state, realNowMs);
  if (settled.activeVoyage && settled.activeVoyage.status !== "arrived") throw new Error("A voyage is already active. Abort it before engaging another route.");
  const transit = calculateTransit(route.distanceLy, { accelerationG: route.accelerationG, cruiseBeta: route.cruiseBeta });
  const voyage = {
    id: route.id || globalThis.crypto?.randomUUID?.() || `voyage-${Date.now()}`,
    originId: route.originId, destinationId: route.destinationId,
    originName: route.originName, destinationName: route.destinationName,
    context: route.context, systemId: route.systemId || null,
    departureProperMs: settled.properBaseMs, departureReferenceMs: settled.referenceBaseMs,
    originCoordinates: structuredClone(route.originCoordinates), destinationCoordinates: structuredClone(route.destinationCoordinates),
    distanceLy: transit.distanceLy, accelerationG: transit.accelerationG, cruiseBeta: transit.cruiseBeta,
    reachesCruise: transit.reachesCruise, peakBeta: transit.peakBeta,
    shipYears: transit.shipYears, referenceYears: transit.clusterYears,
    accelerationDistanceLy: transit.accelerationDistanceLy, cruiseDistanceLy: transit.cruiseDistanceLy,
    status: "engaged",
  };
  return { ...settled, activeVoyage: voyage };
}

export function abortVoyage(state, realNowMs = Date.now()) {
  const settled = settleCampaignTime(state, realNowMs);
  return { ...settled, activeVoyage: null };
}

/** GM timeline scrub: set both clocks to the exact solved worldline point on the route rail. */
export function advanceVoyageToRouteFraction(state, routeFraction, realNowMs = Date.now()) {
  const settled = settleCampaignTime(state, realNowMs);
  const voyage = settled.activeVoyage;
  if (!voyage) throw new Error("There is no voyage to scrub.");
  const transit = voyageTrajectory(voyage);
  const requestedFraction = Math.min(1, Math.max(0, Number(routeFraction) || 0));
  const targetElapsedYears = properTimeAtRouteFraction(transit, requestedFraction);
  const targetProperMs = voyage.departureProperMs + targetElapsedYears * MS_PER_YEAR;
  const evaluated = evaluateTrajectoryAtProperTime(transit, targetElapsedYears);
  const activeVoyage = { ...voyage, status: evaluated.phase === "arrived" ? "arrived" : "engaged" };
  if (evaluated.phase !== "arrived") delete activeVoyage.arrivedProperMs;
  return {
    ...settled,
    properBaseMs: targetProperMs,
    referenceBaseMs: voyage.departureReferenceMs + evaluated.referenceElapsed * MS_PER_YEAR,
    anchorRealMs: Number(realNowMs),
    activeVoyage,
  };
}
