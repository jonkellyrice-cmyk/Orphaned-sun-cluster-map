# Jinyara surface-art registration — Step 3

Jinyara is the first promoted illustrated planetary surface in the Cluster Map surface-art pipeline.

## Source authority

Canonical geometry remains authoritative from:

- `data/planet-cartography/thebes/jinyara.json`
- canonical SHA-256: `5d5347e444e9d86cbe162a4340b9cfb1be3e1a5f25cde46e2c3d98de7f9f1b19`
- source fingerprint: `375d0440032e4c3c4480`

The approved Lancer GM Kit illustration was acquired only at authoring time from the exact attachment pinned in the Step 2 intake artifact. The source file was verified from its actual bytes rather than storage metadata:

- PNG: 1774 × 887, exact 2:1 equirectangular frame
- byte size: 3,831,433
- SHA-256: `65efc7f9ffdd6bee7f15dfe36ee5f1bc2d5e994a09d86f80a73ae57ee2e83b38`

The GM Kit private object remains provenance only. Foundry has no runtime dependency on Supabase or on a signed/private image URL.

## Registration result

The authoring pass first compared the canonical land/water geometry against a geometry-led color segmentation of the finished illustration. It found a broad source-to-canonical registration offset of 18 pixels horizontally and -1 pixel vertically in the 443 × 222 analysis frame, with longitude handled as a wrapping seam.

The Step 2 pool contained 211 possible semantic control points. The registration pass measured reliable local land/water-shape correspondence around the bounded shortlist and retained 18 observations for the smooth seam-aware warp. The committed manifest records those actual source-image UV observations rather than treating the original projection guesses as measurements.

Quality results:

- macro land/water balanced accuracy: **0.801719**
- macro ocean Jaccard overlap: **0.744016**
- reliable measured anchors: **18**
- RMS anchor residual: **15.9436 px**
- maximum anchor residual: **30.7297 px**
- warp method: periodic thin-plate spline with conservative smoothing and bounded deformation

These values satisfy the Step 3 conservative promotion gates. The purpose of registration is not to repaint canonical geography pixel-for-pixel; it is to preserve the approved illustrated surface while pulling its major geography and semantic landmarks back into the canonical UV frame closely enough that Cluster Map coordinates remain authoritative.

## Runtime derivative

The promoted runtime texture is:

- `assets/body-textures/thebes/jinyara.webp`
- 1774 × 887 WebP
- 390,622 bytes
- SHA-256: `0234a0e93e029119a84815ee3ebd25fa81d00f08b58fdd78ffb7ac78a0cf6d7e`

`data/surface-art/manifest.json` now contains Jinyara as a `promoted` v1 surface-art entry. The release workflow packages `assets/` and explicitly requires both the surface-art manifest and the Jinyara texture in the Foundry archive.

## Scope boundary

This step does **not** change Jinyara's canonical latitude/longitude geometry, elevation raster, hydrology, settlement coordinates, transport routes, or the frozen 114-sheet atlas. It also does not yet change the live body renderer to consume the promoted texture. Runtime consumption is the next integration step; this step establishes the validated, repository-local texture and provenance contract that renderer work can safely consume.
