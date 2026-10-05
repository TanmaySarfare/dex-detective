// Mystery Pokémon: find the hidden Pokémon in 8 guesses using comparison clues.
import { compareGuess, dailyAnswer, dateKey, randomItem, shareText, pad4, TYPE_COLORS, MYSTERY_MAX_GUESSES } from '../logic.js';
import { $, escapeHTML, toast, revealCard, copyText, prefersReducedMotion } from '../dom.js';
import { storage } from '../storage.js';
import { createPicker } from '../picker.js';

const SPOKEN = { hit: 'match', near: 'close', miss: 'not close' };

function tileHTML(cell, i) {
  let body;
  if (cell.type !== undefined) {
    body = cell.type ? `<span class="chip" style="--tc:${TYPE_COLORS[cell.type]}"></span>${cell.type}` : 'None';
  } else {
    body = cell.display + (cell.direction ? `<span aria-hidden="true">${cell.direction === 'up' ? '▲' : '▼'}</span>` : '');
  }
  const spoken = `${cell.label}: ${SPOKEN[cell.status]}` +
    (cell.direction ? `, the answer is ${cell.direction === 'up' ? 'higher' : 'lower'}` : '');
  // .tl is the small label shown on phones, where the table header is hidden.
  return `<td><div class="tile ${cell.status}" style="--d:${i}"><span class="tl" aria-hidden="true">${cell.label}</span>` +
    `<span class="tv">${body}</span><span class="sr">${spoken}</span></div></td>`;
}

export function createMystery({ all, getPool }) {
  const byDex = new Map(all.map(p => [p.n, p]));
  const state = { mode: 'daily', answer: null, guesses: [], over: false, day: '' };
  const el = {
    input: $('#mInput'), list: $('#mList'), go: $('#mGo'), body: $('#mBody'), status: $('#mStatus'),
    result: $('#mResult'), daily: $('#mDaily'), practice: $('#mPractice')
  };
  const picker = createPicker(el.input, el.list, () => (state.mode === 'daily' ? all : getPool()), guess, () => all);

  function setLocked(locked) {
    el.input.disabled = locked;
    el.go.disabled = locked;
  }

  function updateStatus() {
    const left = MYSTERY_MAX_GUESSES - state.guesses.length;
    el.status.textContent = state.over ? '' : `${left} ${left === 1 ? 'guess' : 'guesses'} left`;
  }

  function addRow(p, animate) {
    $('#mEmpty')?.remove();
    const tr = document.createElement('tr');
    if (animate && !prefersReducedMotion()) tr.className = 'new';
    tr.innerHTML = `<th scope="row"><span class="gname">${escapeHTML(p.name)}</span><span class="gnum">#${pad4(p.n)}</span></th>` +
      compareGuess(p, state.answer).map(tileHTML).join('');
    el.body.prepend(tr);
  }

  function start(mode) {
    Object.assign(state, { mode, guesses: [], over: false });
    el.daily.setAttribute('aria-pressed', String(mode === 'daily'));
    el.practice.setAttribute('aria-pressed', String(mode === 'practice'));
    el.body.innerHTML = '<tr id="mEmpty"><td colspan="7" class="empty">Type a Pokémon’s name above to make your first guess.</td></tr>';
    el.result.hidden = true;
    setLocked(false);
    if (mode === 'daily') {
      state.day = dateKey();
      state.answer = dailyAnswer(all, state.day);
      // Restore today's guesses so reloading the page doesn't lose progress.
      for (const n of storage.get('dd-daily:' + state.day, [])) {
        const p = byDex.get(n);
        if (!p || state.over) continue;
        state.guesses.push(p);
        addRow(p, false);
        checkForEnd();
      }
    } else {
      state.answer = randomItem(getPool());
    }
    updateStatus();
  }

  function checkForEnd() {
    const last = state.guesses[state.guesses.length - 1];
    if (last.n === state.answer.n) finish(true);
    else if (state.guesses.length >= MYSTERY_MAX_GUESSES) finish(false);
  }

  function guess(p) {
    if (state.over) return;
    if (state.guesses.some(g => g.n === p.n)) {
      toast(`You already guessed ${p.name}. Try a different Pokémon.`);
      return;
    }
    state.guesses.push(p);
    addRow(p, true);
    if (state.mode === 'daily') storage.set('dd-daily:' + state.day, state.guesses.map(g => g.n));
    checkForEnd();
    updateStatus();
  }

  function finish(solved) {
    state.over = true;
    setLocked(true);
    const n = state.guesses.length;
    const daily = state.mode === 'daily';
    el.result.innerHTML = `<h3>${solved ? `Solved in ${n} ${n === 1 ? 'guess' : 'guesses'}` : 'Out of guesses'}</h3>${revealCard(state.answer)}
      <div class="actions">
        <button class="btn" type="button" id="mShare">Copy result</button>
        <button class="btn ghost" type="button" id="mMore">${daily ? 'Play a practice round' : 'New mystery'}</button>
        ${daily ? '<p class="note">A new daily mystery arrives at midnight.</p>' : ''}
      </div>`;
    el.result.hidden = false;
    $('#mShare').addEventListener('click', () => copyText(shareText({
      label: daily ? state.day : 'practice', guesses: state.guesses, answer: state.answer, solved
    })));
    $('#mMore').addEventListener('click', () => { start('practice'); el.input.focus(); });
    updateStatus();
  }

  el.go.addEventListener('click', () => picker.submit());
  el.daily.addEventListener('click', () => start('daily'));
  el.practice.addEventListener('click', () => start('practice'));

  return {
    state,
    start,
    onPoolChange() { if (state.mode === 'practice') start('practice'); }
  };
}
