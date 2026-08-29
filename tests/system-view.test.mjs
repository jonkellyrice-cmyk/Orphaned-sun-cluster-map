import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../scripts/system-view.mjs", import.meta.url), "utf8");

test("system renderer provides the canonical SVG interaction language", () => {
  assert.match(source, /export class SystemView/);
  assert.match(source, /pointerdown/);
  assert.match(source, /pointermove/);
  assert.match(source, /wheel/);
  assert.match(source, /keydown/);
  assert.match(source, /suppressClickUntil/);
});

test("system renderer has distinct schematic glyphs", () => {
  for (const token of ["belt-glyph", "anomaly-glyph", "installation-glyph", "vessel-glyph"]) assert.match(source, new RegExp(token));
});

test("system renderer uses display positions but retains physical model objects", () => {
  assert.match(source, /displayPosition\(object, this\.model\)/);
  assert.match(source, /this\.origin = object/);
  assert.match(source, /this\.destination = object/);
});

test("system jurisdiction emblem stays screen-upright above the canonical star anchor", () => {
  for (const token of ["factionPresentationForOwner", "oscm-faction-context-marker", "factionAnchorObjects", "ownerFaction"]) assert.match(source, new RegExp(token));
  assert.equal([...source.matchAll(/class: `oscm-faction-context-marker/g)].length, 1, "system view must construct exactly one jurisdiction marker");
});
