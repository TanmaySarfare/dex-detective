// Run with: npm test   (uses Node's built-in test runner, no installs needed)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TYPES, decodeDex, normalizeName, searchPokemon, compareGuess, dailyAnswer, shareText,
  shadowClues, sameStats, isHigherLowerCorrect, hashString, mulberry32
} from '../js/logic.js';

const dex = decodeDex(JSON.parse(readFileSync(new URL('../data/pokemon.json', import.meta.url), 'utf8')));
const get = name => {
  const p = dex.find(x => x.name === name);
  assert.ok(p, `${name} is in the data`);
  return p;
};

test('the data has all 1,025 Pokémon, numbered in order', () => {
  assert.equal(dex.length, 1025);
  dex.forEach((p, i) => assert.equal(p.n, i + 1));
});

test('names are unique', () => {
  assert.equal(new Set(dex.map(p => p.name)).size, dex.length);
});

test('every Pokémon has valid types and a matching base stat total', () => {
  for (const p of dex) {
    assert.ok(TYPES.includes(p.t1), `${p.name} type 1`);
    assert.ok(p.t2 === '' || (TYPES.includes(p.t2) && p.t2 !== p.t1), `${p.name} type 2`);
    assert.equal(p.hp + p.atk + p.def + p.spa + p.spd + p.spe, p.bst, `${p.name} total`);
    assert.ok(p.gen >= 1 && p.gen <= 9, `${p.name} generation`);
  }
});

test('names are normalized for searching', () => {
  assert.equal(normalizeName('Nidoran♀'), 'nidoranf');
  assert.equal(normalizeName('Flabébé'), 'flabebe');
  assert.equal(normalizeName("Farfetch'd"), 'farfetchd');
  assert.equal(normalizeName('Type: Null'), 'typenull');
  assert.equal(normalizeName('  MR. MIME '), 'mrmime');
});

test('search lists names that start with the query first', () => {
  const results = searchPokemon(dex, 'char');
  assert.equal(results[0].name, 'Charmander');
  assert.ok(results.length <= 8);
  const startCount = results.filter(p => p.key.startsWith('char')).length;
  assert.ok(results.slice(0, startCount).every(p => p.key.startsWith('char')));
  assert.deepEqual(searchPokemon(dex, ''), []);
});

test('guessing the answer makes every clue an exact match', () => {
  const p = get('Charizard');
  assert.ok(compareGuess(p, p).every(c => c.status === 'hit' && !c.direction));
});

test('arrows point toward the answer', () => {
  const cells = Object.fromEntries(compareGuess(get('Pikachu'), get('Raichu')).map(c => [c.field, c]));
  assert.equal(cells.gen.status, 'hit');
  assert.equal(cells.h.direction, 'up');
  assert.equal(cells.w.direction, 'up');
  assert.equal(cells.bst.direction, 'up');
  const reverse = Object.fromEntries(compareGuess(get('Raichu'), get('Pikachu')).map(c => [c.field, c]));
  assert.equal(reverse.bst.direction, 'down');
});

test('the right type in the other slot counts as close', () => {
  // Tornadus is pure Flying; Charizard is Fire/Flying.
  const cells = compareGuess(get('Tornadus'), get('Charizard'));
  assert.equal(cells[1].status, 'near');
  assert.equal(cells[2].status, 'miss');
});

test('numbers within range are marked close', () => {
  // Charmander (309) vs Bulbasaur (318): base totals within 40 of each other.
  const sameGen = Object.fromEntries(compareGuess(get('Charmander'), get('Bulbasaur')).map(c => [c.field, c]));
  assert.equal(sameGen.gen.status, 'hit');
  assert.equal(sameGen.bst.status, 'near');
  // Chikorita is one generation after Bulbasaur.
  const nextGen = Object.fromEntries(compareGuess(get('Chikorita'), get('Bulbasaur')).map(c => [c.field, c]));
  assert.equal(nextGen.gen.status, 'near');
  assert.equal(nextGen.gen.direction, 'down');
  // Ivysaur (405) vs Venusaur (525) is too far apart.
  const far = Object.fromEntries(compareGuess(get('Ivysaur'), get('Venusaur')).map(c => [c.field, c]));
  assert.equal(far.bst.status, 'miss');
});

test('the daily answer is fixed for a date and varies between dates', () => {
  assert.equal(dailyAnswer(dex, '2026-10-04').n, dailyAnswer(dex, '2026-10-04').n);
  const week = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07'];
  assert.ok(new Set(week.map(d => dailyAnswer(dex, d).n)).size > 1);
});

test('the seeded random generator is repeatable', () => {
  const a = mulberry32(hashString('seed'));
  const b = mulberry32(hashString('seed'));
  for (let i = 0; i < 5; i++) {
    const x = a();
    assert.equal(x, b());
    assert.ok(x >= 0 && x < 1);
  }
});

test('the share text has one emoji row per guess', () => {
  const answer = get('Charizard');
  const text = shareText({ label: 'practice', guesses: [get('Pikachu'), answer], answer, solved: true });
  const lines = text.split('\n');
  assert.equal(lines[0], 'Dex Detective practice 2/8');
  assert.equal(lines[2], '🟩🟩🟩🟩🟩🟩');
});

test('Stat Shadow has six clues, starting with the base stat total', () => {
  const clues = shadowClues(get('Garchomp'));
  assert.equal(clues.length, 6);
  assert.match(clues[0].text, /600/);
  assert.deepEqual(clues[2].types, ['Dragon', 'Ground']);
});

test('Pokémon with identical stats are detected', () => {
  assert.ok(sameStats(get('Pansage'), get('Pansear')));
  assert.ok(!sameStats(get('Pikachu'), get('Raichu')));
});

test('Higher or Lower counts ties as correct', () => {
  const a = get('Charmeleon');
  const b = get('Ivysaur'); // same base stat total
  assert.ok(isHigherLowerCorrect(a, b, 'bst', true));
  assert.ok(isHigherLowerCorrect(a, b, 'bst', false));
  assert.ok(isHigherLowerCorrect(get('Pikachu'), get('Raichu'), 'spe', true));
  assert.ok(!isHigherLowerCorrect(get('Pikachu'), get('Raichu'), 'spe', false));
});
