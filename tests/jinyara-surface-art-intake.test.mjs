import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import test from "node:test";
import { validateSurfaceArtManifest } from "../scripts/surface-art-registration.mjs";

const canonicalPath = "data/planet-cartography/thebes/jinyara.json";
const intakePath = "data/surface-art/intake/thebes/jinyara.json";
const manifestPath = "data/surface-art/manifest.json";
const runtimePath = "assets/body-textures/thebes/jinyara.webp";
const reportPath = "data/surface-art/registration-reports/thebes/jinyara.json";
const sha256 = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex");
const canonicalBytes = fs.readFileSync(canonicalPath);
const canonical = JSON.parse(canonicalBytes.toString("utf8"));
const intake = JSON.parse(fs.readFileSync(intakePath, "utf8"));
const runtimeManifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));

test("Jinyara intake stays pinned to exact canonical cartography identity", () => {
  assert.equal(intake.system, "Thebes");
  assert.equal(intake.body, "Jinyara");
  assert.equal(intake.canonical.sourcePath, canonicalPath);
  assert.equal(intake.canonical.sourceFingerprint, canonical.sourceFingerprint);
  assert.equal(intake.canonical.sourceFingerprint, "375d0440032e4c3c4480");
  assert.equal(intake.canonical.sourceSha256, sha256(canonicalBytes));
});

test("authenticated acquisition verifies the exact GM Kit source bytes", () => {
  assert.equal(intake.sourceArtwork.campaignId, "orphaned-sun-generated-maps");
  assert.equal(intake.sourceArtwork.entityId, "generated-map-375d0440032e4c3c4480");
  assert.equal(intake.sourceArtwork.attachmentId, "cb4fdeae-019c-4d5e-b651-2229c4622080");
  assert.equal(intake.sourceArtwork.bytes, 3831433);
  assert.equal(intake.sourceArtwork.width, 1774);
  assert.equal(intake.sourceArtwork.height, 887);
  assert.equal(intake.sourceArtwork.width, intake.sourceArtwork.height * 2);
  assert.equal(intake.sourceArtwork.sha256, "65efc7f9ffdd6bee7f15dfe36ee5f1bc2d5e994a09d86f80a73ae57ee2e83b38");
  assert.equal(intake.sourceArtwork.checksumStatus, "verified-exact-source-bytes");
  assert.equal(intake.sourceArtwork.authoringStorage.runtimeDependencyAllowed, false);
});

test("bounded registration shortlist still retains every Jinyara settlement as a hard candidate", () => {
  const hard = intake.selectedAnchors.filter((item) => item.weight === "hard");
  assert.equal(canonical.settlements.length, 18);
  assert.equal(hard.length, canonical.settlements.length);
  assert.deepEqual(hard.map((item) => item.ref).sort(), canonical.settlements.map((_, index) => `settlement-${index + 1}`).sort());
  assert(hard.some((item) => item.class === "superstructure"));
  assert(hard.some((item) => item.class === "metropolitan"));
  assert(hard.some((item) => item.class === "regional"));
});

test("registration preserves bounded geography, roads, hydrology, and seam-aware candidates", () => {
  assert.equal(intake.anchorPoolSummary.total, 211);
  assert.equal(intake.selectedAnchorSummary.total, 50);
  assert.equal(intake.selectedAnchorSummary.byWeight.hard, 18);
  assert.equal(intake.selectedAnchorSummary.byWeight.strong, 16);
  assert.equal(intake.selectedAnchorSummary.byWeight.soft, 16);
  assert(intake.selectedAnchorSummary.byKind.island > 0);
  assert(intake.selectedAnchorSummary.byKind.lake > 0);
  assert(intake.selectedAnchorSummary.byKind["river-endpoint"] > 0);
  assert(intake.selectedAnchorSummary.byKind["transport-corridor-midpoint"] > 0);
  const seam = intake.selectedAnchors.filter((item) => item.canonical.seamAdjacent);
  assert(seam.length > 0);
  assert(seam.every((item) => Number.isFinite(item.canonical.wrapU)));
});

test("measured correspondences replace projection guesses for a reliable semantic subset", () => {
  const measured = intake.selectedAnchors.filter((item) => item.sourceObservation.status === "measured");
  assert(measured.length >= 6);
  assert(measured.every((item) => Number.isFinite(item.sourceObservation.u) && item.sourceObservation.u >= 0 && item.sourceObservation.u <= 1));
  assert(measured.every((item) => Number.isFinite(item.sourceObservation.v) && item.sourceObservation.v >= 0 && item.sourceObservation.v <= 1));
  assert(measured.every((item) => item.sourceObservation.method === "local-land-water-shape-correlation"));
  assert(measured.every((item) => item.sourceObservation.matchScore >= 0.63));
  const pending = intake.selectedAnchors.filter((item) => item.sourceObservation.status === "pending");
  assert.equal(measured.length + pending.length, 50);
});

test("Jinyara is promoted only with a repository-local validated 2:1 WebP", () => {
  validateSurfaceArtManifest(runtimeManifest, { requirePromoted: true });
  const entry = runtimeManifest.entries.find((item) => item.id === "thebes--jinyara");
  assert(entry);
  assert.equal(entry.stage, "promoted");
  assert.equal(entry.sourceArtwork.sha256, intake.sourceArtwork.sha256);
  assert.equal(entry.runtimeTexture.repositoryPath, runtimePath);
  assert.equal(entry.runtimeTexture.widthPx, 1774);
  assert.equal(entry.runtimeTexture.heightPx, 887);
  const bytes = fs.readFileSync(runtimePath);
  assert.equal(sha256(bytes), entry.runtimeTexture.sha256);
  assert.equal(report.runtime.sha256, entry.runtimeTexture.sha256);
  assert.equal(intake.targetRuntime.sha256, entry.runtimeTexture.sha256);
  assert.equal(intake.registrationReadiness.sourceLinked, true);
  assert.equal(intake.registrationReadiness.registered, true);
  assert.equal(intake.registrationReadiness.promoted, true);
  assert.equal(intake.targetRuntime.status, "baked-and-promoted");
  assert(entry.registration.quality.rmsAnchorErrorPx <= 18);
  assert(entry.registration.quality.maxAnchorErrorPx <= 36);
  assert(entry.registration.quality.macroBalancedAccuracy >= 0.62);
});
