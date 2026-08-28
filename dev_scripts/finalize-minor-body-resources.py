#!/usr/bin/env python3
"""One-shot finalizer for resource metadata on non-habitable planetoids."""

import csv
from pathlib import Path

TABLE = Path("docs/system-orbital-distances.csv")
TARGET = ("Saqqara", "Old Kestrel")

with TABLE.open(encoding="utf-8", newline="") as handle:
    reader = csv.DictReader(handle)
    if not reader.fieldnames:
        raise SystemExit("Canonical table has no header")
    fields = list(reader.fieldnames)
    rows = list(reader)

required = [
    "resource_metadata_basis", "resource_body_tier", "resource_material_class",
    "water_ice_pct_est", "metal_fraction_pct_est", "silicate_fraction_pct_est",
    "volatile_fraction_pct_est", "carbonaceous_fraction_pct_est", "resource_profile",
    "volatile_profile", "strategic_materials", "resource_abundance", "extraction_difficulty",
    "operational_temperature_profile", "radiation_hazard_level", "geological_activity",
    "in_situ_propellant_potential", "resource_value", "current_exploitation",
    "infrastructure_profile", "resource_operations_notes",
]
missing = [f for f in required if f not in fields]
if missing:
    raise SystemExit(f"Resource schema missing: {missing}")

matches = [r for r in rows if (r["system"], r["object"]) == TARGET]
if len(matches) != 1:
    raise SystemExit(f"Expected exactly one Old Kestrel row; found {len(matches)}")
row = matches[0]

values = {
    "resource_metadata_basis": "Working-canon resource estimate constrained by Old Kestrel's established metal-rich composition, airless environment, mapped industrial role and association with Cairnreach; not a literal quantitative measurement from the schematic.",
    "resource_body_tier": "Tier 2 industrialized non-habitable planetoid/resource body",
    "resource_material_class": "metal-rich differentiated rocky planetoid",
    "water_ice_pct_est": "2",
    "metal_fraction_pct_est": "48",
    "silicate_fraction_pct_est": "45",
    "volatile_fraction_pct_est": "2",
    "carbonaceous_fraction_pct_est": "3",
    "resource_profile": "exceptionally rich Fe-Ni-Co ores; platinum-group and siderophile trace metals; titanium/refractory metals; industrial silicates; minor cold-trap volatiles",
    "volatile_profile": "minor water/CO2-bearing cold-trap inventory; local volatile supply is limited relative to metals and bulk rock, so inhabited industry likely supplements it through imports",
    "strategic_materials": "iron, nickel, cobalt, platinum-group metals, titanium/refractory metals, industrial silicates",
    "resource_abundance": "exceptionally metal-rich",
    "extraction_difficulty": "easy-to-moderate — weak gravity and exposed ore simplify excavation/export, while vacuum, dust, debris and industrial traffic require controlled operations",
    "operational_temperature_profile": "deep cold; representative surface environment ~-35 °C with strong sun/shade thermal cycling",
    "radiation_hazard_level": "moderate",
    "geological_activity": "naturally inactive small body; present-day surface geology is dominated by excavation, spoil fields, tunneling and industrial modification",
    "in_situ_propellant_potential": "low-to-moderate locally; metals are abundant but water/volatile feedstock is comparatively scarce",
    "resource_value": "system-critical Accord metallic feedstock and heavy-industrial substrate",
    "current_exploitation": "heavily mined and industrialized",
    "infrastructure_profile": "extensive excavations, mines, refineries, sealed industrial habitats and material-handling infrastructure integrated with Cairnreach and the surrounding Saqqara industrial belt",
    "resource_operations_notes": "Old Kestrel functions less like a pristine asteroid and more like a worked industrial substrate. Weak gravity lowers export energy but makes spoil/debris containment, anchoring and traffic management central operational concerns.",
}
for field, value in values.items():
    row[field] = value

fractions = sum(float(row[f]) for f in [
    "water_ice_pct_est", "metal_fraction_pct_est", "silicate_fraction_pct_est",
    "volatile_fraction_pct_est", "carbonaceous_fraction_pct_est",
])
if abs(fractions - 100.0) > 0.01:
    raise SystemExit(f"Old Kestrel composition fractions do not sum to 100: {fractions}")
if row["shirtsleeve_habitable_pct"] not in {"", "0"}:
    raise SystemExit("Old Kestrel unexpectedly appears naturally shirtsleeve-habitable")

with TABLE.open("w", encoding="utf-8", newline="") as handle:
    writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)

print("Finalized Old Kestrel as Tier 2 industrialized planetoid resource body; validation passed.")
