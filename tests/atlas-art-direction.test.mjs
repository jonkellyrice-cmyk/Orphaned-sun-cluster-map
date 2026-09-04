import assert from "node:assert/strict";
import test from "node:test";

import {
  NATURAL_BODY_ART_DIRECTION,
  LEGACY_OPERATIONAL_ART_DIRECTION,
  LEGACY_PLANETARY_ART_DIRECTION,
  applyNaturalBodyArtDirection,
} from "../scripts/atlas-art-direction.mjs";

const entry = (overrides) => ({
  id: "test",
  mapType: "operational",
  subtype: "station",
  informationPacket: `## Art-direction constraint\n\n${LEGACY_OPERATIONAL_ART_DIRECTION}\n\n## Feature key`,
  ...overrides,
});

test("natural-body atlas entries receive the shared Orphaned Sun art direction", () => {
  const bundle = {
    entries: [
      entry({ id: "planet", mapType: "planetary", subtype: "planetary-cartography", informationPacket: `## Art-direction constraint\n\n${LEGACY_PLANETARY_ART_DIRECTION}\n\n## Legend` }),
      entry({ id: "moon", subtype: "natural-solid" }),
      entry({ id: "giant", subtype: "giant" }),
      entry({ id: "station", subtype: "station" }),
      entry({ id: "vessel", subtype: "vessel" }),
    ],
  };

  const migrated = applyNaturalBodyArtDirection(bundle);
  for (const id of ["planet", "moon", "giant"]) {
    assert.match(migrated.entries.find((item) => item.id === id).informationPacket, new RegExp(NATURAL_BODY_ART_DIRECTION.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.equal(migrated.entries.find((item) => item.id === "station").informationPacket, bundle.entries.find((item) => item.id === "station").informationPacket);
  assert.equal(migrated.entries.find((item) => item.id === "vessel").informationPacket, bundle.entries.find((item) => item.id === "vessel").informationPacket);
});

test("natural-body art-direction migration is idempotent", () => {
  const source = { entries: [entry({ id: "moon", subtype: "natural-solid" })] };
  const once = applyNaturalBodyArtDirection(source);
  const twice = applyNaturalBodyArtDirection(once);
  assert.deepEqual(twice, once);
});
