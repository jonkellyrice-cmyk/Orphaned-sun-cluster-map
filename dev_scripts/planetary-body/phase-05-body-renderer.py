#!/usr/bin/env python3
from pathlib import Path
from common import complete, require_paths, run
require_paths("scripts/body-view.mjs","styles/body-map.css","tests/body-view.test.mjs")
run("node","--check","scripts/body-view.mjs"); run("node","--test","tests/body-view.test.mjs")
complete(5,Path(__file__),{"svg":True,"orbital_perspective":True,"natural_and_artificial":True,"touch":True})
print("Phase 5 complete: orbital body renderer verified; script removed itself.")
