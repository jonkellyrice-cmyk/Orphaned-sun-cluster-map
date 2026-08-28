#!/usr/bin/env python3
from pathlib import Path
from common import complete, require_paths, run
require_paths("scripts/artificial-body-data.mjs","tests/artificial-body-data.test.mjs")
run("node","--test","tests/artificial-body-data.test.mjs")
complete(4,Path(__file__),{"stations":True,"ships":True,"blinkgates":True,"approach_geometry":True})
print("Phase 4 complete: artificial/anomalous body models verified; script removed itself.")
