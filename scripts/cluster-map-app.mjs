import { SYSTEMS, projectedDistanceLy, spatialDistanceLy } from "./cluster-data.mjs";
import { calculateTransit, formatDuration, formatLightYears } from "./relativity.mjs";
import { ClusterView } from "./cluster-view.mjs";
import { attachFactionTerritories } from "./faction-territories.mjs";
import { attachCapitalIcons } from "./capital-icons.mjs";
import { AU_KM, LIGHT_YEAR_KM, buildSystemModel, formatSystemDistance, loadSystemRegistry, physicalDistanceAu, physicalDistanceLy } from "./system-data.mjs";
import { SystemView } from "./system-view.mjs";

export const MODULE_ID = "orphaned-sun-cluster-map";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class ClusterMapApplication extends HandlebarsApplicationMixin(ApplicationV2) {
  mode = "cluster";
  activeSystem = null;
  _registryPromise = null;
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
      onSystemActivate: (system) => this.#enterSystem(system),
    });
    attachFactionTerritories(this._clusterView);
    attachCapitalIcons(this._clusterView);

    root.querySelector('[data-action="reset-view"]')?.addEventListener("click", () => this._clusterView.resetView());
    root.querySelector('[data-action="clear-route"]')?.addEventListener("click", () => this._clusterView.clearSelection());
    root.querySelector('[data-action="apply-profile"]')?.addEventListener("click", () => this.#applyProfile(root));
    root.querySelector('[data-action="back-to-cluster"]')?.addEventListener("click", () => this.#showCluster());

    this._resizeObserver = new ResizeObserver(() => this._clusterView?.render());
    this._resizeObserver.observe(root);

    this.#updateRoutePanel(null, null);
    if (this.mode === "system" && this.activeSystem) this.#enterSystem(this.activeSystem);
  }

  _onClose(options) {
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
    this._clusterView?.destroy();
    this._clusterView = null;
    return super._onClose(options);
  }

  async #enterSystem(system) {
    const root = this.element?.querySelector?.(".oscm-shell");
    const svg = root?.querySelector(".oscm-cluster-svg");
    if (!root || !svg) return;
    try {
      this._registryPromise ??= loadSystemRegistry(MODULE_ID);
      const rows = await this._registryPromise;
      const model = buildSystemModel(rows, system.name);
      this._clusterView?.destroy();
      this._clusterView = new SystemView(svg, {
        model,
        onSelectionChange: (origin, destination) => this.#updateRoutePanel(origin, destination),
        onExitRequested: () => this.#showCluster(),
      });
      this.mode = "system";
      this.activeSystem = system;
      root.classList.add("is-system-mode");
      root.querySelector('[data-action="back-to-cluster"]')?.classList.remove("is-hidden");
      const title = root.querySelector("[data-map-title]"); if (title) title.textContent = `${system.name} System`;
      const count = root.querySelector("[data-map-count]"); if (count) count.textContent = `${model.objects.length} mapped objects`;
      const help = root.querySelector("[data-map-help]"); if (help) help.textContent = "Click / tap two objects: local route";
      this.#updateRoutePanel(null, null);
    } catch (error) {
      console.error(`${MODULE_ID} | Unable to enter system view`, error);
      ui.notifications.error(`Unable to load ${system.name} system data.`);
    }
  }

  #showCluster() {
    const root = this.element?.querySelector?.(".oscm-shell");
    const svg = root?.querySelector(".oscm-cluster-svg");
    if (!root || !svg) return;
    this._clusterView?.destroy();
    this._clusterView = new ClusterView(svg, {
      gridSpacing: Number(game.settings.get(MODULE_ID, "gridSpacing")),
      onSelectionChange: (origin, destination) => this.#updateRoutePanel(origin, destination),
      onSystemActivate: (system) => this.#enterSystem(system),
    });
    attachFactionTerritories(this._clusterView);
    attachCapitalIcons(this._clusterView);
    this.mode = "cluster";
    this.activeSystem = null;
    root.classList.remove("is-system-mode");
    root.querySelector('[data-action="back-to-cluster"]')?.classList.add("is-hidden");
    const title = root.querySelector("[data-map-title]"); if (title) title.textContent = "Beehive Cluster";
    const count = root.querySelector("[data-map-count]"); if (count) count.textContent = `${SYSTEMS.length} systems`;
    const help = root.querySelector("[data-map-help]"); if (help) help.textContent = "Click / tap two systems: route";
    this.#updateRoutePanel(null, null);
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

    this._clusterView?.setGridSpacing?.(gridSpacing);
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
    const hud = root.querySelector(".oscm-route-hud");

    if (originEl) originEl.textContent = origin?.name ?? "—";
    if (destinationEl) destinationEl.textContent = destination?.name ?? "—";

    if (!origin || !destination) {
      prompt?.classList.remove("is-hidden");
      result?.classList.add("is-hidden");
      hud?.classList.add("is-hidden");
      if (prompt) {
        const noun = this.mode === "system" ? "object" : "system";
        prompt.textContent = origin ? `Select a destination ${noun}.` : `Select an origin ${noun}, then a destination.`;
      }
      this.#updateObjectDetails(origin, destination);
      return;
    }

    prompt?.classList.add("is-hidden");
    result?.classList.remove("is-hidden");
    hud?.classList.remove("is-hidden");

    const isSystem = this.mode === "system";
    const localAu = isSystem ? physicalDistanceAu(origin, destination) : null;
    const projected = isSystem
      ? Math.hypot(destination.physical.x - origin.physical.x, destination.physical.y - origin.physical.y)
      : projectedDistanceLy(origin, destination);
    const depth = isSystem ? Math.abs(destination.physical.z - origin.physical.z) : Math.abs(destination.z - origin.z);
    const spatial = isSystem ? physicalDistanceLy(origin, destination) : spatialDistanceLy(origin, destination);
    const accelerationG = Number(game.settings.get(MODULE_ID, "accelerationG"));
    const cruiseBeta = Number(game.settings.get(MODULE_ID, "cruiseBeta"));
    const transit = calculateTransit(spatial, { accelerationG, cruiseBeta });

    const values = {
      projected: isSystem ? formatSystemDistance(projected) : formatLightYears(projected),
      depth: isSystem ? formatSystemDistance(depth) : formatLightYears(depth),
      spatial: isSystem ? formatSystemDistance(localAu) : formatLightYears(spatial),
      contracted: isSystem ? formatSystemDistance(transit.contractedDistanceLy * LIGHT_YEAR_KM / AU_KM) : formatLightYears(transit.contractedDistanceLy),
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

    const hudValues = {
      route: `${origin.name} → ${destination.name}`,
      spatial: `${values.spatial} true distance`,
      clusterTime: values.clusterTime,
      shipTime: values.shipTime,
      profile: values.profile,
    };
    for (const [field, value] of Object.entries(hudValues)) {
      const el = root.querySelector(`[data-hud-field="${field}"]`);
      if (el) el.textContent = value;
    }
    this.#updateObjectDetails(origin, destination);
  }

  #updateObjectDetails(origin, destination) {
    const root = this.element?.querySelector?.(".oscm-shell");
    const card = root?.querySelector(".oscm-object-details");
    if (!card) return;
    card.classList.toggle("is-hidden", this.mode !== "system" || (!origin && !destination));
    const object = destination ?? origin;
    const values = {
      objectName: object?.name ?? "—",
      objectType: object?.type ?? "—",
      objectParent: object?.parent ?? "—",
      objectRole: object?.hz_or_role || object?.primary_function || "—",
      objectScale: object?.dimensions_estimate || (object?.radiusRe ? `${object.radiusRe} Earth radii` : "Schematic marker"),
    };
    for (const [field, value] of Object.entries(values)) {
      const element = root.querySelector(`[data-field="${field}"]`); if (element) element.textContent = value;
    }
  }
}
