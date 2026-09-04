import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { snapshotOperationalRich } from "../scripts/atlas-snapshot-v2.mjs";
import { buildArtificialBodyModel } from "../scripts/artificial-body-data.mjs";
import { buildNaturalBodyModel } from "../scripts/natural-body-data.mjs";
import { parseCsv } from "../scripts/system-data.mjs";

const ROOT = path.resolve(".");
const registry = parseCsv(fs.readFileSync(path.join(ROOT, "docs/system-orbital-distances.csv"), "utf8"));
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "data/body-operations/manifest.json"), "utf8"));
const rowFor = (system, body) => registry.find((row) => row.system === system && row.object === body);
const assetFor = (system, body) => {
  const item = manifest.assets.find((candidate) => candidate.system === system && candidate.body === body);
  assert.ok(item, `missing body-operations manifest entry for ${system}/${body}`);
  const sourceText = fs.readFileSync(path.join(ROOT, item.path), "utf8");
  return { item, sourceText, asset: JSON.parse(sourceText) };
};

function superstructureSnapshot(system, body) {
  const row = rowFor(system, body);
  assert.ok(row, `missing registry row for ${system}/${body}`);
  const { item, sourceText, asset } = assetFor(system, body);
  return snapshotOperationalRich(asset, buildArtificialBodyModel(row, asset), item.path, sourceText);
}

test("Pilgrim's Lantern preserves its system-art Lantern/spindle identity and cross-section contract", () => {
  const snapshot = superstructureSnapshot("Memphis", "Pilgrim's Lantern");
  assert.match(snapshot.referenceSvg, /data-superstructure-family="conclave-lantern-spindle"/);
  assert.match(snapshot.referenceSvg, /data-section-logic="true"/);
  assert.match(snapshot.referenceSvg, /data-operational-overlay="true"/);
  assert.match(snapshot.informationPacket, /SCALE=city-scale or larger inhabited superstructure/);
  assert.match(snapshot.informationPacket, /monumental lantern\/halo ring/i);
  assert.match(snapshot.informationPacket, /CROSS_SECTION=/);
  assert.match(snapshot.informationPacket, /Gothic cathedral verticality fused with Tibetan shrine\/reliquary massing/i);
});

test("major faction silhouettes remain structurally distinct", () => {
  const pilgrim = superstructureSnapshot("Memphis", "Pilgrim's Lantern");
  const crown = superstructureSnapshot("Iunu", "Asterion Crown");
  const meridian = superstructureSnapshot("Sais", "Mandate Meridian");
  assert.match(crown.referenceSvg, /data-superstructure-family="accord-crown-spindle"/);
  assert.match(meridian.referenceSvg, /data-superstructure-family="mandate-concentric-meridian"/);
  assert.notEqual(pilgrim.referenceSvg, crown.referenceSvg);
  assert.notEqual(crown.referenceSvg, meridian.referenceSvg);
  assert.match(crown.informationPacket, /outrun, outmaneuver and outgun/i);
  assert.match(meridian.informationPacket, /perfected geometry/i);
});

test("distributed superstructures remain networks rather than generic single stations", () => {
  const arrowfall = superstructureSnapshot("Seti", "Arrowfall Range");
  const halo = superstructureSnapshot("Nekhen", "Halo of Hierava");
  assert.match(arrowfall.referenceSvg, /data-superstructure-family="mandate-distributed-range"/);
  assert.match(halo.referenceSvg, /data-superstructure-family="conclave-orbital-halo"/);
  assert.match(arrowfall.informationPacket, /distributed military megacity network/i);
  assert.match(halo.informationPacket, /planetary-orbital megacity network/i);
});

test("natural bodies remain outside the superstructure rendering and packet contract", () => {
  const row = rowFor("Iunu", "Eilevost");
  assert.ok(row);
  const { item, sourceText, asset } = assetFor("Iunu", "Eilevost");
  const snapshot = snapshotOperationalRich(asset, buildNaturalBodyModel(row), item.path, sourceText);
  assert.doesNotMatch(snapshot.referenceSvg, /data-superstructure=/);
  assert.doesNotMatch(snapshot.informationPacket, /Superstructure generation contract/);
  assert.doesNotMatch(snapshot.informationPacket, /SCALE=city-scale or larger/);
});
