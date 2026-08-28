#!/usr/bin/env python3
"""One-shot resource/operations enrichment for non-habitable minor and giant bodies.

Scope is intentionally narrow: moons, asteroid/debris belts, dwarf/icy worlds,
and gas/ice/super-Jovian giants. Habitable terrestrial worlds and artificial
structures are not modified beyond receiving blank new-schema columns.

Values are working-canon estimates inferred from the already-established bulk
composition, temperature, parent body, radiation, tidal heating, and system role.
The script preserves every pre-existing field/value and validates row/key integrity.
"""

from __future__ import annotations

import csv
import hashlib
from pathlib import Path

TABLE = Path("docs/system-orbital-distances.csv")
KEY = ("system", "object")

NEW_FIELDS = [
    "resource_metadata_basis",
    "resource_body_tier",
    "resource_material_class",
    "water_ice_pct_est",
    "metal_fraction_pct_est",
    "silicate_fraction_pct_est",
    "volatile_fraction_pct_est",
    "carbonaceous_fraction_pct_est",
    "resource_profile",
    "volatile_profile",
    "strategic_materials",
    "resource_abundance",
    "extraction_difficulty",
    "operational_temperature_profile",
    "radiation_hazard_level",
    "geological_activity",
    "in_situ_propellant_potential",
    "resource_value",
    "current_exploitation",
    "infrastructure_profile",
    "resource_operations_notes",
]


def text(row: dict[str, str], field: str) -> str:
    return (row.get(field) or "").strip()


def lower(row: dict[str, str], field: str) -> str:
    return text(row, field).lower()


def num(row: dict[str, str], field: str) -> float | None:
    raw = text(row, field)
    if not raw:
        return None
    try:
        return float(raw)
    except ValueError:
        return None


def stable_fraction(*parts: str) -> float:
    digest = hashlib.sha256("|".join(parts).encode("utf-8")).digest()
    return int.from_bytes(digest[:8], "big") / float((1 << 64) - 1)


def stable_range(lo: float, hi: float, *parts: str) -> float:
    return lo + (hi - lo) * stable_fraction(*parts)


def fmt(value: float, digits: int = 1) -> str:
    out = f"{value:.{digits}f}"
    return out.rstrip("0").rstrip(".")


def is_moon(row: dict[str, str]) -> bool:
    return "moon" in lower(row, "type")


def is_belt(row: dict[str, str]) -> bool:
    typ = lower(row, "type")
    return "belt" in typ or "debris" in typ


def is_dwarf(row: dict[str, str]) -> bool:
    return "dwarf" in lower(row, "type")


def is_giant(row: dict[str, str]) -> bool:
    typ = lower(row, "type")
    return any(token in typ for token in ["gas giant", "ice/gas giant", "ice giant", "jovian"])


def target(row: dict[str, str]) -> bool:
    return is_moon(row) or is_belt(row) or is_dwarf(row) or is_giant(row)


def radiation_level(row: dict[str, str]) -> str:
    source = " ".join([lower(row, "magnetosphere_radiation"), lower(row, "resources_hazards"), lower(row, "tidal_heating_profile")])
    if any(x in source for x in ["extreme", "hazardous radiation", "persistent auroral"]):
        return "extreme"
    if any(x in source for x in ["elevated radiation", "strong magnetosphere", "radiation belts", "high surface radiation"]):
        return "high"
    if any(x in source for x in ["moderate radiation", "moderate"]):
        return "moderate"
    return "low-to-moderate"


def temperature_profile(row: dict[str, str]) -> str:
    raw = text(row, "mean_surface_temp_c")
    if raw:
        if " to " in raw:
            return f"surface/environment roughly {raw} °C; large sun/shade and latitude variation likely"
        try:
            t = float(raw)
        except ValueError:
            return raw
        if t <= -150:
            label = "cryogenic"
        elif t <= -80:
            label = "extreme cold"
        elif t <= -30:
            label = "deep cold"
        elif t <= 20:
            label = "cold-to-temperate"
        else:
            label = "warm/hot"
        return f"{label}; representative environment ~{fmt(t)} °C"
    if is_belt(row):
        return "vacuum thermal environment varies strongly with heliocentric distance, rotation and sun exposure"
    if is_giant(row):
        return "upper-atmosphere temperature varies strongly by pressure level, latitude and storm system"
    return "vacuum environment; strong day/night thermal contrast expected"


def moon_inventory(row: dict[str, str]) -> dict[str, str]:
    system, obj = row["system"], row["object"]
    comp = lower(row, "bulk_composition")
    temp = num(row, "mean_surface_temp_c")
    heating = lower(row, "tidal_heating_profile")

    if "ice" in comp or (temp is not None and temp < -70):
        water = stable_range(14, 38, system, obj, "water")
        vol = stable_range(3, 11, system, obj, "vol")
        metal = stable_range(10, 24, system, obj, "metal")
    else:
        water = stable_range(3, 16, system, obj, "water")
        vol = stable_range(1, 6, system, obj, "vol")
        metal = stable_range(16, 32, system, obj, "metal")

    carbon = stable_range(1, 7, system, obj, "carbon")
    silicate = max(20.0, 100.0 - water - vol - metal - carbon)

    # Normalize to exactly 100 while keeping metal/water/volatiles as the useful estimates.
    total = water + vol + metal + carbon + silicate
    scale = 100.0 / total
    water, vol, metal, carbon, silicate = [v * scale for v in [water, vol, metal, carbon, silicate]]

    materials = ["Fe-Ni-Co ores", "silicates", "construction feedstock"]
    if metal >= 20:
        materials.append("platinum-group/trace siderophile metals")
    if water >= 10:
        materials.append("water ice")
    if vol >= 5:
        materials.append("ammonia/CO2-bearing volatiles")

    volatile_profile = "water ice"
    if vol >= 5:
        volatile_profile += "; likely CO2, ammonia and minor carbon-bearing ices in cold traps/regolith"
    else:
        volatile_profile += "; minor CO2/carbon-bearing cold-trap volatiles"

    heat = "geologically quiet/crater-dominated"
    if "extreme tidal heating" in heating:
        heat = "extreme tidally driven volcanism/tectonism"
    elif "strong tidal heating" in heating:
        heat = "strong tidally enhanced tectonic/cryovolcanic activity"
    elif "moderate tidal heating" in heating:
        heat = "moderate tidally enhanced tectonic/cryovolcanic activity"
    elif "low tidal heating" in heating:
        heat = "mostly quiet with localized tidal/geothermal activity"

    rad = radiation_level(row)
    if rad == "extreme":
        difficulty = "extreme — radiation shielding, remote operation and short exposure windows required"
    elif rad == "high":
        difficulty = "difficult — radiation shielding plus low-gravity anchoring and vacuum operations"
    else:
        difficulty = "moderate — vacuum/thermal cycling and very-low-gravity anchoring dominate"

    abundance_score = water + metal
    abundance = "rich" if abundance_score >= 45 else "moderate-to-rich" if abundance_score >= 32 else "moderate"
    value = "strategic" if water >= 20 or metal >= 25 else "significant"

    return {
        "resource_body_tier": "Tier 2 significant non-habitable moon",
        "resource_material_class": "mixed rocky/icy satellite" if water >= 12 else "rocky satellite with localized volatile inventory",
        "water_ice_pct_est": fmt(water),
        "metal_fraction_pct_est": fmt(metal),
        "silicate_fraction_pct_est": fmt(silicate),
        "volatile_fraction_pct_est": fmt(vol),
        "carbonaceous_fraction_pct_est": fmt(carbon),
        "resource_profile": "; ".join(materials),
        "volatile_profile": volatile_profile,
        "strategic_materials": ", ".join(materials),
        "resource_abundance": abundance,
        "extraction_difficulty": difficulty,
        "radiation_hazard_level": rad,
        "geological_activity": heat,
        "in_situ_propellant_potential": "high" if water >= 15 else "moderate",
        "resource_value": value,
        "current_exploitation": "no map-established large-scale mines; likely prospected with automated/local extraction where economically useful",
        "infrastructure_profile": "no dedicated extraction infrastructure established by source map; small sealed depots, prospectors or automated mines are plausible",
        "resource_operations_notes": "Very low gravity reduces launch energy but complicates anchoring, excavation and debris control; synchronous rotation and eclipses affect solar-power planning.",
    }


def belt_inventory(row: dict[str, str]) -> dict[str, str]:
    system, obj = row["system"], row["object"]
    industrial = "industrial" in lower(row, "type") or "industrial" in lower(row, "hz_or_role")
    debris = "debris" in lower(row, "type")

    if industrial:
        metal = stable_range(38, 52, system, obj, "metal")
        silicate = stable_range(27, 38, system, obj, "silicate")
        water = stable_range(4, 10, system, obj, "water")
        carbon = stable_range(5, 12, system, obj, "carbon")
    else:
        metal = stable_range(28, 44, system, obj, "metal")
        silicate = stable_range(30, 43, system, obj, "silicate")
        water = stable_range(6, 15, system, obj, "water")
        carbon = stable_range(8, 18, system, obj, "carbon")
    vol = max(2.0, 100.0 - metal - silicate - water - carbon)
    total = metal + silicate + water + carbon + vol
    scale = 100.0 / total
    metal, silicate, water, carbon, vol = [v * scale for v in [metal, silicate, water, carbon, vol]]

    salvage = "; extensive refined-alloy/salvage fraction from processed debris" if debris else ""
    exploitation = "heavily exploited industrial mining/refining corridor" if industrial else "actively worked for mining, salvage and volatile recovery"

    return {
        "resource_body_tier": "Tier 3 distributed belt/resource field",
        "resource_material_class": "mixed nickel-iron, silicate and carbonaceous small bodies" + (" with anthropogenic debris" if debris else ""),
        "water_ice_pct_est": fmt(water),
        "metal_fraction_pct_est": fmt(metal),
        "silicate_fraction_pct_est": fmt(silicate),
        "volatile_fraction_pct_est": fmt(vol),
        "carbonaceous_fraction_pct_est": fmt(carbon),
        "resource_profile": f"Fe-Ni-Co, silicates, carbonaceous feedstock, water-bearing bodies, platinum-group trace metals{salvage}",
        "volatile_profile": "water-bearing minerals/ice pockets; CO2, ammonia and carbon-bearing volatiles concentrated in colder/carbonaceous bodies",
        "strategic_materials": "nickel, iron, cobalt, platinum-group metals, water, carbon, industrial silicates",
        "resource_abundance": "rich" if industrial else "moderate-to-rich",
        "extraction_difficulty": "easy-to-moderate per body; operational difficulty comes from dispersion, traffic, debris and claim control",
        "radiation_hazard_level": "low-to-moderate",
        "geological_activity": "inactive small bodies; collision, spin and rubble-pile mechanics dominate",
        "in_situ_propellant_potential": "moderate-to-high",
        "resource_value": "system-critical industrial resource base" if industrial else "strategic regional resource/salvage field",
        "current_exploitation": exploitation,
        "infrastructure_profile": "distributed mines, processors, refineries, depots, tugs and traffic-control nodes are expected; density varies across the belt",
        "resource_operations_notes": "Resource grade is highly heterogeneous body-to-body; navigation and collision control matter more than surface gravity.",
    }


def dwarf_inventory(row: dict[str, str]) -> dict[str, str]:
    system, obj = row["system"], row["object"]
    water = stable_range(48, 68, system, obj, "water")
    silicate = stable_range(20, 32, system, obj, "silicate")
    metal = stable_range(6, 14, system, obj, "metal")
    carbon = stable_range(2, 7, system, obj, "carbon")
    vol = max(4.0, 100.0 - water - silicate - metal - carbon)
    total = water + silicate + metal + carbon + vol
    scale = 100.0 / total
    water, silicate, metal, carbon, vol = [v * scale for v in [water, silicate, metal, carbon, vol]]

    return {
        "resource_body_tier": "Tier 2 outer-system dwarf/resource world",
        "resource_material_class": "ice-rich differentiated dwarf body",
        "water_ice_pct_est": fmt(water),
        "metal_fraction_pct_est": fmt(metal),
        "silicate_fraction_pct_est": fmt(silicate),
        "volatile_fraction_pct_est": fmt(vol),
        "carbonaceous_fraction_pct_est": fmt(carbon),
        "resource_profile": "large water-ice reserve; silicates; ammonia-bearing volatiles; carbonaceous compounds; modest Fe-Ni metal fraction",
        "volatile_profile": "water ice dominant with ammonia, CO2, methane/organics and other cryogenic volatiles likely",
        "strategic_materials": "water, hydrogen/oxygen feedstock, ammonia/nitrogen compounds, carbon compounds, construction silicates",
        "resource_abundance": "exceptional volatiles; moderate rock/metal",
        "extraction_difficulty": "moderate — weak gravity helps export but cryogenic temperatures, remoteness and brittle ice/regolith complicate operations",
        "radiation_hazard_level": radiation_level(row),
        "geological_activity": "mostly geologically quiet; localized cryovolcanic or differentiation remnants possible",
        "in_situ_propellant_potential": "exceptional",
        "resource_value": "strategic outer-system volatile reserve",
        "current_exploitation": "frontier/prospected; no map-established heavy industry",
        "infrastructure_profile": "likely sparse automated prospecting, extraction and depot infrastructure rather than dense permanent settlement",
        "resource_operations_notes": "Best suited to bulk volatile extraction, propellant manufacture and remote-system logistics rather than high-grade metallic mining.",
    }


def giant_inventory(row: dict[str, str]) -> dict[str, str]:
    system, obj = row["system"], row["object"]
    typ = lower(row, "type")
    comp = lower(row, "bulk_composition")
    is_ice = "ice" in typ or "ice" in comp
    is_kalong = obj == "Kalong"

    if is_ice:
        material = "H/He envelope over water-ammonia-methane-rich deep interior"
        volatile = "hydrogen, helium, methane, ammonia, water-bearing deep layers; deuterium and helium-3 in trace extractable fractions"
        strategic = "hydrogen, deuterium, helium-3, methane, ammonia"
    else:
        material = "hydrogen/helium atmospheric reservoir"
        volatile = "hydrogen and helium dominant; methane/ammonia/water species vary by cloud depth; deuterium and helium-3 present in trace fractions"
        strategic = "hydrogen, deuterium, helium-3, methane/ammonia feedstocks"

    if is_kalong:
        volatile += "; unusually elevated heavy-element aerosols and luminous subcloud chemistry"
        strategic += ", heavy-element aerosol concentrates and anomalous atmospheric compounds"

    rad = radiation_level(row)
    difficulty = "extreme — no solid surface; deep gravity well, severe winds/pressure gradients and intense radiation require robotic atmospheric skimming"
    if rad != "extreme":
        difficulty = "difficult-to-extreme — no solid surface; deep gravity well, storms and radiation favor robotic atmospheric skimming"

    return {
        "resource_body_tier": "Tier 2 giant-planet atmospheric resource reservoir",
        "resource_material_class": material,
        "water_ice_pct_est": "",
        "metal_fraction_pct_est": "",
        "silicate_fraction_pct_est": "",
        "volatile_fraction_pct_est": "",
        "carbonaceous_fraction_pct_est": "",
        "resource_profile": volatile,
        "volatile_profile": volatile,
        "strategic_materials": strategic,
        "resource_abundance": "effectively inexhaustible on human industrial scales for bulk atmospheric species",
        "extraction_difficulty": difficulty,
        "radiation_hazard_level": rad,
        "geological_activity": "deep atmospheric convection and storm dynamics; no accessible solid geology",
        "in_situ_propellant_potential": "exceptional but technically difficult to harvest",
        "resource_value": "strategic" if not is_kalong else "strategic/anomalous research priority",
        "current_exploitation": "no map-established large-scale skimming industry; extraction is technically plausible where economics justify it",
        "infrastructure_profile": "orbital skimmers, scoop craft, tankers and high-orbit processing stations would be required; none are assumed unless mapped",
        "resource_operations_notes": "Resource abundance is not the limiting factor; gravity, radiation, weather, pressure depth and transport energy dominate economics."
        + (" Kalong's anomalous chemistry should be treated as a research and strategic-material opportunity as well as a hazard." if is_kalong else ""),
    }


SPECIAL_OVERRIDES: dict[tuple[str, str], dict[str, str]] = {
    ("Abydos", "Enoch"): {
        "resource_value": "strategic volatile/mineral moon",
        "current_exploitation": "strong candidate for automated extraction; no map-established major mine",
        "resource_operations_notes": "Tribune's radiation environment and strong tidal heating make Enoch unusually geologically active for a small moon; fresh fractures may expose ice and mineralized material but raise operational risk.",
    },
    ("Abydos", "Ventus"): {
        "resource_value": "strategic Eventide outer-system water/ammonia reserve",
    },
    ("Tanis", "Outer Debris Belt"): {
        "current_exploitation": "actively mined and salvaged as part of Tanis's outer industrial economy",
        "resource_value": "system-critical Accord mining/salvage corridor",
    },
    ("Saqqara", "Industrial Belt"): {
        "current_exploitation": "heavily industrialized, with extraction feeding Hammerfall Yards, the Long Hook and associated shipbuilding",
        "resource_value": "system-critical Accord naval-industrial feedstock zone",
    },
    ("Seti", "Kalong"): {
        "radiation_hazard_level": "extreme",
        "resource_abundance": "exceptional bulk atmosphere plus unusual heavy-element/aerosol chemistry",
    },
}


with TABLE.open(encoding="utf-8", newline="") as handle:
    reader = csv.DictReader(handle)
    if not reader.fieldnames:
        raise SystemExit("Canonical table has no header")
    original_fields = list(reader.fieldnames)
    rows = list(reader)

original_count = len(rows)
original_snapshot = [{field: row.get(field, "") for field in original_fields} for row in rows]
keys = [(row["system"], row["object"]) for row in rows]
if len(keys) != len(set(keys)):
    raise SystemExit("Duplicate system/object keys exist before resource enrichment")

for row in rows:
    for field in NEW_FIELDS:
        row.setdefault(field, "")
    if not target(row):
        continue

    if is_belt(row):
        derived = belt_inventory(row)
    elif is_dwarf(row):
        derived = dwarf_inventory(row)
    elif is_giant(row):
        derived = giant_inventory(row)
    else:
        derived = moon_inventory(row)

    row["resource_metadata_basis"] = (
        "Working-canon resource estimate derived from existing bulk composition, thermal/radiation environment, "
        "orbital context, tidal metadata and mapped system role; not a direct literal measurement from the schematic."
    )
    row["operational_temperature_profile"] = temperature_profile(row)
    for field, value in derived.items():
        row[field] = value
    for field, value in SPECIAL_OVERRIDES.get((row["system"], row["object"]), {}).items():
        row[field] = value

# Integrity checks: old data untouched, new data complete for target rows, blank for others.
if len(rows) != original_count:
    raise SystemExit("Row count changed during resource enrichment")
if [(r["system"], r["object"]) for r in rows] != keys:
    raise SystemExit("Row order or keys changed during resource enrichment")
for before, after in zip(original_snapshot, rows):
    for field in original_fields:
        if before[field] != after.get(field, ""):
            raise SystemExit(f"Pre-existing field changed for {(after['system'], after['object'])}: {field}")

target_rows = [row for row in rows if target(row)]
if not target_rows:
    raise SystemExit("No target natural bodies were found")
for row in target_rows:
    required = [
        "resource_metadata_basis", "resource_body_tier", "resource_material_class", "resource_profile",
        "strategic_materials", "resource_abundance", "extraction_difficulty", "radiation_hazard_level",
        "geological_activity", "in_situ_propellant_potential", "resource_value", "current_exploitation",
        "infrastructure_profile", "resource_operations_notes",
    ]
    missing = [field for field in required if not row.get(field)]
    if missing:
        raise SystemExit(f"Missing resource metadata for {(row['system'], row['object'])}: {missing}")
    if (is_moon(row) or is_belt(row) or is_dwarf(row)):
        fractions = [row.get(f, "") for f in [
            "water_ice_pct_est", "metal_fraction_pct_est", "silicate_fraction_pct_est",
            "volatile_fraction_pct_est", "carbonaceous_fraction_pct_est",
        ]]
        if not all(fractions):
            raise SystemExit(f"Missing composition fractions for {(row['system'], row['object'])}")
        total = sum(float(v) for v in fractions)
        if abs(total - 100.0) > 0.6:  # rounding tolerance
            raise SystemExit(f"Composition fractions do not sum to ~100 for {(row['system'], row['object'])}: {total}")

fields = original_fields + [field for field in NEW_FIELDS if field not in original_fields]
with TABLE.open("w", encoding="utf-8", newline="") as handle:
    writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)

moon_count = sum(1 for r in target_rows if is_moon(r))
belt_count = sum(1 for r in target_rows if is_belt(r))
dwarf_count = sum(1 for r in target_rows if is_dwarf(r))
giant_count = sum(1 for r in target_rows if is_giant(r))
print(
    f"Enriched {len(target_rows)} non-habitable natural resource entries: "
    f"{moon_count} moons, {belt_count} belts/debris fields, {dwarf_count} dwarf worlds, {giant_count} giant planets."
)
