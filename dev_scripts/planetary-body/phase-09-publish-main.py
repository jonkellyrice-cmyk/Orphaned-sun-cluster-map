#!/usr/bin/env python3
import json, shutil
from pathlib import Path
from common import BASE_SHA, BRANCH, HERE, ROOT, load_state, run
cache=HERE/"__pycache__"
if cache.exists(): shutil.rmtree(cache)
if run("git","branch","--show-current",capture=True)!=BRANCH: raise RuntimeError(f"must publish from {BRANCH}")
if run("git","status","--porcelain",capture=True): raise RuntimeError("publication requires a clean phase branch")
if load_state().get("completed")!=list(range(1,9)): raise RuntimeError("phases 1–8 are incomplete")
run("npm","test"); run("git","fetch","origin","main")
if run("git","rev-parse","origin/main",capture=True)!=BASE_SHA: raise RuntimeError("origin/main advanced beyond audited base; rebase and revalidate")
for path in list(HERE.iterdir()):
    if path.is_file(): path.unlink()
    elif path.name=="__pycache__": shutil.rmtree(path)
if HERE.exists() and not any(HERE.iterdir()): HERE.rmdir()
if HERE.parent.exists() and not any(HERE.parent.iterdir()): HERE.parent.rmdir()
run("git","add","--","dev_scripts/planetary-body"); run("git","commit","-m","Remove temporary planetary-body governor")
run("git","switch","main"); run("git","merge","--squash",BRANCH)
staged=run("git","diff","--cached","--name-only",capture=True).splitlines()
if any(p.startswith("dev_scripts/planetary-body/") for p in staged): raise RuntimeError("temporary governor would land on main")
if "docs/system-orbital-distances.csv" in staged: raise RuntimeError("canonical CSV changed")
run("git","diff","--cached","--check"); run("npm","test")
run("git","commit","-m","Add orbital planetary and body views"); run("git","push","origin","main")
print("Phase 9 complete: planetary/body layer pushed to main.")
