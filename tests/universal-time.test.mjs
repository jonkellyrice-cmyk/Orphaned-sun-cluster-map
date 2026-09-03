import test from "node:test";
import assert from "node:assert/strict";
import {
  DAY_MS,
  DEFAULT_UNIVERSAL_TIME_STATE,
  UNION_EPOCH_MS,
  adjustUniversalTime,
  currentUniversalTimeMs,
  formatUniversalClock,
  formatUniversalDate,
  makeUniversalTimeMs,
  resumeUniversalTimeSession,
  setUniversalDateTime,
  setUniversalTimeRunning,
} from "../scripts/universal-time.mjs";

test("Union epoch is Friday, September 3, 5016 U at 10:38", () => {
  assert.equal(formatUniversalDate(UNION_EPOCH_MS), "Friday, September 3, 5016 U");
  assert.equal(formatUniversalClock(UNION_EPOCH_MS), "10:38:00");
  assert.equal(formatUniversalDate(UNION_EPOCH_MS + DAY_MS), "Saturday, September 4, 5016 U");
});

test("running universal time advances from its real-time anchor", () => {
  const state = { baseMs: UNION_EPOCH_MS, anchorRealMs: 1_000, running: true };
  assert.equal(currentUniversalTimeMs(state, 61_000), UNION_EPOCH_MS + 60_000);
});

test("resuming a Foundry session discards downtime and then advances normally", () => {
  const checkpoint = { baseMs: UNION_EPOCH_MS + 300_000, anchorRealMs: 10_000, running: true };
  const resumed = resumeUniversalTimeSession(checkpoint, 3_610_000);
  assert.equal(resumed.baseMs, checkpoint.baseMs);
  assert.equal(currentUniversalTimeMs(resumed, 3_610_000), checkpoint.baseMs);
  assert.equal(currentUniversalTimeMs(resumed, 3_670_000), checkpoint.baseMs + 60_000);
});

test("pausing settles elapsed time and freezes the clock", () => {
  const running = { baseMs: UNION_EPOCH_MS, anchorRealMs: 1_000, running: true };
  const paused = setUniversalTimeRunning(running, false, 61_000);
  assert.equal(paused.baseMs, UNION_EPOCH_MS + 60_000);
  assert.equal(currentUniversalTimeMs(paused, 999_999), UNION_EPOCH_MS + 60_000);
});

test("GM adjustments preserve running state", () => {
  const adjusted = adjustUniversalTime({ ...DEFAULT_UNIVERSAL_TIME_STATE, anchorRealMs: 1_000 }, 3_600_000, 1_000);
  assert.equal(adjusted.running, true);
  assert.equal(formatUniversalClock(adjusted.baseMs), "11:38:00");
});

test("direct date and time setting validates calendar dates", () => {
  const state = setUniversalDateTime(DEFAULT_UNIVERSAL_TIME_STATE, {
    year: 5017,
    month: 2,
    day: 28,
    hour: 23,
    minute: 5,
    second: 0,
  }, 100);
  assert.equal(formatUniversalDate(state.baseMs), "Monday, February 28, 5017 U");
  assert.equal(formatUniversalClock(state.baseMs), "23:05:00");
  assert.throws(() => makeUniversalTimeMs({ year: 5017, month: 2, day: 29 }), /does not exist/);
});
