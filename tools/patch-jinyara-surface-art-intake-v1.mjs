#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CANONICAL_PATH = "data/planet-cartography/thebes/jinyara.json";
const CANONICAL_FILE = path.join(ROOT, CANONICAL_PATH);
const MANIFEST_FILE = path.join(ROOT, "data/surface-art/manifest.json");
const INTAKE_PATH = "data/surface-art/intake/thebes/jinyara.json";
const DOC_PATH = "docs/jinyara-surface-art-intake.md";
const TEST_PATH = "tests/jinyara-surface-art-intake.test.mjs";
const EXPECTED_FINGERPRINT = "375d0440032e4c3c4480";
const SYSTEM = "Thebes";
const BODY = "Jinyara";

const GM_KIT = Object.freeze({
  provider: "lancer-gm-kit",
  campaignId: "orphaned-sun-generated-maps",
  entityId: "generated-map-375d0440032e4c3c4480",
  attachmentId: "cb4fdeae-019c-4d5e-b651-2229c4622080",
  filename: "image.png",
  contentType: "image/png",
  bytes: 3829195,
  width: 1774,
  height: 887,
  bucket: "lancer-codex-media",
  storagePath: "primary/orphaned-sun-generated-maps/generated-map-375d0440032e4c3c4480/cb4fdeae-019c-4d5e-b651-2229c4622080.png",
});

const sha256 = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex");
const round = (value, digits = 8) => Number(value.toFixed(digits));
const wrapLon = (lon) => {
  const normalized = ((Number(lon) + 180) % 360 + 360) % 360 - 180;
  return Object.is(normalized, -0) ? 0 : normalized;
};
const wrap01 = (value) => ((value % 1) + 1) % 1;
const lonLatToUv = (lat, lon) => ({
  u: round(wrap01((wrapLon(lon) + 180) / 360)),
  v: round((90 - Number(lat)) / 180),
});
const uvToPixel = ({ u, v }, width = GM_KIT.width, height = GM_KIT.height) => ({
  x: round(u * (width - 1), 3),
  y: round(v * (height - 1), 3),
});
const nearSeam = (lon, threshold = 20) => Math.abs(Math.abs(wrapLon(lon)) - 180) <= threshold;
const alternateWrapU = (u) => round(u < 0.5 ? u + 1 : u - 1);
const slug = (value) => String(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function canonicalPoint(lat, lon) {
  const canonical = { lat: Number(lat), lon: wrapLon(lon) };
  const uv = lonLatToUv(canonical.lat, canonical.lon);
  return {
    ...canonical,
    uv,
    sourcePixelExpectation: uvToPixel(uv),
    seamAdjacent: nearSeam(canonical.lon),
    alternateWrapU: nearSeam(canonical.lon) ? alternateWrapU(uv.u) : null,
  };
}

function settlementPriority(scaleClass) {
  return ({ superstructure: 100, metropolitan: 92, regional: 82 }[scaleClass] ?? 76);
}

function gazetteerPriority(featureClass) {
  return ({ continent: 90, island: 76, lake: 72, range: 70, mountain: 62 }[featureClass] ?? 55);
}

function namedRef(prefix, item, index) {
  return `${prefix}:${slug(item.id ?? item.properName ?? item.name ?? index + 1)}`;
}

function buildCandidates(world) {
  const candidates = [];

  for (const [index, settlement] of (world.settlements ?? []).entries()) {
    candidates.push({
      id: `settlement:${index + 1}`,
      featureKind: "settlement",
      featureRef: `settlement-${index + 1}`,
      label: settlement.properName ?? `Settlement ${index + 1}`,
      weightClass: "hard",
      priority: settlementPriority(settlement.scaleClass),
      reason: "Visible inhabited structure; settlement coordinates remain canonical even when painted footprint is exaggerated.",
      metadata: {
        role: settlement.role ?? null,
        kind: settlement.kind ?? null,
        scaleClass: settlement.scaleClass ?? null,
      },
      canonical: canonicalPoint(settlement.lat, settlement.lon),
      sourceObservation: { status: "pending", u: null, v: null, tolerancePixels: null },
    });
  }

  const strongClasses = new Set(["continent", "island", "lake", "range", "mountain"]);
  for (const [index, feature] of (world.gazetteer ?? []).entries()) {
    if (!strongClasses.has(feature.featureClass)) continue;
    if (!Array.isArray(feature.at) || feature.at.length < 2) continue;
    candidates.push({
      id: namedRef("gazetteer", feature, index),
      featureKind: feature.featureClass,
      featureRef: feature.id ?? null,
      label: feature.properName ?? feature.scientificClassification ?? `${feature.featureClass} ${index + 1}`,
      weightClass: "strong",
      priority: gazetteerPriority(feature.featureClass),
      reason: "Named macro-geographic feature expected to remain visually recoverable after illustration.",
      metadata: { scientificClassification: feature.scientificClassification ?? null },
      canonical: canonicalPoint(feature.at[0], feature.at[1]),
      sourceObservation: { status: "pending", u: null, v: null, tolerancePixels: null },
    });
  }

  for (const [riverIndex, river] of (world.hydrology?.rivers ?? []).entries()) {
    const points = Array.isArray(river.points) ? river.points : [];
    if (points.length < 2) continue;
    const endpoints = [["a", points[0]], ["b", points.at(-1)]];
    for (const [endpoint, point] of endpoints) {
      if (!Array.isArray(point) || point.length < 2) continue;
      candidates.push({
        id: `river:${riverIndex + 1}:endpoint-${endpoint}`,
        featureKind: "river-endpoint",
        featureRef: river.id ?? `river-${riverIndex + 1}`,
        label: `${river.properName ?? river.id ?? `River ${riverIndex + 1}`} endpoint ${endpoint.toUpperCase()}`,
        weightClass: "soft",
        priority: 44,
        reason: "Hydrology endpoint helps keep drainage placement coherent without overpowering city and macro-geography anchors.",
        metadata: { riverKind: river.kind ?? river.scientificClassification ?? null },
        canonical: canonicalPoint(point[0], point[1]),
        sourceObservation: { status: "pending", u: null, v: null, tolerancePixels: null },
      });
    }
  }

  for (const [routeIndex, route] of (world.transportRoutes ?? []).entries()) {
    const points = Array.isArray(route.points) ? route.points : [];
    if (points.length < 2) continue;
    const point = points[Math.floor(points.length / 2)];
    if (!Array.isArray(point) || point.length < 2) continue;
    candidates.push({
      id: `route:${routeIndex + 1}:midpoint`,
      featureKind: "transport-corridor-midpoint",
      featureRef: route.id ?? `route-${routeIndex + 1}`,
      label: route.properName ?? `Transport route ${routeIndex + 1}`,
      weightClass: "soft",
      priority: route.corridorClass === "trunk" ? 58 : 50,
      reason: "A single corridor midpoint gives the future warp road-awareness while settlement endpoints remain the controlling anchors.",
      metadata: {
        corridorClass: route.corridorClass ?? null,
        routingDoctrine: route.routingDoctrine ?? null,
        from: route.from ?? null,
        to: route.to ?? null,
      },
      canonical: canonicalPoint(point[0], point[1]),
      sourceObservation: { status: "pending", u: null, v: null, tolerancePixels: null },
    });
  }

  candidates.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  return candidates;
}

function summarize(candidates) {
  const byWeight = { hard: 0, strong: 0, soft: 0 };
  const byKind = {};
  let seamAdjacent = 0;
  for (const candidate of candidates) {
    byWeight[candidate.weightClass] += 1;
    byKind[candidate.featureKind] = (byKind[candidate.featureKind] ?? 0) + 1;
    if (candidate.canonical.seamAdjacent) seamAdjacent += 1;
  }
  return { total: candidates.length, byWeight, byKind, seamAdjacent };
}

function buildIntake() {
  const canonicalBytes = fs.readFileSync(CANONICAL_FILE);
  const canonicalSha256 = sha256(canonicalBytes);
  const world = JSON.parse(canonicalBytes.toString("utf8"));
  assert.equal(world.system, SYSTEM, "Unexpected Jinyara system identity.");
  assert.equal(world.body, BODY, "Unexpected Jinyara body identity.");
  assert.equal(world.sourceFingerprint, EXPECTED_FINGERPRINT, "GM Kit attachment no longer matches the current Jinyara source fingerprint.");
  assert.equal(GM_KIT.width, GM_KIT.height * 2, "The approved Jinyara source image must remain exact 2:1.");

  const candidates = buildCandidates(world);
  const summary = summarize(candidates);
  assert.equal(summary.byWeight.hard, world.settlements.length, "Every Jinyara settlement must become a hard anchor candidate.");
  assert(summary.byWeight.strong > 0, "Jinyara requires strong macro-geographic anchor candidates.");
  assert(summary.byWeight.soft > 0, "Jinyara requires soft hydrology/route anchor candidates.");
  assert(summary.seamAdjacent > 0, "Jinyara needs explicit seam-adjacent candidates.");

  return {
    schemaVersion: 1,
    artifactKind: "surface-art-intake",
    contractId: "orphaned-sun.surface-art-registration.v1",
    stage: "anchor-candidate-intake",
    system: SYSTEM,
    body: BODY,
    canonical: {
      authority: "jonkellyrice-cmyk/Orphaned-sun-cluster-map",
      sourcePath: CANONICAL_PATH,
      sourceSha256: canonicalSha256,
      sourceFingerprint: world.sourceFingerprint,
      projection: {
        name: "equirectangular",
        north: "up",
        east: "right",
        primeMeridianDeg: 0,
        seamLongitudeDeg: 180,
        wrapLongitude: true,
      },
    },
    sourceArtwork: {
      provider: GM_KIT.provider,
      campaignId: GM_KIT.campaignId,
      entityId: GM_KIT.entityId,
      attachmentId: GM_KIT.attachmentId,
      filename: GM_KIT.filename,
      contentType: GM_KIT.contentType,
      bytes: GM_KIT.bytes,
      width: GM_KIT.width,
      height: GM_KIT.height,
      aspectRatio: "2:1",
      sha256: null,
      checksumStatus: "pending-secure-byte-acquisition",
      logicalRef: `lancer-gm-kit://${GM_KIT.campaignId}/${GM_KIT.entityId}/${GM_KIT.attachmentId}`,
      authoringStorage: {
        provider: "supabase-private-storage",
        bucket: GM_KIT.bucket,
        storagePath: GM_KIT.storagePath,
        runtimeDependencyAllowed: false,
      },
    },
    targetRuntime: {
      canonicalPath: "assets/body-textures/thebes/jinyara.webp",
      contentType: "image/webp",
      projection: "equirectangular",
      aspectRatio: "2:1",
      status: "not-baked",
    },
    anchorCandidates: candidates,
    candidateSummary: summary,
    registrationReadiness: {
      sourceLinked: false,
      registered: false,
      promoted: false,
      blockers: [
        "Compute SHA-256 from the exact private GM Kit attachment bytes via an authenticated authoring-time promotion read.",
        "Measure source-image UV positions for selected semantic anchors and record tolerances.",
        "Solve and validate the seam-aware registration transform.",
        "Bake and checksum the repository-local WebP runtime derivative.",
      ],
    },
    invariants: [
      "Canonical cartography remains authoritative and unmodified.",
      "The private GM Kit object is authoring provenance only and must never become a Foundry runtime dependency.",
      "Expected source pixels are initial equirectangular guesses, not observed correspondence points.",
      "No source SHA-256 is invented from storage metadata or ETag values.",
      "No runtime surface-art manifest entry is created until the v1 contract can validate it.",
    ],
  };
}

function buildDoc(intake) {
  const summary = intake.candidateSummary;
  return `# Jinyara surface-art intake — Step 2\n\nThis artifact is the deterministic bridge between the approved **Lancer GM Kit** illustration and Jinyara's canonical Cluster Map cartography. It deliberately stops before image-byte acquisition or warping.\n\n## Canonical binding\n\n- Cluster Map body: **${intake.system} / ${intake.body}**\n- Cartography source: \`${intake.canonical.sourcePath}\`\n- Cartography SHA-256: \`${intake.canonical.sourceSha256}\`\n- Source fingerprint: \`${intake.canonical.sourceFingerprint}\`\n- Target UV frame: equirectangular, north-up, east-right, seam at ±180°\n\n## Approved GM Kit source\n\n- Campaign: \`${intake.sourceArtwork.campaignId}\`\n- Entity: \`${intake.sourceArtwork.entityId}\`\n- Attachment: \`${intake.sourceArtwork.attachmentId}\`\n- Source dimensions: ${intake.sourceArtwork.width}×${intake.sourceArtwork.height} (${intake.sourceArtwork.aspectRatio})\n- Source bytes: ${intake.sourceArtwork.bytes}\n- Source SHA-256: **pending authenticated byte acquisition**\n\nThe exact attachment identity is known, but the private storage object has not been read by this repository. The v1 contract requires a real SHA-256 of the image bytes, so this step explicitly refuses to substitute an ETag or storage metadata hash.\n\n## Anchor candidate pack\n\nThe one-off patch derives **${summary.total}** deterministic semantic candidates directly from committed Jinyara metadata:\n\n- hard: ${summary.byWeight.hard} — every settlement, with superstructure/metropolitan/regional hierarchy preserved\n- strong: ${summary.byWeight.strong} — named continents, islands, lakes, ranges, and mountains\n- soft: ${summary.byWeight.soft} — river endpoints and one midpoint for each transport corridor\n- seam-adjacent: ${summary.seamAdjacent} candidates carry an alternate wrapped U coordinate\n\nEvery candidate stores canonical latitude/longitude, canonical UV, and the expected pixel location in the 1774×887 source image. Those expected pixels are only starting guesses. The next registration step must replace a selected subset with **observed** source-image UV coordinates before a transform is solved.\n\n## What this step does not do\n\nIt does not modify Jinyara's canonical cartography, does not change the 114-map frozen atlas, does not add a runtime texture, does not hide primitive SVG layers, and does not add elevation/normal/lighting data. \`data/surface-art/manifest.json\` remains the runtime promotion authority and intentionally receives no Jinyara entry yet.\n\n## Next gate\n\nStep 3 can begin once the exact private attachment bytes are acquired through an authenticated authoring-time bridge. That step can compute the source checksum, observe selected anchors, solve the seam-aware warp, and bake \`${intake.targetRuntime.canonicalPath}\`.\n`;
}

function buildTest() {
  return `import assert from "node:assert/strict";\nimport crypto from "node:crypto";\nimport fs from "node:fs";\nimport test from "node:test";\n\nconst canonicalPath = "data/planet-cartography/thebes/jinyara.json";\nconst intakePath = "data/surface-art/intake/thebes/jinyara.json";\nconst manifestPath = "data/surface-art/manifest.json";\nconst sha256 = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex");\nconst canonicalBytes = fs.readFileSync(canonicalPath);\nconst canonical = JSON.parse(canonicalBytes.toString("utf8"));\nconst intake = JSON.parse(fs.readFileSync(intakePath, "utf8"));\nconst runtimeManifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));\n\ntest("Jinyara intake pins exact canonical cartography identity", () => {\n  assert.equal(intake.system, "Thebes");\n  assert.equal(intake.body, "Jinyara");\n  assert.equal(intake.canonical.sourcePath, canonicalPath);\n  assert.equal(intake.canonical.sourceFingerprint, canonical.sourceFingerprint);\n  assert.equal(intake.canonical.sourceFingerprint, "375d0440032e4c3c4480");\n  assert.equal(intake.canonical.sourceSha256, sha256(canonicalBytes));\n});\n\ntest("Jinyara intake identifies the exact GM Kit attachment without inventing its checksum", () => {\n  assert.equal(intake.sourceArtwork.campaignId, "orphaned-sun-generated-maps");\n  assert.equal(intake.sourceArtwork.entityId, "generated-map-375d0440032e4c3c4480");\n  assert.equal(intake.sourceArtwork.attachmentId, "cb4fdeae-019c-4d5e-b651-2229c4622080");\n  assert.equal(intake.sourceArtwork.bytes, 3829195);\n  assert.equal(intake.sourceArtwork.width, 1774);\n  assert.equal(intake.sourceArtwork.height, 887);\n  assert.equal(intake.sourceArtwork.width, intake.sourceArtwork.height * 2);\n  assert.equal(intake.sourceArtwork.sha256, null);\n  assert.equal(intake.sourceArtwork.checksumStatus, "pending-secure-byte-acquisition");\n  assert.equal(intake.sourceArtwork.authoringStorage.runtimeDependencyAllowed, false);\n});\n\ntest("all 18 Jinyara settlements are hard semantic anchor candidates", () => {\n  const hard = intake.anchorCandidates.filter((item) => item.weightClass === "hard");\n  assert.equal(canonical.settlements.length, 18);\n  assert.equal(hard.length, canonical.settlements.length);\n  assert.deepEqual(hard.map((item) => item.featureRef).sort(), canonical.settlements.map((_, index) => \`settlement-\${index + 1}\`).sort());\n  assert(hard.some((item) => item.metadata.scaleClass === "superstructure"));\n  assert(hard.some((item) => item.metadata.scaleClass === "metropolitan"));\n  assert(hard.some((item) => item.metadata.scaleClass === "regional"));\n});\n\ntest("anchor candidate pack includes macro geography, hydrology, roads, and seam handling", () => {\n  assert(intake.candidateSummary.byWeight.strong > 0);\n  assert(intake.candidateSummary.byWeight.soft > 0);\n  assert(intake.candidateSummary.byKind.island > 0);\n  assert(intake.candidateSummary.byKind.lake > 0);\n  assert(intake.candidateSummary.byKind["river-endpoint"] > 0);\n  assert.equal(intake.candidateSummary.byKind["transport-corridor-midpoint"], canonical.transportRoutes.length);\n  const seam = intake.anchorCandidates.filter((item) => item.canonical.seamAdjacent);\n  assert(seam.length > 0);\n  assert(seam.every((item) => Number.isFinite(item.canonical.alternateWrapU)));\n});\n\ntest("expected source pixels are deterministic projection guesses, not observed anchors", () => {\n  for (const item of intake.anchorCandidates) {\n    assert(item.canonical.uv.u >= 0 && item.canonical.uv.u <= 1);\n    assert(item.canonical.uv.v >= 0 && item.canonical.uv.v <= 1);\n    assert(item.canonical.sourcePixelExpectation.x >= 0 && item.canonical.sourcePixelExpectation.x <= 1773);\n    assert(item.canonical.sourcePixelExpectation.y >= 0 && item.canonical.sourcePixelExpectation.y <= 886);\n    assert.equal(item.sourceObservation.status, "pending");\n    assert.equal(item.sourceObservation.u, null);\n    assert.equal(item.sourceObservation.v, null);\n  }\n});\n\ntest("Step 2 does not falsely promote Jinyara into the runtime surface-art manifest", () => {\n  assert.equal(runtimeManifest.schemaVersion, 1);\n  assert.equal(runtimeManifest.entries.some((entry) => entry.system === "Thebes" && entry.body === "Jinyara"), false);\n  assert.equal(intake.registrationReadiness.sourceLinked, false);\n  assert.equal(intake.registrationReadiness.registered, false);\n  assert.equal(intake.registrationReadiness.promoted, false);\n  assert.equal(intake.targetRuntime.status, "not-baked");\n});\n`;
}

const outputs = () => {
  const intake = buildIntake();
  return new Map([
    [INTAKE_PATH, `${JSON.stringify(intake, null, 2)}\n`],
    [DOC_PATH, buildDoc(intake)],
    [TEST_PATH, buildTest()],
  ]);
};

function apply() {
  for (const [relative, content] of outputs()) {
    const absolute = path.join(ROOT, relative);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, content);
    console.log(`[jinyara-surface-art-intake] wrote ${relative}`);
  }
}

function check() {
  const expected = outputs();
  for (const [relative, content] of expected) {
    const absolute = path.join(ROOT, relative);
    assert(fs.existsSync(absolute), `${relative} is missing; run with --apply.`);
    assert.equal(fs.readFileSync(absolute, "utf8"), content, `${relative} is stale; run with --apply.`);
  }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, "utf8"));
  assert.equal(manifest.entries.some((entry) => entry.system === SYSTEM && entry.body === BODY), false, "Step 2 must not promote Jinyara.");
  const intake = JSON.parse(expected.get(INTAKE_PATH));
  console.log(`[jinyara-surface-art-intake] verified ${intake.candidateSummary.total} candidates (${intake.candidateSummary.byWeight.hard} hard / ${intake.candidateSummary.byWeight.strong} strong / ${intake.candidateSummary.byWeight.soft} soft)`);
  console.log(`[jinyara-surface-art-intake] canonical SHA-256 ${intake.canonical.sourceSha256}`);
  console.log(`[jinyara-surface-art-intake] source artwork checksum remains ${intake.sourceArtwork.checksumStatus}`);
}

if (process.argv.includes("--apply")) apply();
else if (process.argv.includes("--check")) check();
else throw new Error("Usage: node tools/patch-jinyara-surface-art-intake-v1.mjs --apply|--check");
