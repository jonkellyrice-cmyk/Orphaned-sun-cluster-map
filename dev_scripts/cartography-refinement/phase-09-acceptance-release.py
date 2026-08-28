#!/usr/bin/env python3
import json, subprocess
from pathlib import Path
from common import BASE_SHA, ROOT, complete, require_paths, run
require_paths("tests/cartography-acceptance.test.mjs","data/planet-cartography/manifest.json")
manifest=json.loads((ROOT/"data/planet-cartography/manifest.json").read_text())
if manifest.get("status")!="accepted-working-canon": raise RuntimeError("refined cartography is not accepted")
run("npm","test"); run("node","tools/validate-planet-cartography.mjs","--strict","--accepted")
if subprocess.check_output(["git","show",f"{BASE_SHA}:docs/system-orbital-distances.csv"],cwd=ROOT)!=(ROOT/"docs/system-orbital-distances.csv").read_bytes(): raise RuntimeError("canonical CSV changed")
module=json.loads((ROOT/"module.json").read_text()); package=json.loads((ROOT/"package.json").read_text())
if module["version"]!="0.5.0" or package["version"]!="0.5.0": raise RuntimeError("v0.5.0 release version not set")
run("git","diff","--check",BASE_SHA,"--")
complete(9,Path(__file__),{"accepted":True,"worlds":43,"naming_audited":True,"canonical_csv_preserved":True,"release":"0.5.0"})
print("Phase 9 complete: refined cartography accepted for v0.5.0; script removed itself.")
