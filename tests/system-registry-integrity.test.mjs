import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildSystemModel, displayPosition, parseCsv, physicalDistanceAu } from "../scripts/system-data.mjs";

const rows = parseCsv(readFileSync(new URL("../docs/system-orbital-distances.csv", import.meta.url), "utf8"));
const systems = [...new Set(rows.map((row) => row.system))];

test("all ten system models resolve every parent hierarchy to finite coordinates", () => {
  assert.equal(systems.length, 10);
  for (const system of systems) {
    const model = buildSystemModel(rows, system);
    for (const object of model.objects) {
      for (const value of Object.values(object.physical)) assert.ok(Number.isFinite(value), `${system}/${object.name}`);
      for (const value of Object.values(displayPosition(object, model))) assert.ok(Number.isFinite(value), `${system}/${object.name}`);
      if (object.parentObject) assert.ok(Math.abs(physicalDistanceAu(object, object.parentObject) - object.distanceAu) < 1e-10, `${system}/${object.name}`);
    }
  }
});
test("system registry exposes every required schematic object family", () => {
  const classes = new Set(systems.flatMap((system) => buildSystemModel(rows, system).objects.map((object) => object.objectClass)));
  assert.deepEqual(classes, new Set(["star", "planet", "moon", "giant", "installation", "vessel", "belt", "anomaly", "barycenter"]));
});

test("non-selectable regions remain visible but unavailable as route endpoints", () => {
  const regions = systems.flatMap((system) => buildSystemModel(rows, system).objects).filter((object) => ["belt", "anomaly"].includes(object.objectClass));
  assert.ok(regions.length >= 3);
  assert.ok(regions.some((object) => !object.selectable));
});

test("all system objects retain canonical identity and reference measurements", () => {
  const objects = systems.flatMap((system) => buildSystemModel(rows, system).objects);
  assert.equal(objects.length, 126);
  assert.equal(new Set(objects.map((object) => object.id)).size, 126);
  for (const object of objects) {
    assert.ok(object.name && object.type && object.parent);
    assert.ok(object.distanceAu >= 0);
  }
});
