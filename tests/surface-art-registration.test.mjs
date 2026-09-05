import assert from "node:assert/strict";
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

test("surface-art manifest enforces the v1 authority contract for zero or more promoted entries", () => {
  const manifest = JSON.parse(fs.readFileSync("data/surface-art/manifest.json", "utf8"));
  assert.equal(validateSurfaceArtManifest(manifest), manifest);
  assert(Array.isArray(manifest.entries));
  assert(manifest.entries.every((entry) => entry.stage === "promoted"));
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
