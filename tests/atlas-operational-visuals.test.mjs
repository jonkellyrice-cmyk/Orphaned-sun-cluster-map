import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

import { buildArtificialBodyModel } from "../scripts/artificial-body-data.mjs";
import { snapshotOperationalRich } from "../scripts/atlas-snapshot-v2.mjs";
import { buildNaturalBodyModel } from "../scripts/natural-body-data.mjs";
import { parseCsv } from "../scripts/system-data.mjs";

const rows = parseCsv(fs.readFileSync("docs/system-orbital-distances.csv", "utf8"));
const row = (system, object) => rows.find((item) => item.system === system && item.object === object);
const asset = (path) => JSON.parse(fs.readFileSync(path, "utf8"));

test("natural-solid reference renders a complete deterministic surface survey", () => {
  const path = "data/body-operations/abydos/cataphract.json";
  const source = fs.readFileSync(path, "utf8"), operations = JSON.parse(source);
  const snapshot = snapshotOperationalRich(operations, buildNaturalBodyModel(row("Abydos", "Cataphract")), path, source);
  assert.match(snapshot.referenceSvg, /surface survey chart/);
  assert.match(snapshot.referenceSvg, /surface-bg/);
  assert.match(snapshot.referenceSvg, /Crater Mariner Reach/);
  assert.match(snapshot.informationPacket, /Visual \/ physical profile/);
  assert.match(snapshot.informationPacket, /iron-rich silicate rock/);
});

test("giant reference renders atmospheric bands and canonical visual profile", () => {
  const path = "data/body-operations/abydos/sumatra.json";
  const source = fs.readFileSync(path, "utf8"), operations = JSON.parse(source);
  const snapshot = snapshotOperationalRich(operations, buildNaturalBodyModel(row("Abydos", "Sumatra")), path, source);
  assert.match(snapshot.referenceSvg, /atmospheric survey chart/);
  assert.match(snapshot.referenceSvg, /stroke-width=/);
  assert.match(snapshot.informationPacket, /blue-gray \/ charcoal bands/);
});

test("station reference combines canonical structure model with operational geometry", () => {
  const path = "data/body-operations/abydos/thornwatch-array.json";
  const source = fs.readFileSync(path, "utf8"), operations = JSON.parse(source);
  const snapshot = snapshotOperationalRich(operations, buildArtificialBodyModel(row("Abydos", "Thornwatch Array"), operations), path, source);
  assert.match(snapshot.referenceSvg, /structural \/ operational plate/);
  assert.match(snapshot.referenceSvg, /Primary Hub/);
  assert.match(snapshot.referenceSvg, /<ellipse/);
  assert.match(snapshot.informationPacket, /sparse chain of watch stations/);
  assert.match(snapshot.informationPacket, /distributed watch\/sensor-defense array/);
});
