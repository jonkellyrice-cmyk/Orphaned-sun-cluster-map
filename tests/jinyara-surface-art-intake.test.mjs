import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import test from "node:test";

const canonicalPath = "data/planet-cartography/thebes/jinyara.json";
const intakePath = "data/surface-art/intake/thebes/jinyara.json";
const manifestPath = "data/surface-art/manifest.json";
const sha256 = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex");
const canonicalBytes = fs.readFileSync(canonicalPath);
const canonical = JSON.parse(canonicalBytes.toString("utf8"));
const intake = JSON.parse(fs.readFileSync(intakePath, "utf8"));
const runtimeManifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

test("Jinyara intake pins exact canonical cartography identity", () => {
  assert.equal(intake.system, "Thebes");
  assert.equal(intake.body, "Jinyara");
  assert.equal(intake.canonical.sourcePath, canonicalPath);
  assert.equal(intake.canonical.sourceFingerprint, canonical.sourceFingerprint);
  assert.equal(intake.canonical.sourceFingerprint, "375d0440032e4c3c4480");
  assert.equal(intake.canonical.sourceSha256, sha256(canonicalBytes));
});

test("Jinyara intake identifies the exact GM Kit attachment without inventing its checksum", () => {
  assert.equal(intake.sourceArtwork.campaignId, "orphaned-sun-generated-maps");
  assert.equal(intake.sourceArtwork.entityId, "generated-map-375d0440032e4c3c4480");
  assert.equal(intake.sourceArtwork.attachmentId, "cb4fdeae-019c-4d5e-b651-2229c4622080");
  assert.equal(intake.sourceArtwork.bytes, 3829195);
  assert.equal(intake.sourceArtwork.width, 1774);
  assert.equal(intake.sourceArtwork.height, 887);
  assert.equal(intake.sourceArtwork.width, intake.sourceArtwork.height * 2);
  assert.equal(intake.sourceArtwork.sha256, null);
  assert.equal(intake.sourceArtwork.checksumStatus, "pending-secure-byte-acquisition");
  assert.equal(intake.sourceArtwork.authoringStorage.runtimeDependencyAllowed, false);
});

test("all 18 Jinyara settlements are hard semantic anchor candidates", () => {
  const hard = intake.anchorCandidates.filter((item) => item.weightClass === "hard");
  assert.equal(canonical.settlements.length, 18);
  assert.equal(hard.length, canonical.settlements.length);
  assert.deepEqual(hard.map((item) => item.featureRef).sort(), canonical.settlements.map((_, index) => `settlement-${index + 1}`).sort());
  assert(hard.some((item) => item.metadata.scaleClass === "superstructure"));
  assert(hard.some((item) => item.metadata.scaleClass === "metropolitan"));
  assert(hard.some((item) => item.metadata.scaleClass === "regional"));
});

test("anchor candidate pack includes macro geography, hydrology, roads, and seam handling", () => {
  assert(intake.candidateSummary.byWeight.strong > 0);
  assert(intake.candidateSummary.byWeight.soft > 0);
  assert(intake.candidateSummary.byKind.island > 0);
  assert(intake.candidateSummary.byKind.lake > 0);
  assert(intake.candidateSummary.byKind["river-endpoint"] > 0);
  assert.equal(intake.candidateSummary.byKind["transport-corridor-midpoint"], canonical.transportRoutes.length);
  const seam = intake.anchorCandidates.filter((item) => item.canonical.seamAdjacent);
  assert(seam.length > 0);
  assert(seam.every((item) => Number.isFinite(item.canonical.alternateWrapU)));
});

test("expected source pixels are deterministic projection guesses, not observed anchors", () => {
  for (const item of intake.anchorCandidates) {
    assert(item.canonical.uv.u >= 0 && item.canonical.uv.u <= 1);
    assert(item.canonical.uv.v >= 0 && item.canonical.uv.v <= 1);
    assert(item.canonical.sourcePixelExpectation.x >= 0 && item.canonical.sourcePixelExpectation.x <= 1773);
    assert(item.canonical.sourcePixelExpectation.y >= 0 && item.canonical.sourcePixelExpectation.y <= 886);
    assert.equal(item.sourceObservation.status, "pending");
    assert.equal(item.sourceObservation.u, null);
    assert.equal(item.sourceObservation.v, null);
  }
});

test("Step 2 does not falsely promote Jinyara into the runtime surface-art manifest", () => {
  assert.equal(runtimeManifest.schemaVersion, 1);
  assert.equal(runtimeManifest.entries.some((entry) => entry.system === "Thebes" && entry.body === "Jinyara"), false);
  assert.equal(intake.registrationReadiness.sourceLinked, false);
  assert.equal(intake.registrationReadiness.registered, false);
  assert.equal(intake.registrationReadiness.promoted, false);
  assert.equal(intake.targetRuntime.status, "not-baked");
});
