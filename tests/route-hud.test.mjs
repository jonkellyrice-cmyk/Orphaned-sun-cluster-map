import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const template = readFileSync(new URL("../templates/cluster-map.hbs", import.meta.url), "utf8");
const app = readFileSync(new URL("../scripts/cluster-map-app.mjs", import.meta.url), "utf8");
const css = readFileSync(new URL("../styles/route-hud.css", import.meta.url), "utf8");

test("route HUD exposes route, reference-frame, and subjective fields", () => {
  assert.match(template, /class="oscm-route-hud is-hidden"/);
  assert.match(template, /data-hud-field="route"/);
  assert.match(template, /data-hud-field="spatial"/);
  assert.match(template, /data-hud-field="clusterTime"/);
  assert.match(template, /data-hud-field="shipTime"/);
  assert.match(template, /REFERENCE FRAME/);
  assert.match(template, /SHIPBOARD \/ SUBJECTIVE/);
});

test("route selection shows and populates the HUD", () => {
  assert.match(app, /hud\?\.classList\.remove\("is-hidden"\)/);
  assert.match(app, /hud\?\.classList\.add\("is-hidden"\)/);
  assert.match(app, /route: `\$\{origin\.name\} → \$\{destination\.name\}`/);
  assert.match(app, /clusterTime: values\.clusterTime/);
  assert.match(app, /shipTime: values\.shipTime/);
});

test("route HUD is an upper-right non-interactive overlay", () => {
  assert.match(css, /position:\s*absolute/);
  assert.match(css, /top:\s*12px/);
  assert.match(css, /right:\s*12px/);
  assert.match(css, /pointer-events:\s*none/);
  assert.match(css, /@media \(max-width: 640px\)/);
});
