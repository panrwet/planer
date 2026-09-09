/* Umsortieren per Finger.
   iOS Safari kennt kein HTML5-Drag-and-Drop, deshalb ist das hier mit
   Pointer-Events gebaut: gedrückt halten hebt die Zeile an, Verschieben setzt
   einen Platzhalter, Loslassen meldet die neue Reihenfolge.

   Mit `nesting` kommt die zweite Achse dazu: nach rechts ziehen rückt die
   Zeile unter die darüberliegende ein, wie in Apple Erinnerungen. Ohne
   `nesting` wird nur vertikal sortiert. */

import { el, haptic, clamp } from './util.js';

export const INDENT = 26;   // px pro Verschachtelungsebene

let state = null;

/** Läuft gerade ein Ziehvorgang? (Damit ein Tipp danach nicht als Klick zählt.) */
export function isDragging() { return state !== null; }

/**
 * @param {HTMLElement} wrap    Das bewegte Element (trägt data-id und data-depth)
 * @param {HTMLElement} handle  Wo gedrückt gehalten wird (meist die Zeile selbst)
 * @param {object} opts
 * @param {HTMLElement} opts.host      Container mit den Geschwistern
 * @param {HTMLElement} opts.scroll    Scroll-Container fürs Mitscrollen am Rand
 * @param {boolean} [opts.nesting]     Einrücken erlauben
 * @param {number}  [opts.maxDepth]    Tiefste erlaubte Ebene
 * @param {string}  [opts.hint]        Hinweistext während des Ziehens
 * @param {string}  [opts.ignore]      Selektor für Bereiche, die nicht ziehen
 * @param {(order:{id:string,parent:string|null}[])=>void} opts.onDrop
 */
export function attachSortable(wrap, handle, opts) {
  let holdTimer = null;
  let startX = 0, startY = 0;
  let armed = false;

  const cancelHold = () => { clearTimeout(holdTimer); holdTimer = null; armed = false; };

  handle.addEventListener('pointerdown', (e) => {
    if (opts.ignore && e.target.closest(opts.ignore)) return;
    if (e.button !== undefined && e.button !== 0) return;
    armed = true;
    startX = e.clientX;
    startY = e.clientY;
    holdTimer = setTimeout(() => {
      if (!armed) return;
      haptic(20);
      begin(wrap, startX, startY, opts);
    }, 380);
  });

  handle.addEventListener('pointermove', (e) => {
    if (!armed || state) return;
    // Scrollen oder Wischen bricht das Anheben ab.
    if (Math.abs(e.clientX - startX) > 8 || Math.abs(e.clientY - startY) > 8) cancelHold();
  });
  handle.addEventListener('pointerup', cancelHold);
  handle.addEventListener('pointercancel', cancelHold);
  handle.addEventListener('contextmenu', (e) => { if (state) e.preventDefault(); });
}

function begin(wrap, startX, startY, opts) {
  const host = opts.host;
  const items = [...host.children];
  const index = items.indexOf(wrap);
  if (index < 0) return;

  const nesting = !!opts.nesting;
  const maxDepth = nesting ? (opts.maxDepth ?? 2) : 0;
  const ownDepth = Number(wrap.dataset.depth || 0);

  // Bei Verschachtelung wandern die Nachfahren mit: sie stehen direkt
  // darunter und sind tiefer eingerückt.
  const block = [wrap];
  if (nesting) {
    for (let i = index + 1; i < items.length; i++) {
      if (Number(items[i].dataset.depth || 0) <= ownDepth) break;
      block.push(items[i]);
    }
  }

  const rect = wrap.getBoundingClientRect();
  const gap = 8;
  const blockH = block.reduce((sum, n) => sum + n.getBoundingClientRect().height, 0)
    + (block.length - 1) * gap;

  // Der angehobene Block schwebt über der Liste …
  const ghost = el('div', { class: 'drag-ghost', style: `width:${rect.width}px` });
  for (const n of block) {
    // Im Ghost zählt nur die Einrückung *relativ* zum obersten Element,
    // sonst verrutscht der ganze Block seitlich.
    if (nesting) n.style.marginLeft = `${(Number(n.dataset.depth || 0) - ownDepth) * INDENT}px`;
    ghost.append(n);
  }
  ghost.firstElementChild?.querySelector('.row')?.classList.add('dragging');
  document.body.append(ghost);

  // … und hinterlässt einen Platzhalter.
  const placeholder = el('div', { class: 'drag-placeholder', style: `height:${blockH}px` });
  host.insertBefore(placeholder, items[index + block.length] || null);

  if (opts.hint) document.body.append(el('div', { class: 'drag-hint', text: opts.hint }));
  document.body.classList.add('is-dragging');

  state = {
    host, ghost, placeholder, block, opts, nesting, maxDepth, ownDepth,
    offsetX: startX - rect.left,
    offsetY: startY - rect.top,
    startX,
    lastX: startX, lastY: startY,
    depth: ownDepth,
    autoScroll: 0,
  };
  moveGhost(startX, startY);
  updateTarget();

  window.addEventListener('pointermove', onMove, { passive: false });
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  requestAnimationFrame(tickAutoScroll);
}

function moveGhost(x, y) {
  state.ghost.style.transform = `translate(${x - state.offsetX}px, ${y - state.offsetY}px)`;
}

function onMove(e) {
  if (!state) return;
  e.preventDefault();
  state.lastX = e.clientX;
  state.lastY = e.clientY;
  moveGhost(e.clientX, e.clientY);
  updateTarget();

  const sc = state.opts.scroll;
  if (!sc) return;
  const r = sc.getBoundingClientRect();
  const edge = 70;
  if (e.clientY < r.top + edge) state.autoScroll = -Math.ceil((r.top + edge - e.clientY) / 6);
  else if (e.clientY > r.bottom - edge) state.autoScroll = Math.ceil((e.clientY - (r.bottom - edge)) / 6);
  else state.autoScroll = 0;
}

function tickAutoScroll() {
  if (!state) return;
  if (state.autoScroll && state.opts.scroll) {
    state.opts.scroll.scrollTop += state.autoScroll;
    moveGhost(state.lastX, state.lastY);
    updateTarget();
  }
  requestAnimationFrame(tickAutoScroll);
}

/** Platzhalter an die Stelle unter dem Finger setzen; bei Verschachtelung
    zusätzlich die Ebene aus dem horizontalen Versatz bestimmen. */
function updateTarget() {
  const { host, placeholder, lastY, lastX, startX, nesting, maxDepth, ownDepth } = state;
  const siblings = [...host.children].filter(n => n !== placeholder);

  let before = null;
  for (const n of siblings) {
    const r = n.getBoundingClientRect();
    if (lastY < r.top + r.height / 2) { before = n; break; }
  }
  if (before !== placeholder.nextElementSibling) host.insertBefore(placeholder, before);

  if (!nesting) return;

  // Höchstens eine Stufe unter dem Vorgänger, und mindestens so tief wie der
  // Nachfolger – sonst entsteht eine Lücke in der Hierarchie.
  const prev = placeholder.previousElementSibling;
  const next = placeholder.nextElementSibling;
  const prevDepth = prev ? Number(prev.dataset.depth || 0) : -1;
  const nextDepth = next ? Number(next.dataset.depth || 0) : 0;
  const hi = Math.min(maxDepth, prevDepth + 1);
  const lo = Math.max(0, Math.min(nextDepth, hi));

  const depth = clamp(Math.round((lastX - startX) / INDENT) + ownDepth, lo, hi);
  state.depth = depth;
  placeholder.style.marginLeft = `${depth * INDENT}px`;
  placeholder.classList.toggle('will-nest', depth > 0);
}

function onUp() {
  if (!state) return;
  const { host, placeholder, ghost, block, opts, nesting, depth, ownDepth } = state;

  window.removeEventListener('pointermove', onMove);
  window.removeEventListener('pointerup', onUp);
  window.removeEventListener('pointercancel', onUp);
  document.body.classList.remove('is-dragging');
  document.querySelector('.drag-hint')?.remove();

  for (const n of block) { n.style.marginLeft = ''; host.insertBefore(n, placeholder); }
  placeholder.remove();
  ghost.remove();
  block[0].querySelector('.row')?.classList.remove('dragging');

  const shift = depth - ownDepth;
  const moved = new Map(block.map(n =>
    [n.dataset.id, clamp(Number(n.dataset.depth || 0) + shift, 0, state.maxDepth)]));

  // Sichtbare Reihenfolge einsammeln und daraus Rang und Elternteil ableiten.
  const order = [];
  const stack = [];   // stack[d] = id der zuletzt gesehenen Zeile auf Ebene d
  for (const n of host.children) {
    const id = n.dataset.id;
    if (!id) continue;
    const d = nesting ? (moved.has(id) ? moved.get(id) : Number(n.dataset.depth || 0)) : 0;
    order.push({ id, parent: d === 0 ? null : (stack[d - 1] ?? null) });
    stack[d] = id;
    stack.length = d + 1;
    n.dataset.depth = String(d);
  }

  haptic(14);
  state = null;
  opts.onDrop(order);
}
