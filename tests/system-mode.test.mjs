import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const cluster = readFileSync(new URL("../scripts/cluster-view.mjs", import.meta.url), "utf8");
const app = readFileSync(new URL("../scripts/cluster-map-app.mjs", import.meta.url), "utf8");
const template = readFileSync(new URL("../templates/cluster-map.hbs", import.meta.url), "utf8");

test("cluster activation defers single-click selection and supports double activation", () => {
  assert.match(cluster, /pendingSelectionTimer/);
  assert.match(cluster, /onSystemActivate/);
  assert.match(cluster, /lastActivation/);
  assert.match(cluster, /this\.state\.zoom > 3\.42/);
});

test("application switches coherently between cluster and system views", () => {
  assert.match(app, /mode = "cluster"/);
  assert.match(app, /new SystemView/);
  assert.match(app, /#enterSystem/);
  assert.match(app, /#showCluster/);
  assert.match(app, /attachFactionTerritories\(this\._clusterView\)/);
});

test("template provides explicit cluster return and dynamic identity fields", () => {
  assert.match(template, /data-action="back-to-cluster"/);
  assert.match(template, /data-map-title/);
  assert.match(template, /data-map-count/);
  assert.match(template, /data-map-help/);
});
