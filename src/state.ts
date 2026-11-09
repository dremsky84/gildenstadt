import balance from './data/balance.json';

export type Good = keyof typeof balance.goods;
export type BuildingId = keyof typeof balance.buildings;
export type Inventory = Record<Good, number>;

interface BuildingDef {
  label: string;
  cost: Partial<Record<Good | 'gold', number>>;
  in: Partial<Record<Good, number>>;
  out: Partial<Record<Good, number>>;
}

export interface Contract {
  id: number;
  good: Good;
  amount: number;
  gold: number;
  ruf: number;
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
}

export const CFG = balance;
export const GOODS = Object.keys(balance.goods) as Good[];
export const BUILDINGS = Object.keys(balance.buildings) as BuildingId[];
export const RANG = balance.rang as { ruf: number; name: string }[];

const GOODDEF = balance.goods as Record<Good, { label: string; base: number }>;
const BLD = balance.buildings as unknown as Record<BuildingId, BuildingDef>;

export const DEF = (id: BuildingId): BuildingDef => BLD[id];
export const label = (g: Good): string => GOODDEF[g].label;

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

export function createGame(seed = 1): GameState {
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
  };
  for (let i = 0; i < 3; i++) addContract(s);
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
  s.gold += Math.max(1, Math.floor(s.prices[good] * 0.8));
  s.prices[good] = Math.max(1, s.prices[good] * 0.95);
  return null;
}

export function fulfill(s: GameState, id: number): string | null {
  if (s.status !== 'playing') return 'Das Spiel ist beendet.';
  const c = s.contracts.find((x) => x.id === id);
  if (!c) return 'Auftrag nicht mehr verfügbar.';
  if (s.inv[c.good] < c.amount) return `Dir fehlen ${c.amount - s.inv[c.good]} ${label(c.good)}.`;
  s.inv[c.good] -= c.amount;
  s.gold += c.gold;
  s.ruf += c.ruf;
  s.contracts = s.contracts.filter((x) => x.id !== id);
  s.log.push(`Auftrag erfüllt: +${c.gold} Gold, +${c.ruf} Ruf.`);
  if (s.ruf >= CFG.winRuf) {
    s.status = 'won';
    s.log.push('Du bist Gildenvorsteher!');
  }
  return null;
}

export function endTurn(s: GameState): void {
  if (s.status !== 'playing') return;

  // 1. Produktion
  let stalled = 0;
  for (const id of s.slots) {
    if (!id) continue;
    const d = DEF(id);
    const ins = Object.entries(d.in) as [Good, number][];
    if (ins.every(([g, n]) => s.inv[g] >= n)) {
      for (const [g, n] of ins) s.inv[g] -= n;
      for (const [g, n] of Object.entries(d.out) as [Good, number][]) s.inv[g] += n;
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
  s.zufriedenheit += brotUsed < brotNeed ? Z.brotFehlt : Z.brotOk;
  s.zufriedenheit += tuchUsed < tuchNeed ? Z.tuchFehlt : Z.tuchOk;
  s.zufriedenheit = clamp(s.zufriedenheit, 0, 100);

  // 3. Bevölkerung wächst nur bei voller Versorgung, schrumpft bei sehr geringer Zufriedenheit
  const versorgt = brotUsed >= brotNeed && tuchUsed >= tuchNeed;
  if (versorgt && s.zufriedenheit >= Z.wachstumAb && s.pop < CFG.maxPop) s.pop++;
  else if (s.zufriedenheit <= Z.schrumpfenUnter && s.pop > 1) s.pop--;

  // 4. Markt erholt sich Richtung Grundpreis
  for (const g of GOODS) {
    s.prices[g] = Math.max(1, s.prices[g] + (GOODDEF[g].base - s.prices[g]) * 0.1);
  }

  // 5. Aufträge: Rivalen schnappen manchmal einen weg, neue kommen nach
  if (s.contracts.length && rand(s) < 0.3) {
    const i = Math.floor(rand(s) * s.contracts.length);
    const c = s.contracts.splice(i, 1)[0];
    s.log.push(`Eine Rivalengilde hat den Auftrag über ${c.amount} ${label(c.good)} übernommen.`);
  }
  if (s.contracts.length >= 3) s.contracts.shift();
  addContract(s);

  // 6. Nächste Runde
  s.turn++;
  if (s.turn > CFG.maxTurns && s.status === 'playing') {
    s.status = 'lost';
    s.log.push('Die Zeit ist abgelaufen.');
  }
}
