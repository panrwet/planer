/* Wischen nach rechts, um eine Aufgabe ein- oder auszurücken.

   Der Weg, den iOS-Nutzer kennen: Apple Erinnerungen bietet genau das als
   Hauptweg für Unteraufgaben an, das Ziehen erst als dritten. Ziehen ist
   position­sempfindlich und verschiebt leicht versehentlich die Reihenfolge –
   eine Wischgeste betrifft immer nur die eine Zeile.

   Kurz wischen hält den Knopf offen, weit wischen löst direkt aus. */

import { el, haptic, clamp } from './util.js';

const REVEAL = 116;     // px, bei denen der Knopf vollständig sichtbar ist
const TRIGGER = 132;    // px, ab denen das Loslassen direkt auslöst
const DIRECTION = 10;   // px, ab denen die Richtung feststeht

let openRow = null;     // höchstens eine Zeile zeigt ihren Knopf
let swipedAt = 0;       // Zeitpunkt der letzten Wischgeste

/** Kam gerade eine Wischgeste? Dann ist der folgende Klick ihr Nachklapp und
    darf die Zeile nicht öffnen. */
export function wasSwipe() {
  return Date.now() - swipedAt < 350;
}

/* Ein offener Knopf verhält sich wie ein kleines Menü: Der nächste Tipp
   irgendwo anders schließt nur ihn und löst sonst nichts aus – auch nicht auf
   einer anderen Zeile oder deren Abhak-Knopf. Ohne diese Regel täte ein
   einziger Tipp zwei Dinge gleichzeitig. Apple Erinnerungen verhält sich
   genauso.

   Alle drei Schritte des Tipps müssen abgefangen werden: Der Abhak-Knopf löst
   schon auf pointerup aus, Zeilen erst auf click. In der Einfangphase am
   Dokument kommt das hier vor allen Zeilen an und kann sie stoppen. */
let swallow = false;      // dieser Tipp hat nur den Knopf geschlossen

document.addEventListener('pointerdown', (e) => {
  swallow = false;                                 // jede neue Geste fängt frei an
  if (!openRow) return;
  if (e.target.closest('.swipe-action')) return;   // der Knopf selbst darf auslösen
  closeSwipe();
  swipedAt = Date.now();
  swallow = true;
}, true);

for (const type of ['pointerup', 'click']) {
  document.addEventListener(type, (e) => {
    if (!swallow || !wasSwipe()) return;
    e.stopPropagation();
    e.preventDefault();
  }, true);
}

/** Offene Zeile schließen – z. B. wenn woanders getippt wird. */
export function closeSwipe() {
  if (!openRow) return;
  openRow.style.transform = '';
  openRow.classList.remove('swiped', 'swiping', 'will-fire');
  openRow.parentElement?.querySelector('.swipe-action')?.remove();
  openRow = null;
}

/**
 * @param {HTMLElement} wrap    Zeilencontainer (nimmt den Knopf auf)
 * @param {HTMLElement} row     die bewegte Zeile
 * @param {object} opts
 * @param {() => boolean} opts.canIndent    darf gerade eingerückt werden?
 * @param {() => boolean} opts.canOutdent   darf gerade ausgerückt werden?
 * @param {() => void} opts.onIndent
 * @param {() => void} opts.onOutdent
 * @param {() => boolean} [opts.blocked]    true, während gezogen wird
 */
export function attachSwipe(wrap, row, opts) {
  let startX = 0, startY = 0;
  let dx = 0;
  let axis = null;        // null | 'x' | 'y'
  let active = false;
  let action = null;      // 'indent' | 'outdent'
  let button = null;

  const mode = () => (opts.canOutdent() ? 'outdent' : opts.canIndent() ? 'indent' : null);

  const ensureButton = () => {
    if (button?.isConnected) return button;
    // Der Knopf ist genau so breit wie der freigelegte Streifen – sonst läge
    // seine Mitte unter der Zeile und er wäre nicht zu treffen.
    button = el('button', { class: 'swipe-action', type: 'button', style: `width:${REVEAL}px` });
    wrap.insertBefore(button, wrap.firstChild);
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      fire();
    });
    return button;
  };

  const paintButton = () => {
    const b = ensureButton();
    b.className = `swipe-action ${action}`;
    b.textContent = action === 'outdent' ? '⤶ Ausrücken' : '⤷ Einrücken';
    b.setAttribute('aria-label', action === 'outdent' ? 'Ausrücken' : 'Zur Unteraufgabe machen');
  };

  const fire = () => {
    const done = action;
    reset();
    haptic(14);
    if (done === 'outdent') opts.onOutdent();
    else opts.onIndent();
  };

  const reset = () => {
    row.style.transition = '';
    row.style.transform = '';
    row.classList.remove('swiping', 'swiped', 'will-fire');
    if (openRow === row) openRow = null;
    // Knopf wieder entfernen: ein unsichtbar im Baum liegender Knopf ist für
    // Vorlesehilfen und automatische Prüfungen trotzdem vorhanden.
    button?.remove();
    button = null;
  };

  row.addEventListener('pointerdown', (e) => {
    if (opts.blocked?.()) return;
    if (e.target.closest('.check, .swipe-action')) return;
    active = true;
    axis = null;
    dx = 0;
    startX = e.clientX;
    startY = e.clientY;
    action = mode();
    row.style.transition = 'none';
  });

  row.addEventListener('pointermove', (e) => {
    if (!active || !action) return;
    const mx = e.clientX - startX;
    const my = e.clientY - startY;

    if (!axis) {
      if (Math.abs(mx) < DIRECTION && Math.abs(my) < DIRECTION) return;
      // Senkrecht gewinnt im Zweifel: Scrollen darf nie blockiert werden.
      axis = Math.abs(mx) > Math.abs(my) * 1.4 ? 'x' : 'y';
      if (axis === 'x') { row.classList.add('swiping'); paintButton(); }
    }
    if (axis !== 'x') return;

    e.preventDefault();
    // Nur nach rechts, und jenseits des Auslösepunkts zäher werden
    dx = clamp(mx, 0, TRIGGER + 40);
    const shown = dx > TRIGGER ? TRIGGER + (dx - TRIGGER) * 0.35 : dx;
    row.style.transform = `translateX(${shown}px)`;
    row.classList.toggle('will-fire', dx >= TRIGGER);
  });

  const end = () => {
    if (!active) return;
    active = false;
    if (axis !== 'x' || !action) { reset(); return; }
    swipedAt = Date.now();      // der gleich folgende Klick gehört zur Geste

    row.style.transition = 'transform .24s cubic-bezier(.32,.72,0,1)';
    if (dx >= TRIGGER) {
      fire();
    } else if (dx >= REVEAL / 2) {
      // Knopf offen stehen lassen, bis er getippt oder woanders gewischt wird
      row.style.transform = `translateX(${REVEAL}px)`;
      row.classList.remove('swiping', 'will-fire');
      row.classList.add('swiped');
      openRow = row;
    } else {
      reset();
    }
  };

  row.addEventListener('pointerup', end);
  row.addEventListener('pointercancel', end);
}
