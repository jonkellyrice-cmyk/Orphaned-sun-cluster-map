#!/usr/bin/env python3
"""Correct and validate radiation-sensitive resource metadata after enrichment.

This is the second pass of the one-shot minor-body resource migration. The first
pass populated the resource schema. This pass deliberately derives radiation
hazard ONLY from radiation/magnetosphere evidence, so generic phrases such as
"thermal extremes" cannot be misread as extreme radiation.
"""

import csv
from pathlib import Path

TABLE = Path("docs/system-orbital-distances.csv")


def low(row, field):
    return (row.get(field) or "").lower()


def is_moon(row):
    return "moon" in low(row, "type")


def is_belt(row):
    typ = low(row, "type")
    return "belt" in typ or "debris" in typ


def is_dwarf(row):
    return "dwarf" in low(row, "type")


def is_giant(row):
    typ = low(row, "type")
    return any(token in typ for token in ["gas giant", "ice/gas giant", "ice giant", "jovian"])


def target(row):
    return is_moon(row) or is_belt(row) or is_dwarf(row) or is_giant(row)


def radiation_level(row):
    rad = low(row, "magnetosphere_radiation")
    hazards = low(row, "resources_hazards")
    radiation_hazards = hazards if "radiation" in hazards or "auroral" in hazards else ""
    source = f"{rad} {radiation_hazards}"

    if "extreme magnetosphere" in source or "persistent auroral discharge" in source:
        return "extreme"
    if any(token in source for token in [
        "hazardous radiation", "elevated radiation", "moderate-high radiation",
        "major radiation environment", "radiation belts", "high surface radiation",
    ]):
        return "high"
    if any(token in source for token in [
        "low-to-moderate radiation", "moderate radiation", "strong but asymmetric magnetosphere",
    ]):
        return "moderate"
    if "radiation environment depends on parent planet" in source:
        return "low-to-moderate"
    if "weak" in source:
        return "low"
    return "low-to-moderate"


with TABLE.open(encoding="utf-8", newline="") as handle:
    reader = csv.DictReader(handle)
    if not reader.fieldnames:
        raise SystemExit("Canonical table has no header")
    fields = list(reader.fieldnames)
    rows = list(reader)

required_columns = {
    "resource_metadata_basis", "radiation_hazard_level", "extraction_difficulty",
    "resource_profile", "resource_body_tier",
}
missing_columns = sorted(required_columns - set(fields))
if missing_columns:
    raise SystemExit(f"Resource enrichment has not been applied: missing {missing_columns}")

keys = [(r["system"], r["object"]) for r in rows]
if len(keys) != len(set(keys)):
    raise SystemExit("Duplicate system/object keys found")

changed = 0
for row in rows:
    if not target(row):
        continue
    if not row.get("resource_metadata_basis"):
        raise SystemExit(f"Target row lacks resource enrichment: {(row['system'], row['object'])}")

    new_rad = radiation_level(row)
    if row.get("radiation_hazard_level") != new_rad:
        row["radiation_hazard_level"] = new_rad
        changed += 1

    if is_moon(row):
        if new_rad == "extreme":
            difficulty = "extreme — intense radiation requires heavy shielding, remote operation and short exposure windows; low-gravity anchoring and vacuum operations add complexity"
        elif new_rad == "high":
            difficulty = "difficult — radiation shielding plus low-gravity anchoring and vacuum operations"
        else:
            difficulty = "moderate — vacuum/thermal cycling and very-low-gravity anchoring dominate; radiation is manageable with ordinary space-industrial shielding"
        row["extraction_difficulty"] = difficulty
    elif is_giant(row):
        if new_rad == "extreme":
            row["extraction_difficulty"] = "extreme — no solid surface; deep gravity well, severe winds/pressure gradients and intense radiation require robotic atmospheric skimming"
        else:
            row["extraction_difficulty"] = "difficult-to-extreme — no solid surface; deep gravity well, storms and radiation favor robotic atmospheric skimming"

# Semantic guardrails for known cases.
by_key = {(r["system"], r["object"]): r for r in rows}
expected = {
    ("Abydos", "Enoch"): "high",
    ("Saqqara", "Eilean Volna"): "high",
    ("Seti", "Kalong"): "extreme",
    ("Tanis", "Dun Varya"): "moderate",
}
for key, value in expected.items():
    actual = by_key[key]["radiation_hazard_level"]
    if actual != value:
        raise SystemExit(f"Radiation semantic check failed for {key}: expected {value}, got {actual}")

ordinary_parent_dependent = [
    r for r in rows
    if is_moon(r) and "radiation environment depends on parent planet" in low(r, "magnetosphere_radiation")
]
if any(r["radiation_hazard_level"] == "extreme" for r in ordinary_parent_dependent):
    raise SystemExit("Ordinary parent-dependent moon was incorrectly classified as extreme radiation")

with TABLE.open("w", encoding="utf-8", newline="") as handle:
    writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)

print(f"Corrected radiation/resource operations metadata for {changed} target rows; semantic checks passed.")
