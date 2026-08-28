import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AU_KM, buildSystemModel, displayPosition, parseCsv, physicalDistanceAu } from "../scripts/system-data.mjs";

const rows = parseCsv(readFileSync(new URL("../docs/system-orbital-distances.csv", import.meta.url), "utf8"));

test("canonical registry parses all 126 objects and ten systems", () => {
  assert.equal(rows.length, 126);
  assert.equal(new Set(rows.map((row) => row.system)).size, 10);
});

test("parent-relative moon positions convert km to AU", () => {
  const model = buildSystemModel(rows, "Amarna");
  const nansen = model.byName.get("Nansen");
  const svalbard = model.byName.get("Svalbard");
  assert.ok(Math.abs(physicalDistanceAu(nansen, svalbard) - 190_000 / AU_KM) < 1e-12);
});

test("Akhetan infrastructure resolves through its parent hierarchy", () => {
  const model = buildSystemModel(rows, "Amarna");
  const akhetan = model.byName.get("Akhetan");
  const gateway = model.byName.get("Union Gateway Station");
  assert.equal(gateway.parentObject, akhetan);
  assert.ok(Math.abs(physicalDistanceAu(akhetan, gateway) - 70_000 / AU_KM) < 1e-12);
});

test("display compression does not alter physical route coordinates", () => {
  const model = buildSystemModel(rows, "Abydos");
  const eventide = model.byName.get("Eventide");
  const station = model.byName.get("Vada Anchorage");
  const physical = physicalDistanceAu(eventide, station);
  const a = displayPosition(eventide, model), b = displayPosition(station, model);
  assert.ok(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) > physical * 100);
  assert.ok(Math.abs(physical - 180_000 / AU_KM) < 1e-12);
});

test("Tanis preserves two stars around the barycenter", () => {
  const model = buildSystemModel(rows, "Tanis");
  assert.equal(model.objects.filter((object) => object.objectClass === "star").length, 2);
  assert.equal(model.byName.get("Tanis A").parent, "Tanis barycenter");
  assert.equal(model.byName.get("Tanis B").parent, "Tanis barycenter");
});
