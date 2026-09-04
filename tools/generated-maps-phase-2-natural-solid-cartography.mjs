#!/usr/bin/env node
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GENERATOR = path.join(ROOT, "tools", "generate-body-operations.mjs");
const NATURAL_MODEL = path.join(ROOT, "scripts", "natural-body-data.mjs");
const NATURAL_SURVEY = path.join(ROOT, "scripts", "natural-solid-cartography.mjs");
const ATLAS_VISUALS = path.join(ROOT, "scripts", "atlas-operational-visuals.mjs");
const BODY_MANIFEST = path.join(ROOT, "data", "body-operations", "manifest.json");
const ATLAS_BUNDLE = path.join(ROOT, "exports", "generated-maps.bundle.json");
const GENERATOR_IMPORT = 'import { NATURAL_SOLID_SURVEY_MODEL_VERSION, NATURAL_SOLID_SURVEY_PROVENANCE, naturalSolidFeaturePlan } from "../scripts/natural-solid-cartography.mjs";';
const NATURAL_MODEL_IMPORT = 'import { deriveNaturalSolidProfile } from "./natural-solid-cartography.mjs";';
const ATLAS_IMPORT = 'import { naturalSolidProfileLines, renderNaturalSolidSurvey } from "./natural-solid-atlas-visuals.mjs";';
const PHASE_MARKER = "metadata-conditioned natural surface survey";

function run(command) {
  console.log(`[phase-2] ${command}`);
  execSync(command, { cwd: ROOT, stdio: "inherit" });
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function replaceOnce(source, before, after, label) {
  if (source.includes(after)) return { source, changed: false };
  const count = source.split(before).length - 1;
  assert.equal(count, 1, `${label}: expected exactly one pre-Phase-2 match, found ${count}`);
  return { source: source.replace(before, after), changed: true };
}

function replaceBetween(source, start, end, replacement, label) {
  if (source.includes(replacement.trim().slice(0, 80))) return { source, changed: false };
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex);
  assert.notEqual(startIndex, -1, `${label}: start marker missing`);
  assert.notEqual(endIndex, -1, `${label}: end marker missing`);
  return { source: source.slice(0, startIndex) + replacement + source.slice(endIndex), changed: true };
}

function writeIfChanged(file, original, next) {
  if (next === original) return false;
  fs.writeFileSync(file, next);
  console.log(`[phase-2] patched ${path.relative(ROOT, file)}`);
  return true;
}

function patchSurveyEvidence() {
  const original = fs.readFileSync(NATURAL_SURVEY, "utf8");
  const next = original.replaceAll(", row.settlement_pattern", "");
  if (next === original) return false;
  fs.writeFileSync(NATURAL_SURVEY, next);
  console.log("[phase-2] tightened exploitation evidence: conditional settlement patterns do not create installations");
  return true;
}

function patchGenerator() {
  const original = fs.readFileSync(GENERATOR, "utf8");
  let source = original;
  let result;

  if (!source.includes(GENERATOR_IMPORT)) {
    const anchor = 'import { BODY_OPERATIONS_MODEL_VERSION, BODY_OPERATIONS_SCHEMA_VERSION, BODY_OPERATIONS_STATUS, bodyOperationAssetPath, canonicalRowFingerprint, coordinateFrameForKind, deriveBodyOperationTargets, operationLayerDefinitions, operationSeed, operationalKindForRow, stableUnit } from "../scripts/body-operations.mjs";';
    result = replaceOnce(source, anchor, `${anchor}\n${GENERATOR_IMPORT}`, "generator import"); source = result.source;
  }
  if (!source.includes('scarp:"Scarp"')) {
    result = replaceOnce(source, 'ridge:"Ridge", rift:"Chasma", ice:"Cold Trap"', 'ridge:"Ridge", rift:"Chasma", scarp:"Scarp", volcanic:"Caldera", dune:"Dune Sea", deposit:"Province", ice:"Cold Trap"', "generator terms"); source = result.source;
  }
  if (!source.includes('"rift","scarp","volcanic","dune","storm"')) {
    result = replaceOnce(source, '["crater","basin","ridge","rift","storm","vortex","asteroid","segment"]', '["crater","basin","ridge","rift","scarp","volcanic","dune","storm","vortex","asteroid","segment"]', "generator nameable terrain"); source = result.source;
  }

  const generateNatural = `function generateNatural(asset, row) {
  const add = featureFactory(asset), plan = naturalSolidFeaturePlan(row, asset.permanentOperationalSeed);
  asset.surfaceSurvey = {
    modelVersion: NATURAL_SOLID_SURVEY_MODEL_VERSION,
    provenance: NATURAL_SOLID_SURVEY_PROVENANCE,
    surfaceFamily: plan.profile.surfaceFamily,
    activity: plan.profile.activityLabel,
    craterRetention: plan.profile.craterRetentionLabel,
    volatiles: plan.profile.volatileExpression,
    exploitation: plan.profile.exploitationIndex > 0 ? "established" : "none-established",
    basis: "canonical-metadata+permanent-seed",
  };
  const ids = new Map(), featureStart = asset.features.length;
  for (const spec of plan.features) {
    const id = add(spec.type, spec.layer, spec.position, spec.role, {
      name: spec.name,
      description: spec.description,
      resource: spec.resource,
      hazard: spec.hazard,
      refs: [],
      lodPriority: spec.lodPriority,
      dimensions: spec.dimensions,
      provenance: spec.provenance,
    });
    ids.set(spec.key, id);
  }
  plan.features.forEach((spec, index) => {
    const refs = spec.refKeys.map((key) => ids.get(key)).filter(Boolean);
    if (refs.length) asset.features[featureStart + index].refs = refs;
  });
}
`;
  result = replaceBetween(source, "function generateNatural(asset) {", "function generateGiant(asset) {", generateNatural, "generateNatural"); source = result.source;
  if (source.includes('if(operationalKind==="natural-solid") generateNatural(asset);')) source = source.replace('if(operationalKind==="natural-solid") generateNatural(asset);', 'if(operationalKind==="natural-solid") generateNatural(asset,row);');
  assert.ok(source.includes('if(operationalKind==="natural-solid") generateNatural(asset,row);'), "generator call was not upgraded");
  assert.ok(source.includes(PHASE_MARKER) || source.includes("metadata-conditioned") || source.includes("surfaceSurvey"));
  return writeIfChanged(GENERATOR, original, source);
}

function patchNaturalModel() {
  const original = fs.readFileSync(NATURAL_MODEL, "utf8");
  let source = original;
  if (!source.includes(NATURAL_MODEL_IMPORT)) source = `${NATURAL_MODEL_IMPORT}\n\n${source}`;
  if (!source.includes("const surfaceCharacter =")) {
    const before = '  const temperatureC = number(row, "mean_surface_temp_c", number(row, "operational_temperature_profile", -80));\n  const giant = kind === "giant";';
    const after = '  const temperatureC = number(row, "mean_surface_temp_c", number(row, "operational_temperature_profile", -80));\n  const surfaceCharacter = ["terrestrial", "moon", "minor-world"].includes(kind) ? deriveNaturalSolidProfile(row) : null;\n  const giant = kind === "giant";';
    const patched = replaceOnce(source, before, after, "natural model surface profile"); source = patched.source;
  }
  if (!source.includes('{ type: "surface-family", class: surfaceCharacter.surfaceFamily }')) {
    const replacement = `  const regions = kind === "asteroid-field" ? [
    { type: "asteroid-population", count: 32 + Math.floor(hashUnit(identity) * 25) },
    { type: "extraction-regions", profile: row.resource_profile || row.resources_hazards || "mixed belt resources" },
  ] : giant ? [
    { type: "atmospheric-bands", count: 7 + Math.floor(hashUnit(identity) * 5) },
    { type: "storm-systems", count: 2 + Math.floor(hashUnit(identity + "/storms") * 7) },
    { type: "radiation-zone", severity: row.radiation_hazard_level || row.magnetosphere_radiation || "elevated" },
  ] : [
    { type: "crater-provinces", density: surfaceCharacter.craterRetentionLabel },
    { type: surfaceCharacter.volatilePct >= 4 ? "ice-or-volatile-deposits" : "dry-regolith", coveragePct: surfaceCharacter.volatilePct },
    { type: "surface-family", class: surfaceCharacter.surfaceFamily },
    { type: "geologic-expression", activity: surfaceCharacter.activityLabel },
    { type: "extraction-regions", profile: row.resource_profile || row.resources_hazards || "locally useful mineral provinces" },
  ];
`;
    const patched = replaceBetween(source, '  const regions = kind === "asteroid-field" ? [', "  return {", replacement, "natural model regions"); source = patched.source;
  }
  if (!source.includes("    surfaceCharacter,")) {
    const patched = replaceOnce(source, "    regions,\n    resourceProfile:", "    regions,\n    surfaceCharacter,\n    resourceProfile:", "natural model return"); source = patched.source;
  }
  return writeIfChanged(NATURAL_MODEL, original, source);
}

function patchAtlasVisuals() {
  const original = fs.readFileSync(ATLAS_VISUALS, "utf8");
  let source = original;
  if (!source.includes(ATLAS_IMPORT)) source = `${ATLAS_IMPORT}\n\n${source}`;
  if (!source.includes('asset.operationalKind === "natural-solid") return renderNaturalSolidSurvey')) {
    const patched = replaceOnce(source, '  if (asset.operationalKind === "natural-solid") return renderNaturalSolid(asset, model, frame);', '  if (asset.operationalKind === "natural-solid") return renderNaturalSolidSurvey(asset, model, frame);', "atlas natural renderer delegation"); source = patched.source;
  }
  const oldBlock = `  if (asset.operationalKind === "natural-solid" || asset.operationalKind === "giant") {
    return [
      \`- Visual class: \${model.kind}\`,
      \`- Radius: \${model.radiusKm ?? "unknown"} km\`,
      \`- Composition: \${model.composition ?? "canonically unspecified"}\`,
      \`- Representative temperature: \${model.temperatureC ?? "unknown"} °C\`,
      \`- Atmosphere: \${model.atmosphere ?? "canonically unspecified"}\`,
      \`- Palette: \${model.palette ?? "canonically unspecified"}\`,
      \`- Resource profile: \${model.resourceProfile ?? "canonically unspecified"}\`,
      \`- Radiation profile: \${model.radiationProfile ?? "canonically unspecified"}\`,
    ];
  }`;
  const newBlock = `  if (asset.operationalKind === "natural-solid") return naturalSolidProfileLines(model);
  if (asset.operationalKind === "giant") {
    return [
      \`- Visual class: \${model.kind}\`,
      \`- Radius: \${model.radiusKm ?? "unknown"} km\`,
      \`- Composition: \${model.composition ?? "canonically unspecified"}\`,
      \`- Representative temperature: \${model.temperatureC ?? "unknown"} °C\`,
      \`- Atmosphere: \${model.atmosphere ?? "canonically unspecified"}\`,
      \`- Palette: \${model.palette ?? "canonically unspecified"}\`,
      \`- Resource profile: \${model.resourceProfile ?? "canonically unspecified"}\`,
      \`- Radiation profile: \${model.radiationProfile ?? "canonically unspecified"}\`,
    ];
  }`;
  if (!source.includes('if (asset.operationalKind === "natural-solid") return naturalSolidProfileLines(model);')) {
    const patched = replaceOnce(source, oldBlock, newBlock, "atlas natural profile lines"); source = patched.source;
  }
  return writeIfChanged(ATLAS_VISUALS, original, source);
}

function bodyState() {
  const manifest = readJson(BODY_MANIFEST);
  const files = new Map(manifest.assets.map((entry) => [entry.path, fs.readFileSync(path.join(ROOT, entry.path), "utf8")]));
  return { manifest, files };
}

function atlasState() {
  const bundle = readJson(ATLAS_BUNDLE);
  return { bundle, entries: new Map(bundle.entries.map((entry) => [entry.id, entry])) };
}

function validateBodyPropagation(before, after, firstApplication) {
  assert.equal(after.manifest.targetCount, before.manifest.targetCount, "Phase 2 must preserve body-operation target count");
  const beforeKinds = new Map(before.manifest.assets.map((entry) => [entry.path, entry.operationalKind]));
  const afterKinds = new Map(after.manifest.assets.map((entry) => [entry.path, entry.operationalKind]));
  assert.deepEqual(afterKinds, beforeKinds, "Phase 2 must not reclassify operational targets");
  const naturalPaths = [...afterKinds].filter(([, kind]) => kind === "natural-solid").map(([file]) => file);
  let changedNatural = 0;
  for (const [file, kind] of afterKinds) {
    const prior = before.files.get(file), current = after.files.get(file);
    assert.ok(prior != null && current != null, file);
    if (kind === "natural-solid") {
      if (prior !== current) changedNatural += 1;
      const asset = JSON.parse(current);
      assert.equal(asset.surfaceSurvey?.modelVersion, "orphaned-sun-natural-solid-survey-v1", file);
      assert.ok(asset.features.length >= 7 && asset.features.length <= 64, `${file}: ${asset.features.length}`);
    } else {
      assert.equal(current, prior, `${file}: non-natural operational asset changed during Phase 2`);
    }
  }
  assert.equal(changedNatural, firstApplication ? naturalPaths.length : 0, `Unexpected natural-solid change count ${changedNatural}/${naturalPaths.length}`);
  console.log(`[phase-2] body propagation verified: ${changedNatural}/${naturalPaths.length} natural-solid assets changed; ${afterKinds.size - naturalPaths.length} non-natural assets byte-stable`);
  return naturalPaths.length;
}

function validateAtlasPropagation(before, after, firstApplication, naturalCount) {
  assert.deepEqual(after.bundle.counts, before.bundle.counts, "Phase 2 must preserve atlas counts");
  let changedNatural = 0;
  let stableOther = 0;
  for (const [id, current] of after.entries) {
    const prior = before.entries.get(id);
    assert.ok(prior, id);
    if (current.mapType === "operational" && current.subtype === "natural-solid") {
      if (JSON.stringify(current) !== JSON.stringify(prior)) changedNatural += 1;
    } else {
      assert.deepEqual(current, prior, `${id}: unrelated atlas entry changed during Phase 2`);
      stableOther += 1;
    }
  }
  assert.equal(changedNatural, firstApplication ? naturalCount : 0, `Unexpected natural-solid atlas change count ${changedNatural}/${naturalCount}`);
  console.log(`[phase-2] atlas propagation verified: ${changedNatural}/${naturalCount} natural-solid sheets changed; ${stableOther} unrelated sheets byte-stable`);
}

function summarize(after) {
  const surveys = after.manifest.assets
    .filter((entry) => entry.operationalKind === "natural-solid")
    .map((entry) => JSON.parse(after.files.get(entry.path)).surfaceSurvey);
  const counts = (key) => Object.fromEntries([...new Set(surveys.map((survey) => survey[key]))].sort().map((value) => [value, surveys.filter((survey) => survey[key] === value).length]));
  console.log("[phase-2] surface families: " + JSON.stringify(counts("surfaceFamily")));
  console.log("[phase-2] geologic classes: " + JSON.stringify(counts("activity")));
  console.log("[phase-2] volatile classes: " + JSON.stringify(counts("volatiles")));
  console.log("[phase-2] established exploited surfaces: " + surveys.filter((survey) => survey.exploitation === "established").length + "/" + surveys.length);
}

function main() {
  const beforeBodies = bodyState();
  const beforeAtlas = atlasState();
  const sourceChanged = [patchSurveyEvidence(), patchGenerator(), patchNaturalModel(), patchAtlasVisuals()].some(Boolean);
  console.log(`[phase-2] source migration ${sourceChanged ? "applied" : "already present; validating idempotence"}`);

  run("npm run body-operations:generate");
  run("npm run atlas:snapshot");

  const afterBodies = bodyState();
  const afterAtlas = atlasState();
  const naturalCount = validateBodyPropagation(beforeBodies, afterBodies, sourceChanged);
  validateAtlasPropagation(beforeAtlas, afterAtlas, sourceChanged, naturalCount);
  summarize(afterBodies);

  run("npm test");
  run("npm run body-operations:validate");
  run("npm run body-operations:check");
  run("npm run atlas:snapshot:check");
  console.log("[phase-2] complete: natural-solid atlas references are metadata-conditioned, globally distributed, and deterministically reproducible");
}

main();
