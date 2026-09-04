# Jinyara surface-art intake — Step 2

This artifact is the deterministic bridge between the approved **Lancer GM Kit** illustration and Jinyara's canonical Cluster Map cartography. It deliberately stops before image-byte acquisition or warping.

## Canonical binding

- Cluster Map body: **Thebes / Jinyara**
- Cartography source: `data/planet-cartography/thebes/jinyara.json`
- Cartography SHA-256: `5d5347e444e9d86cbe162a4340b9cfb1be3e1a5f25cde46e2c3d98de7f9f1b19`
- Source fingerprint: `375d0440032e4c3c4480`
- Target UV frame: equirectangular, north-up, east-right, seam at ±180°

## Approved GM Kit source

- Campaign: `orphaned-sun-generated-maps`
- Entity: `generated-map-375d0440032e4c3c4480`
- Attachment: `cb4fdeae-019c-4d5e-b651-2229c4622080`
- Source dimensions: 1774×887 (2:1)
- Source bytes: 3829195
- Source SHA-256: **pending authenticated byte acquisition**

The exact attachment identity is known, but the private storage object has not been read by this repository. The v1 contract requires a real SHA-256 of the image bytes, so this step explicitly refuses to substitute an ETag or storage metadata hash.

## Anchor candidate pack

The one-off patch derives **211** deterministic semantic candidates directly from committed Jinyara metadata:

- hard: 18 — every settlement, with superstructure/metropolitan/regional hierarchy preserved
- strong: 68 — named continents, islands, lakes, ranges, and mountains
- soft: 125 — river endpoints and one midpoint for each transport corridor
- seam-adjacent: 24 candidates carry an alternate wrapped U coordinate

Every candidate stores canonical latitude/longitude, canonical UV, and the expected pixel location in the 1774×887 source image. Those expected pixels are only starting guesses. The next registration step must replace a selected subset with **observed** source-image UV coordinates before a transform is solved.

## What this step does not do

It does not modify Jinyara's canonical cartography, does not change the 114-map frozen atlas, does not add a runtime texture, does not hide primitive SVG layers, and does not add elevation/normal/lighting data. `data/surface-art/manifest.json` remains the runtime promotion authority and intentionally receives no Jinyara entry yet.

## Next gate

Step 3 can begin once the exact private attachment bytes are acquired through an authenticated authoring-time bridge. That step can compute the source checksum, observe selected anchors, solve the seam-aware warp, and bake `assets/body-textures/thebes/jinyara.webp`.
