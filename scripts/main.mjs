import { ClusterMapApplication, MODULE_ID } from "./cluster-map-app.mjs";

let app = null;

export function openClusterMap() {
  if (app?.rendered) {
    app.bringToFront();
    return app;
  }
  app = new ClusterMapApplication();
  app.render({ force: true });
  return app;
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

  const module = game.modules.get(MODULE_ID);
  if (module) module.api = Object.freeze({ open: openClusterMap });
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
