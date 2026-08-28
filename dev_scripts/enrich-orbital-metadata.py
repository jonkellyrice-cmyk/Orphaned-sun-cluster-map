#!/usr/bin/env python3
"""One-time migration: enrich the canonical orbital CSV with system-object metadata."""

import csv
from pathlib import Path

TABLE = Path("docs/system-orbital-distances.csv")
META_DIR = Path("dev_scripts/orbital_metadata")
KEY_FIELDS = ("system", "object")

with TABLE.open(encoding="utf-8", newline="") as handle:
    reader = csv.DictReader(handle)
    if not reader.fieldnames:
        raise SystemExit("Canonical orbital table has no header")
    original_fields = list(reader.fieldnames)
    rows = list(reader)

metadata = {}
metadata_fields = []
for path in sorted(META_DIR.glob("*.tsv")):
    with path.open(encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle, delimiter="\t")
        if not reader.fieldnames:
            raise SystemExit(f"Metadata fragment has no header: {path}")
        fragment_fields = [field for field in reader.fieldnames if field not in KEY_FIELDS]
        if not metadata_fields:
            metadata_fields = fragment_fields
        elif fragment_fields != metadata_fields:
            raise SystemExit(f"Metadata schema mismatch in {path}")

        for record in reader:
            key = (record["system"], record["object"])
            if key in metadata:
                raise SystemExit(f"Duplicate metadata key: {key}")
            metadata[key] = record

if not metadata_fields:
    raise SystemExit("No orbital metadata fragments found")

row_keys = {(row["system"], row["object"]) for row in rows}
metadata_keys = set(metadata)
missing = sorted(row_keys - metadata_keys)
extra = sorted(metadata_keys - row_keys)
if missing:
    raise SystemExit(f"Missing metadata for {len(missing)} rows: {missing}")
if extra:
    raise SystemExit(f"Metadata exists for unknown rows: {extra}")

fields = original_fields + [field for field in metadata_fields if field not in original_fields]
for row in rows:
    key = (row["system"], row["object"])
    record = metadata[key]
    for field in metadata_fields:
        row[field] = record.get(field, "")

    surface_parts = [
        row.get("water_pct", ""),
        row.get("land_pct", ""),
        row.get("permanent_ice_pct", ""),
    ]
    if all(value != "" for value in surface_parts):
        try:
            surface_total = sum(float(value) for value in surface_parts)
        except ValueError as exc:
            raise SystemExit(f"Invalid surface percentage for {key}: {surface_parts}") from exc
        if abs(surface_total - 100.0) > 0.01:
            raise SystemExit(
                f"Surface percentages must total 100 for {key}: {surface_parts} = {surface_total}"
            )

with TABLE.open("w", encoding="utf-8", newline="") as handle:
    writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)

print(f"Enriched {len(rows)} canonical system-object rows with {len(metadata_fields)} metadata fields.")
