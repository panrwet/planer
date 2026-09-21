/* Browser-Prüfungen im iPhone-Format.
 *
 *   npm i playwright && node test/browser.mjs
 *
 * Zwei Arten von Eingaben werden geprüft: mit dem Zeiger (schnell, deckt die
 * Logik ab) und mit echten Berührungen über das Debug-Protokoll. Letzteres ist
 * unverzichtbar – `touch-action` wirkt nur bei echten Berührungen, und genau
 * dort ist das Sortieren per Ziehen schon einmal stillschweigend ausgefallen,
 * während alle Zeiger-Prüfungen grün blieben.
 */

import { chromium, devices } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SHOTS = process.env.SHOTS || '';
const CHROME = process.env.CHROME_PATH || undefined;

/* ---------- kleiner Dateiserver ---------- */
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png',
};
const server = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  r.end(fs.readFileSync(f));
});
await new Promise(r => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}/index.html`;

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
const ctx = await browser.newContext({ ...devices['iPhone 14'], hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);

const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));

/* ---------- Hilfen ---------- */
const wait = (ms) => page.waitForTimeout(ms);
const dump = () => page.evaluate(async () => JSON.parse((await import('/js/store.js')).exportJSON()));
const overview = () => page.evaluate(async () => (await import('/js/store.js')).overview());
const shot = (n) => (SHOTS ? page.screenshot({ path: `${SHOTS}/${n}.png` }) : Promise.resolve());

/** Sichtbarer Aufgabenbaum als "A, __B, C" – Einrückung als zwei Unterstriche. */
const tree = () => page.evaluate(() => [...document.querySelectorAll('#todo-list .todo-wrap')]
  .map(n => `${'__'.repeat(Number(n.dataset.depth))}${n.querySelector('.row-title').textContent}`).join(', '));

async function clearOverlays() {
  for (let i = 0; i < 3; i++) {
    const open = await page.evaluate(() =>
      !!document.querySelector('#sheet-host:not([hidden]), #dropup-host:not([hidden])'));
    if (!open) return;
    await page.keyboard.press('Escape');
    await wait(320);
  }
}

let passed = 0, failed = 0;
const step = async (name, fn) => {
  try { await fn(); passed++; console.log(`  ok   ${name}`); }
  catch (e) {
    failed++;
    /* Bei Playwright steht der Grund im Aufrufprotokoll ("intercepts pointer
       events", "not visible"). Ohne ihn ist eine Zeitüberschreitung nicht zu
       deuten – und genau das kostet beim Suchen die meiste Zeit. */
    const lines = e.message.split('\n').map(l => l.trim()).filter(Boolean);
    const why = lines.slice(1).find(l =>
      /intercepts pointer|not visible|not stable|not enabled|outside of the viewport|resolved to \d/.test(l));
    const msg = lines[0] + (why ? ` – ${why}` : '');
    console.log(`  FAIL ${name}\n       ${msg}`);
    errors.push(`${name}: ${msg}`);
    if (process.env.VERBOSE) console.log(e.message.split('\n').slice(0, 14).map(l => '       | ' + l).join('\n'));
  }
  await clearOverlays();
};
const group = (t) => console.log(`\n=== ${t} ===`);

/** Echte Berührung über das Debug-Protokoll – nur so greift touch-action. */
const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', {
  type,
  touchPoints: type === 'touchEnd' ? [] : [{ x, y, radiusX: 12, radiusY: 12, force: 1 }],
});

/** Mit dem Zeiger nach rechts wischen, ohne loszulassen. */
async function swipeRight(title, dx) {
  const row = page.locator('#todo-list .todo-wrap').filter({ hasText: title }).locator('.row').first();
  const b = await row.boundingBox();
  await page.mouse.move(b.x + 40, b.y + b.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(b.x + 40 + (dx * i) / 8, b.y + b.height / 2);
    await wait(18);
  }
  await wait(120);
}

/* ---------- Ausgangslage ---------- */
const at = (d) => {
  const x = new Date();
  x.setDate(x.getDate() + d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

async function seed() {
  await page.goto(BASE);
  await wait(350);
  await page.evaluate((days) => {
    localStorage.setItem('planer.v1', JSON.stringify({
      v: 4,
      settings: { doneHabits: 'hide', rowSize: 'medium', theme: 'system', dayStart: 0,
                  doneTodos: 'hide', lastListId: 'l1', groups: {}, recentEmoji: [] },
      habits: [
        { id: 'h1', name: 'Wasser trinken', emoji: '💧', color: 'blue', unit: 'glass', target: 2, sched: 'day', days: [1,2,3,4,5], created: days[-30], order: 0 },
        { id: 'h2', name: 'Vitamine', emoji: '💊', color: 'amber', unit: 'count', target: 1, sched: 'day', days: [1,2,3,4,5], created: days[-30], order: 1 },
        { id: 'h3', name: 'Laufen', emoji: '🏃', color: 'green', unit: 'km', target: 5, sched: 'days', days: [1,3,5], created: days[-30], order: 2 },
        { id: 'h4', name: 'Lesen', emoji: '📖', color: 'violet', unit: 'page', target: 60, sched: 'week', days: [1,2,3,4,5], created: days[-30], order: 3 },
        { id: 'h5', name: 'Fenster putzen', emoji: '🪟', color: 'cyan', unit: 'count', target: 2, sched: 'month', days: [1], created: days[-60], order: 4 },
      ],
      log: { h1: { [days[-1]]: 2, [days[-2]]: 2 }, h4: { [days[0]]: 20 } },
      lists: [
        { id: 'l1', name: 'Einkaufen', emoji: '🛒', color: 'green', order: 0 },
        { id: 'l2', name: 'Haushalt', emoji: '🏠', color: 'blue', order: 1 },
      ],
      todos: [
        { id: 't1', listId: 'l1', title: 'Milch', color: '', note: '', due: days[-3], done: false, doneAt: '', parent: null, order: 0 },
        { id: 't2', listId: 'l1', title: 'Brot', color: '', note: 'Vollkorn', due: days[0], done: false, doneAt: '', parent: null, order: 1 },
        { id: 't3', listId: 'l1', title: 'Käse', color: '', note: '', due: days[1], done: false, doneAt: '', parent: null, order: 2 },
        { id: 't4', listId: 'l2', title: 'Fenster putzen', color: '', note: '', due: days[4], done: false, doneAt: '', parent: null, order: 3 },
        { id: 't5', listId: 'l2', title: 'Steuer sortieren', color: '', note: 'Belege 2025', due: '', done: false, doneAt: '', parent: null, order: 4 },
        { id: 't6', listId: 'l2', title: 'Altpapier', color: '', note: '', due: days[-8], done: false, doneAt: '', parent: null, order: 5 },
        { id: 't7', listId: 'l1', title: 'Butter', color: '', note: '', due: '', done: true, doneAt: new Date().toISOString(), parent: null, order: 6 },
      ],
    }));
  }, Object.fromEntries([-60, -30, -8, -3, -2, -1, 0, 1, 4].map(d => [d, at(d)])));
  await page.reload();
  await wait(650);
}

await seed();

/* ========================================================================== */
group('Startseite');

await step('startet auf der Startseite mit Begrüßung', async () => {
  if (!await page.locator('#screen-home').isVisible()) throw new Error('nicht sichtbar');
  const g = await page.locator('#home-greeting').innerText();
  if (!/Gute[nr]? (Morgen|Tag|Abend|Nacht)/.test(g)) throw new Error(`Begrüßung: ${g}`);
});

await step('Habits-Zahlen stimmen mit dem Bestand', async () => {
  const o = await overview();
  const card = await page.locator('#home-scroll .home-card').first().innerText();
  if (!card.includes(String(o.habits.done)) || !card.includes(String(o.habits.due))) {
    throw new Error(card.replace(/\n/g, ' | '));
  }
  const dots = await page.locator('.home-dot').count();
  if (dots !== o.habits.due) throw new Error(`${dots} Punkte, ${o.habits.due} fällig`);
  const filled = await page.locator('.home-dot.filled').count();
  if (filled !== o.habits.done) throw new Error(`${filled} gefüllt, ${o.habits.done} erledigt`);
});

await step('Habits nach Rhythmus, Summe passt', async () => {
  const o = await overview();
  const rows = await page.locator('.home-split-row').count();
  if (rows !== o.habits.byInterval.length) throw new Error(`${rows} Zeilen, ${o.habits.byInterval.length} Intervalle`);
  const sum = o.habits.byInterval.reduce((n, g) => n + g.due, 0);
  if (sum !== o.habits.due) throw new Error(`Summe ${sum} ≠ fällig ${o.habits.due}`);
});

await step('Aufgaben-Kennzahlen rechnen auf', async () => {
  const o = await overview();
  const map = {};
  for (const n of await page.locator('.home-stat').allInnerTexts()) {
    const [v, l] = n.split('\n');
    map[l] = Number(v);
  }
  const want = { insgesamt: o.todos.total, offen: o.todos.open, erledigt: o.todos.done, 'überfällig': o.todos.overdue.length };
  for (const [l, v] of Object.entries(want)) if (map[l] !== v) throw new Error(`${l}: ${map[l]} statt ${v}`);
  if (map.offen + map.erledigt !== map.insgesamt) throw new Error('Summe geht nicht auf');
});

await step('Überfällig antippen und dort abhaken', async () => {
  const before = (await overview()).todos.overdue.length;
  await page.locator('.home-bucket').filter({ hasText: 'Überfällig' }).tap();
  await wait(450);
  if (!await page.locator('.sheet-body .row').count()) throw new Error('Sheet leer');
  await page.locator('.sheet-body .row .check').first().tap();
  await wait(400);
  const after = (await overview()).todos.overdue.length;
  if (after !== before - 1) throw new Error(`${before} → ${after}`);
});
await shot('01-start');

/* ========================================================================== */
group('Suche');

await step('findet über alle Bereiche, auch in Notizen', async () => {
  await page.locator('.tab[data-goto=home]').tap();
  await wait(300);
  await page.locator('.home-tile').filter({ hasText: 'Suchen' }).tap();
  await wait(450);
  for (const [q, want] of [['wasser', 'Wasser trinken'], ['einkauf', 'Einkaufen'],
                           ['vollkorn', 'Brot'], ['belege', 'Steuer sortieren'], ['dunkel', 'Design']]) {
    await page.locator('#search-input').fill(q);
    await wait(300);
    const txt = await page.locator('#search-scroll').innerText();
    if (!txt.includes(want)) throw new Error(`"${q}" findet "${want}" nicht`);
  }
});

await step('Treffer hervorgehoben, Unsinn sauber gemeldet', async () => {
  await page.locator('#search-input').fill('ein');
  await wait(300);
  if (!await page.locator('#search-scroll mark').count()) throw new Error('keine Hervorhebung');
  await page.locator('#search-input').fill('xyzqwertz');
  await wait(300);
  if (!(await page.locator('#search-scroll').innerText()).includes('Nichts gefunden')) throw new Error('keine Meldung');
  await page.locator('#search-back').tap();
  await wait(300);
});

/* ========================================================================== */
group('Editoren');

const FIELDS = {
  habit: ['NAME', 'FARBE', 'WIE OFT', 'WAS WIRD GEZÄHLT?', 'WIE VIELE'],
  todo: ['NAME', 'FARBE', 'FÄLLIG AM', 'NOTIZ', 'UNTERAUFGABEN'],
  list: ['NAME', 'FARBE'],
};

await step('Habit-Editor: Reihenfolge, Emoji in der Namenszeile', async () => {
  await page.locator('.tab[data-goto=habits]').tap();
  await wait(350);
  await page.locator('#habit-add').tap();
  await wait(500);
  const labels = await page.locator('.sheet-body .field-label').allInnerTexts();
  if (JSON.stringify(labels) !== JSON.stringify(FIELDS.habit)) throw new Error(labels.join(' > '));
  const box = await page.locator('.emoji-box').boundingBox();
  const name = await page.locator('.name-row .input').boundingBox();
  if (box.x >= name.x || Math.abs(box.y - name.y) > 4) throw new Error('Emoji nicht links in derselben Zeile');
});

await step('Emoji-Vorschläge folgen dem Namen', async () => {
  await page.locator('.tab[data-goto=habits]').tap();
  await wait(300);
  await page.locator('#habit-add').tap();
  await wait(500);
  await page.locator('.name-row .input').fill('Zähne putzen');
  await wait(400);
  if (!(await page.locator('.emoji-strip-label').first().innerText()).includes('Passend')) throw new Error('kein Vorschlags-Label');
  const first = await page.locator('.emoji-strip').first().locator('.emoji-pick').first().innerText();
  if (first !== '🪥') throw new Error(`erster Vorschlag ${first}`);
  const scrollable = await page.locator('.emoji-strip').first().evaluate(n => n.scrollWidth > n.clientWidth + 1);
  if (!scrollable) throw new Error('Zeile nicht wischbar');
});

await step('Aufgaben-Editor: kein Emoji, dafür Fälligkeit, Notiz, Unteraufgaben', async () => {
  await page.locator('.tab[data-goto=todos]').tap();
  await wait(400);
  await page.locator('#todo-add').tap();
  await wait(500);
  const labels = await page.locator('.sheet-body .field-label').allInnerTexts();
  if (JSON.stringify(labels) !== JSON.stringify(FIELDS.todo)) throw new Error(labels.join(' > '));
  if (await page.locator('.emoji-box').count()) throw new Error('Aufgabe hat ein Emoji-Feld');
});

await step('Listen-Editor gleich aufgebaut', async () => {
  await page.locator('#list-menu').tap();
  await wait(400);
  await page.locator('.dropup-item', { hasText: 'Neue Liste' }).tap();
  await wait(500);
  const labels = await page.locator('.sheet-body .field-label').allInnerTexts();
  if (JSON.stringify(labels) !== JSON.stringify(FIELDS.list)) throw new Error(labels.join(' > '));
  if (!await page.locator('.name-row .emoji-box').count()) throw new Error('kein Emoji in der Namenszeile');
});

/* ========================================================================== */
group('Unteraufgaben');

// Frischer Stand: Die Startseite hakt weiter oben die überfällige "Milch" ab,
// die dann ausgeblendet ist. Diese Gruppe braucht alle drei Zeilen.
await seed();

await step('kurzes Wischen zeigt den Knopf, Antippen rückt ein', async () => {
  await page.locator('.tab[data-goto=todos]').tap();
  await wait(450);
  await swipeRight('Brot', 60);
  await page.mouse.up();
  await wait(350);
  const txt = await page.locator('.swipe-action').first().innerText();
  if (!/Einrücken/.test(txt)) throw new Error(`Knopf: "${txt}"`);
  await page.locator('.swipe-action').first().tap();
  await wait(450);
  if (!(await tree()).includes('__Brot')) throw new Error(await tree());
});
await shot('02-eingerueckt');

await step('weites Wischen löst sofort aus', async () => {
  await swipeRight('Käse', 150);
  await page.mouse.up();
  await wait(500);
  if (!(await tree()).includes('__Käse')) throw new Error(await tree());
});

await step('eingerückte Zeile bietet Ausrücken an', async () => {
  await swipeRight('Käse', 60);
  await page.mouse.up();
  await wait(350);
  if (!/Ausrücken/.test(await page.locator('.swipe-action').first().innerText())) throw new Error('falscher Knopf');
  await page.locator('.swipe-action').first().tap();
  await wait(450);
  if ((await tree()).includes('__Käse')) throw new Error('nicht ausgerückt');
});

await step('erste Zeile lässt sich nicht einrücken', async () => {
  const before = await tree();
  await swipeRight('Milch', 150);
  await page.mouse.up();
  await wait(450);
  if (await tree() !== before) throw new Error('hat sich verändert');
});

await step('offener Knopf schließt beim Wischen woanders', async () => {
  await swipeRight('Käse', 60);
  await page.mouse.up();
  await wait(300);
  await swipeRight('Brot', 60);
  await page.mouse.up();
  await wait(350);
  const open = await page.evaluate(() => document.querySelectorAll('.row.swiped').length);
  if (open > 1) throw new Error(`${open} offen`);
});

await step('schließender Tipp löst sonst nichts aus', async () => {
  await swipeRight('Käse', 60);
  await page.mouse.up();
  await wait(350);
  const before = await dump();
  // Auf den Abhak-Knopf einer anderen Zeile tippen: schließt nur.
  await page.locator('#todo-list .todo-wrap').filter({ hasText: 'Brot' })
    .first().locator('.check').tap();
  await wait(350);
  if (await page.locator('.swipe-action').count()) throw new Error('Knopf blieb offen');
  if (await page.locator('.sheet-host:not([hidden])').count()) throw new Error('Editor ging auf');
  const after = await dump();
  const done = (d) => d.todos.filter(t => t.done).map(t => t.title).join(',');
  if (done(before) !== done(after)) throw new Error(`abgehakt: ${done(before)} → ${done(after)}`);
  // Der zweite Tipp wirkt dann wie immer.
  await page.locator('#todo-list .todo-wrap').filter({ hasText: 'Brot' })
    .first().locator('.check').tap();
  await wait(350);
  if (!(await dump()).todos.find(t => t.title === 'Brot').done) throw new Error('zweiter Tipp wirkungslos');
});

/* Der Stand ist jetzt verbraucht: "Brot" ist abgehakt und zieht als einziges
   Kind seine Überaufgabe "Milch" mit, die damit ausgeblendet ist – richtig so,
   aber die Editor-Prüfungen brauchen sie wieder. */
await seed();
await page.locator('.tab[data-goto=todos]').tap();
await wait(450);

await step('Unteraufgaben im Editor anlegen, abhaken, entfernen', async () => {
  await page.locator('#todo-list .todo-wrap').filter({ hasText: 'Milch' }).first().locator('.row-body').tap();
  await wait(500);
  await page.locator('.sheet-body input[placeholder*="Unteraufgabe"]').fill('Sahne');
  await page.keyboard.press('Enter');
  await wait(400);
  const row = page.locator('.sub-row').filter({ hasText: 'Sahne' });
  if (!await row.count()) throw new Error('nicht angelegt');
  await row.locator('.sub-check').tap();
  await wait(300);
  if (!(await row.getAttribute('class')).includes('is-done')) throw new Error('nicht abgehakt');
  await row.locator('.sub-remove').tap();
  await wait(400);
  if (await page.locator('.sub-row').filter({ hasText: 'Sahne' }).count()) throw new Error('nicht entfernt');
});
await shot('03-editor-unteraufgaben');

await step('beim Neuanlegen gesammelte Unteraufgaben landen am Ziel', async () => {
  await page.locator('#todo-add').tap();
  await wait(500);
  await page.locator('.sheet-body input[type=text]').first().fill('Grillabend');
  for (const s of ['Kohle', 'Salat']) {
    await page.locator('.sheet-body input[placeholder*="Unteraufgabe"]').fill(s);
    await page.keyboard.press('Enter');
    await wait(250);
  }
  await page.locator('.sheet-head button.strong').tap();
  await wait(550);
  const t = await tree();
  if (!/Grillabend, __Kohle, __Salat/.test(t)) throw new Error(t);
});

/* ========================================================================== */
group('Aufleuchten beim Abhaken');

await step('Aufgabe leuchtet und hört wieder auf', async () => {
  const row = page.locator('#todo-list .todo-wrap').filter({ hasText: 'Käse' }).locator('.row').first();
  await row.locator('.check').tap();
  await wait(90);
  if (!await page.evaluate(() => !!document.querySelector('.row.flash-done'))) throw new Error('leuchtet nicht');
  await wait(1000);
  if (await page.evaluate(() => !!document.querySelector('.row.flash-done'))) throw new Error('hört nicht auf');
});

await step('Habit leuchtet erst beim Erreichen des Ziels', async () => {
  await page.locator('.tab[data-goto=habits]').tap();
  await wait(400);
  const row = () => page.locator('#habit-groups .row').filter({ hasText: 'Wasser' }).first();
  await row().locator('.check').tap();          // 1 von 2
  await wait(90);
  if (await page.evaluate(() => !!document.querySelector('.row.flash-done'))) throw new Error('leuchtet beim Zwischenschritt');
  await wait(350);
  await row().locator('.check').tap();          // 2 von 2
  await wait(90);
  if (!await page.evaluate(() => !!document.querySelector('.row.flash-done'))) throw new Error('leuchtet nicht am Ziel');
});

await step('Detailansicht leuchtet genauso wie die Zeile', async () => {
  // Gleiche Rückmeldung an beiden Orten: Was in der Liste leuchtet, muss auch
  // hier leuchten – sonst fühlt sich derselbe Vorgang unterschiedlich an.
  await seed();
  await page.locator('.tab[data-goto=habits]').tap();
  await wait(400);
  await page.locator('#habit-groups .row').filter({ hasText: 'Vitamine' }).first().tap();
  await wait(500);
  const plus = page.locator('#screen-detail .card .btn').filter({ hasText: /Abhaken|^\+/ }).first();
  await plus.tap();
  await wait(90);
  if (!await page.evaluate(() => !!document.querySelector('.card.flash-done'))) throw new Error('leuchtet nicht');
  await wait(1000);
  if (await page.evaluate(() => !!document.querySelector('.card.flash-done'))) throw new Error('hört nicht auf');
  // Weiterzählen über das Ziel hinaus leuchtet nicht noch einmal.
  await page.locator('#screen-detail .card .btn').filter({ hasText: 'zählen' }).first().tap();
  await wait(90);
  if (await page.evaluate(() => !!document.querySelector('.card.flash-done'))) throw new Error('leuchtet beim Weiterzählen');
  await page.locator('#detail-back').tap();
  await wait(350);
});

await step('Zurücksetzen leuchtet nicht', async () => {
  await wait(1000);
  const done = page.locator('#habit-groups .section-toggle').filter({ hasText: 'Erledigt' });
  if (await done.count() && await done.getAttribute('aria-expanded') !== 'true') {
    await done.tap();
    await wait(350);
  }
  await page.locator('#habit-groups .row').filter({ hasText: 'Wasser' }).first().locator('.check').tap();
  await wait(90);
  if (await page.evaluate(() => !!document.querySelector('.row.flash-done'))) throw new Error('leuchtet');
});

/* ========================================================================== */
group('Gesten mit echten Berührungen');
/* touch-action wirkt nur hier – mit dem Zeiger blieben diese Fehler unsichtbar. */

/* Wieder frischer Stand, aber mit genug Zeilen: Die erste Prüfung erwartet,
   dass die Liste überhaupt scrollbar ist – drei Aufgaben passen auf den
   Bildschirm und würden sie stillschweigend grün ausgehen lassen. */
await seed();
await page.evaluate(async () => {
  const S = await import('/js/store.js');
  for (let i = 1; i <= 14; i++) S.addTodo('l1', { title: `Posten ${i}` });
  const T = await import('/js/todos.js');
  T.renderTodos('l1');
});
await wait(400);

await step('senkrecht wischen scrollt die Liste', async () => {
  await page.locator('.tab[data-goto=todos]').tap();
  await wait(450);
  await page.evaluate(() => { document.querySelector('#todos-scroll').scrollTop = 0; });
  await wait(200);
  const row = await page.locator('#todo-list .todo-wrap').first().locator('.row').boundingBox();
  await touch('touchStart', row.x + 150, row.y + row.height / 2);
  for (let i = 1; i <= 10; i++) { await touch('touchMove', row.x + 150, row.y + row.height / 2 - i * 22); await wait(16); }
  await touch('touchEnd', 0, 0);
  await wait(450);
  const top = await page.evaluate(() => document.querySelector('#todos-scroll').scrollTop);
  if (top < 30) throw new Error(`nur ${top} px gescrollt`);
});

await step('waagerecht wischen rückt ein', async () => {
  await page.evaluate(() => { document.querySelector('#todos-scroll').scrollTop = 0; });
  await wait(250);
  const target = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#todo-list .todo-wrap')];
    const i = rows.findIndex((n, k) => k > 0 && Number(n.dataset.depth) === 0);
    return i > 0 ? rows[i].querySelector('.row-title').textContent : null;
  });
  if (!target) throw new Error('keine passende Zeile');
  const b = await page.locator('#todo-list .todo-wrap').filter({ hasText: target }).first().locator('.row').boundingBox();
  await touch('touchStart', b.x + 60, b.y + b.height / 2);
  for (let i = 1; i <= 8; i++) { await touch('touchMove', b.x + 60 + i * 9, b.y + b.height / 2); await wait(16); }
  await touch('touchEnd', 0, 0);
  await wait(450);
  if (!await page.locator('.swipe-action').count()) throw new Error('kein Knopf');
  await page.evaluate(() => document.querySelector('.swipe-action')?.click());
  await wait(450);
});

await step('halten und ziehen sortiert um, ohne zu scrollen', async () => {
  await page.evaluate(() => { document.querySelector('#todos-scroll').scrollTop = 0; });
  await wait(250);
  const before = await tree();
  const idx = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#todo-list .todo-wrap')];
    for (let i = 0; i < rows.length - 1; i++) {
      if (Number(rows[i + 1].dataset.depth) <= Number(rows[i].dataset.depth)) return i;
    }
    return -1;
  });
  if (idx < 0) throw new Error('keine kinderlose Zeile');
  const b = await page.locator('#todo-list .todo-wrap').nth(idx).locator('.row').boundingBox();
  await touch('touchStart', b.x + 150, b.y + b.height / 2);
  await wait(650);
  if (!await page.evaluate(() => document.body.classList.contains('is-dragging'))) throw new Error('nicht angehoben');
  for (let i = 1; i <= 10; i++) { await touch('touchMove', b.x + 150, b.y + b.height / 2 + i * 14); await wait(16); }
  await touch('touchEnd', 0, 0);
  await wait(600);
  if (await tree() === before) throw new Error(`Reihenfolge unverändert:\n${before}`);
  const top = await page.evaluate(() => document.querySelector('#todos-scroll').scrollTop);
  if (top > 20) throw new Error(`hat beim Ziehen gescrollt (${top} px)`);
});

await step('abhaken per Berührung', async () => {
  const before = (await dump()).todos.filter(t => t.done).length;
  const chk = await page.locator('#todo-list .todo-wrap').first().locator('.check').boundingBox();
  await touch('touchStart', chk.x + chk.width / 2, chk.y + chk.height / 2);
  await wait(60);
  await touch('touchEnd', 0, 0);
  await wait(450);
  const after = (await dump()).todos.filter(t => t.done).length;
  if (after === before) throw new Error('nichts abgehakt');
});

/* ========================================================================== */
group('Abhaken bleibt flüssig');

await step('die Zeile wird aufgefrischt, nicht ersetzt', async () => {
  await seed();
  await page.locator('.tab[data-goto=todos]').tap();
  await wait(450);
  // Zeile und Knopf markieren – überlebt die Markierung das Abhaken?
  const marked = await page.evaluate(() => {
    const wrap = document.querySelector('#todo-list .todo-wrap');
    wrap.dataset.probe = 'ja';
    wrap.querySelector('.check').dataset.probe = 'ja';
    return wrap.querySelector('.row-title').textContent;
  });
  // Eine andere Zeile abhaken: die markierte darf gar nicht angefasst werden
  await page.locator('#todo-list .todo-wrap').filter({ hasText: 'Käse' })
    .first().locator('.check').tap();
  await wait(120);
  const still = await page.evaluate(() => {
    const wrap = document.querySelector('#todo-list .todo-wrap[data-probe]');
    return { wrap: !!wrap, check: !!wrap?.querySelector('.check[data-probe]') };
  });
  if (!still.wrap || !still.check) throw new Error(`${marked}: Zeile neu gebaut (${JSON.stringify(still)})`);
});

await step('der Fortschrittsring wandert, statt zu springen', async () => {
  // Ein Habit mit Ziel 3: Nach dem ersten Tipp muss derselbe Knopf noch da
  // sein – nur dann läuft der CSS-Übergang des Rings überhaupt.
  await seed();
  await page.locator('.tab[data-goto=habits]').tap();
  await wait(450);
  const before = await page.evaluate(() => {
    const row = [...document.querySelectorAll('#habit-groups .row')].find(r => /Wasser/.test(r.textContent));
    row.querySelector('.check').dataset.probe = 'ja';
    return row.querySelector('.prog').getAttribute('stroke-dashoffset');
  });
  await page.locator('#habit-groups .row').filter({ hasText: 'Wasser' }).first().locator('.check').tap();
  await wait(150);
  const after = await page.evaluate(() => {
    const b = document.querySelector('#habit-groups .check[data-probe]');
    return b ? b.querySelector('.prog').getAttribute('stroke-dashoffset') : null;
  });
  if (after === null) throw new Error('Knopf wurde ersetzt – der Ring kann nicht laufen');
  if (after === before) throw new Error(`Fortschritt unverändert (${before})`);
});

await step('abgehakte Aufgabe leuchtet erst, verschwindet dann', async () => {
  await seed();
  await page.locator('.tab[data-goto=todos]').tap();
  await wait(450);
  const row = page.locator('#todo-list .todo-wrap').filter({ hasText: 'Brot' }).first();
  await row.locator('.check').tap();
  await wait(120);
  const t1 = await page.evaluate(() => {
    const w = [...document.querySelectorAll('#todo-list .todo-wrap')].find(n => /Brot/.test(n.textContent));
    return { da: !!w, leuchtet: !!w?.querySelector('.row.flash-done'), faellt: !!w?.classList.contains('leaving') };
  });
  if (!t1.da) throw new Error('sofort verschwunden');
  if (!t1.leuchtet) throw new Error('leuchtet nicht');
  if (t1.faellt) throw new Error('fällt schon zusammen, während es leuchtet');

  await wait(1400);
  const t2 = await page.evaluate(() => {
    const w = [...document.querySelectorAll('#todo-list .todo-wrap')].find(n => /Brot/.test(n.textContent));
    const erledigt = [...document.querySelectorAll('#todos-done .row-title')].map(n => n.textContent);
    return { nochDa: !!w, erledigt };
  });
  if (t2.nochDa) throw new Error('bleibt in der Liste stehen');
  if (!t2.erledigt.includes('Brot')) throw new Error(`nicht unter Erledigt: ${t2.erledigt.join(', ')}`);
});

await step('Zähler in Kopfzeile und Listen-Reiter ziehen mit', async () => {
  await seed();
  await page.locator('.tab[data-goto=todos]').tap();
  await wait(450);
  const lies = () => page.evaluate(() => ({
    kopf: document.querySelector('#todos-subtitle').textContent,
    reiter: document.querySelector('#list-tabs .list-tab.active .list-tab-badge')?.textContent || '',
  }));
  const vorher = await lies();
  await page.locator('#todo-list .todo-wrap').filter({ hasText: 'Käse' }).first().locator('.check').tap();
  await wait(200);
  const nachher = await lies();
  if (nachher.kopf === vorher.kopf) throw new Error(`Kopfzeile unverändert: ${vorher.kopf}`);
  if (nachher.reiter === vorher.reiter) throw new Error(`Reiter unverändert: ${vorher.reiter}`);
});

/* ========================================================================== */
group('Zuletzt gelöscht');

await step('gelöschte Aufgabe liegt im Papierkorb und kommt zurück', async () => {
  await seed();
  await page.locator('.tab[data-goto=todos]').tap();
  await wait(450);
  await page.locator('#todo-list .todo-wrap').filter({ hasText: 'Milch' }).first().locator('.row-body').tap();
  await wait(500);
  await page.locator('.sheet-body .btn.danger, .sheet-body button').filter({ hasText: /löschen/i }).first().tap();
  await wait(400);
  await page.locator('.sheet-host button').filter({ hasText: /löschen/i }).last().tap();
  await wait(500);
  if ((await tree()).includes('Milch')) throw new Error('nicht gelöscht');

  await page.locator('.tab[data-goto=home]').tap();
  await wait(320);
  await page.locator('.home-tile').filter({ hasText: 'Einstellungen' }).tap();
  await wait(450);
  await page.locator('[data-setting="trash"]').tap();
  await wait(450);
  const zeilen = await page.locator('#trash-scroll .row-title').allInnerTexts();
  if (!zeilen.includes('Milch')) throw new Error(`Papierkorb: ${zeilen.join(', ')}`);

  await page.locator('#trash-scroll .row').filter({ hasText: 'Milch' }).locator('.trash-restore').tap();
  await wait(550);
  if ((await page.locator('#trash-scroll .row-title').allInnerTexts()).includes('Milch')) {
    throw new Error('bleibt im Papierkorb stehen');
  }
  await page.locator('.tab[data-goto=todos]').tap();
  await wait(450);
  if (!(await tree()).includes('Milch')) throw new Error(`nicht zurück: ${await tree()}`);
});

await step('endgültig löschen räumt den Papierkorb', async () => {
  await page.evaluate(async () => {
    const S = await import('/js/store.js');
    S.deleteTodo(S.getData().todos.find(t => t.title === 'Käse').id);
  });
  await page.locator('.tab[data-goto=home]').tap();
  await wait(300);
  await page.locator('.home-tile').filter({ hasText: 'Einstellungen' }).tap();
  await wait(450);
  await page.locator('[data-setting="trash"]').tap();
  await wait(450);
  if (!await page.locator('#trash-scroll .row').count()) throw new Error('Papierkorb leer');
  await page.locator('.setting').filter({ hasText: 'Papierkorb leeren' }).tap();
  await wait(400);
  await page.locator('.sheet-host button').filter({ hasText: /Endgültig/i }).last().tap();
  await wait(500);
  if (await page.locator('#trash-scroll .row').count()) throw new Error('nicht geleert');
  if (!await page.locator('#trash-scroll .empty').count()) throw new Error('kein Hinweis auf den leeren Papierkorb');
});

/* ========================================================================== */
group('Farbstärke und Tippfehler-Suche');

await step('Farbstärke ändert die Tönung sichtbar', async () => {
  await seed();
  const toene = {};
  for (const stufe of ['off', 'soft', 'normal', 'strong']) {
    await page.evaluate(async (s) => {
      const S = await import('/js/store.js');
      S.setSetting('saturation', s);
      document.documentElement.dataset.tint = s;
    }, stufe);
    await page.locator('.tab[data-goto=habits]').tap();
    await wait(330);
    toene[stufe] = await page.evaluate(() => {
      const row = document.querySelector('#habit-groups .row.tinted');
      const cs = getComputedStyle(row);
      return `${cs.backgroundColor}|${cs.borderTopColor}`;
    });
  }
  const eindeutig = new Set(Object.values(toene));
  if (eindeutig.size !== 4) throw new Error(`Stufen nicht unterscheidbar: ${JSON.stringify(toene)}`);
  await page.evaluate(async () => {
    const S = await import('/js/store.js');
    S.setSetting('saturation', 'normal');
    document.documentElement.dataset.tint = 'normal';
  });
});

await step('Suche findet trotz Tippfehler und markiert die Stelle', async () => {
  await page.locator('.tab[data-goto=home]').tap();
  await wait(320);
  await page.locator('.home-tile').filter({ hasText: 'Suchen' }).tap();
  await wait(420);
  await page.locator('#search-input').fill('Vitmine');
  await wait(420);
  const treffer = await page.locator('#search-scroll .row-title').allInnerTexts();
  if (!treffer.some(t => /Vitamine/.test(t))) throw new Error(`gefunden: ${treffer.join(', ') || 'nichts'}`);
  const markiert = await page.locator('#search-scroll mark').first().innerText();
  if (markiert !== 'Vitamine') throw new Error(`markiert: „${markiert}"`);

  await page.locator('#search-input').fill('Zitronenpresse');
  await wait(420);
  if (!await page.locator('#search-scroll .empty').count()) throw new Error('Unsinn liefert Treffer');
});

/* ========================================================================== */
group('Kalender');

/** Setzt Planung über den Store und öffnet den Kalender. */
async function seedPlan() {
  await seed();
  await page.evaluate(async () => {
    const S = await import('/js/store.js');
    const t = S.today();
    const add = (k, n) => { const d = new Date(`${k}T12:00:00`); d.setDate(d.getDate() + n);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    const wasser = S.habits().find(h => h.name === 'Wasser trinken');   // täglich
    const fenster = S.habits().find(h => h.name === 'Fenster putzen');  // monatlich
    const milch = S.getData().todos.find(x => x.title === 'Milch');
    S.addPlan({ kind: 'habit', refId: wasser.id, date: t, time: '07:00', minutes: 60 });
    S.addPlan({ kind: 'todo', refId: milch.id, date: t, time: '07:30', minutes: 30 });
    S.addPlan({ kind: 'habit', refId: fenster.id, date: add(t, 2), time: '15:00' });
    window.__t = t;
  });
  await page.locator('.tab[data-goto=calendar]').tap();
  await wait(450);
}

await step('vierter Reiter rechts neben der Startseite', async () => {
  const reiter = await page.locator('#tabbar .tab').evaluateAll(
    ns => ns.map(n => [n.dataset.goto, n.textContent.trim()]));
  if (JSON.stringify(reiter) !== JSON.stringify(
      [['home', 'Start'], ['calendar', 'Kalender'], ['habits', 'Habits'], ['todos', 'Todos']])) {
    throw new Error(JSON.stringify(reiter));
  }
});

await step('Monatsraster mit Wochentagen, heute im Kreis', async () => {
  await seedPlan();
  if (!await page.locator('#screen-calendar').isVisible()) throw new Error('nicht sichtbar');
  // innerText liefert, was zu sehen ist – das Stylesheet setzt die Kürzel in
  // Großbuchstaben. Verglichen wird deshalb ohne Rücksicht auf Groß/Klein.
  const tage = await page.locator('.cal-weekdays span').allInnerTexts();
  if (tage.join('').toLowerCase() !== 'modimidofrsaso') throw new Error(tage.join(' '));
  const zellen = await page.locator('.cal-day').count();
  if (zellen % 7 || zellen < 28 || zellen > 42) throw new Error(`${zellen} Zellen`);
  if (await page.locator('.cal-day.today').count() !== 1) throw new Error('heute nicht eindeutig');
});

await step('Raster läuft lückenlos durch, auch über die Monatsgrenze', async () => {
  // Die nachlaufenden Tage zählten einmal 3, 4, 5, 6 statt 1, 2, 3, 4.
  const keys = await page.locator('.cal-day').evaluateAll(ns => ns.map(n => n.dataset.key));
  const tag = (k) => new Date(`${k}T12:00:00`).getTime();
  for (let i = 1; i < keys.length; i++) {
    const diff = Math.round((tag(keys[i]) - tag(keys[i - 1])) / 86400000);
    if (diff !== 1) throw new Error(`${keys[i - 1]} → ${keys[i]} sind ${diff} Tage`);
  }
  const ersterWochentag = await page.evaluate(k => new Date(`${k}T12:00:00`).getDay(), keys[0]);
  if (ersterWochentag !== 1) throw new Error('beginnt nicht an einem Montag');
});

await step('Punkte nur an Tagen mit Planung', async () => {
  const gesetzt = await page.locator('.cal-day').evaluateAll(
    ns => ns.filter(n => n.querySelector('.cal-dot.on')).map(n => n.dataset.key));
  const erwartet = await page.evaluate(async () => {
    const S = await import('/js/store.js');
    return [...document.querySelectorAll('.cal-day')].map(n => n.dataset.key).filter(k => S.hasPlanOn(k));
  });
  if (JSON.stringify(gesetzt) !== JSON.stringify(erwartet)) {
    throw new Error(`${gesetzt.join(',')} statt ${erwartet.join(',')}`);
  }
  if (!gesetzt.length) throw new Error('gar keine Punkte');
});

await step('Monatswechsel und Sprung zu heute', async () => {
  const titel = () => page.locator('#calendar-title').innerText();
  const start = await titel();
  await page.locator('#calendar-next').tap();
  await wait(320);
  if (await titel() === start) throw new Error('Monat unverändert');
  if (await page.locator('#calendar-today').isHidden()) throw new Error('Heute-Knopf fehlt im Fremdmonat');
  await page.locator('#calendar-prev').tap();
  await wait(320);
  if (await titel() !== start) throw new Error(`zurück ergab ${await titel()}`);
  if (await page.locator('#calendar-today').isVisible()) throw new Error('Heute-Knopf steht im eigenen Monat');
});

/* ========================================================================== */
group('Tagesplan');

await step('Tag öffnen, Stundenraster steht', async () => {
  await seedPlan();
  await page.locator('.cal-day.today').tap();
  await wait(650);
  if (!await page.locator('#screen-day').isVisible()) throw new Error('nicht sichtbar');
  if (await page.locator('.day-hour').count() !== 24) throw new Error('nicht 24 Stunden');
  const beschriftung = await page.locator('.day-hour-label').first().innerText();
  if (beschriftung !== '00:00') throw new Error(beschriftung);
});

await step('Blöcke sitzen an ihrer Uhrzeit und verdecken sie nicht', async () => {
  const b = await page.evaluate(() => {
    const blocks = [...document.querySelectorAll('.day-block')];
    const labelRechts = Math.max(...[...document.querySelectorAll('.day-hour-label')]
      .map(n => n.getBoundingClientRect().right));
    return blocks.map(n => ({
      titel: n.querySelector('.day-block-name').textContent,
      top: parseFloat(n.style.top),
      hoehe: parseFloat(n.style.height),
      links: n.getBoundingClientRect().left,
      labelRechts,
    }));
  });
  if (b.length !== 2) throw new Error(`${b.length} Blöcke`);
  const wasser = b.find(x => /Wasser/.test(x.titel));
  if (wasser.top !== 7 * 80) throw new Error(`07:00 liegt bei ${wasser.top}px statt ${7 * 80}px`);
  if (wasser.hoehe < 75) throw new Error(`60 Minuten sind nur ${wasser.hoehe}px hoch`);
  for (const x of b) {
    if (x.links < x.labelRechts) throw new Error(`„${x.titel}" liegt über den Uhrzeiten`);
  }
});

await step('überlappende Einträge stehen nebeneinander', async () => {
  // Milch 07:30–08:00 überlappt Wasser 07:00–08:00
  const breiten = await page.locator('.day-block').evaluateAll(
    ns => ns.map(n => ({ t: n.querySelector('.day-block-name').textContent, w: Math.round(n.getBoundingClientRect().width) })));
  if (breiten.some(x => x.w > 200)) throw new Error(`überlappt, aber volle Breite: ${JSON.stringify(breiten)}`);
  const linke = await page.locator('.day-block').evaluateAll(ns => ns.map(n => Math.round(n.getBoundingClientRect().left)));
  if (new Set(linke).size !== 2) throw new Error('beide in derselben Spalte');
});

await step('der Plan springt zur ersten Uhrzeit, nicht auf Mitternacht', async () => {
  const oben = await page.evaluate(() => document.querySelector('#day-scroll').scrollTop);
  if (oben < 300) throw new Error(`nur ${oben}px gescrollt – steht noch bei 00:00`);
});

await step('Abhaken im Plan wirkt und baut den Block nicht neu', async () => {
  const vorher = await page.evaluate(async () => {
    const S = await import('/js/store.js');
    const h = S.habits().find(x => x.name === 'Wasser trinken');
    const node = [...document.querySelectorAll('.day-block')].find(n => /Wasser/.test(n.textContent));
    node.dataset.probe = 'ja';
    node.querySelector('.check').dataset.probe = 'ja';
    return { wert: S.valueOn(h.id, S.today()), ring: node.querySelector('.prog').getAttribute('stroke-dashoffset') };
  });
  await page.locator('.day-block[data-probe] .check').tap();
  await wait(120);
  const nachher = await page.evaluate(async () => {
    const S = await import('/js/store.js');
    const h = S.habits().find(x => x.name === 'Wasser trinken');
    const node = document.querySelector('.day-block[data-probe]');
    return {
      wert: S.valueOn(h.id, S.today()),
      derselbeBlock: !!node,
      derselbeKnopf: !!node?.querySelector('.check[data-probe]'),
      ring: node?.querySelector('.prog').getAttribute('stroke-dashoffset'),
    };
  });
  if (nachher.wert <= vorher.wert) throw new Error(`Wert ${vorher.wert} → ${nachher.wert}`);
  if (!nachher.derselbeBlock) throw new Error('Block wurde ersetzt');
  if (!nachher.derselbeKnopf) throw new Error('Knopf wurde ersetzt – der Ring kann nicht laufen');
  if (nachher.ring === vorher.ring) throw new Error('Fortschritt unverändert');
});

await step('Kopfzeile zählt beim Abhaken mit', async () => {
  const text = await page.locator('#day-subtitle').innerText();
  if (!/Eintr/.test(text)) throw new Error(text);
  // Beide erledigen, dann muss es dastehen
  await page.evaluate(async () => {
    const S = await import('/js/store.js');
    const h = S.habits().find(x => x.name === 'Wasser trinken');
    S.setValue(h.id, S.today(), h.target);
  });
  await page.locator('.day-block').filter({ hasText: 'Milch' }).locator('.check').tap();
  await wait(250);
  if (!/alles erledigt/.test(await page.locator('#day-subtitle').innerText())) {
    throw new Error(await page.locator('#day-subtitle').innerText());
  }
});

/* ========================================================================== */
group('Einplanen');

/** Tagesplan von heute öffnen und das Auswahl-Sheet aufziehen. Jeder Schritt
    macht das selbst: clearOverlays() schließt nach jedem Schritt alles, was
    offen ist – ein Schritt, der auf dem Sheet des vorigen aufbaut, läuft
    zwangsläufig in eine Zeitüberschreitung. */
async function openPicker() {
  await clearOverlays();          // ein offenes Sheet fängt den Tipp sonst ab
  await page.locator('.tab[data-goto=calendar]').tap();
  await wait(420);
  await page.locator('.cal-day.today').tap();
  await wait(620);
  await page.locator('#day-add').tap();
  await wait(520);
}

await step('Auswahl bietet genau die zwei Bereiche', async () => {
  await seedPlan();
  await openPicker();
  const reiter = await page.locator('.sheet-body .segmented button').allInnerTexts();
  if (JSON.stringify(reiter) !== JSON.stringify(['Habits', 'Aufgaben'])) throw new Error(reiter.join(' '));
  if (!await page.locator('.pick-list .row').count()) throw new Error('keine Habits zur Auswahl');
  await page.locator('.sheet-body .segmented button', { hasText: 'Aufgaben' }).tap();
  await wait(320);
  if (!await page.locator('.pick-list .row').count()) throw new Error('keine Aufgaben zur Auswahl');
  if (!/Neue Aufgabe/.test(await page.locator('.sheet-body .btn.secondary').innerText())) {
    throw new Error('Knopf wechselt nicht mit');
  }
});

await step('Auswahl verträgt Tippfehler wie die Suche', async () => {
  await openPicker();
  await page.locator('.sheet-body input[type=search]').fill('Vitmine');
  await wait(450);
  const treffer = await page.locator('.pick-list .row-title').allInnerTexts();
  if (!treffer.includes('Vitamine')) throw new Error(treffer.join(', ') || 'nichts');
});

await step('einplanen mit Uhrzeit, Dauer und dauerhaft', async () => {
  await openPicker();
  await page.locator('.pick-list .row', { hasText: 'Laufen' }).tap();
  await wait(560);
  const felder = (await page.locator('.sheet-body .field-label').allInnerTexts()).map(t => t.toLowerCase());
  if (JSON.stringify(felder) !== JSON.stringify(['uhrzeit', 'dauer in minuten', 'dauerhaft einplanen'])) {
    throw new Error(felder.join(' > '));
  }
  await page.locator('.sheet-body input[type=time]').fill('06:15');
  await page.locator('.sheet-body .chip', { hasText: '45 min' }).tap();
  await wait(220);
  if (!/Bis 07:00/.test(await page.locator('.sheet-body .field-hint').first().innerText())) {
    throw new Error(await page.locator('.sheet-body .field-hint').first().innerText());
  }
  await page.locator('.sheet-body .switch').tap();
  await wait(220);
  await page.locator('.sheet-head button.strong').tap();
  await wait(750);

  const e = await page.evaluate(async () => {
    const S = await import('/js/store.js');
    return S.planOn(S.today()).map(x => `${x.plan.time}/${x.plan.minutes}${x.plan.repeat ? '/dauerhaft' : ''} ${x.title}`);
  });
  if (!e.includes('06:15/45/dauerhaft Laufen')) throw new Error(e.join(' · '));
  if (!await page.locator('.day-block').filter({ hasText: 'Laufen' }).count()) throw new Error('kein Block');
});

await step('dauerhaft folgt dem Rhythmus des Habits', async () => {
  // Laufen läuft an Mo/Mi/Fr (sched 'days'). Ein dauerhafter Eintrag darf
  // deshalb nur an diesen Tagen im Plan stehen.
  const wo = await page.evaluate(async () => {
    const S = await import('/js/store.js');
    const add = (k, n) => { const d = new Date(`${k}T12:00:00`); d.setDate(d.getDate() + n);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    const t = S.today();
    const tage = S.habits().find(h => h.name === 'Laufen').days;
    const out = [];
    for (let n = 0; n <= 13; n++) {
      const k = add(t, n);
      out.push({
        k,
        dran: tage.includes(new Date(`${k}T12:00:00`).getDay()),
        geplant: S.planOn(k).some(x => x.title === 'Laufen'),
      });
    }
    return out;
  });
  const falsch = wo.filter(x => x.dran !== x.geplant);
  if (falsch.length) throw new Error(`folgt dem Rhythmus nicht: ${JSON.stringify(falsch.slice(0, 4))}`);
  if (!wo.some(x => x.geplant)) throw new Error('nirgends geplant');
  if (!wo.some(x => !x.geplant)) throw new Error('überall geplant – der Rhythmus greift nicht');
});

await step('einzelnen Tag aus der Reihe nehmen lässt die Reihe stehen', async () => {
  await page.locator('.tab[data-goto=calendar]').tap();
  await wait(420);
  await page.locator('.cal-day.today').tap();
  await wait(620);
  await page.locator('.day-block').filter({ hasText: 'Laufen' }).first().tap();
  await wait(560);
  await page.locator('.sheet-body .btn.danger').tap();
  await wait(470);
  const wahl = await page.locator('.sheet-body .btn').allInnerTexts();
  if (wahl.length !== 2) throw new Error(`Rückfrage bietet ${wahl.join(' / ')}`);
  await page.locator('.sheet-body .btn.secondary', { hasText: 'diesem Tag' }).tap();
  await wait(650);

  const r = await page.evaluate(async () => {
    const S = await import('/js/store.js');
    const add = (k, n) => { const d = new Date(`${k}T12:00:00`); d.setDate(d.getDate() + n);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    const t = S.today();
    const tage = S.habits().find(h => h.name === 'Laufen').days;
    const hat = (k) => S.planOn(k).some(x => x.title === 'Laufen');
    // Den nächsten Tag suchen, an dem Laufen überhaupt dran wäre
    let n = 1;
    while (n < 14 && !tage.includes(new Date(`${add(t, n)}T12:00:00`).getDay())) n++;
    return { heute: hat(t), spaeter: hat(add(t, n)) };
  });
  if (r.heute) throw new Error('heute noch geplant');
  if (!r.spaeter) throw new Error('die ganze Reihe ist weg');
});

await step('Standarddauer aus den Einstellungen wird übernommen', async () => {
  await page.evaluate(async () => {
    const S = await import('/js/store.js');
    S.setSetting('planMinutesHabit', 15);
    S.setSetting('planMinutesTodo', 60);
  });
  await openPicker();
  await page.locator('.pick-list .row').first().tap();
  await wait(520);
  const habitDauer = await page.locator('.sheet-body .stepper input').inputValue();
  if (habitDauer !== '15') throw new Error(`Habit: ${habitDauer} statt 15`);

  await openPicker();
  await page.locator('.sheet-body .segmented button', { hasText: 'Aufgaben' }).tap();
  await wait(340);
  await page.locator('.pick-list .row').first().tap();
  await wait(520);
  const todoDauer = await page.locator('.sheet-body .stepper input').inputValue();
  if (todoDauer !== '60') throw new Error(`Aufgabe: ${todoDauer} statt 60`);
});

/* ========================================================================== */
group('Datenerhalt');

await step('Neustart verändert nichts', async () => {
  const before = await dump();
  await page.reload();
  await wait(700);
  const after = await dump();
  delete before.exported; delete after.exported;
  if (JSON.stringify(before) === JSON.stringify(after)) return;
  const diffs = [];
  const walk = (x, y, p) => {
    if (JSON.stringify(x) === JSON.stringify(y)) return;
    if (typeof x !== 'object' || typeof y !== 'object' || !x || !y) { diffs.push(`${p}: ${JSON.stringify(x)} → ${JSON.stringify(y)}`); return; }
    for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) walk(x[k], y[k], `${p}.${k}`);
  };
  walk(before, after, '');
  throw new Error(diffs.slice(0, 4).join(' | '));
});

await step('Export und Import erhalten alles', async () => {
  const before = await dump();
  const round = await page.evaluate(async () => {
    const S = await import('/js/store.js');
    const json = S.exportJSON();
    S.resetAll();
    S.importJSON(json);
    return JSON.parse(S.exportJSON());
  });
  delete before.exported; delete round.exported;
  if (JSON.stringify(before) !== JSON.stringify(round)) throw new Error('Rundlauf verändert die Daten');
  await page.reload();
  await wait(600);
});

await step('ein zweites Fenster überschreibt nichts', async () => {
  const second = await ctx.newPage();
  await second.goto(BASE);
  await wait(600);
  await page.locator('.tab[data-goto=habits]').tap();
  await wait(350);
  await page.locator('#habit-groups .row').first().locator('.check').tap();
  await wait(400);
  const changed = await dump();
  await second.close();
  await wait(400);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('planer.v1')));
  if (JSON.stringify(changed.log) !== JSON.stringify(stored.log)) throw new Error('Stand überschrieben');
});

/* ========================================================================== */
group('Layout und Bedienbarkeit');

await step('kein Bildschirm scrollt seitlich', async () => {
  const bad = [];
  const scan = async (label) => {
    const r = await page.evaluate(() => {
      const out = [];
      if (document.documentElement.scrollWidth > window.innerWidth + 1) out.push('Seite');
      for (const sc of document.querySelectorAll('.screen.active .scroll')) {
        if (sc.scrollWidth > sc.clientWidth + 1) out.push(`${sc.id} ${sc.scrollWidth}>${sc.clientWidth}`);
      }
      return out;
    });
    bad.push(...r.map(x => `${label}/${x}`));
  };
  for (const tab of ['home', 'calendar', 'habits', 'todos']) {
    await page.locator(`.tab[data-goto=${tab}]`).tap();
    await wait(320);
    await scan(tab);
  }
  // Tagesplan hinter dem Kalender
  await page.locator('.tab[data-goto=calendar]').tap();
  await wait(300);
  await page.locator('.cal-day.today').tap();
  await wait(600);
  await scan('tagesplan');
  await page.locator('#day-back').tap();
  await wait(320);
  await page.locator('.tab[data-goto=habits]').tap();
  await wait(250);
  await page.locator('#habit-groups .row').first().tap();
  await wait(450);
  await scan('detail');
  await page.locator('#detail-back').tap();
  await wait(300);
  if (bad.length) throw new Error(bad.join(', '));
});

await step('kein "null"/"undefined"/"NaN" im Text', async () => {
  const found = [];
  const pruefe = (label, txt) => {
    for (const bad of ['null', 'undefined', 'NaN', '[object']) if (txt.includes(bad)) found.push(`${label}: ${bad}`);
  };
  for (const tab of ['home', 'calendar', 'habits', 'todos']) {
    await page.locator(`.tab[data-goto=${tab}]`).tap();
    await wait(320);
    pruefe(tab, await page.locator('.screen.active').innerText());
  }
  await page.locator('.tab[data-goto=calendar]').tap();
  await wait(300);
  await page.locator('.cal-day.today').tap();
  await wait(600);
  pruefe('tagesplan', await page.locator('.screen.active').innerText());
  if (found.length) throw new Error(found.join(', '));
});

await step('Abhak-Knopf trifft auf 44 pt, auch bei kleinen Zeilen', async () => {
  // Der sichtbare Kreis ist kleiner als Apples Richtwert von 44 pt. Geprüft
  // wird deshalb nicht seine Größe, sondern was beim Tippen wirklich getroffen
  // wird – in allen drei Zeilenhöhen.
  const bad = [];
  for (const size of ['small', 'medium', 'large']) {
    await page.evaluate((s) => { document.documentElement.dataset.size = s; }, size);
    await page.locator('.tab[data-goto=todos]').tap();
    await wait(320);
    const miss = await page.evaluate(() => {
      const out = [];
      for (const c of document.querySelectorAll('#todo-list .check')) {
        const r = c.getBoundingClientRect();
        const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
        for (const [dx, dy] of [[-21, 0], [21, 0], [0, -21], [0, 21]]) {
          const hit = document.elementFromPoint(cx + dx, cy + dy);
          if (!hit || !hit.closest('.check')) out.push(`${dx},${dy}`);
        }
        break;    // eine Zeile genügt, alle sind gleich gebaut
      }
      return out;
    });
    if (miss.length) bad.push(`${size}: ${miss.join(' / ')}`);
  }
  await page.evaluate(() => { document.documentElement.dataset.size = 'medium'; });
  if (bad.length) throw new Error(bad.join(' · '));
});

await step('Tippziele mindestens 28px', async () => {
  const small = await page.evaluate(() => {
    const out = [];
    for (const b of document.querySelectorAll('button:not([hidden]), input.emoji-box')) {
      const r = b.getBoundingClientRect();
      if (r.width === 0 || b.classList.contains('swipe-action')) continue;
      if (r.width < 28 || r.height < 28) out.push(`${b.className || b.id}: ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    return out;
  });
  if (small.length) throw new Error(small.slice(0, 5).join(', '));
});

await step('keine Einstellung quetscht ihren Beschreibungstext', async () => {
  // Ein breites Bedienelement daneben ließ der Beschreibung einmal eine Spalte
  // von der Breite eines Wortes. Geprüft wird die tatsächliche Textbreite.
  await page.locator('.tab[data-goto=home]').tap();
  await wait(320);
  await page.locator('.home-tile').filter({ hasText: 'Einstellungen' }).tap();
  await wait(500);
  const eng = await page.evaluate(() => [...document.querySelectorAll('.setting-desc')]
    .map(n => ({ w: Math.round(n.getBoundingClientRect().width),
                 t: n.textContent.slice(0, 26) }))
    .filter(x => x.w < 150)
    .map(x => `${x.w}px: „${x.t}…"`));
  if (eng.length) throw new Error(eng.join(' · '));
});

await step('dunkles Design auf allen Bildschirmen', async () => {
  await page.locator('.tab[data-goto=home]').tap();
  await wait(300);
  await page.locator('.home-tile').filter({ hasText: 'Einstellungen' }).tap();
  await wait(400);
  await page.locator('.segmented button', { hasText: 'Dunkel' }).tap();
  await wait(300);
  await page.locator('#settings-back').tap();
  await wait(400);
  await shot('04-start-dunkel');

  /* Nicht nur Bildschirmfotos: Geprüft wird, dass jeder Bildschirm wirklich
     dunkel gedeckt ist. Ein neuer Bildschirm, der seine Farben fest verdrahtet
     statt die Tokens zu benutzen, fällt sonst erst dem Auge auf. */
  const hell = [];
  const messe = async (label) => {
    const r = await page.evaluate(() => {
      const schirm = document.querySelector('.screen.active');
      /* Hintergründe aus color-mix() liefert der Browser als oklab() zurück,
         nicht als rgb(). Ein Ausdruck, der einfach alle Ziffern einsammelt,
         rechnet daraus Unsinn – jede Schreibweise braucht ihren eigenen Fall.
         Herauskommt in allen Fällen ein Wert von 0 (schwarz) bis 1 (weiß). */
      const helligkeit = (farbe) => {
        if (!farbe) return null;
        let m = farbe.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?/);
        if (m) {
          if (m[4] !== undefined && Number(m[4]) === 0) return null;   // unsichtbar
          const [r, g, b] = [m[1], m[2], m[3]].map(Number);
          return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
        }
        m = farbe.match(/^oklab\(\s*([\d.]+)(%?)/);
        if (m) return m[2] ? parseFloat(m[1]) / 100 : parseFloat(m[1]);
        m = farbe.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
        if (m) {
          const [r, g, b] = [m[1], m[2], m[3]].map(Number);
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        }
        return null;       // unbekannte Schreibweise – lieber nicht raten
      };
      const flaechen = [schirm, ...schirm.querySelectorAll('.row, .card, .home-card, .group-card, .day-block, .cal-day')]
        .slice(0, 40)
        .map(n => helligkeit(getComputedStyle(n).backgroundColor))
        .filter(v => v !== null);
      return {
        hellsteFlaeche: flaechen.length ? Math.max(...flaechen) : 0,
        text: helligkeit(getComputedStyle(schirm).color),
        gemessen: flaechen.length,
      };
    });
    if (!r.gemessen) hell.push(`${label}: keine Fläche messbar`);
    if (r.hellsteFlaeche > 0.5) hell.push(`${label}: Fläche zu hell (${r.hellsteFlaeche.toFixed(2)})`);
    if (r.text < 0.6) hell.push(`${label}: Text zu dunkel (${r.text.toFixed(2)})`);
  };

  await messe('start');
  for (const tab of ['calendar', 'habits', 'todos']) {
    await page.locator(`.tab[data-goto=${tab}]`).tap();
    await wait(400);
    await messe(tab);
    await shot(`05-${tab}-dunkel`);
  }
  await page.locator('.tab[data-goto=calendar]').tap();
  await wait(320);
  await page.locator('.cal-day.today').tap();
  await wait(620);
  await messe('tagesplan');
  await shot('05-tagesplan-dunkel');

  if (hell.length) throw new Error(hell.join(' · '));
});

/* ========================================================================== */
await browser.close();
server.close();

console.log(`\n${passed} bestanden, ${failed} fehlgeschlagen`);
if (errors.length) {
  console.log(`\nPROBLEME (${errors.length}):`);
  for (const e of errors) console.log('  - ' + e);
}
process.exit(errors.length ? 1 : 0);
