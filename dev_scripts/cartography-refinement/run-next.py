#!/usr/bin/env python3
import subprocess, sys
from common import HERE, ROOT, load_state

PHASES = [f"phase-{number:02d}-{slug}.py" for number, slug in [
    (1,"toponymy"),(2,"terrain-coasts"),(3,"hydrology-elevation"),(4,"ecoregion-resources"),
    (5,"named-geography"),(6,"settlements-transport"),(7,"materialize-assets"),
    (8,"cartographic-renderer"),(9,"acceptance-release"),(10,"publish-main")]]
state = load_state(); next_number = len(state["completed"]) + 1
if next_number > len(PHASES): raise SystemExit("All cartography refinement phases are complete.")
phase = HERE / PHASES[next_number - 1]
if not phase.exists(): raise SystemExit(f"Legal next phase script is missing: {phase.name}")
print(f"Running exactly one legal next action: {phase.name}", flush=True)
raise SystemExit(subprocess.run([sys.executable, str(phase)], cwd=ROOT).returncode)
