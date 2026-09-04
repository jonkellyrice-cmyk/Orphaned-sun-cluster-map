import assert from "node:assert/strict";
import fs from "node:fs";

const SURVEY = "scripts/natural-solid-cartography.mjs";
const MIGRATION = "tools/generated-maps-phase-2-natural-solid-cartography.mjs";
const TEST = "tests/natural-solid-cartography.test.mjs";

function replaceOnce(source, before, after, label) {
  if (source.includes(after)) return source;
  const count = source.split(before).length - 1;
  assert.equal(count, 1, `${label}: expected one target, found ${count}`);
  return source.replace(before, after);
}

function replaceBetween(source, start, end, replacement, label) {
  if (source.includes(replacement.trim())) return source;
  const a = source.indexOf(start);
  const b = source.indexOf(end, a);
  assert.notEqual(a, -1, `${label}: start not found`);
  assert.notEqual(b, -1, `${label}: end not found`);
  return source.slice(0, a) + replacement + source.slice(b);
}

function update(path, transform) {
  const before = fs.readFileSync(path, "utf8");
  const after = transform(before);
  if (after === before) console.log(`[phase-2-quality] ${path} already tightened`);
  else {
    fs.writeFileSync(path, after);
    console.log(`[phase-2-quality] tightened ${path}`);
  }
}

update(SURVEY, (input) => {
  let source = input;
  const oldExploit = `function exploitationIndex(row) {
  const source = lower(row.current_exploitation, row.infrastructure_profile, row.resource_operations_notes);
  if (!source || /unexploited|no current|none established|no dedicated infrastructure|no permanent infrastructure/.test(source)) return 0;
  if (/major|heavy|industrial|extensive|dense|continuous|primary extraction/.test(source)) return 0.9;
  if (/active|developed|regular|crewed|settled|habitat|refinery|mass driver/.test(source)) return 0.68;
  if (/limited|light|automated|robotic|seasonal|survey|prospecting|occasional/.test(source)) return 0.38;
  return 0.24;
}`;
  const newExploit = `function exploitationIndex(row) {
  const current = lower(row.current_exploitation);
  const infrastructure = lower(row.infrastructure_profile);
  if (!current && !infrastructure) return 0;
  const uncertain = /candidate|possible|plausible|likely|prospect|frontier|no map-established|no dedicated|no permanent|unexploited|none established|no current/.test(current + ";" + infrastructure);
  if (uncertain) return 0;
  const established = current + ";" + infrastructure;
  if (/heavily mined|industrialized|extensive excavations|active industrial|operating mine|established extraction|primary extraction|refiner|mass driver/.test(established)) return 0.9;
  if (/active extraction|automated extraction|regular extraction|crewed mining|permanent mining/.test(established)) return 0.62;
  return 0;
}`;
  source = replaceOnce(source, oldExploit, newExploit, "exploitation evidence");
  source = replaceOnce(source, "      provenance: NATURAL_SOLID_SURVEY_PROVENANCE,", '      provenance: "working-surface-v1",', "feature provenance");
  source = replaceOnce(source, "  const craterCount = Math.round(4 + profile.craterRetentionIndex * 7);", "  const craterCount = Math.round(3 + profile.craterRetentionIndex * 3);", "crater count");
  source = replaceOnce(source, "      lodPriority: i < 2 ? 1 : i < 6 ? 2 : 3,", "      lodPriority: i < 2 ? 1 : i < 4 ? 2 : 3,", "crater LOD");
  source = replaceOnce(source, "      description: `${profile.craterRetentionLabel}; exact landmark geometry is deterministic working canon constrained by body scale and resurfacing state.`,", '      description: "Seeded working geometry constrained by crater retention.",', "crater description");
  source = replaceOnce(source, "  const basinCount = 1 + Math.round(profile.craterRetentionIndex * 1.7);", "  const basinCount = 1 + (profile.craterRetentionIndex >= 0.86 ? 1 : 0);", "basin count");
  source = replaceOnce(source, '      description: "Large impact basin inferred conservatively from an impact-retaining solid surface; exact location and extent are deterministic working canon.",', '      description: "Seeded basin constrained by body scale and surface age.",', "basin description");
  source = replaceOnce(source, "      description: `Broad relief feature consistent with ${profile.activityLabel}; exact trace is deterministic working canon.`,", '      description: "Seeded relief consistent with the activity regime.",', "ridge description");
  source = replaceOnce(source, "  const scarpCount = profile.craterRetentionIndex >= 0.55 ? 2 : 1;", "  const scarpCount = 1;", "scarp count");
  source = replaceOnce(source, '      description: "Regional scarp representing broad mechanically plausible relief rather than a fabricated fine-grained fault network.",', '      description: "Seeded broad scarp; no fine fault network implied.",', "scarp description");
  source = source.replace(/description: `Rifting is permitted by the canonical\/derived activity state \(\$\{profile\.activityLabel\}\); exact geometry is deterministic working canon\.`,/, 'description: "Generated only where activity supports rifting.",');
  source = replaceOnce(source, "  const volcanicCount = /volcan|geothermal|cryovolcan/.test(activityText) || profile.activityIndex >= 0.68 ? (profile.activityIndex >= 0.84 ? 2 : 1) : 0;", "  const volcanicCount = /volcan|geothermal|cryovolcan/.test(activityText) || profile.activityIndex >= 0.68 ? 1 : 0;", "volcanic count");
  source = replaceOnce(source, '      description: "Only generated where activity metadata supports active or geologically young resurfacing; exact center is deterministic working canon.",', '      description: "Generated only where activity supports resurfacing.",', "volcanic description");
  source = replaceOnce(source, "    const duneCount = profile.atmospherePressureAtm >= 0.3 ? 2 : 1;", "    const duneCount = 1;", "dune count");
  source = replaceOnce(source, '        description: "Broad aeolian terrain inferred only because the body has enough atmosphere and a sufficiently dry surface for sustained sediment transport.",', '        description: "Generated only where atmosphere supports aeolian transport.",', "dune description");
  source = source.replace(/description: `\$\{profile\.volatileExpression\}; abundance is constrained by canonical resource\/ice metadata while exact province geometry is deterministic working canon\.`,/, 'description: "Volatile province constrained by canonical abundance.",');
  source = replaceOnce(source, '      description: "Resource-bearing province inferred from canonical material/resource metadata; exact boundary is bounded deterministic working canon.",', '      description: "Resource province constrained by canonical material metadata.",', "deposit description");
  source = replaceOnce(source, '      description: "Hazard zone summarizes an already supported environmental risk; exact local boundary is deterministic working canon.",', '      description: "Localized zone from a supported environmental hazard.",', "hazard description");
  source = replaceOnce(source, 'description: "Surface extraction node is generated only because exploitation/infrastructure metadata indicates active use."', 'description: "Established extraction node."', "mine description");
  source = replaceOnce(source, 'description: "Conservative surface access node associated with established exploitation or infrastructure."', 'description: "Established surface access node."', "landing description");
  source = replaceOnce(source, 'description: "Sealed habitation/logistics presence is supported by the exploitation/infrastructure profile; no open-air habitability is implied."', 'description: "Sealed industrial/logistics habitat; no open-air habitability implied."', "habitat description");
  source = replaceOnce(source, '        description: "Local traverse connecting already-supported surface infrastructure; not a planetwide road network.",', '        description: "Local traverse between established surface nodes.",', "corridor description");
  return source;
});

update(MIGRATION, (input) => {
  let source = input;
  const oldSurveyStart = `  asset.surfaceSurvey = {
    modelVersion: NATURAL_SOLID_SURVEY_MODEL_VERSION,
    provenance: NATURAL_SOLID_SURVEY_PROVENANCE,
    profile: plan.profile,`;
  const oldSurveyEnd = `  };
  const ids = new Map(), featureStart = asset.features.length;`;
  const compactSurvey = `  asset.surfaceSurvey = {
    modelVersion: NATURAL_SOLID_SURVEY_MODEL_VERSION,
    provenance: NATURAL_SOLID_SURVEY_PROVENANCE,
    surfaceFamily: plan.profile.surfaceFamily,
    activity: plan.profile.activityLabel,
    craterRetention: plan.profile.craterRetentionLabel,
    volatiles: plan.profile.volatileExpression,
    exploitation: plan.profile.exploitationIndex > 0 ? "established" : "none-established",
    basis: "canonical-metadata+permanent-seed",
  };
  const ids = new Map(), featureStart = asset.features.length;`;
  if (!source.includes(compactSurvey)) {
    const a = source.indexOf(oldSurveyStart);
    const b = source.indexOf(oldSurveyEnd, a);
    assert.notEqual(a, -1, "migration compact survey start missing");
    assert.notEqual(b, -1, "migration compact survey end missing");
    source = source.slice(0, a) + compactSurvey + source.slice(b + oldSurveyEnd.length);
  }
  const oldValidate = `      assert.equal(asset.surfaceSurvey?.modelVersion, "orphaned-sun-natural-solid-survey-v1", file);
      assert.ok(asset.features.length >= 7 && asset.features.length <= 64, \`${file}: ${asset.features.length}\`);`;
  const newValidate = `      assert.equal(asset.surfaceSurvey?.modelVersion, "orphaned-sun-natural-solid-survey-v1", file);
      assert.ok(asset.features.length >= 7 && asset.features.length <= 64, \`${file}: ${asset.features.length}\`);
      const bytes = Buffer.byteLength(current);
      assert.ok(bytes <= 16 * 1024, \`${file}: ${bytes} bytes exceeds operational asset budget\`);`;
  source = replaceOnce(source, oldValidate, newValidate, "migration asset budget guard");
  return source;
});

update(TEST, (input) => {
  let source = input;
  source = replaceOnce(
    source,
    '    assert.equal(asset.surfaceSurvey?.profile?.modelVersion, NATURAL_SOLID_SURVEY_MODEL_VERSION, entry.path);',
    '    assert.ok(asset.surfaceSurvey?.surfaceFamily, entry.path);\n    assert.ok(asset.surfaceSurvey?.craterRetention, entry.path);',
    "materialized compact survey test",
  );
  if (!source.includes('canonical registry does not promote prospecting language into established industry')) {
    source += `

test("canonical registry does not promote prospecting language into established industry", () => {
  const targetRows = solidRows.filter((row) => row.current_exploitation || row.infrastructure_profile);
  const established = targetRows.filter((row) => deriveNaturalSolidProfile(row).exploitationIndex > 0);
  assert.ok(established.some((row) => row.object === "Old Kestrel"));
  assert.ok(established.length <= 4, \`expected conservative established-industry count, found ${established.length}\`);
  for (const row of targetRows.filter((item) => /candidate|plausible|likely|prospect|no map-established/.test(String(item.current_exploitation + ";" + item.infrastructure_profile).toLowerCase()))) {
    assert.equal(deriveNaturalSolidProfile(row).exploitationIndex, 0, row.object);
  }
});
`;
  }
  return source;
});

console.log("[phase-2-quality] conservative inference and 16 KiB asset-budget tightening complete");
