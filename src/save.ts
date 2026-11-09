import type { GameState } from './state';

export const SAVE_KEY = 'gildenstadt-spielstand-v1';

// Wandelt einen laufenden Spielstand in Text um.
export function serialize(s: GameState): string {
  return JSON.stringify(s);
}

// Liest Text wieder ein. Liefert null, wenn er kein laufendes, gültiges Spiel beschreibt.
export function deserialize(text: string): GameState | null {
  try {
    const o = JSON.parse(text) as Partial<GameState> | null;
    if (
      !o ||
      o.status !== 'playing' ||
      typeof o.turn !== 'number' ||
      typeof o.gold !== 'number' ||
      typeof o.wissen !== 'number' ||
      !Array.isArray(o.slots) ||
      !Array.isArray(o.rivals) ||
      !Array.isArray(o.contracts) ||
      !o.inv ||
      !o.prices ||
      !o.forschung
    ) {
      return null;
    }
    return o as GameState;
  } catch {
    return null;
  }
}
