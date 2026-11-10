// Soundeffekte und ruhige Hintergrundmusik, komplett im Browser erzeugt (Web Audio API).
// Es werden keine Audiodateien geladen. Der Browser startet Töne erst nach einer Eingabe
// des Spielers, deshalb wird der Kontext beim ersten Tippen entsperrt.

export type Klang = 'tap' | 'ok' | 'error' | 'turn' | 'win' | 'lose' | 'rang';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musikBus: GainNode | null = null;
let musikIntervall: number | null = null;
let tonAn = true;
let musikAn = true;

// Ein Akkord dauert 8 Sekunden, vier Akkorde ergeben eine Schleife von 32 Sekunden.
const AKKORD_DAUER = 8;
const AKKORDE: number[][] = [
  [220, 262, 330], // Am
  [175, 220, 262], // F
  [262, 330, 392], // C
  [196, 247, 294], // G
];

function kontext(): AudioContext | null {
  if (ctx) return ctx;
  try {
    const AC =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
  return ctx;
}

// Ein einzelner Ton mit weicher Hüllkurve. Optional gleitet die Tonhöhe zu einem Zielwert.
function ton(freq: number, start: number, dauer: number, typ: OscillatorType, lautstaerke: number, ziel?: number) {
  if (!ctx || !master) return;
  const t = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = typ;
  osc.frequency.setValueAtTime(freq, t);
  if (ziel) osc.frequency.exponentialRampToValueAtTime(ziel, t + dauer);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(lautstaerke, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dauer);
  osc.connect(g);
  g.connect(master);
  osc.start(t);
  osc.stop(t + dauer + 0.05);
}

const KLAENGE: Record<Klang, () => void> = {
  tap: () => ton(700, 0, 0.06, 'sine', 0.15),
  ok: () => {
    ton(523, 0, 0.12, 'triangle', 0.18);
    ton(784, 0.09, 0.16, 'triangle', 0.18);
  },
  error: () => ton(220, 0, 0.25, 'sawtooth', 0.1, 150),
  turn: () => ton(440, 0, 0.18, 'sine', 0.15, 330),
  win: () => [523, 659, 784, 1047].forEach((f, i) => ton(f, i * 0.12, 0.35, 'triangle', 0.2)),
  lose: () => ton(330, 0, 0.8, 'sine', 0.2, 110),
  rang: () => [392, 523, 659, 784, 1047].forEach((f, i) => ton(f, i * 0.09, 0.3, 'triangle', 0.2)),
};

export function sfx(klang: Klang): void {
  if (!tonAn) return;
  const c = kontext();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  KLAENGE[klang]();
}

// Ein weicher Akkord aus drei Sinustönen, langsam ein- und ausgeblendet.
function akkord(start: number, freqs: number[]) {
  if (!ctx || !musikBus) return;
  const t = ctx.currentTime + start;
  for (const f of freqs) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.025, t + 2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + AKKORD_DAUER + 1.5);
    osc.connect(g);
    g.connect(musikBus);
    osc.start(t);
    osc.stop(t + AKKORD_DAUER + 2);
  }
}

function musikSchleife() {
  AKKORDE.forEach((a, i) => akkord(i * AKKORD_DAUER, a));
}

function startMusik() {
  const c = kontext();
  if (!c || !master || musikIntervall !== null) return;
  musikBus = c.createGain();
  musikBus.gain.value = 1;
  musikBus.connect(master);
  musikSchleife();
  musikIntervall = window.setInterval(musikSchleife, AKKORD_DAUER * AKKORDE.length * 1000);
}

function stopMusik() {
  if (musikIntervall !== null) {
    window.clearInterval(musikIntervall);
    musikIntervall = null;
  }
  const bus = musikBus;
  musikBus = null;
  if (bus && ctx) {
    const jetzt = ctx.currentTime;
    bus.gain.setValueAtTime(bus.gain.value, jetzt);
    bus.gain.linearRampToValueAtTime(0, jetzt + 0.6);
    window.setTimeout(() => bus.disconnect(), 800);
  }
}

// Wird bei jeder Eingabe aufgerufen. Entsperrt den Ton und startet die Musik, falls sie an ist.
export function entsperren(): void {
  const c = kontext();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  if (musikAn) startMusik();
}

export function setTon(an: boolean): void {
  tonAn = an;
}

export function setMusik(an: boolean): void {
  musikAn = an;
  if (an) entsperren();
  else stopMusik();
}
