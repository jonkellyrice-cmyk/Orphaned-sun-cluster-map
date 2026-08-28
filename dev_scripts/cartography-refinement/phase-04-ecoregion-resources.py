#!/usr/bin/env python3
from pathlib import Path
from common import complete, require_paths, run
require_paths("scripts/cartography-regions.mjs","tests/cartography-regions.test.mjs")
run("node","--test","tests/cartography-regions.test.mjs")
complete(4,Path(__file__),{"biome_polygons":True,"soil_polygons":True,"resource_polygons":True,"canonical_proportions":True})
print("Phase 4 complete: ecoregion/resource polygons verified; script removed itself.")
