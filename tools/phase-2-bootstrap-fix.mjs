import fs from "node:fs";

const path = "tools/generated-maps-phase-2-natural-solid-cartography.mjs";
const before = 'hashUnit(\\`${identity}/storms\\`)';
const after = 'hashUnit(identity + "/storms")';
const source = fs.readFileSync(path, "utf8");
if (source.includes(after)) {
  console.log("[phase-2-bootstrap] migration quoting already fixed");
} else {
  if (!source.includes(before)) throw new Error("Expected Phase 2 migration quoting target was not found");
  fs.writeFileSync(path, source.replace(before, after));
  console.log("[phase-2-bootstrap] fixed migration quoting");
}
