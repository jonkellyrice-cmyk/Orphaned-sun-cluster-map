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
const STRONG_SHORTLIST = 16;
const SOFT_SHORTLIST = 16;

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
const uvToPixel = ({ u, v }) => ({
  x: round(u * (GM_KIT.width - 1), 3),
  y: round(v * (GM_KIT.height - 1), 3),
});
const nearSeam = (lon, threshold = 20) => Math.abs(Math.abs(wrapLon(lon)) - 180) <= threshold;
const alternateWrapU = (u) => round(u < 0.5 ? u + 1 : u - 1);
const slug = (value) => String(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function canonicalPoint(lat, lon) {
  const normalizedLon = wrapLon(lon);
  const uv = lonLatToUv(lat, normalizedLon);
  const pixel = uvToPixel(uv);
  return {
    lat: Number(lat),
    lon: normalizedLon,
    u: uv.u,
    v: uv.v,
    x: pixel.x,
    y: pixel.y,
    seamAdjacent: nearSeam(normalizedLon),
    wrapU: nearSeam(normalizedLon) ? alternateWrapU(uv.u) : null,
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

function candidate({ id, kind, ref, label, weight, priority, classTag = null, point }) {
  return {
    id,
    kind,
    ref,
    label,
    weight,
    priority,
    class: classTag,
    canonical: canonicalPoint(point[0], point[1]),
    sourceObservation: { status: "pending", u: null, v: null, tolerancePixels: null },
  };
}

function buildCandidatePool(world) {
  const pool = [];

  for (const [index, site] of (world.settlements ?? []).entries()) {
    pool.push(candidate({
      id: `settlement:${index + 1}`,
      kind: "settlement",
      ref: `settlement-${index + 1}`,
      label: site.properName ?? `Settlement ${index + 1}`,
      weight: "hard",
      priority: settlementPriority(site.scaleClass),
      classTag: site.scaleClass ?? null,
      point: [site.lat, site.lon],
    }));
  }

  const strongClasses = new Set(["continent", "island", "lake", "range", "mountain"]);
  for (const [index, feature] of (world.gazetteer ?? []).entries()) {
    if (!strongClasses.has(feature.featureClass) || !Array.isArray(feature.at) || feature.at.length < 2) continue;
    pool.push(candidate({
      id: namedRef("gazetteer", feature, index),
      kind: feature.featureClass,
      ref: feature.id ?? null,
      label: feature.properName ?? feature.scientificClassification ?? `${feature.featureClass} ${index + 1}`,
      weight: "strong",
      priority: gazetteerPriority(feature.featureClass),
      classTag: feature.scientificClassification ?? null,
      point: feature.at,
    }));
  }

  for (const [riverIndex, river] of (world.hydrology?.rivers ?? []).entries()) {
    const points = Array.isArray(river.points) ? river.points : [];
    if (points.length < 2) continue;
    for (const [suffix, point] of [["a", points[0]], ["b", points.at(-1)]]) {
      if (!Array.isArray(point) || point.length < 2) continue;
      pool.push(candidate({
        id: `river:${riverIndex + 1}:endpoint-${suffix}`,
        kind: "river-endpoint",
        ref: river.id ?? `river-${riverIndex + 1}`,
        label: `${river.properName ?? river.id ?? `River ${riverIndex + 1}`} endpoint ${suffix.toUpperCase()}`,
        weight: "soft",
        priority: 44,
        classTag: river.kind ?? river.scientificClassification ?? null,
        point,
      }));
    }
  }

  for (const [routeIndex, route] of (world.transportRoutes ?? []).entries()) {
    const points = Array.isArray(route.points) ? route.points : [];
    if (points.length < 2) continue;
    const point = points[Math.floor(points.length / 2)];
    if (!Array.isArray(point) || point.length < 2) continue;
    pool.push(candidate({
      id: `route:${routeIndex + 1}:midpoint`,
      kind: "transport-corridor-midpoint",
      ref: route.id ?? `route-${routeIndex + 1}`,
      label: route.properName ?? `Transport route ${routeIndex + 1}`,
      weight: "soft",
      priority: route.corridorClass === "trunk" ? 58 : 50,
      classTag: route.corridorClass ?? null,
      point,
    }));
  }

  return pool.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
}

function summarize(items) {
  const byWeight = { hard: 0, strong: 0, soft: 0 };
  const byKind = {};
  let seamAdjacent = 0;
  for (const item of items) {
    byWeight[item.weight] += 1;
    byKind[item.kind] = (byKind[item.kind] ?? 0) + 1;
    if (item.canonical.seamAdjacent) seamAdjacent += 1;
  }
  return { total: items.length, byWeight, byKind, seamAdjacent };
}

function chooseDiverse(items, limit) {
  const sorted = [...items].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  const selected = [];
  const selectedIds = new Set();
  const add = (item) => {
    if (!item || selected.length >= limit || selectedIds.has(item.id)) return;
    selected.push(item);
    selectedIds.add(item.id);
  };

  for (const kind of [...new Set(sorted.map((item) => item.kind))].sort()) add(sorted.find((item) => item.kind === kind));
  for (const item of sorted.filter((item) => item.canonical.seamAdjacent)) add(item);

  for (let bin = 0; bin < 12 && selected.length < limit; bin += 1) {
    const minLon = -180 + bin * 30;
    const maxLon = minLon + 30;
    add(sorted.find((item) => item.canonical.lon >= minLon && (bin === 11 ? item.canonical.lon <= maxLon : item.canonical.lon < maxLon)));
  }

  for (const item of sorted) add(item);
  return selected;
}

function selectRegistrationShortlist(pool) {
  const hard = pool.filter((item) => item.weight === "hard");
  const strong = chooseDiverse(pool.filter((item) => item.weight === "strong"), STRONG_SHORTLIST);
  const soft = chooseDiverse(pool.filter((item) => item.weight === "soft"), SOFT_SHORTLIST);
  return [...hard, ...strong, ...soft].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
}

function buildIntake() {
  const canonicalBytes = fs.readFileSync(CANONICAL_FILE);
  const canonicalSha256 = sha256(canonicalBytes);
  const world = JSON.parse(canonicalBytes.toString("utf8"));
  assert.equal(world.system, SYSTEM, "Unexpected Jinyara system identity.");
  assert.equal(world.body, BODY, "Unexpected Jinyara body identity.");
  assert.equal(world.sourceFingerprint, EXPECTED_FINGERPRINT, "GM Kit attachment no longer matches the current Jinyara source fingerprint.");
  assert.equal(GM_KIT.width, GM_KIT.height * 2, "The approved Jinyara source image must remain exact 2:1.");

  const pool = buildCandidatePool(world);
  const shortlist = selectRegistrationShortlist(pool);
  const poolSummary = summarize(pool);
  const shortlistSummary = summarize(shortlist);

  assert.equal(poolSummary.byWeight.hard, world.settlements.length, "Every Jinyara settlement must enter the candidate pool.");
  assert.equal(shortlistSummary.byWeight.hard, world.settlements.length, "Every Jinyara settlement must remain in the registration shortlist.");
  assert.equal(shortlistSummary.byWeight.strong, STRONG_SHORTLIST, "Strong shortlist size drifted.");
  assert.equal(shortlistSummary.byWeight.soft, SOFT_SHORTLIST, "Soft shortlist size drifted.");
  assert(shortlistSummary.seamAdjacent > 0, "The shortlist needs seam-adjacent coverage.");

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
      projection: { name: "equirectangular", north: "up", east: "right", primeMeridianDeg: 0, seamLongitudeDeg: 180, wrapLongitude: true },
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
      authoringStorage: { provider: "supabase-private-storage", bucket: GM_KIT.bucket, storagePath: GM_KIT.storagePath, runtimeDependencyAllowed: false },
    },
    targetRuntime: { canonicalPath: "assets/body-textures/thebes/jinyara.webp", contentType: "image/webp", projection: "equirectangular", aspectRatio: "2:1", status: "not-baked" },
    anchorPolicy: {
      pool: "all settlements + named continents/islands/lakes/ranges/mountains + river endpoints + route midpoints",
      shortlist: `all hard settlements + ${STRONG_SHORTLIST} spatially distributed strong anchors + ${SOFT_SHORTLIST} spatially distributed soft anchors`,
      expectedPixelsAreObserved: false,
    },
    anchorPoolSummary: poolSummary,
    selectedAnchorSummary: shortlistSummary,
    selectedAnchors: shortlist,
    registrationReadiness: {
      sourceLinked: false,
      registered: false,
      promoted: false,
      blockers: [
        "Compute SHA-256 from the exact private GM Kit attachment bytes via an authenticated authoring-time promotion read.",
        "Measure source-image UV positions for the selected semantic anchors and record tolerances.",
        "Solve and validate the seam-aware registration transform.",
        "Bake and checksum the repository-local WebP runtime derivative.",
      ],
    },
    invariants: [
      "Canonical cartography remains authoritative and unmodified.",
      "The private GM Kit object is authoring provenance only and never a Foundry runtime dependency.",
      "Expected source pixels are initial equirectangular guesses, not observed correspondence points.",
      "No source SHA-256 is invented from storage metadata or ETag values.",
      "No runtime surface-art manifest entry is created until the v1 contract can validate it.",
    ],
  };
}

function buildDoc(intake) {
  const pool = intake.anchorPoolSummary;
  const selected = intake.selectedAnchorSummary;
  return `# Jinyara surface-art intake — Step 2\n\nThis is the deterministic intake bridge between the approved **Lancer GM Kit** illustration and Jinyara's canonical Cluster Map cartography. It stops before private image-byte acquisition or warping.\n\n## Canonical binding\n\n- Body: **${intake.system} / ${intake.body}**\n- Source: \`${intake.canonical.sourcePath}\`\n- Cartography SHA-256: \`${intake.canonical.sourceSha256}\`\n- Source fingerprint: \`${intake.canonical.sourceFingerprint}\`\n- UV frame: equirectangular, north-up, east-right, seam at ±180°\n\n## Exact GM Kit attachment\n\n- Campaign: \`${intake.sourceArtwork.campaignId}\`\n- Entity: \`${intake.sourceArtwork.entityId}\`\n- Attachment: \`${intake.sourceArtwork.attachmentId}\`\n- Source dimensions: ${intake.sourceArtwork.width}×${intake.sourceArtwork.height} (${intake.sourceArtwork.aspectRatio})\n- Source bytes: ${intake.sourceArtwork.bytes}\n- Source SHA-256: **pending authenticated byte acquisition**\n\nThe attachment identity is exact, but Cluster Map has not read the private object bytes. The v1 contract requires a real SHA-256, so this step deliberately does not substitute the storage ETag or any metadata-derived value.\n\n## Registration anchors\n\nThe script audits a full metadata-derived pool of **${pool.total}** candidates (${pool.byWeight.hard} hard / ${pool.byWeight.strong} strong / ${pool.byWeight.soft} soft), but it persists only a bounded **${selected.total}-anchor registration shortlist**:\n\n- ${selected.byWeight.hard} hard — all 18 settlements, preserving superstructure/metropolitan/regional hierarchy\n- ${selected.byWeight.strong} strong — spatially distributed macro-geography from continents, islands, lakes, ranges, and mountains\n- ${selected.byWeight.soft} soft — spatially distributed road midpoints and hydrology endpoints\n- ${selected.seamAdjacent} selected anchors are seam-adjacent and carry an alternate wrapped U coordinate\n\nThe full 211-candidate pool is reproducible from canonical metadata and is therefore not duplicated into committed JSON. Each selected anchor stores canonical latitude/longitude, canonical UV, and an expected pixel location in the 1774×887 source. Expected pixels are initial guesses only; Step 3 replaces them with observed image correspondences.\n\n## Scope boundary\n\nThis step does not modify Jinyara cartography, change the 114-map frozen atlas, add a runtime texture, hide primitive SVG layers, or add elevation/normal/lighting data. \`data/surface-art/manifest.json\` remains unchanged.\n\n## Next gate\n\nStep 3 is authenticated source acquisition + correspondence registration: read the exact private image bytes, compute its SHA-256, measure selected source-image anchors, solve the seam-aware warp, and bake \`${intake.targetRuntime.canonicalPath}\`.\n`;
}

function buildTest() {
  return `import assert from "node:assert/strict";\nimport crypto from "node:crypto";\nimport fs from "node:fs";\nimport test from "node:test";\n\nconst canonicalPath = "data/planet-cartography/thebes/jinyara.json";\nconst intakePath = "data/surface-art/intake/thebes/jinyara.json";\nconst manifestPath = "data/surface-art/manifest.json";\nconst sha256 = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex");\nconst canonicalBytes = fs.readFileSync(canonicalPath);\nconst canonical = JSON.parse(canonicalBytes.toString("utf8"));\nconst intake = JSON.parse(fs.readFileSync(intakePath, "utf8"));\nconst runtimeManifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));\n\ntest("Jinyara intake pins exact canonical cartography identity", () => {\n  assert.equal(intake.system, "Thebes");\n  assert.equal(intake.body, "Jinyara");\n  assert.equal(intake.canonical.sourcePath, canonicalPath);\n  assert.equal(intake.canonical.sourceFingerprint, canonical.sourceFingerprint);\n  assert.equal(intake.canonical.sourceFingerprint, "375d0440032e4c3c4480");\n  assert.equal(intake.canonical.sourceSha256, sha256(canonicalBytes));\n});\n\ntest("Jinyara intake identifies the exact GM Kit attachment without inventing its checksum", () => {\n  assert.equal(intake.sourceArtwork.campaignId, "orphaned-sun-generated-maps");\n  assert.equal(intake.sourceArtwork.entityId, "generated-map-375d0440032e4c3c4480");\n  assert.equal(intake.sourceArtwork.attachmentId, "cb4fdeae-019c-4d5e-b651-2229c4622080");\n  assert.equal(intake.sourceArtwork.bytes, 3829195);\n  assert.equal(intake.sourceArtwork.width, 1774);\n  assert.equal(intake.sourceArtwork.height, 887);\n  assert.equal(intake.sourceArtwork.width, intake.sourceArtwork.height * 2);\n  assert.equal(intake.sourceArtwork.sha256, null);\n  assert.equal(intake.sourceArtwork.checksumStatus, "pending-secure-byte-acquisition");\n  assert.equal(intake.sourceArtwork.authoringStorage.runtimeDependencyAllowed, false);\n});\n\ntest("bounded registration shortlist retains every Jinyara settlement as a hard anchor", () => {\n  const hard = intake.selectedAnchors.filter((item) => item.weight === "hard");\n  assert.equal(canonical.settlements.length, 18);\n  assert.equal(hard.length, canonical.settlements.length);\n  assert.deepEqual(hard.map((item) => item.ref).sort(), canonical.settlements.map((_, index) => \`settlement-\${index + 1}\`).sort());\n  assert(hard.some((item) => item.class === "superstructure"));\n  assert(hard.some((item) => item.class === "metropolitan"));\n  assert(hard.some((item) => item.class === "regional"));\n});\n\ntest("shortlist is deliberately bounded while retaining geography, roads, hydrology, and seam coverage", () => {\n  assert.equal(intake.anchorPoolSummary.total, 211);\n  assert.equal(intake.selectedAnchorSummary.total, 50);\n  assert.equal(intake.selectedAnchorSummary.byWeight.hard, 18);\n  assert.equal(intake.selectedAnchorSummary.byWeight.strong, 16);\n  assert.equal(intake.selectedAnchorSummary.byWeight.soft, 16);\n  assert(intake.selectedAnchorSummary.byKind.island > 0);\n  assert(intake.selectedAnchorSummary.byKind.lake > 0);\n  assert(intake.selectedAnchorSummary.byKind["river-endpoint"] > 0);\n  assert(intake.selectedAnchorSummary.byKind["transport-corridor-midpoint"] > 0);\n  const seam = intake.selectedAnchors.filter((item) => item.canonical.seamAdjacent);\n  assert(seam.length > 0);\n  assert(seam.every((item) => Number.isFinite(item.canonical.wrapU)));\n});\n\ntest("expected source pixels remain projection guesses until image correspondence is measured", () => {\n  for (const item of intake.selectedAnchors) {\n    assert(item.canonical.u >= 0 && item.canonical.u <= 1);\n    assert(item.canonical.v >= 0 && item.canonical.v <= 1);\n    assert(item.canonical.x >= 0 && item.canonical.x <= 1773);\n    assert(item.canonical.y >= 0 && item.canonical.y <= 886);\n    assert.equal(item.sourceObservation.status, "pending");\n    assert.equal(item.sourceObservation.u, null);\n    assert.equal(item.sourceObservation.v, null);\n  }\n});\n\ntest("Step 2 does not falsely promote Jinyara into the runtime surface-art manifest", () => {\n  assert.equal(runtimeManifest.schemaVersion, 1);\n  assert.equal(runtimeManifest.entries.some((entry) => entry.system === "Thebes" && entry.body === "Jinyara"), false);\n  assert.equal(intake.registrationReadiness.sourceLinked, false);\n  assert.equal(intake.registrationReadiness.registered, false);\n  assert.equal(intake.registrationReadiness.promoted, false);\n  assert.equal(intake.targetRuntime.status, "not-baked");\n});\n`;
}

function outputs() {
  const intake = buildIntake();
  return new Map([
    [INTAKE_PATH, `${JSON.stringify(intake, null, 2)}\n`],
    [DOC_PATH, buildDoc(intake)],
    [TEST_PATH, buildTest()],
  ]);
}

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
  console.log(`[jinyara-surface-art-intake] audited ${intake.anchorPoolSummary.total} candidates; persisted bounded shortlist of ${intake.selectedAnchorSummary.total}`);
  console.log(`[jinyara-surface-art-intake] shortlist ${intake.selectedAnchorSummary.byWeight.hard} hard / ${intake.selectedAnchorSummary.byWeight.strong} strong / ${intake.selectedAnchorSummary.byWeight.soft} soft`);
  console.log(`[jinyara-surface-art-intake] canonical SHA-256 ${intake.canonical.sourceSha256}`);
  console.log(`[jinyara-surface-art-intake] source artwork checksum remains ${intake.sourceArtwork.checksumStatus}`);
}

if (process.argv.includes("--apply")) apply();
else if (process.argv.includes("--check")) check();
else throw new Error("Usage: node tools/patch-jinyara-surface-art-intake-v1.mjs --apply|--check");
