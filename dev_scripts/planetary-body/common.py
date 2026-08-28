from __future__ import annotations
import hashlib, json, subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
STATE = HERE / "state.json"
BASE_SHA = "ad8171d598e60f015d73a75bc1581d1b7a47e742"
BRANCH = "planetary-body-layer"

def run(*args: str, capture: bool = False):
    result = subprocess.run(args, cwd=ROOT, check=True, text=True, capture_output=capture)
    return result.stdout.strip() if capture else ""

def require_paths(*paths: str):
    missing = [path for path in paths if not (ROOT / path).exists()]
    if missing: raise RuntimeError(f"missing required phase deliverables: {missing}")

def load_state(): return json.loads(STATE.read_text(encoding="utf-8"))

def sha256(path: Path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def complete(number: int, script: str, details: dict):
    state = load_state(); expected = list(range(1, number))
    if state.get("completed") != expected:
        raise RuntimeError(f"phase {number} requires completed={expected}; actual={state.get('completed')}")
    state["completed"].append(number); state[f"phase_{number}"] = details
    STATE.write_text(json.dumps(state, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    phase = Path(script).resolve()
    if not phase.exists(): raise RuntimeError(f"phase script missing before receipt: {phase}")
    phase.unlink()
