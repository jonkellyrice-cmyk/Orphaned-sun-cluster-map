# Jinyara surface-art intake — Step 2

This is the deterministic intake bridge between the approved **Lancer GM Kit** illustration and Jinyara's canonical Cluster Map cartography. It stops before private image-byte acquisition or warping.

## Canonical binding

- Body: **Thebes / Jinyara**
- Source: `data/planet-cartography/thebes/jinyara.json`
- Cartography SHA-256: `5d5347e444e9d86cbe162a4340b9cfb1be3e1a5f25cde46e2c3d98de7f9f1b19`
- Source fingerprint: `375d0440032e4c3c4480`
- UV frame: equirectangular, north-up, east-right, seam at ±180°

## Exact GM Kit attachment

- Campaign: `orphaned-sun-generated-maps`
- Entity: `generated-map-375d0440032e4c3c4480`
- Attachment: `cb4fdeae-019c-4d5e-b651-2229c4622080`
- Source dimensions: 1774×887 (2:1)
- Source bytes: 3829195
- Source SHA-256: **pending authenticated byte acquisition**

The attachment identity is exact, but Cluster Map has not read the private object bytes. The v1 contract requires a real SHA-256, so this step deliberately does not substitute the storage ETag or any metadata-derived value.

## Registration anchors

The script audits a full metadata-derived pool of **211** candidates (18 hard / 68 strong / 125 soft), but it persists only a bounded **50-anchor registration shortlist**:

- 18 hard — all 18 settlements, preserving superstructure/metropolitan/regional hierarchy
- 16 strong — spatially distributed macro-geography from continents, islands, lakes, ranges, and mountains
- 16 soft — spatially distributed road midpoints and hydrology endpoints
- 22 selected anchors are seam-adjacent and carry an alternate wrapped U coordinate

The full 211-candidate pool is reproducible from canonical metadata and is therefore not duplicated into committed JSON. Each selected anchor stores canonical latitude/longitude, canonical UV, and an expected pixel location in the 1774×887 source. Expected pixels are initial guesses only; Step 3 replaces them with observed image correspondences.

## Scope boundary

This step does not modify Jinyara cartography, change the 114-map frozen atlas, add a runtime texture, hide primitive SVG layers, or add elevation/normal/lighting data. `data/surface-art/manifest.json` remains unchanged.

## Next gate

Step 3 is authenticated source acquisition + correspondence registration: read the exact private image bytes, compute its SHA-256, measure selected source-image anchors, solve the seam-aware warp, and bake `assets/body-textures/thebes/jinyara.webp`.
