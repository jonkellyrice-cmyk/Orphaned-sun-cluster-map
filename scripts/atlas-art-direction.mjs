export const NATURAL_BODY_ART_DIRECTION = [
  "RENDER=high-fidelity Orphaned Sun atlas artwork",
  "SOURCE=attached primitive geometry + packet metadata",
  "STYLE=painterly sci-fi atlas; hand-painted; cohesive; atmospheric; naturalistic; broad-to-medium form hierarchy; selective crisp detail",
  "DETAIL=high information / low noise",
  "AVOID=AI greebling; fractal subdivision; recursive detail; repetitive microforms; arbitrary seams; excessive jaggedness; speckling; clutter; filler detail",
].join("\n");

export const LEGACY_PLANETARY_ART_DIRECTION = "Treat the attached snapshot as structurally authoritative. Preserve the relative positions and topology of continents, coastlines, named regions, waterways, settlements, and routes. Add fine visual detail and polish without relocating or replacing established features.";

export const LEGACY_OPERATIONAL_ART_DIRECTION = "Treat the attached schematic as structurally authoritative. Preserve the named components, their relative positions, major approach vectors, hazards, and functional relationships while adding high-fidelity visual design.";

const NATURAL_OPERATIONAL_KINDS = new Set(["natural-solid", "giant"]);

export function isNaturalBodyAtlasEntry(entry) {
  return entry?.mapType === "planetary"
    || (entry?.mapType === "operational" && NATURAL_OPERATIONAL_KINDS.has(entry?.subtype));
}

function replaceNaturalBodyDirection(entry) {
  if (!isNaturalBodyAtlasEntry(entry)) return entry;
  if (entry.informationPacket.includes(NATURAL_BODY_ART_DIRECTION)) return entry;

  const legacy = entry.mapType === "planetary"
    ? LEGACY_PLANETARY_ART_DIRECTION
    : LEGACY_OPERATIONAL_ART_DIRECTION;

  const occurrences = entry.informationPacket.split(legacy).length - 1;
  if (occurrences !== 1) {
    throw new Error(`Expected exactly one legacy art-direction block in ${entry.id}; found ${occurrences}.`);
  }

  return {
    ...entry,
    informationPacket: entry.informationPacket.replace(legacy, NATURAL_BODY_ART_DIRECTION),
  };
}

export function applyNaturalBodyArtDirection(bundle) {
  if (!bundle || !Array.isArray(bundle.entries)) throw new Error("Atlas bundle is missing entries.");
  return {
    ...bundle,
    entries: bundle.entries.map(replaceNaturalBodyDirection),
  };
}
