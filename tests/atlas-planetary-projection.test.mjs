import assert from "node:assert/strict";
import zlib from "node:zlib";
import { test } from "node:test";

import { snapshotPlanet } from "../scripts/atlas-snapshot.mjs";

function embeddedPngRows(svg, width, height) {
  const match = svg.match(/data:image\/png;base64,([^\"]+)/);
  assert.ok(match, "snapshot did not embed a PNG raster");
  const png = Buffer.from(match[1], "base64");
  const idat = [];
  let offset = 8;
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.subarray(offset + 4, offset + 8).toString("ascii");
    const data = png.subarray(offset + 8, offset + 8 + length);
    if (type === "IDAT") idat.push(data);
    offset += 12 + length;
    if (type === "IEND") break;
  }
  const scanlines = zlib.inflateSync(Buffer.concat(idat));
  const stride = 1 + width * 4;
  return Array.from({ length: height }, (_, row) => {
    assert.equal(scanlines[row * stride], 0, "atlas PNG encoder should use filter type 0");
    return scanlines.subarray(row * stride + 1, row * stride + stride);
  });
}

test("planetary atlas raster is north-up while materialized grid remains south-to-north", () => {
  const world = {
    system: "Test",
    body: "Orientation",
    ownerFaction: "Test Faction",
    civilizationProfile: {
      ownerFaction: "Test Faction",
      settlementPattern: "test settlement pattern",
      dominantSettlementPattern: "test dominant pattern",
      majorPopulationCorridors: "test population corridors",
      urbanConcentration: "test concentration",
      majorCityCountBand: "0",
      likelyTransportGeography: "test transport geography",
    },
    sourceFingerprint: "orientation-test",
    status: "test",
    grid: { latCount: 2, lonCount: 1 },
    raster: {
      elevationM: [0, 0],
      biome: {
        categories: ["hot-desert", "open-ocean"],
        // Source row 0 is SOUTH (-90); source row 1 is NORTH (+90).
        valuesBase64: Buffer.from([0, 1]).toString("base64"),
      },
    },
    hydrology: { rivers: [] },
    settlements: [],
    gazetteer: [],
    transportRoutes: [],
  };

  const snapshot = snapshotPlanet(world, "test/orientation.json", JSON.stringify(world));
  const [top, bottom] = embeddedPngRows(snapshot.referenceSvg, 1, 2);

  // Top of an equirectangular atlas is +90° north: open-ocean blue.
  assert.deepEqual([...top.subarray(0, 4)], [38, 91, 132, 255]);
  // Bottom is -90° south: hot-desert ochre.
  assert.deepEqual([...bottom.subarray(0, 4)], [196, 146, 78, 255]);
});
