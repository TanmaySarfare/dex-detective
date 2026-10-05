// Stat Shadow: name the Pokémon from its base stat chart. Each miss unlocks a clue.
import { RADAR_ORDER, SHADOW_MAX_GUESSES, shadowClues, sameStats, randomItem } from '../logic.js';
import { $, escapeHTML, toast, typeBadge, revealCard } from '../dom.js';
import { storage } from '../storage.js';
import { createPicker } from '../picker.js';

// Stats above `max` reach the outer ring; keeping the scale at 160 makes typical shapes easy to read.
const CHART = { cx: 170, cy: 150, radius: 104, max: 160 };

function drawRadar(svg, answer, ghost) {
  const { cx, cy, radius, max } = CHART;
  const angle = i => (-90 + 60 * i) * Math.PI / 180;
  const point = (i, v) => {
    const r = Math.min(v, max) / max * radius;
    return [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))];
  };
  const points = valueOf => RADAR_ORDER.map(([k], i) => point(i, valueOf(k)).map(x => x.toFixed(1)).join(',')).join(' ');

  let s = '';
  for (const f of [0.25, 0.5, 0.75, 1]) s += `<polygon class="grid" points="${points(() => max * f)}"/>`;
  RADAR_ORDER.forEach((_, i) => {
    const [x, y] = point(i, max);
    s += `<line class="axis" x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`;
  });
  s += `<polygon class="shape" points="${points(k => answer[k])}"/>`;
  if (ghost) s += `<polygon class="ghost" points="${points(k => ghost[k])}"/>`;
  RADAR_ORDER.forEach(([k, label], i) => {
    const c = Math.cos(angle(i));
    const r = radius + 24;
    const x = cx + r * c;
    const y = cy + r * Math.sin(angle(i));
    const anchor = Math.abs(c) < 0.2 ? 'middle' : (c > 0 ? 'start' : 'end');
    const ly = Math.abs(c) < 0.2 ? (y < cy ? y - 12 : y + 4) : y - 4;
    s += `<text class="lab" x="${x.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${anchor}">${label}</text>` +
      `<text class="val" x="${x.toFixed(1)}" y="${(ly + 17).toFixed(1)}" text-anchor="${anchor}">${answer[k]}</text>`;
  });
  svg.innerHTML = s;
  svg.setAttribute('aria-label', 'Base stats of the mystery Pokémon: ' + RADAR_ORDER.map(([k, l]) => `${l} ${answer[k]}`).join(', '));
}

export function createShadow({ all, getPool }) {
  const state = { answer: null, guesses: [], over: false, streak: 0, best: storage.get('dd-shadow-best', 0) };
  const el = {
    input: $('#sInput'), list: $('#sList'), go: $('#sGo'), radar: $('#radar'), legend: $('#sLegendGuess'),
    clues: $('#sClues'), chips: $('#sChips'), status: $('#sStatus'), result: $('#sResult'),
    streak: $('#sStreak'), best: $('#sBest')
  };
  const picker = createPicker(el.input, el.list, getPool, guess, () => all);

  function render() {
    const a = state.answer;
    const last = state.guesses[state.guesses.length - 1];
    const showGhost = !state.over && last && last.n !== a.n;
    drawRadar(el.radar, a, showGhost ? last : null);
    el.legend.hidden = !showGhost;
    if (showGhost) el.legend.querySelector('b').textContent = last.name;

    const misses = state.guesses.filter(g => g.n !== a.n).length;
    const clues = shadowClues(a);
    const shown = state.over ? clues : clues.slice(0, 1 + misses);
    el.clues.innerHTML = shown.map(c => `<li>${escapeHTML(c.text)}${c.types ? ' ' + c.types.map(typeBadge).join('') : ''}</li>`).join('') +
      (!state.over && shown.length < clues.length ? '<li class="locked">Your next miss unlocks another clue.</li>' : '');
    el.chips.innerHTML = state.guesses.map(g => `<li class="${g.n === a.n ? 'ok' : 'no'}">${escapeHTML(g.name)}</li>`).join('');

    const left = SHADOW_MAX_GUESSES - state.guesses.length;
    el.status.textContent = state.over ? '' : `${left} ${left === 1 ? 'guess' : 'guesses'} left`;
    el.streak.textContent = state.streak;
    el.best.textContent = state.best;
  }

  function newRound() {
    Object.assign(state, { answer: randomItem(getPool()), guesses: [], over: false });
    el.result.hidden = true;
    el.input.disabled = false;
    el.go.disabled = false;
    render();
  }

  function guess(p) {
    if (state.over) return;
    if (state.guesses.some(g => g.n === p.n)) {
      toast(`You already guessed ${p.name}. Try a different Pokémon.`);
      return;
    }
    state.guesses.push(p);
    if (p.n === state.answer.n) return finish(true);
    if (state.guesses.length >= SHADOW_MAX_GUESSES) return finish(false);
    if (sameStats(p, state.answer)) toast(`${p.name} has exactly the same stats. Use the clues to tell them apart.`);
    render();
  }

  function finish(solved) {
    state.over = true;
    state.streak = solved ? state.streak + 1 : 0;
    if (state.streak > state.best) {
      state.best = state.streak;
      storage.set('dd-shadow-best', state.best);
    }
    el.input.disabled = true;
    el.go.disabled = true;
    const n = state.guesses.length;
    el.result.innerHTML = `<h3>${solved ? `Solved in ${n} ${n === 1 ? 'guess' : 'guesses'}` : 'Out of guesses'}</h3>${revealCard(state.answer)}
      <div class="actions"><button class="btn" type="button" id="sNext">Next Pokémon</button></div>`;
    el.result.hidden = false;
    $('#sNext').addEventListener('click', () => { newRound(); el.input.focus(); });
    render();
  }

  el.go.addEventListener('click', () => picker.submit());

  return {
    state,
    ensureStarted() { if (!state.answer) newRound(); },
    onPoolChange() { if (state.answer) newRound(); }
  };
}
