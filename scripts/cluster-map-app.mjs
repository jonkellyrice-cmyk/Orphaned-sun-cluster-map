import { SYSTEMS, projectedDistanceLy, spatialDistanceLy } from "./cluster-data.mjs";
import { calculateTransit, formatDuration, formatLightYears } from "./relativity.mjs";
import { ClusterView } from "./cluster-view.mjs";
import { attachFactionTerritories } from "./faction-territories.mjs";

export const MODULE_ID = "orphaned-sun-cluster-map";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class ClusterMapApplication extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "orphaned-sun-cluster-map",
    classes: ["orphaned-sun-cluster-map", "standard-form"],
    position: { width: 1120, height: 760 },
    window: {
      title: "Orphaned Sun: Beehive Cluster",
      icon: "fa-solid fa-star",
      resizable: true,
      minimizable: true,
    },
  };

  static PARTS = {
    content: {
      template: `modules/${MODULE_ID}/templates/cluster-map.hbs`,
    },
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return {
      ...context,
      accelerationG: game.settings.get(MODULE_ID, "accelerationG"),
      cruiseBeta: game.settings.get(MODULE_ID, "cruiseBeta"),
      gridSpacing: game.settings.get(MODULE_ID, "gridSpacing"),
      gridOneSelected: Number(game.settings.get(MODULE_ID, "gridSpacing")) === 1,
      gridTwoSelected: Number(game.settings.get(MODULE_ID, "gridSpacing")) === 2,
      isGM: game.user.isGM,
      systemCount: SYSTEMS.length,
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);

    const root = this.element.querySelector(".oscm-shell");
    const svg = root?.querySelector(".oscm-cluster-svg");
    if (!root || !svg) return;

    this._clusterView?.destroy();
    this._resizeObserver?.disconnect();

    this._clusterView = new ClusterView(svg, {
      gridSpacing: Number(game.settings.get(MODULE_ID, "gridSpacing")),
      onSelectionChange: (origin, destination) => this.#updateRoutePanel(origin, destination),
    });
    attachFactionTerritories(this._clusterView);

    root.querySelector('[data-action="reset-view"]')?.addEventListener("click", () => this._clusterView.resetView());
    root.querySelector('[data-action="clear-route"]')?.addEventListener("click", () => this._clusterView.clearSelection());
    root.querySelector('[data-action="apply-profile"]')?.addEventListener("click", () => this.#applyProfile(root));

    this._resizeObserver = new ResizeObserver(() => this._clusterView?.render());
    this._resizeObserver.observe(root);

    this.#updateRoutePanel(null, null);
  }

  _onClose(options) {
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
    this._clusterView?.destroy();
    this._clusterView = null;
    return super._onClose(options);
  }

  async #applyProfile(root) {
    if (!game.user.isGM) return;

    const accelerationInput = root.querySelector('[name="accelerationG"]');
    const betaInput = root.querySelector('[name="cruiseBeta"]');
    const gridInput = root.querySelector('[name="gridSpacing"]');

    const accelerationG = Number(accelerationInput?.value);
    const cruiseBeta = Number(betaInput?.value);
    const gridSpacing = Number(gridInput?.value);

    if (!(accelerationG > 0)) return ui.notifications.warn("Acceleration must be greater than 0 g.");
    if (!(cruiseBeta > 0 && cruiseBeta < 1)) return ui.notifications.warn("Cruise speed must be between 0 and 1 c.");
    if (![1, 2].includes(gridSpacing)) return ui.notifications.warn("Grid spacing must be 1 or 2 light-years.");

    await game.settings.set(MODULE_ID, "accelerationG", accelerationG);
    await game.settings.set(MODULE_ID, "cruiseBeta", cruiseBeta);
    await game.settings.set(MODULE_ID, "gridSpacing", gridSpacing);

    this._clusterView?.setGridSpacing(gridSpacing);
    this.#updateRoutePanel(this._clusterView?.origin ?? null, this._clusterView?.destination ?? null);
    ui.notifications.info("Cluster navigation profile updated.");
  }

  #updateRoutePanel(origin, destination) {
    const root = this.element?.querySelector?.(".oscm-shell");
    if (!root) return;

    const originEl = root.querySelector('[data-field="origin"]');
    const destinationEl = root.querySelector('[data-field="destination"]');
    const prompt = root.querySelector(".oscm-selection-prompt");
    const result = root.querySelector(".oscm-route-result");

    if (originEl) originEl.textContent = origin?.name ?? "—";
    if (destinationEl) destinationEl.textContent = destination?.name ?? "—";

    if (!origin || !destination) {
      prompt?.classList.remove("is-hidden");
      result?.classList.add("is-hidden");
      if (prompt) prompt.textContent = origin ? "Select a destination system." : "Select an origin system, then a destination.";
      return;
    }

    prompt?.classList.add("is-hidden");
    result?.classList.remove("is-hidden");

    const projected = projectedDistanceLy(origin, destination);
    const depth = Math.abs(destination.z - origin.z);
    const spatial = spatialDistanceLy(origin, destination);
    const accelerationG = Number(game.settings.get(MODULE_ID, "accelerationG"));
    const cruiseBeta = Number(game.settings.get(MODULE_ID, "cruiseBeta"));
    const transit = calculateTransit(spatial, { accelerationG, cruiseBeta });

    const values = {
      projected: formatLightYears(projected),
      depth: formatLightYears(depth),
      spatial: formatLightYears(spatial),
      contracted: formatLightYears(transit.contractedDistanceLy),
      clusterTime: formatDuration(transit.clusterYears),
      shipTime: formatDuration(transit.shipYears),
      peakSpeed: `${(transit.peakBeta * 100).toFixed(4)}% c`,
      profile: transit.reachesCruise
        ? `${accelerationG} g → ${(cruiseBeta * 100).toFixed(3)}% c → ${accelerationG} g brake`
        : `${accelerationG} g midpoint flip; speed cap not reached`,
    };

    // Avoid language/template rerenders during rapid route selection.
    for (const [field, value] of Object.entries(values)) {
      const el = root.querySelector(`[data-field="${field}"]`);
      if (el) el.textContent = value;
    }
  }
}
