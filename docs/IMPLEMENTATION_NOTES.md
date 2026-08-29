# Implementation notes

## Target environment

- Foundry VTT generation 13.
- LANCER system 3.1.3+.
- Forge-compatible: ordinary Foundry client APIs, browser-native SVG/DOM features, and no runtime third-party dependency.

## Foundry integration

The module uses `module.json`, ES modules, `foundry.applications.api.ApplicationV2` with `HandlebarsApplicationMixin`, scene-control hooks, and shared world settings for the navigation profile. The renderer remains SVG rather than Three.js/WebGL so cluster, system, cartographic, and local-operational views share one interaction language and remain crisp on high-DPI/mobile displays.

## Three map levels

1. **Cluster:** ten-system 3D political/navigation map in light-years.
2. **System:** all 126 canonical registry rows using physical parent-relative coordinates plus separately compressed display coordinates.
3. **Body/orbital:** accepted inhabited-world cartography or accepted local operational surveys for non-cartographic targets.

Pointer Events provide mouse, pen, and touch rotation. Wheel/pinch controls zoom and outward navigation. Display coordinates never replace physical coordinates for route or separation calculations.

## Inhabited-world cartography

The 43 accepted inhabited terrestrial maps remain under `data/planet-cartography/` and retain their accepted seeds, source fingerprints, 2° raster/vector products, cultural gazetteers, settlements, and transport networks. The body-operations pass does not regenerate or redefine them.

## Local operational assets

The canonical object registry remains `docs/system-orbital-distances.csv`. Non-cartographic local detail is materialized under:

- `data/body-operations/manifest.json`
- `data/body-operations/<system-slug>/<body-slug>.json`

The current registry yields **71** eligible operational targets after excluding stars, barycenters, and the 43 accepted cartographic worlds. The derived inventory includes Seti's Arrowfall Range, a canonical distributed military installation field that was omitted from the original 70-object planning list.

Every accepted operational asset stores:

- schema version and `orphaned-sun-body-operations-v1` model identity;
- system, body, and literal canonical CSV type;
- operational family;
- deterministic permanent seed;
- canonical-row fingerprint;
- accepted-canon status;
- coordinate-frame declaration and units;
- stable feature IDs and feature references;
- adaptive survey-layer definitions;
- operational summary.

`tools/generate-body-operations.mjs` derives the target set and writes deterministic JSON. `tools/validate-body-operations.mjs` verifies manifest coverage, source identity, coordinates/references, special-world constraints, mobile feature budgets, and exact regeneration. `scripts/body-operations.mjs` supplies runtime loading, inspection, coordinate projection, feature validation, and LOD planning.

Once an asset is accepted, that JSON is preserved generated canon. A future generator/model change must not silently redraw accepted assets under the same model identity.

## Coordinate frames

Operational geometry must declare its epistemic/physical status. The supported contracts are:

- **physical:** body-fixed latitude/longitude or established body-local geometry where the data supports literal positions;
- **physical reference-epoch snapshot:** fleet and belt samples whose offsets are meaningful at the stated gameplay epoch but are not permanent orbits;
- **constrained estimate:** station, vessel, yard, blinkgate, or megastructure local layouts where exact engineering dimensions are not established by canon;
- **uncertain observation volume:** anomalies whose mapped contours/perimeters are observational rather than fixed solid geometry.

Natural solid bodies use body-fixed latitude/longitude with optional elevation/depth. Giants use latitude/longitude plus atmospheric pressure/altitude context and never expose a traversable solid-surface route. Artificial structures use a declared local Cartesian frame. Belts and fleets use declared reference-epoch offsets. Thornfield is explicitly non-dockable and uncertain.

## Runtime rendering and LOD

The accepted v0.4/v0.5 `BodyView` remains the core renderer. The operational wrapper delegates existing cartographic and schematic rendering to that core, then adds selectable operational features, labels, feature connections, adaptive layer controls, and zoom-dependent LOD.

At orbital zoom only major landmarks, facilities, docks, formation elements, and hazards remain. Regional zoom adds secondary structures/resources/routes. Close zoom reveals the bounded accepted local feature set. Mobile plans enforce a smaller feature budget.

Artificial structures remain survey/superstructure plans rather than room-scale battle maps. Fleet/belt centroids remain distributed-region reference points rather than physical objects. Akhetan, Old Kestrel, Eilean Volna, The Long Hook, Arrowfall Range, Kalong, and Thornfield each have explicit acceptance checks preserving their canonical character.

## Navigation model

For cluster/system routes the module computes projected separation, depth-axis difference, true 3D distance, ship-frame contracted distance, cluster-rest-frame elapsed time, and shipboard proper time. The flight model uses constant proper acceleration, a configurable speed cap (default `0.995c`), and symmetric braking; sufficiently short routes use a midpoint flip instead.
