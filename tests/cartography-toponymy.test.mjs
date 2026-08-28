import test from "node:test";
import assert from "node:assert/strict";
import { assignFeatureNames, generateToponym, namingProfileForSystem } from "../scripts/cartography-toponymy.mjs";

test("all ten systems resolve to their canonical controlling naming culture", () => {
  const expected = { Abydos: "vadan", Tanis: "vostrann", Saqqara: "vostrann", Iunu: "vostrann", Memphis: "aurethic", Nekhen: "aurethic", Thebes: "xuanhari", Sais: "xuanhari", Seti: "xuanhari", Amarna: "union" };
  for (const [system, profile] of Object.entries(expected)) assert.equal(namingProfileForSystem(system).id, profile);
});

test("proper names are stable for an accepted seed and feature identity", () => {
  const input = { system: "Nekhen", world: "Hierava", seed: "canon-seed", featureClass: "river", ordinal: 4 };
  assert.deepEqual(generateToponym(input), generateToponym(input));
  assert.equal(generateToponym(input).language, "Aurethic");
});

test("profiles preserve the established linguistic character", () => {
  assert.match(namingProfileForSystem("Memphis").basis, /Hebrew.*Greek.*Latin/);
  assert.match(namingProfileForSystem("Tanis").basis, /Gaelic.*Russian/);
  assert.match(namingProfileForSystem("Sais").basis, /Sinitic.*Sanskrit/);
  assert.match(namingProfileForSystem("Abydos").basis, /Earth-derived/);
  assert.match(namingProfileForSystem("Amarna").basis, /Cosmopolitan Earth/);
});

test("feature assignment is collision-free across a dense planetary gazetteer", () => {
  const classes = ["capital", "city", "port", "ocean", "sea", "river", "lake", "mountain", "range", "continent", "island", "desert", "forest", "wetland", "glacier", "strait", "road", "landmark"];
  for (const system of ["Abydos", "Tanis", "Memphis", "Sais", "Amarna"]) {
    const named = assignFeatureNames({ system, world: "Test", seed: "permanent", features: Array.from({ length: 180 }, (_, index) => ({ id: index, featureClass: classes[index % classes.length] })) });
    assert.equal(new Set(named.map((feature) => feature.properName)).size, named.length, system);
    assert.ok(named.every((feature) => feature.language && feature.namingBasis));
  }
});

test("scientific feature classes are not silently given invented proper-name rules", () => {
  assert.throws(() => generateToponym({ system: "Iunu", world: "Valeth", seed: "x", featureClass: "tectonic-plate" }), /Unsupported/);
});
