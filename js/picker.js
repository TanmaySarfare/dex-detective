// Text box with a suggestion list for picking a Pokémon by name.
import { searchPokemon, normalizeName, pad4 } from './logic.js';
import { escapeHTML, toast } from './dom.js';

export function createPicker(input, list, getPool, onPick, getAll) {
  let items = [];
  let active = -1;

  function render() {
    list.innerHTML = items.map((p, i) => (
      `<li role="option" id="${list.id}-o${i}" aria-selected="${i === active}" class="${i === active ? 'on' : ''}" data-i="${i}">` +
      `<span>${escapeHTML(p.name)}</span><span class="opt-meta">#${pad4(p.n)}</span></li>`
    )).join('');
    const open = items.length > 0 && document.activeElement === input;
    list.hidden = !open;
    input.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open && active >= 0) {
      input.setAttribute('aria-activedescendant', `${list.id}-o${active}`);
      list.children[active]?.scrollIntoView({ block: 'nearest' });
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  }

  function update() {
    items = searchPokemon(getPool(), input.value);
    active = items.length ? 0 : -1;
    render();
  }

  function choose(p) {
    input.value = '';
    items = [];
    active = -1;
    render();
    onPick(p);
  }

  function submit() {
    const q = normalizeName(input.value);
    if (!q) { toast('Type a Pokémon name first.'); input.focus(); return; }
    if (active >= 0 && items[active]) return choose(items[active]);
    const exact = getAll().find(p => p.key === q);
    if (exact) return choose(exact);
    const matches = searchPokemon(getPool(), input.value, Infinity);
    if (matches.length === 1) return choose(matches[0]);
    if (matches.length) {
      toast(`Several Pokémon match "${input.value}". Pick one from the list.`);
      input.focus();
      update();
      return;
    }
    toast(`No Pokémon is called "${input.value}". Check the spelling.`);
  }

  input.addEventListener('input', update);
  input.addEventListener('focus', render);
  input.addEventListener('blur', () => setTimeout(() => {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
  }, 100));
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!items.length) return;
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      render();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    } else if (e.key === 'Escape') {
      items = [];
      active = -1;
      render();
    }
  });
  // pointerdown + preventDefault keeps focus in the text box, so the list doesn't close mid-tap.
  list.addEventListener('pointerdown', e => {
    const li = e.target.closest('li');
    if (!li) return;
    e.preventDefault();
    choose(items[Number(li.dataset.i)]);
  });

  return { submit };
}
