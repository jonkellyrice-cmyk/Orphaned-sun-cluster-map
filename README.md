# Orphaned Sun Cluster Map

A small Foundry VTT v13 module for the **Orphaned Sun** LANCER campaign. It opens an interactive three-dimensional SVG model of the campaign's compact Beehive Cluster and calculates relativistic route times between its ten major systems.

## Features

- 16 × 16 × 16 light-year wireframe cluster volume.
- 1 ly or 2 ly cubic lattice.
- Ten campaign systems at canonical X/Y/Z coordinates.
- Desktop: drag to rotate, mouse wheel to zoom, double-click empty space to reset the camera.
- Mobile/touch: one-finger drag rotates around the cluster center; pinch inward zooms out; pinch outward zooms in; tap two systems to draw a route.
- Click an origin and destination to draw a route line.
- Route readout includes:
  - projected 2D distance;
  - depth-axis separation;
  - true 3D distance;
  - ship-frame contracted distance;
  - cluster-rest-frame elapsed time;
  - shipboard proper time;
  - peak velocity.
- Configurable shared navigation profile. Defaults to **200 g** proper acceleration and **0.995c** maximum cruise speed.
- Automatically switches to a midpoint flip when a route is too short to reach the speed cap.
- No runtime third-party libraries or CDN calls.

## Compatibility

- Foundry VTT: **13**
- LANCER system: **3.1.3+**

The supplied LANCER 3.1.3 source itself declares Foundry VTT generation 13 compatibility.

## Development / local install

Copy this folder into:

`{Foundry user data}/Data/modules/orphaned-sun-cluster-map/`

Restart Foundry, enable **Orphaned Sun Cluster Map** in the world, then use the star button added to the Token scene controls.

You can also open it from the browser console or a macro:

```js
game.modules.get("orphaned-sun-cluster-map").api.open();
```

Run the deterministic navigation tests with:

```bash
npm test
```

## Forge / manifest installation

The `module.json` is already prepared for this GitHub repository.

Once release `v0.1.1` contains both `module.json` and `orphaned-sun-cluster-map-v0.1.1.zip`, Foundry/Forge can install from the manifest URL declared in `module.json`.

## Coordinate model

The X/Y geometry preserves the campaign map. The map was rescaled to a compact 15-light-year maximum projected span. Z is an inferred depth axis with a conservative six-light-year total spread. See `scripts/cluster-data.mjs` and `docs/IMPLEMENTATION_NOTES.md`.
