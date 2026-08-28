#!/usr/bin/env python3
import json
from common import HERE, load_state

PHASES = [
  {"number": 1, "script": "phase-01-geography-engine.py", "name": "Deterministic geography engine", "deliverables": ["seeded spherical plates", "elevation and sea-level fit", "climate/rainfall", "hydrology", "biomes/soils/resources/settlement suitability"], "touch": ["tools/generate-planet-geography.mjs", "scripts/planet-geography.mjs", "tests/planet-geography.test.mjs"]},
  {"number": 2, "script": "phase-02-materialize-terrestrial-canon.py", "name": "Materialize 43 terrestrial worlds", "deliverables": ["one accepted-seed derived JSON per world", "coastlines and terrain regions", "rivers/lakes/wetlands", "biomes/resources/suitability", "manifest with input fingerprints"], "touch": ["data/planet-geography/**", "tools/validate-planet-geography.mjs", "tests/planet-geography-assets.test.mjs"]},
  {"number": 3, "script": "phase-03-natural-body-models.py", "name": "Other natural bodies", "deliverables": ["moons and dwarf/rocky bodies", "gas/ice giants", "craters/ice/extraction regions", "radiation and resource overlays"], "touch": ["scripts/natural-body-data.mjs", "tests/natural-body-data.test.mjs"]},
  {"number": 4, "script": "phase-04-artificial-body-models.py", "name": "Artificial and anomalous bodies", "deliverables": ["stations/shipyards/ships/fleets", "blinkgate and megastructures", "approach/docking geometry", "anomaly presentation contracts"], "touch": ["scripts/artificial-body-data.mjs", "tests/artificial-body-data.test.mjs"]},
  {"number": 5, "script": "phase-05-body-renderer.py", "name": "Orbital body renderer", "deliverables": ["SVG globe/superstructure renderer", "orthographic rotation and zoom", "day/night and atmosphere", "terrain/structure silhouettes", "billboard labels and feature hit targets"], "touch": ["scripts/body-view.mjs", "styles/body-map.css", "tests/body-view.test.mjs"]},
  {"number": 6, "script": "phase-06-three-level-navigation.py", "name": "Cluster → system → body navigation", "deliverables": ["double-click/double-tap entry", "selected-object zoom entry", "outward zoom exit", "explicit breadcrumbs", "gesture-safe deferred selection"], "touch": ["scripts/cluster-map-app.mjs", "scripts/system-view.mjs", "templates/cluster-map.hbs", "tests/body-navigation.test.mjs"]},
  {"number": 7, "script": "phase-07-layers-settlements-routes.py", "name": "Literal geography and civilization layers", "deliverables": ["coastlines/oceans/ice", "rivers/lakes/forests/deserts", "resource provinces", "capital and city sites", "roads/rail/sea corridors", "layer controls and feature inspection"], "touch": ["scripts/body-layers.mjs", "tests/body-layers.test.mjs"]},
  {"number": 8, "script": "phase-08-acceptance-validation.py", "name": "Canon acceptance and full validation", "deliverables": ["determinism and fingerprint audit", "43-world causal audit", "all-body renderer coverage", "mobile/performance budgets", "accepted geography manifest", "canonical CSV preservation"], "touch": ["data/planet-geography/manifest.json", "tests/planetary-acceptance.test.mjs"]},
  {"number": 9, "script": "phase-09-publish-main.py", "name": "Clean publication", "deliverables": ["remove governor", "squash implementation", "exact touch-set audit", "full tests", "push main"], "touch": []},
]

state = load_state(); completed = set(state["completed"])
for phase in PHASES:
    phase["status"] = "completed" if phase["number"] in completed else ("next" if phase["number"] == len(completed) + 1 else "blocked")
    phase["script_present"] = (HERE / phase["script"]).exists()
print(json.dumps({"base_sha": state["base_sha"], "branch": state["branch"], "phases": PHASES}, indent=2))
