#!/usr/bin/env python3
from pathlib import Path
from common import complete, require_paths, run
require_paths("scripts/cartography-names.mjs","tests/cartography-names.test.mjs")
run("node","--test","tests/cartography-names.test.mjs")
complete(5,Path(__file__),{"physical_features_named":True,"culture_profiles_enforced":True,"stable_names":True})
print("Phase 5 complete: named physical geography verified; script removed itself.")
