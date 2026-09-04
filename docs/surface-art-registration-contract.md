# Illustrated surface art promotion / registration contract v1

This contract defines the return path for approved planetary illustrations created from Cluster Map cartography and stored in the Lancer GM Kit.

## Authority boundary

- **Cluster Map remains authoritative for geography.** Canonical latitude/longitude, settlements, transport routes, hydrology, gazetteer features, primitive SVG generation, and the cartography JSON are never rewritten to match a painting.
- **The Lancer GM Kit remains authoritative for the approved source illustration.** The source artwork is identified by stable logical metadata plus a SHA-256, never by a temporary signed URL.
- **Foundry runtime uses only a repository-local promoted derivative.** The module does not fetch private GM Kit/Supabase media while players are using the map.
- The primitive SVG/reference-map pipeline remains intact. Promotion changes only the future player-facing surface renderer for bodies that have a promoted texture.

## Lifecycle

A registration record has one of three stages:

1. `source-linked` — the approved GM Kit master has been bound to an exact canonical cartography source.
2. `registered` — at least three seam-aware anchor correspondences have been established from source-art UV coordinates to canonical latitude/longitude.
3. `promoted` — a baked, exact 2:1 WebP derivative exists under `assets/body-textures/` and is safe for runtime use.

The runtime manifest accepts only `promoted` entries. Intermediate records may be created by one-off tooling during later steps, but they do not become runtime authority.

## Canonical binding

Each entry is pinned to both:

- the exact `data/planet-cartography/<system>/<body>.json` path;
- its SHA-256 as used by the Generated Maps export;
- its 20-character source fingerprint.

A changed canonical source therefore invalidates a stale promotion instead of silently applying old artwork to new geography.

## Projection contract

The promoted texture target is always:

- equirectangular;
- exact 2:1 aspect ratio;
- north up;
- east right;
- latitude domain `[-90, 90]`;
- longitude domain `[-180, 180)`;
- prime meridian at 0°;
- seam at ±180° with longitude wrapping.

Canonical UV conversion is:

- `u = (wrap(longitude) + 180) / 360`
- `v = (90 - latitude) / 180`

The source illustration does **not** have to begin at 2:1. Its original dimensions and checksum are preserved in `sourceArtwork`; registration maps normalized source-art UV coordinates to the canonical target.

## Anchor contract

Registration uses `seam-aware-anchor-warp` with weighted semantic control points. Every anchor stores:

- a stable anchor id;
- a canonical feature reference and feature class;
- tier: `hard`, `strong`, or `soft`;
- weight in `(0, 1]`;
- canonical latitude/longitude;
- source-art UV coordinates normalized to `[0,1]`.

The target UV is derived from canonical latitude/longitude rather than stored independently. This prevents target coordinates from drifting away from canonical geography.

Intended anchor hierarchy:

- **hard:** capital, superstructure/metropolitan settlements, major ports, mission-critical infrastructure;
- **strong:** distinctive islands, major lakes, river mouths, major coastline junctions, major route junctions;
- **soft:** secondary coastline samples, secondary waterways/routes, biome-transition references.

Low-information regions such as open ocean, generic desert/plain/forest interiors, and broad ice interiors are preferred deformation sinks. The registration algorithm must wrap across the ±180° seam rather than treating the two map edges as geographically distant.

## Runtime derivative

A promoted entry must point to an exact 2:1 `.webp` under `assets/body-textures/`, with dimensions and SHA-256 recorded in the registration record. Runtime code will eventually use this local derivative instead of the source GM Kit media.

## Explicit v1 exclusions

This contract does **not** add or authorize:

- elevation/displacement;
- grayscale height maps;
- normal maps;
- additional lighting maps;
- mutation or deletion of canonical cartography metadata;
- deletion of primitive SVG/reference generation;
- runtime network access to the GM Kit or Supabase;
- a textured-globe renderer yet.

Those are separate later steps.

## First pilot

The first intended promotion is **Thebes / Jinyara**. Step 1 deliberately creates no Jinyara manifest entry because the approved image bytes, image checksum, source-art logical reference, anchor correspondences, and baked runtime texture do not belong to the contract-definition step.
