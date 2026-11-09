import balance from './data/balance.json';

export type Good = keyof typeof balance.goods;
export type BuildingId = keyof typeof balance.buildings;
export type Inventory = Record<Good, number>;
export type Zweig = 'handwerk' | 'handel' | 'verwaltung';
export type RivalId = 'haendler' | 'handwerker' | 'verwalter';
export type Schwierigkeit = 'lehrling' | 'geselle' | 'meister';

export type Effekt =
  | { typ: 'freigabe'; gebaeude: string }
  | { typ: 'bonus'; gebaeude: string; gut: Good; wert: number }
  | { typ: 'erzSparen'; gebaeude: string; wert: number }
  | { typ: 'verkaufsquote'; wert: number }
  | { typ: 'auftragsslots'; wert: number }
  | { typ: 'auftragsbonus'; wert: number }
  | { typ: 'monopol' }
  | { typ: 'zufriedenheit'; wert: number }
  | { typ: 'raster'; wert: number }
  | { typ: 'einwohner'; wert: number };

export interface Stufe {
  name: string;
  kosten: number;
  text: string;
  recht: string;
  effekte: Effekt[];
}

export interface Zweigdef {
  id: Zweig;
  label: string;
  stufen: Stufe[];
}

interface BuildingDef {
  label: string;
  cost: Partial<Record<Good | 'gold', number>>;
  in: Partial<Record<Good, number>>;
  out: Partial<Record<Good, number>>;
  wissen?: number;
  freigabe?: string;
}

interface RivalDef {
  label: string;
  buendnisMoeglich: boolean;
  auftragChance: number;
  preisDruck?: number;
  rufProRunde?: number;
  bonusRuf?: number;
  bonusAb?: number;
}

export interface Contract {
  id: number;
  good: Good;
  amount: number;
  gold: number;
  ruf: number;
}

export interface RoundReport {
  turn: number;
  produced: Partial<Record<Good, number>>;
  consumed: Partial<Record<Good, number>>;
  stalled: number;
  zufDelta: number;
  zufNow: number;
  popDelta: number;
  popNow: number;
  rival: string | null;
}

export interface Rival {
  id: RivalId;
  ruf: number;
}

export interface Buendnis {
  rival: RivalId;
  verbleibend: number;
}

export interface GameState {
  seed: number;
  turn: number;
  gold: number;
  ruf: number;
  inv: Inventory;
  prices: Record<Good, number>;
  slots: (BuildingId | null)[];
  pop: number;
  zufriedenheit: number;
  contracts: Contract[];
  nextContractId: number;
  log: string[];
  status: 'playing' | 'won' | 'lost';
  report: RoundReport | null;
  wissen: number;
  forschung: Record<Zweig, number>;
  monopolGut: Good | null;
  schwierigkeit: Schwierigkeit;
  rivals: Rival[];
  buendnis: Buendnis | null;
}

export const CFG = balance;
export const GOODS = Object.keys(balance.goods) as Good[];
export const BUILDINGS = Object.keys(balance.buildings) as BuildingId[];
export const RANG = balance.rang as { ruf: number; name: string }[];
export const ZWEIGE = balance.forschung.zweige as unknown as Zweigdef[];
export const RIVALEN = balance.rivalen as unknown as Record<RivalId, RivalDef>;
export const RIVAL_IDS = Object.keys(balance.rivalen) as RivalId[];
export const SCHWIERIGKEIT = balance.schwierigkeit as unknown as Record<Schwierigkeit, number>;
export const SCHWIERIGKEITEN = Object.keys(balance.schwierigkeit) as Schwierigkeit[];
export const BUENDNIS = balance.buendnis as { dauer: number; bruchRuf: number; haendlerGold: number };

const GOODDEF = balance.goods as Record<Good, { label: string; base: number }>;
const BLD = balance.buildings as unknown as Record<BuildingId, BuildingDef>;

export const DEF = (id: BuildingId): BuildingDef => BLD[id];
export const label = (g: Good): string => GOODDEF[g].label;
export const rivalLabel = (id: RivalId): string => RIVALEN[id].label;

export function rangOf(ruf: number) {
  let r = RANG[0];
  for (const x of RANG) if (ruf >= x.ruf) r = x;
  return r;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

// Deterministische Zufallszahlen (mulberry32), damit Tests reproduzierbar sind.
function rand(s: GameState): number {
  let t = (s.seed = (s.seed + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function addContract(s: GameState) {
  const good = GOODS[Math.floor(rand(s) * GOODS.length)];
  const amount = 2 + Math.floor(rand(s) * 4); // 2..5
  s.contracts.push({
    id: s.nextContractId++,
    good,
    amount,
    gold: Math.round(amount * GOODDEF[good].base * 1.5),
    ruf: 2 + Math.floor(amount / 2),
  });
}

// --- Effekte der erforschten Stufen ---

function alleEffekte(s: GameState): Effekt[] {
  const out: Effekt[] = [];
  for (const z of ZWEIGE) {
    const lvl = s.forschung[z.id];
    for (let i = 0; i < lvl; i++) out.push(...z.stufen[i].effekte);
  }
  return out;
}

function hat(s: GameState, typ: Effekt['typ']): boolean {
  return alleEffekte(s).some((e) => e.typ === typ);
}

function summe(s: GameState, typ: 'zufriedenheit' | 'auftragsbonus'): number {
  return alleEffekte(s).reduce((acc, e) => (e.typ === typ && 'wert' in e ? acc + e.wert : acc), 0);
}

function maxWert(
  s: GameState,
  typ: 'raster' | 'einwohner' | 'auftragsslots' | 'verkaufsquote',
  basis: number,
): number {
  return alleEffekte(s).reduce((acc, e) => (e.typ === typ && 'wert' in e ? Math.max(acc, e.wert) : acc), basis);
}

function sparen(s: GameState, id: BuildingId): number {
  return alleEffekte(s).reduce((acc, e) => (e.typ === 'erzSparen' && e.gebaeude === id ? acc + e.wert : acc), 0);
}

function boni(s: GameState, id: BuildingId): [Good, number][] {
  return alleEffekte(s).flatMap((e) =>
    e.typ === 'bonus' && e.gebaeude === id ? [[e.gut, e.wert] as [Good, number]] : [],
  );
}

export function freigegeben(s: GameState, id: BuildingId): boolean {
  const f = DEF(id).freigabe;
  if (!f) return true;
  return alleEffekte(s).some((e) => e.typ === 'freigabe' && e.gebaeude === f);
}

export function hatMonopol(s: GameState): boolean {
  return hat(s, 'monopol');
}

export function slotCap(s: GameState): number {
  return maxWert(s, 'raster', CFG.slots);
}

export function createGame(seed = 1, schwierigkeit: Schwierigkeit = 'geselle'): GameState {
  const s: GameState = {
    seed,
    turn: 1,
    gold: CFG.startGold,
    ruf: 0,
    inv: { holz: 10, erz: 0, getreide: 5, werkzeug: 0, brot: 2, tuch: 2 },
    prices: Object.fromEntries(GOODS.map((g) => [g, GOODDEF[g].base])) as Record<Good, number>,
    slots: Array(CFG.slots).fill(null),
    pop: CFG.startPop,
    zufriedenheit: CFG.zufriedenheit.start,
    contracts: [],
    nextContractId: 1,
    log: ['Willkommen, Gildenmeister. Baue deine Stadt auf.'],
    status: 'playing',
    report: null,
    wissen: 0,
    forschung: { handwerk: 0, handel: 0, verwaltung: 0 },
    monopolGut: null,
    schwierigkeit,
    rivals: [],
    buendnis: null,
  };
  for (let i = 0; i < 3; i++) addContract(s);

  // Zwei der drei Rivalen werden zufällig ausgelost.
  const ids = [...RIVAL_IDS];
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rand(s) * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  s.rivals = ids.slice(0, 2).map((id) => ({ id, ruf: 0 }));
  s.log.push(`Gegen dich treten an: ${s.rivals.map((r) => rivalLabel(r.id)).join(' und ')}.`);
  return s;
}

function missing(s: GameState, cost: Partial<Record<Good | 'gold', number>>): string | null {
  for (const [k, n] of Object.entries(cost) as [Good | 'gold', number][]) {
    const have = k === 'gold' ? s.gold : s.inv[k];
    if (have < n) return `Zu wenig ${k === 'gold' ? 'Gold' : label(k)}.`;
  }
  return null;
}

function pay(s: GameState, cost: Partial<Record<Good | 'gold', number>>) {
  for (const [k, n] of Object.entries(cost) as [Good | 'gold', number][]) {
    if (k === 'gold') s.gold -= n;
    else s.inv[k] -= n;
  }
}

export function build(s: GameState, slot: number, id: BuildingId): string | null {
  if (s.status !== 'playing') return 'Das Spiel ist beendet.';
  if (s.slots[slot]) return 'Dieser Platz ist schon bebaut.';
  if (!freigegeben(s, id)) return 'Dieses Gebäude ist noch nicht erforscht.';
  const d = DEF(id);
  const err = missing(s, d.cost);
  if (err) return err;
  pay(s, d.cost);
  s.slots[slot] = id;
  s.log.push(`${d.label} gebaut.`);
  return null;
}

export function buy(s: GameState, good: Good): string | null {
  if (s.status !== 'playing') return 'Das Spiel ist beendet.';
  const p = Math.round(s.prices[good]);
  if (s.gold < p) return 'Nicht genug Gold.';
  s.gold -= p;
  s.inv[good] += 1;
  s.prices[good] *= 1.05;
  return null;
}

export function sell(s: GameState, good: Good): string | null {
  if (s.status !== 'playing') return 'Das Spiel ist beendet.';
  if (s.inv[good] < 1) return `Keine ${label(good)} zum Verkaufen.`;
  s.inv[good] -= 1;
  const quote = maxWert(s, 'verkaufsquote', 0.8);
  s.gold += Math.max(1, Math.floor(s.prices[good] * quote));
  if (good !== s.monopolGut) s.prices[good] = Math.max(1, s.prices[good] * 0.95);
  return null;
}

export function fulfill(s: GameState, id: number): string | null {
  if (s.status !== 'playing') return 'Das Spiel ist beendet.';
  const c = s.contracts.find((x) => x.id === id);
  if (!c) return 'Auftrag nicht mehr verfügbar.';
  if (s.inv[c.good] < c.amount) return `Dir fehlen ${c.amount - s.inv[c.good]} ${label(c.good)}.`;
  const gold = Math.round(c.gold * (1 + summe(s, 'auftragsbonus')));
  s.inv[c.good] -= c.amount;
  s.gold += gold;
  s.ruf += c.ruf;
  s.contracts = s.contracts.filter((x) => x.id !== id);
  s.log.push(`Auftrag erfüllt: +${gold} Gold, +${c.ruf} Ruf.`);
  if (s.ruf >= CFG.winRuf) {
    s.status = 'won';
    s.log.push('Du bist Gildenvorsteher!');
  }
  return null;
}

export function forschen(s: GameState, zweig: Zweig): string | null {
  if (s.status !== 'playing') return 'Das Spiel ist beendet.';
  const z = ZWEIGE.find((x) => x.id === zweig)!;
  const lvl = s.forschung[zweig];
  if (lvl >= z.stufen.length) return 'Dieser Zweig ist vollständig erforscht.';
  const st = z.stufen[lvl];
  if (s.wissen < st.kosten) return `Dir fehlen ${st.kosten - s.wissen} Wissen.`;
  s.wissen -= st.kosten;
  s.forschung[zweig] = lvl + 1;
  s.log.push(`Erforscht: ${st.name} (${z.label}).`);
  while (s.slots.length < slotCap(s)) s.slots.push(null);
  return null;
}

export function monopolWaehlen(s: GameState, good: Good): string | null {
  if (!hatMonopol(s)) return 'Das Handelsmonopol ist noch nicht erforscht.';
  if (s.monopolGut) return 'Das Monopolgut ist schon gewählt.';
  s.monopolGut = good;
  s.log.push(`Handelsmonopol auf ${label(good)} gesetzt.`);
  return null;
}

export function buendnisSchliessen(s: GameState, rival: RivalId): string | null {
  if (s.status !== 'playing') return 'Das Spiel ist beendet.';
  if (s.buendnis) return 'Es besteht schon ein Bündnis.';
  if (!s.rivals.some((r) => r.id === rival)) return 'Diese Gilde spielt nicht mit.';
  if (!RIVALEN[rival].buendnisMoeglich) return `${rivalLabel(rival)} lehnt Bündnisse ab.`;
  s.buendnis = { rival, verbleibend: BUENDNIS.dauer };
  s.log.push(`Bündnis mit ${rivalLabel(rival)} für ${BUENDNIS.dauer} Runden geschlossen.`);
  return null;
}

export function buendnisBrechen(s: GameState): string | null {
  if (!s.buendnis) return 'Kein Bündnis aktiv.';
  s.ruf = Math.max(0, s.ruf - BUENDNIS.bruchRuf);
  s.log.push(`Bündnis gebrochen: −${BUENDNIS.bruchRuf} Ruf.`);
  s.buendnis = null;
  return null;
}

export function endTurn(s: GameState): void {
  if (s.status !== 'playing') return;

  const zufBefore = s.zufriedenheit;
  const popBefore = s.pop;
  const produced: Partial<Record<Good, number>> = {};
  const consumed: Partial<Record<Good, number>> = {};
  let rival: string | null = null;

  // 0. Bündnis: Gegenleistung zahlen oder das Bündnis bricht
  if (s.buendnis) {
    const b = s.buendnis;
    let ok = true;
    if (b.rival === 'haendler') {
      if (s.gold >= BUENDNIS.haendlerGold) s.gold -= BUENDNIS.haendlerGold;
      else ok = false;
    } else if (b.rival === 'handwerker') {
      if (s.inv.tuch >= 1) s.inv.tuch -= 1;
      else if (s.inv.werkzeug >= 1) s.inv.werkzeug -= 1;
      else ok = false;
    }
    if (!ok) {
      s.ruf = Math.max(0, s.ruf - BUENDNIS.bruchRuf);
      s.buendnis = null;
      s.log.push(`Bündnis gebrochen, weil die Gegenleistung fehlte: −${BUENDNIS.bruchRuf} Ruf.`);
    } else {
      b.verbleibend -= 1;
      if (b.verbleibend <= 0) {
        s.buendnis = null;
        s.log.push('Bündnis ausgelaufen.');
      }
    }
  }

  // 1. Produktion
  let stalled = 0;
  for (const id of s.slots) {
    if (!id) continue;
    const d = DEF(id);
    const ins = (Object.entries(d.in) as [Good, number][]).map(
      ([g, n]) => [g, g === 'erz' ? Math.max(0, n - sparen(s, id)) : n] as [Good, number],
    );
    if (ins.every(([g, n]) => s.inv[g] >= n)) {
      for (const [g, n] of ins) {
        s.inv[g] -= n;
        consumed[g] = (consumed[g] ?? 0) + n;
      }
      const outs = [...(Object.entries(d.out) as [Good, number][]), ...boni(s, id)];
      for (const [g, n] of outs) {
        s.inv[g] += n;
        produced[g] = (produced[g] ?? 0) + n;
      }
      if (d.wissen) s.wissen += d.wissen;
    } else {
      stalled++;
    }
  }
  if (stalled) s.log.push(`${stalled} Gebäude standen still (fehlende Rohstoffe).`);

  // 2. Verbrauch der Bevölkerung und Zufriedenheit
  const Z = CFG.zufriedenheit;
  const brotNeed = Math.ceil(s.pop / Z.brotProEinwohner);
  const tuchNeed = Math.ceil(s.pop / Z.tuchProEinwohner);
  const brotUsed = Math.min(s.inv.brot, brotNeed);
  const tuchUsed = Math.min(s.inv.tuch, tuchNeed);
  s.inv.brot -= brotUsed;
  s.inv.tuch -= tuchUsed;
  if (brotUsed) consumed.brot = (consumed.brot ?? 0) + brotUsed;
  if (tuchUsed) consumed.tuch = (consumed.tuch ?? 0) + tuchUsed;
  s.zufriedenheit += brotUsed < brotNeed ? Z.brotFehlt : Z.brotOk;
  s.zufriedenheit += tuchUsed < tuchNeed ? Z.tuchFehlt : Z.tuchOk;
  s.zufriedenheit += summe(s, 'zufriedenheit');
  s.zufriedenheit = clamp(s.zufriedenheit, 0, 100);

  // 3. Bevölkerung wächst nur bei voller Versorgung, schrumpft bei sehr geringer Zufriedenheit
  const versorgt = brotUsed >= brotNeed && tuchUsed >= tuchNeed;
  if (versorgt && s.zufriedenheit >= Z.wachstumAb && s.pop < maxWert(s, 'einwohner', CFG.maxPop)) s.pop++;
  else if (s.zufriedenheit <= Z.schrumpfenUnter && s.pop > 1) s.pop--;

  // 4. Markt erholt sich Richtung Grundpreis
  for (const g of GOODS) {
    s.prices[g] = Math.max(1, s.prices[g] + (GOODDEF[g].base - s.prices[g]) * 0.1);
  }

  // 5. Rivalen handeln: Markt, Aufträge, Ruf
  const rivalMeldungen: string[] = [];
  const mult = SCHWIERIGKEIT[s.schwierigkeit];
  for (const r of s.rivals) {
    const c = RIVALEN[r.id];
    if (r.id === 'haendler') {
      const g = GOODS[Math.floor(rand(s) * GOODS.length)];
      s.prices[g] = Math.max(1, s.prices[g] * (rand(s) < 0.5 ? 1.05 : 0.95));
    }
    if (r.id === 'handwerker') {
      const g: Good = rand(s) < 0.5 ? 'werkzeug' : 'tuch';
      s.prices[g] = Math.max(1, s.prices[g] * (1 - (c.preisDruck ?? 0)));
    }
    if (c.rufProRunde) r.ruf += c.rufProRunde;
    if (rand(s) < c.auftragChance * mult) {
      let kandidaten = s.contracts.filter((x) => !c.bonusAb || x.ruf >= c.bonusAb);
      if (s.buendnis?.rival === r.id) kandidaten = kandidaten.filter((x) => s.inv[x.good] < x.amount);
      if (kandidaten.length) {
        const pick = kandidaten[Math.floor(rand(s) * kandidaten.length)];
        s.contracts = s.contracts.filter((x) => x.id !== pick.id);
        r.ruf += c.bonusRuf ?? pick.ruf;
        rivalMeldungen.push(`${c.label} hat den Auftrag über ${pick.amount} ${label(pick.good)} übernommen.`);
      }
    }
    if (r.ruf >= CFG.winRuf && s.status === 'playing') {
      s.status = 'lost';
      s.log.push(`${c.label} hat ${CFG.winRuf} Ruf erreicht. Die Partie ist verloren.`);
    }
  }
  if (rivalMeldungen.length) {
    rival = rivalMeldungen.join(' ');
    s.log.push(rival);
  }

  // 6. Neue Aufträge
  while (s.contracts.length >= maxWert(s, 'auftragsslots', 3)) s.contracts.shift();
  addContract(s);

  // 7. Rundenbericht und nächste Runde
  s.report = {
    turn: s.turn,
    produced,
    consumed,
    stalled,
    zufDelta: Math.round(s.zufriedenheit - zufBefore),
    zufNow: Math.round(s.zufriedenheit),
    popDelta: s.pop - popBefore,
    popNow: s.pop,
    rival,
  };
  s.turn++;
  if (s.turn > CFG.maxTurns && s.status === 'playing') {
    const best = Math.max(0, ...s.rivals.map((r) => r.ruf));
    if (s.ruf >= best) {
      s.status = 'won';
      s.log.push('Zeit abgelaufen: Du hast den meisten Ruf.');
    } else {
      s.status = 'lost';
      s.log.push('Zeit abgelaufen: Eine Rivalengilde hat mehr Ruf.');
    }
  }
}
