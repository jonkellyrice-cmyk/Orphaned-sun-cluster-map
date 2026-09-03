import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

import { createAtlasBundle, snapshotOperational, snapshotPlanet } from "../scripts/atlas-snapshot.mjs";

test("planet snapshot serializes existing materialized coordinates without regeneration", () => {
  const sourcePath = "data/planet-cartography/abydos/eventide.json";
  const source = fs.readFileSync(sourcePath, "utf8");
  const snapshot = snapshotPlanet(JSON.parse(source), sourcePath, source);
  assert.equal(snapshot.name, "Eventide");
  assert.match(snapshot.referenceSvg, /Nacreward Crown/);
  assert.match(snapshot.informationPacket, /Ramseslight Flow/);
  assert.equal(snapshot.sourcePath, sourcePath);
});

test("operational snapshot preserves committed feature names and coordinates", () => {
  const sourcePath = "data/body-operations/abydos/vada-anchorage.json";
  const source = fs.readFileSync(sourcePath, "utf8");
  const snapshot = snapshotOperational(JSON.parse(source), sourcePath, source);
  assert.equal(snapshot.name, "Vada Anchorage");
  assert.match(snapshot.referenceSvg, /Primary Hub/);
  assert.match(snapshot.informationPacket, /x 0, y 0, z 0/);
});

test("bundle rejects overlap instead of silently replacing a frozen map", () => {
  const entry = { id: "same", system: "A", name: "B" };
  assert.throws(() => createAtlasBundle([entry], [entry], []), /Duplicate snapshot id/);
});
