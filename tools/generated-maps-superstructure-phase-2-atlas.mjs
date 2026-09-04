#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BUNDLE = path.join(ROOT, "exports/generated-maps.bundle.json");
const IDENTITIES = path.join(ROOT, "data/superstructure-identities.json");

function run(command, args) {
  const result = spawnSync(command, args, { cwd: ROOT, stdio: "inherit", encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed with status ${result.status}`);
}

const entryKey = (entry) => `${entry.system}\u0000${entry.name}`;

function validateSuperstructureEntries(bundle, keys) {
  const byKey = new Map(bundle.entries.map((entry) => [entryKey(entry), entry]));
  for (const key of keys) {
    const entry = byKey.get(key);
    if (!entry) throw new Error(`Generated Maps bundle is missing superstructure ${key.replace("\u0000", "/")}.`);
    if (!entry.referenceSvg.includes("data-superstructure-scale=\"city-scale-or-larger\"")) throw new Error(`${entry.name} lacks city-scale superstructure render marker.`);
    if (!entry.referenceSvg.includes("data-section-logic=\"true\"")) throw new Error(`${entry.name} lacks structural zoning guide.`);
    if (!entry.referenceSvg.includes("data-operational-overlay=\"true\"")) throw new Error(`${entry.name} lacks operational overlay.`);
    if (!entry.informationPacket.includes("## Superstructure generation contract")) throw new Error(`${entry.name} lacks the superstructure generation contract.`);
    if (!entry.informationPacket.includes("SCALE=city-scale or larger inhabited superstructure")) throw new Error(`${entry.name} lacks the superstructure scale guard.`);
    if (!entry.informationPacket.includes("CROSS_SECTION=")) throw new Error(`${entry.name} lacks cross-section guidance.`);
  }
}

function main() {
  run(process.execPath, ["tools/generated-maps-superstructure-phase-1-identities.mjs", "--check"]);
  const identities = JSON.parse(fs.readFileSync(IDENTITIES, "utf8"));
  if (identities.count !== 28 || identities.entries.length !== 28) throw new Error("Phase 2 requires exactly 28 materialized superstructure identities.");
  const identityKeys = new Set(identities.entries.map((entry) => `${entry.system}\u0000${entry.body}`));

  const before = JSON.parse(fs.readFileSync(BUNDLE, "utf8"));
  const beforeByKey = new Map(before.entries.map((entry) => [entryKey(entry), entry]));

  run("npm", ["run", "atlas:snapshot"]);

  const after = JSON.parse(fs.readFileSync(BUNDLE, "utf8"));
  if (after.counts.total !== 114 || after.counts.planetary !== 43 || after.counts.operational !== 71) throw new Error("Generated Maps authority counts drifted during Phase 2.");
  validateSuperstructureEntries(after, identityKeys);

  let builtChanged = 0;
  let unrelatedChanged = 0;
  const unrelated = [];
  for (const entry of after.entries) {
    const key = entryKey(entry);
    const previous = beforeByKey.get(key);
    if (!previous) throw new Error(`Generated Maps entry appeared unexpectedly: ${key}`);
    const changed = previous.referenceSvg !== entry.referenceSvg || previous.informationPacket !== entry.informationPacket;
    if (!changed) continue;
    if (identityKeys.has(key)) builtChanged += 1;
    else { unrelatedChanged += 1; unrelated.push(key.replace("\u0000", "/")); }
  }
  if (unrelatedChanged) throw new Error(`Phase 2 changed ${unrelatedChanged} non-superstructure entries: ${unrelated.join(", ")}`);
  if (![0, 28].includes(builtChanged)) throw new Error(`Phase 2 expected either 28 first-application changes or 0 idempotent changes, observed ${builtChanged}.`);

  run("npm", ["test"]);
  run("npm", ["run", "body-operations:validate"]);
  run("npm", ["run", "body-operations:check"]);
  run("npm", ["run", "atlas:snapshot:check"]);

  console.log(`[superstructure:phase2] ${builtChanged === 28 ? "first application changed all 28 superstructure references" : "idempotent rerun changed zero superstructure references"}`);
  console.log("[superstructure:phase2] non-superstructure reference/packet changes: 0");
  console.log(`[superstructure:phase2] verified ${after.counts.total} total sheets (${after.counts.planetary} planetary + ${after.counts.operational} operational)`);
}

main();
