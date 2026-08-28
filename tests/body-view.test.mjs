import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bodyVisualContract, orthographicProject } from "../scripts/body-view.mjs";

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

test("body renderer preserves SVG pointer, pinch, wheel, and outward-exit language", () => {
  const source = readFileSync(new URL("../scripts/body-view.mjs", import.meta.url), "utf8");
  for (const token of ["pointerdown", "pointermove", "pointerup", "wheel", "onExitRequested", "setPointerCapture"]) assert.match(source, new RegExp(token));
});
