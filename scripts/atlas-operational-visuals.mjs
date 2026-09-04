const xml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function hashUnit(text) {
  let value = 2166136261;
  for (const char of String(text)) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return (value >>> 0) / 4294967295;
}

const mapX = (lon, x, width) => x + ((Number(lon) + 180) / 360) * width;
const mapY = (lat, y, height) => y + ((90 - Number(lat)) / 180) * height;

function paletteFor(model, kind) {
  const text = `${model?.palette ?? ""} ${model?.composition ?? ""}`.toLowerCase();
  if (kind === "giant") {
    if (/blue|methane|ice giant/.test(text)) return ["#102b46", "#315f7c", "#6f93a8", "#a8c5cf"];
    if (/rust|amber|orange/.test(text)) return ["#55392d", "#9a6744", "#caa06c", "#ead6a7"];
    return ["#4c493e", "#83735c", "#b6a27e", "#e1d2b1"];
  }
  if (/ice|icy|volatile/.test(text)) return ["#263b43", "#58717a", "#9fb8bf", "#d7e6e7"];
  if (/iron|rust|brown|basalt/.test(text)) return ["#2f3030", "#554b43", "#806554", "#a98b6d"];
  if (/red|crimson/.test(text)) return ["#351f25", "#65404a", "#94606b", "#c1959c"];
  if (/jade|green|viridian/.test(text)) return ["#203631", "#41655c", "#739086", "#aabdb3"];
  return ["#2d3336", "#555c5d", "#7f8580", "#acae9f"];
}

function grid(x, y, width, height, spherical = false) {
  const lines = [];
  if (spherical) {
    for (let lon = -150; lon < 180; lon += 30) lines.push(`<line x1="${mapX(lon, x, width)}" y1="${y}" x2="${mapX(lon, x, width)}" y2="${y + height}" stroke="#d8edf4" opacity=".10"/>`);
    for (let lat = -60; lat < 90; lat += 30) lines.push(`<line x1="${x}" y1="${mapY(lat, y, height)}" x2="${x + width}" y2="${mapY(lat, y, height)}" stroke="#d8edf4" opacity=".10"/>`);
  } else {
    for (let i = 1; i < 10; i += 1) lines.push(`<line x1="${x + width * i / 10}" y1="${y}" x2="${x + width * i / 10}" y2="${y + height}" stroke="#d8edf4" opacity=".07"/>`);
    for (let i = 1; i < 6; i += 1) lines.push(`<line x1="${x}" y1="${y + height * i / 6}" x2="${x + width}" y2="${y + height * i / 6}" stroke="#d8edf4" opacity=".07"/>`);
  }
  return lines.join("");
}

function naturalSurfaceTexture(asset, model, x, y, width, height) {
  const colors = paletteFor(model, "solid");
  const seed = asset.permanentOperationalSeed ?? `${asset.system}/${asset.body}`;
  const shapes = [];
  for (let i = 0; i < 42; i += 1) {
    const cx = x + hashUnit(`${seed}/province/x/${i}`) * width;
    const cy = y + hashUnit(`${seed}/province/y/${i}`) * height;
    const rx = 55 + hashUnit(`${seed}/province/rx/${i}`) * 210;
    const ry = 20 + hashUnit(`${seed}/province/ry/${i}`) * 90;
    const fill = colors[1 + (i % Math.max(1, colors.length - 1))];
    const opacity = (.05 + hashUnit(`${seed}/province/o/${i}`) * .09).toFixed(3);
    shapes.push(`<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="${fill}" opacity="${opacity}" transform="rotate(${(-18 + hashUnit(`${seed}/province/a/${i}`) * 36).toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)})"/>`);
  }
  const volatile = Number(model?.regions?.find((item) => item.type === "ice-or-volatile-deposits")?.coveragePct ?? 0);
  if (volatile > 5) {
    const cap = clamp(35 + volatile * 1.8, 45, height * .24);
    shapes.push(`<rect x="${x}" y="${y}" width="${width}" height="${cap}" fill="#d8e9ec" opacity="${clamp(.18 + volatile / 180, .2, .62)}"/>`);
    shapes.push(`<rect x="${x}" y="${y + height - cap}" width="${width}" height="${cap}" fill="#d8e9ec" opacity="${clamp(.18 + volatile / 180, .2, .62)}"/>`);
  }
  return `<defs><linearGradient id="surface-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${colors[2]}"/><stop offset=".48" stop-color="${colors[1]}"/><stop offset="1" stop-color="${colors[0]}"/></linearGradient></defs><rect x="${x}" y="${y}" width="${width}" height="${height}" fill="url(#surface-bg)"/>${shapes.join("")}${grid(x, y, width, height, true)}`;
}

function naturalFeatureShape(asset, model, feature, index, x, y, width, height) {
  const px = mapX(feature.position?.lon ?? 0, x, width);
  const py = mapY(feature.position?.lat ?? 0, y, height);
  const bodyRadius = Math.max(1, Number(model?.radiusKm ?? 1000));
  const radiusKm = Number(feature.dimensions?.radius ?? 0);
  const angular = radiusKm > 0 ? radiusKm / bodyRadius * 180 / Math.PI : 0;
  const r = clamp(angular / 360 * width, 7, 62);
  const label = index + 1;
  if (["crater", "basin"].includes(feature.type)) return `<g><ellipse cx="${px}" cy="${py}" rx="${r * 1.35}" ry="${r}" fill="#111820" opacity=".18" stroke="#efe6d4" stroke-width="2"/><ellipse cx="${px + r * .12}" cy="${py + r * .08}" rx="${r * .75}" ry="${r * .58}" fill="#07111f" opacity=".20"/></g>`;
  if (feature.type === "ice") return `<ellipse cx="${px}" cy="${py}" rx="${Math.max(18, r * 1.8)}" ry="${Math.max(10, r)}" fill="#e5f4f6" opacity=".72" stroke="#a9d5df" stroke-width="2"/>`;
  if (feature.type === "ridge") return `<path d="M ${px - r * 2.6} ${py + r * .3} Q ${px - r} ${py - r} ${px} ${py} T ${px + r * 2.6} ${py - r * .4}" fill="none" stroke="#e7d9bf" stroke-width="5" opacity=".8"/>`;
  if (feature.type === "rift") return `<path d="M ${px - r * 2.1} ${py - r} Q ${px - r * .6} ${py + r * .4} ${px} ${py} T ${px + r * 2.1} ${py + r}" fill="none" stroke="#351f24" stroke-width="6" stroke-dasharray="14 8" opacity=".8"/>`;
  if (feature.type === "hazard") return `<circle cx="${px}" cy="${py}" r="${Math.max(18, r)}" fill="#d76534" opacity=".15" stroke="#ef8a4b" stroke-width="3" stroke-dasharray="10 7"/>`;
  const installation = ["mine", "habitat", "landing", "observatory"].includes(feature.type);
  if (installation) return `<g><rect x="${px - 8}" y="${py - 8}" width="16" height="16" transform="rotate(45 ${px} ${py})" fill="#f3c64e" stroke="#07111f" stroke-width="3"/><text x="${px + 13}" y="${py - 11}" fill="#fff" font-family="monospace" font-size="14" font-weight="700">${label}</text></g>`;
  return "";
}

function naturalRoutes(asset, x, y, width, height) {
  const byId = new Map(asset.features.map((feature) => [feature.id, feature]));
  return asset.features.filter((feature) => ["corridor", "route"].includes(feature.type)).flatMap((feature) => {
    const start = { x: mapX(feature.position?.lon ?? 0, x, width), y: mapY(feature.position?.lat ?? 0, y, height) };
    return (feature.refs ?? []).map((ref) => byId.get(ref)).filter(Boolean).map((target) => {
      const end = { x: mapX(target.position?.lon ?? 0, x, width), y: mapY(target.position?.lat ?? 0, y, height) };
      return `<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="#71ddd6" stroke-width="3" stroke-dasharray="9 8" opacity=".8"/>`;
    });
  }).join("");
}

function renderNaturalSolid(asset, model, frame) {
  const { x, y, width, height } = frame;
  const features = asset.features.map((feature, index) => naturalFeatureShape(asset, model, feature, index, x, y, width, height)).join("");
  return `${naturalSurfaceTexture(asset, model, x, y, width, height)}${naturalRoutes(asset, x, y, width, height)}${features}<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="none" stroke="#0b7ead" stroke-width="4"/>`;
}

function renderGiant(asset, model, frame) {
  const { x, y, width, height } = frame;
  const colors = paletteFor(model, "giant");
  const bands = asset.features.filter((feature) => feature.type === "band");
  const stripes = bands.length ? bands : Array.from({ length: 8 }, (_, index) => ({ position: { lat: 70 - index * 20 }, dimensions: { widthDeg: 16 } }));
  const shapes = stripes.map((feature, index) => {
    const cy = mapY(feature.position?.lat ?? 0, y, height);
    const h = clamp(Number(feature.dimensions?.widthDeg ?? 12) / 180 * height, 24, 95);
    return `<path d="M ${x} ${cy} Q ${x + width * .25} ${cy - h * .18} ${x + width * .5} ${cy} T ${x + width} ${cy}" fill="none" stroke="${colors[index % colors.length]}" stroke-width="${h}" opacity=".92"/>`;
  }).join("");
  const storms = asset.features.filter((feature) => ["storm", "vortex"].includes(feature.type)).map((feature, index) => {
    const px = mapX(feature.position?.lon ?? 0, x, width), py = mapY(feature.position?.lat ?? 0, y, height);
    const radiusKm = Number(feature.dimensions?.radius ?? 5000);
    const r = clamp(radiusKm / 18000 * 55, 16, 70);
    return `<g><ellipse cx="${px}" cy="${py}" rx="${r * 1.8}" ry="${r}" fill="none" stroke="#efe4c1" stroke-width="5" opacity=".82"/><ellipse cx="${px}" cy="${py}" rx="${r}" ry="${r * .45}" fill="#6f493c" opacity=".55"/><text x="${px + r * 1.9}" y="${py - 4}" fill="#fff" font-family="monospace" font-size="14">${index + 1}</text></g>`;
  }).join("");
  const operations = asset.features.filter((feature) => ["platform", "corridor", "hazard"].includes(feature.type)).map((feature, index) => {
    const px = mapX(feature.position?.lon ?? 0, x, width), py = mapY(feature.position?.lat ?? 0, y, height);
    return `<g><circle cx="${px}" cy="${py}" r="10" fill="${feature.type === "hazard" ? "#d86b32" : "#39a7c9"}" stroke="#07111f" stroke-width="3"/><text x="${px + 14}" y="${py - 10}" fill="#fff" font-family="monospace" font-size="13">${xml(feature.name ?? index + 1)}</text></g>`;
  }).join("");
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${colors[0]}"/>${shapes}${grid(x, y, width, height, true)}${storms}${operations}<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="none" stroke="#0b7ead" stroke-width="4"/>`;
}

function normalizedCartesian(asset, frame) {
  const { x, y, width, height } = frame;
  const positions = asset.features.map((feature) => feature.position ?? {});
  const max = Math.max(1, ...positions.flatMap((p) => [Math.abs(Number(p.x) || 0), Math.abs(Number(p.y) || 0)]));
  return (position) => ({ x: x + width / 2 + (Number(position?.x) || 0) / max * width * .39, y: y + height / 2 - (Number(position?.y) || 0) / max * height * .39 });
}

function ghostStructure(asset, model, frame) {
  const { x, y, width, height } = frame;
  const cx = x + width / 2, cy = y + height / 2;
  const kind = asset.operationalKind;
  const archetype = `${model?.visualArchetype ?? ""} ${model?.structureClass ?? ""}`.toLowerCase();
  if (kind === "belt") {
    const seed = asset.permanentOperationalSeed;
    return Array.from({ length: 48 }, (_, index) => {
      const angle = hashUnit(`${seed}/rock/a/${index}`) * Math.PI * 2;
      const dist = 80 + hashUnit(`${seed}/rock/d/${index}`) * Math.min(width, height) * .42;
      const rx = 4 + hashUnit(`${seed}/rock/r/${index}`) * 13;
      return `<ellipse cx="${cx + Math.cos(angle) * dist}" cy="${cy + Math.sin(angle) * dist * .55}" rx="${rx}" ry="${rx * .55}" fill="#7d776a" opacity=".65" transform="rotate(${index * 31} ${cx + Math.cos(angle) * dist} ${cy + Math.sin(angle) * dist * .55})"/>`;
    }).join("") + `<ellipse cx="${cx}" cy="${cy}" rx="${width * .39}" ry="${height * .28}" fill="none" stroke="#5d91a8" stroke-width="2" opacity=".35"/>`;
  }
  if (kind === "anomaly") return Array.from({ length: 8 }, (_, i) => `<ellipse cx="${cx}" cy="${cy}" rx="${90 + i * 34}" ry="${45 + i * 21}" fill="none" stroke="#9b74c8" stroke-width="${2 + i % 2}" opacity="${(.55 - i * .045).toFixed(2)}" transform="rotate(${i * 23} ${cx} ${cy})"/>`).join("");
  if (kind === "blinkgate") return `<circle cx="${cx}" cy="${cy}" r="235" fill="none" stroke="#7bc7dc" stroke-width="30" opacity=".65" stroke-dasharray="82 24"/><circle cx="${cx}" cy="${cy}" r="178" fill="#123347" opacity=".35" stroke="#b9e7ef" stroke-width="4"/>`;
  if (kind === "vessel") return `<path d="M ${cx - 300} ${cy} L ${cx - 175} ${cy - 78} L ${cx + 120} ${cy - 54} L ${cx + 310} ${cy} L ${cx + 120} ${cy + 54} L ${cx - 175} ${cy + 78} Z" fill="#657983" opacity=".32" stroke="#a8cbd4" stroke-width="5"/>`;
  if (kind === "fleet") return [[0,0,1],[-270,-150,.48],[-270,150,.48],[250,-100,.38],[250,100,.38]].map(([dx,dy,s]) => `<path d="M ${cx + dx - 180*s} ${cy + dy} L ${cx + dx - 95*s} ${cy + dy - 40*s} L ${cx + dx + 75*s} ${cy + dy - 30*s} L ${cx + dx + 185*s} ${cy + dy} L ${cx + dx + 75*s} ${cy + dy + 30*s} L ${cx + dx - 95*s} ${cy + dy + 40*s} Z" fill="#657983" opacity=".34" stroke="#a8cbd4" stroke-width="4"/>`).join("");
  if (kind === "shipyard") return `<line x1="${cx - 340}" y1="${cy}" x2="${cx + 340}" y2="${cy}" stroke="#8aa8b2" stroke-width="18" opacity=".34"/>${[-220,0,220].map((dx) => `<rect x="${cx + dx - 62}" y="${cy - 185}" width="124" height="370" fill="none" stroke="#8aa8b2" stroke-width="10" opacity=".38"/>`).join("")}`;
  if (kind === "megastructure" && /tether|linear/.test(archetype)) return `<line x1="${cx}" y1="${cy - 340}" x2="${cx}" y2="${cy + 340}" stroke="#8aa8b2" stroke-width="14" opacity=".45"/>${[-280,-135,0,135,280].map((dy) => `<rect x="${cx - 100}" y="${cy + dy - 12}" width="200" height="24" fill="#66818b" opacity=".45"/>`).join("")}`;
  if (/array|chain|distributed|sparse/.test(archetype)) return [[-330,110],[-150,-110],[30,40],[220,-160],[350,80]].map(([dx,dy], i) => `<g><circle cx="${cx + dx}" cy="${cy + dy}" r="${i === 2 ? 42 : 26}" fill="#425b66" opacity=".52" stroke="#a8cbd4" stroke-width="4"/><ellipse cx="${cx + dx}" cy="${cy + dy}" rx="${i === 2 ? 70 : 48}" ry="${i === 2 ? 24 : 17}" fill="none" stroke="#7eb6c8" stroke-width="3" opacity=".65"/></g>`).join("") + `<polyline points="${cx-330},${cy+110} ${cx-150},${cy-110} ${cx+30},${cy+40} ${cx+220},${cy-160} ${cx+350},${cy+80}" fill="none" stroke="#4f92ae" stroke-width="3" opacity=".35"/>`;
  return `<ellipse cx="${cx}" cy="${cy}" rx="270" ry="105" fill="none" stroke="#89b5c3" stroke-width="18" opacity=".30"/><ellipse cx="${cx}" cy="${cy}" rx="170" ry="66" fill="none" stroke="#89b5c3" stroke-width="10" opacity=".30"/><circle cx="${cx}" cy="${cy}" r="58" fill="#6a828a" opacity=".38"/>${Array.from({ length: 8 }, (_, i) => { const a=i*Math.PI/4; return `<line x1="${cx+Math.cos(a)*58}" y1="${cy+Math.sin(a)*22}" x2="${cx+Math.cos(a)*268}" y2="${cy+Math.sin(a)*103}" stroke="#779aa6" stroke-width="5" opacity=".28"/>`; }).join("")}`;
}

function artificialFeatureShape(feature, index, project) {
  const p = project(feature.position);
  const n = index + 1;
  const label = `<text x="${p.x + 15}" y="${p.y - 12}" fill="#f0f6f8" font-family="monospace" font-size="13" font-weight="700">${n}</text>`;
  if (feature.type === "hub") return `<g><circle cx="${p.x}" cy="${p.y}" r="24" fill="#66b5ca" stroke="#07111f" stroke-width="4"/>${label}</g>`;
  if (feature.type === "reactor" || feature.type === "power") return `<g><polygon points="${p.x},${p.y-20} ${p.x+18},${p.y-10} ${p.x+18},${p.y+10} ${p.x},${p.y+20} ${p.x-18},${p.y+10} ${p.x-18},${p.y-10}" fill="#d66f37" stroke="#07111f" stroke-width="4"/>${label}</g>`;
  if (["module", "control", "engineering", "deck", "gantry", "berth"].includes(feature.type)) return `<g><rect x="${p.x-21}" y="${p.y-13}" width="42" height="26" rx="4" fill="#7db1be" stroke="#07111f" stroke-width="4"/>${label}</g>`;
  if (["dock", "hangar", "aperture"].includes(feature.type)) return `<g><rect x="${p.x-12}" y="${p.y-12}" width="24" height="24" transform="rotate(45 ${p.x} ${p.y})" fill="#f3c64e" stroke="#07111f" stroke-width="4"/>${label}</g>`;
  if (["ring", "segment"].includes(feature.type)) return `<g><ellipse cx="${p.x}" cy="${p.y}" rx="72" ry="28" fill="none" stroke="#72c1d3" stroke-width="7"/>${label}</g>`;
  if (["hull", "ship"].includes(feature.type)) return `<g><path d="M ${p.x-44} ${p.y} L ${p.x-22} ${p.y-16} L ${p.x+20} ${p.y-12} L ${p.x+46} ${p.y} L ${p.x+20} ${p.y+12} L ${p.x-22} ${p.y+16} Z" fill="#8aa6ae" stroke="#07111f" stroke-width="4"/>${label}</g>`;
  if (feature.type === "hazard") return `<g><circle cx="${p.x}" cy="${p.y}" r="38" fill="#d86b32" opacity=".12" stroke="#e97a3d" stroke-width="4" stroke-dasharray="10 7"/>${label}</g>`;
  if (["approach", "corridor", "beacon"].includes(feature.type)) return `<g><circle cx="${p.x}" cy="${p.y}" r="10" fill="#46abc7" stroke="#07111f" stroke-width="3"/>${label}</g>`;
  return `<g><circle cx="${p.x}" cy="${p.y}" r="11" fill="#46abc7" stroke="#07111f" stroke-width="3"/>${label}</g>`;
}

function renderArtificial(asset, model, frame) {
  const { x, y, width, height } = frame;
  const project = normalizedCartesian(asset, frame);
  const byId = new Map(asset.features.map((feature) => [feature.id, feature]));
  const refs = asset.features.flatMap((feature) => (feature.refs ?? []).map((ref) => [feature, byId.get(ref)])).filter((pair) => pair[1]).map(([a, b]) => {
    const pa = project(a.position), pb = project(b.position);
    return `<line x1="${pa.x}" y1="${pa.y}" x2="${pb.x}" y2="${pb.y}" stroke="#59a5bd" stroke-width="4" opacity=".42"/>`;
  }).join("");
  const features = asset.features.map((feature, index) => artificialFeatureShape(feature, index, project)).join("");
  return `<defs><radialGradient id="space-bg"><stop offset="0" stop-color="#102c41"/><stop offset="1" stop-color="#081725"/></radialGradient></defs><rect x="${x}" y="${y}" width="${width}" height="${height}" fill="url(#space-bg)"/>${grid(x, y, width, height, false)}${ghostStructure(asset, model, frame)}${refs}${features}<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="none" stroke="#0b7ead" stroke-width="4"/>`;
}

export function renderOperationalAtlasBody(asset, model, frame) {
  if (asset.operationalKind === "natural-solid") return renderNaturalSolid(asset, model, frame);
  if (asset.operationalKind === "giant") return renderGiant(asset, model, frame);
  return renderArtificial(asset, model, frame);
}

export function operationalProfileLines(asset, model) {
  if (!model) return [];
  if (asset.operationalKind === "natural-solid" || asset.operationalKind === "giant") {
    return [
      `- Visual class: ${model.kind}`,
      `- Radius: ${model.radiusKm ?? "unknown"} km`,
      `- Composition: ${model.composition ?? "canonically unspecified"}`,
      `- Representative temperature: ${model.temperatureC ?? "unknown"} °C`,
      `- Atmosphere: ${model.atmosphere ?? "canonically unspecified"}`,
      `- Palette: ${model.palette ?? "canonically unspecified"}`,
      `- Resource profile: ${model.resourceProfile ?? "canonically unspecified"}`,
      `- Radiation profile: ${model.radiationProfile ?? "canonically unspecified"}`,
    ];
  }
  return [
    `- Structure class: ${model.structureClass ?? asset.canonicalType}`,
    `- Dimensions: ${model.dimensions ?? "schematic; exact dimensions unestablished"}`,
    `- Visual archetype: ${model.visualArchetype ?? asset.operationalKind}`,
    `- Palette: ${model.palette ?? "campaign interface neutral"}`,
    `- Population/crew scale: ${model.population ?? "operational population unspecified"}`,
    `- Gravity: ${model.gravity ?? "varies by occupied section"}`,
    `- Power: ${model.power ?? "canonical infrastructure power"}`,
    `- Mobility: ${model.mobility ?? "fixed reference-epoch position"}`,
    `- Primary function: ${model.function ?? "mapped infrastructure"}`,
    `- Strategic role: ${model.strategicRole ?? "local operations"}`,
  ];
}
