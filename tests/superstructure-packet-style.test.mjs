import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const bundle = JSON.parse(fs.readFileSync(new URL("../exports/generated-maps.bundle.json", import.meta.url), "utf8"));
const superstructures = bundle.entries.filter((entry) => entry.informationPacket.includes("## Superstructure generation contract"));
const naturalOrLegacy = bundle.entries.filter((entry) => !entry.informationPacket.includes("## Superstructure generation contract"));

const required = [
  "STRUCTURE=",
  "SCALE=",
  "EXTERIOR=",
  "CROSS_SECTION=",
  "FACTION=",
  "RENDER=high-fidelity Orphaned Sun superstructure atlas artwork",
  "SOURCE=attached structural plate + packet metadata",
  "STYLE=painterly sci-fi technical atlas; hand-painted mechanical/architectural illustration; same visual family as Orphaned Sun planetary atlases",
  "DETAIL=high information / low noise; macroform first; functional secondary systems second",
  "SCALE_CUES=communicate immense inhabited scale",
  "INTERIOR=hierarchical city-like zoning",
  "LIGHT=restrained functional navigation, habitation, docking, and service illumination",
  "AVOID=AI greebling; recursive panel subdivision",
  "TEXT=no invented labels, names, lore, slogans, heraldry, or annotations beyond supplied canon",
  "DO_NOT=",
];

test("all and only 28 artificial superstructures carry the normalized technical-atlas style contract", () => {
  assert.equal(superstructures.length, 28);
  assert.equal(naturalOrLegacy.length, 86);
  for (const entry of superstructures) {
    for (const directive of required) assert.ok(entry.informationPacket.includes(directive), `${entry.name} missing ${directive}`);
  }
  for (const entry of naturalOrLegacy) {
    assert.equal(entry.informationPacket.includes("RENDER=high-fidelity Orphaned Sun superstructure atlas artwork"), false, `${entry.name} leaked superstructure style contract`);
  }
});
