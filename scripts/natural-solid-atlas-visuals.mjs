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

function mixedUnit(seed, label, index) {
  const a = hashUnit(`${seed}|${label}|${index * 104729 + 29}|a`);
  const b = hashUnit(`b|${index * 2654435761}|${label}|${seed}`);
  return (a + b * 0.6180339887498949 + index * 0.3819660112501051) % 1;
}

const mapX = (lon, x, width) => x + ((Number(lon) + 180) / 360) * width;
const mapY = (lat, y, height) => y + ((90 - Number(lat)) / 180) * height;

function paletteFor(model) {
  const text = `${model?.palette ?? ""} ${model?.composition ?? ""} ${model?.surfaceCharacter?.surfaceFamily ?? ""}`.toLowerCase();
  if (/ice-rich|icy|ice and regolith|volatile/.test(text)) return ["#263b43", "#58717a", "#9fb8bf", "#d7e6e7"];
  if (/iron|metal-rich|rust|brown|basalt/.test(text)) return ["#2f3030", "#554b43", "#806554", "#a98b6d"];
  if (/carbonaceous|charcoal/.test(text)) return ["#202526", "#3e4544", "#686d68", "#9a9a8e"];
  if (/red|crimson/.test(text)) return ["#351f25", "#65404a", "#94606b", "#c1959c"];
  return ["#2d3336", "#555c5d", "#7f8580", "#acae9f"];
}

function sphericalGrid(x, y, width, height) {
  const lines = [];
  for (let lon = -150; lon < 180; lon += 30) lines.push(`<line x1="${mapX(lon, x, width)}" y1="${y}" x2="${mapX(lon, x, width)}" y2="${y + height}" stroke="#d8edf4" opacity=".10"/>`);
  for (let lat = -60; lat < 90; lat += 30) lines.push(`<line x1="${x}" y1="${mapY(lat, y, height)}" x2="${x + width}" y2="${mapY(lat, y, height)}" stroke="#d8edf4" opacity=".10"/>`);
  return lines.join("");
}

function broadSurface(asset, model, frame) {
  const { x, y, width, height } = frame;
  const seed = asset.permanentOperationalSeed ?? `${asset.system}/${asset.body}`;
  const surface = model?.surfaceCharacter ?? asset.surfaceSurvey?.profile ?? {};
  const colors = paletteFor(model);
  const shapes = [];
  const provinceCount = /ice-rich/.test(surface.surfaceFamily ?? "") ? 14 : surface.activeResurfacing ? 18 : 16;
  for (let i = 0; i < provinceCount; i += 1) {
    const cx = x + mixedUnit(seed, "province-x", i) * width;
    const cy = y + mixedUnit(seed, "province-y", i) * height;
    const rx = 90 + mixedUnit(seed, "province-rx", i) * 280;
    const ry = 35 + mixedUnit(seed, "province-ry", i) * 125;
    const fill = colors[1 + (i % Math.max(1, colors.length - 1))];
    const opacity = (0.055 + mixedUnit(seed, "province-opacity", i) * 0.08).toFixed(3);
    const angle = (-22 + mixedUnit(seed, "province-angle", i) * 44).toFixed(1);
    shapes.push(`<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="${fill}" opacity="${opacity}" transform="rotate(${angle} ${cx.toFixed(1)} ${cy.toFixed(1)})"/>`);
  }

  const craterTextureCount = Math.round(4 + Number(surface.craterRetentionIndex ?? 0.55) * 12);
  for (let i = 0; i < craterTextureCount; i += 1) {
    const cx = x + mixedUnit(seed, "texture-crater-x", i) * width;
    const cy = y + mixedUnit(seed, "texture-crater-y", i) * height;
    const r = 8 + mixedUnit(seed, "texture-crater-r", i) * 24;
    shapes.push(`<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${(r * 1.3).toFixed(1)}" ry="${r.toFixed(1)}" fill="none" stroke="#111820" stroke-width="2" opacity=".12"/>`);
  }

  if (surface.activeResurfacing) {
    const count = Number(surface.activityIndex ?? 0) >= 0.8 ? 5 : 3;
    for (let i = 0; i < count; i += 1) {
      const cx = x + mixedUnit(seed, "resurface-x", i) * width;
      const cy = y + mixedUnit(seed, "resurface-y", i) * height;
      const rx = 120 + mixedUnit(seed, "resurface-rx", i) * 260;
      const ry = 18 + mixedUnit(seed, "resurface-ry", i) * 55;
      shapes.push(`<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="${colors[0]}" opacity=".13" transform="rotate(${(-30 + mixedUnit(seed, "resurface-a", i) * 60).toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)})"/>`);
    }
  }

  if (surface.atmosphereWorked) {
    for (let i = 0; i < 4; i += 1) {
      const yy = y + height * (0.34 + i * 0.085);
      shapes.push(`<path d="M ${x} ${yy.toFixed(1)} Q ${(x + width * .25).toFixed(1)} ${(yy - 12).toFixed(1)} ${(x + width * .5).toFixed(1)} ${yy.toFixed(1)} T ${(x + width).toFixed(1)} ${(yy + 4).toFixed(1)}" fill="none" stroke="${colors[3]}" stroke-width="9" opacity=".09"/>`);
    }
  }

  const volatile = Number(surface.volatilePct ?? 0);
  if (volatile >= 4) {
    const cap = clamp(28 + volatile * 1.7, 36, height * 0.28);
    const opacity = clamp(0.16 + volatile / 190, 0.18, 0.68);
    shapes.push(`<rect x="${x}" y="${y}" width="${width}" height="${cap}" fill="#d8e9ec" opacity="${opacity.toFixed(3)}"/>`);
    shapes.push(`<rect x="${x}" y="${(y + height - cap).toFixed(1)}" width="${width}" height="${cap}" fill="#d8e9ec" opacity="${opacity.toFixed(3)}"/>`);
    if (volatile >= 35) {
      for (let i = 0; i < 4; i += 1) {
        const cx = x + mixedUnit(seed, "ice-province-x", i) * width;
        const cy = y + height * (0.18 + mixedUnit(seed, "ice-province-y", i) * 0.64);
        shapes.push(`<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${(90 + mixedUnit(seed, "ice-province-r", i) * 170).toFixed(1)}" ry="${(28 + mixedUnit(seed, "ice-province-ry", i) * 75).toFixed(1)}" fill="#e1f0f2" opacity=".22"/>`);
      }
    }
  }

  return `<defs><linearGradient id="natural-solid-surface-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${colors[2]}"/><stop offset=".48" stop-color="${colors[1]}"/><stop offset="1" stop-color="${colors[0]}"/></linearGradient></defs><rect x="${x}" y="${y}" width="${width}" height="${height}" fill="url(#natural-solid-surface-bg)"/>${shapes.join("")}${sphericalGrid(x, y, width, height)}`;
}

function featureRadius(feature, model, width) {
  const bodyRadius = Math.max(1, Number(model?.radiusKm ?? 1000));
  const radiusKm = Number(feature.dimensions?.radius ?? 0);
  const angular = radiusKm > 0 ? radiusKm / bodyRadius * 180 / Math.PI : 0;
  return clamp(angular / 360 * width, 7, 68);
}

function featureShape(asset, model, feature, index, frame) {
  const { x, y, width, height } = frame;
  const px = mapX(feature.position?.lon ?? 0, x, width);
  const py = mapY(feature.position?.lat ?? 0, y, height);
  const r = featureRadius(feature, model, width);
  const label = index + 1;
  if (["crater", "basin"].includes(feature.type)) return `<g><ellipse cx="${px}" cy="${py}" rx="${r * 1.35}" ry="${r}" fill="#111820" opacity=".18" stroke="#efe6d4" stroke-width="2"/><ellipse cx="${px + r * .12}" cy="${py + r * .08}" rx="${r * .75}" ry="${r * .58}" fill="#07111f" opacity=".20"/></g>`;
  if (feature.type === "ice") return `<ellipse cx="${px}" cy="${py}" rx="${Math.max(18, r * 1.8)}" ry="${Math.max(10, r)}" fill="#e5f4f6" opacity=".72" stroke="#a9d5df" stroke-width="2"/>`;
  if (feature.type === "ridge") return `<path d="M ${px - r * 2.6} ${py + r * .3} Q ${px - r} ${py - r} ${px} ${py} T ${px + r * 2.6} ${py - r * .4}" fill="none" stroke="#e7d9bf" stroke-width="5" opacity=".8"/>`;
  if (feature.type === "scarp") return `<path d="M ${px - r * 2.4} ${py - r * .3} L ${px - r} ${py + r * .4} L ${px} ${py - r * .25} L ${px + r} ${py + r * .55} L ${px + r * 2.4} ${py}" fill="none" stroke="#d6c4a6" stroke-width="4" opacity=".72"/>`;
  if (feature.type === "rift") return `<path d="M ${px - r * 2.1} ${py - r} Q ${px - r * .6} ${py + r * .4} ${px} ${py} T ${px + r * 2.1} ${py + r}" fill="none" stroke="#351f24" stroke-width="6" stroke-dasharray="14 8" opacity=".8"/>`;
  if (feature.type === "volcanic") return `<g><ellipse cx="${px}" cy="${py}" rx="${r * 1.5}" ry="${r}" fill="#302321" opacity=".28" stroke="#c8865a" stroke-width="3"/><ellipse cx="${px}" cy="${py}" rx="${r * .52}" ry="${r * .34}" fill="#171516" opacity=".65"/></g>`;
  if (feature.type === "dune") return `<g>${[-1,0,1].map((offset) => `<path d="M ${px-r*2} ${py+offset*7} Q ${px-r} ${py-8+offset*7} ${px} ${py+offset*7} T ${px+r*2} ${py+offset*7}" fill="none" stroke="#ead7a6" stroke-width="3" opacity=".58"/>`).join("")}</g>`;
  if (feature.type === "deposit") return `<ellipse cx="${px}" cy="${py}" rx="${Math.max(18, r * 1.55)}" ry="${Math.max(11, r)}" fill="#e2c769" opacity=".10" stroke="#e2c769" stroke-width="3" stroke-dasharray="8 6"/>`;
  if (feature.type === "hazard") return `<circle cx="${px}" cy="${py}" r="${Math.max(18, r)}" fill="#d76534" opacity=".15" stroke="#ef8a4b" stroke-width="3" stroke-dasharray="10 7"/>`;
  const installation = ["mine", "habitat", "landing", "observatory"].includes(feature.type);
  if (installation) return `<g><rect x="${px - 8}" y="${py - 8}" width="16" height="16" transform="rotate(45 ${px} ${py})" fill="#f3c64e" stroke="#07111f" stroke-width="3"/><text x="${px + 13}" y="${py - 11}" fill="#fff" font-family="monospace" font-size="14" font-weight="700">${label}</text></g>`;
  return "";
}

function routes(asset, frame) {
  const { x, y, width, height } = frame;
  const byId = new Map(asset.features.map((feature) => [feature.id, feature]));
  return asset.features.filter((feature) => ["corridor", "route"].includes(feature.type)).flatMap((feature) => {
    const start = { x: mapX(feature.position?.lon ?? 0, x, width), y: mapY(feature.position?.lat ?? 0, y, height) };
    return (feature.refs ?? []).map((ref) => byId.get(ref)).filter(Boolean).map((target) => {
      const end = { x: mapX(target.position?.lon ?? 0, x, width), y: mapY(target.position?.lat ?? 0, y, height) };
      return `<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="#71ddd6" stroke-width="3" stroke-dasharray="9 8" opacity=".8"/>`;
    });
  }).join("");
}

export function renderNaturalSolidSurvey(asset, model, frame) {
  const features = asset.features.map((feature, index) => featureShape(asset, model, feature, index, frame)).join("");
  return `${broadSurface(asset, model, frame)}${routes(asset, frame)}${features}<rect x="${frame.x}" y="${frame.y}" width="${frame.width}" height="${frame.height}" fill="none" stroke="#0b7ead" stroke-width="4"/>`;
}

export function naturalSolidProfileLines(model) {
  const surface = model?.surfaceCharacter ?? {};
  return [
    `- Visual class: ${model?.kind ?? "natural solid"}`,
    `- Radius: ${model?.radiusKm ?? "unknown"} km`,
    `- Composition: ${model?.composition ?? "canonically unspecified"}`,
    `- Representative temperature: ${model?.temperatureC ?? "unknown"} °C`,
    `- Atmosphere: ${model?.atmosphere ?? "canonically unspecified"}`,
    `- Palette: ${model?.palette ?? "canonically unspecified"}`,
    `- Surface family: ${surface.surfaceFamily ?? "rock/regolith surface"}`,
    `- Crater retention: ${surface.craterRetentionLabel ?? "unestablished"}`,
    `- Geologic expression: ${surface.activityLabel ?? "unestablished"}`,
    `- Volatile expression: ${surface.volatileExpression ?? "unestablished"}`,
    `- Resource profile: ${model?.resourceProfile ?? "canonically unspecified"}`,
    `- Radiation profile: ${model?.radiationProfile ?? "canonically unspecified"}`,
    `- Surface exploitation: ${surface.exploitationLabel ?? "no established surface exploitation"}`,
    `- Surface-survey provenance: ${surface.provenance ?? "derived / deterministic working canon"}`,
  ];
}
