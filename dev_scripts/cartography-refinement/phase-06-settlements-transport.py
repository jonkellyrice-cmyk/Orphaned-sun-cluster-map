#!/usr/bin/env python3
from pathlib import Path
from common import complete, require_paths, run
require_paths("scripts/cartography-settlements.mjs","tests/cartography-settlements.test.mjs")
run("node","--test","tests/cartography-settlements.test.mjs")
complete(6,Path(__file__),{"named_capitals":True,"city_hierarchy":True,"detailed_surface_routes":True,"sea_lanes":True})
print("Phase 6 complete: settlements/transport verified; script removed itself.")
