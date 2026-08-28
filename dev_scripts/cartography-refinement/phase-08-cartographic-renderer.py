#!/usr/bin/env python3
from pathlib import Path
from common import complete, require_paths, run
require_paths("scripts/body-cartography.mjs","tests/body-cartography.test.mjs")
run("node","--check","scripts/body-cartography.mjs"); run("node","--test","tests/body-cartography.test.mjs")
complete(8,Path(__file__),{"smooth_vectors":True,"labels":True,"zoom_lod":True,"mobile_budget":True})
print("Phase 8 complete: refined cartographic renderer verified; script removed itself.")
