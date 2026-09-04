#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseCsv } from "../scripts/system-data.mjs";
import {
  SUPERSTRUCTURE_KEYS,
  SUPERSTRUCTURE_MODEL_VERSION,
  buildSuperstructureIdentity,
  superstructureKey,
} from "../scripts/superstructure-identities.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REGISTRY = "docs/system-orbital-distances.csv";
const OPERATIONS_MANIFEST = "data/body-operations/manifest.json";
const OUTPUT = "data/superstructure-identities.json";
const NATURAL_OPERATIONAL_KINDS = new Set(["natural-solid", "giant", "belt", "anomaly"]);

const read = (relative) => fs.readFileSync(path.join(ROOT, relative), "utf8");
const sha256 = (text) => crypto.createHash("sha256").update(text).digest("hex");
const key = (system, body) => `${system}\u0000${body}`;

function buildArtifact() {
  const registryText = read(REGISTRY);
  const manifestText = read(OPERATIONS_MANIFEST);
  const rows = parseCsv(registryText);
  const manifest = JSON.parse(manifestText);
  const rowByBody = new Map(rows.map((row) => [key(row.system, row.object), row]));

  const builtAssets = manifest.assets.filter((asset) => !NATURAL_OPERATIONAL_KINDS.has(asset.operationalKind));
  const builtKeys = builtAssets.map((asset) => superstructureKey(asset.system, asset.body)).sort();
  const expectedKeys = [...SUPERSTRUCTURE_KEYS];

  if (builtKeys.length !== expectedKeys.length) {
    throw new Error(`Superstructure coverage count mismatch: manifest has ${builtKeys.length} built assets, identity catalog has ${expectedKeys.length}.`);
  }
  for (let index = 0; index < builtKeys.length; index += 1) {
    if (builtKeys[index] !== expectedKeys[index]) {
      throw new Error(`Superstructure coverage mismatch at ${index}: manifest=${builtKeys[index]} catalog=${expectedKeys[index]}.`);
    }
  }

  const entries = builtAssets
    .map((asset) => {
      const row = rowByBody.get(key(asset.system, asset.body));
      if (!row) throw new Error(`Missing registry row for ${asset.system}/${asset.body}.`);
      const identity = buildSuperstructureIdentity(row, asset);
      if (!identity) throw new Error(`Missing superstructure identity for ${asset.system}/${asset.body}.`);
      return identity;
    })
    .sort((a, b) => a.system.localeCompare(b.system) || a.body.localeCompare(b.body));

  const factionCounts = {};
  const topologyCounts = {};
  for (const entry of entries) {
    factionCounts[entry.factionFamily] = (factionCounts[entry.factionFamily] ?? 0) + 1;
    topologyCounts[entry.topology] = (topologyCounts[entry.topology] ?? 0) + 1;
    if (!entry.effectiveDimensions || !entry.populationBand) throw new Error(`${entry.system}/${entry.body} lacks effective city-scale dimensions/population.`);
    if (!entry.signatureStructures.length || entry.signatureStructures.length < 2) throw new Error(`${entry.system}/${entry.body} lacks sufficient signature structure detail.`);
    if (!entry.interiorZones.length || entry.interiorZones.length < 4) throw new Error(`${entry.system}/${entry.body} lacks sufficient structural zoning.`);
    if (!entry.prohibitedMisreadings.includes("conventional small spacecraft/station scale")) throw new Error(`${entry.system}/${entry.body} is missing the city-scale misreading guard.`);
  }

  return {
    schemaVersion: 1,
    status: "accepted-working-canon",
    modelVersion: SUPERSTRUCTURE_MODEL_VERSION,
    authority: "Orphaned-sun-cluster-map",
    count: entries.length,
    sourceRegistry: { path: REGISTRY, sha256: sha256(registryText) },
    sourceOperationsManifest: { path: OPERATIONS_MANIFEST, sha256: sha256(manifestText), modelVersion: manifest.modelVersion },
    policy: {
      scaleFloor: "major-city-scale-or-larger for every listed artificial body",
      populationFloor: "large permanent/resident/working population appropriate to city-scale superstructures",
      axiolith: "Axiolith reduces effective inertial/structural stress enough to permit these enormous mobile and fixed superstructures.",
      inference: "system-art identity and existing canon constrain macroform; only unmapped local detail may be deterministically inferred",
    },
    factionCounts: Object.fromEntries(Object.entries(factionCounts).sort()),
    topologyCounts: Object.fromEntries(Object.entries(topologyCounts).sort()),
    entries,
  };
}

function main() {
  const artifact = buildArtifact();
  const text = `${JSON.stringify(artifact, null, 2)}\n`;
  const output = path.join(ROOT, OUTPUT);
  const check = process.argv.includes("--check");
  if (check) {
    if (!fs.existsSync(output)) throw new Error(`${OUTPUT} does not exist. Run the Phase 1 script without --check.`);
    if (fs.readFileSync(output, "utf8") !== text) throw new Error(`${OUTPUT} is stale. Re-run Phase 1.`);
    console.log(`[superstructure:phase1] verified ${artifact.count} superstructure identities`);
    console.log(`[superstructure:phase1] factions ${JSON.stringify(artifact.factionCounts)}`);
    return;
  }
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const before = fs.existsSync(output) ? fs.readFileSync(output, "utf8") : null;
  if (before !== text) fs.writeFileSync(output, text);
  console.log(`[superstructure:phase1] ${before === text ? "unchanged" : "wrote"} ${OUTPUT} (${artifact.count} identities)`);
  console.log(`[superstructure:phase1] factions ${JSON.stringify(artifact.factionCounts)}`);
}

main();
