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

Hooks.on("getSceneControlButtons", (controls) => {
  const tokenControl = controls.tokens;
  if (!tokenControl?.tools) return;

  tokenControl.tools.orphanedSunClusterMap = {
    name: "orphanedSunClusterMap",
    title: "Orphaned Sun Cluster Map",
    icon: "fa-solid fa-star",
    order: Object.keys(tokenControl.tools).length,
    button: true,
    visible: true,
    onChange: () => openClusterMap(),
  };
});
