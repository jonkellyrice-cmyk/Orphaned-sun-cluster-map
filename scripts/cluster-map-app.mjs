import { SYSTEMS, projectedDistanceLy, spatialDistanceLy } from "./cluster-data.mjs";
import { calculateTransit, formatDuration, formatLightYears, formatVelocity, SECONDS_PER_JULIAN_YEAR, trajectoryMarkers } from "./relativity.mjs";
import { abortVoyage, advanceVoyageToRouteFraction, engageVoyage, evaluateVoyage } from "./campaign-time.mjs";
import { ClusterView } from "./cluster-view.mjs";
import { attachFactionTerritories } from "./faction-territories.mjs";
import { attachCapitalIcons } from "./capital-icons.mjs";
import { AU_KM, LIGHT_YEAR_KM, buildSystemModel, formatSystemDistance, loadSystemRegistry, physicalDistanceAu, physicalDistanceLy } from "./system-data.mjs";
import { SystemView } from "./system-view.mjs";
import { BodyView } from "./body-view.mjs";
import { naturalBodyKind, buildNaturalBodyModel } from "./natural-body-data.mjs";
import { artificialBodyKind, buildArtificialBodyModel } from "./artificial-body-data.mjs";
import { inspectSurfaceFeature } from "./body-layers.mjs";
import { loadBodyOperationAsset } from "./body-operations.mjs";
import { AstronomySnapshotCache, loadAstronomyOrientations } from "./astronomy.mjs";
import { UNION_EPOCH_MS } from "./universal-time.mjs";

export const MODULE_ID = "orphaned-sun-cluster-map";
const assetSlug = (value) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class ClusterMapApplication extends HandlebarsApplicationMixin(ApplicationV2) {
  mode = "cluster";
  activeSystem = null;
  activeBody = null;
  _registryPromise = null;
  _astronomyOrientationsPromise = null;
  _astronomyCache = new AstronomySnapshotCache();
  _systemSnapshotReferenceMs = null;
  _astronomyArrivalVoyageId = null;
  selectedRoute = null;
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
      onShipDrag: (fraction) => this.#scrubVoyageToFraction(fraction),
    });
    attachFactionTerritories(this._clusterView);
    attachCapitalIcons(this._clusterView);

    root.querySelector('[data-action="reset-view"]')?.addEventListener("click", () => this._clusterView.resetView());
    root.querySelector('[data-action="clear-route"]')?.addEventListener("click", () => this._clusterView.clearSelection());
    root.querySelector('[data-action="apply-profile"]')?.addEventListener("click", () => this.#applyProfile(root));
    root.querySelector('[data-action="engage-route"]')?.addEventListener("click", () => this.#engageSelectedRoute());
    root.querySelector('[data-action="abort-voyage"]')?.addEventListener("click", () => this.#abortActiveVoyage());
    root.querySelector('[data-action="back-to-cluster"]')?.addEventListener("click", () => this.#showCluster());
    root.querySelector('[data-action="back-to-system"]')?.addEventListener("click", () => this.#showSystem());
    for (const control of root.querySelectorAll("[data-body-layer]")) control.addEventListener("change", () => this._clusterView?.setLayerVisibility?.(control.dataset.bodyLayer, control.checked));

    this._resizeObserver = new ResizeObserver(() => this._clusterView?.render());
    this._resizeObserver.observe(root);

    this.#updateRoutePanel(null, null);
    if (this.mode === "system" && this.activeSystem) this.#enterSystem(this.activeSystem);
    if (this.mode === "body" && this.activeSystem && this.activeBody) this.#enterBody(this.activeBody);
    window.removeEventListener("oscm-campaign-time-changed", this._campaignTimeListener);
    window.clearInterval(this._voyageTicker);
    this._campaignTimeListener = () => {
      this.#refreshActiveVoyage();
      void this.#refreshVisibleAstronomy().catch((error) => console.warn(`${MODULE_ID} | Unable to refresh visible astronomy`, error));
      void this.#snapshotVoyageArrival().catch((error) => console.warn(`${MODULE_ID} | Unable to snapshot voyage arrival system`, error));
    };
    window.addEventListener("oscm-campaign-time-changed", this._campaignTimeListener);
    this._voyageTicker = window.setInterval(() => this.#refreshActiveVoyage(), 1000);
    this.#refreshActiveVoyage();
  }

  _onClose(options) {
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
    this._clusterView?.destroy();
    this._clusterView = null;
    window.removeEventListener("oscm-campaign-time-changed", this._campaignTimeListener);
    window.clearInterval(this._voyageTicker);
    return super._onClose(options);
  }

  async #astronomicalModel(systemName, referenceTimestampMs) {
    this._registryPromise ??= loadSystemRegistry(MODULE_ID);
    this._astronomyOrientationsPromise ??= loadAstronomyOrientations(MODULE_ID);
    const [rows, orientationDocument] = await Promise.all([this._registryPromise, this._astronomyOrientationsPromise]);
    return this._astronomyCache.getOrCreate(systemName, referenceTimestampMs, () => buildSystemModel(rows, systemName, {
      referenceTimestampMs,
      orientations: orientationDocument.orientations,
    }));
  }

  async #refreshVisibleAstronomy() {
    if (this.mode !== "system" || !this.activeSystem || this._clusterView?.isDraggingShip) return;
    const referenceTimestampMs = game.modules.get(MODULE_ID)?.api?.getCampaignTimeState?.()?.referenceBaseMs;
    if (!Number.isFinite(referenceTimestampMs)) return;
    if (Number.isFinite(this._systemSnapshotReferenceMs) && Math.abs(referenceTimestampMs - this._systemSnapshotReferenceMs) < 3_600_000) return;
    await this.#enterSystem(this.activeSystem, referenceTimestampMs);
  }

  async #snapshotVoyageArrival() {
    const state = game.modules.get(MODULE_ID)?.api?.getCampaignTimeState?.();
    const voyage = state?.activeVoyage;
    if (!voyage || voyage.context !== "cluster" || this._astronomyArrivalVoyageId === voyage.id) return;
    const evaluated = evaluateVoyage(voyage, state.properBaseMs);
    if (evaluated.phase !== "arrived") return;
    const arrivalReferenceMs = voyage.departureReferenceMs + voyage.referenceYears * SECONDS_PER_JULIAN_YEAR * 1000;
    await this.#astronomicalModel(voyage.destinationName, arrivalReferenceMs);
    this._astronomyArrivalVoyageId = voyage.id;
  }

  async #enterSystem(system, requestedReferenceTimestampMs = null) {
    const root = this.element?.querySelector?.(".oscm-shell");
    const svg = root?.querySelector(".oscm-cluster-svg");
    if (!root || !svg) return;
    try {
      const api = game.modules.get(MODULE_ID)?.api;
      const referenceTimestampMs = Number.isFinite(requestedReferenceTimestampMs)
        ? requestedReferenceTimestampMs
        : api?.getCampaignTimeState?.()?.referenceBaseMs ?? UNION_EPOCH_MS;
      const model = await this.#astronomicalModel(system.name, referenceTimestampMs);
      this._clusterView?.destroy();
      this._clusterView = new SystemView(svg, {
        model,
        onSelectionChange: (origin, destination) => this.#updateRoutePanel(origin, destination),
        onExitRequested: () => this.#showCluster(),
        onObjectActivate: (object) => this.#enterBody(object),
        onShipDrag: (fraction) => this.#scrubVoyageToFraction(fraction),
      });
      this.mode = "system";
      this.activeSystem = system;
      this.activeBody = null;
      this._systemSnapshotReferenceMs = referenceTimestampMs;
      root.classList.add("is-system-mode");
      root.classList.remove("is-body-mode");
      root.classList.remove("has-geography");
      root.classList.remove("has-operations");
      root.querySelector('[data-action="back-to-cluster"]')?.classList.remove("is-hidden");
      root.querySelector('[data-action="back-to-system"]')?.classList.add("is-hidden");
      const title = root.querySelector("[data-map-title]"); if (title) title.textContent = `${system.name} System`;
      const count = root.querySelector("[data-map-count]"); if (count) count.textContent = `${model.objects.length} mapped objects`;
      const help = root.querySelector("[data-map-help]"); if (help) help.textContent = "Click / tap two objects: local route";
      this.#updateRoutePanel(null, null);
    } catch (error) {
      console.error(`${MODULE_ID} | Unable to enter system view`, error);
      ui.notifications.error(`Unable to load ${system.name} system data.`);
    }
  }

  #showSystem() { if (this.activeSystem) this.#enterSystem(this.activeSystem); }

  async #enterBody(object) {
    const root = this.element?.querySelector?.(".oscm-shell"), svg = root?.querySelector(".oscm-cluster-svg");
    if (!root || !svg || ["star", "barycenter"].includes(object.objectClass)) return;
    try {
      let model;
      if (naturalBodyKind(object)) model = buildNaturalBodyModel(object);
      else if (artificialBodyKind(object)) model = buildArtificialBodyModel(object);
      else return;
      let geography = null, operations = null;
      if (object.geography_seed) {
        const slug = assetSlug(object.name), base = `modules/${MODULE_ID}/data`;
        let response = await fetch(`${base}/planet-cartography/${object.system.toLowerCase()}/${slug}.json`);
        if (!response.ok) response = await fetch(`${base}/planet-geography/${object.system.toLowerCase()}/${slug}.json`);
        if (!response.ok) throw new Error(`cartography fetch failed (${response.status})`);
        geography = await response.json();
      } else {
        operations = await loadBodyOperationAsset(object.system, object.name, MODULE_ID).catch((error) => { console.warn(`${MODULE_ID} | Body operations unavailable for ${object.system}/${object.name}`, error); return null; });
        if (operations && artificialBodyKind(object)) model = buildArtificialBodyModel(object, operations);
      }
      this._clusterView?.destroy();
      this._clusterView = new BodyView(svg, { model, geography, operations, ownerFaction: object.owner_faction, onExitRequested: () => this.#showSystem(), onFeatureSelected: (feature) => this.#updateBodyFeature(feature) });
      this.mode = "body"; this.activeBody = object;
      root.classList.add("is-system-mode", "is-body-mode");
      root.classList.toggle("has-geography", Boolean(geography));
      root.classList.toggle("has-operations", Boolean(operations));
      root.querySelector('[data-action="back-to-cluster"]')?.classList.remove("is-hidden");
      root.querySelector('[data-action="back-to-system"]')?.classList.remove("is-hidden");
      const title = root.querySelector("[data-map-title]"); if (title) title.textContent = object.name;
      const count = root.querySelector("[data-map-count]"); if (count) count.textContent = geography ? geography.schemaVersion === 2 ? `${geography.gazetteer.length} named features · 2° survey` : `${geography.cells.length} surface cells` : operations ? `${operations.operationalSummary.featureCount} operational features` : object.type;
      const help = root.querySelector("[data-map-help]"); if (help) help.textContent = geography
        ? "Click / tap a mapped surface feature"
        : model.kind === "asteroid-field" ? "Click / tap a mapped belt body"
        : "Click / tap docking approaches; drag to inspect";
      this.#updateRoutePanel(null, null);
      this.#updateBodyMetadata(object, model);
    } catch (error) { console.error(`${MODULE_ID} | Unable to enter body view`, error); ui.notifications.error(`Unable to load ${object.name} orbital view.`); }
  }

  #updateBodyFeature(feature) {
    const root = this.element?.querySelector?.(".oscm-shell"), card = root?.querySelector(".oscm-object-details"); if (!root || !card) return;
    if (!feature) { this.#updateBodyMetadata(this.activeBody, this._clusterView?.model); return; }
    card.classList.remove("is-hidden");
    const inspected = inspectSurfaceFeature(feature);
    const values = { objectName: inspected.name, objectType: inspected.type, objectParent: this.activeBody?.name || "—", objectRole: inspected.detail, objectScale: inspected.scale ?? (feature.suitability != null ? `Settlement suitability ${feature.suitability}` : "Survey extent not fixed") };
    for (const [field, value] of Object.entries(values)) { const element = root.querySelector(`[data-field="${field}"]`); if (element) element.textContent = value; }
  }

  #updateBodyMetadata(object, model) {
    const root = this.element?.querySelector?.(".oscm-shell"), card = root?.querySelector(".oscm-object-details"); if (!root || !card || !object || !model) return;
    card.classList.remove("is-hidden");
    const values = {
      objectName: object.name,
      objectType: model.structureClass || object.type,
      objectParent: object.parent || "—",
      objectRole: model.function || model.resourceProfile || object.hz_or_role || "Mapped orbital body",
      objectScale: model.dimensions || (model.radiusKm ? `${model.radiusKm.toLocaleString()} km radius` : "Distributed mapped region"),
    };
    for (const [field, value] of Object.entries(values)) { const element = root.querySelector(`[data-field="${field}"]`); if (element) element.textContent = value; }
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
      onShipDrag: (fraction) => this.#scrubVoyageToFraction(fraction),
    });
    attachFactionTerritories(this._clusterView);
    attachCapitalIcons(this._clusterView);
    this.mode = "cluster";
    this.activeSystem = null;
    this.activeBody = null;
    root.classList.remove("is-system-mode");
    root.classList.remove("is-body-mode");
    root.classList.remove("has-geography");
      root.classList.remove("has-operations");
    root.querySelector('[data-action="back-to-cluster"]')?.classList.add("is-hidden");
    root.querySelector('[data-action="back-to-system"]')?.classList.add("is-hidden");
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
        const noun = this.mode === "system" ? "object" : this.mode === "body" ? "feature" : "system";
        prompt.textContent = origin ? `Select a destination ${noun}.` : `Select an origin ${noun}, then a destination.`;
      }
      this.#updateObjectDetails(origin, destination);
      this.selectedRoute = null;
      this.#refreshActiveVoyage();
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
    this.selectedRoute = {
      originId: origin.id, destinationId: destination.id, originName: origin.name, destinationName: destination.name,
      context: isSystem ? "system" : "cluster", systemId: isSystem ? this.activeSystem?.id : null,
      originCoordinates: isSystem ? structuredClone(origin.physical) : { x: origin.x, y: origin.y, z: origin.z },
      destinationCoordinates: isSystem ? structuredClone(destination.physical) : { x: destination.x, y: destination.y, z: destination.z },
      distanceLy: spatial, accelerationG, cruiseBeta, transit, origin, destination,
    };
    this._clusterView?.setRouteVisualization?.({ origin, destination, markers: trajectoryMarkers(transit) });

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
    this.#refreshActiveVoyage();
  }

  async #engageSelectedRoute() {
    const api = game.modules.get(MODULE_ID)?.api;
    if (!game.user.isGM || !api?.isClockAuthority?.() || !this.selectedRoute) return;
    try {
      if (this.selectedRoute.context === "system" && this.activeSystem) {
        const state = api.getCampaignTimeState();
        const currentModel = await this.#astronomicalModel(this.activeSystem.name, state.referenceBaseMs);
        const origin = currentModel.objects.find((object) => object.id === this.selectedRoute.originId);
        const destination = currentModel.objects.find((object) => object.id === this.selectedRoute.destinationId);
        if (!origin || !destination) throw new Error("The selected bodies are absent from the departure snapshot.");
        const distanceLy = physicalDistanceLy(origin, destination);
        this.selectedRoute = {
          ...this.selectedRoute,
          originCoordinates: structuredClone(origin.physical), destinationCoordinates: structuredClone(destination.physical),
          distanceLy,
          transit: calculateTransit(distanceLy, { accelerationG: this.selectedRoute.accelerationG, cruiseBeta: this.selectedRoute.cruiseBeta }),
          astronomySnapshotReferenceMs: state.referenceBaseMs,
        };
      } else if (this.selectedRoute.context === "cluster") {
        const state = api.getCampaignTimeState();
        await this.#astronomicalModel(this.selectedRoute.originName, state.referenceBaseMs);
        this.selectedRoute = { ...this.selectedRoute, astronomySnapshotReferenceMs: state.referenceBaseMs };
      }
      const next = engageVoyage(api.getCampaignTimeState(), this.selectedRoute, Date.now());
      await api.saveCampaignTimeState(next);
      ui.notifications.info(`${this.selectedRoute.originName} → ${this.selectedRoute.destinationName} engaged.`);
      this.#refreshActiveVoyage();
    } catch (error) { ui.notifications.warn(error?.message || "Unable to engage route."); }
  }

  async #abortActiveVoyage() {
    const api = game.modules.get(MODULE_ID)?.api;
    if (!game.user.isGM || !api?.isClockAuthority?.()) return;
    await api.saveCampaignTimeState(abortVoyage(api.getCampaignTimeState(), Date.now()));
    ui.notifications.info("Active voyage aborted. Accumulated clock divergence was preserved.");
    this.#updateRoutePanel(this._clusterView?.origin ?? null, this._clusterView?.destination ?? null);
  }

  async #scrubVoyageToFraction(fraction) {
    const api = game.modules.get(MODULE_ID)?.api;
    if (!game.user.isGM || !api?.isClockAuthority?.()) return;
    try {
      await api.saveCampaignTimeState(advanceVoyageToRouteFraction(api.getCampaignTimeState(), fraction, Date.now()));
      this.#refreshActiveVoyage();
    } catch (error) { ui.notifications.warn(error?.message || "Unable to scrub voyage time."); }
  }

  #refreshActiveVoyage() {
    const root = this.element?.querySelector?.(".oscm-shell"), api = game.modules.get(MODULE_ID)?.api;
    if (!root || !api) return;
    const state = api.getCampaignTimeState(), voyage = state.activeVoyage;
    const live = root.querySelector("[data-voyage-live]"), engage = root.querySelector('[data-action="engage-route"]');
    const active = voyage && voyage.status !== "arrived";
    live?.classList.toggle("is-hidden", !voyage);
    if (engage) { engage.disabled = Boolean(active) || !this.selectedRoute; engage.textContent = active ? "VOYAGE ACTIVE" : "ENGAGE"; }
    if (!voyage) return;
    const evaluated = evaluateVoyage(voyage, state.properBaseMs);
    const hud = root.querySelector(".oscm-route-hud"); hud?.classList.remove("is-hidden");
    const voyageHud = {
      route: `${voyage.originName} → ${voyage.destinationName}`,
      spatial: voyage.context === "system" ? `${formatSystemDistance(voyage.distanceLy * LIGHT_YEAR_KM / AU_KM)} true distance` : `${formatLightYears(voyage.distanceLy)} true distance`,
      clusterTime: formatDuration(voyage.referenceYears), shipTime: formatDuration(voyage.shipYears),
      profile: `${voyage.accelerationG} g → ${(voyage.peakBeta * 100).toFixed(3)}% c${voyage.reachesCruise ? " → cruise → brake" : " peak → brake"}`,
    };
    for (const [field, value] of Object.entries(voyageHud)) { const el = root.querySelector(`[data-hud-field="${field}"]`); if (el) el.textContent = value; }
    const phaseLabels = { accelerating: evaluated.velocity >= .1 ? "RELATIVISTIC ACCELERATION" : "ACCELERATING", cruise: "CRUISE", decelerating: evaluated.velocity < .02 ? "ARRIVAL APPROACH" : "DECELERATING", arrived: "ARRIVED" };
    const phase = root.querySelector('[data-hud-field="phase"]'), velocity = root.querySelector('[data-hud-field="velocity"]');
    if (phase) phase.textContent = phaseLabels[evaluated.phase] || evaluated.phase.toUpperCase();
    if (velocity) velocity.textContent = `${formatVelocity(evaluated.velocity)}${evaluated.phase === "cruise" ? " · CRUISE LIMIT" : ""}`;

    const sameSelectedRoute = this.selectedRoute?.originId === voyage.originId && this.selectedRoute?.destinationId === voyage.destinationId;
    let origin = sameSelectedRoute ? this.selectedRoute.origin : null, destination = sameSelectedRoute ? this.selectedRoute.destination : null;
    if (!origin && voyage.context === "cluster" && this.mode === "cluster") {
      origin = SYSTEMS.find((system) => system.id === voyage.originId); destination = SYSTEMS.find((system) => system.id === voyage.destinationId);
    } else if (!origin && voyage.context === "system" && this.mode === "system" && this.activeSystem?.id === voyage.systemId) {
      origin = this._clusterView?.model?.objects?.find((object) => object.id === voyage.originId);
      destination = this._clusterView?.model?.objects?.find((object) => object.id === voyage.destinationId);
    }
    if (origin && destination && !this._clusterView?.isDraggingShip) this._clusterView?.setRouteVisualization?.({
      origin, destination,
      markers: trajectoryMarkers(evaluated.transit), shipFraction: evaluated.routeFraction,
      draggable: Boolean(game.user.isGM && api.isClockAuthority?.()),
    });
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
