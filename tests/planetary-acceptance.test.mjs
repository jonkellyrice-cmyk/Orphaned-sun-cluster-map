import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { parseCsv } from "../scripts/system-data.mjs";
import { buildNaturalBodyModels } from "../scripts/natural-body-data.mjs";
import { buildArtificialBodyModels } from "../scripts/artificial-body-data.mjs";

const root = new URL("../", import.meta.url);
const rows = parseCsv(readFileSync(new URL("docs/system-orbital-distances.csv", root), "utf8"));
const manifest = JSON.parse(readFileSync(new URL("data/planet-geography/manifest.json", root), "utf8"));

test("43 permanent-seed surfaces are explicitly accepted as working canon", () => {
  assert.equal(manifest.status, "accepted-working-canon"); assert.equal(manifest.worlds.length, 43);
  for (const entry of manifest.worlds) { const world = JSON.parse(readFileSync(new URL(entry.path, root), "utf8")); assert.equal(world.seed, entry.seed); assert.equal(world.inputFingerprint, entry.inputFingerprint); }
});

test("accepted worlds retain causal geography and inhabited networks", () => {
  for (const entry of manifest.worlds) {
    const world = JSON.parse(readFileSync(new URL(entry.path, root), "utf8"));
    assert.ok(world.plateModel.length >= 5 && world.coastlines.length && world.rivers.length && world.lakes.length, entry.body);
    assert.ok(new Set(world.cells.map((cell) => cell.biome)).size >= 2, entry.body);
    assert.ok(world.settlements.some((site) => site.kind === "capital"), entry.body);
    assert.equal(world.transportRoutes.length, world.settlements.length - 1, entry.body);
  }
});

test("all eligible canonical objects have an orbital body presentation model", () => {
  const covered = new Set([...buildNaturalBodyModels(rows), ...buildArtificialBodyModels(rows)].map((model) => `${model.system}/${model.body}`));
  // Distributed belts/fields remain system-scale regions rather than falsely
  // presenting their reference centroid as a dockable body.
  const eligible = rows.filter((row) => !/star|barycenter|belt|field/i.test(row.type) || /anomaly/i.test(row.type));
  for (const row of eligible) assert.ok(covered.has(`${row.system}/${row.object}`), `${row.system}/${row.object}`);
});

test("individual world assets remain within the orbital viewer loading budget", () => {
  for (const entry of manifest.worlds) assert.ok(statSync(new URL(entry.path, root)).size < 1_000_000, `${entry.body} asset exceeds 1 MB`);
  const bodySource = readFileSync(new URL("scripts/body-view.mjs", root), "utf8");
  for (const gesture of ["pointerdown", "pointermove", "pointerup", "pointercancel", "wheel"]) assert.match(bodySource, new RegExp(gesture));
});
