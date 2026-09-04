import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SNAPSHOT = path.join(ROOT, "scripts", "atlas-snapshot.mjs");
const BUNDLE = path.join(ROOT, "exports", "generated-maps.bundle.json");
const MARKER = "// Atlas projection invariant: PNG row 0 is +90° north, matching mapY().";

const replacement = `function planetRaster(world) {
  const { latCount, lonCount } = world.grid;
  const pixels = Buffer.alloc(latCount * lonCount * 4);
  const elevations = world.raster.elevationM;
  const biomeIndexes = Buffer.from(world.raster.biome.valuesBase64, "base64");
  ${MARKER}
  // Materialized cartography is indexed south-to-north (latIndex 0 ~= -90°).
  // PNG scanlines are top-to-bottom, so explicitly reverse latitude rows here.
  // Longitude order is already west-to-east and remains unchanged.
  for (let displayLatIndex = 0; displayLatIndex < latCount; displayLatIndex += 1) {
    const sourceLatIndex = latCount - 1 - displayLatIndex;
    for (let lonIndex = 0; lonIndex < lonCount; lonIndex += 1) {
      const sourceIndex = sourceLatIndex * lonCount + lonIndex;
      const targetIndex = displayLatIndex * lonCount + lonIndex;
      const biome = world.raster.biome.categories[biomeIndexes[sourceIndex]];
      const elevation = elevations[sourceIndex];
      const base = BIOME_COLORS[biome] ?? [112, 121, 102];
      const relief = elevation > 0 ? Math.max(-22, Math.min(38, elevation / 180)) : Math.max(-24, elevation / 320);
      pixels[targetIndex * 4] = Math.max(0, Math.min(255, base[0] + relief));
      pixels[targetIndex * 4 + 1] = Math.max(0, Math.min(255, base[1] + relief));
      pixels[targetIndex * 4 + 2] = Math.max(0, Math.min(255, base[2] + relief));
      pixels[targetIndex * 4 + 3] = 255;
    }
  }
  return encodePng(lonCount, latCount, pixels).toString("base64");
}`;

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function run(command) {
  console.log(`[phase-1] ${command}`);
  execSync(command, { cwd: ROOT, stdio: "inherit" });
}

function patchProjection() {
  const source = fs.readFileSync(SNAPSHOT, "utf8");
  if (source.includes(MARKER)) {
    console.log("[phase-1] projection source already north-up; no source edit needed");
    return false;
  }
  const start = source.indexOf("function planetRaster(world) {");
  const end = source.indexOf("\n\nconst mapX", start);
  assert.notEqual(start, -1, "planetRaster() was not found");
  assert.notEqual(end, -1, "planetRaster() boundary was not found");
  const existing = source.slice(start, end);
  assert.match(existing, /for \(let index = 0; index < pixels\.length \/ 4; index \+= 1\)/, "planetRaster() no longer matches the expected pre-Phase-1 implementation; inspect before migrating");
  fs.writeFileSync(SNAPSHOT, source.slice(0, start) + replacement + source.slice(end));
  console.log("[phase-1] patched planetRaster() to emit north-up equirectangular scanlines");
  return true;
}

function indexById(bundle, type) {
  return new Map(bundle.entries.filter((entry) => entry.mapType === type).map((entry) => [entry.id, entry]));
}

function validatePropagation(before, after) {
  assert.deepEqual(after.counts, before.counts, "Phase 1 must not change atlas entry counts");
  assert.equal(after.counts.planetary, 43, "Phase 1 expects the canonical 43 planetary sheets");

  const beforeOperational = indexById(before, "operational");
  const afterOperational = indexById(after, "operational");
  assert.deepEqual(afterOperational, beforeOperational, "Phase 1 must not alter operational references");

  const beforePlanetary = indexById(before, "planetary");
  const afterPlanetary = indexById(after, "planetary");
  assert.equal(afterPlanetary.size, 43);
  let changedReferences = 0;
  for (const [id, previous] of beforePlanetary) {
    const current = afterPlanetary.get(id);
    assert.ok(current, `Missing regenerated planetary reference ${id}`);
    assert.equal(current.sourcePath, previous.sourcePath, `${id}: source path changed`);
    assert.equal(current.sourceSha256, previous.sourceSha256, `${id}: source hash changed`);
    assert.equal(current.sourceFingerprint, previous.sourceFingerprint, `${id}: source fingerprint changed`);
    assert.equal(current.informationPacket, previous.informationPacket, `${id}: information packet changed during projection-only phase`);
    if (current.referenceSvg !== previous.referenceSvg) changedReferences += 1;
  }
  assert.equal(changedReferences, 43, `Expected all 43 planetary reference rasters to be reprojected; changed ${changedReferences}`);
  console.log(`[phase-1] validated projection-only propagation: ${changedReferences}/43 planetary sheets changed; ${afterOperational.size} operational sheets byte-stable`);
}

function validateAlreadyApplied(before, after) {
  assert.equal(after.counts.planetary, 43, "Phase 1 expects the canonical 43 planetary sheets");
  assert.equal(after.counts.operational, 71, "Phase 1 expects the canonical 71 operational sheets");
  assert.deepEqual(after, before, "An already-applied Phase 1 migration must regenerate byte-identically");
  console.log("[phase-1] idempotence verified: north-up source and 114-sheet authoritative bundle are already current");
}

function main() {
  const before = readJson(BUNDLE);
  const patched = patchProjection();
  run("npm test");
  run("npm run atlas:snapshot");
  run("npm run atlas:snapshot:check");
  const after = readJson(BUNDLE);
  if (patched) validatePropagation(before, after);
  else validateAlreadyApplied(before, after);
  console.log("[phase-1] complete: planetary atlas raster is north-up and authoritative export regenerated");
}

main();
