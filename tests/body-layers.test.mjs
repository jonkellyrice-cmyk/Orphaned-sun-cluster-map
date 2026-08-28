import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BODY_LAYER_DEFINITIONS, buildBodyLayers, inspectSurfaceFeature } from "../scripts/body-layers.mjs";

const manifest = JSON.parse(readFileSync(new URL("../data/planet-geography/manifest.json", import.meta.url), "utf8"));
const eventide = JSON.parse(readFileSync(new URL(`../${manifest.worlds.find((world) => world.body === "Eventide").path}`, import.meta.url), "utf8"));

test("surface layer contract exposes physical, ecological, resource, and civilization layers", () => {
  assert.deepEqual(BODY_LAYER_DEFINITIONS.map((layer) => layer.id), ["terrain", "hydrology", "resources", "settlements", "transport"]);
  const layers = buildBodyLayers(eventide); for (const id of BODY_LAYER_DEFINITIONS.map((layer) => layer.id)) assert.ok(layers[id].length, id);
});

test("capital, cities, and transportation routes retain literal coordinates", () => {
  const layers = buildBodyLayers(eventide);
  assert.equal(layers.settlements.filter((site) => site.kind === "capital").length, 1);
  assert.ok(layers.settlements.every((site) => Number.isFinite(site.lat) && Number.isFinite(site.lon)));
  assert.ok(layers.transport.every((route) => route.fromSite && route.toSite && route.mode));
});

test("feature inspection produces human-readable survey details", () => {
  assert.deepEqual(inspectSurfaceFeature({ id: "site-1", kind: "capital", label: "Capital", suitability: .8 }), { name: "Capital", type: "capital", detail: "Orbital survey feature" });
});
