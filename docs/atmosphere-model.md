# Orphaned Sun atmospheric composition model

Model version: `orphaned-sun-atmosphere-v1`

## Purpose

The system registry already establishes each natural body's mean atmospheric pressure and qualitative atmospheric character. This model makes that information machine-readable enough for weather, ecology, habitability and map/environment systems without replacing existing canon or forcing every inhabited world to have Earth-identical air.

The governing rule is **derive first; invent only the unresolved remainder conservatively and deterministically**.

## Canonical pressure remains authoritative

`docs/system-orbital-distances.csv` field `atmosphere_pressure_atm` remains the canonical mean surface/reference pressure. The atmosphere model does not introduce a duplicate pressure source or silently normalize habitable worlds to 1 atm.

Derived output also exposes bar and psi for presentation. One Earth atmosphere is approximately 1.01325 bar / 14.696 psi.

## Ra-seeded open-air worlds

The 43 deterministic terrestrial geography worlds are Ra-established biospheres intended for long-term unassisted surface habitation. Their existing pressure, climate, gravity, bulk composition, biosphere, geophysics and `magnetosphere_radiation` metadata constrain atmospheric derivation.

For these worlds the model:

- preserves canonical total atmospheric pressure;
- derives an oxygen fraction that keeps oxygen partial pressure in a conservative long-term human-compatible range rather than requiring a universal 20.95% O2 fraction;
- uses nitrogen as the principal buffer gas unless canon establishes otherwise;
- derives conservative CO2 variation from established greenhouse/cold/dry/humid descriptors while keeping chronic partial pressure compatible with open-air habitation;
- includes modest argon and trace-gas variation;
- treats tropospheric water vapor as variable environmental state rather than pretending it is a fixed dry-atmosphere percentage;
- requires a persistent biologically protective ozone layer;
- requires magnetic protection sufficient for long-term complex surface life.

The result is intentionally varied. A lower-pressure habitable world can have a larger O2 percentage while maintaining a familiar oxygen partial pressure, while a denser atmosphere can use a smaller O2 percentage. Cold greenhouse-supported worlds can carry more CO2 than mild maritime worlds without becoming toxic.

These are life-compatible atmospheres, not effortless Earth clones.

## Ozone and magnetic protection

For the Ra-seeded open-air worlds, ozone and life-protective magnetic shielding are setting premises, not optional random traits.

Ozone is derived from the established oxygenated biosphere plus the requirement for long-term unassisted complex surface life. The model records a qualitative protective profile rather than pretending the repository supports globally precise Dobson-unit measurements.

Magnetic protection is derived from the existing `magnetosphere_radiation` field together with rocky bulk properties, sustained internal heat/interior activity and Ra's established geophysical tuning. The model records a conducting metallic core / sustained dynamo interpretation for these worlds without replacing their existing mass, radius, gravity or geological canon.

## Gravity and atmospheric retention

The registry's existing `radius_re`, `mass_me` and `surface_gravity_g` remain authoritative. The atmosphere pass does not alter them merely to make a planet more Earthlike.

The fact that a world is one of Ra's long-term open-air biospheres constrains the interpretation: its established gravity, atmosphere and geophysical history must be mutually compatible with atmospheric retention over the intended timescale. Any future discovery of a genuine contradiction should be repaired explicitly in the canonical physical data rather than hidden by this derivation layer.

## Nonhabitable natural bodies

Nonhabitable bodies are not forced into the human-compatible model.

- Gas and ice giants receive conservative representative H2/He-dominated bulk compositions derived from their established cloud/volatile descriptions.
- Thin mixed terrestrial atmospheres preserve established respirator/unbreathable classifications.
- CO2/N2 atmospheres remain CO2/N2-dominated.
- Airless bodies remain airless.
- Trace exospheres do **not** receive fake well-mixed percentages. They expose plausible dominant species inferred from bulk composition, ice/volatile inventory and existing atmosphere profile.
- If canon establishes an atmosphere but does not constrain numeric fractions responsibly, the model reports that the composition remains incompletely constrained instead of fabricating precision.

## Provenance

Atmospheric values fall into the project's existing provenance logic:

1. **Established** — pressure, gravity, qualitative atmosphere, bulk composition, climate, magnetosphere and geophysical metadata already present in the registry.
2. **Derived** — oxygen fraction/partial pressure, CO2 envelope, ozone requirement, magnetic-life-protection interpretation, and broad nonhabitable composition where strongly constrained.
3. **Deterministic working canon** — only small unresolved composition variation (for example trace/argon spread) and representative numeric fractions where qualitative canon establishes the chemistry but not exact percentages.

The deterministic component is keyed from stable body identity / geography seed and the versioned atmosphere model. Identical inputs under the same model version must yield identical results.

## Downstream use

Consumers should import `deriveAtmosphereMetadata(row)` from `scripts/atmosphere.mjs` rather than reparsing `atmosphere_profile` ad hoc.

The derived structure is intended to feed:

- weather and humidity/condensation constraints;
- evolutionary/ecological pressure inference;
- megafauna/metabolism plausibility;
- disease/vector ecology;
- human adaptation and settlement design;
- body-view summaries and future environmental-map synchronization.

If the derivation formulas change materially, increment `ATMOSPHERE_MODEL_VERSION` so cached/synchronized downstream products can invalidate cleanly.
