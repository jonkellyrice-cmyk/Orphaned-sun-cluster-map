#!/usr/bin/env python3
"""One-shot derivation of orbital, seasonal, and tidal metadata.

The canonical table already contains working-canon masses, radii, orbital radii,
rotation periods, and axial tilts where they were previously established. This
migration preserves those values, fills missing spin/tilt values for natural
bodies where useful, and derives the rest from the adopted physical model.

Eccentricities are not present in the source illustrations, so this script
assigns deliberately conservative, deterministic working-canon values by body
class. Ra-seeded habitable worlds are biased toward dynamically quiet orbits.
"""

from __future__ import annotations

import csv
import hashlib
import math
from pathlib import Path

TABLE = Path("docs/system-orbital-distances.csv")

AU_KM = 149_597_870.7
YEAR_DAYS = 365.25
SOLAR_MASS_KG = 1.98847e30
EARTH_MASS_KG = 5.9722e24
G_KM3_KG_S2 = 6.67430e-20
EARTH_MOON_MASS_ME = 0.012300
EARTH_MOON_DISTANCE_KM = 384_400.0
SOLAR_TIDE_RELATIVE_TO_EARTH_MOON = 0.46
IO_PARENT_MASS_ME = 317.8
IO_RADIUS_RE = 0.286
IO_ECCENTRICITY = 0.0041
IO_ORBIT_KM = 421_700.0

SYSTEM_MASS_SOLAR = {
    "Abydos": 0.78,
    "Tanis": 1.60,  # G8V + K4V total mass for circumbinary motion.
    "Saqqara": 1.05,
    "Iunu": 1.10,
    "Memphis": 0.82,
    "Nekhen": 0.90,
    "Thebes": 1.15,
    "Sais": 0.95,
    "Amarna": 1.00,
    "Seti": 0.80,
}

NEW_FIELDS = [
    "orbital_dynamics_basis",
    "orbital_eccentricity",
    "periapsis_au",
    "apoapsis_au",
    "periapsis_km",
    "apoapsis_km",
    "orbital_period_days",
    "moon_orbital_period_days",
    "mean_orbital_velocity_km_s",
    "peri_to_apo_flux_ratio",
    "seasonality_profile",
    "tidally_locked",
    "moon_count_catalogued",
    "stellar_tide_strength_earth",
    "aggregate_lunar_tide_strength_earth",
    "aggregate_tidal_strength_earth",
    "primary_tide_source",
    "tidal_regime",
    "tide_contribution_on_parent_earth",
    "tidal_heating_index_io_proxy",
    "tidal_heating_profile",
]


def f(value: str | None) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except ValueError:
        return None


def fmt(value: float | None, digits: int = 4) -> str:
    if value is None or not math.isfinite(value):
        return ""
    text = f"{value:.{digits}f}"
    return text.rstrip("0").rstrip(".") if "." in text else text


def stable_fraction(*parts: str) -> float:
    digest = hashlib.sha256("|".join(parts).encode("utf-8")).digest()
    integer = int.from_bytes(digest[:8], "big")
    return integer / float((1 << 64) - 1)


def stable_range(lo: float, hi: float, *parts: str) -> float:
    return lo + (hi - lo) * stable_fraction(*parts)


def lower(row: dict[str, str], field: str) -> str:
    return (row.get(field) or "").lower()


def is_moon(row: dict[str, str]) -> bool:
    return "moon" in lower(row, "type")


def is_star(row: dict[str, str]) -> bool:
    return "star" in lower(row, "type") or row.get("object") in {"Tanis A", "Tanis B"}


def is_region(row: dict[str, str]) -> bool:
    text = " ".join([lower(row, "type"), lower(row, "structure_class"), lower(row, "hz_or_role")])
    return any(token in text for token in ["belt", "field", "range", "region", "thornfield", "barycenter"])


def is_mobile(row: dict[str, str]) -> bool:
    text = " ".join([lower(row, "type"), lower(row, "structure_class"), lower(row, "mobility")])
    return any(token in text for token in ["mobile", "fleet", "carrier group", "major vessel", "independent carrier"])


def is_artificial(row: dict[str, str]) -> bool:
    if row.get("structure_class"):
        return True
    text = lower(row, "type")
    return any(token in text for token in ["station", "yard", "installation", "anchorage", "gate", "complex", "array", "carrier", "fleet", "vessel"])


def is_planetlike(row: dict[str, str]) -> bool:
    if is_star(row) or is_moon(row) or is_artificial(row) or is_region(row):
        return False
    text = lower(row, "type")
    return any(token in text for token in ["planet", "terrestrial", "giant", "world", "dwarf", "jovian"])


def body_eccentricity(row: dict[str, str], parent_row: dict[str, str] | None) -> float | None:
    system = row["system"]
    obj = row["object"]
    if obj in {"Tanis A", "Tanis B"}:
        return 0.025
    if is_moon(row):
        parent_mass = f(parent_row.get("mass_me")) if parent_row else None
        if parent_mass and parent_mass > 10:
            return stable_range(0.003, 0.020, system, obj, "moon-e")
        return stable_range(0.001, 0.014, system, obj, "moon-e")
    if is_artificial(row):
        if is_mobile(row) or is_region(row):
            return None
        return 0.001
    if not is_planetlike(row):
        return None

    descriptor = " ".join([lower(row, "type"), lower(row, "hz_or_role"), lower(row, "notes")])
    if "habitable" in descriptor or (f(row.get("shirtsleeve_habitable_pct")) or 0) > 0:
        return stable_range(0.008, 0.045, system, obj, "hz-e")
    if "hot inner" in descriptor or "inner world" in descriptor:
        return stable_range(0.020, 0.070, system, obj, "inner-e")
    if any(token in descriptor for token in ["giant", "jovian"]):
        return stable_range(0.010, 0.050, system, obj, "giant-e")
    if any(token in descriptor for token in ["dwarf", "outer", "frontier"]):
        return stable_range(0.035, 0.090, system, obj, "outer-e")
    return stable_range(0.010, 0.060, system, obj, "default-e")


def ellipse_mean_speed_km_s(a_km: float, e: float, period_days: float) -> float:
    # Ramanujan ellipse circumference gives a useful orbit-averaged path speed.
    b_km = a_km * math.sqrt(max(0.0, 1.0 - e * e))
    h = ((a_km - b_km) ** 2) / ((a_km + b_km) ** 2) if a_km + b_km else 0.0
    circumference = math.pi * (a_km + b_km) * (1 + (3 * h) / (10 + math.sqrt(max(0.0, 4 - 3 * h))))
    return circumference / (period_days * 86400.0)


def heliocentric_period_days(a_au: float, mass_solar: float) -> float:
    return YEAR_DAYS * math.sqrt((a_au ** 3) / mass_solar)


def local_period_days(distance_km: float, parent_mass_me: float) -> float:
    mu = G_KM3_KG_S2 * parent_mass_me * EARTH_MASS_KG
    period_s = 2 * math.pi * math.sqrt((distance_km ** 3) / mu)
    return period_s / 86400.0


def ensure_spin_and_tilt(row: dict[str, str], period_days: float | None) -> None:
    if is_moon(row):
        if period_days is not None and not row.get("rotation_hours"):
            row["rotation_hours"] = fmt(period_days * 24.0, 2)
        if not row.get("axial_tilt_deg"):
            row["axial_tilt_deg"] = fmt(stable_range(0.2, 4.5, row["system"], row["object"], "moon-tilt"), 1)
        return
    if not is_planetlike(row):
        return
    if not row.get("rotation_hours"):
        text = lower(row, "type")
        if "giant" in text or "jovian" in text:
            row["rotation_hours"] = fmt(stable_range(9.0, 16.5, row["system"], row["object"], "giant-spin"), 1)
        else:
            row["rotation_hours"] = fmt(stable_range(18.0, 38.0, row["system"], row["object"], "planet-spin"), 1)
    if not row.get("axial_tilt_deg"):
        row["axial_tilt_deg"] = fmt(stable_range(4.0, 34.0, row["system"], row["object"], "planet-tilt"), 1)


def seasonality(row: dict[str, str], e: float | None, period_days: float | None, flux_ratio: float | None) -> str:
    if is_moon(row):
        return "Follows the parent world's stellar year; synchronous rotation makes local illumination longitude-dependent, with additional eclipse cycles from the parent."
    if not is_planetlike(row) or e is None:
        return ""
    tilt = f(row.get("axial_tilt_deg"))
    if tilt is None:
        return ""
    if tilt < 5:
        axial = "very weak axial seasons"
    elif tilt < 12:
        axial = "mild axial seasons"
    elif tilt < 28:
        axial = "Earthlike-to-moderate axial seasons"
    elif tilt < 40:
        axial = "strong axial seasons"
    else:
        axial = "extreme axial seasons"

    if e < 0.02:
        orbital = "nearly circular orbit adds little seasonal forcing"
    elif e < 0.05:
        orbital = "modest eccentricity adds a secondary seasonal asymmetry"
    elif e < 0.08:
        orbital = "eccentricity noticeably amplifies and asymmetrizes seasons"
    else:
        orbital = "high eccentricity strongly amplifies orbital seasons"

    year = f"{period_days:.1f}-day year" if period_days else "year length unavailable"
    flux = f"periapsis receives {flux_ratio:.2f}× apoapsis stellar flux" if flux_ratio else ""
    return f"{axial}; {orbital}; {year}; {flux}.".strip()


def tidal_heating_proxy(parent_mass_me: float | None, moon_radius_re: float | None, e: float | None, distance_km: float | None) -> tuple[float | None, str]:
    if not parent_mass_me or not moon_radius_re or e is None or not distance_km or e <= 0:
        return None, ""
    index = (
        (parent_mass_me / IO_PARENT_MASS_ME) ** 2.5
        * (moon_radius_re / IO_RADIUS_RE) ** 5
        * (e / IO_ECCENTRICITY) ** 2
        * (IO_ORBIT_KM / distance_km) ** 7.5
    )
    if index < 0.001:
        profile = "negligible tidal heating (Io-normalized proxy <0.001; composition/Q uncertainty is large)"
    elif index < 0.03:
        profile = "low tidal heating (Io-normalized proxy; unlikely to dominate geology)"
    elif index < 0.3:
        profile = "moderate tidal heating (Io-normalized proxy; may enhance tectonic/cryovolcanic activity)"
    elif index < 3:
        profile = "strong tidal heating (Io-normalized proxy; likely major geological influence)"
    else:
        profile = "extreme tidal heating (Io-normalized proxy; potentially Io-like or stronger depending on interior/Q)"
    return index, profile


def tide_regime(total: float, moon_total: float, star_total: float, moon_count: int, water_pct: float | None, system: str) -> str:
    if total < 0.30:
        strength = "very weak"
    elif total < 0.80:
        strength = "mild"
    elif total < 1.60:
        strength = "Earthlike-to-moderate"
    elif total < 4.00:
        strength = "strong"
    elif total < 10.0:
        strength = "very strong"
    else:
        strength = "extreme"

    if moon_count == 0:
        driver = "stellar-tide dominated; no catalogued major moons"
    elif moon_count == 1:
        driver = "single-moon + stellar tide"
    else:
        driver = f"{moon_count}-moon interference/beat cycles + stellar tide"
    if system == "Tanis":
        driver += "; circumbinary stellar forcing adds a short-period modulation"
    medium = "oceanic tides" if (water_pct or 0) > 0 else "primarily solid-body/atmospheric tides"
    return f"{strength} {medium}; {driver}."


with TABLE.open(encoding="utf-8", newline="") as handle:
    reader = csv.DictReader(handle)
    if not reader.fieldnames:
        raise SystemExit("Canonical table has no header")
    original_fields = list(reader.fieldnames)
    rows = list(reader)

original_count = len(rows)
keys = [(row["system"], row["object"]) for row in rows]
if len(keys) != len(set(keys)):
    raise SystemExit("Duplicate system/object keys exist before derivation")

rows_by_key = {(row["system"], row["object"]): row for row in rows}
for row in rows:
    for field in NEW_FIELDS:
        row.setdefault(field, "")

# First pass: orbital dynamics and moon-specific tidal forcing.
for row in rows:
    system = row["system"]
    obj = row["object"]
    parent_name = row.get("parent") or ""
    parent_row = rows_by_key.get((system, parent_name))
    distance = f(row.get("distance_from_parent"))
    unit = row.get("distance_unit") or ""
    e = body_eccentricity(row, parent_row)
    period_days: float | None = None
    speed_km_s: float | None = None

    if distance == 0:
        row["orbital_dynamics_basis"] = "System reference origin; no orbital period assigned."
        row["orbital_eccentricity"] = "0"
        continue

    if is_mobile(row):
        row["orbital_dynamics_basis"] = "Reference-epoch navigation position only; mobile object has no canonical osculating orbit."
        continue
    if is_region(row):
        row["orbital_dynamics_basis"] = "Distributed region/reference centroid; no single Keplerian orbit assigned."
        continue

    if unit == "AU" and distance is not None:
        if obj in {"Tanis A", "Tanis B"}:
            binary_separation_au = 0.10
            period_days = heliocentric_period_days(binary_separation_au, SYSTEM_MASS_SOLAR["Tanis"])
            if e is None:
                e = 0.025
            speed_km_s = ellipse_mean_speed_km_s(distance * AU_KM, e, period_days)
            row["orbital_dynamics_basis"] = "Calculated from the adopted 0.10 AU binary separation and 1.60 M☉ total mass; eccentricity is working canon."
        else:
            mass_solar = SYSTEM_MASS_SOLAR.get(system)
            if mass_solar is not None and e is not None:
                period_days = heliocentric_period_days(distance, mass_solar)
                speed_km_s = ellipse_mean_speed_km_s(distance * AU_KM, e, period_days)
                if is_artificial(row):
                    row["orbital_dynamics_basis"] = "Controlled near-circular station-keeping orbit derived from adopted radius and system mass."
                else:
                    row["orbital_dynamics_basis"] = "Keplerian values derived from adopted semi-major axis and system mass; eccentricity is a conservative working-canon estimate."

        if e is not None:
            row["orbital_eccentricity"] = fmt(e, 4)
            row["periapsis_au"] = fmt(distance * (1 - e), 4)
            row["apoapsis_au"] = fmt(distance * (1 + e), 4)
            if is_planetlike(row):
                flux_ratio = ((1 + e) / (1 - e)) ** 2
                row["peri_to_apo_flux_ratio"] = fmt(flux_ratio, 3)
            else:
                flux_ratio = None
        else:
            flux_ratio = None

    elif unit == "km" and distance is not None:
        parent_mass_me = f(parent_row.get("mass_me")) if parent_row else None
        if parent_mass_me is not None and parent_mass_me > 0:
            if e is None:
                e = 0.001 if is_artificial(row) else stable_range(0.001, 0.014, system, obj, "local-e")
            period_days = local_period_days(distance, parent_mass_me)
            speed_km_s = ellipse_mean_speed_km_s(distance, e, period_days)
            row["orbital_eccentricity"] = fmt(e, 4)
            row["periapsis_km"] = fmt(distance * (1 - e), 1)
            row["apoapsis_km"] = fmt(distance * (1 + e), 1)
            if is_moon(row):
                row["orbital_dynamics_basis"] = "Satellite orbit derived from adopted parent-relative distance and parent mass; eccentricity is conservative working canon."
            else:
                row["orbital_dynamics_basis"] = "Local controlled orbit derived from parent-relative distance and parent mass."
        else:
            row["orbital_dynamics_basis"] = "Local geometric offset from an artificial parent structure; not treated as a free Keplerian orbit."
        flux_ratio = None
    else:
        flux_ratio = None

    if period_days is not None:
        row["orbital_period_days"] = fmt(period_days, 3)
        row["mean_orbital_velocity_km_s"] = fmt(speed_km_s, 3)
        if is_moon(row):
            row["moon_orbital_period_days"] = fmt(period_days, 3)

    ensure_spin_and_tilt(row, period_days)
    row["seasonality_profile"] = seasonality(row, e, period_days, flux_ratio)

    if is_moon(row):
        row["tidally_locked"] = "yes — synchronous rotation to parent"
        parent_radius_re = f(parent_row.get("radius_re")) if parent_row else None
        moon_mass_me = f(row.get("mass_me"))
        if parent_radius_re and moon_mass_me and distance:
            contribution = (
                (moon_mass_me / EARTH_MOON_MASS_ME)
                * parent_radius_re
                * (EARTH_MOON_DISTANCE_KM / distance) ** 3
            )
            row["tide_contribution_on_parent_earth"] = fmt(contribution, 3)
        parent_mass_me = f(parent_row.get("mass_me")) if parent_row else None
        moon_radius_re = f(row.get("radius_re"))
        heating_index, heating_profile = tidal_heating_proxy(parent_mass_me, moon_radius_re, e, distance)
        row["tidal_heating_index_io_proxy"] = fmt(heating_index, 4)
        row["tidal_heating_profile"] = heating_profile
    elif is_planetlike(row):
        row["tidally_locked"] = "no — free planetary rotation"

# Second pass: aggregate moon and stellar tides on each planet/giant.
children_by_parent: dict[tuple[str, str], list[dict[str, str]]] = {}
for row in rows:
    children_by_parent.setdefault((row["system"], row.get("parent") or ""), []).append(row)

for row in rows:
    if not is_planetlike(row):
        continue
    system = row["system"]
    obj = row["object"]
    a_au = f(row.get("distance_from_parent")) if row.get("distance_unit") == "AU" else None
    radius_re = f(row.get("radius_re"))
    star_tide = 0.0
    if a_au and radius_re:
        star_tide = SOLAR_TIDE_RELATIVE_TO_EARTH_MOON * SYSTEM_MASS_SOLAR[system] * radius_re / (a_au ** 3)

    moons = [child for child in children_by_parent.get((system, obj), []) if is_moon(child)]
    moon_contributions: list[tuple[str, float]] = []
    for moon in moons:
        contribution = f(moon.get("tide_contribution_on_parent_earth"))
        if contribution is not None:
            moon_contributions.append((moon["object"], contribution))
    moon_total = sum(value for _, value in moon_contributions)
    total = star_tide + moon_total

    row["moon_count_catalogued"] = str(len(moons))
    row["stellar_tide_strength_earth"] = fmt(star_tide, 3)
    row["aggregate_lunar_tide_strength_earth"] = fmt(moon_total, 3)
    row["aggregate_tidal_strength_earth"] = fmt(total, 3)

    sources = [(f"{system} stellar field", star_tide)] + moon_contributions
    primary_name, primary_value = max(sources, key=lambda pair: pair[1])
    row["primary_tide_source"] = f"{primary_name} ({primary_value:.2f}× Earth-lunar tide)"
    row["tidal_regime"] = tide_regime(total, moon_total, star_tide, len(moons), f(row.get("water_pct")), system)

# Final validation.
if len(rows) != original_count:
    raise SystemExit(f"Row count changed unexpectedly: {original_count} -> {len(rows)}")

for row in rows:
    key = (row["system"], row["object"])
    if is_moon(row):
        required = [
            "orbital_eccentricity",
            "periapsis_km",
            "apoapsis_km",
            "orbital_period_days",
            "moon_orbital_period_days",
            "mean_orbital_velocity_km_s",
            "tidally_locked",
            "tide_contribution_on_parent_earth",
            "tidal_heating_profile",
        ]
        missing = [field for field in required if not row.get(field)]
        if missing:
            raise SystemExit(f"Moon derivation incomplete for {key}: {missing}")
    if is_planetlike(row) and row.get("distance_unit") == "AU":
        required = [
            "orbital_eccentricity",
            "periapsis_au",
            "apoapsis_au",
            "orbital_period_days",
            "mean_orbital_velocity_km_s",
            "seasonality_profile",
            "moon_count_catalogued",
            "stellar_tide_strength_earth",
            "aggregate_tidal_strength_earth",
            "primary_tide_source",
            "tidal_regime",
        ]
        missing = [field for field in required if not row.get(field)]
        if missing:
            raise SystemExit(f"Planetary derivation incomplete for {key}: {missing}")

fields = original_fields + [field for field in NEW_FIELDS if field not in original_fields]
with TABLE.open("w", encoding="utf-8", newline="") as handle:
    writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)

moon_count = sum(1 for row in rows if is_moon(row))
planet_count = sum(1 for row in rows if is_planetlike(row))
print(
    f"Derived orbital/climate/tidal metadata for {len(rows)} rows: "
    f"{planet_count} planet-like bodies and {moon_count} moons validated."
)
