#!/usr/bin/env python3
import json, subprocess
from pathlib import Path
from common import BASE_SHA, ROOT, complete, require_paths, run
require_paths("data/planet-geography/manifest.json","tests/planetary-acceptance.test.mjs")
manifest=json.loads((ROOT/"data/planet-geography/manifest.json").read_text())
if manifest.get("status")!="accepted-working-canon": raise RuntimeError("planetary geography manifest has not been accepted as working canon")
run("npm","test"); run("node","tools/validate-planet-geography.mjs","--strict","--accepted")
base_csv=subprocess.check_output(["git","show",f"{BASE_SHA}:docs/system-orbital-distances.csv"],cwd=ROOT)
current=(ROOT/"docs/system-orbital-distances.csv").read_bytes()
if base_csv!=current: raise RuntimeError("planetary layer must not mutate canonical upstream CSV")
changed=run("git","diff","--name-only",BASE_SHA,"--",capture=True).splitlines()
allowed_files={"module.json","scripts/cluster-map-app.mjs","scripts/system-view.mjs","templates/cluster-map.hbs","styles/body-map.css"}
allowed_prefixes=("data/planet-geography/","tools/","tests/","scripts/body-","scripts/planet-","scripts/natural-body","scripts/artificial-body","dev_scripts/planetary-body/")
unexpected=[p for p in changed if p not in allowed_files and not p.startswith(allowed_prefixes)]
if unexpected: raise RuntimeError(f"unexpected planetary touch set: {unexpected}")
run("git","diff","--check",BASE_SHA,"--")
complete(8,Path(__file__),{"accepted":True,"tests":"all","canonical_csv_preserved":True,"touch_set_bounded":True})
print("Phase 8 complete: planetary canon accepted and fully validated; script removed itself.")
