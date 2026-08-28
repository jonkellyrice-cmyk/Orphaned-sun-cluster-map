#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseCsv } from "../scripts/system-data.mjs";
import { generatePlanetGeography, summarizeGeography } from "../scripts/planet-geography.mjs";

const args = new Set(process.argv.slice(2));
const rows = parseCsv(readFileSync(new URL("../docs/system-orbital-distances.csv", import.meta.url), "utf8"));
const targets = rows.filter((row) => row.geography_seed);
if (targets.length !== 43) throw new Error(`Expected 43 seeded terrestrial worlds; found ${targets.length}`);

if (args.has("--self-test")) {
  const row = targets.find((candidate) => candidate.object === "Eventide");
  const first = generatePlanetGeography(row, { resolutionDeg: 12 });
  const second = generatePlanetGeography(row, { resolutionDeg: 12 });
  if (JSON.stringify(first) !== JSON.stringify(second)) throw new Error("Generator is not deterministic");
  if (Math.abs(first.realizedWaterFraction - .86) > .02) throw new Error("Sea-level fit missed Eventide water target");
  if (!first.coastlines.length || !first.rivers.length || !first.settlements.length) throw new Error("Generator omitted required literal feature classes");
  console.log(JSON.stringify({ selfTest: "passed", world: "Abydos/Eventide", summary: summarizeGeography(first) }, null, 2));
  process.exit(0);
}

const outputRoot = resolve("data/planet-geography");
const manifest = { schemaVersion: 1, modelVersion: "orphaned-sun-geography-v1", status: "generated-working-canon", worlds: [] };
for (const row of targets) {
  const world = generatePlanetGeography(row, { resolutionDeg: 6 });
  const relative = `${row.system.toLowerCase()}/${row.object.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`;
  const absolute = resolve(outputRoot, relative); mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, JSON.stringify(world));
  manifest.worlds.push({ system: row.system, body: row.object, seed: row.geography_seed, inputFingerprint: row.geography_input_fingerprint, path: `data/planet-geography/${relative}`, summary: summarizeGeography(world) });
}
mkdirSync(outputRoot, { recursive: true });
writeFileSync(resolve(outputRoot, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`Generated ${manifest.worlds.length} deterministic terrestrial worlds.`);
