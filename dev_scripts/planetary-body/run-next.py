#!/usr/bin/env python3
from pathlib import Path
import subprocess, sys
from common import HERE, ROOT, load_state

PHASES = [f"phase-{number:02d}-{slug}.py" for number, slug in [
    (1,"geography-engine"),(2,"materialize-terrestrial-canon"),(3,"natural-body-models"),
    (4,"artificial-body-models"),(5,"body-renderer"),(6,"three-level-navigation"),
    (7,"layers-settlements-routes"),(8,"acceptance-validation"),(9,"publish-main")]]
state = load_state(); next_number = len(state["completed"]) + 1
if next_number > len(PHASES): raise SystemExit("All planetary-body phases are complete.")
phase = HERE / PHASES[next_number - 1]
if not phase.exists(): raise SystemExit(f"Legal next phase script is missing: {phase.name}")
print(f"Running exactly one legal next action: {phase.name}", flush=True)
raise SystemExit(subprocess.run([sys.executable, str(phase)], cwd=ROOT).returncode)
