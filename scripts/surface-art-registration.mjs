export const SURFACE_ART_REGISTRATION_SCHEMA_VERSION = 1;
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
const fail = (message) => { throw new TypeError(`[surface-art-registration] ${message}`); };
const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const finite = (value) => typeof value === "number" && Number.isFinite(value);
const positiveInt = (value) => Number.isInteger(value) && value > 0;
const slug = (value) => String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function surfaceArtBodyKey(system, body) {
  if (!String(system ?? "").trim() || !String(body ?? "").trim()) fail("system and body are required");
  return `${slug(system)}--${slug(body)}`;
}

export function canonicalCartographyPath(system, body) {
  return `data/planet-cartography/${slug(system)}/${slug(body)}.json`;
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
  if (!isObject(canonical)) fail(`${entry.id}: canonical source binding is required`);
  const expectedPath = canonicalCartographyPath(entry.system, entry.body);
  if (canonical.cartographyPath !== expectedPath) fail(`${entry.id}: canonical cartographyPath must be ${expectedPath}`);
  if (!SHA256_RE.test(canonical.sourceSha256 ?? "")) fail(`${entry.id}: canonical sourceSha256 must be a lowercase SHA-256`);
  if (!FINGERPRINT_RE.test(canonical.sourceFingerprint ?? "")) fail(`${entry.id}: canonical sourceFingerprint must be a 20-character lowercase hex fingerprint`);
  if (canonical.projection !== "equirectangular") fail(`${entry.id}: canonical projection must be equirectangular`);
}

function validateSourceArtwork(sourceArtwork, entry) {
  if (!isObject(sourceArtwork)) fail(`${entry.id}: sourceArtwork is required`);
  if (sourceArtwork.authority !== "lancer-gm-kit") fail(`${entry.id}: source artwork authority must be lancer-gm-kit`);
  if (sourceArtwork.repository !== SURFACE_ART_SOURCE_REPOSITORY) fail(`${entry.id}: source artwork repository must be ${SURFACE_ART_SOURCE_REPOSITORY}`);
  if (typeof sourceArtwork.logicalRef !== "string" || !sourceArtwork.logicalRef.trim()) fail(`${entry.id}: sourceArtwork.logicalRef is required`);
  if (/^https?:\/\//i.test(sourceArtwork.logicalRef)) fail(`${entry.id}: sourceArtwork.logicalRef must be stable logical metadata, not a runtime URL`);
  if (!SHA256_RE.test(sourceArtwork.sha256 ?? "")) fail(`${entry.id}: source artwork sha256 must be a lowercase SHA-256`);
  if (!IMAGE_MIME_TYPES.has(sourceArtwork.mimeType)) fail(`${entry.id}: unsupported source artwork mimeType`);
  if (!positiveInt(sourceArtwork.widthPx) || !positiveInt(sourceArtwork.heightPx)) fail(`${entry.id}: source artwork dimensions must be positive integers`);
}

function validateProjection(targetProjection, entry) {
  if (!isObject(targetProjection)) fail(`${entry.id}: targetProjection is required`);
  for (const [key, value] of Object.entries(SURFACE_ART_TARGET_PROJECTION)) {
    if (targetProjection[key] !== value) fail(`${entry.id}: targetProjection.${key} must equal ${JSON.stringify(value)}`);
  }
}

function validateRegistration(registration, entry) {
  if (!isObject(registration)) fail(`${entry.id}: registration is required at stage ${entry.stage}`);
  if (registration.method !== "seam-aware-anchor-warp") fail(`${entry.id}: registration.method must be seam-aware-anchor-warp`);
  if (!positiveInt(registration.algorithmVersion)) fail(`${entry.id}: registration.algorithmVersion must be a positive integer`);
  if (registration.seamPolicy !== "wrap-longitude") fail(`${entry.id}: registration.seamPolicy must be wrap-longitude`);
  if (registration.deformationPolicy !== "anchor-weighted-low-information-sinks") fail(`${entry.id}: unsupported registration.deformationPolicy`);
  if (!Array.isArray(registration.anchors) || registration.anchors.length < 3) fail(`${entry.id}: registration requires at least three anchors`);
  const ids = new Set();
  for (const anchor of registration.anchors) {
    if (!isObject(anchor) || typeof anchor.id !== "string" || !anchor.id.trim()) fail(`${entry.id}: every anchor needs an id`);
    if (ids.has(anchor.id)) fail(`${entry.id}: duplicate anchor id ${anchor.id}`);
    ids.add(anchor.id);
    if (typeof anchor.featureRef !== "string" || !anchor.featureRef.trim()) fail(`${entry.id}/${anchor.id}: featureRef is required`);
    if (typeof anchor.featureClass !== "string" || !anchor.featureClass.trim()) fail(`${entry.id}/${anchor.id}: featureClass is required`);
    if (!ANCHOR_TIERS.has(anchor.tier)) fail(`${entry.id}/${anchor.id}: anchor tier must be hard, strong, or soft`);
    if (!finite(anchor.weight) || anchor.weight <= 0 || anchor.weight > 1) fail(`${entry.id}/${anchor.id}: weight must be in (0,1]`);
    if (!isObject(anchor.canonical) || !finite(anchor.canonical.latDeg) || anchor.canonical.latDeg < -90 || anchor.canonical.latDeg > 90 || !finite(anchor.canonical.lonDeg)) {
      fail(`${entry.id}/${anchor.id}: canonical lat/lon is invalid`);
    }
    if (!isObject(anchor.sourceUv) || !finite(anchor.sourceUv.u) || !finite(anchor.sourceUv.v) || anchor.sourceUv.u < 0 || anchor.sourceUv.u > 1 || anchor.sourceUv.v < 0 || anchor.sourceUv.v > 1) {
      fail(`${entry.id}/${anchor.id}: sourceUv must be normalized to [0,1]`);
    }
  }
  if (registration.quality != null) {
    if (!isObject(registration.quality)) fail(`${entry.id}: registration.quality must be an object`);
    for (const key of ["rmsAnchorErrorPx", "maxAnchorErrorPx"]) {
      if (registration.quality[key] != null && (!finite(registration.quality[key]) || registration.quality[key] < 0)) fail(`${entry.id}: registration.quality.${key} must be non-negative`);
    }
  }
}

function validateRuntimeTexture(runtimeTexture, entry) {
  if (!isObject(runtimeTexture)) fail(`${entry.id}: runtimeTexture is required at promoted stage`);
  if (runtimeTexture.format !== "webp") fail(`${entry.id}: runtimeTexture.format must be webp`);
  if (typeof runtimeTexture.repositoryPath !== "string" || !/^assets\/body-textures\/[a-z0-9/_-]+\.webp$/.test(runtimeTexture.repositoryPath)) {
    fail(`${entry.id}: runtime texture must be a repository-local assets/body-textures/*.webp path`);
  }
  if (!positiveInt(runtimeTexture.widthPx) || !positiveInt(runtimeTexture.heightPx) || runtimeTexture.widthPx !== runtimeTexture.heightPx * 2) {
    fail(`${entry.id}: runtime texture must be an exact 2:1 equirectangular image`);
  }
  if (!SHA256_RE.test(runtimeTexture.sha256 ?? "")) fail(`${entry.id}: runtime texture sha256 must be a lowercase SHA-256`);
}

export function validateSurfaceArtRegistration(value, { requirePromoted = false } = {}) {
  if (!isObject(value)) fail("registration entry must be an object");
  const entry = value;
  if (entry.schemaVersion !== SURFACE_ART_REGISTRATION_SCHEMA_VERSION) fail("unsupported registration schemaVersion");
  if (entry.contractId !== SURFACE_ART_REGISTRATION_CONTRACT_ID) fail("unsupported registration contractId");
  if (typeof entry.system !== "string" || !entry.system.trim() || typeof entry.body !== "string" || !entry.body.trim()) fail("registration system/body are required");
  if (entry.id !== surfaceArtBodyKey(entry.system, entry.body)) fail(`${entry.system}/${entry.body}: id must equal canonical body key`);
  if (!STAGES.has(entry.stage)) fail(`${entry.id}: unsupported stage`);
  if (requirePromoted && entry.stage !== "promoted") fail(`${entry.id}: runtime manifest entries must be promoted`);
  validateCanonical(entry.canonical, entry);
  validateSourceArtwork(entry.sourceArtwork, entry);
  validateProjection(entry.targetProjection, entry);
  if (entry.stage === "registered" || entry.stage === "promoted") validateRegistration(entry.registration, entry);
  if (entry.stage === "promoted") validateRuntimeTexture(entry.runtimeTexture, entry);
  if (!isObject(entry.provenance) || typeof entry.provenance.promotionTool !== "string" || !entry.provenance.promotionTool.trim()) fail(`${entry.id}: provenance.promotionTool is required`);
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
    if (ids.has(entry.id)) fail(`manifest repeats ${entry.id}`);
    ids.add(entry.id);
  }
  return value;
}
