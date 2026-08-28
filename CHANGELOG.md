# Changelog

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
