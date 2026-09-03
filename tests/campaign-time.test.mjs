import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_CAMPAIGN_TIME_STATE, adjustCampaignProperTime, advanceVoyageToRouteFraction, currentCampaignTime,
  engageVoyage, evaluateVoyage, normalizeCampaignTimeState, resumeCampaignTimeSession,
} from "../scripts/campaign-time.mjs";
import { calculateTransit, evaluateTrajectoryAtProperTime, properTimeAtRouteFraction, trajectoryMarkers } from "../scripts/relativity.mjs";
import { UNION_EPOCH_MS } from "../scripts/universal-time.mjs";

const DAY_MS = 86_400_000;
const route = {
  id: "test-voyage", originId: "abydos", destinationId: "thebes", originName: "Abydos", destinationName: "Thebes",
  context: "cluster", originCoordinates: { x: 0, y: 0, z: 0 }, destinationCoordinates: { x: 5.29, y: 0, z: 0 },
  distanceLy: 5.29, accelerationG: 200, cruiseBeta: .995,
};

test("campaign clocks begin canonically synchronized", () => {
  assert.equal(DEFAULT_CAMPAIGN_TIME_STATE.properBaseMs, UNION_EPOCH_MS);
  assert.equal(DEFAULT_CAMPAIGN_TIME_STATE.referenceBaseMs, UNION_EPOCH_MS);
});

test("ordinary proper-time advancement is one-to-one", () => {
  const next = adjustCampaignProperTime({ ...DEFAULT_CAMPAIGN_TIME_STATE, running: false }, DAY_MS, 10);
  assert.equal(next.properBaseMs - UNION_EPOCH_MS, DAY_MS);
  assert.equal(next.referenceBaseMs - UNION_EPOCH_MS, DAY_MS);
});

test("engagement freezes navigation parameters and departure snapshot", () => {
  const engaged = engageVoyage({ ...DEFAULT_CAMPAIGN_TIME_STATE, running: false }, route, 10);
  route.accelerationG = 1; route.cruiseBeta = .5;
  assert.equal(engaged.activeVoyage.accelerationG, 200);
  assert.equal(engaged.activeVoyage.cruiseBeta, .995);
  assert.equal(engaged.activeVoyage.departureProperMs, UNION_EPOCH_MS);
  route.accelerationG = 200; route.cruiseBeta = .995;
});

test("proper advancement derives diverging reference time from trajectory", () => {
  const engaged = engageVoyage({ ...DEFAULT_CAMPAIGN_TIME_STATE, running: false }, route, 10);
  const advanced = adjustCampaignProperTime(engaged, 6 * DAY_MS, 20);
  assert.equal(advanced.properBaseMs - UNION_EPOCH_MS, 6 * DAY_MS);
  assert.ok(advanced.referenceBaseMs - UNION_EPOCH_MS > 6 * DAY_MS);
});

test("analytical velocity rises, caps, falls, and arrives exactly", () => {
  const transit = calculateTransit(5.29, { accelerationG: 200, cruiseBeta: .995 });
  const early = evaluateTrajectoryAtProperTime(transit, transit.shipYears * .01);
  const later = evaluateTrajectoryAtProperTime(transit, transit.accelerationShipYears * .4);
  const cruise = evaluateTrajectoryAtProperTime(transit, transit.accelerationShipYears / 2 + transit.cruiseShipYears / 2);
  const braking = evaluateTrajectoryAtProperTime(transit, transit.shipYears - transit.accelerationShipYears * .4);
  const arrival = evaluateTrajectoryAtProperTime(transit, transit.shipYears + 1);
  assert.ok(later.velocity > early.velocity);
  assert.ok(later.velocity <= .995 && cruise.velocity <= .995);
  assert.equal(cruise.phase, "cruise"); assert.equal(cruise.velocity, .995);
  assert.equal(braking.phase, "decelerating"); assert.ok(braking.velocity < .995);
  assert.equal(arrival.routeFraction, 1); assert.equal(arrival.distanceTravelled, 5.29); assert.equal(arrival.velocity, 0);
});

test("position and marker transitions are deterministic from proper timestamp", () => {
  const engaged = engageVoyage({ ...DEFAULT_CAMPAIGN_TIME_STATE, running: false }, route, 10);
  const timestamp = UNION_EPOCH_MS + 30 * DAY_MS;
  assert.deepEqual(evaluateVoyage(engaged.activeVoyage, timestamp), evaluateVoyage(engaged.activeVoyage, timestamp));
  const markers = trajectoryMarkers(evaluateVoyage(engaged.activeVoyage, timestamp).transit);
  assert.deepEqual(markers.map((marker) => marker.kind), ["speed-cap", "braking"]);
  assert.ok(markers[0].routeFraction < markers[1].routeFraction);
  const shortMarkers = trajectoryMarkers(calculateTransit(1e-8, { accelerationG: 200, cruiseBeta: .995 }));
  assert.deepEqual(shortMarkers.map((marker) => marker.kind), ["braking"]);
  assert.equal(shortMarkers[0].routeFraction, .5);
});

test("spatial rail inversion recovers proper time across acceleration, cruise, and braking", () => {
  const transit = calculateTransit(5.29, { accelerationG: 200, cruiseBeta: .995 });
  for (const fraction of [.02, .25, .5, .75, .98]) {
    const proper = properTimeAtRouteFraction(transit, fraction);
    assert.ok(Math.abs(evaluateTrajectoryAtProperTime(transit, proper).routeFraction - fraction) < 1e-10);
  }
});

test("GM route scrubbing moves both clocks forward and backward on the solved worldline", () => {
  const engaged = engageVoyage({ ...DEFAULT_CAMPAIGN_TIME_STATE, running: false }, route, 10);
  const forward = advanceVoyageToRouteFraction(engaged, .75, 20);
  const backward = advanceVoyageToRouteFraction(forward, .25, 30);
  assert.ok(forward.properBaseMs > backward.properBaseMs);
  assert.ok(forward.referenceBaseMs > backward.referenceBaseMs);
  assert.ok(Math.abs(evaluateVoyage(backward.activeVoyage, backward.properBaseMs).routeFraction - .25) < 1e-10);
});

test("an arrived voyage can be scrubbed backward for GM correction", () => {
  const engaged = engageVoyage({ ...DEFAULT_CAMPAIGN_TIME_STATE, running: false }, route, 10);
  const arrived = advanceVoyageToRouteFraction(engaged, 1, 20);
  assert.equal(arrived.activeVoyage.status, "arrived");
  const restored = advanceVoyageToRouteFraction(arrived, .5, 30);
  assert.equal(restored.activeVoyage.status, "engaged");
  assert.ok(Math.abs(evaluateVoyage(restored.activeVoyage, restored.properBaseMs).routeFraction - .5) < 1e-10);
});

test("offline resume adds no time and preserves deterministic voyage state", () => {
  const engaged = engageVoyage({ ...DEFAULT_CAMPAIGN_TIME_STATE, running: true }, route, 1000);
  const persisted = normalizeCampaignTimeState(JSON.parse(JSON.stringify(engaged)));
  const resumed = resumeCampaignTimeSession(persisted, 999_999);
  assert.equal(resumed.properBaseMs, persisted.properBaseMs);
  assert.equal(resumed.referenceBaseMs, persisted.referenceBaseMs);
  assert.deepEqual(evaluateVoyage(resumed.activeVoyage, resumed.properBaseMs), evaluateVoyage(persisted.activeVoyage, persisted.properBaseMs));
});

test("arrival preserves divergence then returns both clocks to equal rates", () => {
  const engaged = engageVoyage({ ...DEFAULT_CAMPAIGN_TIME_STATE, running: false }, route, 10);
  const totalProperMs = engaged.activeVoyage.shipYears * 31_557_600_000;
  const arrived = adjustCampaignProperTime(engaged, totalProperMs + DAY_MS, 20);
  const offset = arrived.referenceBaseMs - arrived.properBaseMs;
  assert.ok(offset > 0); assert.equal(arrived.activeVoyage.status, "arrived");
  const later = adjustCampaignProperTime(arrived, DAY_MS, 30);
  assert.equal(later.referenceBaseMs - later.properBaseMs, offset);
});

test("live running clock advances from proper-time anchor", () => {
  const running = { ...DEFAULT_CAMPAIGN_TIME_STATE, anchorRealMs: 1000, running: true };
  const current = currentCampaignTime(running, 5000);
  assert.equal(current.properBaseMs - UNION_EPOCH_MS, 4000);
  assert.equal(current.referenceBaseMs - UNION_EPOCH_MS, 4000);
});
