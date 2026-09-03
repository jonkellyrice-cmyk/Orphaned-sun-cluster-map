import crypto from "node:crypto";
import zlib from "node:zlib";

const xml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

const slug = (value) => String(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

function encodePng(width, height, pixels) {
  const scanlines = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const target = y * (width * 4 + 1); scanlines[target] = 0;
    pixels.copy(scanlines, target + 1, y * width * 4, (y + 1) * width * 4);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4);
  header[8] = 8; header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", zlib.deflateSync(scanlines, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

const BIOME_COLORS = {
  "open-ocean": [38, 91, 132], "tropical-ocean": [30, 116, 145], "sea-ice": [190, 218, 225],
  "ice-cap": [220, 229, 226], tundra: [155, 166, 142], taiga: [73, 105, 79],
  "cold-desert": [177, 153, 116], "hot-desert": [196, 146, 78], savanna: [170, 162, 82],
  steppe: [146, 142, 83], "tropical-rainforest": [36, 103, 56], "temperate-rainforest": [48, 104, 72],
  "seasonal-forest": [74, 119, 68], "temperate-forest": [85, 121, 76],
};

function planetRaster(world) {
  const { latCount, lonCount } = world.grid;
  const pixels = Buffer.alloc(latCount * lonCount * 4);
  const elevations = world.raster.elevationM;
  const biomeIndexes = Buffer.from(world.raster.biome.valuesBase64, "base64");
  for (let index = 0; index < pixels.length / 4; index += 1) {
    const biome = world.raster.biome.categories[biomeIndexes[index]];
    const elevation = elevations[index];
    const base = BIOME_COLORS[biome] ?? [112, 121, 102];
    const relief = elevation > 0 ? Math.max(-22, Math.min(38, elevation / 180)) : Math.max(-24, elevation / 320);
    pixels[index * 4] = Math.max(0, Math.min(255, base[0] + relief));
    pixels[index * 4 + 1] = Math.max(0, Math.min(255, base[1] + relief));
    pixels[index * 4 + 2] = Math.max(0, Math.min(255, base[2] + relief));
    pixels[index * 4 + 3] = 255;
  }
  return encodePng(lonCount, latCount, pixels).toString("base64");
}

const mapX = (lon, x, width) => x + ((lon + 180) / 360) * width;
const mapY = (lat, y, height) => y + ((90 - lat) / 180) * height;
const points = (items, x, y, width, height) => items.map(([lat, lon]) => `${mapX(lon, x, width).toFixed(1)},${mapY(lat, y, height).toFixed(1)}`).join(" ");

function wrappedPolyline(items, x, y, width, height, attributes) {
  const segments = []; let current = [];
  for (const item of items) {
    if (current.length && Math.abs(item[1] - current.at(-1)[1]) > 180) { segments.push(current); current = []; }
    current.push(item);
  }
  if (current.length) segments.push(current);
  return segments.filter((segment) => segment.length > 1)
    .map((segment) => `<polyline points="${points(segment, x, y, width, height)}" ${attributes}/>`).join("");
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

function planetPacket(world, sourcePath, sourceHash) {
  const groups = new Map();
  for (const item of world.gazetteer) {
    if (!groups.has(item.featureClass)) groups.set(item.featureClass, []);
    groups.get(item.featureClass).push(item);
  }
  const lines = [
    `# ${world.body} — Frozen Cartographic Reference`, "", `- System: ${world.system}`,
    `- Projection: Equirectangular`, `- Source: ${sourcePath}`, `- Source SHA-256: ${sourceHash}`,
    `- Source fingerprint: ${world.sourceFingerprint}`, `- Canon status: ${world.status}`, "",
    "## Art-direction constraint", "",
    "Treat the attached snapshot as structurally authoritative. Preserve the relative positions and topology of continents, coastlines, named regions, waterways, settlements, and routes. Add fine visual detail and polish without relocating or replacing established features.", "",
    "## Legend", "", "- Blue: oceans and seas", "- Green: forest and productive biomes", "- Ochre: steppe, savanna, and deserts", "- White/pale blue: ice and glaciers", "- Blue lines: rivers", "- Cyan lines: transport corridors", "- Numbered circles: settlements", "",
    "## Settlements", "",
    ...world.settlements.map((item, index) => `${index + 1}. **${item.properName}** — ${item.role}; ${item.kind}; ${item.lat}°, ${item.lon}°`), "",
    "## Gazetteer", "",
  ];
  for (const [featureClass, items] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`### ${featureClass[0].toUpperCase()}${featureClass.slice(1)}`, "");
    for (const item of items) lines.push(`- **${item.properName}** — ${item.scientificClassification}; ${item.at[0]}°, ${item.at[1]}°`);
    lines.push("");
  }
  lines.push("## Transport routes", "", ...world.transportRoutes.map((item) => `- **${item.properName}** — ${item.kind}; ${item.from} → ${item.to}`), "");
  return lines.join("\n");
}

export function snapshotPlanet(world, sourcePath, sourceText) {
  const sourceHash = sha256(sourceText); const x = 65, y = 205, width = 1800, height = 900;
  const raster = planetRaster(world);
  const grid = [];
  for (let lon = -150; lon < 180; lon += 30) grid.push(`<line x1="${mapX(lon, x, width)}" y1="${y}" x2="${mapX(lon, x, width)}" y2="${y + height}" stroke="#fff" opacity=".16"/>`);
  for (let lat = -60; lat < 90; lat += 30) grid.push(`<line x1="${x}" y1="${mapY(lat, y, height)}" x2="${x + width}" y2="${mapY(lat, y, height)}" stroke="#fff" opacity=".16"/>`);
  const rivers = world.hydrology.rivers.map((river) => wrappedPolyline(river.points, x, y, width, height, 'fill="none" stroke="#51b7e8" stroke-width="3" stroke-linecap="round" opacity=".9"')).join("");
  const routes = world.transportRoutes.map((route) => wrappedPolyline(route.points, x, y, width, height, 'fill="none" stroke="#7ee8df" stroke-width="2" stroke-dasharray="8 7" opacity=".82"')).join("");
  const settlements = world.settlements.map((item, index) => `<g><circle cx="${mapX(item.lon, x, width)}" cy="${mapY(item.lat, y, height)}" r="13" fill="#f3c64e" stroke="#07111f" stroke-width="3"/><text x="${mapX(item.lon, x, width)}" y="${mapY(item.lat, y, height) + 6}" text-anchor="middle" font-family="monospace" font-weight="700" font-size="16" fill="#07111f">${index + 1}</text></g>`).join("");
  const markers = world.gazetteer.map((item) => `<circle cx="${mapX(item.at[1], x, width)}" cy="${mapY(item.at[0], y, height)}" r="3" fill="#fff" opacity=".72"/>`).join("");
  const body = `<defs><clipPath id="map"><rect x="${x}" y="${y}" width="${width}" height="${height}"/></clipPath></defs><rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#173b5b" stroke="#0b7ead" stroke-width="4"/><g clip-path="url(#map)"><image href="data:image/png;base64,${raster}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="none" image-rendering="pixelated"/>${grid.join("")}${rivers}${routes}${markers}${settlements}</g>`;
  const names = world.settlements.slice(0, 18).map((item, index) => `<text x="1915" y="${300 + index * 34}" fill="#172637" font-family="monospace" font-size="18"><tspan fill="#c52d31" font-weight="700">${String(index + 1).padStart(2, "0")}</tspan> ${xml(item.properName)}</text>`).join("");
  const sidebar = `<text x="1915" y="230" fill="#147ca6" font-family="monospace" font-size="22" font-weight="700">SETTLEMENT KEY</text>${names}<text x="1915" y="950" fill="#147ca6" font-family="monospace" font-size="22" font-weight="700">MAP LEGEND</text><rect x="1915" y="980" width="22" height="22" fill="#265b84"/><text x="1950" y="998" font-family="monospace" font-size="17">Ocean</text><rect x="1915" y="1015" width="22" height="22" fill="#55794c"/><text x="1950" y="1033" font-family="monospace" font-size="17">Forest / productive</text><rect x="1915" y="1050" width="22" height="22" fill="#b19968"/><text x="1950" y="1068" font-family="monospace" font-size="17">Drylands</text><line x1="1915" y1="1102" x2="1938" y2="1102" stroke="#51b7e8" stroke-width="4"/><text x="1950" y="1108" font-family="monospace" font-size="17">River</text><line x1="1915" y1="1137" x2="1938" y2="1137" stroke="#27a7a0" stroke-width="4" stroke-dasharray="5 4"/><text x="1950" y="1143" font-family="monospace" font-size="17">Transport route</text><text x="1915" y="1200" fill="#53616d" font-family="monospace" font-size="16">Full gazetteer accompanies this image.</text>`;
  return {
    id: `${slug(world.system)}--${slug(world.body)}`, name: world.body, system: world.system,
    mapType: "planetary", subtype: "planetary-cartography", sourcePath, sourceSha256: sourceHash,
    sourceFingerprint: world.sourceFingerprint, canonStatus: world.status,
    referenceSvg: baseSvg(world.body, `${world.system} system // equirectangular planetary chart`, body, sidebar, `${world.gazetteer.length} named features // ${world.settlements.length} settlements // frozen source ${sourceHash.slice(0, 16)}`),
    informationPacket: planetPacket(world, sourcePath, sourceHash),
  };
}

function position2d(feature, spherical) {
  const p = feature.position ?? {};
  return spherical ? { a: Number(p.lon ?? 0), b: Number(p.lat ?? 0) } : { a: Number(p.x ?? 0), b: Number(p.y ?? 0) };
}

function operationalPacket(asset, sourcePath, sourceHash) {
  const spherical = asset.coordinateFrame.id.includes("spherical") || asset.coordinateFrame.id.includes("observation");
  const lines = [
    `# ${asset.body} — Frozen Operational Reference`, "", `- System: ${asset.system}`, `- Canonical type: ${asset.canonicalType}`,
    `- Operational kind: ${asset.operationalKind}`, `- Coordinate frame: ${asset.coordinateFrame.id}`, `- Geometry: ${asset.coordinateFrame.geometryKind}`,
    `- Source: ${sourcePath}`, `- Source SHA-256: ${sourceHash}`, `- Source fingerprint: ${asset.canonicalSourceFingerprint}`, `- Canon status: ${asset.acceptedCanonStatus}`, "",
    "## Art-direction constraint", "", "Treat the attached schematic as structurally authoritative. Preserve the named components, their relative positions, major approach vectors, hazards, and functional relationships while adding high-fidelity visual design.", "",
    "## Feature key", "",
  ];
  asset.features.forEach((feature, index) => {
    const p = position2d(feature, spherical);
    const coordinate = spherical ? `${p.b}° latitude, ${p.a}° longitude` : `x ${p.a}, y ${p.b}, z ${feature.position?.z ?? 0}`;
    lines.push(`${index + 1}. **${feature.name}** — ${feature.type}; ${feature.operationalRole}; ${coordinate}${feature.hazard ? `; hazard: ${feature.hazard}` : ""}`);
  });
  return lines.join("\n");
}

export function snapshotOperational(asset, sourcePath, sourceText) {
  const sourceHash = sha256(sourceText);
  const spherical = asset.coordinateFrame.id.includes("spherical") || asset.coordinateFrame.id.includes("observation");
  const x = 80, y = 230, width = 1740, height = 870;
  const positions = asset.features.map((feature) => position2d(feature, spherical));
  const minA = spherical ? -180 : Math.min(...positions.map((p) => p.a), -1), maxA = spherical ? 180 : Math.max(...positions.map((p) => p.a), 1);
  const minB = spherical ? -90 : Math.min(...positions.map((p) => p.b), -1), maxB = spherical ? 90 : Math.max(...positions.map((p) => p.b), 1);
  const px = (value) => x + 50 + ((value - minA) / Math.max(1, maxA - minA)) * (width - 100);
  const py = (value) => y + height - 50 - ((value - minB) / Math.max(1, maxB - minB)) * (height - 100);
  const featureById = new Map(asset.features.map((feature) => [feature.id, feature]));
  const refs = asset.features.flatMap((feature) => (feature.refs ?? []).map((ref) => [feature, featureById.get(ref)])).filter((pair) => pair[1]).map(([a, b]) => { const pa = position2d(a, spherical), pb = position2d(b, spherical); return `<line x1="${px(pa.a)}" y1="${py(pa.b)}" x2="${px(pb.a)}" y2="${py(pb.b)}" stroke="#4f92ae" stroke-width="3" opacity=".55"/>`; }).join("");
  const marks = asset.features.map((feature, index) => { const p = position2d(feature, spherical); const hazard = feature.layer === "hazards" || feature.hazard; return `<g><circle cx="${px(p.a)}" cy="${py(p.b)}" r="${feature.lodPriority === 1 ? 16 : 11}" fill="${hazard ? "#d86b32" : "#39a7c9"}" stroke="#07111f" stroke-width="3"/><text x="${px(p.a)}" y="${py(p.b) + 6}" text-anchor="middle" font-family="monospace" font-size="15" font-weight="700" fill="#fff">${index + 1}</text></g>`; }).join("");
  const body = `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#0b1c2c" stroke="#0b7ead" stroke-width="4"/><g>${refs}${marks}</g><text x="${x}" y="${y + height + 42}" fill="#53616d" font-family="monospace" font-size="18">${xml(asset.coordinateFrame.axes ?? asset.coordinateFrame.origin)} // ${spherical ? "equirectangular survey" : "top-down X/Y projection; Z retained in packet"}</text>`;
  const key = asset.features.slice(0, 26).map((feature, index) => `<text x="1870" y="${260 + index * 36}" fill="#172637" font-family="monospace" font-size="17"><tspan fill="#c52d31" font-weight="700">${String(index + 1).padStart(2, "0")}</tspan> ${xml(feature.name)}</text>`).join("");
  const sidebar = `<text x="1870" y="220" fill="#147ca6" font-family="monospace" font-size="22" font-weight="700">FEATURE KEY</text>${key}<text x="1870" y="1230" fill="#53616d" font-family="monospace" font-size="16">Full feature packet accompanies this image.</text>`;
  return {
    id: `${slug(asset.system)}--${slug(asset.body)}`, name: asset.body, system: asset.system,
    mapType: "operational", subtype: asset.operationalKind, sourcePath, sourceSha256: sourceHash,
    sourceFingerprint: asset.canonicalSourceFingerprint, canonStatus: asset.acceptedCanonStatus,
    referenceSvg: baseSvg(asset.body, `${asset.system} system // ${asset.operationalKind} operational schematic`, body, sidebar, `${asset.features.length} surveyed features // frozen source ${sourceHash.slice(0, 16)}`),
    informationPacket: operationalPacket(asset, sourcePath, sourceHash),
  };
}

export function createAtlasBundle(planetEntries, operationalEntries, sources) {
  const entries = [...planetEntries, ...operationalEntries].sort((a, b) => a.system.localeCompare(b.system) || a.name.localeCompare(b.name));
  const ids = new Set();
  for (const entry of entries) {
    if (ids.has(entry.id)) throw new Error(`Duplicate snapshot id: ${entry.id}`);
    ids.add(entry.id);
  }
  return {
    schemaVersion: 1, status: "frozen-atlas-snapshot", projectionPolicy: "materialized-assets-only",
    sourceManifests: sources,
    counts: { planetary: planetEntries.length, operational: operationalEntries.length, total: entries.length },
    entries,
  };
}
