const xml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

const PALETTES = Object.freeze({
  conclave: { hull: "#66584b", edge: "#e1c58e", accent: "#68b9c7", sacred: "#d2a650", dark: "#172735" },
  mandate: { hull: "#5f655f", edge: "#d8c9a4", accent: "#a73f32", sacred: "#69a58e", dark: "#17232d" },
  accords: { hull: "#687276", edge: "#c7b48a", accent: "#d08b46", sacred: "#65a8b4", dark: "#182832" },
  union: { hull: "#697c85", edge: "#b9d0d5", accent: "#4aa5c8", sacred: "#8fc7b1", dark: "#172b36" },
  frontier: { hull: "#677274", edge: "#c8c2a8", accent: "#5e9eaa", sacred: "#91b49b", dark: "#1b2a30" },
});

const factionPalette = (identity) => PALETTES[identity?.factionFamily] ?? PALETTES.frontier;

function hullPath(cx, cy, length, halfHeight, nose = .92, tail = .16) {
  const left = cx - length / 2, right = cx + length / 2;
  return `M ${left} ${cy} L ${left + length * tail} ${cy - halfHeight * .78} L ${cx + length * .18} ${cy - halfHeight} L ${right} ${cy - halfHeight * (1 - nose)} L ${right} ${cy + halfHeight * (1 - nose)} L ${cx + length * .18} ${cy + halfHeight} L ${left + length * tail} ${cy + halfHeight * .78} Z`;
}

function spires(cx, baseY, count, spread, height, color, width = 5) {
  return Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? 0 : i / (count - 1) - .5;
    const x = cx + t * spread;
    const h = height * (1 - Math.abs(t) * .42);
    return `<path d="M ${x - width} ${baseY} L ${x} ${baseY - h} L ${x + width} ${baseY} Z" fill="${color}" opacity=".92"/>`;
  }).join("");
}

function ring(cx, cy, rx, ry, color, width = 12, opacity = .82) {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="${color}" stroke-width="${width}" opacity="${opacity}"/>`;
}

function node(cx, cy, r, palette, emphasized = false) {
  return `<g><circle cx="${cx}" cy="${cy}" r="${r}" fill="${palette.hull}" stroke="${palette.edge}" stroke-width="${emphasized ? 6 : 4}"/><circle cx="${cx}" cy="${cy}" r="${Math.max(4, r * .32)}" fill="${palette.accent}" opacity=".9"/>${ring(cx, cy, r * 1.65, r * .55, palette.edge, 3, .5)}</g>`;
}

function vesselLantern(identity, frame, p) {
  const cx = frame.x + frame.width * .52, cy = frame.y + frame.height * .42;
  const length = frame.width * .76, half = frame.height * .105;
  const haloX = cx - length * .10;
  return `<g data-silhouette="${xml(identity.silhouetteFamily)}">
    <path d="${hullPath(cx, cy, length, half, .98, .11)}" fill="${p.hull}" stroke="${p.edge}" stroke-width="7" opacity=".88"/>
    <path d="M ${cx-length*.36} ${cy} L ${cx+length*.42} ${cy}" stroke="${p.edge}" stroke-width="5" opacity=".62"/>
    ${ring(haloX, cy, half * 1.55, half * 2.6, p.sacred, 13, .94)}
    ${ring(haloX, cy, half * 1.08, half * 2.08, p.accent, 4, .72)}
    <circle cx="${haloX}" cy="${cy}" r="${half*.28}" fill="${p.accent}" stroke="${p.edge}" stroke-width="4"/>
    ${spires(haloX - half*.6, cy-half*.65, 5, half*2.0, half*1.55, p.edge, 5)}
    ${Array.from({length:5},(_,i)=>`<rect x="${cx-length*.19+i*length*.09}" y="${cy-half*.68}" width="${length*.055}" height="${half*1.36}" fill="${i%2?p.dark:p.hull}" stroke="${p.edge}" stroke-width="2" opacity=".65"/>`).join("")}
    <path d="M ${cx+length*.38} ${cy-half*.42} L ${cx+length*.49} ${cy} L ${cx+length*.38} ${cy+half*.42}" fill="${p.dark}" stroke="${p.accent}" stroke-width="5"/>
  </g>`;
}

function vesselCrown(identity, frame, p) {
  const cx = frame.x + frame.width * .49, cy = frame.y + frame.height * .42;
  const length = frame.width * .80, half = frame.height * .09, crownX = cx + length * .16;
  const ribs = Array.from({length:9},(_,i)=>{
    const x = cx-length*.33+i*length*.075;
    return `<path d="M ${x} ${cy-half*.72} L ${x+length*.035} ${cy} L ${x} ${cy+half*.72}" fill="none" stroke="${p.edge}" stroke-width="3" opacity=".55"/>`;
  }).join("");
  return `<g data-silhouette="${xml(identity.silhouetteFamily)}"><path d="${hullPath(cx,cy,length,half,.98,.08)}" fill="${p.hull}" stroke="${p.edge}" stroke-width="7" opacity=".9"/>${ribs}${ring(crownX,cy,half*1.65,half*2.8,p.edge,10,.92)}${ring(crownX,cy,half*1.15,half*2.18,p.accent,4,.7)}<circle cx="${crownX}" cy="${cy}" r="${half*.24}" fill="${p.accent}" stroke="${p.edge}" stroke-width="3"/><path d="M ${cx-length*.44} ${cy} L ${cx-length*.52} ${cy}" stroke="${p.accent}" stroke-width="8"/><path d="M ${cx+length*.46} ${cy-half*.32} L ${cx+length*.52} ${cy} L ${cx+length*.46} ${cy+half*.32}" fill="${p.dark}"/></g>`;
}

function vesselMandate(identity, frame, p, scale = 1, ox = 0, oy = 0) {
  const cx = frame.x + frame.width * (.50 + ox), cy = frame.y + frame.height * (.42 + oy);
  const length = frame.width * .72 * scale, half = frame.height * .11 * scale;
  return `<g data-silhouette="${xml(identity.silhouetteFamily)}"><path d="${hullPath(cx,cy,length,half,.99,.15)}" fill="${p.hull}" stroke="${p.edge}" stroke-width="${6*scale}" opacity=".93"/><path d="M ${cx-length*.40} ${cy} L ${cx+length*.45} ${cy}" stroke="${p.accent}" stroke-width="${4*scale}" opacity=".8"/>${[-.16,0,.16].map((t,i)=>`<path d="M ${cx+length*t} ${cy-half*.82} L ${cx+length*(t+.065)} ${cy-half*(1.25+i*.13)} L ${cx+length*(t+.11)} ${cy-half*.76}" fill="${p.dark}" stroke="${p.edge}" stroke-width="${2.8*scale}"/>`).join("")}<path d="M ${cx-length*.02} ${cy-half*.72} L ${cx+length*.18} ${cy-half*.43}" stroke="${p.sacred}" stroke-width="${4*scale}"/><path d="M ${cx-length*.02} ${cy+half*.72} L ${cx+length*.18} ${cy+half*.43}" stroke="${p.sacred}" stroke-width="${4*scale}"/></g>`;
}

function vesselGroup(identity, frame, p, accord = false) {
  if (accord) {
    const positions = [[-.12,-.13,.72],[.13,.02,.64],[-.02,.18,.58]];
    return `<g data-silhouette="${xml(identity.silhouetteFamily)}">${positions.map(([ox,oy,s],i)=>{
      const fake = { ...identity, silhouetteFamily: `${identity.silhouetteFamily}-unit-${i+1}` };
      return vesselCrown(fake,{...frame,x:frame.x+frame.width*ox,y:frame.y+frame.height*oy,width:frame.width*s,height:frame.height*s},p);
    }).join("")}</g>`;
  }
  return `<g data-silhouette="${xml(identity.silhouetteFamily)}">${[[-.10,-.10,.70],[.14,.08,.54],[-.12,.19,.45],[.20,-.16,.38]].map(([ox,oy,s])=>vesselMandate(identity,frame,p,s,ox,oy)).join("")}</g>`;
}

function radialStation(identity, frame, p, mode) {
  const cx=frame.x+frame.width*.50, cy=frame.y+frame.height*.40;
  const rx=frame.width*.25, ry=frame.height*.14;
  const concentric = [1,.72,.44].map((s,i)=>ring(cx,cy,rx*s,ry*s,i===0?p.edge:i===1?p.sacred:p.accent,i===0?12:6,i===0?.8:.62)).join("");
  const radial = Array.from({length:8},(_,i)=>{const a=i*Math.PI/4;return `<line x1="${cx+Math.cos(a)*rx*.25}" y1="${cy+Math.sin(a)*ry*.25}" x2="${cx+Math.cos(a)*rx}" y2="${cy+Math.sin(a)*ry}" stroke="${p.edge}" stroke-width="4" opacity=".5"/>`;}).join("");
  if(mode==="mandate") return `<g data-silhouette="${xml(identity.silhouetteFamily)}">${concentric}${radial}<ellipse cx="${cx}" cy="${cy}" rx="${rx*.28}" ry="${ry*.33}" fill="${p.hull}" stroke="${p.edge}" stroke-width="6"/>${spires(cx,cy-ry*.08,7,rx*.48,frame.height*.23,p.edge,6)}${Array.from({length:12},(_,i)=>{const a=i*Math.PI/6;return `<rect x="${cx+Math.cos(a)*rx*.82-9}" y="${cy+Math.sin(a)*ry*.82-9}" width="18" height="18" fill="${i%3===0?p.accent:p.hull}" stroke="${p.edge}" stroke-width="2"/>`;}).join("")}</g>`;
  if(mode==="conclave") return `<g data-silhouette="${xml(identity.silhouetteFamily)}">${ring(cx,cy,rx*.72,ry*.68,p.edge,9,.7)}${Array.from({length:6},(_,i)=>{const a=i*Math.PI/3;return `<path d="M ${cx} ${cy} L ${cx+Math.cos(a)*rx*1.02} ${cy+Math.sin(a)*ry*1.18}" stroke="${p.edge}" stroke-width="9" opacity=".75"/>`;}).join("")}<ellipse cx="${cx}" cy="${cy}" rx="${rx*.25}" ry="${ry*.35}" fill="${p.hull}" stroke="${p.sacred}" stroke-width="7"/>${spires(cx,cy-ry*.12,7,rx*.56,frame.height*.25,p.edge,6)}<circle cx="${cx}" cy="${cy}" r="18" fill="${p.accent}"/></g>`;
  if(mode==="cross") return `<g data-silhouette="${xml(identity.silhouetteFamily)}">${[-1,1].map(s=>`<rect x="${cx+(s<0?-rx*.95:rx*.16)}" y="${cy-22}" width="${rx*.79}" height="44" fill="${p.hull}" stroke="${p.edge}" stroke-width="5"/>`).join("")}<rect x="${cx-22}" y="${cy-ry*.95}" width="44" height="${ry*1.9}" fill="${p.hull}" stroke="${p.edge}" stroke-width="5"/><circle cx="${cx}" cy="${cy}" r="46" fill="${p.hull}" stroke="${p.sacred}" stroke-width="7"/>${spires(cx,cy-20,5,80,130,p.edge,5)}</g>`;
  return `<g data-silhouette="${xml(identity.silhouetteFamily)}">${concentric}${Array.from({length:6},(_,i)=>{const a=i*Math.PI/3;const x2=cx+Math.cos(a)*rx*(.8+(i%2)*.35),y2=cy+Math.sin(a)*ry*(.8+(i%2)*.35);return `<line x1="${cx}" y1="${cy}" x2="${x2}" y2="${y2}" stroke="${p.edge}" stroke-width="6" opacity=".65"/><rect x="${x2-18}" y="${y2-12}" width="36" height="24" fill="${p.hull}" stroke="${p.accent}" stroke-width="3"/>`;}).join("")}<circle cx="${cx}" cy="${cy}" r="40" fill="${p.hull}" stroke="${p.edge}" stroke-width="6"/>${spires(cx,cy-20,3,85,150,p.edge,5)}</g>`;
}

function verticalStation(identity, frame, p, mode) {
  const cx=frame.x+frame.width*.50, base=frame.y+frame.height*.63;
  if(mode==="spear") return `<g data-silhouette="${xml(identity.silhouetteFamily)}"><path d="M ${cx-frame.width*.28} ${base} L ${cx-frame.width*.12} ${base-frame.height*.06} L ${cx+frame.width*.18} ${base-frame.height*.04} L ${cx+frame.width*.30} ${base} L ${cx+frame.width*.18} ${base+frame.height*.05} L ${cx-frame.width*.12} ${base+frame.height*.07} Z" fill="${p.hull}" stroke="${p.edge}" stroke-width="7"/><path d="M ${cx-30} ${base} L ${cx} ${frame.y+frame.height*.10} L ${cx+30} ${base} Z" fill="${p.hull}" stroke="${p.edge}" stroke-width="7"/><path d="M ${cx} ${frame.y+frame.height*.08} L ${cx} ${base+frame.height*.12}" stroke="${p.accent}" stroke-width="4"/></g>`;
  const levels=mode==="registry"?5:7;
  return `<g data-silhouette="${xml(identity.silhouetteFamily)}"><line x1="${cx}" y1="${frame.y+frame.height*.14}" x2="${cx}" y2="${base+frame.height*.13}" stroke="${p.edge}" stroke-width="12"/>${Array.from({length:levels},(_,i)=>{const y=base-i*frame.height*.07;const w=frame.width*(.08+i*.012);return `<rect x="${cx-w/2}" y="${y-14}" width="${w}" height="28" rx="5" fill="${p.hull}" stroke="${i===levels-1?p.sacred:p.edge}" stroke-width="4"/>`;}).join("")}<path d="M ${cx-18} ${frame.y+frame.height*.19} L ${cx} ${frame.y+frame.height*.07} L ${cx+18} ${frame.y+frame.height*.19} Z" fill="${p.edge}"/>${[-1,1].map(s=>`<path d="M ${cx+s*60} ${base-frame.height*.11} L ${cx+s*frame.width*.18} ${base-frame.height*.02}" stroke="${p.edge}" stroke-width="6"/>`).join("")}</g>`;
}

function anchorage(identity, frame, p, sacred=false) {
  const cx=frame.x+frame.width*.50, cy=frame.y+frame.height*.43;
  const w=frame.width*.70,h=frame.height*.13;
  return `<g data-silhouette="${xml(identity.silhouetteFamily)}"><rect x="${cx-w/2}" y="${cy-h/2}" width="${w}" height="${h}" rx="18" fill="${p.hull}" stroke="${p.edge}" stroke-width="7"/>${Array.from({length:7},(_,i)=>`<line x1="${cx-w*.36+i*w*.12}" y1="${cy-h*.45}" x2="${cx-w*.36+i*w*.12}" y2="${cy+h*.45}" stroke="${p.dark}" stroke-width="5" opacity=".7"/>`).join("")}${[-.42,-.2,.2,.42].map(t=>`<path d="M ${cx+w*t} ${cy} L ${cx+w*t} ${cy+(t<0?-1:1)*h*1.6}" stroke="${p.edge}" stroke-width="6"/>`).join("")}${sacred?`${spires(cx,cy-h*.32,7,w*.22,frame.height*.23,p.edge,6)}${ring(cx,cy,w*.11,h*.72,p.sacred,6,.65)}`:`<rect x="${cx-w*.10}" y="${cy-h*.85}" width="${w*.20}" height="${h*.45}" fill="${p.hull}" stroke="${p.accent}" stroke-width="4"/>`}</g>`;
}

function yard(identity, frame, p, mode) {
  const cx=frame.x+frame.width*.50, cy=frame.y+frame.height*.43, w=frame.width*.72, h=frame.height*.34;
  if(mode==="accord-heavy") return `<g data-silhouette="${xml(identity.silhouetteFamily)}">${[[-.24,-.10,.52],[.05,.06,.62],[.27,-.08,.45]].map(([ox,oy,s],i)=>`<g><rect x="${cx+w*ox-w*s*.32}" y="${cy+h*oy-h*s*.25}" width="${w*s*.64}" height="${h*s*.50}" rx="12" fill="${p.hull}" stroke="${p.edge}" stroke-width="6"/><rect x="${cx+w*ox-w*s*.18}" y="${cy+h*oy-h*s*.39}" width="${w*s*.36}" height="${h*s*.22}" fill="${p.dark}" stroke="${p.accent}" stroke-width="4"/>${spires(cx+w*ox,cy+h*oy-h*s*.22,3,w*s*.20,h*s*.40,p.edge,4)}</g>`).join("")}<path d="M ${cx-w*.43} ${cy+h*.25} L ${cx+w*.43} ${cy-h*.23}" stroke="${p.edge}" stroke-width="9" opacity=".55"/></g>`;
  if(mode==="accord-mobile") return `<g data-silhouette="${xml(identity.silhouetteFamily)}"><path d="${hullPath(cx,cy,w*.82,h*.32,.88,.10)}" fill="${p.hull}" stroke="${p.edge}" stroke-width="7"/>${[-.24,-.08,.08,.24].map(t=>`<rect x="${cx+w*t-w*.08}" y="${cy-h*.30}" width="${w*.16}" height="${h*.58}" rx="8" fill="${p.dark}" stroke="${p.accent}" stroke-width="4"/>`).join("")}<path d="M ${cx+w*.39} ${cy-h*.23} L ${cx+w*.48} ${cy} L ${cx+w*.39} ${cy+h*.23}" fill="${p.dark}" stroke="${p.edge}" stroke-width="4"/></g>`;
  if(mode==="mandate") return `<g data-silhouette="${xml(identity.silhouetteFamily)}"><line x1="${cx-w*.45}" y1="${cy}" x2="${cx+w*.45}" y2="${cy}" stroke="${p.edge}" stroke-width="18"/>${[-.32,-.16,0,.16,.32].map((t,i)=>`<g><line x1="${cx+w*t}" y1="${cy-h*.34}" x2="${cx+w*t}" y2="${cy+h*.34}" stroke="${p.edge}" stroke-width="10"/><rect x="${cx+w*t-24}" y="${cy-h*.18}" width="48" height="${h*.36}" fill="${p.hull}" stroke="${p.accent}" stroke-width="4"/>${spires(cx+w*t,cy-h*.18,1,1,h*(.35+i%2*.10),p.sacred,8)}</g>`).join("")}</g>`;
  if(mode==="conclave") return `<g data-silhouette="${xml(identity.silhouetteFamily)}"><line x1="${cx-w*.44}" y1="${cy}" x2="${cx+w*.44}" y2="${cy}" stroke="${p.edge}" stroke-width="15"/>${[-.30,-.12,.12,.30].map(t=>`<rect x="${cx+w*t-w*.08}" y="${cy-h*.15}" width="${w*.16}" height="${h*.30}" fill="none" stroke="${p.edge}" stroke-width="7"/>`).join("")}<ellipse cx="${cx}" cy="${cy}" rx="${w*.13}" ry="${h*.24}" fill="${p.hull}" stroke="${p.sacred}" stroke-width="7"/>${spires(cx,cy-h*.08,7,w*.20,h*.62,p.edge,6)}</g>`;
  return `<g data-silhouette="${xml(identity.silhouetteFamily)}">${[-.28,0,.26].map((t,i)=>`<rect x="${cx+w*t-w*.15}" y="${cy-h*(.20+i*.03)}" width="${w*.30}" height="${h*(.40+i*.06)}" rx="10" fill="${p.hull}" stroke="${p.edge}" stroke-width="6"/>`).join("")}<path d="M ${cx-w*.46} ${cy} L ${cx+w*.46} ${cy}" stroke="${p.accent}" stroke-width="7"/></g>`;
}

function blink(identity, frame, p) {
  const cx=frame.x+frame.width*.48,cy=frame.y+frame.height*.41,rx=frame.width*.18,ry=frame.height*.29;
  return `<g data-silhouette="${xml(identity.silhouetteFamily)}">${ring(cx,cy,rx,ry,p.edge,24,.92)}${ring(cx,cy,rx*.80,ry*.80,p.accent,8,.75)}${Array.from({length:8},(_,i)=>{const a=i*Math.PI/4;const x=cx+Math.cos(a)*rx*1.22,y=cy+Math.sin(a)*ry*.95;return `<line x1="${cx+Math.cos(a)*rx}" y1="${cy+Math.sin(a)*ry}" x2="${x}" y2="${y}" stroke="${p.edge}" stroke-width="7"/><rect x="${x-38}" y="${y-22}" width="76" height="44" rx="8" fill="${p.hull}" stroke="${p.accent}" stroke-width="4"/>`;}).join("")}<path d="M ${cx-rx*1.5} ${cy} L ${cx+rx*1.5} ${cy}" stroke="${p.accent}" stroke-width="4" stroke-dasharray="12 10" opacity=".55"/></g>`;
}

function accretiveCity(identity, frame, p) {
  const cx=frame.x+frame.width*.50,cy=frame.y+frame.height*.42,w=frame.width*.72,h=frame.height*.42;
  const blocks=[[-.32,-.06,.17,.18],[-.17,-.14,.22,.21],[.02,-.03,.25,.27],[.22,-.12,.18,.20],[.31,.09,.15,.16],[-.24,.13,.20,.17],[-.02,.15,.18,.15],[.16,.14,.20,.18]];
  return `<g data-silhouette="${xml(identity.silhouetteFamily)}">${blocks.map(([ox,oy,bw,bh],i)=>`<g><rect x="${cx+w*ox-w*bw/2}" y="${cy+h*oy-h*bh/2}" width="${w*bw}" height="${h*bh}" rx="8" fill="${i%3===0?p.dark:p.hull}" stroke="${i%2?p.edge:p.accent}" stroke-width="5"/>${i%2===0?spires(cx+w*ox,cy+h*oy-h*bh*.45,2,w*bw*.35,h*bh*.65,p.edge,3):""}</g>`).join("")}<path d="M ${cx-w*.46} ${cy+h*.20} L ${cx+w*.46} ${cy-h*.19}" stroke="${p.edge}" stroke-width="8" opacity=".45"/></g>`;
}

function cairnreach(identity, frame, p) {
  const cx=frame.x+frame.width*.50,cy=frame.y+frame.height*.42;
  return `<g data-silhouette="${xml(identity.silhouetteFamily)}">${Array.from({length:22},(_,i)=>{const a=i*2.399963;const d=35+i*20;const x=cx+Math.cos(a)*d*1.25,y=cy+Math.sin(a)*d*.62;const r=18+(i%5)*6;return `<g><circle cx="${x}" cy="${y}" r="${r}" fill="${i%3===0?p.dark:p.hull}" stroke="${p.edge}" stroke-width="3"/><rect x="${x-r*.55}" y="${y-r*.24}" width="${r*1.1}" height="${r*.48}" fill="${p.hull}" stroke="${p.accent}" stroke-width="2"/></g>`;}).join("")}<polyline points="${cx-360},${cy+80} ${cx-180},${cy-45} ${cx},${cy+20} ${cx+170},${cy-65} ${cx+350},${cy+40}" fill="none" stroke="${p.edge}" stroke-width="7" opacity=".55"/></g>`;
}

function distributed(identity, frame, p, mode) {
  const x=frame.x,y=frame.y,w=frame.width,h=frame.height;
  if(mode==="halo") { const cx=x+w*.50,cy=y+h*.42,rx=w*.34,ry=h*.24; return `<g data-silhouette="${xml(identity.silhouetteFamily)}">${ring(cx,cy,rx,ry,p.edge,5,.38)}${Array.from({length:10},(_,i)=>{const a=i*Math.PI/5;return node(cx+Math.cos(a)*rx,cy+Math.sin(a)*ry,i%3===0?34:24,p,i%3===0);}).join("")}</g>`; }
  if(mode==="watch") return `<g data-silhouette="${xml(identity.silhouetteFamily)}"><polyline points="${x+w*.12},${y+h*.68} ${x+w*.28},${y+h*.52} ${x+w*.46},${y+h*.62} ${x+w*.64},${y+h*.39} ${x+w*.84},${y+h*.25}" fill="none" stroke="${p.accent}" stroke-width="5" stroke-dasharray="14 10" opacity=".7"/>${[[.12,.68],[.28,.52],[.46,.62],[.64,.39],[.84,.25]].map(([px,py],i)=>node(x+w*px,y+h*py,i===2?38:27,p,i===2)).join("")}</g>`;
  if(mode==="range") return `<g data-silhouette="${xml(identity.silhouetteFamily)}">${[[.14,.30],[.30,.42],[.46,.25],[.62,.48],[.78,.31],[.25,.68],[.50,.67],[.72,.70]].map(([px,py],i)=>`<g>${node(x+w*px,y+h*py,i%3===0?30:21,p,i%3===0)}<line x1="${x+w*px}" y1="${y+h*py}" x2="${x+w*(px+.08)}" y2="${y+h*(py+(i%2?.08:-.08))}" stroke="${p.accent}" stroke-width="3" stroke-dasharray="9 7"/></g>`).join("")}</g>`;
  return "";
}

function tether(identity, frame, p) {
  const x=frame.x,y=frame.y,w=frame.width,h=frame.height,cy=y+h*.43;
  return `<g data-silhouette="${xml(identity.silhouetteFamily)}"><path d="M ${x+w*.05} ${cy+h*.18} Q ${x+w*.45} ${cy-h*.10} ${x+w*.95} ${cy+h*.05}" fill="none" stroke="${p.edge}" stroke-width="10"/>${Array.from({length:9},(_,i)=>{const px=x+w*(.10+i*.10),py=cy+h*(.13-i*.018+(i%2)*.04);return `<g><rect x="${px-28}" y="${py-15}" width="56" height="30" fill="${p.hull}" stroke="${p.accent}" stroke-width="3"/>${i%2===0?spires(px,py-12,1,1,55,p.edge,4):""}</g>`;}).join("")}</g>`;
}

function sectionalBand(identity, frame, p) {
  const zones=identity.interiorZones?.slice(0,7) ?? [];
  if(!zones.length) return "";
  const x=frame.x+frame.width*.08,y=frame.y+frame.height*.79,w=frame.width*.84,h=frame.height*.13;
  const each=w/zones.length;
  return `<g data-section-logic="true"><text x="${x}" y="${y-12}" fill="#b8d6df" font-family="monospace" font-size="16" font-weight="700">STRUCTURAL ZONING — RELATIONSHIP GUIDE, NOT DECK PLAN</text>${zones.map((z,i)=>`<g><rect x="${x+i*each}" y="${y}" width="${each-3}" height="${h}" fill="${i%3===0?p.dark:i%3===1?p.hull:p.accent}" opacity="${i%3===2?.42:.62}" stroke="${p.edge}" stroke-width="2"/><text x="${x+i*each+8}" y="${y+h*.52}" fill="#edf4f5" font-family="monospace" font-size="12">${xml(z.length>20?z.slice(0,18)+"…":z)}</text></g>`).join("")}</g>`;
}

export function renderSuperstructureAtlas(identity, frame, { includeSectionalBand = true } = {}) {
  if(!identity) return "";
  const p=factionPalette(identity), family=identity.silhouetteFamily;
  let silhouette="";
  if(family==="conclave-lantern-spindle") silhouette=vesselLantern(identity,frame,p);
  else if(family==="accord-crown-spindle") silhouette=vesselCrown(identity,frame,p);
  else if(family==="mandate-needle-carrier") silhouette=vesselMandate(identity,frame,p);
  else if(family==="mandate-cloud-tiger-group") silhouette=vesselGroup(identity,frame,p,false);
  else if(family==="accord-three-lantern-convoy") silhouette=vesselGroup(identity,frame,p,true);
  else if(family==="mandate-concentric-meridian") silhouette=radialStation(identity,frame,p,"mandate");
  else if(family==="conclave-radial-sanctum") silhouette=radialStation(identity,frame,p,"conclave");
  else if(family==="conclave-cross-gatehouse") silhouette=radialStation(identity,frame,p,"cross");
  else if(family==="accord-radial-exchange") silhouette=radialStation(identity,frame,p,"accord");
  else if(family==="mandate-jade-spear") silhouette=verticalStation(identity,frame,p,"spear");
  else if(family==="mandate-registry-spire") silhouette=verticalStation(identity,frame,p,"registry");
  else if(family==="stacked-vertical-station") silhouette=verticalStation(identity,frame,p,"union");
  else if(family==="conclave-cathedral-anchorage") silhouette=anchorage(identity,frame,p,true);
  else if(family==="frontier-anchorage") silhouette=anchorage(identity,frame,p,false);
  else if(family==="conclave-sacred-yard") silhouette=yard(identity,frame,p,"conclave");
  else if(family==="mandate-nine-banners-yard") silhouette=yard(identity,frame,p,"mandate");
  else if(family==="accord-heavy-yard-conglomerate") silhouette=yard(identity,frame,p,"accord-heavy");
  else if(family==="accord-mobile-yard") silhouette=yard(identity,frame,p,"accord-mobile");
  else if(["accord-blackwake-yard","union-linear-yard"].includes(family)) silhouette=yard(identity,frame,p,"generic");
  else if(family==="annular-gateway-complex") silhouette=blink(identity,frame,p);
  else if(["accord-accretive-exchange-city","rectilinear-gateway-station"].includes(family)) silhouette=accretiveCity(identity,frame,p);
  else if(family==="accord-asteroid-industrial-city") silhouette=cairnreach(identity,frame,p);
  else if(family==="conclave-orbital-halo") silhouette=distributed(identity,frame,p,"halo");
  else if(family==="watch-citadel-chain") silhouette=distributed(identity,frame,p,"watch");
  else if(family==="mandate-distributed-range") silhouette=distributed(identity,frame,p,"range");
  else if(family==="accord-long-tether") silhouette=tether(identity,frame,p);
  else silhouette=accretiveCity(identity,frame,p);
  return `<g data-superstructure="${xml(identity.system)}/${xml(identity.body)}" data-superstructure-family="${xml(family)}" data-superstructure-scale="city-scale-or-larger">${silhouette}${includeSectionalBand ? sectionalBand(identity,frame,p) : ""}</g>`;
}

export function superstructureProfileLines(identity) {
  if(!identity) return [];
  return [
    `- Superstructure identity model: ${identity.modelVersion}`,
    `- Scale rule: city-scale or larger; listed artificial bodies are inhabited superstructures, never conventional small spacecraft/stations`,
    `- Effective design scale: ${identity.scaleClass}; ${identity.effectiveDimensions}`,
    `- Population band: ${identity.populationBand}`,
    `- Topology: ${identity.topology}`,
    `- Primary axis / organization: ${identity.primaryAxis}`,
    `- Symmetry: ${identity.symmetry}`,
    `- Silhouette family: ${identity.silhouetteFamily}`,
    `- Major massing: ${identity.massing}`,
    `- Signature structures: ${identity.signatureStructures.join("; ")}`,
    `- Structural zones: ${identity.interiorZones.join("; ")}`,
    `- Circulation logic: ${identity.circulationLogic}`,
    `- Faction design grammar: ${identity.factionDesignGrammar}`,
    `- Material language: ${identity.materialLanguage}`,
    `- Military design logic: ${identity.militaryLogic}`,
    `- Axiolith structural role: ${identity.axiolithRole}`,
    `- System-art identity: ${identity.visualCanonNotes}`,
    `- Must preserve: ${identity.mustPreserve.join("; ")}`,
    `- Prohibited misreadings: ${identity.prohibitedMisreadings.join("; ")}`,
  ];
}
