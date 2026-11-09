import { describe, it, expect } from 'vitest';
import * as G from './state';
import { serialize, deserialize } from './save';

describe('Markt, Einkauf und Kurse', () => {
  it('Einkaufsmenge und -wert steigen mit jedem Kauf', () => {
    const s = G.createGame(1);
    s.gold = 1000;
    G.buy(s, 'erz');
    G.buy(s, 'erz');
    expect(s.einkauf.erz.menge).toBe(2);
    expect(s.einkauf.erz.wert).toBeGreaterThan(0);
  });

  it('Verkauf senkt den Einkaufsbestand mit', () => {
    const s = G.createGame(1);
    s.gold = 1000;
    G.buy(s, 'erz');
    G.sell(s, 'erz');
    expect(s.einkauf.erz.menge).toBe(0);
    expect(s.einkauf.erz.wert).toBe(0);
  });

  it('Selbst produzierte Waren zählen nicht zum Einkauf', () => {
    const s = G.createGame(1);
    G.build(s, 0, 'mine');
    G.endTurn(s);
    expect(s.inv.erz).toBe(3);
    expect(s.einkauf.erz.menge).toBe(0);
  });

  it('Die Kursentwicklung der letzten Runde wird gespeichert', () => {
    const s = G.createGame(2);
    s.rivals = [];
    s.prices.erz = 10;
    G.endTurn(s);
    // Der Kurs erholt sich um 10 % Richtung Grundpreis 8: 10 -> 9.8
    expect(s.kursTrend.erz).toBeCloseTo(-0.02);
  });

  it('Nur bezahlbare Gebäude sind baubar', () => {
    const s = G.createGame(1);
    s.gold = 10;
    expect(G.kannBauen(s, 'mine')).toBe(false);
    s.gold = 200;
    expect(G.kannBauen(s, 'mine')).toBe(true);
  });

  it('Gesperrte Gebäude sind nicht baubar, auch wenn sie bezahlbar wären', () => {
    const s = G.createGame(1);
    s.gold = 500;
    expect(G.kannBauen(s, 'werkstatt')).toBe(false);
  });

  it('Ältere Spielstände ohne Einkauf und Kurse laden', () => {
    const s = G.createGame(1);
    const alt = JSON.parse(serialize(s));
    delete alt.einkauf;
    delete alt.kursTrend;
    const geladen = deserialize(JSON.stringify(alt));
    expect(geladen?.einkauf.erz).toEqual({ menge: 0, wert: 0 });
    expect(geladen?.kursTrend.erz).toBe(0);
  });
});
