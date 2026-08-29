import test from "node:test";
import assert from "node:assert/strict";
import { SYSTEMS } from "../scripts/cluster-data.mjs";
import { CAPITAL_MARKERS, factionPresentationForOwner } from "../scripts/capital-icons.mjs";

const expected = Object.freeze({
  eventide: "abydos",
  mandate: "sais",
  conclave: "nekhen",
  accords: "saqqara",
  union: "amarna",
});

test("capital markers use the canonical faction capital systems", () => {
  const actual = Object.fromEntries(CAPITAL_MARKERS.map((marker) => [marker.factionId, marker.systemId]));
  assert.deepEqual(actual, expected);
});

test("every capital marker points at an existing Big Ten system", () => {
  const systemIds = new Set(SYSTEMS.map((system) => system.id));
  assert.equal(CAPITAL_MARKERS.length, 5);
  assert.equal(new Set(CAPITAL_MARKERS.map((marker) => marker.systemId)).size, CAPITAL_MARKERS.length);
  assert.equal(new Set(CAPITAL_MARKERS.map((marker) => marker.factionId)).size, CAPITAL_MARKERS.length);
  for (const marker of CAPITAL_MARKERS) assert.equal(systemIds.has(marker.systemId), true, marker.systemId);
});

test("canonical ownership names resolve to reusable faction emblems", () => {
  assert.equal(factionPresentationForOwner("Eventide").factionId, "eventide");
  assert.equal(factionPresentationForOwner("Signatories of the Accords").factionId, "accords");
  assert.equal(factionPresentationForOwner("Adanian Conclave").factionId, "conclave");
  assert.equal(factionPresentationForOwner("Xuanjia Mandate").factionId, "mandate");
  assert.equal(factionPresentationForOwner("Union").factionId, "union");
  assert.equal(factionPresentationForOwner(""), null);
});
