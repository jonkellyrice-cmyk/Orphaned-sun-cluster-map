#!/usr/bin/env python3
import json
from common import HERE, load_state

PHASES = [
  (1,"toponymy","Deterministic cultural toponymy",["system-to-language ownership","feature-class vocabularies","collision-free permanent proper names"]),
  (2,"terrain-coasts","High-resolution terrain and coast vectors",["2-degree deterministic terrain sampling","smoothed closed coastlines","islands and continental polygons"]),
  (3,"hydrology-elevation","Elevation mesh and hydrology",["terrain mesh/contours","river polylines from headwater to mouth","lake/wetland/glacier geometry"]),
  (4,"ecoregion-resources","Ecoregion and resource polygons",["forest/jungle/desert/ice polygons","soil provinces","resource and agricultural regions"]),
  (5,"named-geography","Named physical geography",["oceans/seas","continents/island chains","mountains/ranges","rivers/lakes/landmarks"]),
  (6,"settlements-transport","Cities and detailed transport",["named capitals/cities/ports","roads/rail routes","sea lanes and chokepoints","population corridors"]),
  (7,"materialize-assets","Materialize 43 refined worlds",["one compact vector asset per world","input and output fingerprints","coarse-canon compatibility manifest"]),
  (8,"cartographic-renderer","Renderer and level of detail",["smooth paths and polygons","upright labels","zoom-dependent detail","mobile feature budgets"]),
  (9,"acceptance-release","Canon and v0.5.0 acceptance",["43-world determinism audit","cultural naming audit","canonical CSV preservation","archive and performance validation"]),
  (10,"publish-main","Clean publication",["remove governor","squash implementation","full tests","release v0.5.0 to main"]),
]
state=load_state(); done=set(state["completed"])
print(json.dumps({"base_sha":state["base_sha"],"branch":state["branch"],"target_release":state["target_release"],"phases":[{"number":n,"name":name,"deliverables":items,"status":"completed" if n in done else "next" if n==len(done)+1 else "blocked","script_present":(HERE/f"phase-{n:02d}-{slug}.py").exists()} for n,slug,name,items in PHASES]},indent=2))
