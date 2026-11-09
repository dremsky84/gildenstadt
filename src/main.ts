import './style.css';
import * as G from './state';
import type { BuildingId, Good, RivalId, Schwierigkeit, Zweig } from './state';
import { serialize, deserialize, SAVE_KEY } from './save';
import { ICONS } from './icons';

type Tab = 'stadt' | 'markt' | 'auftraege' | 'forschung';
const TABS: { id: Tab; label: string }[] = [
  { id: 'stadt', label: 'Stadt' },
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
// Developer Mode: öffnet sich nach fünf schnellen Taps auf den Goldbetrag.
let devAktiv = false;
let goldTaps = 0;
let goldTapZeit = 0;
let sheet:
  | { type: 'build'; slot: number }
  | { type: 'info'; slot: number }
  | { type: 'report' }
  | { type: 'log' }
  | { type: 'dev' }
  | null = null;

// --- Speicherung im Browser ---

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function ladeSpielstand(): G.GameState | null {
  const st = storage();
  if (!st) return null;
  try {
    const text = st.getItem(SAVE_KEY);
    return text ? deserialize(text) : null;
  } catch {
    return null;
  }
}

// Gibt false zurück, wenn der Browser das Speichern verweigert.
function speichereSpielstand(): boolean {
  const st = storage();
  if (!st) return false;
  try {
    st.setItem(SAVE_KEY, serialize(s));
    return true;
  } catch {
    return false;
  }
}

function loescheSpielstand() {
  try {
    storage()?.removeItem(SAVE_KEY);
  } catch {
    // Ohne Speicher ist nichts zu löschen.
  }
}

// Nach jeder Aktion: laufende Partie sichern, beendete Partie aus dem Speicher entfernen.
function automatischSichern() {
  if (phase !== 'spiel') return;
  if (s.status === 'playing') speichereSpielstand();
  else loescheSpielstand();
}

// --- Haptik ---

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
const VIBRATION_KEY = 'gildenstadt-vibration';
let vibrationAn = (() => {
  try {
    return storage()?.getItem(VIBRATION_KEY) !== '0';
  } catch {
    return true;
  }
})();

function haptic(kind: Haptic) {
  if (vibrationAn && 'vibrate' in navigator) navigator.vibrate(PATTERNS[kind]);
}

function vibrationUmschalten() {
  vibrationAn = !vibrationAn;
  try {
    storage()?.setItem(VIBRATION_KEY, vibrationAn ? '1' : '0');
  } catch {
    // Ohne Speicher gilt die Einstellung nur bis zum Neuladen.
  }
}

const vibrationLabel = () => `Vibration: ${vibrationAn ? 'an' : 'aus'}`;

function result(err: string | null) {
  if (err) {
    message = err;
    haptic('error');
  } else {
    haptic('ok');
  }
}

const fmt = (n: number) => Math.round(n).toString();

// Kursentwicklung der letzten Runde als farbige Anzeige.
function trendHtml(t: number): string {
  const p = Math.round(t * 100);
  if (p === 0) return '<span class="muted">→ 0 %</span>';
  return p > 0 ? `<span class="up">▲ +${p} %</span>` : `<span class="down">▼ ${p} %</span>`;
}

function startHtml(): string {
  const weiter = ladeSpielstand() !== null;
  const weiterKnopf = weiter
    ? `<button class="opt" data-act="weiter"><span>Weiterspielen</span><small>Gespeicherte Partie fortsetzen</small></button>`
    : '';
  const opts = G.SCHWIERIGKEITEN.map(
    (k) => `<button class="opt" data-act="start" data-arg="${k}">
      <span>${SCHW_LABEL[k]}</span><small>${SCHW_TEXT[k]}</small></button>`,
  ).join('');
  const hinweis = weiter ? '<p class="muted">Ein neues Spiel ersetzt den gespeicherten Stand.</p>' : '';
  return `<div class="start">
    <h1>Gildenstadt</h1>
    <p class="muted">Baue eine Handelsgilde auf, forsche, handle und erreiche den Gildenrang, bevor die Rivalen dich überholen.</p>
    <section class="ziel">
      <h2>Ziel</h2>
      <p>Erreiche 40 Ruf, bevor ein Rivale es tut. Nach 20 Runden gewinnt, wer den meisten Ruf hat.</p>
      <h2>So spielst du</h2>
      <ul class="howto">
        <li><b>Stadt:</b> Baue Gebäude auf freie Plätze. Sie produzieren Waren.</li>
        <li><b>Markt:</b> Kaufe und verkaufe Waren. Die Preise schwanken.</li>
        <li><b>Aufträge:</b> Liefere Waren für Gold und Ruf.</li>
        <li><b>Forschung:</b> Wissen aus der Schreibstube schaltet neue Gebäude und Vorteile frei.</li>
        <li><b>Bündnisse:</b> Schließe Verträge mit Rivalen. Ein Bruch kostet Ruf.</li>
        <li><b>Runde beenden:</b> Produktion, Versorgung und Rivalen ziehen weiter.</li>
      </ul>
    </section>
    ${weiterKnopf}
    <h2>Neues Spiel</h2>
    ${hinweis}
    ${opts}
    <button class="ghost" data-act="vibration">${vibrationLabel()}</button>
  </div>`;
}

function sheetHtml(): string {
  if (!sheet) return '';
  const sh = sheet;
  if (sh.type === 'report') return reportHtml();
  if (sh.type === 'log') return logHtml();
  if (sh.type === 'dev') return devHtml();
  if (sh.type === 'build') {
    const opts = G.BUILDINGS.filter((id) => G.freigegeben(s, id))
      .map((id) => {
        const d = G.DEF(id);
        const cost = Object.entries(d.cost)
          .map(([k, n]) => `${n} ${k === 'gold' ? 'Gold' : G.label(k as Good)}`)
          .join(', ');
        return `<button class="opt" data-act="build" data-arg="${sh.slot}|${id}" ${G.kannBauen(s, id) ? '' : 'disabled'}>
          <span class="ico">${ICONS[id]}</span>
          <span class="txt">${d.label}<br/><small>${d.text}</small></span><small>${cost}</small></button>`;
      })
      .join('');
    return `<div class="overlay"><div class="sheet">
      <h3>Gebäude wählen</h3>
      <p class="muted">Im Lager: ${listGoods(s.inv)}</p>
      ${opts}
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
    <p>${d.text}</p>
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

function devHtml(): string {
  const btn = (act: string, text: string) => `<button data-act="${act}">${text}</button>`;
  return `<div class="overlay"><div class="sheet">
    <h3>Developer Mode</h3>
    <p class="muted">Nur zum Testen. Die Aktionen verändern die laufende Partie.</p>
    <div class="dev-btns">
      ${btn('devgold', '+500 Gold')}
      ${btn('devvorrat', '+20 jede Ware')}
      ${btn('devwissen', '+10 Wissen')}
      ${btn('devforschung', 'Alles erforschen')}
      ${btn('devruf', '+5 Ruf')}
      ${btn('devrunden', '5 Runden weiter')}
      ${btn('devsieg', 'Sieg auslösen')}
    </div>
    <button class="ghost" data-act="close">Schließen</button>
  </div></div>`;
}

function logHtml(): string {
  const eintraege = s.log
    .slice(-30)
    .reverse()
    .map((l) => `<li>${l}</li>`)
    .join('');
  return `<div class="overlay"><div class="sheet">
    <h3>Protokoll</h3>
    <ul class="log">${eintraege || '<li>Noch nichts passiert.</li>'}</ul>
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
      const goods = G.GOODS.map(
        (g) => `<div class="res"><span>${G.label(g)}</span><b>${s.inv[g]}</b></div>`,
      ).join('');
      return `
        <section><h2>Stadt</h2><div class="slots">${slots}</div></section>
        <section><h2>Lager</h2><div class="res-grid">${goods}</div></section>
        <section><h2>Spiel</h2>
          <div class="btns">
            <button data-act="speichern">Speichern</button>
            <button data-act="vibration">${vibrationLabel()}</button>
            <button data-act="hauptmenue">Hauptmenü</button>
          </div>
          <p class="muted">Die Partie wird nach jeder Aktion automatisch gespeichert.</p>
        </section>`;
    }
    case 'markt': {
      const lager = G.GOODS.map(
        (g) => `<div class="res"><span>${G.label(g)}</span><b>${s.inv[g]}</b></div>`,
      ).join('');
      const market = G.GOODS.map((g) => {
        const e = s.einkauf[g];
        const avg =
          e.menge > 0
            ? `<br/><small>Ø Einkauf ${fmt(e.wert / e.menge)} G (davon ${e.menge} gekauft)</small>`
            : '';
        return `<div class="row">
          <span>${G.label(g)} <b>${fmt(s.prices[g])} G</b> ${trendHtml(s.kursTrend[g])}${avg}</span>
          <span class="btns">
            <button data-act="buy" data-arg="${g}">Kaufen</button>
            <button data-act="sell" data-arg="${g}">Verkaufen</button>
          </span>
        </div>`;
      }).join('');
      return `<section><h2>Lager</h2><div class="res-grid">${lager}</div></section>
        <section><h2>Markt</h2><p class="muted">Kursentwicklung in der letzten Runde.</p>${market}</section>`;
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
        <span>Runde ${Math.min(s.turn, G.CFG.maxTurns)}/${G.CFG.maxTurns}
          <button class="log-btn" data-act="protokoll" aria-label="Protokoll">📝</button></span>
        <span class="gold" data-act="gold">Gold ${fmt(s.gold)}${devAktiv ? '<small>DEV</small>' : ''}</span>
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
  if (act !== 'gold') goldTaps = 0;

  switch (act) {
    case 'start':
      s = G.createGame(Math.floor(Math.random() * 1_000_000), arg as Schwierigkeit);
      phase = 'spiel';
      tab = 'stadt';
      sheet = null;
      haptic('tap');
      break;
    case 'weiter': {
      const gespeichert = ladeSpielstand();
      if (gespeichert) {
        s = gespeichert;
        phase = 'spiel';
        tab = 'stadt';
        sheet = null;
        message = 'Spielstand geladen.';
        haptic('tap');
      }
      break;
    }
    case 'speichern':
      message = speichereSpielstand() ? 'Spielstand gespeichert.' : 'Speichern nicht möglich: Der Browser blockiert den Speicher.';
      haptic(message.startsWith('Spielstand') ? 'ok' : 'error');
      break;
    case 'hauptmenue':
      phase = 'start';
      sheet = null;
      tab = 'stadt';
      haptic('tap');
      break;
    case 'neu':
      phase = 'start';
      sheet = null;
      tab = 'stadt';
      loescheSpielstand();
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
    case 'vibration':
      vibrationUmschalten();
      haptic('tap');
      break;
    case 'gold': {
      const jetzt = Date.now();
      goldTaps = jetzt - goldTapZeit > 2000 ? 1 : goldTaps + 1;
      goldTapZeit = jetzt;
      if (goldTaps >= 5) {
        goldTaps = 0;
        devAktiv = true;
        sheet = { type: 'dev' };
        haptic('ok');
      }
      break;
    }
    case 'devgold':
      s.gold += 500;
      break;
    case 'devvorrat':
      for (const g of G.GOODS) s.inv[g] += 20;
      break;
    case 'devwissen':
      s.wissen += 10;
      break;
    case 'devforschung':
      for (const z of G.ZWEIGE) s.forschung[z.id] = z.stufen.length;
      while (s.slots.length < G.slotCap(s)) s.slots.push(null);
      break;
    case 'devruf':
      s.ruf += 5;
      if (s.ruf >= G.CFG.winRuf && s.status === 'playing') {
        s.status = 'won';
        s.log.push('Gildenvorsteher (Dev).');
      }
      break;
    case 'devrunden':
      for (let i = 0; i < 5 && s.status === 'playing'; i++) G.endTurn(s);
      sheet = s.status === 'playing' && s.report ? { type: 'report' } : null;
      break;
    case 'devsieg':
      s.status = 'won';
      s.log.push('Sieg (Dev).');
      break;
    case 'protokoll':
      sheet = { type: 'log' };
      haptic('tap');
      break;
    case 'close':
      sheet = null;
      break;
  }
  automatischSichern();
  render();
});

render();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('./sw.js');
}
