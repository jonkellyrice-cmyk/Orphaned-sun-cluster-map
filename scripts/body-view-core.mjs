const SVG_NS = "http://www.w3.org/2000/svg";
import { buildBodyLayers } from "./body-layers.mjs";
import { projectGeoPath, selectCartographyLabels } from "./body-cartography.mjs";
import { renderSuperstructureAtlas } from "./superstructure-atlas-visuals.mjs";
import { factionFamilyFor, superstructureProfile, SUPERSTRUCTURE_MODEL_VERSION } from "./superstructure-identities.mjs";
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const svg = (name, attrs = {}) => {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
};

function hashUnit(text) {
  let value = 2166136261;
  for (const char of String(text)) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return (value >>> 0) / 4294967295;
}

function seededPoints(model, count, salt = "detail") {
  const identity = `${model.system}/${model.body}/${salt}`;
  return Array.from({ length: count }, (_, index) => ({
    lat: -66 + hashUnit(`${identity}/lat/${index}`) * 132,
    lon: -180 + hashUnit(`${identity}/lon/${index}`) * 360,
    size: .55 + hashUnit(`${identity}/size/${index}`) * 1.15,
  }));
}

export function liveSuperstructureIdentity(model) {
  const profile = superstructureProfile(model?.system, model?.body);
  if (!profile) return null;
  return {
    ...profile,
    modelVersion: SUPERSTRUCTURE_MODEL_VERSION,
    factionFamily: factionFamilyFor({
      system: model?.system,
      owner_faction: model?.ownerFaction ?? model?.owner_faction ?? "",
    }),
  };
}

export function schematicVisualProfile(model) {
  const text = `${model.structureClass ?? ""} ${model.visualArchetype ?? ""} ${model.function ?? ""}`.toLowerCase();
  if (["moon", "minor-world", "terrestrial"].includes(model.kind)) {
    const density = model.regions?.find((region) => region.type === "crater-provinces")?.density ?? "moderate";
    const volatile = model.regions?.find((region) => region.type === "ice-or-volatile-deposits")?.coveragePct ?? 0;
    return { renderer: "solid-world", craters: density === "dense" ? 34 : density === "sparse" ? 12 : 22, volatile, palette: model.palette };
  }
  if (model.kind === "giant") return { renderer: "giant", bands: model.regions?.find((region) => region.type === "atmospheric-bands")?.count ?? 9, storms: model.regions?.find((region) => region.type === "storm-systems")?.count ?? 4, palette: model.palette };
  if (model.kind === "asteroid-field") return { renderer: "asteroid-field", count: model.regions?.find((region) => region.type === "asteroid-population")?.count ?? 40, composition: model.composition };
  const renderer = model.kind === "station" && /ring|crown|halo/.test(text) ? "ring-station" : model.kind;
  return { renderer, mobile: /mobile|vessel|fleet/.test(`${text} ${model.mobility ?? ""}`.toLowerCase()), archetype: text, docks: model.approach?.dockingNodes?.length ?? 0 };
}

export function orthographicProject(latDeg, lonDeg, yaw = 0, pitch = 0, radius = 250) {
  const lat = latDeg * Math.PI / 180, lon = lonDeg * Math.PI / 180 + yaw;
  const x = Math.cos(lat) * Math.sin(lon), y0 = Math.sin(lat), z0 = Math.cos(lat) * Math.cos(lon);
  const y = y0 * Math.cos(pitch) - z0 * Math.sin(pitch), z = y0 * Math.sin(pitch) + z0 * Math.cos(pitch);
  return { x: x * radius, y: -y * radius, z, visible: z >= 0 };
}

export function bodyVisualContract(model, geography = null) {
  if (geography) return { kind: geography.schemaVersion === 2 ? "refined-cartographic-globe" : "geographic-globe", atmosphere: true, features: geography.schemaVersion === 2 ? geography.gazetteer.length + geography.settlements.length : geography.cells.length };
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
    const rocky = svg("radialGradient", { id: "oscm-rocky-gradient", cx: "32%", cy: "27%" }); rocky.append(svg("stop", { offset: "0%", "stop-color": "#c2b7a2" }), svg("stop", { offset: "58%", "stop-color": "#6e6a63" }), svg("stop", { offset: "100%", "stop-color": "#272d30" })); defs.append(rocky);
    const icy = svg("radialGradient", { id: "oscm-icy-gradient", cx: "30%", cy: "25%" }); icy.append(svg("stop", { offset: "0%", "stop-color": "#e7fbff" }), svg("stop", { offset: "58%", "stop-color": "#87aeb8" }), svg("stop", { offset: "100%", "stop-color": "#344a54" })); defs.append(icy);
    const metal = svg("linearGradient", { id: "oscm-metal-gradient", x1: "0%", x2: "100%" }); metal.append(svg("stop", { offset: "0%", "stop-color": "#24373d" }), svg("stop", { offset: "45%", "stop-color": "#a8bdbe" }), svg("stop", { offset: "58%", "stop-color": "#3d555b" }), svg("stop", { offset: "100%", "stop-color": "#101b20" })); defs.append(metal);
    this.backdrop = svg("g", { class: "oscm-body-backdrop" });
    this.disc = svg("circle", { class: "oscm-body-disc", cx: 450, cy: 340, r: 250 });
    this.surface = svg("g", { class: "oscm-body-surface", "clip-path": "url(#oscm-body-disc-clip)" });
    this.night = svg("ellipse", { class: "oscm-body-night", cx: 540, cy: 340, rx: 180, ry: 250 });
    this.atmosphere = svg("circle", { class: "oscm-body-atmosphere", cx: 450, cy: 340, r: 256 });
    this.structure = svg("g", { class: "oscm-body-structure" });
    this.labels = svg("g", { class: "oscm-body-labels" }); this.svg.append(defs, this.backdrop, this.disc, this.surface, this.night, this.atmosphere, this.structure, this.labels);
    this.featureNodes = [];
    if (this.geography) this.buildGeography(); else this.buildSchematic();
  }

  buildGeography() {
    if (this.geography.schemaVersion === 2) { this.#buildRefinedGeography(); return; }
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

  #buildRefinedGeography() {
    const asset = this.geography, namedByRef = new Map(asset.gazetteer.filter((feature) => feature.geometryRef).map((feature) => [feature.geometryRef, feature]));
    this.cartography = true; this.disc.classList.add("is-refined-ocean"); this.layerGroups = new Map();
    for (const id of ["terrain", "hydrology", "resources", "settlements", "transport", "labels"]) { const group = svg("g", { class: `oscm-body-layer is-${id}` }); (id === "labels" ? this.labels : this.surface).append(group); this.layerGroups.set(id, group); }
    const addPath = (group, feature, rings, className, { minZoom = .46, closed = false } = {}) => {
      const node = svg("path", { class: className, "data-feature": feature.id ?? feature.properName });
      node.addEventListener("click", () => this.onFeatureSelected(feature)); group.append(node); this.featureNodes.push({ node, rings, feature, minZoom, closed, cartographicPath: true }); return node;
    };
    for (const region of asset.regions.ecoregions.slice(0, 700)) {
      const feature = { ...region, ...(namedByRef.get(region.id) ?? {}), type: "ecoregion", scientificClassification: region.category };
      addPath(this.layerGroups.get("terrain"), feature, region.polygons, `oscm-cartography-region biome-${region.category}`, { minZoom: region.cellCount >= 42 ? .46 : region.cellCount >= 10 ? 1.15 : 2.15, closed: true });
    }
    for (const coast of asset.terrain.coastlines) addPath(this.layerGroups.get("terrain"), namedByRef.get(coast.id) ?? { ...coast, type: "coastline" }, [coast.points], "oscm-cartography-coast", { closed: true });
    for (const river of asset.hydrology.rivers) addPath(this.layerGroups.get("hydrology"), namedByRef.get(river.id) ?? { ...river, type: "river" }, [river.points], "oscm-cartography-river");
    for (const [kind, features] of [["lake", asset.hydrology.lakes], ["wetland", asset.hydrology.wetlands], ["glacier", asset.hydrology.glaciers]]) for (const feature of features) addPath(this.layerGroups.get("hydrology"), namedByRef.get(feature.id) ?? { ...feature, type: kind }, [feature.polygon], `oscm-cartography-${kind}`, { minZoom: kind === "lake" ? 1.05 : 1.35, closed: true });
    for (const region of asset.regions.resourceProvinces.slice(0, 240)) addPath(this.layerGroups.get("resources"), { ...region, type: "resource province", scientificClassification: region.category }, region.polygons, `oscm-cartography-resource resource-${region.category}`, { minZoom: region.cellCount >= 10 ? 1.15 : 2.15, closed: true });
    for (const site of asset.settlements) {
      const node = svg("circle", { class: `oscm-body-settlement is-${site.kind}`, r: site.kind === "capital" ? 5 : 3, "data-feature": site.id }); node.addEventListener("click", () => this.onFeatureSelected(site)); this.layerGroups.get("settlements").append(node); this.featureNodes.push({ node, lat: site.lat, lon: site.lon, feature: site, minZoom: site.kind === "capital" ? .46 : .85 });
    }
    for (const route of asset.transportRoutes) addPath(this.layerGroups.get("transport"), route, [route.points], `oscm-body-transport is-${route.mode}`, { minZoom: route.kind?.includes("primary") ? 1.05 : 1.35 });
    for (const feature of selectCartographyLabels(asset, 4.5, false)) {
      const node = svg("text", { class: `oscm-cartography-label is-${feature.featureClass}`, "data-feature": feature.id }); node.textContent = feature.properName; node.addEventListener("click", () => this.onFeatureSelected(feature)); this.layerGroups.get("labels").append(node);
      const minZoom = ["capital", "continent", "ocean"].includes(feature.featureClass) ? .46 : ["city", "port", "sea", "range"].includes(feature.featureClass) ? 1.15 : 2.15;
      this.featureNodes.push({ node, lat: feature.at[0], lon: feature.at[1], feature, minZoom, label: true });
    }
    this.layerGroups.get("resources").classList.add("is-hidden");
  }

  buildSchematic() {
    const profile = schematicVisualProfile(this.model), natural = ["solid-world", "giant"].includes(profile.renderer);
    this.svg.classList.toggle("is-structure-body", !natural);
    if (natural) this.#buildNaturalSchematic(profile); else if (profile.renderer === "asteroid-field") this.#buildAsteroidField(profile); else this.#buildArtificialSchematic(profile);
  }

  #buildNaturalSchematic(profile) {
    this.disc.classList.add(`is-${profile.renderer}`, Number(profile.volatile) > 15 ? "is-icy" : "is-rocky");
    this.atmosphere.classList.toggle("is-hidden", !bodyVisualContract(this.model).atmosphere);
    if (profile.renderer === "giant") {
      for (let index = 0; index < profile.bands; index += 1) {
        const y = -205 + index * (410 / Math.max(1, profile.bands - 1));
        const width = Math.sqrt(Math.max(0, 1 - (y / 238) ** 2)) * 238;
        const band = svg("rect", { class: `oscm-giant-band band-${index % 4}`, x: 450 - width, y: 340 + y - 11, width: width * 2, height: 22 });
        this.surface.append(band);
      }
      for (const point of seededPoints(this.model, profile.storms, "storm")) {
        const storm = svg("ellipse", { class: "oscm-giant-storm", rx: 13 * point.size, ry: 6 * point.size });
        this.surface.append(storm); this.featureNodes.push({ node: storm, lat: point.lat, lon: point.lon, feature: { type: "storm system" } });
      }
      return;
    }
    for (const [index, point] of seededPoints(this.model, profile.craters, "crater").entries()) {
      const crater = svg("g", { class: "oscm-solid-crater" }); crater.append(svg("circle", { r: 5.5 * point.size, class: "oscm-crater-rim" }), svg("circle", { cx: 1.8 * point.size, cy: 1.4 * point.size, r: 3.5 * point.size, class: "oscm-crater-floor" }));
      this.surface.append(crater); this.featureNodes.push({ node: crater, lat: point.lat, lon: point.lon, feature: { id: `crater-${index + 1}`, type: "impact crater" } });
    }
    const depositCount = Math.round(clamp(Number(profile.volatile) / 5, 0, 14));
    for (const point of seededPoints(this.model, depositCount, "volatile")) {
      const deposit = svg("path", { class: "oscm-volatile-deposit", d: `M -${11 * point.size} 2 Q 0 -${9 * point.size} ${12 * point.size} 1 Q 2 ${8 * point.size} -${11 * point.size} 2 Z` });
      this.surface.append(deposit); this.featureNodes.push({ node: deposit, lat: Math.sign(point.lat || 1) * (58 + Math.abs(point.lat) % 25), lon: point.lon, feature: { type: "ice / volatile deposit" } });
    }
  }

  #buildAsteroidField(profile) {
    this.disc.classList.add("is-hidden"); this.surface.classList.add("is-hidden"); this.night.classList.add("is-hidden"); this.atmosphere.classList.add("is-hidden");
    this.structure.classList.add("is-asteroid-field");
    const points = seededPoints(this.model, profile.count, "asteroid");
    points.forEach((point, index) => {
      const distance = 45 + hashUnit(`${this.model.body}/distance/${index}`) * 235, angle = hashUnit(`${this.model.body}/angle/${index}`) * Math.PI * 2;
      const size = 4 + point.size * 10, rough = .72 + hashUnit(`${this.model.body}/rough/${index}`) * .35;
      const rock = svg("path", { class: `oscm-asteroid-rock mineral-${index % 4}`, d: `M ${-size} ${-size * .25} L ${-size * .45} ${-size * rough} L ${size * .4} ${-size * .7} L ${size} ${-size * .05} L ${size * .58} ${size * .8} L ${-size * .36} ${size} Z`, transform: `translate(${Math.cos(angle) * distance} ${Math.sin(angle) * distance * .72}) rotate(${index * 37})` });
      rock.addEventListener("click", () => this.onFeatureSelected({ id: `asteroid-${index + 1}`, type: "mapped belt body", resource: this.model.resourceProfile })); this.structure.append(rock);
    });
    this.structure.append(svg("ellipse", { class: "oscm-belt-reference-orbit", rx: 275, ry: 198 }));
  }

  #line(x1, y1, x2, y2, className = "oscm-structure-line") { const node = svg("line", { x1, y1, x2, y2, class: className }); this.structure.append(node); return node; }
  #module(x, y, width, height, className = "oscm-structure-module") { const node = svg("rect", { x, y, width, height, rx: 3, class: className }); this.structure.append(node); return node; }
  #hull(x, y, scale = 1, className = "oscm-vessel-hull") { const node = svg("path", { class: className, d: "M -92 0 L -54 -24 L 42 -19 L 96 0 L 42 19 L -54 24 Z", transform: `translate(${x} ${y}) scale(${scale})` }); this.structure.append(node); return node; }

  #buildArtificialSchematic(profile) {
    this.disc.classList.add("is-hidden"); this.surface.classList.add("is-hidden"); this.night.classList.add("is-hidden"); this.atmosphere.classList.add("is-hidden");
    this.structure.classList.add(`is-${profile.renderer}`);
    const palette = `${this.model.palette ?? ""}`.toLowerCase();
    if (/gold|amber|ochre/.test(palette)) this.structure.classList.add("palette-gold");
    if (/red|crimson/.test(palette)) this.structure.classList.add("palette-red");
    if (/jade|green|viridian/.test(palette)) this.structure.classList.add("palette-jade");

    const superstructure = liveSuperstructureIdentity(this.model);
    if (superstructure) {
      this.structure.classList.add("is-superstructure-parity");
      this.structure.setAttribute("data-superstructure-family", superstructure.silhouetteFamily);
      this.structure.insertAdjacentHTML(
        "beforeend",
        renderSuperstructureAtlas(
          superstructure,
          { x: -340, y: -260, width: 680, height: 520 },
          { includeSectionalBand: false },
        ),
      );
      this.#buildDockingNodes();
      return;
    }

    if (profile.renderer === "shipyard") this.#buildShipyard();
    else if (profile.renderer === "vessel") this.#buildVessel();
    else if (profile.renderer === "fleet") this.#buildFleet();
    else if (profile.renderer === "blinkgate") this.#buildBlinkgate();
    else if (profile.renderer === "megastructure") this.#buildMegastructure(profile);
    else if (profile.renderer === "anomaly") this.#buildAnomaly();
    else this.#buildStation(profile.renderer === "ring-station");
    this.#buildDockingNodes();
  }

  #buildStation(ringStation = false) {
    const rings = ringStation ? [86, 145, 205] : [78, 150];
    for (const radius of rings) { this.structure.append(svg("ellipse", { class: "oscm-station-ring", rx: radius, ry: radius * .38 })); for (const angle of [0, 60, 120, 180, 240, 300]) this.#line(Math.cos(angle * Math.PI / 180) * 30, Math.sin(angle * Math.PI / 180) * 13, Math.cos(angle * Math.PI / 180) * radius, Math.sin(angle * Math.PI / 180) * radius * .38, "oscm-station-spoke"); }
    this.structure.append(svg("circle", { class: "oscm-station-hub", r: 38 }), svg("ellipse", { class: "oscm-station-core", rx: 22, ry: 12 }));
    for (let index = 0; index < 8; index += 1) { const angle = index * Math.PI / 4, x = Math.cos(angle) * 150, y = Math.sin(angle) * 57; this.#module(x - 17, y - 7, 34, 14, index % 2 ? "oscm-habitat-module" : "oscm-service-module"); }
    this.#module(-215, -8, 54, 16, "oscm-solar-array"); this.#module(161, -8, 54, 16, "oscm-solar-array");
  }

  #buildShipyard() {
    this.#line(-220, 0, 220, 0, "oscm-yard-truss"); this.#line(-205, -22, 205, -22, "oscm-yard-truss-minor"); this.#line(-205, 22, 205, 22, "oscm-yard-truss-minor");
    for (const x of [-150, 0, 150]) { this.structure.append(svg("path", { class: "oscm-yard-gantry", d: `M ${x - 42} -108 L ${x - 42} 108 M ${x + 42} -108 L ${x + 42} 108 M ${x - 42} -108 L ${x + 42} -108 M ${x - 42} 108 L ${x + 42} 108` })); this.#hull(x, x === 0 ? 38 : -35, .46, "oscm-docked-hull"); }
    for (const x of [-225, 225]) this.#module(x - 22, -34, 44, 68, "oscm-yard-reactor");
  }

  #buildVessel() { this.#hull(0, 0, 2.15); this.#module(-132, -42, 104, 22, "oscm-vessel-deck"); this.#module(-132, 20, 104, 22, "oscm-vessel-deck"); for (const y of [-48, 0, 48]) this.structure.append(svg("circle", { class: "oscm-engine-bell", cx: -204, cy: y, r: 16 })); this.#line(-150, 0, 165, 0, "oscm-vessel-keel"); }
  #buildFleet() { for (const [x, y, scale] of [[0, 0, 1.35], [-155, -105, .62], [-155, 105, .62], [150, -72, .48], [150, 72, .48]]) this.#hull(x, y, scale, scale > 1 ? "oscm-vessel-hull" : "oscm-escort-hull"); }
  #buildBlinkgate() { for (let index = 0; index < 12; index += 1) this.structure.append(svg("path", { class: "oscm-gate-segment", d: "M 0 -232 A 232 232 0 0 1 116 -201 L 92 -159 A 184 184 0 0 0 0 -184 Z", transform: `rotate(${index * 30})` })); this.structure.append(svg("circle", { class: "oscm-gate-horizon", r: 169 }), svg("circle", { class: "oscm-gate-core", r: 142 })); }
  #buildMegastructure(profile) { if (/tether|linear/.test(profile.archetype)) { this.#line(0, -265, 0, 265, "oscm-megastructure-tether"); for (const y of [-230, -120, 0, 120, 230]) { this.structure.append(svg("circle", { class: "oscm-tether-node", cy: y, r: y ? 18 : 34 })); this.#module(-92, y - 8, 184, 16, "oscm-tether-crossbar"); } } else this.#buildStation(true); }
  #buildAnomaly() { for (let index = 0; index < 9; index += 1) this.structure.append(svg("ellipse", { class: "oscm-anomaly-loop", rx: 65 + index * 18, ry: 30 + index * 13, transform: `rotate(${index * 23})`, opacity: .72 - index * .055 })); }

  #buildDockingNodes() {
    for (const [index, dock] of (this.model.approach?.dockingNodes ?? []).entries()) { const angle = (dock.bearingDeg ?? index * 120) * Math.PI / 180, x = Math.cos(angle) * 270, y = Math.sin(angle) * 235; const node = svg("g", { class: "oscm-docking-approach", transform: `translate(${x} ${y})` }); node.append(svg("path", { d: "M 0 -9 L 9 0 L 0 9 L -9 0 Z" }), svg("text", { x: 14, y: 4 })); node.lastChild.textContent = dock.id; node.addEventListener("click", () => this.onFeatureSelected({ ...dock, type: "docking approach" })); this.structure.append(node); }
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
    if (this.structure) this.structure.setAttribute("transform", `translate(450 340) scale(${this.state.zoom}) rotate(${this.state.yaw * 28}) skewX(${this.state.pitch * 7})`);
    for (const item of this.featureNodes) {
      const lodVisible = this.state.zoom >= (item.minZoom ?? .46) && this.state.zoom <= (item.maxZoom ?? Infinity);
      if (item.cartographicPath) {
        const paths = item.rings.map((ring) => projectGeoPath(ring, this.state.yaw, this.state.pitch, radius, [450, 340], item.closed)).filter(Boolean);
        item.node.setAttribute("d", paths.join(" ")); item.node.hidden = !lodVisible || !paths.length; item.node.style.opacity = item.node.hidden ? "0" : "1"; continue;
      }
      const point = item.schematic ? { x: item.x * this.state.zoom, y: item.y * this.state.zoom, visible: true, z: 1 } : orthographicProject(item.lat, item.lon, this.state.yaw, this.state.pitch, radius);
      item.node.setAttribute("transform", `translate(${450 + point.x} ${340 + point.y})`); item.node.hidden = !lodVisible || !point.visible; item.node.style.opacity = item.node.hidden ? "0" : String(clamp(.35 + point.z * .65, .35, 1));
      if (item.lat2 != null) { const end = orthographicProject(item.lat2, item.lon2, this.state.yaw, this.state.pitch, radius); item.node.removeAttribute("transform"); item.node.setAttribute("x1", 450 + point.x); item.node.setAttribute("y1", 340 + point.y); item.node.setAttribute("x2", 450 + end.x); item.node.setAttribute("y2", 340 + end.y); item.node.hidden = !point.visible || !end.visible; }
    }
  }
}
