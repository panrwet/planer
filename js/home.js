/* Startseite: frei zusammengesetzt aus Widgets.
 *
 * Was angezeigt wird, steht im aktiven Profil (store: homeProfiles). Wie ein
 * Widget aussieht, weiß allein der Katalog in js/widgets.js – diese Datei
 * kennt keinen einzigen Widget-Typ. Sie ordnet an, verschiebt und speichert.
 *
 * Unten stehen drei Zeilen, die nie verschwinden: Suchen, Einstellungen und
 * Startseite bearbeiten. Sie liegen außerhalb des Rasters, damit sie beim
 * Umsortieren nicht mitwandern können.
 *
 * Bearbeiten arbeitet auf einer Kopie der Anordnung. Erst „Speichern"
 * übernimmt sie; „Abbrechen" wirft sie weg. Sonst wäre ein verrutschtes
 * Widget sofort endgültig.
 */

import { $, el, formatLongDate, haptic } from './util.js';
import * as S from './store.js';
import { openSheet, closeSheet, closeMenu, confirmSheet, openDropup, dropupItem,
         segmented, textInput, toast } from './ui.js';
import { attachSortable, isDragging } from './drag.js';
import { widgetType, widgetsByArea, SIZE_LABEL } from './widgets.js';

let go = () => {};
/** Navigation von außen: go('habits') | go('todos', listId) | go('day', key) … */
export function bindNavigate(fn) { go = fn; }

let actions = {};
/** Handlungen, die Widgets anbieten (neues Habit, neues To-do, einplanen). */
export function bindActions(fns) { actions = fns; }

/* Beim Bearbeiten wird auf einer Kopie gearbeitet. null heißt: nicht im
   Bearbeiten-Modus. */
let entwurf = null;
let entwurfProfil = null;

export function isEditing() { return entwurf !== null; }

export function renderHome() {
  const scroll = $('#home-scroll');
  const key = S.today();
  const profil = S.homeProfile();
  const bearbeiten = isEditing();

  $('#home-greeting').textContent = bearbeiten ? 'Startseite bearbeiten' : greeting();
  $('#home-date').textContent = bearbeiten
    ? `Profil „${entwurfProfil?.name ?? profil.name}"`
    : formatLongDate(key);
  document.body.classList.toggle('is-editing-home', bearbeiten);

  const liste = bearbeiten ? entwurf : profil.widgets;
  const raster = el('div', { class: 'w-grid', id: 'w-grid' });

  for (const w of liste) raster.append(widgetShell(w, key, bearbeiten));

  // Ziehen erst anhängen, wenn alle Widgets im Raster hängen.
  if (bearbeiten) {
    for (const zelle of raster.children) {
      attachSortable(zelle, zelle, {
        host: raster,
        scroll,
        grid: true,
        hint: 'Gedrückt halten und verschieben',
        ignore: '.w-remove, .w-resize',
        onDrop: (order) => {
          entwurf = order.map(o => entwurf.find(w => w.id === o.id)).filter(Boolean);
          renderHome();
        },
      });
    }
  }

  scroll.replaceChildren(
    ...(bearbeiten ? [hinweisZeile()] : []),
    liste.length ? raster : leerHinweis(bearbeiten),
    ...(bearbeiten ? [] : [fixedRows()]),
  );

  /* Die Leiste zum Speichern liegt außerhalb des Scrollbereichs, über der
     Tab-Leiste – sonst müsste man bei vielen Widgets erst ans Ende scrollen,
     um überhaupt speichern zu können. */
  const leiste = $('#home-editbar');
  leiste.hidden = !bearbeiten;
  leiste.replaceChildren(...(bearbeiten ? editBar() : []));
  /* Wie hoch die Leiste wirklich ist, weiß erst der fertige Aufbau. Ein fest
     eingetragener Wert wäre bei größerer Schrift zu klein – dann läge das
     letzte Widget dahinter. */
  document.documentElement.style.setProperty(
    '--editbar-h', bearbeiten ? `${leiste.offsetHeight}px` : '0px');
}

function hinweisZeile() {
  return el('p', { class: 'field-hint', style: 'margin:0 4px 10px',
    text: 'Widget gedrückt halten und verschieben. ✕ entfernt, der Knopf rechts ändert die Größe.' });
}

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Gute Nacht';
  if (h < 11) return 'Guten Morgen';
  if (h < 18) return 'Guten Tag';
  return 'Guten Abend';
}

function leerHinweis(bearbeiten) {
  return el('div', { class: 'empty', style: 'padding:32px 0' }, [
    el('div', { class: 'empty-icon', text: '🧩' }),
    el('h2', { text: 'Keine Widgets' }),
    el('p', { text: bearbeiten
      ? 'Tippe unten auf „Widget hinzufügen".'
      : 'Tippe unten auf „Startseite bearbeiten", um welche hinzuzufügen.' }),
  ]);
}

/* ==========================================================================
   Die Hülle eines Widgets
   Größe, Rahmen, Antippen und – im Bearbeiten-Modus – der Entfernen-Knopf.
   Den Inhalt liefert der Katalog.
   ========================================================================== */

function widgetShell(w, key, bearbeiten) {
  const typ = widgetType(w.type);
  const zelle = el('div', {
    class: `w-cell w-${w.size}${bearbeiten ? ' editing' : ''}`,
    dataset: { id: w.id, type: w.type },
  });

  const karte = el('div', { class: 'w-card' });
  if (!typ) {
    // Ein Typ, den diese Fassung nicht kennt – etwa aus einer neueren
    // Sicherung. Lieber sichtbar stehen lassen als still verwerfen.
    karte.append(
      el('div', { class: 'w-head' }, [el('span', { class: 'w-title', text: 'Unbekanntes Widget' })]),
      el('p', { class: 'w-empty', text: w.type }),
    );
  } else {
    const ctx = { size: w.size, opts: w.opts, go, actions, key, today: key,
                  isDark: document.documentElement.dataset.resolved === 'dark' };
    try {
      karte.append(...[].concat(typ.build(ctx)).filter(Boolean));
    } catch (err) {
      // Ein einzelnes Widget darf nicht die ganze Startseite mitnehmen.
      console.error(`Widget ${w.type} konnte nicht gezeichnet werden`, err);
      karte.append(
        el('div', { class: 'w-head' }, [el('span', { class: 'w-title', text: typ.label })]),
        el('p', { class: 'w-empty', text: 'Lässt sich gerade nicht anzeigen.' }),
      );
    }
    if (!bearbeiten && typ.tap && !typ.inert) {
      karte.classList.add('tappable');
      karte.addEventListener('click', (e) => {
        if (isDragging() || e.target.closest('.w-quick-btn, .check')) return;
        haptic();
        typ.tap(ctx);
      });
    }
  }
  zelle.append(karte);

  if (bearbeiten) {
    const weg = el('button', { class: 'w-remove', type: 'button', text: '✕',
      'aria-label': `${typ?.label || w.type} entfernen` });
    weg.addEventListener('click', (e) => {
      e.stopPropagation();
      haptic(14);
      entwurf = entwurf.filter(x => x.id !== w.id);
      renderHome();
    });
    zelle.append(weg);
    // Größe im Bearbeiten-Modus umstellen, ohne das Widget neu anzulegen.
    const groesse = el('button', { class: 'w-resize', type: 'button',
      text: SIZE_LABEL[w.size], 'aria-label': 'Größe ändern' });
    groesse.addEventListener('click', (e) => {
      e.stopPropagation();
      const moeglich = typ?.sizes || ['wide'];
      const naechste = moeglich[(moeglich.indexOf(w.size) + 1) % moeglich.length];
      w.size = naechste;
      haptic();
      renderHome();
    });
    if ((typ?.sizes || []).length > 1) zelle.append(groesse);
  }
  return zelle;
}

/* ==========================================================================
   Die drei festen Zeilen
   ========================================================================== */

function fixedRows() {
  return el('div', { class: 'group', style: 'margin-top:16px' }, [
    el('div', { class: 'group-card' }, [
      homeRow('🔍', 'Suchen', 'Habits, To-dos, Listen und Einstellungen', () => go('search')),
      homeRow('⚙️', 'Einstellungen', 'Darstellung, Planung, Sicherung', () => go('settings')),
      homeRow('✏️', 'Startseite bearbeiten', 'Widgets anordnen, Profile wechseln', startEdit),
    ]),
  ]);
}

function homeRow(zeichen, titel, hinweis, onClick) {
  const row = el('button', { class: 'setting tappable', type: 'button', dataset: { home: titel } }, [
    el('span', { class: 'home-row-icon', text: zeichen }),
    el('div', { class: 'setting-body' }, [
      el('div', { class: 'setting-title', text: titel }),
      el('div', { class: 'setting-desc', text: hinweis }),
    ]),
    el('span', { class: 'setting-value', html: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>' }),
  ]);
  row.addEventListener('click', () => { haptic(); onClick(); });
  return row;
}

/* ==========================================================================
   Bearbeiten
   ========================================================================== */

export function startEdit() {
  const p = S.homeProfile();
  entwurfProfil = { id: p.id, name: p.name };
  // Tiefe Kopie: Was hier verschoben wird, darf den gespeicherten Stand erst
  // beim Speichern anfassen.
  entwurf = p.widgets.map(w => ({ ...w, opts: { ...w.opts } }));
  renderHome();
  $('#home-scroll').scrollTo({ top: 0 });
}

function stopEdit() {
  entwurf = null;
  entwurfProfil = null;
  /* Was noch offen steht, gehört zum Bearbeiten und arbeitet auf dem Entwurf.
     Bliebe die Auswahl offen, würde „Hinzufügen" danach in einen Entwurf
     schreiben, den es nicht mehr gibt. */
  closeSheet();
  closeMenu();
  renderHome();
}

/** Ob der Entwurf von der gespeicherten Anordnung abweicht. */
function geaendert() {
  const p = S.homeProfiles().find(x => x.id === entwurfProfil?.id);
  if (!p) return true;
  return JSON.stringify(p.widgets) !== JSON.stringify(entwurf);
}

/**
 * Den Bearbeiten-Modus verlassen, weil ein anderer Bereich aufgerufen wurde.
 *
 * Nötig, weil im Bearbeiten-Modus die drei festen Zeilen nicht dastehen –
 * bliebe der Modus über den Reiterwechsel hinweg bestehen, käme man ohne
 * Umweg nicht mehr in die Einstellungen. Ungespeichertes wird deshalb nicht
 * still weggeworfen, sondern nachgefragt.
 */
export function leaveEdit(weiter) {
  if (!isEditing()) { weiter(); return; }
  if (!geaendert()) { stopEdit(); weiter(); return; }
  confirmSheet({
    title: 'Startseite verlassen?',
    message: 'Die Anordnung ist noch nicht gespeichert und geht verloren.',
    confirmLabel: 'Verwerfen',
    onConfirm: () => { stopEdit(); weiter(); },
  });
}

/** Die beiden Knopfzeilen der Leiste. Die Hülle steht im HTML. */
function editBar() {
  return [
    el('div', { class: 'edit-bar-row' }, [
      barBtn('Profil', () => openProfileMenu(), 'secondary'),
      barBtn('+ Widget', () => openWidgetPicker(), 'secondary'),
    ]),
    el('div', { class: 'edit-bar-row' }, [
      barBtn('Abbrechen', () => {
        if (!geaendert()) { stopEdit(); return; }
        confirmSheet({
          title: 'Änderungen verwerfen?',
          message: 'Die Anordnung geht zurück auf den gespeicherten Stand.',
          confirmLabel: 'Verwerfen',
          onConfirm: stopEdit,
        });
      }, 'secondary'),
      barBtn('Speichern', () => {
        const ok = S.setWidgets(entwurfProfil.id, entwurf);
        stopEdit();
        toast(ok ? 'Startseite gespeichert' : 'Dieses Profil gibt es nicht mehr – nichts gespeichert.');
      }, ''),
    ]),
  ];
}

function barBtn(text, onClick, cls) {
  const b = el('button', { class: `btn ${cls}`.trim(), type: 'button', text });
  b.addEventListener('click', () => { haptic(); onClick(); });
  return b;
}

/* ---------- Profile ---------- */

function openProfileMenu() {
  if (!entwurfProfil) return;
  openDropup({
    title: 'Profile',
    build: (body, { close }) => {
      for (const p of S.homeProfiles()) {
        body.append(dropupItem({
          emoji: p.id === entwurfProfil.id ? '●' : '○',
          label: p.name,
          hint: `${p.widgets.length} ${p.widgets.length === 1 ? 'Widget' : 'Widgets'}`,
          active: p.id === entwurfProfil.id,
          onClick: () => {
            close();
            if (p.id === entwurfProfil.id) return;
            // Profilwechsel im Bearbeiten-Modus: Der Entwurf des alten Profils
            // ist damit verworfen – gefragt wird nur, wenn er etwas enthält.
            const p0 = S.homeProfiles().find(x => x.id === entwurfProfil.id);
            const offen = geaendert();
            const wechseln = () => {
              S.setHomeProfile(p.id);
              entwurfProfil = { id: p.id, name: p.name };
              entwurf = p.widgets.map(w => ({ ...w, opts: { ...w.opts } }));
              renderHome();
            };
            if (!offen) { wechseln(); return; }
            confirmSheet({
              title: 'Profil wechseln?',
              message: `Die Änderungen an „${p0?.name ?? entwurfProfil.name}" sind noch nicht gespeichert und gehen verloren.`,
              confirmLabel: 'Wechseln',
              onConfirm: wechseln,
            });
          },
        }));
      }

      body.append(el('div', { class: 'dropup-sep' }));
      body.append(dropupItem({
        emoji: '＋', label: 'Neues Profil',
        onClick: () => { close(); askName('Neues Profil', '', (name) => {
          const p = S.addProfile(name);
          if (!p) { toast('Mehr Profile gehen nicht'); return; }
          entwurfProfil = { id: p.id, name: p.name };
          entwurf = [];
          renderHome();
        }); },
      }));
      body.append(dropupItem({
        emoji: '⧉', label: 'Dieses Profil kopieren',
        onClick: () => {
          close();
          const p = S.duplicateProfile(entwurfProfil.id);
          if (!p) { toast('Mehr Profile gehen nicht'); return; }
          entwurfProfil = { id: p.id, name: p.name };
          entwurf = p.widgets.map(w => ({ ...w, opts: { ...w.opts } }));
          renderHome();
          toast(`„${p.name}" angelegt`);
        },
      }));
      body.append(dropupItem({
        emoji: '✏️', label: 'Profil umbenennen',
        onClick: () => { close(); askName('Profil umbenennen', entwurfProfil.name, (name) => {
          S.renameProfile(entwurfProfil.id, name);
          entwurfProfil.name = name;
          renderHome();
        }); },
      }));
      if (S.homeProfiles().length > 1) {
        body.append(dropupItem({
          emoji: '🗑', label: 'Profil löschen',
          onClick: () => {
            close();
            confirmSheet({
              title: 'Profil löschen?',
              message: `„${entwurfProfil.name}" und seine Anordnung werden entfernt. Das lässt sich nicht rückgängig machen.`,
              onConfirm: () => {
                S.deleteProfile(entwurfProfil.id);
                const p = S.homeProfile();
                entwurfProfil = { id: p.id, name: p.name };
                entwurf = p.widgets.map(w => ({ ...w, opts: { ...w.opts } }));
                renderHome();
                toast('Profil gelöscht');
              },
            });
          },
        }));
      }
    },
  });
}

function askName(title, value, onDone) {
  openSheet({
    title,
    confirm: 'Übernehmen',
    build: (body) => {
      const feld = textInput({ value, placeholder: 'Name', maxlength: 30 });
      body.append(el('div', { class: 'field' }, [
        el('span', { class: 'field-label', text: 'Name' }), feld,
      ]));
      setTimeout(() => feld.focus(), 300);
      body._feld = feld;
    },
    onConfirm(body) {
      const v = body._feld.value.trim();
      if (!v) { body._feld.focus(); return false; }
      onDone(v);
    },
  });
}

/* ---------- Widget hinzufügen ---------- */

function openWidgetPicker() {
  openSheet({
    title: 'Widget hinzufügen',
    build: (body, { close }) => {
      for (const [bereich, typen] of widgetsByArea()) {
        body.append(el('div', { class: 'w-pick-area', text: bereich }));
        const liste = el('div', { class: 'group-card' });
        for (const t of typen) {
          const row = el('button', { class: 'setting tappable', type: 'button', dataset: { widget: t.id } }, [
            el('div', { class: 'setting-body' }, [
              el('div', { class: 'setting-title', text: t.label }),
              el('div', { class: 'setting-desc', text: t.hint }),
            ]),
            el('span', { class: 'setting-value', text: t.sizes.map(x => SIZE_LABEL[x]).join(' · ') }),
          ]);
          row.addEventListener('click', () => { close(); chooseSize(t); });
          liste.append(row);
        }
        body.append(liste);
      }
    },
  });
}

/** Größe wählen – und, wo der Typ es braucht, das Ziel. */
function chooseSize(typ) {
  let size = typ.sizes.includes('wide') ? 'wide' : typ.sizes[0];
  let ziel = null;

  const auswahl = typ.needs === 'habit' ? S.habits().map(h => ({ id: h.id, label: `${h.emoji || ''} ${h.name}`.trim() }))
    : typ.needs === 'list' ? S.lists().map(l => ({ id: l.id, label: `${l.emoji || '📋'} ${l.name}` }))
    : null;

  if (auswahl && !auswahl.length) {
    toast(typ.needs === 'habit' ? 'Lege zuerst ein Habit an' : 'Lege zuerst eine Liste an');
    return;
  }
  if (auswahl) ziel = auswahl[0].id;

  openSheet({
    title: typ.label,
    confirm: 'Hinzufügen',
    build: (body) => {
      body.append(el('p', { class: 'field-hint', style: 'margin:-4px 0 14px', text: typ.hint }));

      if (auswahl) {
        const liste = el('div', { class: 'chips' });
        const paint = () => {
          for (const b of liste.children) b.setAttribute('aria-pressed', String(b.dataset.id === ziel));
        };
        for (const a of auswahl) {
          const b = el('button', { type: 'button', class: 'chip', text: a.label, dataset: { id: a.id } });
          b.addEventListener('click', () => { ziel = a.id; paint(); haptic(); });
          liste.append(b);
        }
        paint();
        body.append(el('div', { class: 'field' }, [
          el('span', { class: 'field-label', text: typ.needs === 'habit' ? 'Welches Habit' : 'Welche Liste' }),
          liste,
        ]));
      }

      if (typ.sizes.length > 1) {
        body.append(el('div', { class: 'field' }, [
          el('span', { class: 'field-label', text: 'Größe' }),
          segmented(typ.sizes.map(x => ({ id: x, label: SIZE_LABEL[x] })), size, (v) => { size = v; }),
        ]));
      }
    },
    onConfirm() {
      if (!entwurf) return;
      const opts = {};
      if (typ.needs === 'habit') opts.habitId = ziel;
      if (typ.needs === 'list') opts.listId = ziel;
      entwurf.push({ id: `w${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
                     type: typ.id, size, opts });
      renderHome();
      // Ans Ende gescrollt, damit man sieht, was dazugekommen ist.
      requestAnimationFrame(() => {
        const sc = $('#home-scroll');
        sc.scrollTo({ top: sc.scrollHeight, behavior: 'smooth' });
      });
    },
  });
}
