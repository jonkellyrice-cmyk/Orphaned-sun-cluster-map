#!/usr/bin/env python3
from pathlib import Path
from common import complete, require_paths, run
require_paths("scripts/natural-body-data.mjs","tests/natural-body-data.test.mjs")
run("node","--test","tests/natural-body-data.test.mjs")
complete(3,Path(__file__),{"moons":True,"rocky_icy":True,"giants":True,"resource_overlays":True})
print("Phase 3 complete: natural-body models verified; script removed itself.")
