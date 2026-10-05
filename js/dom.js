// Small helpers for building and updating the page.
import { TYPE_COLORS, REGIONS, STAT_ORDER, pad4, oneDecimal, textColorFor } from './logic.js';

export const $ = (selector, root = document) => root.querySelector(selector);

export const escapeHTML = s => String(s).replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

export const prefersReducedMotion = () =>
  !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

let toastTimer;
export function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

export function typeBadge(type) {
  if (!type) return '';
  const color = TYPE_COLORS[type];
  return `<span class="type" style="--tc:${color};--tt:${textColorFor(color)}">${type}</span>`;
}

/** The answer card shown when a round ends. */
export function revealCard(p) {
  const stats = STAT_ORDER.map(([k, label]) => `<div><dt>${label}</dt><dd>${p[k]}</dd></div>`).join('');
  return `<div class="reveal">
    <div class="reveal-head"><span class="rnum">#${pad4(p.n)}</span><span class="rname">${escapeHTML(p.name)}</span></div>
    <p class="rcat">The ${escapeHTML(p.cat)}, first seen in Gen ${p.gen} (${REGIONS[p.gen - 1]}). ${oneDecimal(p.h)} m tall, ${oneDecimal(p.w)} kg.</p>
    <div>${typeBadge(p.t1)}${typeBadge(p.t2)}</div>
    <dl class="rstats">${stats}<div><dt>Total</dt><dd>${p.bst}</dd></div></dl>
  </div>`;
}

export async function copyText(text) {
  const done = 'Result copied. Paste it anywhere to share.';
  try {
    await navigator.clipboard.writeText(text);
    toast(done);
    return;
  } catch {
    // Fall back to the older copy command below.
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  ta.remove();
  toast(ok ? done : 'Copying is blocked on this page. Take a screenshot to share instead.');
}

/** Pixel-art magnifying glass next to the title. */
export function drawMagnifier(svg) {
  const ring = [[3,0],[4,0],[5,0],[6,0],[2,1],[7,1],[1,2],[8,2],[1,3],[8,3],[1,4],[8,4],[1,5],[8,5],[2,6],[7,6],
    [3,7],[4,7],[5,7],[6,7],[7,7],[8,8],[9,8],[9,9],[10,9],[10,10],[11,10],[11,11],[10,11]];
  const glint = [[3,2],[4,2],[3,3]];
  const px = (cells, attr) => cells.map(([x, y]) => `<rect x="${x}" y="${y}" width="1" height="1" ${attr}/>`).join('');
  svg.innerHTML = px(ring, 'fill="currentColor"') + px(glint, 'style="fill:var(--accent)"');
}
