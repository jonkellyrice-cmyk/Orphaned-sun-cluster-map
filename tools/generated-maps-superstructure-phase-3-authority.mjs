#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BUNDLE_PATH = "exports/generated-maps.bundle.json";
const MANIFEST_PATH = "exports/generated-maps.manifest.json";
const IDENTITIES_PATH = "data/superstructure-identities.json";
const EXPECTED_MODEL = "orphaned-sun-superstructure-identity-v1";
const EXPECTED_COUNTS = Object.freeze({ planetary: 43, operational: 71, total: 114 });

const read = (relative) => fs.readFileSync(path.join(ROOT, relative), "utf8");
const sha256 = (text) => crypto.createHash("sha256").update(text).digest("hex");
const key = (system, body) => `${system}\u0000${body}`;

function run(command, args) {
  const result = spawnSync(command, args, { cwd: ROOT, stdio: "inherit", encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed with status ${result.status}`);
}

function assertCounts(counts, label) {
  for (const field of ["planetary", "operational", "total"]) {
    if (counts?.[field] !== EXPECTED_COUNTS[field]) throw new Error(`${label} ${field} count drifted: ${counts?.[field]}`);
  }
  if (counts.planetary + counts.operational !== counts.total) throw new Error(`${label} counts do not sum.`);
}

function main() {
  // Phase 3 begins only from already-materialized, already-idempotent Phase 1/2 state.
  run(process.execPath, ["tools/generated-maps-superstructure-phase-1-identities.mjs", "--check"]);
  run("npm", ["run", "atlas:snapshot:check"]);

  const identityText = read(IDENTITIES_PATH);
  const identities = JSON.parse(identityText);
  if (identities.modelVersion !== EXPECTED_MODEL) throw new Error(`Unexpected superstructure model ${identities.modelVersion}.`);
  if (identities.count !== 28 || identities.entries?.length !== 28) throw new Error("Authority requires exactly 28 superstructure identities.");
  const identityKeys = new Set(identities.entries.map((entry) => key(entry.system, entry.body)));

  const bundleText = read(BUNDLE_PATH);
  const manifestText = read(MANIFEST_PATH);
  const bundle = JSON.parse(bundleText);
  const manifest = JSON.parse(manifestText);

  if (bundle.schemaVersion !== 1 || bundle.status !== "frozen-atlas-snapshot") throw new Error("Generated Maps bundle schema/status drifted.");
  assertCounts(bundle.counts, "bundle");
  assertCounts(manifest.counts, "manifest");
  if (bundle.entries?.length !== EXPECTED_COUNTS.total) throw new Error("Generated Maps bundle entry count does not match total.");

  const observedSha = sha256(bundleText);
  if (manifest.bundleSha256 !== observedSha) throw new Error(`Authority manifest SHA mismatch: ${manifest.bundleSha256} != ${observedSha}`);
  if (manifest.authority !== "jonkellyrice-cmyk/Orphaned-sun-cluster-map" || manifest.branch !== "main") throw new Error("Authority manifest repository/branch contract drifted.");
  if (manifest.bundlePath !== BUNDLE_PATH) throw new Error("Authority manifest bundlePath drifted.");

  const superstructureSource = manifest.sourceManifests?.find((item) => item.path === IDENTITIES_PATH);
  if (!superstructureSource) throw new Error("Authority manifest does not include the superstructure identity artifact.");
  if (superstructureSource.modelVersion !== EXPECTED_MODEL) throw new Error("Authority manifest superstructure model version drifted.");
  if (superstructureSource.sha256 !== sha256(identityText)) throw new Error("Authority manifest superstructure identity SHA is stale.");

  let superstructureCount = 0;
  let naturalContractLeak = 0;
  const seen = new Set();
  for (const entry of bundle.entries) {
    const entryKey = key(entry.system, entry.name);
    if (seen.has(entryKey)) throw new Error(`Duplicate Generated Maps entry ${entry.system}/${entry.name}.`);
    seen.add(entryKey);
    const isSuperstructure = identityKeys.has(entryKey);
    const hasContract = entry.informationPacket.includes("## Superstructure generation contract");
    const hasScale = entry.referenceSvg.includes('data-superstructure-scale="city-scale-or-larger"');
    const hasZones = entry.referenceSvg.includes('data-section-logic="true"');
    const hasOperationalOverlay = entry.referenceSvg.includes('data-operational-overlay="true"');
    if (isSuperstructure) {
      superstructureCount += 1;
      if (!hasContract || !hasScale || !hasZones || !hasOperationalOverlay) throw new Error(`${entry.system}/${entry.name} lacks the complete superstructure atlas contract.`);
      if (!entry.informationPacket.includes("CROSS_SECTION=") || !entry.informationPacket.includes("EXTERIOR=")) throw new Error(`${entry.system}/${entry.name} lacks exterior/cross-section handoff guidance.`);
      if (!entry.informationPacket.includes("Axiolith structural role:")) throw new Error(`${entry.system}/${entry.name} lacks Axiolith structural metadata.`);
    } else if (hasContract || hasScale || hasZones) {
      naturalContractLeak += 1;
    }
  }
  if (superstructureCount !== 28) throw new Error(`Observed ${superstructureCount} superstructure bundle entries, expected 28.`);
  if (naturalContractLeak) throw new Error(`Superstructure contract leaked into ${naturalContractLeak} non-superstructure entries.`);

  console.log(`[superstructure:phase3] authority verified: ${EXPECTED_COUNTS.total} sheets (${EXPECTED_COUNTS.planetary} planetary + ${EXPECTED_COUNTS.operational} operational)`);
  console.log(`[superstructure:phase3] superstructure entries: ${superstructureCount}; non-superstructure contract leaks: ${naturalContractLeak}`);
  console.log(`[superstructure:phase3] identity model: ${EXPECTED_MODEL}; identity SHA ${sha256(identityText)}`);
  console.log(`[superstructure:phase3] authoritative bundle SHA-256: ${observedSha}`);
}

main();
