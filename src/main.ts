import './style.css';
import * as G from './state';
import type { BuildingId, Good, RivalId, Schwierigkeit, Zweig } from './state';

type Tab = 'stadt' | 'lager' | 'markt' | 'auftraege' | 'forschung';
const TABS: { id: Tab; label: string }[] = [
  { id: 'stadt', label: 'Stadt' },
  { id: 'lager', label: 'Lager' },
  { id: 'markt', label: 'Markt' },
  { id: 'auftraege', label: 'Aufträge' },
  { id: 'forschung', label: 'Forschung' },
];

const SCHW_LABEL: Record<Schwierigkeit, string> = { lehrling: 'Lehrling', geselle: 'Geselle', meister: 'Meister' };
const SCHW_TEXT: Record<Schwierigkeit, string> = {
  lehrling: 'Rivalen sind langsam und nehmen seltener Aufträge.',
  geselle: 'Ausgewogen.',
  meister: 'Rivalen greifen schnell zu und treiben die Preise stärker.',
};

const app = document.getElementById('app')!;

let phase: 'start' | 'spiel' = 'start';
let s: G.GameState = G.createGame(Math.floor(Math.random() * 1_000_000));
let tab: Tab = 'stadt';
let message = '';
let sheet:
  | { type: 'build'; slot: number }
  | { type: 'info'; slot: number }
  | { type: 'report' }
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

function startHtml(): string {
  const opts = G.SCHWIERIGKEITEN.map(
    (k) => `<button class="opt" data-act="start" data-arg="${k}">
      <span>${SCHW_LABEL[k]}</span><small>${SCHW_TEXT[k]}</small></button>`,
  ).join('');
  return `<div class="start">
    <h1>Gildenstadt</h1>
    <p class="muted">Baue eine Handelsgilde auf, forsche, handle und erreiche den Gildenrang, bevor die Rivalen dich überholen.</p>
    <h2>Schwierigkeit</h2>
    ${opts}
  </div>`;
}

function sheetHtml(): string {
  if (!sheet) return '';
  const sh = sheet;
  if (sh.type === 'report') return reportHtml();
  if (sh.type === 'build') {
    const opts = G.BUILDINGS.filter((id) => G.freigegeben(s, id))
      .map((id) => {
        const d = G.DEF(id);
        const cost = Object.entries(d.cost)
          .map(([k, n]) => `${n} ${k === 'gold' ? 'Gold' : G.label(k as Good)}`)
          .join(', ');
        return `<button class="opt" data-act="build" data-arg="${sh.slot}|${id}">
          <span>${d.label}</span><small>${cost}</small></button>`;
      })
      .join('');
    return `<div class="overlay"><div class="sheet">
      <h3>Gebäude wählen</h3>${opts}
      <button class="ghost" data-act="close">Abbrechen</button>
    </div></div>`;
  }
  const id = s.slots[sh.slot];
  if (!id) return '';
  const d = G.DEF(id);
  const ins = Object.entries(d.in).map(([g, n]) => `${n} ${G.label(g as Good)}`).join(', ') || 'nichts';
  const outList = Object.entries(d.out).map(([g, n]) => `${n} ${G.label(g as Good)}`);
  if (d.wissen) outList.push(`${d.wissen} Wissen`);
  const outs = outList.join(', ') || 'nichts';
  return `<div class="overlay"><div class="sheet">
    <h3>${d.label}</h3>
    <p>Verbraucht: ${ins}</p>
    <p>Produziert pro Runde: ${outs}</p>
    <button class="ghost" data-act="close">Schließen</button>
  </div></div>`;
}

function listGoods(o: Partial<Record<Good, number>>): string {
  const parts = (Object.entries(o) as [Good, number][])
    .filter(([, n]) => n > 0)
    .map(([g, n]) => `${n} ${G.label(g)}`);
  return parts.length ? parts.join(', ') : 'nichts';
}

function reportHtml(): string {
  const r = s.report;
  if (!r) return '';
  const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);
  return `<div class="overlay"><div class="sheet">
    <h3>Bericht Runde ${r.turn}</h3>
    <p>Produziert: ${listGoods(r.produced)}</p>
    <p>Verbraucht: ${listGoods(r.consumed)}</p>
    ${r.stalled ? `<p class="warn">${r.stalled} Gebäude standen still (fehlende Rohstoffe).</p>` : ''}
    <p>Zufriedenheit: ${r.zufNow} (${sign(r.zufDelta)})</p>
    <p>Einwohner: ${r.popNow} (${sign(r.popDelta)})</p>
    ${r.rival ? `<p class="muted">${r.rival}</p>` : ''}
    <button data-act="close">Weiter</button>
  </div></div>`;
}

function endHtml(): string {
  const won = s.status === 'won';
  return `<div class="overlay"><div class="sheet">
    <h3>${won ? 'Gildenvorsteher!' : 'Spiel vorbei'}</h3>
    <p>${won
      ? `Du hast in ${s.turn - 1} Runden ${s.ruf} Ruf erreicht.`
      : `Du hast ${s.ruf} von ${G.CFG.winRuf} Ruf erreicht.`}</p>
    <button data-act="neu">Neues Spiel</button>
  </div></div>`;
}

function forschungHtml(): string {
  const zweige = G.ZWEIGE.map((z) => {
    const lvl = s.forschung[z.id];
    const stufen = z.stufen
      .map((st, i) => {
        const cls = i < lvl ? 'done' : i === lvl ? 'next' : 'locked';
        const aktion =
          cls === 'next'
            ? `<button data-act="forschen" data-arg="${z.id}" ${s.wissen >= st.kosten ? '' : 'disabled'}>Erforschen (${st.kosten} W)</button>`
            : cls === 'done'
              ? '<span class="muted">erforscht</span>'
              : `<span class="muted">${st.kosten} W</span>`;
        return `<div class="stufe ${cls}">
          <div class="stufe-kopf"><b>${st.name}</b>${aktion}</div>
          <small>${st.text}</small>
          <small class="muted">Gildenrecht: ${st.recht}</small>
        </div>`;
      })
      .join('');
    return `<section><h2>${z.label}</h2>${stufen}</section>`;
  }).join('');

  let monopol = '';
  if (G.hatMonopol(s)) {
    monopol = s.monopolGut
      ? `<p class="muted">Handelsmonopol auf: ${G.label(s.monopolGut)}</p>`
      : `<section><h2>Handelsmonopol-Gut wählen</h2><div class="res-grid">${G.GOODS.map(
          (g) => `<button data-act="monopol" data-arg="${g}">${G.label(g)}</button>`,
        ).join('')}</div></section>`;
  }
  return `<p>Wissen: <b>${s.wissen}</b></p>${zweige}${monopol}`;
}

function buendnisHtml(): string {
  const rows = s.rivals
    .map((r) => {
      const d = G.RIVALEN[r.id];
      let aktion: string;
      if (!d.buendnisMoeglich) aktion = '<span class="muted">lehnt ab</span>';
      else if (s.buendnis?.rival === r.id)
        aktion = `<button data-act="buendnisBrechen">Brechen (−${G.BUENDNIS.bruchRuf} Ruf)</button>`;
      else if (s.buendnis) aktion = '<span class="muted">anderes Bündnis aktiv</span>';
      else aktion = `<button data-act="buendnis" data-arg="${r.id}">Schließen</button>`;
      const gegenleistung =
        r.id === 'haendler'
          ? `${G.BUENDNIS.haendlerGold} Gold pro Runde`
          : 'ein Tuch oder Werkzeug pro Runde';
      const info = d.buendnisMoeglich
        ? `Gegenleistung: ${gegenleistung}, ${G.BUENDNIS.dauer} Runden`
        : 'Bündnisse sind nicht möglich';
      return `<div class="row"><span>${d.label}<br/><small>${info}</small></span>${aktion}</div>`;
    })
    .join('');
  const status = s.buendnis
    ? `<p class="muted">Aktives Bündnis mit ${G.rivalLabel(s.buendnis.rival)}: noch ${s.buendnis.verbleibend} Runden.</p>`
    : '';
  return `<section><h2>Bündnisse</h2>${status}${rows}</section>`;
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
      return `<section><h2>Aufträge</h2>${contracts}</section>${buendnisHtml()}`;
    }
    case 'forschung':
      return forschungHtml();
  }
  return '';
}

function render() {
  if (phase === 'start') {
    app.innerHTML = startHtml();
    return;
  }

  const rang = G.rangOf(s.ruf);
  const next = G.RANG.find((r) => r.ruf > s.ruf);
  const rivalen = s.rivals.map((r) => `${G.rivalLabel(r.id)} ${r.ruf}`).join(' · ');

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
      <div class="stats">Einwohner ${s.pop} · Zufriedenheit ${fmt(s.zufriedenheit)} · Wissen ${s.wissen}</div>
      <div class="stats">Rivalen: ${rivalen} (${SCHW_LABEL[s.schwierigkeit]})</div>
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
    case 'start':
      s = G.createGame(Math.floor(Math.random() * 1_000_000), arg as Schwierigkeit);
      phase = 'spiel';
      tab = 'stadt';
      sheet = null;
      haptic('tap');
      break;
    case 'neu':
      phase = 'start';
      sheet = null;
      tab = 'stadt';
      haptic('tap');
      break;
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
    case 'forschen':
      result(G.forschen(s, arg as Zweig));
      break;
    case 'monopol':
      result(G.monopolWaehlen(s, arg as Good));
      break;
    case 'buendnis':
      result(G.buendnisSchliessen(s, arg as RivalId));
      break;
    case 'buendnisBrechen':
      result(G.buendnisBrechen(s));
      break;
    case 'end':
      G.endTurn(s);
      sheet = s.status === 'playing' ? { type: 'report' } : null;
      if (s.status === 'won') haptic('win');
      else if (s.status === 'lost') haptic('lose');
      else haptic('turn');
      break;
    case 'close':
      sheet = null;
      break;
  }
  render();
});

render();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('./sw.js');
}
