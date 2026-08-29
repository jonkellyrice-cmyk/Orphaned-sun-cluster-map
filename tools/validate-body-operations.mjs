#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "../scripts/system-data.mjs";
import { bodyOperationAssetPath, deriveBodyOperationTargets, validateBodyOperationsAsset, targetKey, bodyOperationsFeatureBudget } from "../scripts/body-operations.mjs";
import { generateBodyOperationAsset, serializeAsset } from "./generate-body-operations.mjs";
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const readJson=(p)=>JSON.parse(readFileSync(resolve(ROOT,p),"utf8"));
const rows=parseCsv(readFileSync(resolve(ROOT,"docs/system-orbital-distances.csv"),"utf8")), cart=readJson("data/planet-cartography/manifest.json"), manifest=readJson("data/body-operations/manifest.json");
const targets=deriveBodyOperationTargets(rows,cart), expected=new Set(targets.map(({row})=>targetKey(row.system,row.object))), actual=new Set(manifest.assets.map(a=>targetKey(a.system,a.body)));
if(rows.length!==126) throw new Error(`Canonical registry count changed: ${rows.length}`);
if(targets.length!==71) throw new Error(`Expected 71 eligible body-operation targets after canonical audit, found ${targets.length}`);
if(expected.size!==actual.size||[...expected].some(key=>!actual.has(key))) throw new Error("Manifest target coverage mismatch");
const cartKeys=new Set(cart.worlds.map(w=>targetKey(w.system,w.body)));
for(const {row,operationalKind} of targets){
  if(cartKeys.has(targetKey(row.system,row.object))) throw new Error(`Inhabited cartography duplicated: ${row.system}/${row.object}`);
  const p=bodyOperationAssetPath(row.system,row.object), asset=readJson(p), errors=validateBodyOperationsAsset(asset); if(errors.length) throw new Error(`${p}: ${errors.join(", ")}`);
  if(asset.canonicalType!==row.type) throw new Error(`${p}: canonical type mismatch`);
  if(asset.operationalKind!==operationalKind) throw new Error(`${p}: operational kind mismatch`);
  if(readFileSync(resolve(ROOT,p),"utf8")!==serializeAsset(generateBodyOperationAsset(row))) throw new Error(`${p}: exact regeneration mismatch`);
  if(bodyOperationsFeatureBudget(asset,3,true)>64) throw new Error(`${p}: mobile feature budget exceeded`);
  if(asset.operationalKind==="giant"&&asset.features.some(f=>f.layer==="routes"||/surface route/i.test(f.operationalRole))) throw new Error(`${p}: gas giant has solid-surface route`);
  if(asset.body==="Thornfield"&&asset.features.some(f=>f.type==="dock")) throw new Error("Thornfield must remain non-dockable");
}
for(const special of ["Eilean Volna","Old Kestrel","Akhetan","Thornfield","Arrowfall Range","Kalong"]){ if(!manifest.assets.some(a=>a.body===special)) throw new Error(`Missing special target ${special}`); }
const eilean=readJson(manifest.assets.find(a=>a.body==="Eilean Volna").path); if(!eilean.features.some(f=>f.name==="Volna Thaw Enclave")||eilean.features.some(f=>/forest|highway|ocean city/i.test(`${f.name} ${f.description}`))) throw new Error("Eilean Volna marginality contract failed");
const kestrel=readJson(manifest.assets.find(a=>a.body==="Old Kestrel").path); if(!kestrel.features.some(f=>f.name==="Black Kestrel Cut")) throw new Error("Old Kestrel industrial contract failed");
const akhetan=readJson(manifest.assets.find(a=>a.body==="Akhetan").path); if(akhetan.features.filter(f=>f.lodPriority===1).length<8||!akhetan.features.some(f=>f.type==="aperture")) throw new Error("Akhetan operational contract too weak");
const thorn=readJson(manifest.assets.find(a=>a.body==="Thornfield").path); if(thorn.coordinateFrame.geometryKind!=="uncertain observation volume") throw new Error("Thornfield uncertainty contract failed");
const arrow=readJson(manifest.assets.find(a=>a.body==="Arrowfall Range").path); if(arrow.coordinateFrame.geometryKind!=="constrained estimate"||!arrow.features.some(f=>/live-fire/i.test(f.hazard??""))) throw new Error("Arrowfall distributed-range contract failed");
console.log(`validated ${manifest.assets.length} body-operation assets across ${new Set(manifest.assets.map(a=>a.operationalKind)).size} families`);
