import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildSystemModel, formatSystemDistance, parseCsv, physicalDistanceLy } from "../scripts/system-data.mjs";
import { calculateTransit, formatDuration } from "../scripts/relativity.mjs";

const rows = parseCsv(readFileSync(new URL("../docs/system-orbital-distances.csv", import.meta.url), "utf8"));

test("system routes feed physical distance into the existing relativistic solver", () => {
  const model = buildSystemModel(rows, "Abydos");
  const distance = physicalDistanceLy(model.byName.get("Eventide"), model.byName.get("Vada Anchorage"));
  const transit = calculateTransit(distance, { accelerationG: 200, cruiseBeta: .995 });
  assert.equal(transit.reachesCruise, false);
  assert.ok(transit.clusterYears > 0);
});

test("local distance formatting selects useful units", () => {
  assert.match(formatSystemDistance(180_000 / 149_597_870.7), /180,000 km/);
  assert.match(formatSystemDistance(.05), /million km/);
  assert.match(formatSystemDistance(1.2), /AU/);
});

test("short transit duration formatting reaches minutes and seconds", () => {
  assert.match(formatDuration(30 / 31_557_600), /sec/);
  assert.match(formatDuration(600 / 31_557_600), /min/);
});

test("manifest loads permanent system-view stylesheet", () => {
  const manifest = JSON.parse(readFileSync(new URL("../module.json", import.meta.url), "utf8"));
  assert.ok(manifest.styles.includes("styles/system-map.css"));
});
