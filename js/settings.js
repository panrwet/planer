/* Einstellungen und Backup. Die Daten liegen nur in diesem Browser – deshalb
   ist der Export bewusst prominent und bietet mehrere Wege an, weil iOS je
   nach Kontext mal das Teilen-Menü und mal einen Download anbietet. */

import { $, el, haptic } from './util.js';
import * as S from './store.js';
import { group, settingRow, segmented, switchBtn, toast, openSheet, confirmSheet } from './ui.js';

let applyAll = () => {};
export function bindApply(fn) { applyAll = fn; }

let go = () => {};
export function bindSettingsNavigate(fn) { go = fn; }

/**
 * Was die Suche in den Einstellungen finden soll. Bewusst als Liste neben der
 * Ansicht: wer eine Einstellung ergänzt, trägt sie hier ein und sie ist sofort
 * auffindbar.
 */
export const SETTINGS_INDEX = [
  { id: 'doneHabits', group: 'Habits', title: 'Abgehakte Habits',
    keywords: 'ausblenden ausgrauen verschwinden erledigt sichtbar' },
  { id: 'doneTodos', group: 'Todos', title: 'Erledigte Aufgaben',
    keywords: 'ausblenden anzeigen durchgestrichen erledigt' },
  { id: 'rowSize', group: 'Darstellung', title: 'Größe der Zeilen',
    keywords: 'klein mittel groß höhe kompakt schrift' },
  { id: 'saturation', group: 'Darstellung', title: 'Farbstärke',
    keywords: 'sättigung farbe kräftig dezent bunt ruhig tönung rahmen intensität' },
  { id: 'theme', group: 'Darstellung', title: 'Design',
    keywords: 'hell dunkel system dark mode farben aussehen' },
  { id: 'dayStart', group: 'Tag', title: 'Tageswechsel um 3 Uhr',
    keywords: 'mitternacht nacht tag wechsel vortag spät' },
  { id: 'export', group: 'Backup', title: 'Daten sichern',
    keywords: 'backup export teilen datei speichern kopieren icloud' },
  { id: 'import', group: 'Backup', title: 'Daten wiederherstellen',
    keywords: 'backup import einlesen zurückholen datei' },
  { id: 'trash', group: 'Gelöschtes', title: 'Zuletzt gelöscht',
    keywords: 'papierkorb rückgängig wiederherstellen zurückholen versehentlich gelöscht müll' },
  { id: 'reset', group: 'Zurücksetzen', title: 'Alle Daten löschen',
    keywords: 'löschen zurücksetzen leeren neu anfangen' },
];

/** Eine Einstellung kurz hervorheben – z. B. wenn die Suche dorthin führt. */
export function flashSetting(id) {
  const node = document.querySelector(`[data-setting="${id}"]`);
  if (!node) return;
  node.scrollIntoView({ block: 'center', behavior: 'smooth' });
  node.classList.add('flash');
  setTimeout(() => node.classList.remove('flash'), 1600);
}

export function renderSettings() {
  const set = S.settings();
  const scroll = $('#settings-scroll');

  const put = (key, value) => { S.setSetting(key, value); applyAll(); };

  scroll.replaceChildren(
    group('Habits', [
      settingRow({
        id: 'doneHabits',
        title: 'Abgehakte Habits',
        desc: set.doneHabits === 'hide'
          ? 'Verschwinden aus der Liste und stehen unter „Erledigt“.'
          : 'Bleiben stehen, grau und durchgestrichen.',
        control: segmented(
          [{ id: 'hide', label: 'Ausblenden' }, { id: 'dim', label: 'Ausgrauen' }],
          set.doneHabits, v => put('doneHabits', v),
        ),
      }),
    ]),

    group('Todos', [
      settingRow({
        id: 'doneTodos',
        title: 'Erledigte Aufgaben',
        desc: set.doneTodos === 'hide'
          ? 'Verschwinden aus der Liste und stehen unter „Erledigt“.'
          : 'Bleiben an ihrem Platz, grau und durchgestrichen.',
        control: segmented(
          [{ id: 'hide', label: 'Ausblenden' }, { id: 'show', label: 'Anzeigen' }],
          set.doneTodos, v => put('doneTodos', v),
        ),
      }),
    ]),

    group('Darstellung', [
      settingRow({
        id: 'rowSize',
        title: 'Größe der Zeilen',
        desc: 'Gilt für Habits und Todos.',
        control: segmented(
          [{ id: 'small', label: 'Klein' }, { id: 'medium', label: 'Mittel' }, { id: 'large', label: 'Groß' }],
          set.rowSize, v => put('rowSize', v),
        ),
      }),
      settingRow({
        id: 'saturation',
        title: 'Farbstärke',
        desc: {
          off: 'Zeilen bleiben neutral – die Farbe steckt nur im Ring.',
          soft: 'Zurückhaltend getönt, die Liste bleibt ruhig.',
          normal: 'Jede Zeile in ihrer Farbe gerahmt und leicht getönt.',
          strong: 'Kräftig – jedes Objekt tritt als eigene Karte hervor.',
        }[set.saturation],
        control: segmented(
          [{ id: 'off', label: 'Aus' }, { id: 'soft', label: 'Dezent' },
           { id: 'normal', label: 'Normal' }, { id: 'strong', label: 'Kräftig' }],
          set.saturation, v => put('saturation', v),
        ),
      }),
      settingRow({
        id: 'theme',
        title: 'Design',
        desc: 'Standard folgt der Einstellung des iPhones.',
        control: segmented(
          [{ id: 'system', label: 'System' }, { id: 'light', label: 'Hell' }, { id: 'dark', label: 'Dunkel' }],
          set.theme, v => put('theme', v),
        ),
      }),
    ]),

    group('Tag', [
      settingRow({
        id: 'dayStart',
        title: 'Tageswechsel um 3 Uhr',
        desc: 'Was du nach Mitternacht abhakst, zählt noch zum Vortag.',
        control: switchBtn(set.dayStart === 3, on => put('dayStart', on ? 3 : 0)),
      }),
    ]),

    group('Backup', [
      settingRow({
        id: 'export',
        title: 'Daten sichern',
        desc: 'Als Datei teilen oder laden – am besten regelmäßig.',
        control: chevron(),
        onClick: exportData,
      }),
      settingRow({
        id: 'import',
        title: 'Daten wiederherstellen',
        desc: 'Aus einer zuvor gesicherten Datei einlesen.',
        control: chevron(),
        onClick: importData,
      }),
    ]),

    group('Gelöschtes', [
      settingRow({
        id: 'trash',
        title: 'Zuletzt gelöscht',
        desc: S.trashCount()
          ? `${S.trashCount()} ${S.trashCount() === 1 ? 'Eintrag lässt' : 'Einträge lassen'} sich zurückholen.`
          : 'Gelöschtes liegt hier 30 Tage, bevor es endgültig weg ist.',
        control: el('span', { class: 'setting-value' }, [
          S.trashCount() ? el('span', { class: 'setting-badge', text: String(S.trashCount()) }) : null,
          chevron(),
        ].filter(Boolean)),
        onClick: () => go('trash'),
      }),
    ]),

    group('Zurücksetzen', [
      settingRow({
        id: 'reset',
        title: 'Alle Daten löschen',
        desc: 'Entfernt Habits, Listen, Aufgaben und den gesamten Verlauf.',
        danger: true,
        control: chevron(),
        onClick: () => confirmSheet({
          title: 'Wirklich alles löschen?',
          message: 'Alle Habits, Listen, Aufgaben und der komplette Verlauf werden gelöscht. Sichere vorher, falls du die Daten noch brauchst.',
          confirmLabel: 'Alles löschen',
          onConfirm: () => { S.resetAll(); applyAll(); toast('Alle Daten gelöscht'); },
        }),
      }),
    ]),

    storageInfo(),
  );
}

function chevron() {
  return el('span', { class: 'setting-value', html: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>' });
}

function storageInfo() {
  const d = S.getData();
  const days = new Set();
  for (const entries of Object.values(d.log || {})) for (const k of Object.keys(entries)) days.add(k);

  return el('div', { class: 'about' }, [
    el('p', {}, [
      el('strong', { text: 'Planer' }), ' · ',
      `${d.habits.length} ${d.habits.length === 1 ? 'Habit' : 'Habits'}, `,
      `${d.lists.length} ${d.lists.length === 1 ? 'Liste' : 'Listen'}, `,
      `${d.todos.length} ${d.todos.length === 1 ? 'Aufgabe' : 'Aufgaben'}, `,
      `${days.size} erfasste Tage.`,
    ]),
    el('p', { style: 'margin-top:8px' }, [
      'Alle Daten liegen ausschließlich in diesem Browser auf diesem Gerät. Sie werden nirgendwo hochgeladen. ',
      el('strong', { text: 'Wenn du den Website-Speicher von Safari löschst, sind sie weg' }),
      ' – nutze deshalb hin und wieder die Sicherung.',
    ]),
  ]);
}

/* ---------- Export ---------- */

function exportData() {
  const json = S.exportJSON();
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `planer-backup-${stamp}.json`;
  const file = new File([json], filename, { type: 'application/json' });

  openSheet({
    title: 'Daten sichern',
    cancel: 'Fertig',
    build: (body, { close }) => {
      body.append(el('p', {
        class: 'field-hint',
        style: 'margin:-4px 0 16px',
        text: `Sicherung vom ${new Date().toLocaleDateString('de-DE')} · ${(json.length / 1024).toFixed(1)} KB. Lege die Datei am besten in iCloud Drive ab.`,
      }));

      if (navigator.canShare?.({ files: [file] })) {
        body.append(el('button', {
          type: 'button', class: 'btn', text: 'Teilen / In Dateien sichern',
          onclick: async () => {
            try {
              await navigator.share({ files: [file], title: filename });
              close();
            } catch (err) {
              if (err.name !== 'AbortError') toast('Teilen nicht möglich – nutze den Download');
            }
          },
        }));
      }

      body.append(el('a', {
        class: 'btn secondary',
        href: URL.createObjectURL(new Blob([json], { type: 'application/json' })),
        download: filename,
        text: 'Als Datei laden',
        style: 'text-decoration:none',
      }));

      body.append(el('button', {
        type: 'button', class: 'btn secondary', text: 'In die Zwischenablage kopieren',
        onclick: async () => {
          try {
            await navigator.clipboard.writeText(json);
            toast('Kopiert – irgendwo einfügen und sichern');
          } catch {
            toast('Kopieren nicht möglich');
          }
        },
      }));
    },
  });
}

/* ---------- Import ---------- */

function importData() {
  openSheet({
    title: 'Daten wiederherstellen',
    cancel: 'Abbrechen',
    build: (body, { close }) => {
      const fileInput = el('input', { type: 'file', accept: 'application/json,.json', style: 'display:none' });
      const paste = el('textarea', {
        class: 'input', placeholder: 'Alternativ die gesicherten Daten hier einfügen',
        style: 'min-height:110px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px',
      });

      const apply = (text) => {
        try {
          S.importJSON(text);
          close();
          applyAll();
          toast('Daten wiederhergestellt');
        } catch (err) {
          toast(err.message || 'Datei konnte nicht gelesen werden');
        }
      };

      fileInput.addEventListener('change', () => {
        const f = fileInput.files?.[0];
        if (!f) return;
        f.text().then(apply).catch(() => toast('Datei konnte nicht gelesen werden'));
      });

      body.append(
        el('p', {
          class: 'field-hint',
          style: 'margin:-4px 0 16px',
          text: 'Der aktuelle Stand wird dabei vollständig ersetzt.',
        }),
        fileInput,
        el('button', { type: 'button', class: 'btn', text: 'Datei auswählen', onclick: () => fileInput.click() }),
        el('div', { style: 'height:18px' }),
        paste,
        el('button', {
          type: 'button', class: 'btn secondary', style: 'margin-top:9px', text: 'Eingefügte Daten übernehmen',
          onclick: () => {
            const v = paste.value.trim();
            if (!v) { toast('Nichts eingefügt'); return; }
            apply(v);
          },
        }),
      );
    },
  });
}

/* ==========================================================================
   Zuletzt gelöscht
   Eigener Bildschirm hinter den Einstellungen. Jeder Eintrag sagt, was er war,
   wie viel daran hing und wie lange er noch bleibt – wer hier etwas endgültig
   löscht, soll wissen, was weg ist.
   ========================================================================== */

const KIND_LABEL = { habit: 'Habit', list: 'Liste', todo: 'Aufgabe' };
/* Habits und Listen bringen ihr eigenes Emoji mit. Aufgaben haben keins – für
   sie steht hier ein neutrales Zeichen, damit alle Zeilen gleich breit bleiben. */
const KIND_ICON = { habit: '✓', list: '📋', todo: '📝' };

/** „vor 3 Tagen", „gerade eben" – ohne Bibliothek, mit den Fällen, die zählen. */
function timeAgo(iso) {
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms)) return '';
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Min.`;
  const std = Math.floor(min / 60);
  if (std < 24) return `vor ${std} Std.`;
  const tage = Math.floor(std / 24);
  if (tage === 1) return 'gestern';
  return `vor ${tage} Tagen`;
}

export function renderTrash() {
  const scroll = $('#trash-scroll');
  const entries = S.trash();
  const isDark = document.documentElement.dataset.resolved === 'dark';

  $('#trash-subtitle').textContent = entries.length
    ? `${entries.length} ${entries.length === 1 ? 'Eintrag' : 'Einträge'} · nach 30 Tagen endgültig weg`
    : '';

  if (!entries.length) {
    scroll.replaceChildren(el('div', { class: 'empty' }, [
      el('div', { class: 'empty-icon', text: '🗑️' }),
      el('h2', { text: 'Nichts gelöscht' }),
      el('p', { text: 'Was du löschst, liegt hier 30 Tage lang und lässt sich zurückholen.' }),
    ]));
    return;
  }

  scroll.replaceChildren(
    el('div', { class: 'list' }, entries.map(e => trashRow(e, isDark))),
    el('div', { class: 'group', style: 'margin-top:14px' }, [
      el('div', { class: 'group-card' }, [
        settingRow({
          title: 'Papierkorb leeren',
          desc: `${entries.length} ${entries.length === 1 ? 'Eintrag wird' : 'Einträge werden'} endgültig gelöscht.`,
          danger: true,
          control: chevron(),
          onClick: () => confirmSheet({
            title: 'Papierkorb leeren?',
            message: `${entries.length} ${entries.length === 1 ? 'Eintrag' : 'Einträge'} werden endgültig gelöscht. Das lässt sich nicht rückgängig machen.`,
            confirmLabel: 'Endgültig löschen',
            onConfirm: () => { const n = S.emptyTrash(); renderTrash(); toast(`${n} ${n === 1 ? 'Eintrag' : 'Einträge'} gelöscht`); },
          }),
        }),
      ]),
    ]),
  );
}

function trashRow(e, isDark) {
  const rest = S.trashDaysLeft(e);
  // Zwei Zeilen statt einer: In einer einzigen wurde die Restlaufzeit
  // abgeschnitten – ausgerechnet die Angabe, nach der man hier entscheidet.
  const what = [KIND_LABEL[e.kind], e.detail].filter(Boolean).join(' · ');
  const when = `${timeAgo(e.at)} · noch ${rest} ${rest === 1 ? 'Tag' : 'Tage'}`;

  const restore = el('button', {
    class: 'trash-restore', type: 'button',
    'aria-label': `${e.title} wiederherstellen`,
    html: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>',
  });
  restore.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const r = S.restoreTrash(e.id);
    haptic(14);
    applyAll();
    renderTrash();
    toast(r.note ? `„${r.title}" ist zurück. ${r.note}` : `„${r.title}" ist zurück.`, r.note ? 5200 : 2200);
  });

  const row = el('div', {
    class: `row tappable${e.color ? ' tinted' : ''}`,
    style: e.color ? S.tintStyle(e.color, isDark) : null,
  }, [
    el('div', { class: 'row-emoji', text: e.emoji || KIND_ICON[e.kind] }),
    el('div', { class: 'row-body' }, [
      el('div', { class: 'row-title', text: e.title }),
      el('div', { class: 'row-meta' }, [el('span', { text: what })]),
      el('div', { class: 'row-note', text: when }),
    ]),
    restore,
  ]);

  // Ein Tipp auf die Zeile ist der Weg zum endgültigen Löschen – der häufigere
  // Fall, das Zurückholen, sitzt als eigener Knopf rechts.
  row.addEventListener('click', () => confirmSheet({
    title: 'Endgültig löschen?',
    message: `„${e.title}" wird unwiderruflich entfernt${e.detail ? ` (${e.detail})` : ''}.`,
    confirmLabel: 'Endgültig löschen',
    onConfirm: () => { S.purgeTrash(e.id); renderTrash(); toast('Endgültig gelöscht'); },
  }));
  return row;
}
