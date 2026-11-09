import './style.css';
import * as G from './state';
import type { BuildingId, Good } from './state';

type Tab = 'stadt' | 'lager' | 'markt' | 'auftraege';
const TABS: { id: Tab; label: string }[] = [
  { id: 'stadt', label: 'Stadt' },
  { id: 'lager', label: 'Lager' },
  { id: 'markt', label: 'Markt' },
  { id: 'auftraege', label: 'Aufträge' },
];

const app = document.getElementById('app')!;

let s: G.GameState = G.createGame(Math.floor(Math.random() * 1_000_000));
let tab: Tab = 'stadt';
let message = '';
let sheet:
  | { type: 'build'; slot: number }
  | { type: 'info'; slot: number }
  | null = null;

// Haptik: kurze Vibrationsmuster. Die Vibrations-API gibt es nur in Android-Chrome.
// Auf iPhones bleibt das Feedback stumm, die Bedienung funktioniert trotzdem.
type Haptic = 'tap' | 'ok' | 'error' | 'turn' | 'win' | 'lose';
// Dauer in ms. Sehr kurze Impulse (unter ~15 ms) werden auf vielen Geräten nicht gespürt.
const PATTERNS: Record<Haptic, number | number[]> = {
  tap: 25,
  ok: [30, 60, 30],
  error: [120, 80, 120],
  turn: 50,
  win: [60, 80, 60, 80, 160],
  lose: [400],
};
function haptic(kind: Haptic) {
  if ('vibrate' in navigator) navigator.vibrate(PATTERNS[kind]);
}

function result(err: string | null) {
  if (err) {
    message = err;
    haptic('error');
  } else {
    haptic('ok');
  }
}

const fmt = (n: number) => Math.round(n).toString();

function sheetHtml(): string {
  if (!sheet) return '';
  const sh = sheet;
  if (sh.type === 'build') {
    const opts = G.BUILDINGS.map((id) => {
      const d = G.DEF(id);
      const cost = Object.entries(d.cost)
        .map(([k, n]) => `${n} ${k === 'gold' ? 'Gold' : G.label(k as Good)}`)
        .join(', ');
      return `<button class="opt" data-act="build" data-arg="${sh.slot}|${id}">
        <span>${d.label}</span><small>${cost}</small></button>`;
    }).join('');
    return `<div class="overlay"><div class="sheet">
      <h3>Gebäude wählen</h3>${opts}
      <button class="ghost" data-act="close">Abbrechen</button>
    </div></div>`;
  }
  const id = s.slots[sh.slot];
  if (!id) return '';
  const d = G.DEF(id);
  const ins = Object.entries(d.in).map(([g, n]) => `${n} ${G.label(g as Good)}`).join(', ') || 'nichts';
  const outs = Object.entries(d.out).map(([g, n]) => `${n} ${G.label(g as Good)}`).join(', ');
  return `<div class="overlay"><div class="sheet">
    <h3>${d.label}</h3>
    <p>Verbraucht: ${ins}</p>
    <p>Produziert pro Runde: ${outs}</p>
    <button class="ghost" data-act="close">Schließen</button>
  </div></div>`;
}

function endHtml(): string {
  const won = s.status === 'won';
  return `<div class="overlay"><div class="sheet">
    <h3>${won ? 'Gildenvorsteher!' : 'Spiel vorbei'}</h3>
    <p>${won
      ? `Du hast in ${s.turn - 1} Runden ${s.ruf} Ruf erreicht.`
      : `Du hast ${s.ruf} von ${G.CFG.winRuf} Ruf erreicht.`}</p>
    <button data-act="restart">Neues Spiel</button>
  </div></div>`;
}

function tabContent(): string {
  switch (tab) {
    case 'stadt': {
      const slots = s.slots
        .map((id, i) => {
          const name = id ? G.DEF(id).label : '+';
          return `<button class="slot ${id ? 'built' : 'empty'}" data-act="slot" data-arg="${i}">${name}</button>`;
        })
        .join('');
      const log = s.log
        .slice(-8)
        .reverse()
        .map((l) => `<li>${l}</li>`)
        .join('');
      return `
        <section><h2>Stadt</h2><div class="slots">${slots}</div></section>
        <section><h2>Protokoll</h2><ul class="log">${log}</ul></section>`;
    }
    case 'lager': {
      const goods = G.GOODS.map(
        (g) => `<div class="res"><span>${G.label(g)}</span><b>${s.inv[g]}</b></div>`,
      ).join('');
      return `<section><h2>Lager</h2><div class="res-grid">${goods}</div></section>`;
    }
    case 'markt': {
      const market = G.GOODS.map(
        (g) => `<div class="row">
          <span>${G.label(g)} <small>${fmt(s.prices[g])} G</small></span>
          <span class="btns">
            <button data-act="buy" data-arg="${g}">Kaufen</button>
            <button data-act="sell" data-arg="${g}">Verkaufen</button>
          </span>
        </div>`,
      ).join('');
      return `<section><h2>Markt</h2>${market}</section>`;
    }
    case 'auftraege': {
      const contracts = s.contracts.length
        ? s.contracts
            .map(
              (c) => `<div class="row">
            <span>${c.amount} ${G.label(c.good)} → ${c.gold} G, ${c.ruf} Ruf</span>
            <button data-act="fulfill" data-arg="${c.id}" ${s.inv[c.good] >= c.amount ? '' : 'disabled'}>Erfüllen</button>
          </div>`,
            )
            .join('')
        : '<p class="muted">Keine Aufträge.</p>';
      return `<section><h2>Aufträge</h2>${contracts}</section>`;
    }
  }
  return '';
}

function render() {
  const rang = G.rangOf(s.ruf);
  const next = G.RANG.find((r) => r.ruf > s.ruf);

  const tabbar = TABS.map(
    (t) => `<button class="tab ${t.id === tab ? 'active' : ''}" data-act="tab" data-arg="${t.id}">
      ${t.label}${t.id === 'auftraege' && s.contracts.length ? `<sup>${s.contracts.length}</sup>` : ''}
    </button>`,
  ).join('');

  app.innerHTML = `
    <header>
      <div class="top">
        <span>Runde ${Math.min(s.turn, G.CFG.maxTurns)}/${G.CFG.maxTurns}</span>
        <span>Gold ${fmt(s.gold)}</span>
      </div>
      <div class="rank">${rang.name} · Ruf ${s.ruf}/${G.CFG.winRuf}${
        next ? ` · nächster Rang bei ${next.ruf}` : ''
      }</div>
      <div class="stats">Einwohner ${s.pop} · Zufriedenheit ${fmt(s.zufriedenheit)}</div>
    </header>

    <main>
      ${message ? `<p class="msg">${message}</p>` : ''}
      ${tabContent()}
    </main>

    <footer class="bottom">
      <button class="end" data-act="end" ${s.status !== 'playing' ? 'disabled' : ''}>Runde beenden</button>
      <nav class="tabbar">${tabbar}</nav>
    </footer>

    ${sheetHtml()}
    ${s.status !== 'playing' ? endHtml() : ''}
  `;
}

app.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
  if (!el) return;
  const act = el.dataset.act!;
  const arg = el.dataset.arg ?? '';
  message = '';

  switch (act) {
    case 'tab':
      if (tab !== arg) haptic('tap');
      tab = arg as Tab;
      break;
    case 'slot': {
      const i = Number(arg);
      sheet = s.slots[i] ? { type: 'info', slot: i } : { type: 'build', slot: i };
      haptic('tap');
      break;
    }
    case 'build': {
      const [slot, id] = arg.split('|');
      const err = G.build(s, Number(slot), id as BuildingId);
      if (err) {
        message = err;
        haptic('error');
      } else {
        sheet = null;
        haptic('ok');
      }
      break;
    }
    case 'buy':
      result(G.buy(s, arg as Good));
      break;
    case 'sell':
      result(G.sell(s, arg as Good));
      break;
    case 'fulfill':
      result(G.fulfill(s, Number(arg)));
      break;
    case 'end':
      G.endTurn(s);
      sheet = null;
      if (s.status === 'won') haptic('win');
      else if (s.status === 'lost') haptic('lose');
      else haptic('turn');
      break;
    case 'close':
      sheet = null;
      break;
    case 'restart':
      s = G.createGame(Math.floor(Math.random() * 1_000_000));
      sheet = null;
      tab = 'stadt';
      haptic('tap');
      break;
  }
  render();
});

render();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('./sw.js');
}
