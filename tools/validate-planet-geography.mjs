#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { parseCsv } from "../scripts/system-data.mjs";
import { generatePlanetGeography, summarizeGeography } from "../scripts/planet-geography.mjs";

const strict = process.argv.includes("--strict");
const accepted = process.argv.includes("--accepted");
const root = new URL("../", import.meta.url);
const rows = parseCsv(readFileSync(new URL("docs/system-orbital-distances.csv", root), "utf8"));
const targets = rows.filter((row) => row.geography_seed);
const manifest = JSON.parse(readFileSync(new URL("data/planet-geography/manifest.json", root), "utf8"));
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };

assert(targets.length === 43, `canonical registry has ${targets.length}, not 43, seeded worlds`);
if (accepted) assert(manifest.status === "accepted-working-canon", "manifest is not accepted working canon");
assert(manifest.worlds?.length === 43, `manifest has ${manifest.worlds?.length}, not 43, worlds`);
const targetByKey = new Map(targets.map((row) => [`${row.system}\0${row.object}`, row]));
const keys = new Set();
for (const entry of manifest.worlds ?? []) {
  const key = `${entry.system}\0${entry.body}`;
  assert(!keys.has(key), `duplicate manifest world ${entry.system}/${entry.body}`); keys.add(key);
  const row = targetByKey.get(key);
  assert(row, `noncanonical manifest world ${entry.system}/${entry.body}`);
  if (!row) continue;
  const world = JSON.parse(readFileSync(new URL(entry.path, root), "utf8"));
  assert(world.seed === row.geography_seed, `${key}: seed drift`);
  assert(world.modelVersion === row.geography_model_version, `${key}: model version drift`);
  assert(world.inputFingerprint === row.geography_input_fingerprint, `${key}: input fingerprint drift`);
  assert(Math.abs(world.realizedWaterFraction - Number(row.water_pct) / 100) <= .01, `${key}: water fraction mismatch`);
  assert(world.plateModel.length > 0 && world.cells.length > 0, `${key}: missing terrain geometry`);
  assert(world.coastlines.length > 0, `${key}: missing coast geometry`);
  assert(world.rivers.length > 0 && world.lakes.length > 0, `${key}: missing hydrology`);
  assert(world.settlements.length > 0, `${key}: inhabited world has no settlement sites`);
  assert(world.transportRoutes.length === Math.max(0, world.settlements.length - 1), `${key}: incomplete transport network`);
  if (entry.body === "Eventide") assert(!world.cells.some((cell) => !cell.ocean && cell.elevationM < 0), "Eventide contains invalid submerged land");
  if (strict) {
    const regenerated = generatePlanetGeography(row, { resolutionDeg: world.resolutionDeg });
    assert(JSON.stringify(regenerated) === JSON.stringify(world), `${key}: asset is not reproducible from canonical inputs`);
    assert(JSON.stringify(summarizeGeography(world)) === JSON.stringify(entry.summary), `${key}: manifest summary drift`);
  }
}
for (const key of targetByKey.keys()) assert(keys.has(key), `missing manifest world ${key.replace("\0", "/")}`);
if (failures.length) throw new Error(`Planet geography validation failed:\n- ${failures.join("\n- ")}`);
console.log(`Validated ${keys.size} deterministic terrestrial geography assets${strict ? " with exact regeneration" : ""}.`);
