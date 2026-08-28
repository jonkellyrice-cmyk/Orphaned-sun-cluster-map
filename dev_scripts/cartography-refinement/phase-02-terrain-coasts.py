#!/usr/bin/env python3
from pathlib import Path
from common import complete, require_paths, run
require_paths("scripts/planet-cartography.mjs","tests/cartography-terrain.test.mjs")
run("node","--test","tests/cartography-terrain.test.mjs")
complete(2,Path(__file__),{"sampling_degrees":2,"smooth_coastlines":True,"closed_land_polygons":True,"seed_stable":True})
print("Phase 2 complete: refined terrain/coast vectors verified; script removed itself.")
