// Pure game logic. Nothing in this file touches the page, so it can be
// unit-tested with Node (see tests/logic.test.js).

export const REGIONS = ['Kanto', 'Johto', 'Hoenn', 'Sinnoh', 'Unova', 'Kalos', 'Alola', 'Galar', 'Paldea'];

export const TYPE_COLORS = {
  Normal: '#A8A77A', Fire: '#EE8130', Water: '#6390F0', Electric: '#F7D02C', Grass: '#7AC74C',
  Ice: '#96D9D6', Fighting: '#C22E28', Poison: '#A33EA1', Ground: '#E2BF65', Flying: '#A98FF3',
  Psychic: '#F95587', Bug: '#A6B91A', Rock: '#B6A136', Ghost: '#735797', Dragon: '#6F35FC',
  Dark: '#705746', Steel: '#B7B7CE', Fairy: '#D685AD'
};
export const TYPES = Object.keys(TYPE_COLORS);

// Order used on summary cards, and the clockwise order used on the stat chart.
export const STAT_ORDER = [['hp', 'HP'], ['atk', 'Attack'], ['def', 'Defense'], ['spa', 'Sp. Atk'], ['spd', 'Sp. Def'], ['spe', 'Speed']];
export const RADAR_ORDER = [['hp', 'HP'], ['atk', 'Attack'], ['def', 'Defense'], ['spe', 'Speed'], ['spd', 'Sp. Def'], ['spa', 'Sp. Atk']];

export const MYSTERY_MAX_GUESSES = 8;
export const SHADOW_MAX_GUESSES = 6;

export const HL_STATS = [
  { key: 'bst', label: 'base stat total', unit: '' },
  { key: 'hp', label: 'HP', unit: '' },
  { key: 'atk', label: 'Attack', unit: '' },
  { key: 'def', label: 'Defense', unit: '' },
  { key: 'spa', label: 'Sp. Atk', unit: '' },
  { key: 'spd', label: 'Sp. Def', unit: '' },
  { key: 'spe', label: 'Speed', unit: '' },
  { key: 'h', label: 'height', unit: 'm' },
  { key: 'w', label: 'weight', unit: 'kg' }
];

// Field names in data/pokemon.json -> short keys used in the code.
const FIELD_KEYS = {
  dex: 'n', name: 'name', generation: 'gen', category: 'cat', type1: 't1', type2: 't2',
  hp: 'hp', attack: 'atk', defense: 'def', spAtk: 'spa', spDef: 'spd', speed: 'spe',
  total: 'bst', heightM: 'h', weightKg: 'w'
};

/** Lower-case, accent-free, letters and digits only: "Nidoran♀" -> "nidoranf", "Flabébé" -> "flabebe". */
export function normalizeName(name) {
  return String(name)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/♀/g, 'f').replace(/♂/g, 'm')
    .toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Turn the compact { fields, rows } JSON into one object per Pokémon. */
export function decodeDex(json) {
  const keys = json.fields.map(f => {
    const k = FIELD_KEYS[f];
    if (!k) throw new Error(`Unknown field "${f}" in pokemon.json`);
    return k;
  });
  return json.rows.map(row => {
    const p = {};
    keys.forEach((k, i) => { p[k] = row[i]; });
    p.t2 = p.t2 || '';
    p.key = normalizeName(p.name);
    return p;
  });
}

export const pad4 = n => String(n).padStart(4, '0');
export const oneDecimal = x => (Math.round(x * 10) / 10).toFixed(1);

/** FNV-1a string hash, used to seed the daily puzzle. */
export function hashString(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

/** Small seeded random number generator (returns numbers in [0, 1)). */
export function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Local calendar date as YYYY-MM-DD. */
export function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Everyone gets the same daily mystery because the answer is seeded by the date. */
export function dailyAnswer(all, key) {
  const rnd = mulberry32(hashString('dex-detective:' + key));
  return all[Math.floor(rnd() * all.length)];
}

export function randomItem(list, rnd = Math.random) {
  return list[Math.floor(rnd() * list.length)];
}

/** Names that start with the query come first, then names that contain it. */
export function searchPokemon(pool, query, limit = 8) {
  const q = normalizeName(query);
  if (!q) return [];
  const starts = [];
  const contains = [];
  for (const p of pool) {
    const i = p.key.indexOf(q);
    if (i === 0) starts.push(p);
    else if (i > 0) contains.push(p);
  }
  return starts.concat(contains).slice(0, limit);
}

// What counts as "close" (yellow) for number clues.
const CLOSE = {
  gen: (g, a) => Math.abs(g - a) === 1,
  size: (g, a) => Math.abs(g - a) <= a * 0.2,
  bst: (g, a) => Math.abs(g - a) <= 40
};

function numberCell(field, label, guessValue, answerValue, isClose, display) {
  return {
    field, label, display,
    status: guessValue === answerValue ? 'hit' : (isClose(guessValue, answerValue) ? 'near' : 'miss'),
    direction: guessValue === answerValue ? '' : (answerValue > guessValue ? 'up' : 'down')
  };
}

/**
 * Compare a guess with the answer, one cell per clue.
 * status: 'hit' (exact), 'near' (close, or right type in the other slot), 'miss'.
 * direction: 'up' if the answer's number is higher, 'down' if lower.
 */
export function compareGuess(guess, answer) {
  return [
    numberCell('gen', 'Generation', guess.gen, answer.gen, CLOSE.gen, String(guess.gen)),
    {
      field: 't1', label: 'Type 1', type: guess.t1,
      status: guess.t1 === answer.t1 ? 'hit' : (guess.t1 === answer.t2 ? 'near' : 'miss')
    },
    {
      field: 't2', label: 'Type 2', type: guess.t2,
      status: guess.t2 === answer.t2 ? 'hit' : (guess.t2 && guess.t2 === answer.t1 ? 'near' : 'miss')
    },
    numberCell('h', 'Height', guess.h, answer.h, CLOSE.size, `${oneDecimal(guess.h)} m`),
    numberCell('w', 'Weight', guess.w, answer.w, CLOSE.size, `${oneDecimal(guess.w)} kg`),
    numberCell('bst', 'Base total', guess.bst, answer.bst, CLOSE.bst, String(guess.bst))
  ];
}

/** Emoji summary of a Mystery Pokémon game, for sharing. */
export function shareText({ label, guesses, answer, solved }) {
  const squares = { hit: '🟩', near: '🟨', miss: '⬛' };
  const head = `Dex Detective ${label} ${solved ? guesses.length : 'X'}/${MYSTERY_MAX_GUESSES}`;
  const rows = guesses.map(g => compareGuess(g, answer).map(c => squares[c.status]).join(''));
  return [head, ...rows].join('\n');
}

/** Stat Shadow clues, in the order they unlock. */
export function shadowClues(a) {
  return [
    { text: `Base stat total of ${a.bst}` },
    { text: `First appeared in Gen ${a.gen} (${REGIONS[a.gen - 1]})` },
    { text: 'Type:', types: [a.t1, a.t2].filter(Boolean) },
    { text: `${oneDecimal(a.h)} m tall and weighs ${oneDecimal(a.w)} kg` },
    { text: `Known as the ${a.cat}` },
    { text: `Name starts with “${a.name[0]}” and is ${a.name.length} characters long` }
  ];
}

export function sameStats(a, b) {
  return RADAR_ORDER.every(([k]) => a[k] === b[k]);
}

/** Ties count as correct. */
export function isHigherLowerCorrect(a, b, key, guessedHigher) {
  const va = a[key];
  const vb = b[key];
  return vb === va || (guessedHigher ? vb > va : vb < va);
}

/** Dark or light text, whichever reads better on a type colour. */
export function textColorFor(hex) {
  const v = parseInt(hex.slice(1), 16);
  const lum = 0.2126 * ((v >> 16) & 255) / 255 + 0.7152 * ((v >> 8) & 255) / 255 + 0.0722 * (v & 255) / 255;
  return lum > 0.55 ? '#1A1A1A' : '#FFFFFF';
}
