#!/usr/bin/env python3
from pathlib import Path
from common import complete, require_paths, run
require_paths("tests/body-navigation.test.mjs")
run("node","--test","tests/body-navigation.test.mjs")
complete(6,Path(__file__),{"modes":["cluster","system","body"],"double_activation":True,"zoom_transitions":True,"breadcrumbs":True})
print("Phase 6 complete: three-level navigation verified; script removed itself.")
