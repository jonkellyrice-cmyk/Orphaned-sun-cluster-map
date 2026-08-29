import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const bodyView = readFileSync(new URL("../scripts/body-view.mjs", import.meta.url), "utf8");
const app = readFileSync(new URL("../scripts/cluster-map-app.mjs", import.meta.url), "utf8");
const css = readFileSync(new URL("../styles/body-operations.css", import.meta.url), "utf8");
const moduleManifest = JSON.parse(readFileSync(new URL("../module.json", import.meta.url), "utf8"));

test("operational body viewer exposes family layers, bounded labels and accessible feature selection", () => {
  for (const token of [
    "Operational Survey Layers",
    "data-operation-layer",
    "oscm-operation-label",
    "buildBodyOperationsRenderPlan",
    "tabindex",
    "keydown",
    "Enter",
    "setLayerVisibility",
  ]) assert.match(bodyView, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("operational inspection surfaces role detail, scale and accepted provenance", () => {
  assert.match(bodyView, /inspectBodyOperationFeature/);
  assert.match(bodyView, /Provenance:/);
  assert.match(app, /inspectSurfaceFeature\(feature\)/);
  assert.match(app, /inspected\.scale/);
});

test("operational mode is permanent application and stylesheet state", () => {
  assert.match(app, /loadBodyOperationAsset/);
  assert.match(app, /has-operations/);
  assert.match(app, /operational features/);
  assert.ok(moduleManifest.styles.includes("styles/body-operations.css"));
  assert.match(css, /\.oscm-shell\.is-body-mode\.has-operations/);
  assert.match(css, /\.oscm-operation-feature:hover/);
  assert.match(css, /\.oscm-operation-label\.priority-1/);
});
