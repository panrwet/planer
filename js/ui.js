/* Gemeinsame Oberflächenbausteine: Sheets, Toast, Formularfelder. */

import { $, el, svg, ICON, haptic } from './util.js';
import { COLORS, colorOf, recentEmoji } from './store.js';
import { searchEmoji, starterEmoji, emojiName } from './emoji.js';

/* ---------- Toast ---------- */

let toastTimer = null;

export function toast(message, ms = 2200) {
  const node = $('#toast');
  node.textContent = message;
  node.hidden = false;
  requestAnimationFrame(() => node.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    node.classList.remove('show');
    setTimeout(() => { node.hidden = true; }, 250);
  }, ms);
}

/* ---------- Sheet ---------- */

let closeCurrent = null;

/**
 * Öffnet ein Sheet von unten.
 * @param {object} opts
 * @param {string} opts.title      Überschrift
 * @param {string} [opts.confirm]  Beschriftung des rechten Buttons
 * @param {string} [opts.cancel]   Beschriftung des linken Buttons
 * @param {(body:HTMLElement)=>void} opts.build   füllt den Inhalt
 * @param {()=>boolean|void} [opts.onConfirm]     false hält das Sheet offen
 */
export function openSheet({ title, confirm, cancel = 'Abbrechen', build, onConfirm, onClose }) {
  closeCurrent?.();

  const host = $('#sheet-host');
  const body = el('div', { class: 'sheet-body' });
  const confirmBtn = confirm ? el('button', { type: 'button', class: 'strong', text: confirm }) : el('span');
  const cancelBtn = el('button', { type: 'button', text: cancel });

  const sheet = el('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, [
    el('div', { class: 'sheet-head' }, [cancelBtn, el('h2', { text: title }), confirmBtn]),
    body,
  ]);
  const scrim = el('div', { class: 'sheet-scrim' });

  host.replaceChildren(scrim, sheet);
  host.hidden = false;
  requestAnimationFrame(() => host.classList.add('open'));

  const close = () => {
    if (closeCurrent !== close) return;
    closeCurrent = null;
    host.classList.remove('open');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => {
      if (!host.classList.contains('open')) { host.hidden = true; host.replaceChildren(); }
    }, 300);
    onClose?.();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };

  closeCurrent = close;
  document.addEventListener('keydown', onKey);
  scrim.addEventListener('click', close);
  cancelBtn.addEventListener('click', close);
  confirmBtn.addEventListener?.('click', () => { if (onConfirm?.(body) !== false) close(); });

  build(body, { close, confirmBtn });
  return { close, body, confirmBtn };
}

export function closeSheet() { closeCurrent?.(); }

/** Rückfrage vor unwiderruflichen Schritten. */
export function confirmSheet({ title, message, confirmLabel = 'Löschen', danger = true, onConfirm }) {
  openSheet({
    title,
    cancel: 'Abbrechen',
    build: (body, { close }) => {
      body.append(
        el('p', { text: message, style: 'font-size:15px;line-height:1.5;color:var(--text-2);margin-bottom:20px' }),
        el('button', {
          type: 'button',
          class: danger ? 'btn danger' : 'btn',
          text: confirmLabel,
          onclick: () => { close(); onConfirm(); },
        }),
        el('button', { type: 'button', class: 'btn secondary', text: 'Abbrechen', onclick: close }),
      );
    },
  });
}

/* ---------- Formularbausteine ---------- */

/**
 * Verbindliche Reihenfolge der Editor-Felder. Jeder Editor liefert nur die
 * Bausteine, die es bei ihm gibt – die Reihenfolge steht hier, an einer
 * Stelle, damit „Neu" und „Bearbeiten" in allen Bereichen gleich aussehen.
 */
export const FIELD_ORDER = ['name', 'emoji', 'color', 'due', 'note', 'interval', 'unit', 'amount'];

/** Setzt den Sheet-Inhalt in der verbindlichen Reihenfolge zusammen. */
export function editorFields(parts) {
  const unknown = Object.keys(parts).filter(k => !FIELD_ORDER.includes(k));
  if (unknown.length) console.warn('Unbekannte Editor-Felder:', unknown);
  return FIELD_ORDER.filter(k => parts[k]).map(k => parts[k]);
}

export function field(label, controls, hint) {
  return el('div', { class: 'field' }, [
    el('span', { class: 'field-label', text: label }),
    ...[].concat(controls),
    hint ? el('p', { class: 'field-hint', text: hint }) : null,
  ]);
}

export function textInput({ value = '', placeholder = '', maxlength = 60 }) {
  return el('input', {
    class: 'input', type: 'text', value, placeholder, maxlength,
    autocapitalize: 'sentences', autocorrect: 'off', enterkeyhint: 'done',
  });
}

/**
 * Emoji-Wähler ohne eigene Zeile: das Kästchen sitzt links neben dem
 * Namensfeld (siehe `nameWithEmoji`), darunter nur die beiden wischbaren
 * Zeilen – Vorschläge zum eingegebenen Namen und die zuletzt benutzten.
 * `suggest(text)` ruft das Namensfeld bei jedem Tastendruck auf.
 */
export function emojiPicker(value) {
  const state = { value };

  // Das Kästchen ist gleichzeitig Anzeige und Eingabefeld: Tippen öffnet die
  // Emoji-Tastatur des Systems, ein Tipp auf einen Vorschlag füllt es.
  const box = el('input', {
    class: 'emoji-box', type: 'text', value, maxlength: 4,
    'aria-label': 'Emoji', inputmode: 'text', autocapitalize: 'off', autocorrect: 'off',
  });

  const suggestRow = el('div', { class: 'emoji-strip' });
  const recentRow = el('div', { class: 'emoji-strip' });
  const suggestLabel = el('div', { class: 'emoji-strip-label', text: 'Vorschläge' });
  const recentBlock = el('div', {}, [
    el('div', { class: 'emoji-strip-label', text: 'Zuletzt benutzt' }),
    recentRow,
  ]);

  const paint = () => {
    for (const row of [suggestRow, recentRow]) {
      for (const b of row.children) b.setAttribute('aria-pressed', String(b.textContent === state.value));
    }
  };

  const pick = (e) => {
    state.value = e;
    box.value = e;
    paint();
    haptic();
  };

  const fill = (row, list) => {
    row.replaceChildren(...list.map(e => {
      const b = el('button', {
        type: 'button', class: 'emoji-pick', text: e,
        title: emojiName(e), 'aria-label': emojiName(e) || e,
        'aria-pressed': String(e === state.value),
      });
      b.addEventListener('click', () => pick(e));
      return b;
    }));
  };

  /* Die Suche läuft über ~1950 Einträge – bei jedem Tastendruck neu zu suchen
     wäre auf dem Telefon spürbar, deshalb kurz entprellt. */
  let timer = null;
  const suggest = (text) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const hits = searchEmoji(text, 24);
      suggestLabel.textContent = hits.length ? 'Passend zum Namen' : 'Vorschläge';
      fill(suggestRow, hits.length ? hits : starterEmoji(24));
      paint();
    }, 120);
  };

  box.addEventListener('input', () => {
    // Emojis sind mehrteilig; mehr als ein Zeichen ergibt hier keinen Sinn.
    state.value = [...box.value].slice(0, 2).join('');
    paint();
  });

  const recents = recentEmoji();
  fill(recentRow, recents);
  recentBlock.hidden = recents.length === 0;
  fill(suggestRow, starterEmoji(24));

  return {
    box,                       // wird neben das Namensfeld gesetzt
    node: el('div', {}, [suggestLabel, suggestRow, recentBlock]),
    suggest,
    get value() { return state.value; },
  };
}

/** Namensfeld mit dem Emoji-Kästchen davor – eine Zeile statt zwei. */
export function nameWithEmoji(nameInput, picker) {
  nameInput.addEventListener('input', () => picker.suggest(nameInput.value));
  return el('div', { class: 'name-row' }, [picker.box, nameInput]);
}

export function colorPicker(value) {
  const state = { value };
  const wrap = el('div', { class: 'swatches' });   // Raster, zwei Reihen à acht
  const isDark = document.documentElement.dataset.resolved === 'dark';

  for (const c of COLORS) {
    const b = el('button', {
      type: 'button', class: 'swatch', 'aria-pressed': String(c.id === value),
      'aria-label': c.name, title: c.name,
      style: `--sw:${isDark ? c.dark : c.light}`,
    });
    b.addEventListener('click', () => {
      state.value = c.id;
      for (const s of wrap.children) s.setAttribute('aria-pressed', 'false');
      b.setAttribute('aria-pressed', 'true');
      haptic();
    });
    wrap.append(b);
  }
  return { node: wrap, get value() { return state.value; } };
}

/** Zahlenfeld mit -/+ . `onInput` meldet jede Änderung. */
export function stepper(value, { min = 1, max = 9999, step = 1, onInput } = {}) {
  const input = el('input', { type: 'number', value: String(value), min, max, inputmode: 'decimal' });
  const minus = el('button', { type: 'button', text: '−', 'aria-label': 'Weniger' });
  const plus = el('button', { type: 'button', text: '+', 'aria-label': 'Mehr' });

  const read = () => {
    const n = parseFloat(String(input.value).replace(',', '.'));
    return Number.isFinite(n) ? n : min;
  };
  const write = (n) => {
    const v = Math.min(max, Math.max(min, Math.round(n * 100) / 100));
    input.value = String(v);
    minus.disabled = v <= min;
    plus.disabled = v >= max;
    onInput?.(v);
  };

  minus.addEventListener('click', () => { write(read() - step); haptic(); });
  plus.addEventListener('click', () => { write(read() + step); haptic(); });
  input.addEventListener('change', () => write(read()));
  write(value);

  return { node: el('div', { class: 'stepper' }, [minus, input, plus]), get value() { return read(); } };
}

/** Chip-Gruppe. `multi` erlaubt Mehrfachauswahl (Wochentage).
    Die Werte dürfen Zahlen sein (Wochentag 0–6); verglichen wird deshalb
    durchgängig über die Zeichenkette, sonst greift kein Treffer. */
export function chipGroup(options, value, { multi = false, chipClass = '', onChange } = {}) {
  const state = { value: multi ? [...value] : value };
  const wrap = el('div', { class: 'chips' });

  const same = (a, b) => String(a) === String(b);
  const isOn = (id) => (multi ? state.value.some(v => same(v, id)) : same(state.value, id));
  const paint = () => {
    for (const b of wrap.children) b.setAttribute('aria-pressed', String(isOn(b.dataset.id)));
  };

  for (const o of options) {
    const b = el('button', {
      type: 'button', class: `chip ${chipClass}`.trim(), text: o.label,
      dataset: { id: String(o.id) }, 'aria-pressed': 'false',
    });
    b.addEventListener('click', () => {
      if (multi) {
        state.value = isOn(o.id) ? state.value.filter(x => !same(x, o.id)) : [...state.value, o.id];
      } else {
        state.value = o.id;
      }
      paint();
      haptic();
      onChange?.(state.value);
    });
    wrap.append(b);
  }
  paint();
  return { node: wrap, get value() { return state.value; } };
}

export function segmented(options, value, onChange) {
  const wrap = el('div', { class: 'segmented' });
  for (const o of options) {
    const b = el('button', {
      type: 'button', text: o.label, 'aria-pressed': String(o.id === value), dataset: { id: o.id },
    });
    b.addEventListener('click', () => {
      for (const s of wrap.children) s.setAttribute('aria-pressed', 'false');
      b.setAttribute('aria-pressed', 'true');
      haptic();
      onChange(o.id);
    });
    wrap.append(b);
  }
  return wrap;
}

export function switchBtn(on, onChange) {
  const b = el('button', { type: 'button', class: 'switch', role: 'switch', 'aria-pressed': String(on) });
  b.addEventListener('click', () => {
    const next = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', String(next));
    haptic();
    onChange(next);
  });
  return b;
}

/** Eine Zeile in den Einstellungen. */
export function settingRow({ id, title, desc, control, onClick, danger }) {
  const node = el(onClick ? 'button' : 'div', {
    class: `setting${onClick ? ' tappable' : ''}${danger ? ' danger' : ''}`,
    type: onClick ? 'button' : null,
    dataset: id ? { setting: id } : null,
  }, [
    el('div', { class: 'setting-body' }, [
      el('div', { class: 'setting-title', text: title }),
      desc ? el('div', { class: 'setting-desc', text: desc }) : null,
    ]),
    control || null,
  ]);
  if (onClick) node.addEventListener('click', onClick);
  return node;
}

export function group(title, rows) {
  return el('div', { class: 'group' }, [
    title ? el('h2', { text: title }) : null,
    el('div', { class: 'group-card' }, rows.filter(Boolean)),
  ]);
}

/* ---------- Aufklappbarer Abschnitt ---------- */

/** Überschrift mit Chevron, die ihren Abschnitt auf- und zuklappt. */
export function sectionToggle({ label, count, open, onToggle }) {
  const btn = el('button', {
    class: 'section-toggle', type: 'button', 'aria-expanded': String(open),
  });
  btn.append(
    svg(ICON.chevron, 'chev'),
    el('span', { text: label }),
    count === undefined ? null : el('span', { class: 'section-count', text: String(count) }),
  );
  btn.addEventListener('click', () => {
    const next = btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', String(next));
    haptic();
    onToggle(next);
  });
  return btn;
}

/* ---------- Drop-up ---------- */

let closeDropup = null;

/**
 * Menü, das über der unteren Leiste aufklappt.
 * @param {object} opts
 * @param {string} [opts.title]
 * @param {(body:HTMLElement, api:{close:()=>void})=>void} opts.build
 */
export function openDropup({ title, build }) {
  closeDropup?.();
  const host = $('#dropup-host');

  const body = el('div', { class: 'dropup-body' });
  const panel = el('div', { class: 'dropup', role: 'dialog', 'aria-modal': 'true', 'aria-label': title || 'Menü' }, [
    title ? el('div', { class: 'dropup-title', text: title }) : null,
    body,
  ]);
  const scrim = el('div', { class: 'dropup-scrim' });

  host.replaceChildren(scrim, panel);
  host.hidden = false;
  requestAnimationFrame(() => host.classList.add('open'));

  const close = () => {
    if (closeDropup !== close) return;
    closeDropup = null;
    host.classList.remove('open');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => {
      if (!host.classList.contains('open')) { host.hidden = true; host.replaceChildren(); }
    }, 260);
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };

  closeDropup = close;
  document.addEventListener('keydown', onKey);
  scrim.addEventListener('click', close);

  build(body, { close });
  return { close };
}

/** Eine Zeile im Drop-up. */
export function dropupItem({ emoji, label, hint, active, danger, overdue, onClick }) {
  const node = el('button', {
    class: `dropup-item${active ? ' active' : ''}${danger ? ' danger' : ''}`, type: 'button',
  }, [
    emoji ? el('span', { class: 'dropup-emoji', text: emoji }) : null,
    el('span', { class: 'dropup-label', text: label }),
    hint ? el('span', { class: `dropup-hint${overdue ? ' overdue' : ''}`, text: hint }) : null,
  ]);
  node.addEventListener('click', () => { haptic(); onClick(); });
  return node;
}

/* ---------- Zeilen-Bausteine ---------- */

/** Runder Abhak-Button mit Fortschrittsring. */
export function checkButton({ value, target, color, onTap, onHold, label }) {
  const done = value >= target;
  const pct = target > 0 ? Math.min(1, value / target) : 0;
  const R = 15.5;
  const circ = 2 * Math.PI * R;

  const btn = el('button', {
    class: `check${done ? ' is-done' : ''}`, type: 'button', 'aria-label': label,
    style: color ? `--tint:${color}` : null,
  });
  btn.innerHTML = `
    <span class="fill"></span>
    <svg class="ring" viewBox="0 0 36 36">
      <circle class="track" cx="18" cy="18" r="${R}"></circle>
      <circle class="prog" cx="18" cy="18" r="${R}"
        stroke-dasharray="${circ.toFixed(2)}"
        stroke-dashoffset="${(circ * (1 - pct)).toFixed(2)}"></circle>
    </svg>`;

  if (done) {
    const mark = el('span', { class: 'mark' });
    mark.append(svg(ICON.check));
    btn.append(mark);
  } else if (value > 0 && target > 1) {
    btn.append(el('span', { class: 'count', text: String(value) }));
  }

  attachTapHold(btn, onTap, onHold);
  return btn;
}

/** Tippen vs. Gedrückthalten, ohne dass Scrollen als Tipp durchgeht. */
export function attachTapHold(node, onTap, onHold, holdMs = 500) {
  let timer = null, held = false, sx = 0, sy = 0, active = false;

  const clear = () => { clearTimeout(timer); timer = null; };

  node.addEventListener('pointerdown', (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    active = true; held = false;
    sx = e.clientX; sy = e.clientY;
    if (onHold) {
      timer = setTimeout(() => { held = true; haptic(18); onHold(); }, holdMs);
    }
  });
  node.addEventListener('pointermove', (e) => {
    if (!active) return;
    if (Math.abs(e.clientX - sx) > 10 || Math.abs(e.clientY - sy) > 10) { active = false; clear(); }
  });
  node.addEventListener('pointerup', (e) => {
    clear();
    if (!active) return;
    active = false;
    e.preventDefault();
    e.stopPropagation();
    if (!held) { haptic(); onTap(); }
  });
  node.addEventListener('pointercancel', () => { active = false; clear(); });
  // Klick nur schlucken – ausgelöst wird über pointerup.
  node.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); });
}

export { colorOf };
