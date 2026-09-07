/* Einstellungen und Backup. Die Daten liegen nur in diesem Browser – deshalb
   ist der Export bewusst prominent und bietet mehrere Wege an, weil iOS je
   nach Kontext mal das Teilen-Menü und mal einen Download anbietet. */

import { $, el } from './util.js';
import * as S from './store.js';
import { group, settingRow, segmented, switchBtn, toast, openSheet, confirmSheet } from './ui.js';

let applyAll = () => {};
export function bindApply(fn) { applyAll = fn; }

export function renderSettings() {
  const set = S.settings();
  const scroll = $('#settings-scroll');

  const put = (key, value) => { S.setSetting(key, value); applyAll(); };

  scroll.replaceChildren(
    group('Habits', [
      settingRow({
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
        title: 'Größe der Zeilen',
        desc: 'Gilt für Habits und Todos.',
        control: segmented(
          [{ id: 'small', label: 'Klein' }, { id: 'medium', label: 'Mittel' }, { id: 'large', label: 'Groß' }],
          set.rowSize, v => put('rowSize', v),
        ),
      }),
      settingRow({
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
        title: 'Tageswechsel um 3 Uhr',
        desc: 'Was du nach Mitternacht abhakst, zählt noch zum Vortag.',
        control: switchBtn(set.dayStart === 3, on => put('dayStart', on ? 3 : 0)),
      }),
    ]),

    group('Backup', [
      settingRow({
        title: 'Daten sichern',
        desc: 'Als Datei teilen oder laden – am besten regelmäßig.',
        control: chevron(),
        onClick: exportData,
      }),
      settingRow({
        title: 'Daten wiederherstellen',
        desc: 'Aus einer zuvor gesicherten Datei einlesen.',
        control: chevron(),
        onClick: importData,
      }),
    ]),

    group('Zurücksetzen', [
      settingRow({
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
