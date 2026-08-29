# Changelog

## v0.4.0

- Replaced placeholder non-habitable body discs with deterministic metadata-driven SVG renderers.
- Added cratered, icy, volatile-rich and mineral-bearing moon/minor-world surfaces plus banded gas giants and storm systems.
- Added substantive station, ring-station, shipyard, vessel, fleet, blinkgate, tether/ring megastructure and anomaly silhouettes.
- Added asteroid-belt fly-through views without treating distributed belt centroids as route endpoints.
- Structure color accents now follow canonical visual palettes, and docking approaches remain inspectable.
- Hid planetary survey-layer controls when viewing ships, stations and other non-geographic bodies.

## v0.3.1

- Fixed Forge orbital-body views failing to load because the v0.3.0 release archive omitted `data/planet-geography`.
- Added release-package checks for the geography manifest and representative Sais world assets.

## v0.3.0

- Added a third orbital/body zoom level for terrestrial planets, moons, dwarf worlds, giants, stations, shipyards, vessels, fleets, blinkgates, megastructures, and anomalies.
- Added gesture-safe cluster → system → body navigation with double-click/double-tap, selected-object inward zoom, outward-zoom return, and explicit breadcrumbs.
- Materialized deterministic accepted-working-canon surface geometry for all 43 inhabited terrestrial worlds from the canonical CSV metadata and permanent seeds.
- Added tectonic plates, elevation and sea-level fitting, climate, rainfall, rivers, lakes, biomes, soils, resource provinces, settlement sites, capitals, and transport corridors.
- Added inspectable orbital survey layers and distinct natural/artificial approach presentation contracts.
- Preserved the canonical object registry byte-for-byte and added exact-regeneration, coverage, interaction, and asset-budget validation; 64 tests now pass.

## v0.2.0

- Added interactive three-dimensional system views for all ten major systems, generated from the canonical system-object registry.
- Double-click/double-tap or zoom into a selected cluster system to enter it; zoom outward or use the explicit cluster-back control to return.
- Added schematic stars, planets, moons, giants, stations, shipyards, vessels, fleets, belts, installations, blinkgates, and anomalies.
- Added hierarchical physical reference-epoch coordinates with parent-relative AU/km conversion and separate compressed display coordinates.
- Added physical point-to-point local navigation using the existing relativistic solver, with useful km, million-km, AU, seconds, and minutes formatting.
- Added system object details, inclined orbital paths, belt-region rendering, touch targets, keyboard selection, and cluster-only overlay suppression.
- Added deterministic tests across all ten systems and all 126 catalogued objects.
- Expanded the canonical inhabited-world registry with deterministic physical-geography, ecology, resource, and settlement metadata for 43 terrestrial worlds.

## v0.1.8

- Reworked faction-to-faction borders into genuinely three-dimensional frontier surfaces instead of carrying one XY seam straight through the depth axis.
- Territorial footprints are now lofted through multiple Z slices, allowing a shared border to wander laterally as depth changes: one polity can bulge into a region at one depth while its neighbor regains that space at another.
- The lateral deformation field is shared across factions, so adjacent territories move along the same seam rather than developing arbitrary cracks between independently randomized borders.
- The original 2D faction-control map remains the exact Z=0 cross-section, preserving the established campaign-map topology.
- Lateral warping fades to zero at the cluster-box exterior and is strongly suppressed around every Big Ten system, keeping inhabited systems as hard political anchors.
- Added deterministic tests for lofted side surfaces, changing seam position across depth, Z=0 map preservation, Big Ten anchor stability, and system containment in warped 3D cross-sections.

## v0.1.7

- Reworked faction-control volumes so the inferred Z dimension is no longer a constant flat extrusion.
- Front and rear depth boundaries now vary smoothly across each faction footprint, allowing territorial influence to bulge forward in some regions and recede in others.
- The front and rear surfaces use independent depth variation, so territories can shift and taper rather than simply becoming uniformly thicker or thinner.
- Political-system locations remain hard anchor regions: depth warping is smoothly suppressed around each faction's owned Big Ten systems so those systems remain securely inside their established territory.
- Grayspace receives the strongest unconstrained depth variation, helping the unclaimed region read as an irregular volume rather than another fitted block.
- Added deterministic tests for non-flat front/rear depth boundaries and anchor-system containment.

## v0.1.6

- Added a compact route-travel HUD directly over the upper-right corner of the 3D cluster view.
- The HUD appears only after two systems are selected and stays visible while the cube rotates.
- It shows origin → destination, true 3D distance, cluster/reference-frame elapsed time, and shipboard/subjective elapsed time.
- Added the current acceleration/cruise profile as a compact footer so the time assumptions remain visible.
- Added responsive mobile sizing and made the HUD non-interactive so it cannot block star taps or rotation gestures.
- Added deterministic tests for HUD fields, visibility wiring, and upper-right mobile overlay behavior.

## v0.1.5

- Added upright screen-space SVG emblems above each faction capital system.
- Capital assignments: Eventide/Abydos, XUANJIA Mandate/Sais, Adainian Conclave/Nekhen, Signatories of the Accords Paramount/Saqqara, and Union/Amarna.
- Added simplified map glyphs based on the established faction flag designs: Eventide enclosed sunrise, Mandate Fivefold Lotus, Conclave eclipsed sun, Accords Bound Star, and Union three-bars mark.
- Capital emblems follow their projected star positions while remaining visually north-up and constant-size as the 3D cube rotates and zooms.
- Added non-interactive leader lines so capital symbols remain clearly associated with their systems without interfering with star selection.
- Added deterministic tests for all five capital assignments and system references.

## v0.1.4

- Extrapolated the 2D Manger faction-control map into approximate three-dimensional territorial volumes.
- Added very faint translucent control fields for Union, the Signatories of the Accords, XUANJIA Mandate, Adainian Conclave, Eventide, and Grayspace.
- Territorial footprints preserve the source map's broad borders and adjacency while inferred Z-depth scales with each region's planar dimensions.
- The faction volumes rotate and zoom with the cluster while remaining behind the white lattice, stars, and route line.
- Added a compact territorial-control legend and explicit note that Z boundaries are approximate rather than surveyed.
- Added deterministic tests for faction-volume structure and Big Ten placement against the 2D control map.

## v0.1.3

- Added canonical stellar configuration, spectral type, and visible-color metadata for all Big Ten systems.
- Star markers now use system-specific stellar colors instead of a universal white marker.
- Memphis is rendered as its anomalous viridian-green K1V star with a pale green-white core.
- Tanis is rendered as a close binary with a larger golden-yellow G8V primary and a smaller orange K4V secondary.
- Route-selection highlighting now uses an outer ring so selecting a system no longer overwrites its stellar color.
- Added hover/title metadata for stellar classifications and visible-color descriptions.

## v0.1.2

- Moved the Cluster Map launcher from Token Controls to Measurement Controls.
- The map button now appears last in the measurement tool palette, directly beneath Clear Templates for GMs and as the last visible measurement tool for players.
- Changed the launcher icon to a map icon and shortened the tooltip to "Cluster Map".

## v0.1.1

- Initial Forge/Foundry VTT 13 release.
- Interactive 3D SVG cluster view with ten Orphaned Sun systems.
- Mouse and mobile controls: drag/one-finger rotate, wheel/pinch zoom, click/tap route selection.
- Relativistic route calculator using configurable proper acceleration and cruise speed.
# v0.5.0

- Added accepted high-resolution deterministic cartography for all 43 inhabited terrestrial worlds.
- Added smooth coastlines, terrain meshes, contours, routed hydrology, ecoregions, soils, resource provinces, settlements, and exact transport geometry.
- Added culture-aware permanent gazetteers and city/route names for every controlling polity.
- Added zoom-dependent SVG cartography to the existing orbital body viewer while retaining mobile gestures and outward navigation.
