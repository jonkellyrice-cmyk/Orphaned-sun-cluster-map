#!/usr/bin/env python3
from pathlib import Path
from common import complete, require_paths, run
require_paths("scripts/body-layers.mjs","tests/body-layers.test.mjs")
run("node","--test","tests/body-layers.test.mjs")
complete(7,Path(__file__),{"physical_layers":True,"capital_sites":True,"cities":True,"transport_networks":True,"inspection_ui":True})
print("Phase 7 complete: literal geography/civilization layers verified; script removed itself.")
