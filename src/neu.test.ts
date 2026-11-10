import { describe, it, expect } from 'vitest';
import * as G from './state';

describe('Neue Regeln', () => {
  it('Die lange Partie hat mehr Runden und ein höheres Ziel', () => {
    const s = G.createGame(1, 'geselle', 'lang');
    expect(s.maxRunden).toBe(30);
    expect(s.ziel).toBe(55);
  });

  it('Die Grundpartie endet nach 20 Runden bei 40 Ruf', () => {
    const s = G.createGame(1);
    expect(s.maxRunden).toBe(G.CFG.maxTurns);
    expect(s.ziel).toBe(G.CFG.winRuf);
  });

  it('Einwohner zahlen Steuern', () => {
    const s = G.createGame(1);
    const gold = s.gold;
    G.endTurn(s);
    expect(s.gold - gold).toBe(s.report?.steuer);
    expect(s.report?.steuer).toBe(G.CFG.startPop * G.CFG.steuerProEinwohner);
  });

  it('Der Bericht zeigt das gewonnene Wissen', () => {
    const s = G.createGame(1);
    G.build(s, 0, 'schreibstube');
    G.endTurn(s);
    expect(s.report?.wissen).toBe(2);
  });

  it('Rang Geselle erhöht das Auftragsgold', () => {
    const s = G.createGame(1);
    s.ruf = 10;
    const c = s.contracts[0];
    s.inv[c.good] = c.amount;
    const gold = s.gold;
    expect(G.fulfill(s, c.id)).toBeNull();
    expect(s.gold - gold).toBe(Math.round(c.gold * 1.05));
  });

  it('Der Lagerbestand zeigt die Veränderung der letzten Runde', () => {
    const s = G.createGame(1);
    G.build(s, 0, 'mine');
    G.endTurn(s);
    expect(s.lagerTrend.erz).toBe(3);
  });

  it('Der Kursverlauf hält höchstens 10 Werte', () => {
    const s = G.createGame(1);
    s.rivals = [];
    for (let i = 0; i < 12; i++) G.endTurn(s);
    expect(s.kursVerlauf.erz.length).toBe(10);
  });
});
