#!/usr/bin/env python3
from pathlib import Path
from common import ROOT, complete, require_paths, run
require_paths("tools/generate-planet-geography.mjs", "scripts/planet-geography.mjs", "tests/planet-geography.test.mjs")
run("node", "--test", "tests/planet-geography.test.mjs")
run("node", "tools/generate-planet-geography.mjs", "--self-test")
complete(1, Path(__file__), {"deterministic": True, "spherical": True, "causal_layers": 9})
print("Phase 1 complete: deterministic geography engine verified; script removed itself.")
