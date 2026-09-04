import { renderOperationalAtlasBody, operationalProfileLines } from "./atlas-operational-visuals.mjs";
import { sha256 } from "./atlas-snapshot.mjs";
import { renderSuperstructureAtlas, superstructureProfileLines } from "./superstructure-atlas-visuals.mjs";
import { renderSuperstructureOperationalOverlay } from "./superstructure-operational-overlay.mjs";

const xml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");
const slug = (value) => String(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function position2d(feature, spherical) {
  const p = feature.position ?? {};
  return spherical ? { a: Number(p.lon ?? 0), b: Number(p.lat ?? 0) } : { a: Number(p.x ?? 0), b: Number(p.y ?? 0) };
}

function baseSvg(title, subtitle, body, sidebar, footer = "") {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="1400" viewBox="0 0 2400 1400">
<rect width="2400" height="1400" fill="#07111f"/><rect x="28" y="28" width="2344" height="1344" rx="18" fill="#f4f0e5" stroke="#1c9aca" stroke-width="4"/>
<text x="70" y="78" fill="#c52d31" font-family="monospace" font-size="25" font-weight="700">ORPHANED SUN // FROZEN ATLAS SNAPSHOT</text>
<text x="70" y="130" fill="#091728" font-family="Georgia,serif" font-size="48" font-weight="700">${xml(title)}</text>
<text x="70" y="166" fill="#53616d" font-family="monospace" font-size="20">${xml(subtitle)}</text>
${body}${sidebar}
<line x1="70" y1="1320" x2="2330" y2="1320" stroke="#9aa8ad"/><text x="70" y="1352" fill="#53616d" font-family="monospace" font-size="17">${xml(footer)}</text>
</svg>`;
}

function superstructureArtDirection(identity) {
  if (!identity) return ["Treat the attached schematic as structurally authoritative. Preserve the named components, their relative positions, major approach vectors, hazards, and functional relationships while adding high-fidelity visual design."];
  return [
    "STRUCTURE=attached structural plate is authoritative for macro-silhouette, primary axes, relative massing, signature structures, structural-zone relationships, docking/approach logic, and named operational features",
    "SCALE=city-scale or larger inhabited superstructure; never interpret as a conventional small spacecraft, ordinary station, or lightly crewed platform",
    "EXTERIOR=preserve object-specific silhouette and faction design grammar; add high-fidelity local structure without changing the established macroform",
    "CROSS_SECTION=preserve the exterior envelope and listed structural-zone order/relationships; infer deck, room, conduit, transit, and local machinery detail only inside those bounded zones",
    `FACTION=${identity.factionLabel}; ${identity.factionDesignGrammar}`,
    "DETAIL=high information / low noise; city-scale habitation, transit, logistics, engineering and civic infrastructure should be visibly plausible",
    "TEXT=no invented labels, names, lore, slogans, heraldry, or annotations beyond supplied canon",
    `DO_NOT=${identity.prohibitedMisreadings.join("; ")}`,
  ];
}

function packet(asset, model, sourcePath, sourceHash) {
  const spherical = asset.coordinateFrame.id.includes("spherical") || asset.coordinateFrame.id.includes("observation");
  const identity = model?.superstructure ?? null;
  const profile = [...operationalProfileLines(asset, model), ...superstructureProfileLines(identity)];
  const lines = [
    `# ${asset.body} — Frozen Operational Reference`, "", `- System: ${asset.system}`, `- Canonical type: ${asset.canonicalType}`,
    `- Operational kind: ${asset.operationalKind}`, `- Coordinate frame: ${asset.coordinateFrame.id}`, `- Geometry: ${asset.coordinateFrame.geometryKind}`,
    `- Source: ${sourcePath}`, `- Source SHA-256: ${sourceHash}`, `- Source fingerprint: ${asset.canonicalSourceFingerprint}`, `- Canon status: ${asset.acceptedCanonStatus}`, "",
    "## Visual / physical profile", "", ...profile, "",
    identity ? "## Superstructure generation contract" : "## Art-direction constraint", "", ...superstructureArtDirection(identity), "",
    "## Feature key", "",
  ];
  asset.features.forEach((feature, index) => {
    const p = position2d(feature, spherical);
    const coordinate = spherical ? `${p.b}° latitude, ${p.a}° longitude` : `x ${p.a}, y ${p.b}, z ${feature.position?.z ?? 0}`;
    const dimensions = feature.dimensions ? `; dimensions: ${Object.entries(feature.dimensions).map(([key, value]) => `${key}=${value}`).join(", ")}` : "";
    lines.push(`${index + 1}. **${feature.name}** — ${feature.type}; ${feature.operationalRole}; ${coordinate}${dimensions}${feature.resource ? `; resource: ${feature.resource}` : ""}${feature.hazard ? `; hazard: ${feature.hazard}` : ""}`);
  });
  return lines.join("\n");
}

export function snapshotOperationalRich(asset, model, sourcePath, sourceText) {
  const sourceHash = sha256(sourceText);
  const x = 80, y = 230, width = 1740, height = 870;
  const frame = { x, y, width, height };
  const identity = model?.superstructure ?? null;
  const body = identity
    ? `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#081725"/>${renderSuperstructureAtlas(identity, frame)}${renderSuperstructureOperationalOverlay(asset, frame)}<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="none" stroke="#0b7ead" stroke-width="4"/>`
    : renderOperationalAtlasBody(asset, model, frame);
  const key = asset.features.slice(0, 26).map((feature, index) => `<text x="1870" y="${260 + index * 36}" fill="#172637" font-family="monospace" font-size="17"><tspan fill="#c52d31" font-weight="700">${String(index + 1).padStart(2, "0")}</tspan> ${xml(feature.name)}</text>`).join("");
  const sidebar = `<text x="1870" y="220" fill="#147ca6" font-family="monospace" font-size="22" font-weight="700">FEATURE KEY</text>${key}<text x="1870" y="1230" fill="#53616d" font-family="monospace" font-size="16">Full feature packet accompanies this image.</text>`;
  const natural = ["natural-solid", "giant"].includes(asset.operationalKind);
  const subtitle = natural
    ? `${asset.system} system // ${asset.operationalKind === "giant" ? "atmospheric" : "surface"} survey chart`
    : identity
      ? `${asset.system} system // city-scale superstructure identity / operational plate`
      : `${asset.system} system // ${asset.operationalKind} structural / operational plate`;
  return {
    id: `${slug(asset.system)}--${slug(asset.body)}`,
    name: asset.body,
    system: asset.system,
    mapType: "operational",
    subtype: asset.operationalKind,
    sourcePath,
    sourceSha256: sourceHash,
    sourceFingerprint: asset.canonicalSourceFingerprint,
    canonStatus: asset.acceptedCanonStatus,
    referenceSvg: baseSvg(asset.body, subtitle, body, sidebar, `${asset.features.length} surveyed features // frozen source ${sourceHash.slice(0, 16)}`),
    informationPacket: packet(asset, model, sourcePath, sourceHash),
  };
}
