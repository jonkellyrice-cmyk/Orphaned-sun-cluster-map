#!/usr/bin/env python3
import json
from pathlib import Path
from common import ROOT, complete, require_paths, run
require_paths("data/planet-cartography/manifest.json","tools/generate-planet-cartography.mjs","tools/validate-planet-cartography.mjs","tests/cartography-assets.test.mjs")
manifest=json.loads((ROOT/"data/planet-cartography/manifest.json").read_text())
if len(manifest.get("worlds",[]))!=43: raise RuntimeError("refined manifest must contain 43 worlds")
run("node","tools/validate-planet-cartography.mjs","--strict"); run("node","--test","tests/cartography-assets.test.mjs")
complete(7,Path(__file__),{"worlds":43,"vector_assets":True,"fingerprinted":True,"coarse_canon_preserved":True})
print("Phase 7 complete: 43 refined assets verified; script removed itself.")
