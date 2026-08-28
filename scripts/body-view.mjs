const SVG_NS = "http://www.w3.org/2000/svg";
import { buildBodyLayers } from "./body-layers.mjs";
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const svg = (name, attrs = {}) => {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
};

export function orthographicProject(latDeg, lonDeg, yaw = 0, pitch = 0, radius = 250) {
  const lat = latDeg * Math.PI / 180, lon = lonDeg * Math.PI / 180 + yaw;
  const x = Math.cos(lat) * Math.sin(lon), y0 = Math.sin(lat), z0 = Math.cos(lat) * Math.cos(lon);
  const y = y0 * Math.cos(pitch) - z0 * Math.sin(pitch), z = y0 * Math.sin(pitch) + z0 * Math.cos(pitch);
  return { x: x * radius, y: -y * radius, z, visible: z >= 0 };
}

export function bodyVisualContract(model, geography = null) {
  if (geography) return { kind: "geographic-globe", atmosphere: true, features: geography.cells.length };
  if (["terrestrial", "moon", "minor-world", "giant"].includes(model.kind)) return { kind: `${model.kind}-globe`, atmosphere: model.kind === "giant" || model.atmosphere !== "none or negligible", features: model.regions.length };
  return { kind: `${model.kind}-structure`, atmosphere: false, features: model.approach?.dockingNodes?.length ?? 0 };
}

export class BodyView {
  constructor(svgRoot, { model, geography = null, onExitRequested = () => {}, onFeatureSelected = () => {} }) {
    this.svg = svgRoot; this.model = model; this.geography = geography;
    this.onExitRequested = onExitRequested; this.onFeatureSelected = onFeatureSelected;
    this.state = { yaw: -.35, pitch: .18, zoom: 1 }; this.pointers = new Map(); this.drag = null; this.pinch = null; this.exitTriggered = false;
    this.build(); this.attachEvents(); this.render();
  }

  destroy() { for (const [event, handler] of Object.entries(this.listeners)) this.svg.removeEventListener(event, handler); this.svg.replaceChildren(); }
  resetView() { Object.assign(this.state, { yaw: -.35, pitch: .18, zoom: 1 }); this.render(); }
  clearSelection() { this.onFeatureSelected(null); }
  setLayerVisibility(layer, visible) { this.layerGroups?.get(layer)?.classList.toggle("is-hidden", !visible); }

  build() {
    this.svg.replaceChildren(); this.svg.setAttribute("viewBox", "0 0 900 680"); this.svg.classList.add("oscm-body-view");
    const defs = svg("defs"), clip = svg("clipPath", { id: "oscm-body-disc-clip" }); clip.append(svg("circle", { cx: 450, cy: 340, r: 250 })); defs.append(clip);
    this.backdrop = svg("g", { class: "oscm-body-backdrop" });
    this.disc = svg("circle", { class: "oscm-body-disc", cx: 450, cy: 340, r: 250 });
    this.surface = svg("g", { class: "oscm-body-surface", "clip-path": "url(#oscm-body-disc-clip)" });
    this.night = svg("ellipse", { class: "oscm-body-night", cx: 540, cy: 340, rx: 180, ry: 250 });
    this.atmosphere = svg("circle", { class: "oscm-body-atmosphere", cx: 450, cy: 340, r: 256 });
    this.labels = svg("g", { class: "oscm-body-labels" }); this.svg.append(defs, this.backdrop, this.disc, this.surface, this.night, this.atmosphere, this.labels);
    this.featureNodes = [];
    if (this.geography) this.buildGeography(); else this.buildSchematic();
  }

  buildGeography() {
    const layers = buildBodyLayers(this.geography); this.layerGroups = new Map();
    for (const id of ["terrain", "hydrology", "resources", "settlements", "transport"]) { const group = svg("g", { class: `oscm-body-layer is-${id}` }); this.surface.append(group); this.layerGroups.set(id, group); }
    const step = this.geography.resolutionDeg;
    for (const cell of this.geography.cells) {
      const node = svg("rect", { class: `oscm-body-cell biome-${cell.biome}`, width: Math.max(2, step * 2.2), height: Math.max(2, step * 2.2), "data-feature": cell.biome, "data-resource": cell.resource, "data-soil": cell.soil });
      node.addEventListener("click", () => this.onFeatureSelected(cell)); this.layerGroups.get("terrain").append(node); this.featureNodes.push({ node, lat: cell.lat, lon: cell.lon, feature: cell });
    }
    for (const feature of layers.hydrology) {
      const node = svg(feature.kind === "river" ? "line" : "circle", { class: `oscm-body-${feature.kind}`, r: 3, "data-feature": feature.id });
      this.layerGroups.get("hydrology").append(node); this.featureNodes.push(feature.kind === "river" ? { node, lat: feature.from[0], lon: feature.from[1], lat2: feature.to[0], lon2: feature.to[1], feature } : { node, lat: feature.at[0], lon: feature.at[1], feature });
    }
    for (const feature of layers.resources.filter((_, index) => index % 4 === 0)) {
      const node = svg("circle", { class: "oscm-body-resource", r: 2.5, "data-feature": feature.id, "data-resource": feature.resource });
      node.addEventListener("click", () => this.onFeatureSelected(feature)); this.layerGroups.get("resources").append(node); this.featureNodes.push({ node, lat: feature.at[0], lon: feature.at[1], feature });
    }
    for (const site of layers.settlements) {
      const node = svg("circle", { class: `oscm-body-settlement is-${site.kind}`, r: site.kind === "capital" ? 5 : 3, "data-feature": site.id });
      node.addEventListener("click", () => this.onFeatureSelected(site)); this.layerGroups.get("settlements").append(node); this.featureNodes.push({ node, lat: site.lat, lon: site.lon, feature: site });
    }
    for (const route of layers.transport) {
      if (!route.fromSite || !route.toSite) continue;
      const node = svg("line", { class: `oscm-body-transport is-${route.mode}`, "data-feature": route.id }); this.layerGroups.get("transport").append(node);
      this.featureNodes.push({ node, lat: route.fromSite.lat, lon: route.fromSite.lon, lat2: route.toSite.lat, lon2: route.toSite.lon, feature: route });
    }
    this.layerGroups.get("resources").classList.add("is-hidden");
  }

  buildSchematic() {
    const contract = bodyVisualContract(this.model);
    this.disc.classList.add(`is-${contract.kind}`);
    const regions = this.model.regions ?? this.model.approach?.dockingNodes ?? [];
    regions.forEach((region, index) => {
      const angle = index / Math.max(1, regions.length) * Math.PI * 2;
      const node = svg(this.model.approach ? "polygon" : "ellipse", this.model.approach
        ? { class: "oscm-body-docking-node", points: "0,-7 7,7 -7,7", "data-feature": region.id }
        : { class: "oscm-body-region", rx: 38, ry: 18, "data-feature": region.type });
      this.surface.append(node); this.featureNodes.push({ node, schematic: true, x: Math.cos(angle) * 125, y: Math.sin(angle) * 125, feature: region });
    });
  }

  attachEvents() {
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    this.listeners = {
      pointerdown: (event) => { const p = { id: event.pointerId, x: event.clientX, y: event.clientY }; this.pointers.set(p.id, p); this.svg.setPointerCapture?.(p.id); if (this.pointers.size === 1) this.drag = { ...p, yaw: this.state.yaw, pitch: this.state.pitch }; else { const [a, b] = [...this.pointers.values()]; this.drag = null; this.pinch = { distance: dist(a, b), zoom: this.state.zoom }; } },
      pointermove: (event) => { const p = this.pointers.get(event.pointerId); if (!p) return; p.x = event.clientX; p.y = event.clientY; if (this.pinch && this.pointers.size > 1) { const [a, b] = [...this.pointers.values()]; this.changeZoom(this.pinch.zoom * dist(a, b) / this.pinch.distance); } else if (this.drag) { this.state.yaw = this.drag.yaw + (event.clientX - this.drag.x) * .008; this.state.pitch = clamp(this.drag.pitch + (event.clientY - this.drag.y) * .008, -1.45, 1.45); this.render(); } },
      pointerup: (event) => { this.pointers.delete(event.pointerId); this.drag = null; this.pinch = null; },
      pointercancel: (event) => this.listeners.pointerup(event),
      wheel: (event) => { event.preventDefault(); this.changeZoom(this.state.zoom * Math.exp(-event.deltaY * .0012)); },
      dblclick: (event) => { if (event.target === this.svg) this.resetView(); },
    };
    for (const [event, handler] of Object.entries(this.listeners)) this.svg.addEventListener(event, handler, event === "wheel" ? { passive: false } : undefined);
  }

  changeZoom(requested) { if (requested < .43 && !this.exitTriggered) { this.exitTriggered = true; this.onExitRequested(); return; } this.state.zoom = clamp(requested, .46, 4.5); this.render(); }
  render() {
    const radius = 250 * this.state.zoom; for (const node of [this.disc, this.atmosphere]) node.setAttribute("r", radius + (node === this.atmosphere ? 6 : 0));
    for (const item of this.featureNodes) {
      const point = item.schematic ? { x: item.x * this.state.zoom, y: item.y * this.state.zoom, visible: true, z: 1 } : orthographicProject(item.lat, item.lon, this.state.yaw, this.state.pitch, radius);
      item.node.setAttribute("transform", `translate(${450 + point.x} ${340 + point.y})`); item.node.hidden = !point.visible; item.node.style.opacity = point.visible ? String(clamp(.35 + point.z * .65, .35, 1)) : "0";
      if (item.lat2 != null) { const end = orthographicProject(item.lat2, item.lon2, this.state.yaw, this.state.pitch, radius); item.node.removeAttribute("transform"); item.node.setAttribute("x1", 450 + point.x); item.node.setAttribute("y1", 340 + point.y); item.node.setAttribute("x2", 450 + end.x); item.node.setAttribute("y2", 340 + end.y); item.node.hidden = !point.visible || !end.visible; }
    }
  }
}
