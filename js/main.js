// Entry point: load the data, then wire up the tabs, the generation filter and the three games.
import { decodeDex, REGIONS } from './logic.js';
import { $, toast, drawMagnifier } from './dom.js';
import { createMystery } from './games/mystery.js';
import { createShadow } from './games/shadow.js';
import { createHigherLower } from './games/hilo.js';

async function loadPokemon() {
  const res = await fetch('data/pokemon.json');
  if (!res.ok) throw new Error(`Could not load data/pokemon.json (HTTP ${res.status})`);
  return decodeDex(await res.json());
}

function setUpTabs(onShow) {
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const show = (id, focus = false) => {
    for (const t of tabs) {
      const on = t.dataset.tab === id;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.dataset.tab).hidden = !on;
      if (on && focus) t.focus();
    }
    onShow(id);
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => show(t.dataset.tab));
    t.addEventListener('keydown', e => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
      show(next.dataset.tab, true);
    });
  });
}

async function main() {
  drawMagnifier($('#mag'));
  let all;
  try {
    all = await loadPokemon();
  } catch (err) {
    console.error(err);
    $('#mStatus').textContent = 'The Pokémon data didn’t load. If you opened index.html straight from your computer, ' +
      'start a local web server instead (see the README).';
    return;
  }

  const genSelect = $('#genSel');
  const getPool = () => {
    const g = Number(genSelect.value);
    return g ? all.filter(p => p.gen === g) : all;
  };

  const mystery = createMystery({ all, getPool });
  const shadow = createShadow({ all, getPool });
  const hilo = createHigherLower({ getPool });

  setUpTabs(id => {
    if (id === 'shadow') shadow.ensureStarted();
    if (id === 'hilo') hilo.ensureStarted();
  });

  genSelect.addEventListener('change', () => {
    const g = Number(genSelect.value);
    toast(g
      ? `Now using the ${getPool().length} Pokémon from Gen ${g} (${REGIONS[g - 1]}).`
      : `Now using all ${all.length.toLocaleString('en-US')} Pokémon.`);
    mystery.onPoolChange();
    shadow.onPoolChange();
    hilo.onPoolChange();
  });

  mystery.start('daily');

  // Handy for poking around in the browser console.
  window.dexDetective = { all, mystery, shadow, hilo };
}

main();
