import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bodyVisualContract, orthographicProject, projectOperationAnchor, schematicVisualProfile } from "../scripts/body-view.mjs";

test("orthographic projection hides the far hemisphere and responds to rotation", () => {
  assert.equal(orthographicProject(0, 0).visible, true);
  assert.equal(orthographicProject(0, 180).visible, false);
  assert.notEqual(orthographicProject(0, 30).x, orthographicProject(0, 30, .5).x);
});

test("renderer contracts distinguish literal globes and orbital structures", () => {
  assert.equal(bodyVisualContract({ kind: "terrestrial", regions: [] }, { cells: [1, 2] }).kind, "geographic-globe");
  assert.equal(bodyVisualContract({ kind: "giant", atmosphere: "dense", regions: [{}] }).kind, "giant-globe");
  assert.equal(bodyVisualContract({ kind: "station", approach: { dockingNodes: [{}] } }).kind, "station-structure");
});

test("operational overlays stay in the same camera frame as their body models", () => {
  const stationFeature = { id: "dock", position: { x: 100, y: 50, z: 80 } };
  const station = { operationalKind: "station", features: [stationFeature] };
  const base = projectOperationAnchor(station, stationFeature, .55, .3, 1);
  const zoomed = projectOperationAnchor(station, stationFeature, .55, .3, 2);
  assert.ok(Math.abs((zoomed.x - 450) - (base.x - 450) * 2) < 1e-9);
  assert.ok(Math.abs((zoomed.y - 340) - (base.y - 340) * 2) < 1e-9);

  const samePlanarPoint = { id: "dock-z", position: { x: 100, y: 50, z: -80 } };
  const stationWithDepth = { operationalKind: "station", features: [stationFeature, samePlanarPoint] };
  const front = projectOperationAnchor(stationWithDepth, stationFeature, .55, .3, 1);
  const back = projectOperationAnchor(stationWithDepth, samePlanarPoint, .55, .3, 1);
  assert.equal(front.x, back.x);
  assert.equal(front.y, back.y);

  const moonFeature = { id: "site", position: { lat: 0, lon: 90 } };
  const moon = { operationalKind: "natural-solid", features: [moonFeature] };
  const moonPoint = projectOperationAnchor(moon, moonFeature, 0, 0, 2);
  assert.equal(moonPoint.x, 950, "natural-body operations use the globe's full 250px radius at current zoom");
  assert.equal(moonPoint.y, 340);
});

test("body renderer preserves SVG pointer, pinch, wheel, and outward-exit language", () => {
  const source = readFileSync(new URL("../scripts/body-view.mjs", import.meta.url), "utf8");
  for (const token of ["pointerdown", "pointermove", "pointerup", "wheel", "onExitRequested", "setPointerCapture"]) assert.match(source, new RegExp(token));
});

test("non-habitable bodies resolve to substantive metadata-driven visual families", () => {
  assert.equal(schematicVisualProfile({ kind: "moon", system: "Sais", body: "Chandri", regions: [{ type: "crater-provinces", density: "dense" }] }).craters, 34);
  assert.deepEqual(schematicVisualProfile({ kind: "giant", regions: [{ type: "atmospheric-bands", count: 11 }, { type: "storm-systems", count: 5 }] }), { renderer: "giant", bands: 11, storms: 5, palette: undefined });
  assert.equal(schematicVisualProfile({ kind: "shipyard", visualArchetype: "mobile skeletal dock", mobility: "mobile", approach: { dockingNodes: [{}, {}, {}] } }).renderer, "shipyard");
  assert.equal(schematicVisualProfile({ kind: "station", visualArchetype: "orbital crown ring", approach: { dockingNodes: [] } }).renderer, "ring-station");
  assert.equal(schematicVisualProfile({ kind: "asteroid-field", regions: [{ type: "asteroid-population", count: 47 }] }).count, 47);
});

test("renderer contains distinct station, yard, vessel, fleet, gate, megastructure, and natural detail builders", () => {
  const source = readFileSync(new URL("../scripts/body-view.mjs", import.meta.url), "utf8");
  for (const token of ["#buildStation", "#buildShipyard", "#buildVessel", "#buildFleet", "#buildBlinkgate", "#buildMegastructure", "#buildAsteroidField", "oscm-solid-crater", "oscm-giant-band"]) assert.match(source, new RegExp(token));
});

test("body views propagate canonical jurisdiction emblems above every entered body", () => {
  const source = readFileSync(new URL("../scripts/body-view.mjs", import.meta.url), "utf8");
  for (const token of ["ownerFaction", "#buildFactionContext", "oscm-faction-context-marker", "createFactionEmblem"]) assert.match(source, new RegExp(token));
  assert.equal([...source.matchAll(/class: `oscm-faction-context-marker/g)].length, 1, "body view must construct exactly one jurisdiction marker");
});
