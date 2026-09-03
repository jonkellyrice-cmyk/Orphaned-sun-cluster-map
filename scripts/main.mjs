import { ClusterMapApplication, MODULE_ID } from "./cluster-map-app.mjs";
import {
  DEFAULT_UNIVERSAL_TIME_STATE,
  UNIVERSAL_TIME_SETTING,
  formatUniversalClock,
  formatUniversalDate,
  formatUniversalTimeInput,
  makeUniversalTimeMs,
  normalizeUniversalTimeState,
  universalTimeParts,
} from "./universal-time.mjs";
import {
  CAMPAIGN_TIME_SETTING, DEFAULT_CAMPAIGN_TIME_STATE, adjustCampaignProperTime,
  currentCampaignTime, normalizeCampaignTimeState, resumeCampaignTimeSession,
  setCampaignProperTimestamp, setCampaignTimeRunning, settleCampaignTime,
} from "./campaign-time.mjs";

let app = null;
let universalClockObserver = null;
let universalClockHeartbeat = null;
let universalClockLifecycleBound = false;

const MINUTE_MS = 60_000;
const UNIVERSAL_CLOCK_CHECKPOINT_MS = 30_000;
const UNIVERSAL_CLOCK_SESSION_STARTED_REAL_MS = Date.now();

export function openClusterMap() {
  if (app?.rendered) {
    app.bringToFront();
    return app;
  }
  app = new ClusterMapApplication();
  app.render({ force: true });
  return app;
}

function readUniversalTimeState() {
  return normalizeCampaignTimeState(game.settings.get(MODULE_ID, CAMPAIGN_TIME_SETTING));
}

function getUniversalTimeState() {
  const state = readUniversalTimeState();
  if (state.running && state.anchorRealMs > 0 && state.anchorRealMs < UNIVERSAL_CLOCK_SESSION_STARTED_REAL_MS) {
    return resumeCampaignTimeSession(state, UNIVERSAL_CLOCK_SESSION_STARTED_REAL_MS);
  }
  return state;
}

async function saveUniversalTimeState(state) {
  if (!game.user.isGM) return false;
  await game.settings.set(MODULE_ID, CAMPAIGN_TIME_SETTING, state);
  window.dispatchEvent(new CustomEvent("oscm-campaign-time-changed", { detail: state }));
  return true;
}

function isUniversalClockAuthority() {
  if (!game.user?.isGM) return false;
  const activeGM = game.users?.activeGM;
  return !activeGM || activeGM.id === game.user.id;
}

async function checkpointUniversalClock() {
  if (!isUniversalClockAuthority()) return;
  const state = getUniversalTimeState();
  if (!state.running) return;
  await saveUniversalTimeState(settleCampaignTime(state, Date.now()));
}

function startUniversalClockSessionMaintenance() {
  if (!isUniversalClockAuthority()) return;

  if (!universalClockHeartbeat) {
    universalClockHeartbeat = window.setInterval(() => {
      void checkpointUniversalClock();
    }, UNIVERSAL_CLOCK_CHECKPOINT_MS);
  }

  if (!universalClockLifecycleBound) {
    universalClockLifecycleBound = true;
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") void checkpointUniversalClock();
    });
    window.addEventListener("pagehide", () => {
      void checkpointUniversalClock();
    });
  }
}

function populateClockInputs(root, ms) {
  const parts = universalTimeParts(ms);
  const month = root.querySelector('[name="universalMonth"]');
  const day = root.querySelector('[name="universalDay"]');
  const year = root.querySelector('[name="universalYear"]');
  const time = root.querySelector('[name="universalTime"]');
  if (month) month.value = String(parts.month);
  if (day) day.value = String(parts.day);
  if (year) year.value = String(parts.year);
  if (time) time.value = formatUniversalTimeInput(ms);
}

function refreshUniversalClock(root, { forceInputs = false } = {}) {
  if (!root?.isConnected) return;
  const state = getUniversalTimeState();
  const current = currentCampaignTime(state);
  const ms = current.properBaseMs;
  const date = root.querySelector("[data-proper-date]");
  const clock = root.querySelector("[data-proper-clock]");
  const referenceDate = root.querySelector("[data-reference-date]");
  const referenceClock = root.querySelector("[data-reference-clock]");
  const status = root.querySelector("[data-universal-clock-status]");
  const toggle = root.querySelector('[data-action="toggle-universal-clock"]');

  if (date) date.textContent = formatUniversalDate(ms);
  if (clock) clock.textContent = formatUniversalClock(ms);
  if (referenceDate) referenceDate.textContent = formatUniversalDate(current.referenceBaseMs);
  if (referenceClock) referenceClock.textContent = formatUniversalClock(current.referenceBaseMs);
  if (status) status.textContent = state.running ? "RUNNING" : "PAUSED";
  if (toggle) {
    toggle.innerHTML = state.running
      ? '<i class="fa-solid fa-pause"></i> Pause'
      : '<i class="fa-solid fa-play"></i> Play';
  }

  const setPanel = root.querySelector(".oscm-clock-set");
  if (forceInputs || !setPanel?.contains(document.activeElement)) populateClockInputs(root, ms);
}

async function mutateUniversalClock(root, mutation) {
  if (!game.user.isGM) return;
  try {
    const next = mutation(getUniversalTimeState(), Date.now());
    await saveUniversalTimeState(next);
    refreshUniversalClock(root, { forceInputs: true });
  } catch (error) {
    console.error(`${MODULE_ID} | Unable to update universal time`, error);
    ui.notifications.warn(error?.message || "Unable to update universal time.");
  }
}

function bindUniversalClock(root) {
  if (!root || root.dataset.universalClockBound === "true") return;
  root.dataset.universalClockBound = "true";

  root.querySelector('[data-action="toggle-universal-clock"]')?.addEventListener("click", () => {
    mutateUniversalClock(root, (state, now) => setCampaignTimeRunning(state, !state.running, now));
  });

  for (const button of root.querySelectorAll("[data-clock-delta-minutes]")) {
    button.addEventListener("click", () => {
      const deltaMinutes = Number(button.dataset.clockDeltaMinutes);
      if (!Number.isFinite(deltaMinutes)) return;
      mutateUniversalClock(root, (state, now) => adjustCampaignProperTime(state, deltaMinutes * MINUTE_MS, now));
    });
  }

  root.querySelector('[data-action="set-universal-clock"]')?.addEventListener("click", () => {
    const month = Number(root.querySelector('[name="universalMonth"]')?.value);
    const day = Number(root.querySelector('[name="universalDay"]')?.value);
    const year = Number(root.querySelector('[name="universalYear"]')?.value);
    const timeValue = String(root.querySelector('[name="universalTime"]')?.value || "");
    const [hourText, minuteText] = timeValue.split(":");
    const hour = Number(hourText);
    const minute = Number(minuteText);
    const properMs = makeUniversalTimeMs({ year, month, day, hour, minute, second: 0 });
    mutateUniversalClock(root, (state, now) => setCampaignProperTimestamp(state, properMs, now));
  });

  refreshUniversalClock(root, { forceInputs: true });
  const ticker = window.setInterval(() => {
    if (!root.isConnected) {
      window.clearInterval(ticker);
      return;
    }
    refreshUniversalClock(root);
  }, 250);
}

function installUniversalClockObserver() {
  if (universalClockObserver || !document?.body) return;
  const attach = () => document.querySelectorAll(".orphaned-sun-cluster-map .oscm-shell").forEach(bindUniversalClock);
  universalClockObserver = new MutationObserver(attach);
  universalClockObserver.observe(document.body, { childList: true, subtree: true });
  attach();
}

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "accelerationG", {
    name: "Acceleration (g)",
    scope: "world",
    config: false,
    type: Number,
    default: 200,
  });

  game.settings.register(MODULE_ID, "cruiseBeta", {
    name: "Maximum cruise velocity (fraction of c)",
    scope: "world",
    config: false,
    type: Number,
    default: 0.995,
  });

  game.settings.register(MODULE_ID, "gridSpacing", {
    name: "Cluster grid spacing (ly)",
    scope: "world",
    config: false,
    type: Number,
    default: 1,
  });

  game.settings.register(MODULE_ID, UNIVERSAL_TIME_SETTING, {
    name: "Universal campaign time",
    scope: "world",
    config: false,
    type: Object,
    default: { ...DEFAULT_UNIVERSAL_TIME_STATE },
  });
  game.settings.register(MODULE_ID, CAMPAIGN_TIME_SETTING, {
    name: "Campaign proper/reference time and active voyage",
    scope: "world", config: false, type: Object,
    default: { ...DEFAULT_CAMPAIGN_TIME_STATE },
  });

  const module = game.modules.get(MODULE_ID);
  if (module) module.api = Object.freeze({ open: openClusterMap, getCampaignTimeState: () => currentCampaignTime(getUniversalTimeState()), saveCampaignTimeState: saveUniversalTimeState, isClockAuthority: isUniversalClockAuthority });
});

Hooks.once("ready", async () => {
  if (isUniversalClockAuthority()) {
    let stored = readUniversalTimeState();
    const legacy = normalizeUniversalTimeState(game.settings.get(MODULE_ID, UNIVERSAL_TIME_SETTING));
    if (stored.properBaseMs === DEFAULT_CAMPAIGN_TIME_STATE.properBaseMs && legacy.baseMs !== DEFAULT_UNIVERSAL_TIME_STATE.baseMs) {
      stored = { ...stored, properBaseMs: legacy.baseMs, referenceBaseMs: legacy.baseMs, running: legacy.running };
    }
    const resumed = resumeCampaignTimeSession(stored, Date.now());
    await saveUniversalTimeState(resumed);
    startUniversalClockSessionMaintenance();
  }
  installUniversalClockObserver();
});

function getMeasurementControl(controls) {
  if (controls.measure?.tools) return controls.measure;
  if (controls.templates?.tools) return controls.templates;

  return Object.values(controls).find((control) => {
    const tools = Object.values(control?.tools ?? {});
    return tools.some((tool) => {
      const name = String(tool?.name ?? "").toLowerCase();
      const icon = String(tool?.icon ?? "").toLowerCase();
      return name.includes("clear") && name.includes("template") || icon.includes("fa-trash");
    });
  });
}

Hooks.on("getSceneControlButtons", (controls) => {
  const measurementControl = getMeasurementControl(controls);
  if (!measurementControl?.tools) return;

  const existingTools = Object.values(measurementControl.tools);
  const lastOrder = existingTools.reduce((max, tool) => {
    const order = Number(tool?.order);
    return Number.isFinite(order) ? Math.max(max, order) : max;
  }, existingTools.length - 1);

  measurementControl.tools.orphanedSunClusterMap = {
    name: "orphanedSunClusterMap",
    title: "Cluster Map",
    icon: "fa-solid fa-map",
    order: lastOrder + 1,
    button: true,
    visible: true,
    onChange: () => openClusterMap(),
  };
});
