#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APPLY = process.argv.includes("--apply");
const CHECK = process.argv.includes("--check");
if (APPLY === CHECK) throw new Error("Use exactly one of --apply or --check.");

const CONTRACT_MODULE = `export const SURFACE_ART_REGISTRATION_SCHEMA_VERSION = 1;
export const SURFACE_ART_REGISTRATION_CONTRACT_ID = "orphaned-sun.surface-art-registration.v1";
export const SURFACE_ART_AUTHORITY_REPOSITORY = "jonkellyrice-cmyk/Orphaned-sun-cluster-map";
export const SURFACE_ART_SOURCE_REPOSITORY = "jonkellyrice-cmyk/Lancer-GM-Kit";
export const SURFACE_ART_RUNTIME_POLICY = "repository-local-promoted-assets-only";
export const SURFACE_ART_STAGES = Object.freeze(["source-linked", "registered", "promoted"]);
export const SURFACE_ART_ANCHOR_TIERS = Object.freeze(["hard", "strong", "soft"]);

export const SURFACE_ART_TARGET_PROJECTION = Object.freeze({
  type: "equirectangular",
  widthToHeightRatio: 2,
  latitudeDomainDeg: "[-90,90]",
  longitudeDomainDeg: "[-180,180)",
  northUp: true,
  eastRight: true,
  primeMeridianDeg: 0,
  seamLongitudeDeg: 180,
  seamPolicy: "wrap-longitude",
  uvConvention: "u=(wrap(lon)+180)/360; v=(90-lat)/180",
});

const SHA256_RE = /^[0-9a-f]{64}$/;
const FINGERPRINT_RE = /^[0-9a-f]{20}$/;
const IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const STAGES = new Set(SURFACE_ART_STAGES);
const ANCHOR_TIERS = new Set(SURFACE_ART_ANCHOR_TIERS);
const fail = (message) => { throw new TypeError(\`[surface-art-registration] \${message}\`); };
const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const finite = (value) => typeof value === "number" && Number.isFinite(value);
const positiveInt = (value) => Number.isInteger(value) && value > 0;
const slug = (value) => String(value ?? "").normalize("NFKD").replace(/[\\u0300-\\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function surfaceArtBodyKey(system, body) {
  if (!String(system ?? "").trim() || !String(body ?? "").trim()) fail("system and body are required");
  return \`\${slug(system)}--\${slug(body)}\`;
}

export function canonicalCartographyPath(system, body) {
  return \`data/planet-cartography/\${slug(system)}/\${slug(body)}.json\`;
}

export function wrapLongitudeDeg(value) {
  if (!finite(value)) fail("longitude must be a finite number");
  return ((value + 180) % 360 + 360) % 360 - 180;
}

export function canonicalUvForLatLon(latDeg, lonDeg) {
  if (!finite(latDeg) || latDeg < -90 || latDeg > 90) fail("latitude must be within [-90,90]");
  const lon = wrapLongitudeDeg(lonDeg);
  return { u: (lon + 180) / 360, v: (90 - latDeg) / 180 };
}

function validateCanonical(canonical, entry) {
  if (!isObject(canonical)) fail(\`\${entry.id}: canonical source binding is required\`);
  const expectedPath = canonicalCartographyPath(entry.system, entry.body);
  if (canonical.cartographyPath !== expectedPath) fail(\`\${entry.id}: canonical cartographyPath must be \${expectedPath}\`);
  if (!SHA256_RE.test(canonical.sourceSha256 ?? "")) fail(\`\${entry.id}: canonical sourceSha256 must be a lowercase SHA-256\`);
  if (!FINGERPRINT_RE.test(canonical.sourceFingerprint ?? "")) fail(\`\${entry.id}: canonical sourceFingerprint must be a 20-character lowercase hex fingerprint\`);
  if (canonical.projection !== "equirectangular") fail(\`\${entry.id}: canonical projection must be equirectangular\`);
}

function validateSourceArtwork(sourceArtwork, entry) {
  if (!isObject(sourceArtwork)) fail(\`\${entry.id}: sourceArtwork is required\`);
  if (sourceArtwork.authority !== "lancer-gm-kit") fail(\`\${entry.id}: source artwork authority must be lancer-gm-kit\`);
  if (sourceArtwork.repository !== SURFACE_ART_SOURCE_REPOSITORY) fail(\`\${entry.id}: source artwork repository must be \${SURFACE_ART_SOURCE_REPOSITORY}\`);
  if (typeof sourceArtwork.logicalRef !== "string" || !sourceArtwork.logicalRef.trim()) fail(\`\${entry.id}: sourceArtwork.logicalRef is required\`);
  if (/^https?:\\/\\//i.test(sourceArtwork.logicalRef)) fail(\`\${entry.id}: sourceArtwork.logicalRef must be stable logical metadata, not a runtime URL\`);
  if (!SHA256_RE.test(sourceArtwork.sha256 ?? "")) fail(\`\${entry.id}: source artwork sha256 must be a lowercase SHA-256\`);
  if (!IMAGE_MIME_TYPES.has(sourceArtwork.mimeType)) fail(\`\${entry.id}: unsupported source artwork mimeType\`);
  if (!positiveInt(sourceArtwork.widthPx) || !positiveInt(sourceArtwork.heightPx)) fail(\`\${entry.id}: source artwork dimensions must be positive integers\`);
}

function validateProjection(targetProjection, entry) {
  if (!isObject(targetProjection)) fail(\`\${entry.id}: targetProjection is required\`);
  for (const [key, value] of Object.entries(SURFACE_ART_TARGET_PROJECTION)) {
    if (targetProjection[key] !== value) fail(\`\${entry.id}: targetProjection.\${key} must equal \${JSON.stringify(value)}\`);
  }
}

function validateRegistration(registration, entry) {
  if (!isObject(registration)) fail(\`\${entry.id}: registration is required at stage \${entry.stage}\`);
  if (registration.method !== "seam-aware-anchor-warp") fail(\`\${entry.id}: registration.method must be seam-aware-anchor-warp\`);
  if (!positiveInt(registration.algorithmVersion)) fail(\`\${entry.id}: registration.algorithmVersion must be a positive integer\`);
  if (registration.seamPolicy !== "wrap-longitude") fail(\`\${entry.id}: registration.seamPolicy must be wrap-longitude\`);
  if (registration.deformationPolicy !== "anchor-weighted-low-information-sinks") fail(\`\${entry.id}: unsupported registration.deformationPolicy\`);
  if (!Array.isArray(registration.anchors) || registration.anchors.length < 3) fail(\`\${entry.id}: registration requires at least three anchors\`);
  const ids = new Set();
  for (const anchor of registration.anchors) {
    if (!isObject(anchor) || typeof anchor.id !== "string" || !anchor.id.trim()) fail(\`\${entry.id}: every anchor needs an id\`);
    if (ids.has(anchor.id)) fail(\`\${entry.id}: duplicate anchor id \${anchor.id}\`);
    ids.add(anchor.id);
    if (typeof anchor.featureRef !== "string" || !anchor.featureRef.trim()) fail(\`\${entry.id}/\${anchor.id}: featureRef is required\`);
    if (typeof anchor.featureClass !== "string" || !anchor.featureClass.trim()) fail(\`\${entry.id}/\${anchor.id}: featureClass is required\`);
    if (!ANCHOR_TIERS.has(anchor.tier)) fail(\`\${entry.id}/\${anchor.id}: anchor tier must be hard, strong, or soft\`);
    if (!finite(anchor.weight) || anchor.weight <= 0 || anchor.weight > 1) fail(\`\${entry.id}/\${anchor.id}: weight must be in (0,1]\`);
    if (!isObject(anchor.canonical) || !finite(anchor.canonical.latDeg) || anchor.canonical.latDeg < -90 || anchor.canonical.latDeg > 90 || !finite(anchor.canonical.lonDeg)) {
      fail(\`\${entry.id}/\${anchor.id}: canonical lat/lon is invalid\`);
    }
    if (!isObject(anchor.sourceUv) || !finite(anchor.sourceUv.u) || !finite(anchor.sourceUv.v) || anchor.sourceUv.u < 0 || anchor.sourceUv.u > 1 || anchor.sourceUv.v < 0 || anchor.sourceUv.v > 1) {
      fail(\`\${entry.id}/\${anchor.id}: sourceUv must be normalized to [0,1]\`);
    }
  }
  if (registration.quality != null) {
    if (!isObject(registration.quality)) fail(\`\${entry.id}: registration.quality must be an object\`);
    for (const key of ["rmsAnchorErrorPx", "maxAnchorErrorPx"]) {
      if (registration.quality[key] != null && (!finite(registration.quality[key]) || registration.quality[key] < 0)) fail(\`\${entry.id}: registration.quality.\${key} must be non-negative\`);
    }
  }
}

function validateRuntimeTexture(runtimeTexture, entry) {
  if (!isObject(runtimeTexture)) fail(\`\${entry.id}: runtimeTexture is required at promoted stage\`);
  if (runtimeTexture.format !== "webp") fail(\`\${entry.id}: runtimeTexture.format must be webp\`);
  if (typeof runtimeTexture.repositoryPath !== "string" || !/^assets\\/body-textures\\/[a-z0-9/_-]+\\.webp$/.test(runtimeTexture.repositoryPath)) {
    fail(\`\${entry.id}: runtime texture must be a repository-local assets/body-textures/*.webp path\`);
  }
  if (!positiveInt(runtimeTexture.widthPx) || !positiveInt(runtimeTexture.heightPx) || runtimeTexture.widthPx !== runtimeTexture.heightPx * 2) {
    fail(\`\${entry.id}: runtime texture must be an exact 2:1 equirectangular image\`);
  }
  if (!SHA256_RE.test(runtimeTexture.sha256 ?? "")) fail(\`\${entry.id}: runtime texture sha256 must be a lowercase SHA-256\`);
}

export function validateSurfaceArtRegistration(value, { requirePromoted = false } = {}) {
  if (!isObject(value)) fail("registration entry must be an object");
  const entry = value;
  if (entry.schemaVersion !== SURFACE_ART_REGISTRATION_SCHEMA_VERSION) fail("unsupported registration schemaVersion");
  if (entry.contractId !== SURFACE_ART_REGISTRATION_CONTRACT_ID) fail("unsupported registration contractId");
  if (typeof entry.system !== "string" || !entry.system.trim() || typeof entry.body !== "string" || !entry.body.trim()) fail("registration system/body are required");
  if (entry.id !== surfaceArtBodyKey(entry.system, entry.body)) fail(\`\${entry.system}/\${entry.body}: id must equal canonical body key\`);
  if (!STAGES.has(entry.stage)) fail(\`\${entry.id}: unsupported stage\`);
  if (requirePromoted && entry.stage !== "promoted") fail(\`\${entry.id}: runtime manifest entries must be promoted\`);
  validateCanonical(entry.canonical, entry);
  validateSourceArtwork(entry.sourceArtwork, entry);
  validateProjection(entry.targetProjection, entry);
  if (entry.stage === "registered" || entry.stage === "promoted") validateRegistration(entry.registration, entry);
  if (entry.stage === "promoted") validateRuntimeTexture(entry.runtimeTexture, entry);
  if (!isObject(entry.provenance) || typeof entry.provenance.promotionTool !== "string" || !entry.provenance.promotionTool.trim()) fail(\`\${entry.id}: provenance.promotionTool is required\`);
  return entry;
}

export function validateSurfaceArtManifest(value, { requirePromoted = true } = {}) {
  if (!isObject(value)) fail("surface-art manifest must be an object");
  if (value.schemaVersion !== SURFACE_ART_REGISTRATION_SCHEMA_VERSION) fail("manifest schemaVersion mismatch");
  if (value.contractId !== SURFACE_ART_REGISTRATION_CONTRACT_ID) fail("manifest contractId mismatch");
  if (value.authority !== SURFACE_ART_AUTHORITY_REPOSITORY) fail("manifest authority mismatch");
  if (value.runtimePolicy !== SURFACE_ART_RUNTIME_POLICY) fail("manifest runtimePolicy mismatch");
  if (!Array.isArray(value.entries)) fail("manifest entries must be an array");
  const ids = new Set();
  for (const entry of value.entries) {
    validateSurfaceArtRegistration(entry, { requirePromoted });
    if (ids.has(entry.id)) fail(\`manifest repeats \${entry.id}\`);
    ids.add(entry.id);
  }
  return value;
}
`;

const MANIFEST = `${JSON.stringify({
  schemaVersion: 1,
  contractId: "orphaned-sun.surface-art-registration.v1",
  authority: "jonkellyrice-cmyk/Orphaned-sun-cluster-map",
  runtimePolicy: "repository-local-promoted-assets-only",
  entries: [],
}, null, 2)}\n`;

const DOC = `# Illustrated surface art promotion / registration contract v1

This contract defines the return path for approved planetary illustrations created from Cluster Map cartography and stored in the Lancer GM Kit.

## Authority boundary

- **Cluster Map remains authoritative for geography.** Canonical latitude/longitude, settlements, transport routes, hydrology, gazetteer features, primitive SVG generation, and the cartography JSON are never rewritten to match a painting.
- **The Lancer GM Kit remains authoritative for the approved source illustration.** The source artwork is identified by stable logical metadata plus a SHA-256, never by a temporary signed URL.
- **Foundry runtime uses only a repository-local promoted derivative.** The module does not fetch private GM Kit/Supabase media while players are using the map.
- The primitive SVG/reference-map pipeline remains intact. Promotion changes only the future player-facing surface renderer for bodies that have a promoted texture.

## Lifecycle

A registration record has one of three stages:

1. \`source-linked\` — the approved GM Kit master has been bound to an exact canonical cartography source.
2. \`registered\` — at least three seam-aware anchor correspondences have been established from source-art UV coordinates to canonical latitude/longitude.
3. \`promoted\` — a baked, exact 2:1 WebP derivative exists under \`assets/body-textures/\` and is safe for runtime use.

The runtime manifest accepts only \`promoted\` entries. Intermediate records may be created by one-off tooling during later steps, but they do not become runtime authority.

## Canonical binding

Each entry is pinned to both:

- the exact \`data/planet-cartography/<system>/<body>.json\` path;
- its SHA-256 as used by the Generated Maps export;
- its 20-character source fingerprint.

A changed canonical source therefore invalidates a stale promotion instead of silently applying old artwork to new geography.

## Projection contract

The promoted texture target is always:

- equirectangular;
- exact 2:1 aspect ratio;
- north up;
- east right;
- latitude domain \`[-90, 90]\`;
- longitude domain \`[-180, 180)\`;
- prime meridian at 0°;
- seam at ±180° with longitude wrapping.

Canonical UV conversion is:

- \`u = (wrap(longitude) + 180) / 360\`
- \`v = (90 - latitude) / 180\`

The source illustration does **not** have to begin at 2:1. Its original dimensions and checksum are preserved in \`sourceArtwork\`; registration maps normalized source-art UV coordinates to the canonical target.

## Anchor contract

Registration uses \`seam-aware-anchor-warp\` with weighted semantic control points. Every anchor stores:

- a stable anchor id;
- a canonical feature reference and feature class;
- tier: \`hard\`, \`strong\`, or \`soft\`;
- weight in \`(0, 1]\`;
- canonical latitude/longitude;
- source-art UV coordinates normalized to \`[0,1]\`.

The target UV is derived from canonical latitude/longitude rather than stored independently. This prevents target coordinates from drifting away from canonical geography.

Intended anchor hierarchy:

- **hard:** capital, superstructure/metropolitan settlements, major ports, mission-critical infrastructure;
- **strong:** distinctive islands, major lakes, river mouths, major coastline junctions, major route junctions;
- **soft:** secondary coastline samples, secondary waterways/routes, biome-transition references.

Low-information regions such as open ocean, generic desert/plain/forest interiors, and broad ice interiors are preferred deformation sinks. The registration algorithm must wrap across the ±180° seam rather than treating the two map edges as geographically distant.

## Runtime derivative

A promoted entry must point to an exact 2:1 \`.webp\` under \`assets/body-textures/\`, with dimensions and SHA-256 recorded in the registration record. Runtime code will eventually use this local derivative instead of the source GM Kit media.

## Explicit v1 exclusions

This contract does **not** add or authorize:

- elevation/displacement;
- grayscale height maps;
- normal maps;
- additional lighting maps;
- mutation or deletion of canonical cartography metadata;
- deletion of primitive SVG/reference generation;
- runtime network access to the GM Kit or Supabase;
- a textured-globe renderer yet.

Those are separate later steps.

## First pilot

The first intended promotion is **Thebes / Jinyara**. Step 1 deliberately creates no Jinyara manifest entry because the approved image bytes, image checksum, source-art logical reference, anchor correspondences, and baked runtime texture do not belong to the contract-definition step.
`;

const TEST = `import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  SURFACE_ART_REGISTRATION_CONTRACT_ID,
  SURFACE_ART_TARGET_PROJECTION,
  canonicalCartographyPath,
  canonicalUvForLatLon,
  surfaceArtBodyKey,
  validateSurfaceArtManifest,
  validateSurfaceArtRegistration,
  wrapLongitudeDeg,
} from "../scripts/surface-art-registration.mjs";

const hash = (char) => char.repeat(64);
const fingerprint = "375d0440032e4c3c4480";
const base = {
  schemaVersion: 1,
  contractId: SURFACE_ART_REGISTRATION_CONTRACT_ID,
  id: "thebes--jinyara",
  system: "Thebes",
  body: "Jinyara",
  stage: "source-linked",
  canonical: {
    cartographyPath: "data/planet-cartography/thebes/jinyara.json",
    sourceSha256: hash("a"),
    sourceFingerprint: fingerprint,
    projection: "equirectangular",
  },
  sourceArtwork: {
    authority: "lancer-gm-kit",
    repository: "jonkellyrice-cmyk/Lancer-GM-Kit",
    logicalRef: "generated-map-art/thebes--jinyara/primary",
    sha256: hash("b"),
    mimeType: "image/png",
    widthPx: 1536,
    heightPx: 1024,
  },
  targetProjection: { ...SURFACE_ART_TARGET_PROJECTION },
  provenance: { promotionTool: "future-jinyara-promotion-script-v1" },
};

const registration = {
  method: "seam-aware-anchor-warp",
  algorithmVersion: 1,
  seamPolicy: "wrap-longitude",
  deformationPolicy: "anchor-weighted-low-information-sinks",
  anchors: [
    { id: "capital", featureRef: "settlement-1", featureClass: "capital", tier: "hard", weight: 1, canonical: { latDeg: 9, lonDeg: 169 }, sourceUv: { u: .97, v: .45 } },
    { id: "city-2", featureRef: "settlement-2", featureClass: "city", tier: "hard", weight: .9, canonical: { latDeg: 43, lonDeg: 45 }, sourceUv: { u: .63, v: .27 } },
    { id: "island-1", featureRef: "gazetteer:Longnadi Dao", featureClass: "island", tier: "strong", weight: .7, canonical: { latDeg: 32.944, lonDeg: 158.833 }, sourceUv: { u: .94, v: .32 } },
  ],
};

test("surface-art manifest starts empty and enforces the v1 authority contract", () => {
  const manifest = JSON.parse(fs.readFileSync("data/surface-art/manifest.json", "utf8"));
  assert.equal(validateSurfaceArtManifest(manifest), manifest);
  assert.equal(manifest.entries.length, 0);
});

test("surface-art body identity and canonical path are deterministic", () => {
  assert.equal(surfaceArtBodyKey("Thebes", "Jinyara"), "thebes--jinyara");
  assert.equal(canonicalCartographyPath("Thebes", "Jinyara"), "data/planet-cartography/thebes/jinyara.json");
});

test("canonical UV math is equirectangular, north-up, and seam-aware", () => {
  assert.equal(wrapLongitudeDeg(180), -180);
  assert.equal(wrapLongitudeDeg(-181), 179);
  assert.deepEqual(canonicalUvForLatLon(0, 0), { u: .5, v: .5 });
  assert.deepEqual(canonicalUvForLatLon(90, -180), { u: 0, v: 0 });
  assert.deepEqual(canonicalUvForLatLon(-90, 180), { u: 0, v: 1 });
});

test("source-linked records pin GM Kit art without creating a runtime dependency", () => {
  assert.equal(validateSurfaceArtRegistration(base), base);
  assert.throws(() => validateSurfaceArtRegistration(base, { requirePromoted: true }), /must be promoted/);
  assert.throws(() => validateSurfaceArtRegistration({ ...base, sourceArtwork: { ...base.sourceArtwork, logicalRef: "https://signed.example/image.png" } }), /not a runtime URL/);
});

test("registered records require semantic seam-aware anchors", () => {
  const value = { ...base, stage: "registered", registration };
  assert.equal(validateSurfaceArtRegistration(value), value);
  assert.throws(() => validateSurfaceArtRegistration({ ...value, registration: { ...registration, anchors: registration.anchors.slice(0, 2) } }), /at least three anchors/);
});

test("promoted records require a repository-local exact 2:1 WebP derivative", () => {
  const promoted = {
    ...base,
    stage: "promoted",
    registration,
    runtimeTexture: {
      repositoryPath: "assets/body-textures/thebes/jinyara.webp",
      format: "webp",
      widthPx: 2048,
      heightPx: 1024,
      sha256: hash("c"),
    },
  };
  assert.equal(validateSurfaceArtRegistration(promoted, { requirePromoted: true }), promoted);
  assert.throws(() => validateSurfaceArtRegistration({ ...promoted, runtimeTexture: { ...promoted.runtimeTexture, repositoryPath: "https://example.com/jinyara.webp" } }), /repository-local/);
  assert.throws(() => validateSurfaceArtRegistration({ ...promoted, runtimeTexture: { ...promoted.runtimeTexture, widthPx: 1536 } }), /exact 2:1/);
});

test("canonical source hash and fingerprint drift are rejected", () => {
  assert.throws(() => validateSurfaceArtRegistration({ ...base, canonical: { ...base.canonical, sourceSha256: "bad" } }), /sourceSha256/);
  assert.throws(() => validateSurfaceArtRegistration({ ...base, canonical: { ...base.canonical, sourceFingerprint: "bad" } }), /sourceFingerprint/);
});
`;

const EXPECTED = new Map([
  ["scripts/surface-art-registration.mjs", CONTRACT_MODULE],
  ["data/surface-art/manifest.json", MANIFEST],
  ["docs/surface-art-registration-contract.md", DOC],
  ["tests/surface-art-registration.test.mjs", TEST],
]);

function apply() {
  for (const [relative, content] of EXPECTED) {
    const target = path.join(ROOT, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
    console.log(`[surface-art-contract] wrote ${relative}`);
  }
}

function check() {
  const drift = [];
  for (const [relative, content] of EXPECTED) {
    const target = path.join(ROOT, relative);
    if (!fs.existsSync(target)) { drift.push(`${relative}: missing`); continue; }
    if (fs.readFileSync(target, "utf8") !== content) drift.push(`${relative}: content drift`);
  }
  if (drift.length) throw new Error(`[surface-art-contract] patch drift:\n- ${drift.join("\n- ")}`);
  console.log(`[surface-art-contract] verified ${EXPECTED.size} bounded outputs`);
}

if (APPLY) apply();
else check();
