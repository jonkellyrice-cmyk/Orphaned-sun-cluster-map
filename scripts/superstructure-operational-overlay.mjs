function projectFactory(asset, frame) {
  const positions = asset.features.map((feature) => feature.position ?? {});
  const max = Math.max(1, ...positions.flatMap((p) => [Math.abs(Number(p.x) || 0), Math.abs(Number(p.y) || 0)]));
  return (position) => ({
    x: frame.x + frame.width / 2 + (Number(position?.x) || 0) / max * frame.width * .40,
    y: frame.y + frame.height * .42 - (Number(position?.y) || 0) / max * frame.height * .30,
  });
}

export function renderSuperstructureOperationalOverlay(asset, frame) {
  if (!asset?.features?.length) return "";
  const project = projectFactory(asset, frame);
  const byId = new Map(asset.features.map((feature) => [feature.id, feature]));
  const refs = asset.features.flatMap((feature) => (feature.refs ?? []).map((ref) => [feature, byId.get(ref)]))
    .filter((pair) => pair[1])
    .map(([a, b]) => {
      const pa = project(a.position), pb = project(b.position);
      return `<line x1="${pa.x}" y1="${pa.y}" x2="${pb.x}" y2="${pb.y}" stroke="#65bdd0" stroke-width="3" opacity=".32" stroke-dasharray="8 7"/>`;
    }).join("");
  const markers = asset.features.map((feature, index) => {
    const p = project(feature.position);
    const danger = feature.type === "hazard" || feature.hazard;
    const docking = ["dock", "hangar", "berth", "aperture"].includes(feature.type);
    const fill = danger ? "#d86b32" : docking ? "#f0bf4d" : "#65bdd0";
    const shape = docking
      ? `<rect x="${p.x - 7}" y="${p.y - 7}" width="14" height="14" transform="rotate(45 ${p.x} ${p.y})" fill="${fill}" stroke="#07111f" stroke-width="2"/>`
      : `<circle cx="${p.x}" cy="${p.y}" r="${danger ? 8 : 6}" fill="${fill}" stroke="#07111f" stroke-width="2"/>`;
    return `<g data-operational-feature="${feature.id}">${shape}<text x="${p.x + 10}" y="${p.y - 8}" fill="#edf5f6" font-family="monospace" font-size="11" font-weight="700">${index + 1}</text></g>`;
  }).join("");
  return `<g data-operational-overlay="true">${refs}${markers}</g>`;
}
