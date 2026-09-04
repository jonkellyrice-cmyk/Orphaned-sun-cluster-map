#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TARGET = path.join(ROOT, "tests/atlas-planetary-projection.test.mjs");
const APPLY = process.argv.includes("--apply");
const CHECK = process.argv.includes("--check");
if (APPLY === CHECK) throw new Error("Use exactly one of --apply or --check.");

const source = fs.readFileSync(TARGET, "utf8");
const before = '    body: "Orientation",\n    sourceFingerprint: "orientation-test",';
const after = '    body: "Orientation",\n    ownerFaction: "Test Faction",\n    civilizationProfile: {\n      ownerFaction: "Test Faction",\n      settlementPattern: "test settlement pattern",\n      dominantSettlementPattern: "test dominant pattern",\n      majorPopulationCorridors: "test population corridors",\n      urbanConcentration: "test concentration",\n      majorCityCountBand: "0",\n      likelyTransportGeography: "test transport geography",\n    },\n    sourceFingerprint: "orientation-test",';

let expected = source;
if (!source.includes(after)) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`[planetary-civilization-test-fixture] expected one fixture anchor, found ${count}.`);
  expected = source.replace(before, after);
}

if (expected === source) {
  console.log("Planetary civilization atlas fixture is current.");
} else if (CHECK) {
  console.error("OUT OF DATE: tests/atlas-planetary-projection.test.mjs");
  process.exitCode = 1;
} else {
  fs.writeFileSync(TARGET, expected);
  console.log("UPDATED: tests/atlas-planetary-projection.test.mjs");
}
