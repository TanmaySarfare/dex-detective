// Higher or Lower: does the second Pokémon have a higher or lower stat? Keep the streak going.
import { HL_STATS, randomItem, isHigherLowerCorrect, oneDecimal, pad4 } from '../logic.js';
import { $, escapeHTML, typeBadge, prefersReducedMotion } from '../dom.js';
import { storage } from '../storage.js';

const valueText = (p, stat) => (stat.unit ? oneDecimal(p[stat.key]) : String(p[stat.key]));
const valueHTML = (p, stat) => `<span class="num">${valueText(p, stat)}</span>${stat.unit ? `<span class="unit">${stat.unit}</span>` : ''}`;
const capitalize = s => s[0].toUpperCase() + s.slice(1);

export function createHigherLower({ getPool }) {
  const state = { a: null, b: null, stat: null, streak: 0, best: storage.get('dd-hilo-best', 0), busy: false, over: false, game: 0 };
  const el = {
    panel: $('#hilo'), question: $('#hQ'), a: $('#hA'), b: $('#hB'), up: $('#hUp'), down: $('#hDown'),
    streak: $('#hStreak'), best: $('#hBest'), over: $('#hOver')
  };

  function card(p, showValue) {
    return `<p class="cnum">#${pad4(p.n)}</p><p class="cname">${escapeHTML(p.name)}</p><div>${typeBadge(p.t1)}${typeBadge(p.t2)}</div>
      <p class="cval">${showValue ? valueHTML(p, state.stat) : '<span class="num q">?</span>'}</p>
      <p class="clabel">${capitalize(state.stat.label)}</p>`;
  }

  function render() {
    el.question.innerHTML = `Does <b>${escapeHTML(state.b.name)}</b> have a higher or lower ${state.stat.label} than <b>${escapeHTML(state.a.name)}</b>?`;
    el.a.innerHTML = card(state.a, true);
    el.b.className = 'card';
    el.b.innerHTML = card(state.b, false);
    el.streak.textContent = state.streak;
    el.best.textContent = state.best;
    el.up.disabled = false;
    el.down.disabled = false;
  }

  function nextRound() {
    const pool = getPool();
    if (pool.length < 2) return;
    let b;
    do { b = randomItem(pool); } while (b.n === state.a.n);
    Object.assign(state, { b, stat: randomItem(HL_STATS), busy: false });
    render();
  }

  function newGame() {
    Object.assign(state, { streak: 0, over: false, a: randomItem(getPool()), game: state.game + 1 });
    el.over.hidden = true;
    nextRound();
  }

  function answer(guessedHigher) {
    if (state.busy || state.over || !state.b) return;
    state.busy = true;
    el.up.disabled = true;
    el.down.disabled = true;
    const { a, b, stat, game } = state;
    const correct = isHigherLowerCorrect(a, b, stat.key, guessedHigher);
    el.b.querySelector('.cval').innerHTML = valueHTML(b, stat);
    el.b.classList.add(correct ? 'right' : 'wrong');

    if (correct) {
      state.streak++;
      if (state.streak > state.best) {
        state.best = state.streak;
        storage.set('dd-hilo-best', state.best);
      }
      el.streak.textContent = state.streak;
      el.best.textContent = state.best;
      setTimeout(() => {
        if (game !== state.game) return; // a new game started while we were waiting
        state.a = state.b;
        nextRound();
      }, prefersReducedMotion() ? 700 : 1100);
    } else {
      state.over = true;
      const unit = stat.unit ? ' ' + stat.unit : '';
      el.over.innerHTML = `<h3>Streak over at ${state.streak}</h3>
        <p>${escapeHTML(b.name)} has a ${b[stat.key] > a[stat.key] ? 'higher' : 'lower'} ${stat.label} (${valueText(b, stat)}${unit}) than ${escapeHTML(a.name)} (${valueText(a, stat)}${unit}).</p>
        <div class="actions"><button class="btn" type="button" id="hAgain">Play again</button></div>`;
      el.over.hidden = false;
      $('#hAgain').addEventListener('click', () => { newGame(); el.up.focus(); });
    }
  }

  el.up.addEventListener('click', () => answer(true));
  el.down.addEventListener('click', () => answer(false));
  document.addEventListener('keydown', e => {
    if (el.panel.hidden || e.altKey || e.ctrlKey || e.metaKey) return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (e.key === 'ArrowUp') { e.preventDefault(); answer(true); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); answer(false); }
  });

  return {
    state,
    ensureStarted() { if (!state.a) newGame(); },
    onPoolChange() { if (state.a) newGame(); }
  };
}
