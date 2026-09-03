# Orphaned Sun Cluster Map

A Foundry VTT v13 module for the **Orphaned Sun** LANCER campaign. It provides an interactive three-dimensional SVG model of the campaign's compact Beehive Cluster, system-scale orbital maps, body/orbital inspection views, and relativistic route calculations.

## Features

- 16 × 16 × 16 light-year wireframe cluster volume with the ten campaign systems at canonical X/Y/Z coordinates.
- Interactive AU-scale system maps for all 126 canonical system/object rows, preserving physical hierarchical coordinates separately from compressed display coordinates.
- Double-click/double-tap or inward zoom from cluster → system → body, with explicit outward breadcrumbs and wheel/pinch return navigation.
- Forty-three inhabited terrestrial worlds with accepted deterministic 2° cartography: coastlines, elevation/contours, hydrology, ecoregions, soils, resources, settlements, permanent cultural gazetteers, and transport geometry.
- **Seventy-one non-cartographic bodies and orbital structures with accepted deterministic local operational surveys**, including barren worlds and moons, giants, belts, stations, installations, shipyards, vessels, fleets, blinkgates, megastructures, and anomalies.
- Operational body views expose named landmarks, extraction sites, habitats, landing fields, hazards, docks, modules, approaches, formation elements, structural segments, and observation perimeters as appropriate to each body family.
- Culture-aware permanent names use Aurethic, Vostrann, Xuānhari, Vadan, or cosmopolitan Union naming traditions while retaining functional labels where they are more realistic.
- Zoom-dependent SVG level of detail keeps orbital, regional, and close inspection useful on desktop and mobile without room-scale interiors or unbounded DOM growth.
- Desktop: drag to rotate, mouse wheel to zoom, double-click empty space to reset the camera.
- Mobile/touch: one-finger drag rotates; pinch changes zoom; touch activation uses the same cluster/system/body navigation model.
- Route calculations use physical coordinates only. Display compression and operational schematics are never treated as navigation distances.
- Configurable shared navigation profile, defaulting to **200 g** proper acceleration and **0.995c** maximum cruise speed, with automatic midpoint flips on short routes.
- Dual persistent campaign clocks distinguish **Cradle reference-frame time** from **crew proper time**; selected routes can be engaged as analytical relativistic voyages with live phase, velocity, transition markers, and ship position.
- System views resolve deterministic Keplerian planet/moon positions and body rotations from **Cradle reference time** on demand; no offscreen or frame-by-frame astronomy simulation runs.
- No runtime third-party libraries or CDN calls.

## Operational survey canon

`docs/system-orbital-distances.csv` remains the canonical object registry. Accepted local operational detail lives separately under `data/body-operations/` so the registry is not expanded into thousands of feature columns.

Each body-operation asset records its permanent seed, model version, canonical-row fingerprint, coordinate frame, stable feature IDs, generated feature collections, and accepted-canon status. Regeneration is byte-for-byte deterministic and validated against the current canonical row before publication.

The current operational inventory is 71 objects. This includes Seti's **Arrowfall Range**, which the canonical registry defines as a distributed military installation field and therefore qualifies for local operational detail even though it was absent from the initial 70-object planning list.

## Compatibility

- Foundry VTT: **13**
- LANCER system: **3.1.3+**

## Development / local install

Copy this folder into:

`{Foundry user data}/Data/modules/orphaned-sun-cluster-map/`

Restart Foundry, enable **Orphaned Sun Cluster Map**, then use the map button in the Measurement controls. It may also be opened from the browser console or a macro:

```js
game.modules.get("orphaned-sun-cluster-map").api.open();
```

Run the complete deterministic suite with:

```bash
npm test
```

Operational canon can also be audited directly:

```bash
npm run body-operations:validate
npm run body-operations:check
npm run astronomy:check
npm run astronomy:validate
```

## Forge / manifest installation

Release `v0.9.0` is packaged with both `module.json` and `orphaned-sun-cluster-map-v0.9.0.zip`. Foundry/Forge updates use the manifest URL declared in `module.json`.

## Coordinate model

Cluster and system navigation retain their established physical coordinate model. Operational assets explicitly declare whether their geometry is physical, a physical reference-epoch snapshot, a constrained estimate, or an uncertain observation volume. Belt and fleet layouts are reference-epoch snapshots; anomalies remain observational/uncertain; gas giants use atmospheric coordinates rather than a fictitious solid surface. See `docs/IMPLEMENTATION_NOTES.md`.
