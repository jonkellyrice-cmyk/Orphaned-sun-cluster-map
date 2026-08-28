# Implementation notes

## Target environment

- Foundry VTT generation 13.
- LANCER system 3.1.3 (the supplied `foundryvtt-lancer` source declares Foundry minimum/verified/maximum 13).
- Forge-compatible because the module uses only ordinary Foundry client APIs and browser-native SVG/DOM features.

## Foundry integration

The module uses:

- `module.json` at the module root, loaded through the `esmodules` and `styles` manifest fields.
- `foundry.applications.api.ApplicationV2` with `HandlebarsApplicationMixin` rather than deprecated Application V1 classes.
- `Hooks.on("getSceneControlButtons", ...)` to add a button to the Token scene-control palette.
- `game.settings.register` for the shared world navigation profile.

Relevant Foundry documentation:

- Module development: https://foundryvtt.com/article/module-development/
- V13 API: https://foundryvtt.com/api/v13/
- ApplicationV2: https://foundryvtt.com/api/v13/classes/foundry.applications.api.ApplicationV2.html
- SceneControlTool: https://foundryvtt.com/api/v13/interfaces/foundry.SceneControlTool.html
- Package management / manifest installs: https://foundryvtt.com/article/package-management/

## Renderer choice

The visualization uses a small custom SVG projection layer rather than Three.js/WebGL. That is intentional:

- Only points, labels, a cubic lattice, axes, and one route line need rendering.
- SVG remains crisp at arbitrary zoom and on high-DPI displays.
- Stars are ordinary SVG groups, so click/keyboard selection does not require raycasting.
- There are no runtime third-party dependencies or CDN requirements, which is useful on Forge.

The projector maintains yaw, pitch, zoom, and a modest perspective factor. Pointer Events provide one implementation for mouse, pen, and touch: one-pointer drag rotates the volume, a two-pointer pinch changes zoom, mouse wheel zooms on desktop, and tap/click selection is protected from accidental activation after drag or pinch gestures. Star hit targets are enlarged invisibly for touch without changing their rendered size.

## Navigation model

For each pair of systems the module computes:

1. 2D map projection distance.
2. Z-axis depth difference.
3. True 3D Euclidean separation.
4. Length-contracted distance at peak/cruise velocity.
5. Cluster-rest-frame elapsed time.
6. Shipboard proper time.

The flight model uses constant proper acceleration, a configurable speed cap (default `0.995c`), and symmetric braking. If a route is too short to reach the speed cap, the module automatically performs a midpoint flip instead.

## Cluster coordinates

The ten systems preserve the campaign map's relative 2D geometry. The map was rescaled so Abydos-Amarna is 15 light-years in projection. The inferred depth values are deliberately conservative: `-3, -1.5, 0, +1.5, +3 ly`.
