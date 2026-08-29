import { buildBodyOperationsRenderPlan, inspectBodyOperationFeature, projectOperationPosition } from "./body-operations.mjs";

const SVG_NS = "http://www.w3.org/2000/svg";
const svg = (name, attrs = {}) => {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
};
const cssType = (value) => String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-");

function featureNode(feature) {
  const className = `oscm-operation-feature is-${cssType(feature.layer)} is-${cssType(feature.type)}`;
  const circular = ["crater","basin","ice","mine","habitat","landing","observatory","storm","vortex","platform","asteroid","module","hub","dock","reactor","gantry","berth","hull","bridge","engineering","deck","ship","segment","control","power","aperture","beacon","contour"].includes(feature.type);
  const node = circular
    ? svg("circle", { class: className, r: feature.lodPriority === 1 ? 5 : 3.5, "data-operation-feature": feature.id })
    : svg("path", { class: className, d: "M -6 0 L 0 -6 L 6 0 L 0 6 Z", "data-operation-feature": feature.id });
  const title = svg("title"); title.textContent = `${feature.name} — ${feature.operationalRole}`; node.append(title);
  return node;
}

export function attachBodyOperations(view, asset, { mobile = false, onFeatureSelected = () => {} } = {}) {
  if (!view?.svg || !asset?.features?.length) return null;
  const host = ["natural-solid","giant"].includes(asset.operationalKind) ? view.surface : view.structure;
  const layerGroups = new Map(), nodes = [];
  for (const layer of asset.layers) {
    const group = svg("g", { class: `oscm-operation-layer is-${cssType(layer.id)}`, "data-operation-layer": layer.id });
    host.append(group); layerGroups.set(layer.id, group);
  }
  for (const feature of asset.features) {
    const node = featureNode(feature); node.addEventListener("click", (event) => { event.stopPropagation(); onFeatureSelected(feature, inspectBodyOperationFeature(feature)); });
    (layerGroups.get(feature.layer) ?? host).append(node); nodes.push({ feature, node });
  }
  const previousSetLayerVisibility = view.setLayerVisibility.bind(view), previousRender = view.render.bind(view);
  view.setLayerVisibility = (layer, visible) => { previousSetLayerVisibility(layer, visible); layerGroups.get(layer)?.classList.toggle("is-hidden", !visible); };
  const renderOperations = () => {
    const plan = buildBodyOperationsRenderPlan(asset, view.state.zoom, mobile), visible = new Set(plan.features.map((feature) => feature.id));
    const labelIds = new Set(plan.labels.map((feature) => feature.id));
    for (const { feature, node } of nodes) {
      const projected = projectOperationPosition(asset, feature, view.state.yaw, view.state.pitch, 244);
      node.setAttribute("transform", `translate(${projected.x.toFixed(2)} ${projected.y.toFixed(2)})`);
      node.toggleAttribute("hidden", !visible.has(feature.id) || !projected.visible);
      node.classList.toggle("is-major", labelIds.has(feature.id));
      node.style.opacity = String(Math.max(.28, Math.min(1, .65 + projected.depth * .28)));
    }
  };
  view.render = () => { previousRender(); renderOperations(); };
  view.operations = asset; view.operationLayerGroups = layerGroups; view.operationNodes = nodes; view.render();
  return { asset, layerGroups, nodes, render: renderOperations };
}
