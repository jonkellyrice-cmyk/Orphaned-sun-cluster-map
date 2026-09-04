#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SNAPSHOT_SOURCE = path.join(ROOT, "scripts", "atlas-snapshot-v2.mjs");
const BUNDLE_PATH = path.join(ROOT, "exports", "generated-maps.bundle.json");
const EXPECTED_SUPERSTRUCTURES = 28;

const OLD_BLOCK = `    "STRUCTURE=attached structural plate is authoritative for macro-silhouette, primary axes, relative massing, signature structures, structural-zone relationships, docking/approach logic, and named operational features",
    "SCALE=city-scale or larger inhabited superstructure; never interpret as a conventional small spacecraft, ordinary station, or lightly crewed platform",
    "EXTERIOR=preserve object-specific silhouette and faction design grammar; add high-fidelity local structure without changing the established macroform",
    "CROSS_SECTION=preserve the exterior envelope and listed structural-zone order/relationships; infer deck, room, conduit, transit, and local machinery detail only inside those bounded zones",
    \`FACTION=\${identity.factionLabel}; \${identity.factionDesignGrammar}\`,
    "DETAIL=high information / low noise; city-scale habitation, transit, logistics, engineering and civic infrastructure should be visibly plausible",
    "TEXT=no invented labels, names, lore, slogans, heraldry, or annotations beyond supplied canon",
    \`DO_NOT=\${identity.prohibitedMisreadings.join("; ")}\`,
`;

const NEW_BLOCK = `    "STRUCTURE=attached structural plate is authoritative for macro-silhouette, primary axes, relative massing, signature structures, structural-zone relationships, docking/approach logic, and named operational features",
    "SCALE=city-scale or larger inhabited superstructure; never interpret as a conventional small spacecraft, ordinary station, or lightly crewed platform",
    "EXTERIOR=preserve object-specific silhouette and faction design grammar; add high-fidelity local structure without changing the established macroform",
    "CROSS_SECTION=preserve the exterior envelope and listed structural-zone order/relationships; infer deck, room, conduit, transit, and local machinery detail only inside those bounded zones",
    \`FACTION=\${identity.factionLabel}; \${identity.factionDesignGrammar}\`,
    "RENDER=high-fidelity Orphaned Sun superstructure atlas artwork",
    "SOURCE=attached structural plate + packet metadata",
    "STYLE=painterly sci-fi technical atlas; hand-painted mechanical/architectural illustration; same visual family as Orphaned Sun planetary atlases; cohesive; atmospheric; naturalistic materials; broad-to-medium structural hierarchy; selective crisp engineering detail; not photoreal CGI",
    "DETAIL=high information / low noise; macroform first; functional secondary systems second; fine mechanical detail only where it clarifies construction, scale, or use",
    "SCALE_CUES=communicate immense inhabited scale through civic/habitation volumes, transit systems, docks, apertures, service infrastructure, and subordinate craft; sparse readable windows/lights",
    "INTERIOR=hierarchical city-like zoning; varied civic, habitation, transit, industrial, engineering, storage, docking, and service volumes; preserve large voids and structural/service spaces; no uniform compartment tessellation",
    "LIGHT=restrained functional navigation, habitation, docking, and service illumination; no decorative point-light saturation",
    "AVOID=AI greebling; recursive panel subdivision; arbitrary seams; repetitive vents/recesses; dense kitbash texture; uniform window grids; repeated tiny lights; pseudo-functional machinery; excessive exposed piping; fractal mechanical detail; clutter; filler detail; toy/model scale; glossy CGI; excessive bloom; lens flare; ant-farm interiors",
    "TEXT=no invented labels, names, lore, slogans, heraldry, or annotations beyond supplied canon",
    \`DO_NOT=\${identity.prohibitedMisreadings.join("; ")}\`,
`;

const REQUIRED_LINES = [
  "RENDER=high-fidelity Orphaned Sun superstructure atlas artwork",
  "SOURCE=attached structural plate + packet metadata",
  "STYLE=painterly sci-fi technical atlas;",
  "DETAIL=high information / low noise; macroform first;",
  "SCALE_CUES=communicate immense inhabited scale",
  "INTERIOR=hierarchical city-like zoning;",
  "LIGHT=restrained functional navigation",
  "AVOID=AI greebling;",
  "TEXT=no invented labels, names, lore, slogans, heraldry, or annotations beyond supplied canon",
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function byId(bundle) {
  return new Map(bundle.entries.map((entry) => [entry.id, entry]));
}

function isSuperstructure(entry) {
  return entry.informationPacket.includes("## Superstructure generation contract");
}

function assertPacket(entry) {
  for (const required of REQUIRED_LINES) {
    if (!entry.informationPacket.includes(required)) throw new Error(`${entry.name} missing superstructure style directive: ${required}`);
  }
  for (const retained of ["STRUCTURE=", "SCALE=", "EXTERIOR=", "CROSS_SECTION=", "FACTION=", "DO_NOT="]) {
    if (!entry.informationPacket.includes(retained)) throw new Error(`${entry.name} lost required superstructure directive ${retained}`);
  }
}

function patchGenerator() {
  const source = fs.readFileSync(SNAPSHOT_SOURCE, "utf8");
  if (source.includes(NEW_BLOCK)) return false;
  if (!source.includes(OLD_BLOCK)) throw new Error("atlas-snapshot-v2.mjs no longer matches the known pre-migration superstructure contract; refusing unsafe patch.");
  fs.writeFileSync(SNAPSHOT_SOURCE, source.replace(OLD_BLOCK, NEW_BLOCK));
  return true;
}

function run(command, args) {
  execFileSync(command, args, { cwd: ROOT, stdio: "inherit" });
}

function main() {
  const before = readJson(BUNDLE_PATH);
  const beforeById = byId(before);
  const beforeSuper = before.entries.filter(isSuperstructure);
  if (beforeSuper.length !== EXPECTED_SUPERSTRUCTURES) throw new Error(`Expected ${EXPECTED_SUPERSTRUCTURES} superstructure packets before migration; found ${beforeSuper.length}.`);

  const sourceChanged = patchGenerator();
  run(process.execPath, ["tools/export-atlas-snapshots.mjs"]);

  const after = readJson(BUNDLE_PATH);
  if (JSON.stringify(after.counts) !== JSON.stringify(before.counts)) throw new Error("Generated Maps counts changed during style-only migration.");
  if (after.entries.length !== before.entries.length) throw new Error("Generated Maps entry count changed during style-only migration.");

  let changedSuperPackets = 0;
  let changedSuperImages = 0;
  let changedOtherPackets = 0;
  let changedOtherImages = 0;
  let superCount = 0;

  for (const entry of after.entries) {
    const prior = beforeById.get(entry.id);
    if (!prior) throw new Error(`Unexpected Generated Maps entry ${entry.id}.`);
    const superstructure = isSuperstructure(entry);
    if (superstructure) {
      superCount += 1;
      assertPacket(entry);
      if (entry.informationPacket !== prior.informationPacket) changedSuperPackets += 1;
      if (entry.referenceSvg !== prior.referenceSvg) changedSuperImages += 1;
    } else {
      if (entry.informationPacket !== prior.informationPacket) changedOtherPackets += 1;
      if (entry.referenceSvg !== prior.referenceSvg) changedOtherImages += 1;
    }
  }

  if (superCount !== EXPECTED_SUPERSTRUCTURES) throw new Error(`Expected ${EXPECTED_SUPERSTRUCTURES} superstructure packets after migration; found ${superCount}.`);
  if (changedSuperImages !== 0) throw new Error(`Style-only migration changed ${changedSuperImages} superstructure reference images.`);
  if (changedOtherPackets !== 0 || changedOtherImages !== 0) throw new Error(`Style-only migration leaked outside superstructures: ${changedOtherPackets} packets, ${changedOtherImages} images.`);
  if (sourceChanged && changedSuperPackets !== EXPECTED_SUPERSTRUCTURES) throw new Error(`First application must change exactly ${EXPECTED_SUPERSTRUCTURES} superstructure packets; changed ${changedSuperPackets}.`);
  if (!sourceChanged && changedSuperPackets !== 0) throw new Error(`Idempotent rerun must change zero superstructure packets; changed ${changedSuperPackets}.`);

  run("npm", ["test"]);
  run("npm", ["run", "body-operations:validate"]);
  run("npm", ["run", "body-operations:check"]);
  run("npm", ["run", "astronomy:validate"]);
  run("npm", ["run", "astronomy:check"]);
  run("npm", ["run", "atlas:snapshot:check"]);

  console.log(JSON.stringify({
    sourceChanged,
    superstructurePackets: superCount,
    changedSuperstructurePackets: changedSuperPackets,
    changedSuperstructureImages: changedSuperImages,
    changedNonSuperstructurePackets: changedOtherPackets,
    changedNonSuperstructureImages: changedOtherImages,
    totalReferences: after.counts.total,
  }, null, 2));
}

main();
