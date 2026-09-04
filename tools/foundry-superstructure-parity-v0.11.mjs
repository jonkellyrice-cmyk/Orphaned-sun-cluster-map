import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const TARGET_VERSION = "0.11.0";
const STABLE_MANIFEST = "https://github.com/jonkellyrice-cmyk/Orphaned-sun-cluster-map/releases/latest/download/module.json";
const TARGET_DOWNLOAD = `https://github.com/jonkellyrice-cmyk/Orphaned-sun-cluster-map/releases/download/v${TARGET_VERSION}/orphaned-sun-cluster-map-v${TARGET_VERSION}.zip`;

const files = {
  core: "scripts/body-view-core.mjs",
  wrapper: "scripts/body-view.mjs",
  atlas: "scripts/superstructure-atlas-visuals.mjs",
  bodyTest: "tests/body-view.test.mjs",
  releaseTest: "tests/release-package.test.mjs",
  package: "package.json",
  module: "module.json",
};

const before = Object.fromEntries(Object.entries(files).map(([key, path]) => [key, readFileSync(path, "utf8")]));
const next = { ...before };

function replaceOnce(key, oldText, newText) {
  if (next[key].includes(newText)) return false;
  if (!next[key].includes(oldText)) throw new Error(`[parity] expected source fragment missing in ${files[key]}`);
  next[key] = next[key].replace(oldText, newText);
  return true;
}

let sourceChanged = false;

sourceChanged = replaceOnce(
  "core",
  'import { projectGeoPath, selectCartographyLabels } from "./body-cartography.mjs";\n',
  'import { projectGeoPath, selectCartographyLabels } from "./body-cartography.mjs";\nimport { renderSuperstructureAtlas } from "./superstructure-atlas-visuals.mjs";\nimport { factionFamilyFor, superstructureProfile, SUPERSTRUCTURE_MODEL_VERSION } from "./superstructure-identities.mjs";\n',
);

sourceChanged = replaceOnce(
  "core",
  'export function schematicVisualProfile(model) {\n',
  `export function liveSuperstructureIdentity(model) {\n  const profile = superstructureProfile(model?.system, model?.body);\n  if (!profile) return null;\n  return {\n    ...profile,\n    modelVersion: SUPERSTRUCTURE_MODEL_VERSION,\n    factionFamily: factionFamilyFor({\n      system: model?.system,\n      owner_faction: model?.ownerFaction ?? model?.owner_faction ?? "",\n    }),\n  };\n}\n\nexport function schematicVisualProfile(model) {\n`,
);

sourceChanged = replaceOnce(
  "core",
  `    if (/jade|green|viridian/.test(palette)) this.structure.classList.add("palette-jade");\n    if (profile.renderer === "shipyard") this.#buildShipyard();\n`,
  `    if (/jade|green|viridian/.test(palette)) this.structure.classList.add("palette-jade");\n\n    const superstructure = liveSuperstructureIdentity(this.model);\n    if (superstructure) {\n      this.structure.classList.add("is-superstructure-parity");\n      this.structure.setAttribute("data-superstructure-family", superstructure.silhouetteFamily);\n      this.structure.insertAdjacentHTML(\n        "beforeend",\n        renderSuperstructureAtlas(\n          superstructure,\n          { x: -340, y: -260, width: 680, height: 520 },\n          { includeSectionalBand: false },\n        ),\n      );\n      this.#buildDockingNodes();\n      return;\n    }\n\n    if (profile.renderer === "shipyard") this.#buildShipyard();\n`,
);

sourceChanged = replaceOnce(
  "atlas",
  'export function renderSuperstructureAtlas(identity, frame) {\n',
  'export function renderSuperstructureAtlas(identity, frame, { includeSectionalBand = true } = {}) {\n',
);
sourceChanged = replaceOnce(
  "atlas",
  '  return `<g data-superstructure="${xml(identity.system)}/${xml(identity.body)}" data-superstructure-family="${xml(family)}" data-superstructure-scale="city-scale-or-larger">${silhouette}${sectionalBand(identity,frame,p)}</g>`;\n',
  '  return `<g data-superstructure="${xml(identity.system)}/${xml(identity.body)}" data-superstructure-family="${xml(family)}" data-superstructure-scale="city-scale-or-larger">${silhouette}${includeSectionalBand ? sectionalBand(identity,frame,p) : ""}</g>`;\n',
);

sourceChanged = replaceOnce(
  "wrapper",
  'export { schematicVisualProfile, orthographicProject, bodyVisualContract } from "../scripts/body-view-core.mjs";\n',
  'export { schematicVisualProfile, orthographicProject, bodyVisualContract, liveSuperstructureIdentity } from "../scripts/body-view-core.mjs";\n',
);

sourceChanged = replaceOnce(
  "bodyTest",
  'import { bodyVisualContract, orthographicProject, projectOperationAnchor, schematicVisualProfile } from "../scripts/body-view.mjs";\n',
  'import { bodyVisualContract, liveSuperstructureIdentity, orthographicProject, projectOperationAnchor, schematicVisualProfile } from "../scripts/body-view.mjs";\nimport { renderSuperstructureAtlas } from "../scripts/superstructure-atlas-visuals.mjs";\nimport { SUPERSTRUCTURE_KEYS } from "../scripts/superstructure-identities.mjs";\n',
);

const parityTest = `\n\ntest("live Foundry artificial-body renderer shares the frozen-atlas superstructure identity families", () => {\n  assert.equal(SUPERSTRUCTURE_KEYS.length, 28);\n  for (const key of SUPERSTRUCTURE_KEYS) {\n    const [system, body] = key.split("/");\n    const identity = liveSuperstructureIdentity({ system, body });\n    assert.ok(identity, \`missing live identity for \${key}\`);\n    const rendered = renderSuperstructureAtlas(identity, { x: -340, y: -260, width: 680, height: 520 }, { includeSectionalBand: false });\n    assert.match(rendered, new RegExp(\`data-superstructure-family=\\"\${identity.silhouetteFamily.replace(/[.*+?^\${}()|[\\]\\\\]/g, "\\\\$&")}\\"\`));\n    assert.doesNotMatch(rendered, /data-section-logic=\\"true\\"/, \`Foundry live silhouette must not include the frozen atlas zoning strip for \${key}\`);\n  }\n\n  assert.equal(liveSuperstructureIdentity({ system: "Amarna", body: "Far Lantern" }).silhouetteFamily, "stacked-vertical-station");\n  assert.equal(liveSuperstructureIdentity({ system: "Memphis", body: "Pilgrim's Lantern" }).silhouetteFamily, "conclave-lantern-spindle");\n  assert.equal(liveSuperstructureIdentity({ system: "Iunu", body: "Asterion Crown" }).silhouetteFamily, "accord-crown-spindle");\n  assert.equal(liveSuperstructureIdentity({ system: "Abydos", body: "Thornfield" }), null);\n\n  const source = readFileSync(new URL("../scripts/body-view-core.mjs", import.meta.url), "utf8");\n  for (const token of ["renderSuperstructureAtlas", "liveSuperstructureIdentity", "is-superstructure-parity", "includeSectionalBand: false", "#buildDockingNodes"]) assert.match(source, new RegExp(token));\n});\n`;
if (!next.bodyTest.includes('test("live Foundry artificial-body renderer shares the frozen-atlas superstructure identity families"')) {
  next.bodyTest = next.bodyTest.trimEnd() + parityTest;
  sourceChanged = true;
}

const pkg = JSON.parse(next.package);
if (pkg.version !== TARGET_VERSION) {
  pkg.version = TARGET_VERSION;
  next.package = `${JSON.stringify(pkg, null, 2)}\n`;
  sourceChanged = true;
}

const manifest = JSON.parse(next.module);
if (manifest.manifest !== STABLE_MANIFEST) throw new Error(`[parity] refusing to alter stable Foundry manifest URL: ${manifest.manifest}`);
if (manifest.version !== TARGET_VERSION || manifest.download !== TARGET_DOWNLOAD) {
  manifest.version = TARGET_VERSION;
  manifest.download = TARGET_DOWNLOAD;
  next.module = `${JSON.stringify(manifest, null, 2)}\n`;
  sourceChanged = true;
}

sourceChanged = replaceOnce(
  "releaseTest",
  'test("Foundry and package versions agree on the v0.10.0 release archive", () => {',
  'test("Foundry and package versions agree on the v0.11.0 release archive", () => {',
);
sourceChanged = replaceOnce("releaseTest", '  assert.equal(manifest.version, "0.10.0");', '  assert.equal(manifest.version, "0.11.0");');
sourceChanged = replaceOnce(
  "releaseTest",
  '  assert.match(manifest.download, /v0\\.10\\.0\\/orphaned-sun-cluster-map-v0\\.10\\.0\\.zip$/);',
  '  assert.match(manifest.download, /v0\\.11\\.0\\/orphaned-sun-cluster-map-v0\\.11\\.0\\.zip$/);',
);

for (const key of Object.keys(files)) {
  if (next[key] !== before[key]) writeFileSync(files[key], next[key]);
}

const finalManifest = JSON.parse(readFileSync(files.module, "utf8"));
const finalPackage = JSON.parse(readFileSync(files.package, "utf8"));
if (finalManifest.version !== TARGET_VERSION || finalPackage.version !== TARGET_VERSION) throw new Error("[parity] version bump did not materialize");
if (finalManifest.manifest !== STABLE_MANIFEST) throw new Error("[parity] stable manifest URL changed");
if (finalManifest.download !== TARGET_DOWNLOAD) throw new Error("[parity] versioned download URL is incorrect");

const core = readFileSync(files.core, "utf8");
for (const token of ["renderSuperstructureAtlas", "liveSuperstructureIdentity", "is-superstructure-parity", "includeSectionalBand: false"]) {
  if (!core.includes(token)) throw new Error(`[parity] live renderer wiring missing ${token}`);
}

const atlas = readFileSync(files.atlas, "utf8");
if (!atlas.includes("includeSectionalBand = true")) throw new Error("[parity] frozen atlas default zoning behavior was not preserved");

console.log(`[parity] sourceChanged=${sourceChanged}`);
console.log(`[parity] Foundry version=${finalManifest.version}`);
console.log(`[parity] stable manifest=${finalManifest.manifest}`);
console.log(`[parity] download=${finalManifest.download}`);

for (const [label, command, args] of [
  ["tests", "npm", ["test"]],
  ["body operations validate", "npm", ["run", "body-operations:validate"]],
  ["body operations deterministic check", "npm", ["run", "body-operations:check"]],
  ["atlas deterministic check", "npm", ["run", "atlas:snapshot:check"]],
  ["astronomy validate", "npm", ["run", "astronomy:validate"]],
  ["astronomy deterministic check", "npm", ["run", "astronomy:check"]],
]) {
  console.log(`[parity] ${label}`);
  execFileSync(command, args, { stdio: "inherit" });
}
