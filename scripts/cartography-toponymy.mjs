const SYSTEM_PROFILE = Object.freeze({
  Abydos: "vadan",
  Tanis: "vostrann", Saqqara: "vostrann", Iunu: "vostrann",
  Memphis: "aurethic", Nekhen: "aurethic",
  Thebes: "xuanhari", Sais: "xuanhari", Seti: "xuanhari",
  Amarna: "union",
});

const PROFILES = Object.freeze({
  aurethic: {
    language: "Aurethic", basis: "Hebrew + Koine/Byzantine Greek + Latin; liturgical and formal",
    roots: ["Aure", "Beth", "Qad", "Seraph", "Melek", "Hier", "Kedem", "Or", "Thal", "Via", "Eli", "Theon", "Galil", "Aster", "Kyri"],
    endings: ["ion", "ara", "eth", "on", "eus", "ia", "em", "or", "ath", "a", "ikon", "iel"],
    terms: { capital: "Metropolis", city: "Polis", port: "Limen", ocean: "Thalassa", sea: "Pelagos", river: "Potamos", lake: "Limne", mountain: "Oros", range: "Oroseira", continent: "Chora", island: "Nesos", desert: "Midbar", forest: "Alsos", wetland: "Helos", glacier: "Krystallos", strait: "Pylai", road: "Via", landmark: "Semeion" },
    order: "term-first",
  },
  vostrann: {
    language: "Vostrann", basis: "Scots/Scottish Gaelic + Russian/East Slavic; maritime fleet-creole",
    roots: ["Brae", "Dun", "Cairn", "Muir", "Skel", "Glen", "Kras", "Nov", "Moroz", "Voln", "Sev", "Rann", "Kilm", "Thenn", "Vosk", "Black", "Gannet"],
    endings: ["grad", "sk", "ova", "ach", "muir", "brae", "holm", "gor", "in", "aya", "ovo", "reach"],
    terms: { capital: "Stolgrad", city: "Grad", port: "Gavan", ocean: "Muir", sea: "More", river: "Reka", lake: "Loch", mountain: "Gora", range: "Gory", continent: "Krai", island: "Ostrov", desert: "Pustosh", forest: "Les", wetland: "Boloto", glacier: "Lednik", strait: "Proliv", road: "Trakt", landmark: "Znak" },
    order: "root-first",
  },
  xuanhari: {
    language: "Xuānhari", basis: "Mandarin/Sinitic + Sanskrit/Hindustani/Indo-Aryan; courtly, bureaucratic and martial",
    roots: ["Tian", "Qing", "Long", "Shan", "Jin", "Yu", "Ling", "Xuan", "Varun", "Chandra", "Rudra", "Kailash", "Nava", "Mei", "Saras", "Jyoti", "Yue"],
    endings: ["vara", "pur", "nagar", "hai", "shan", "he", "nadi", "garh", "vana", "ling", "dao", "yuan"],
    terms: { capital: "Jing", city: "Cheng", port: "Gang", ocean: "Maha Hai", sea: "Hai", river: "He", lake: "Hu", mountain: "Shan", range: "Shanmai", continent: "Dazhou", island: "Dao", desert: "Shamo", forest: "Lin", wetland: "Daldal", glacier: "Binghe", strait: "Guan", road: "Dadao", landmark: "Stambh" },
    order: "root-first",
  },
  vadan: {
    language: "Vadan", basis: "Colonial/Union-descended mixed local language with established Earth-derived place-name latitude",
    roots: ["Vada", "Ramses", "Kandar", "Thraxi", "Eilean", "Volna", "Orison", "Mariner", "Caldera", "Aster", "Nacre", "Sundown", "Pelagic", "Vesper", "Halcyon", "Tide"],
    endings: ["reach", "fall", "haven", "mere", "sound", "ward", "strand", "deep", "rise", "gate", "light", "run"],
    terms: { capital: "Crown", city: "Haven", port: "Anchorage", ocean: "Deep", sea: "Sea", river: "Flow", lake: "Mere", mountain: "Crest", range: "Rampart", continent: "Reach", island: "Cay", desert: "Waste", forest: "Green", wetland: "Wash", glacier: "Ice", strait: "Passage", road: "Way", landmark: "Beacon" },
    order: "root-first",
  },
  union: {
    language: "Union cosmopolitan", basis: "Cosmopolitan Earth cultural, historical and geographic inheritance",
    roots: ["Magellan", "Okavango", "Altai", "Atacama", "Orinoco", "Tasman", "Himalaya", "Danube", "Atlas", "Amazon", "Patagonia", "Karakoram", "Yukon", "Sahara", "Mekong", "Andes", "Baltic", "Caspian", "Nile", "Ganges", "Cordillera", "Serengeti"],
    endings: ["Nova", "Prime", "Reach", "Crown", "March", "Haven", "Arc", "Rise", "Gate", "Verde", "Austral", "Boreal"],
    terms: { capital: "Capital", city: "City", port: "Port", ocean: "Ocean", sea: "Sea", river: "River", lake: "Lake", mountain: "Mount", range: "Range", continent: "Terra", island: "Island", desert: "Desert", forest: "Forest", wetland: "Wetlands", glacier: "Glacier", strait: "Strait", road: "Corridor", landmark: "Monument" },
    order: "term-first",
  },
});

function hash(text) { let value = 2166136261; for (const char of String(text)) value = Math.imul(value ^ char.charCodeAt(0), 16777619); return value >>> 0; }
function titleCase(value) { return value.replace(/\b\p{L}/gu, (char) => char.toUpperCase()); }

export function namingProfileForSystem(system) {
  const id = SYSTEM_PROFILE[system]; if (!id) throw new RangeError(`No cartographic naming profile for ${system}`);
  return { id, ...PROFILES[id] };
}

export function generateToponym({ system, world, seed, featureClass, ordinal = 0, nonce = 0 }) {
  const profile = namingProfileForSystem(system), term = profile.terms[featureClass];
  if (!term) throw new RangeError(`Unsupported named feature class: ${featureClass}`);
  const identity = `${seed}/${system}/${world}/${featureClass}/${ordinal}/${nonce}`;
  const root = profile.roots[hash(`${identity}/root`) % profile.roots.length];
  const ending = profile.endings[hash(`${identity}/ending`) % profile.endings.length];
  const fused = titleCase(`${root}${root.toLowerCase().endsWith(ending[0].toLowerCase()) ? ending.slice(1) : ending}`);
  const properName = profile.order === "term-first" ? `${term} ${fused}` : `${fused} ${term}`;
  return { properName, language: profile.language, profile: profile.id, featureClass, namingBasis: profile.basis, generatedFrom: { system, world, seed, ordinal, nonce } };
}

export function assignFeatureNames({ system, world, seed, features }) {
  const used = new Set();
  return features.map((feature, ordinal) => {
    let nonce = 0, name;
    do { name = generateToponym({ system, world, seed, featureClass: feature.featureClass, ordinal, nonce }); nonce += 1; }
    while (used.has(name.properName));
    used.add(name.properName); return { ...feature, ...name };
  });
}

export const CARTOGRAPHIC_NAMING_PROFILES = PROFILES;
