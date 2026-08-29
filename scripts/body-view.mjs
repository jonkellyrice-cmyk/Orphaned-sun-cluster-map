import { BodyView as CoreBodyView } from "../scripts/body-view-core.mjs";
export { schematicVisualProfile, orthographicProject, bodyVisualContract } from "../scripts/body-view-core.mjs";
import { buildBodyOperationsRenderPlan, inspectBodyOperationFeature, loadBodyOperationAsset, projectOperationPosition } from "../scripts/body-operations.mjs";
import { createFactionEmblem, factionPresentationForOwner } from "../scripts/capital-icons.mjs";

const SVG_NS = "http://www.w3.org/2000/svg";
const el = (name, attrs = {}) => { const node = document.createElementNS(SVG_NS, name); for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value)); return node; };
const NATURAL_OPERATION_KINDS = new Set(["natural-solid", "giant"]);
const DEG = Math.PI / 180;

/**
 * Keep operational annotations in the exact camera frame used by the body model.
 * Natural bodies share the globe's orthographic projection and full zoom radius.
 * Artificial/belt/anomaly schematics share the structure renderer's rotate/skew transform.
 */
export function projectOperationAnchor(asset, feature, yaw = 0, pitch = 0, zoom = 1) {
  const scale = Number.isFinite(Number(zoom)) ? Number(zoom) : 1;
  if (NATURAL_OPERATION_KINDS.has(asset.operationalKind)) return projectOperationPosition(asset, feature, yaw, pitch, 250 * scale);

  const max = Math.max(1, ...asset.features.flatMap((candidate) => [
    Math.abs(Number(candidate.position.x) || 0),
    Math.abs(Number(candidate.position.y) || 0),
    Math.abs(Number(candidate.position.z) || 0),
  ]));
  const localX = (Number(feature.position.x) || 0) / max * 235;
  const localY = -(Number(feature.position.y) || 0) / max * 235;
  const skewedX = localX + Math.tan(pitch * 7 * DEG) * localY;
  const angle = yaw * 28 * DEG, cos = Math.cos(angle), sin = Math.sin(angle);
  return {
    x: 450 + (skewedX * cos - localY * sin) * scale,
    y: 340 + (skewedX * sin + localY * cos) * scale,
    depth: (Number(feature.position.z) || 0) / max,
    visible: true,
  };
}

/**
 * Operational wrapper around the accepted v0.4/v0.5 body renderer.
 * Core interaction/render-contract tokens intentionally retained here for regression visibility:
 * pointerdown pointermove pointerup pointercancel wheel setPointerCapture onExitRequested
 * #buildRefinedGeography projectGeoPath oscm-cartography-label transportRoutes resourceProvinces
 * #buildStation #buildShipyard #buildVessel #buildFleet #buildBlinkgate #buildMegastructure #buildAsteroidField
 * oscm-solid-crater oscm-giant-band
 */
export class BodyView extends CoreBodyView {
  constructor(svgRoot, { operations = null, ownerFaction = "", ...options }) {
    super(svgRoot, options);
    this.ownerFaction = ownerFaction;
    this.operations = operations;
    this.operationLayerGroups = new Map();
    this.operationFeatureNodes = [];
    this._destroyed = false;
    if (operations) this.#buildOperations();
    else if (!options.geography && this.model?.system && this.model?.body) loadBodyOperationAsset(this.model.system, this.model.body).then((asset) => {
      if (!asset || this._destroyed) return; this.operations = asset; this.#buildOperations();
    }).catch((error) => console.warn(`orphaned-sun-cluster-map | body operations unavailable for ${this.model.system}/${this.model.body}`, error));
    this.#buildFactionContext();
    this.render();
  }

  destroy() {
    this._destroyed = true;
    this.svg?.closest?.(".oscm-shell")?.classList.remove("has-operations");
    super.destroy();
  }

  setLayerVisibility(layer, visible) {
    if (this.operationLayerGroups?.has(layer)) {
      this.operationLayerGroups.get(layer).classList.toggle("is-hidden", !visible);
      return;
    }
    super.setLayerVisibility(layer, visible);
  }

  render() {
    super.render();
    if (this.operations && this.operationRoot) this.#renderOperations();
    if (this.factionContextMarker) {
      const radius = Math.min(275, 250 * Math.max(.46, this.state?.zoom ?? 1));
      this.factionContextMarker.setAttribute("transform", `translate(450 ${Math.max(28, 340 - radius - 32).toFixed(2)})`);
    }
  }

  #buildFactionContext() {
    const faction = factionPresentationForOwner(this.ownerFaction);
    if (!faction) return;
    this.factionContextLayer = el("g", { class: "oscm-faction-context-layer is-body", "aria-hidden": "true" });
    const marker = el("g", { class: `oscm-faction-context-marker is-${faction.factionId}` });
    marker.append(el("line", { class: "oscm-faction-context-leader", x1: 0, y1: 18, x2: 0, y2: 34 }));
    marker.append(createFactionEmblem(faction));
    const title = el("title"); title.textContent = `${faction.factionName} jurisdiction — ${this.model.body}`; marker.append(title);
    this.factionContextLayer.append(marker); this.svg.append(this.factionContextLayer); this.factionContextMarker = marker;
  }

  #buildOperations() {
    this.operationRoot = el("g", { class: `oscm-body-operations is-${this.operations.operationalKind}` });
    this.operationConnections = el("g", { class: "oscm-body-operation-connections" });
    this.operationRoot.append(this.operationConnections);
    for (const layer of this.operations.layers) {
      const group = el("g", { class: `oscm-body-layer oscm-operation-layer is-${layer.id}`, "data-operation-layer": layer.id });
      if (!layer.defaultVisible) group.classList.add("is-hidden");
      this.operationRoot.append(group); this.operationLayerGroups.set(layer.id, group);
    }
    this.operationLabels = el("g", { class: "oscm-operation-labels" }); this.operationRoot.append(this.operationLabels);
    this.svg.insertBefore(this.operationRoot, this.labels ?? null);
    const lookup = new Map(this.operations.features.map((feature) => [feature.id, feature]));
    for (const feature of this.operations.features) {
      const group = this.operationLayerGroups.get(feature.layer) ?? this.operationRoot;
      let node;
      if (["hazard", "contour"].includes(feature.type)) node = el("circle", { class: `oscm-operation-feature is-${feature.type}`, r: feature.lodPriority === 1 ? 15 : 10, fill: "none" });
      else if (["corridor", "approach"].includes(feature.type)) node = el("path", { class: `oscm-operation-feature is-${feature.type}`, d: "M -10 0 L 10 0" });
      else if (["module", "hub", "reactor", "dock", "hangar", "gantry", "berth", "hull", "bridge", "engineering", "deck", "control", "power", "aperture", "ring", "segment", "ship", "platform"].includes(feature.type)) node = el("rect", { class: `oscm-operation-feature is-${feature.type}`, x: -6, y: -4, width: 12, height: 8, rx: 2 });
      else node = el("circle", { class: `oscm-operation-feature is-${feature.type}`, r: feature.lodPriority === 1 ? 5 : 3.4 });
      node.setAttribute("data-operation-feature", feature.id); node.setAttribute("tabindex", "0"); node.setAttribute("role", "button");
      const select = (event) => {
        event?.stopPropagation?.();
        const inspection = inspectBodyOperationFeature(feature);
        const provenance = inspection?.provenance ? `Provenance: ${inspection.provenance}` : null;
        this.onFeatureSelected({
          ...feature,
          inspection: { ...inspection, detail: [inspection?.detail, provenance].filter(Boolean).join(" · ") },
          operationalAsset: this.operations.body,
        });
      };
      node.addEventListener("click", select); node.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); select(event); } });
      const title = el("title"); title.textContent = `${feature.name} — ${feature.operationalRole}`; node.append(title); group.append(node);
      const label = el("text", { class: `oscm-operation-label priority-${feature.lodPriority ?? 2}` }); label.textContent = feature.name; label.addEventListener("click", select); this.operationLabels.append(label);
      this.operationFeatureNodes.push({ feature, node, label, refs: (feature.refs ?? []).map((id) => lookup.get(id)).filter(Boolean) });
    }
    this.#configureControls();
    this.#renderOperations();
  }

  #configureControls() {
    const shell = this.svg.closest?.(".oscm-shell"); if (!shell) return;
    shell.classList.add("has-operations");
    const count = shell.querySelector("[data-map-count]"); if (count) count.textContent = `${this.operations.operationalSummary.featureCount} operational features`;
    const help = shell.querySelector("[data-map-help]"); if (help) help.textContent = this.operations.operationalKind === "belt" ? "Click / tap mapped belt bodies and traffic features" : this.operations.operationalKind === "giant" ? "Click / tap storms, bands and operational corridors" : this.operations.operationalKind === "anomaly" ? "Click / tap observed contours and perimeter markers" : "Click / tap operational features; drag to inspect";
    const card = shell.querySelector(".oscm-body-layer-controls"); if (!card) return;
    const title = card.querySelector(".oscm-card-title"); if (title) title.textContent = "Operational Survey Layers";
    for (const input of [...card.querySelectorAll("input[data-body-layer]")]) input.closest("label")?.remove();
    for (const layer of this.operations.layers) {
      const label = document.createElement("label"), input = document.createElement("input"); input.type = "checkbox"; input.dataset.bodyLayer = layer.id; input.checked = layer.defaultVisible;
      input.addEventListener("change", () => this.setLayerVisibility(layer.id, input.checked)); label.append(input, document.createTextNode(` ${layer.label}`)); card.append(label);
    }
  }

  #renderOperations() {
    const mobile = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
    const plan = buildBodyOperationsRenderPlan(this.operations, this.state?.zoom ?? 1, mobile), visible = new Set(plan.features.map((feature) => feature.id)), labelIds = new Set(plan.labels.map((feature) => feature.id));
    const positions = new Map();
    for (const item of this.operationFeatureNodes) {
      const projected = projectOperationAnchor(this.operations, item.feature, this.state?.yaw ?? 0, this.state?.pitch ?? 0, this.state?.zoom ?? 1);
      positions.set(item.feature.id, projected);
      const show = visible.has(item.feature.id) && projected.visible; item.node.hidden = !show; item.label.hidden = !(show && labelIds.has(item.feature.id));
      if (show) item.node.setAttribute("transform", `translate(${projected.x.toFixed(2)} ${projected.y.toFixed(2)})`);
      if (!item.label.hidden) { item.label.setAttribute("x", projected.x.toFixed(2)); item.label.setAttribute("y", (projected.y - 9).toFixed(2)); }
    }
    this.operationConnections.replaceChildren();
    for (const item of this.operationFeatureNodes) {
      if (!visible.has(item.feature.id) || !item.refs.length) continue; const from = positions.get(item.feature.id); if (!from?.visible) continue;
      for (const ref of item.refs.slice(0, 2)) { const to = positions.get(ref.id); if (!to?.visible || !visible.has(ref.id)) continue; const line = el("line", { class: "oscm-operation-connection", x1: from.x.toFixed(2), y1: from.y.toFixed(2), x2: to.x.toFixed(2), y2: to.y.toFixed(2) }); this.operationConnections.append(line); }
    }
  }
}
