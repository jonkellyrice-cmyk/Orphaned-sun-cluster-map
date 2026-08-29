import { ClusterMapApplication, MODULE_ID } from "./cluster-map-app.mjs";
import { loadBodyOperationAsset, inspectBodyOperationFeature } from "./body-operations.mjs";
import { attachBodyOperations } from "./body-operations-renderer.mjs";

function ensureOperationControls(root) {
  let card = root.querySelector(".oscm-operation-layer-controls");
  if (card) return card;
  card = document.createElement("section");
  card.className = "oscm-card oscm-operation-layer-controls is-hidden";
  card.innerHTML = '<div class="oscm-card-title">Operational Survey Layers</div><div class="oscm-operation-layer-list"></div>';
  const panel = root.querySelector(".oscm-panel");
  const anchor = panel?.querySelector(".oscm-card:last-of-type");
  if (panel) panel.insertBefore(card, anchor ?? null);
  return card;
}

function showOperationFeature(root, activeBody, feature) {
  const card = root.querySelector(".oscm-object-details"); if (!card) return;
  const inspected = inspectBodyOperationFeature(feature); card.classList.remove("is-hidden");
  const values = {
    objectName: inspected.name,
    objectType: inspected.type,
    objectParent: activeBody?.name ?? "—",
    objectRole: inspected.detail,
    objectScale: inspected.scale ?? inspected.provenance,
  };
  for (const [field, value] of Object.entries(values)) { const el = root.querySelector(`[data-field="${field}"]`); if (el) el.textContent = value; }
}

export class OperationalClusterMapApplication extends ClusterMapApplication {
  _operationObserver = null;
  _operationIdentity = null;
  _operationSyncSerial = 0;

  _onRender(context, options) {
    super._onRender(context, options);
    const root = this.element?.querySelector?.(".oscm-shell"); if (!root) return;
    this._operationObserver?.disconnect();
    this._operationObserver = new MutationObserver(() => this.#scheduleOperationsSync());
    this._operationObserver.observe(root, { attributes: true, childList: true, characterData: true, subtree: true });
    this.#scheduleOperationsSync();
  }

  _onClose(options) {
    this._operationObserver?.disconnect(); this._operationObserver = null;
    return super._onClose(options);
  }

  #scheduleOperationsSync() {
    const serial = ++this._operationSyncSerial;
    queueMicrotask(() => { if (serial === this._operationSyncSerial) void this.#syncOperations(); });
  }

  async #syncOperations() {
    const root = this.element?.querySelector?.(".oscm-shell"); if (!root) return;
    const controls = ensureOperationControls(root);
    if (this.mode !== "body" || !this.activeBody || root.classList.contains("has-geography")) {
      root.classList.remove("has-operations"); controls.classList.add("is-hidden"); this._operationIdentity = null; return;
    }
    const identity = `${this.activeBody.system}/${this.activeBody.name}`;
    if (this._operationIdentity === identity) return;
    this._operationIdentity = identity;
    const asset = await loadBodyOperationAsset(this.activeBody.system, this.activeBody.name, MODULE_ID);
    if (!asset || this.mode !== "body" || this._operationIdentity !== identity) return;
    const view = this._clusterView; if (!view?.svg) return;
    attachBodyOperations(view, asset, {
      mobile: globalThis.matchMedia?.("(pointer: coarse)")?.matches ?? false,
      onFeatureSelected: (feature) => showOperationFeature(root, this.activeBody, feature),
    });
    root.classList.add("has-operations"); controls.classList.remove("is-hidden");
    const count = root.querySelector("[data-map-count]"); if (count) count.textContent = `${asset.features.length} operational features`;
    const help = root.querySelector("[data-map-help]"); if (help) help.textContent = "Click / tap an operational feature; drag to inspect";
    const list = controls.querySelector(".oscm-operation-layer-list"); list.replaceChildren();
    for (const layer of asset.layers) {
      const label = document.createElement("label"), checkbox = document.createElement("input");
      checkbox.type = "checkbox"; checkbox.checked = layer.defaultVisible; checkbox.dataset.operationLayer = layer.id;
      checkbox.addEventListener("change", () => view.setLayerVisibility(layer.id, checkbox.checked));
      label.append(checkbox, document.createTextNode(` ${layer.label}`)); list.append(label);
      view.setLayerVisibility(layer.id, layer.defaultVisible);
    }
  }
}
