#!/usr/bin/env python3
from pathlib import Path
from common import complete, require_paths, run
require_paths("tests/cartography-hydrology.test.mjs")
run("node","--test","tests/cartography-hydrology.test.mjs")
complete(3,Path(__file__),{"elevation_mesh":True,"contours":True,"river_polylines":True,"lakes_wetlands_glaciers":True})
print("Phase 3 complete: refined elevation/hydrology verified; script removed itself.")
