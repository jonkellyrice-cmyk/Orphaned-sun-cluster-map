#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "../scripts/system-data.mjs";
import { BODY_OPERATIONS_MODEL_VERSION, BODY_OPERATIONS_SCHEMA_VERSION, BODY_OPERATIONS_STATUS, bodyOperationAssetPath, canonicalRowFingerprint, coordinateFrameForKind, deriveBodyOperationTargets, operationLayerDefinitions, operationSeed, operationalKindForRow, stableUnit } from "../scripts/body-operations.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PROFILE = Object.freeze({ Abydos: "vadan", Tanis: "vostrann", Saqqara: "vostrann", Iunu: "vostrann", Memphis: "aurethic", Nekhen: "aurethic", Thebes: "xuanhari", Sais: "xuanhari", Seti: "xuanhari", Amarna: "union" });
const NAMES = Object.freeze({
  vadan: ["Vada","Mariner","Vesper","Thorn","Halcyon","Sundown","Orison","Tide","Eventide","Kandar","Nacre","Caldera"],
  vostrann: ["Brae","Dun","Cairn","Muir","Skye","Moroz","Volna","Vost","Gannet","Blackwake","Kras","Glen"],
  aurethic: ["Aureth","Beth","Qedem","Seraph","Melek","Hierava","Kedron","Elyon","Theon","Galil","Kyri","Lumen"],
  xuanhari: ["Tian","Qing","Long","Shan","Jin","Yue","Ling","Varun","Chandra","Rudra","Nava","Jyoti"],
  union: ["Magellan","Kepler","Nansen","Tasman","Atacama","Altai","Danube","Serengeti","Atlas","Okavango","Caliburn","Orinoco"],
});
const TERM = Object.freeze({ crater:"Crater", basin:"Basin", ridge:"Ridge", rift:"Chasma", ice:"Cold Trap", mine:"Claim", habitat:"Habitat", landing:"Field", observatory:"Array", hazard:"Exclusion", storm:"Storm", vortex:"Vortex", band:"Belt", platform:"Platform", asteroid:"Rock", module:"Module", ring:"Ring", hub:"Hub", dock:"Dock", hangar:"Hangar", reactor:"Reactor", approach:"Approach", gantry:"Gantry", berth:"Berth", hull:"Hull", bridge:"Command", engineering:"Engineering", deck:"Flight Deck", ship:"Element", segment:"Segment", control:"Control", power:"Power", aperture:"Aperture", beacon:"Marker", contour:"Contour", corridor:"Corridor" });

const pickName = (system, body, seed, type, index, functional = false) => {
  if (functional) return `${TERM[type] ?? type} ${index + 1}`;
  const roots = NAMES[PROFILE[system] ?? "union"], root = roots[Math.floor(stableUnit(`${seed}/${type}/${index}/root`) * roots.length) % roots.length];
  if (PROFILE[system] === "vostrann") return `${root}${["reach","grad","sk","brae","ova"][Math.floor(stableUnit(`${seed}/${type}/${index}/tail`) * 5)]} ${TERM[type] ?? type}`;
  if (PROFILE[system] === "xuanhari") return `${root}${["shan","vara","pur","ling","yuan"][Math.floor(stableUnit(`${seed}/${type}/${index}/tail`) * 5)]} ${TERM[type] ?? type}`;
  if (PROFILE[system] === "aurethic") return `${TERM[type] ?? type} ${root}${["ion","eth","ara","on","iel"][Math.floor(stableUnit(`${seed}/${type}/${index}/tail`) * 5)]}`;
  return `${TERM[type] ?? type} ${root}${[" Reach"," Crown"," Rise"," Ward",""][Math.floor(stableUnit(`${seed}/${type}/${index}/tail`) * 5)]}`.trim();
};
const spherical = (seed, index, polar = false) => ({ lat: Number(((polar ? (stableUnit(`${seed}/lat/${index}`) > .5 ? 1 : -1) * (66 + stableUnit(`${seed}/plat/${index}`) * 20) : -62 + stableUnit(`${seed}/lat/${index}`) * 124)).toFixed(3)), lon: Number((-180 + stableUnit(`${seed}/lon/${index}`) * 360).toFixed(3)), elevation: Number((-2 + stableUnit(`${seed}/elev/${index}`) * 8).toFixed(2)) });
const cartesian = (seed, index, scale) => ({ x: Math.round((stableUnit(`${seed}/x/${index}`) * 2 - 1) * scale), y: Math.round((stableUnit(`${seed}/y/${index}`) * 2 - 1) * scale), z: Math.round((stableUnit(`${seed}/z/${index}`) * 2 - 1) * scale * .55) });
const extent = (seed, index, min, max, unit) => ({ radius: Number((min + stableUnit(`${seed}/extent/${index}`) * (max-min)).toFixed(2)), unit });
function featureFactory(asset) {
  let serial = 0; const features = asset.features;
  return (type, layer, position, role, { name, description, resource = null, hazard = null, refs = [], lodPriority = 2, dimensions = null, provenance = BODY_OPERATIONS_STATUS } = {}) => {
    const i = serial++, id = `${asset.operationalKind}-${type}-${String(i + 1).padStart(2,"0")}`;
    features.push({ id, type, layer, name: name ?? pickName(asset.system, asset.body, asset.permanentOperationalSeed, type, i, !["crater","basin","ridge","rift","storm","vortex","asteroid","segment"].includes(type)), position, dimensions, operationalRole: role, resource, hazard, refs, lodPriority, description: description ?? `${role}. Accepted operational survey feature for ${asset.body}.`, provenance });
    return id;
  };
}
function generateNatural(asset) {
  const add = featureFactory(asset), s = asset.permanentOperationalSeed;
  for (let i=0;i<5;i++) add(i===4?"basin":"crater","landmarks",spherical(s,i),i===4?"regional impact basin":"named navigational landmark",{lodPriority:i<2?1:2,dimensions:extent(s,i,30,240,"km")});
  add("ridge","terrain",spherical(s,7),"regional traverse landmark",{lodPriority:2,dimensions:extent(s,7,100,700,"km")});
  add("rift","terrain",spherical(s,8),"geotechnical boundary",{hazard:"unstable slopes and regolith",lodPriority:3,dimensions:extent(s,8,80,500,"km")});
  const cold = add("ice","resources",spherical(s,9,true),"volatile reserve and extraction zone",{resource:"water/ammonia cold-trap volatiles",lodPriority:1,dimensions:extent(s,9,40,260,"km")});
  const mine = add("mine","resources",spherical(s,10),"automated or lightly crewed extraction site",{resource:"metals, silicates and construction feedstock",lodPriority:1});
  const habitat = add("habitat","installations",spherical(s,11),"sealed surface habitat and logistics node",{lodPriority:1,refs:[mine]});
  const field = add("landing","installations",spherical(s,12),"landing field and cargo transfer pad",{lodPriority:1,refs:[habitat]});
  add("observatory","installations",spherical(s,13),"survey and navigation observatory",{lodPriority:2});
  add("hazard","hazards",spherical(s,14),"radiation/unstable-terrain exclusion zone",{hazard:"radiation, ejecta and unstable regolith",lodPriority:1,dimensions:extent(s,14,40,180,"km")});
  add("corridor","routes",spherical(s,15),"pressurized-rover and cargo traverse",{refs:[habitat,field,mine],lodPriority:2});
  add("corridor","routes",spherical(s,16),"survey traverse to volatile field",{refs:[habitat,cold],lodPriority:3});
  if (asset.body === "Eilean Volna") {
    add("habitat","installations",{lat:-8.4,lon:42.2,elevation:-.2},"marginal favorable enclave",{name:"Volna Thaw Enclave",lodPriority:1,description:"A small engineered thaw-basin settlement exploiting locally favorable pressure, geothermal warmth and shielding; not an open-air city."});
    add("observatory","terrain",{lat:-11.1,lon:47.8,elevation:.1},"limited biosphere monitoring site",{name:"Sheltered Lichen Preserve",lodPriority:2,description:"Protected microbial/lichen-like biosphere site within a favorable thaw region; it does not imply an Earthlike global biosphere."});
  }
  if (asset.body === "Old Kestrel") {
    add("mine","resources",{lat:12.5,lon:-28.4,elevation:-1.4},"primary deep excavation and refinery feed",{name:"Black Kestrel Cut",resource:"exceptionally metal-rich ore",lodPriority:1});
    add("habitat","installations",{lat:8.2,lon:-20.1,elevation:-.8},"sealed industrial habitat complex",{name:"Cairnreach Surface Annex",lodPriority:1});
    add("landing","installations",{lat:5.6,lon:-15.2,elevation:-.3},"mass-driver export terminus",{name:"Gannet Mass Driver",lodPriority:1,hazard:"high-velocity export lane"});
    add("hazard","hazards",{lat:15.8,lon:-36.7,elevation:-2.2},"worked spoil and debris exclusion field",{name:"Old Cut Debris Zone",hazard:"excavation debris and unstable spoil",lodPriority:1});
  }
}
function generateGiant(asset) {
  const add=featureFactory(asset),s=asset.permanentOperationalSeed;
  for(let i=0;i<6;i++) add("band","atmosphere",{...spherical(s,i),pressure:Number((.4+i*.7).toFixed(2))},"named atmospheric circulation band",{lodPriority:i<3?1:2,dimensions:{widthDeg:8+Math.round(stableUnit(`${s}/band/${i}`)*10),unit:"deg"}});
  for(let i=0;i<4;i++) add(i%2?"vortex":"storm","storms",{...spherical(s,10+i),pressure:Number((.7+stableUnit(`${s}/press/${i}`)*2).toFixed(2))},"persistent major atmospheric system",{hazard:"extreme winds and pressure gradients",lodPriority:i<2?1:2,dimensions:extent(s,20+i,1800,16000,"km")});
  add("hazard","radiation",{...spherical(s,20),pressure:.05},"inner radiation exclusion latitude band",{hazard:"magnetospheric particle flux",lodPriority:1});
  add("corridor","operations",{...spherical(s,21),pressure:.8},"robotic atmospheric sampling corridor",{lodPriority:1,hazard:"weather-dependent access"});
  add("platform","operations",{...spherical(s,22),pressure:.02},"high-atmosphere observation reference",{lodPriority:2,description:"Survey marker for high-altitude operations; not a solid-surface installation."});
  if(asset.body==="Kalong") { add("storm","storms",{lat:-18.5,lon:33,pressure:1.4},"anomalous luminous thermal-bloom system",{name:"Ember Crown",hazard:"thermal bloom, auroral discharge and extreme gravity",lodPriority:1,dimensions:{radius:22000,unit:"km"}}); add("corridor","operations",{lat:41.2,lon:-72,pressure:.12},"heavy-element aerosol sampling corridor",{name:"Jade-Ember Survey Arc",resource:"anomalous heavy-element aerosols",hazard:"extreme radiation",lodPriority:1}); }
}
function generateBelt(asset) {
  const add=featureFactory(asset),s=asset.permanentOperationalSeed, rocks=[];
  for(let i=0;i<14;i++) rocks.push(add("asteroid","mapped-bodies",cartesian(s,i,180000),i<3?"major mapped asteroid / habitat rock":"reference-epoch tracked body",{name:pickName(asset.system,asset.body,s,"asteroid",i),resource:i%3===0?"metal-rich":i%3===1?"volatile-rich":"mixed silicate/carbonaceous",hazard:i%5===0?"hazardous tumble / debris envelope":null,lodPriority:i<4?1:i<9?2:3,dimensions:extent(s,i,2,45,"km")}));
  add("module","resources",cartesian(s,21,120000),"processing and transshipment cluster",{name:"Processing Cluster A",refs:rocks.slice(0,3),lodPriority:1});
  add("hazard","hazards",cartesian(s,22,160000),"dense debris concentration",{name:"Red Scatter",hazard:"collision and untracked fragment risk",lodPriority:1,dimensions:{radius:18000,unit:"km"}});
  add("corridor","traffic",cartesian(s,23,150000),"controlled traffic corridor through mapped sample",{name:"Belt Traffic Lane Alpha",refs:rocks.slice(2,6),lodPriority:1});
  add("hazard","hazards",cartesian(s,24,130000),"extraction exclusion zone around unstable rubble-pile",{name:"Claim Exclusion 7",hazard:"spin-shedding fragments",refs:[rocks[7]],lodPriority:2});
}
function generateStructure(asset) {
  const add=featureFactory(asset),s=asset.permanentOperationalSeed, scale=asset.operationalKind==="blinkgate"?120000:asset.operationalKind==="megastructure"?80000:asset.operationalKind==="shipyard"?30000:asset.operationalKind==="vessel"?12000:22000;
  const core=add("hub","structure",{x:0,y:0,z:0},"primary structural datum and command/logistics hub",{name:asset.operationalKind==="vessel"?"Command Spine":"Primary Hub",lodPriority:1,dimensions:{radius:Math.round(scale*.08),unit:"m"}});
  add("reactor","industry",{x:-Math.round(scale*.24),y:0,z:0},"reactor and power distribution section",{lodPriority:1,hazard:"restricted power-system envelope",refs:[core]});
  add("module","habitation",{x:Math.round(scale*.12),y:Math.round(scale*.18),z:0},"principal habitation section",{name:"Habitation Arc",lodPriority:1,refs:[core]});
  const docks=[]; for(let i=0;i<4;i++) docks.push(add("dock","docking",cartesian(s,10+i,scale*.34),"external docking/transfer node",{name:`Dock ${String.fromCharCode(65+i)}`,lodPriority:i<2?1:2,refs:[core]}));
  add("approach","approaches",{x:Math.round(scale*.72),y:0,z:0},"primary controlled approach corridor",{name:"Approach Alpha",refs:[docks[0]],lodPriority:1,dimensions:{length:Math.round(scale*.55),unit:"m"}});
  add("hazard","hazards",{x:-Math.round(scale*.62),y:0,z:0},"reactor/drive/service exclusion volume",{name:"Restricted Stern Volume",hazard:"radiation, thermal and service traffic",lodPriority:1,dimensions:{radius:Math.round(scale*.18),unit:"m"}});
  if(asset.operationalKind==="station") { add("ring","structure",{x:0,y:0,z:0},"primary transit/habitation ring",{name:"Transit Ring",refs:docks,lodPriority:1,dimensions:{radius:Math.round(scale*.28),unit:"m"}}); add("module","industry",{x:0,y:-Math.round(scale*.25),z:Math.round(scale*.08)},"cargo and industrial module cluster",{name:"Cargo Works",lodPriority:2}); }
  if(asset.operationalKind==="shipyard") { for(let i=0;i<3;i++) add(i===0?"gantry":"berth","industry",{x:Math.round((-0.2+i*.2)*scale),y:Math.round(scale*.28),z:0},i===0?"fabrication gantry":"construction/refit berth",{name:i===0?"Fabrication Spine":`Berth ${String.fromCharCode(67+i)}`,lodPriority:1,refs:[core]}); add("hull","industry",{x:Math.round(scale*.08),y:Math.round(scale*.31),z:0},"incomplete hull under construction",{name:"Hull 14 Incomplete",lodPriority:2}); }
  if(asset.operationalKind==="vessel") { add("bridge","structure",{x:Math.round(scale*.35),y:0,z:Math.round(scale*.05)},"bridge and command section",{name:"Command Citadel",lodPriority:1}); add("engineering","structure",{x:-Math.round(scale*.3),y:0,z:0},"engineering and main drive section",{name:"Drive Citadel",hazard:"engine plume aft",lodPriority:1}); add("deck","structure",{x:Math.round(scale*.05),y:Math.round(scale*.18),z:0},"flight deck and hangar complex",{name:"Flight Deck One",lodPriority:1}); }
  if(asset.operationalKind==="blinkgate") { add("aperture","structure",{x:0,y:0,z:0},"blink transit aperture",{name:"Akhetan Transit Aperture",hazard:"no conventional occupancy inside active transit volume",lodPriority:1,dimensions:{radius:115000,unit:"m"}}); add("control","habitation",{x:0,y:95000,z:15000},"gate traffic-control station",{name:"Manger Control Crown",lodPriority:1}); add("power","industry",{x:-105000,y:-50000,z:0},"stellar collection and gate-power segment",{name:"Heliostat Power Arc",lodPriority:1}); add("hazard","hazards",{x:0,y:0,z:0},"active transit exclusion volume",{name:"Gate Event Clear Zone",hazard:"blink transit and paracausal field effects",lodPriority:1,dimensions:{radius:145000,unit:"m"}}); }
  if(asset.operationalKind==="megastructure") { for(let i=0;i<5;i++) add("segment","structure",{x:Math.round((i-2)*scale*.24),y:0,z:Math.round((i%2)*scale*.06)},"named structural segment",{lodPriority:i<3?1:2,name:pickName(asset.system,asset.body,s,"segment",i),refs:[core]}); add("control","habitation",{x:Math.round(scale*.18),y:Math.round(scale*.12),z:0},"traffic and structural control station",{name:"Transfer Control",lodPriority:1}); }
  if(asset.body==="The Long Hook") add("segment","structure",{x:140000,y:0,z:0},"outer transfer segment and strategic choke point",{name:"Hookhead Transfer Node",lodPriority:1,description:"Strategically important outer transfer segment of the distributed tether; geometry remains a constrained operational survey rather than a literal AU-scale rendering."});
  if(asset.body==="Halo of Hierava") add("segment","structure",{x:0,y:70000,z:0},"inhabited ring segment",{name:"Choirward Arc",lodPriority:1});
  if(asset.body==="Arrowfall Range") { add("module","structure",{x:95000,y:-25000,z:6000},"mobile fortress reference position",{name:"Fortress Node Ketu",lodPriority:1}); add("module","structure",{x:-120000,y:40000,z:-5000},"instrumented target-hulk cluster",{name:"Target Field Nine",hazard:"live-fire proving ground",lodPriority:1}); add("approach","approaches",{x:0,y:-160000,z:0},"range identification and weapons-safe ingress corridor",{name:"Arrowfall Safe Ingress",hazard:"deviation enters live-fire volumes",lodPriority:1}); }
}
function generateFleet(asset) {
  const add=featureFactory(asset),s=asset.permanentOperationalSeed;
  const flag=add("ship","structure",{x:0,y:0,z:0},"flagship / formation reference",{name:asset.body==="Three Lanterns"?"First Lantern":"Flagship",lodPriority:1,dimensions:{length:18,unit:"km"}});
  for(let i=0;i<2;i++) add("ship","structure",{x:-40-i*28,y:(i?1:-1)*35,z:(i?1:-1)*8},"carrier or principal combatant",{name:asset.body==="Three Lanterns"?["Second Lantern","Third Lantern"][i]:`Carrier ${i+1}`,lodPriority:1,refs:[flag],dimensions:{length:14+i*3,unit:"km"}});
  for(let i=0;i<6;i++) add("ship","docking",cartesian(s,20+i,95),i<4?"escort element":"tender/picket element",{name:`${i<4?"Escort":"Picket"} ${i+1}`,lodPriority:i<2?1:2,refs:[flag],dimensions:{length:Number((1.2+stableUnit(`${s}/len/${i}`)*3).toFixed(1)),unit:"km"}});
  add("approach","approaches",{x:180,y:0,z:0},"formation identification and approach corridor",{name:"IFF Approach Axis",refs:[flag],lodPriority:1,dimensions:{length:280,unit:"km"}});
  add("hazard","hazards",{x:-150,y:0,z:0},"formation drive-plume and weapons-clearance region",{name:"Stern Weapons-Clear Zone",hazard:"engine plumes and active-defense arcs",lodPriority:1,dimensions:{radius:110,unit:"km"}});
}
function generateAnomaly(asset) {
  const add=featureFactory(asset),s=asset.permanentOperationalSeed;
  for(let i=0;i<6;i++) add("beacon","observation",cartesian(s,i,95000),"observation-perimeter marker",{name:`Thornwatch Perimeter ${i+1}`,lodPriority:i<3?1:2});
  for(let i=0;i<4;i++) add("contour","instability",cartesian(s,10+i,65000),"observed instability/intensity contour",{name:`Instability Contour ${String.fromCharCode(65+i)}`,hazard:"spacetime distortion; boundary location uncertain",lodPriority:i<2?1:2,dimensions:{radius:18000+i*9000,unit:"km"}});
  add("hazard","hazards",{x:0,y:0,z:0},"non-dockable exclusion boundary",{name:"Thornfield Core Exclusion",hazard:"severe spacetime/gravitational distortion",lodPriority:1,dimensions:{radius:72000,unit:"km"},description:"Uncertain observational exclusion volume. It is not a solid surface and provides no docking node."});
  add("corridor","sensors",{x:125000,y:22000,z:5000},"remote sensor ingress corridor",{name:"Vada Sensor Corridor",hazard:"specialized navigation required",lodPriority:1});
}
export function generateBodyOperationAsset(row) {
  const operationalKind=operationalKindForRow(row); if(!operationalKind) throw new TypeError(`${row.system}/${row.object} is not an operational target`);
  const asset={ schemaVersion:BODY_OPERATIONS_SCHEMA_VERSION, system:row.system, body:row.object, canonicalType:row.type, operationalKind, permanentOperationalSeed:operationSeed(row.system,row.object,row.type), operationalModelVersion:BODY_OPERATIONS_MODEL_VERSION, canonicalSourceFingerprint:canonicalRowFingerprint(row), acceptedCanonStatus:BODY_OPERATIONS_STATUS, coordinateFrame:coordinateFrameForKind(operationalKind), namingProfile:PROFILE[row.system]??"union", layers:operationLayerDefinitions(operationalKind), features:[], operationalSummary:{} };
  if(operationalKind==="natural-solid") generateNatural(asset); else if(operationalKind==="giant") generateGiant(asset); else if(operationalKind==="belt") generateBelt(asset); else if(operationalKind==="fleet") generateFleet(asset); else if(operationalKind==="anomaly") generateAnomaly(asset); else generateStructure(asset);
  const counts=Object.fromEntries([...new Set(asset.features.map(f=>f.layer))].sort().map(layer=>[layer,asset.features.filter(f=>f.layer===layer).length]));
  asset.operationalSummary={ featureCount:asset.features.length, layerCounts:counts, keyFeatures:asset.features.filter(f=>f.lodPriority===1).slice(0,8).map(f=>f.id), geometryStatement:asset.coordinateFrame.geometryKind, note: operationalKind==="giant"?"Atmospheric survey; no solid traversable surface.":operationalKind==="belt"?"Distributed reference-epoch sample; centroid is not an asteroid or route endpoint.":operationalKind==="anomaly"?"Uncertain observation volume; no docking geometry asserted.":"Accepted generated operational survey; display compression must not be used for physical calculations." };
  return asset;
}
export function serializeAsset(asset){ return `${JSON.stringify(asset,null,2)}\n`; }
export function generateAll(rows, cartographyManifest){ return deriveBodyOperationTargets(rows,cartographyManifest).map(({row})=>generateBodyOperationAsset(row)); }

function main(){
  const args=new Set(process.argv.slice(2));
  const csv=parseCsv(readFileSync(resolve(ROOT,"docs/system-orbital-distances.csv"),"utf8"));
  const cartography=JSON.parse(readFileSync(resolve(ROOT,"data/planet-cartography/manifest.json"),"utf8"));
  const assets=generateAll(csv,cartography), out=resolve(ROOT,"data/body-operations");
  if(!args.has("--check")){ rmSync(out,{recursive:true,force:true}); mkdirSync(out,{recursive:true}); }
  const manifest={schemaVersion:BODY_OPERATIONS_SCHEMA_VERSION,status:BODY_OPERATIONS_STATUS,modelVersion:BODY_OPERATIONS_MODEL_VERSION,sourceRegistry:"docs/system-orbital-distances.csv",sourceCartographyManifest:"data/planet-cartography/manifest.json",targetCount:assets.length,assets:assets.map(asset=>({system:asset.system,body:asset.body,canonicalType:asset.canonicalType,operationalKind:asset.operationalKind,path:bodyOperationAssetPath(asset.system,asset.body),seed:asset.permanentOperationalSeed,fingerprint:asset.canonicalSourceFingerprint,featureCount:asset.features.length}))};
  if(args.has("--check")){ for(const asset of assets){ const p=resolve(ROOT,bodyOperationAssetPath(asset.system,asset.body)); if(readFileSync(p,"utf8")!==serializeAsset(asset)) throw new Error(`Non-deterministic or stale asset: ${asset.system}/${asset.body}`); } const expected=`${JSON.stringify(manifest,null,2)}\n`; if(readFileSync(resolve(out,"manifest.json"),"utf8")!==expected) throw new Error("Stale body-operations manifest"); console.log(`body-operations deterministic: ${assets.length}`); return; }
  for(const asset of assets){ const p=resolve(ROOT,bodyOperationAssetPath(asset.system,asset.body)); mkdirSync(dirname(p),{recursive:true}); writeFileSync(p,serializeAsset(asset)); }
  writeFileSync(resolve(out,"manifest.json"),`${JSON.stringify(manifest,null,2)}\n`); console.log(`generated ${assets.length} body-operation assets`);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) main();
