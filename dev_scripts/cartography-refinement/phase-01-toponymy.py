#!/usr/bin/env python3
from pathlib import Path
from common import complete, require_paths, run
require_paths("scripts/cartography-toponymy.mjs","tests/cartography-toponymy.test.mjs")
run("node","--check","scripts/cartography-toponymy.mjs"); run("node","--test","tests/cartography-toponymy.test.mjs")
complete(1,Path(__file__),{"profiles":["Aurethic","Vostrann","Xuānhari","Vadan","Union cosmopolitan"],"deterministic":True,"collision_audit":True})
print("Phase 1 complete: cultural toponymy verified; script removed itself.")
