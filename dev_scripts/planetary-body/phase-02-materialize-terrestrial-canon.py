#!/usr/bin/env python3
import json
from pathlib import Path
from common import ROOT, complete, require_paths, run
require_paths("data/planet-geography/manifest.json", "tools/validate-planet-geography.mjs", "tests/planet-geography-assets.test.mjs")
manifest=json.loads((ROOT/"data/planet-geography/manifest.json").read_text())
worlds=manifest.get("worlds",[])
if len(worlds)!=43 or len({(w["system"],w["body"]) for w in worlds})!=43: raise RuntimeError("manifest must contain 43 unique terrestrial worlds")
for world in worlds:
    if not (ROOT/world["path"]).exists(): raise RuntimeError(f"missing derived geography: {world['path']}")
run("node", "tools/validate-planet-geography.mjs", "--strict")
run("node", "--test", "tests/planet-geography-assets.test.mjs")
complete(2, Path(__file__), {"terrestrial_worlds":43,"literal_geometry":True,"fingerprinted":True})
print("Phase 2 complete: 43 terrestrial geography assets verified; script removed itself.")
