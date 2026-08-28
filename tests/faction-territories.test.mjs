import test from "node:test";
import assert from "node:assert/strict";
import { SYSTEMS } from "../scripts/cluster-data.mjs";
import { FACTION_TERRITORIES, buildTerritoryFaces, territoryDepthAt } from "../scripts/faction-territories.mjs";

const bySystem = Object.fromEntries(SYSTEMS.map((system) => [system.name, system]));
const byTerritory = Object.fromEntries(FACTION_TERRITORIES.map((territory) => [territory.id, territory]));

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const crosses = (a.y > point.y) !== (b.y > point.y)
      && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

test("faction map defines five controlled volumes plus Grayspace", () => {
  assert.equal(FACTION_TERRITORIES.length, 6);
  assert.deepEqual(
    new Set(FACTION_TERRITORIES.map((territory) => territory.id)),
    new Set(["eventide", "accords", "conclave", "mandate", "union", "grayspace"]),
  );
});

test("territory volumes have valid depth and complete faces", () => {
  for (const territory of FACTION_TERRITORIES) {
    assert.ok(territory.zMin < territory.zMax);
    assert.ok(territory.footprint.length >= 3);
    assert.equal(buildTerritoryFaces(territory).length, territory.footprint.length + 2);
    for (const point of territory.footprint) {
      assert.ok(point.x >= -8 && point.x <= 8);
      assert.ok(point.y >= -8 && point.y <= 8);
      const depth = territoryDepthAt(territory, point.x, point.y);
      assert.ok(depth.zMin < depth.zMax);
      assert.ok(depth.zMin >= -8 && depth.zMax <= 8);
    }
  }
});

test("front and rear depth boundaries vary across every territory footprint", () => {
  for (const territory of FACTION_TERRITORIES) {
    const samples = territory.footprint.map(({ x, y }) => territoryDepthAt(territory, x, y));
    const frontRange = Math.max(...samples.map((sample) => sample.zMin)) - Math.min(...samples.map((sample) => sample.zMin));
    const rearRange = Math.max(...samples.map((sample) => sample.zMax)) - Math.min(...samples.map((sample) => sample.zMax));
    assert.ok(frontRange > 0.2, `${territory.name} should have a visibly non-flat front depth boundary`);
    assert.ok(rearRange > 0.2, `${territory.name} should have a visibly non-flat rear depth boundary`);
  }
});

test("2D footprints preserve the faction-map placement of the Big Ten", () => {
  const expected = {
    Abydos: "eventide",
    Tanis: "accords",
    Thebes: "mandate",
    Memphis: "conclave",
    Iunu: "accords",
    Saqqara: "accords",
    Nekhen: "conclave",
    Sais: "mandate",
    Seti: "conclave",
    Amarna: "union",
  };

  for (const [systemName, territoryId] of Object.entries(expected)) {
    const system = bySystem[systemName];
    const territory = byTerritory[territoryId];
    assert.ok(pointInPolygon(system, territory.footprint), `${systemName} should lie inside ${territory.name}`);

    const localDepth = territoryDepthAt(territory, system.x, system.y);
    assert.ok(system.z >= localDepth.zMin && system.z <= localDepth.zMax, `${systemName} should lie within ${territory.name}'s local warped depth`);
    assert.ok(Math.abs(localDepth.zMin - territory.zMin) < 1e-9, `${systemName} should pin the local front boundary to its nominal envelope`);
    assert.ok(Math.abs(localDepth.zMax - territory.zMax) < 1e-9, `${systemName} should pin the local rear boundary to its nominal envelope`);
  }
});
