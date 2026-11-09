import { describe, it, expect } from 'vitest';
import * as G from './state';

describe('Gildenstadt Spiellogik', () => {
  it('startet mit dem Startgold', () => {
    expect(G.createGame(1).gold).toBe(G.CFG.startGold);
  });

  it('Bau zieht Kosten ab und belegt den Platz', () => {
    const s = G.createGame(1);
    const gold = s.gold;
    const holz = s.inv.holz;
    expect(G.build(s, 0, 'saegewerk')).toBeNull();
    expect(s.slots[0]).toBe('saegewerk');
    expect(s.gold).toBe(gold - 40);
    expect(s.inv.holz).toBe(holz - 5);
  });

  it('Bau auf belegtem Platz schlägt fehl', () => {
    const s = G.createGame(1);
    G.build(s, 0, 'saegewerk');
    expect(G.build(s, 0, 'feld')).not.toBeNull();
  });

  it('Bau ohne genug Gold schlägt fehl', () => {
    const s = G.createGame(1);
    s.gold = 10;
    expect(G.build(s, 0, 'mine')).not.toBeNull();
    expect(s.slots[0]).toBeNull();
  });

  it('Sägewerk produziert Holz pro Runde', () => {
    const s = G.createGame(1);
    G.build(s, 0, 'saegewerk');
    const holz = s.inv.holz;
    G.endTurn(s);
    expect(s.inv.holz).toBe(holz + 3);
  });

  it('Schmiede steht still ohne Erz', () => {
    const s = G.createGame(1);
    G.build(s, 0, 'schmiede');
    const werkzeug = s.inv.werkzeug;
    G.endTurn(s);
    expect(s.inv.werkzeug).toBe(werkzeug);
  });

  it('Kaufen erhöht den Preis, Verkaufen senkt ihn', () => {
    const s = G.createGame(1);
    const p0 = s.prices.erz;
    expect(G.buy(s, 'erz')).toBeNull();
    expect(s.prices.erz).toBeGreaterThan(p0);
    const p1 = s.prices.erz;
    expect(G.sell(s, 'erz')).toBeNull();
    expect(s.prices.erz).toBeLessThan(p1);
  });

  it('Verkauf ohne Ware schlägt fehl', () => {
    const s = G.createGame(1);
    expect(G.sell(s, 'tuch')).not.toBeNull();
  });

  it('Auftrag braucht die Ware und bringt Gold und Ruf', () => {
    const s = G.createGame(1);
    const c = s.contracts[0];
    s.inv[c.good] = 0;
    expect(G.fulfill(s, c.id)).not.toBeNull();
    s.inv[c.good] = c.amount;
    const gold = s.gold;
    const ruf = s.ruf;
    expect(G.fulfill(s, c.id)).toBeNull();
    expect(s.gold).toBe(gold + c.gold);
    expect(s.ruf).toBe(ruf + c.ruf);
  });

  it('Spiel endet nach der letzten Runde als verloren', () => {
    const s = G.createGame(1);
    for (let i = 0; i < G.CFG.maxTurns; i++) G.endTurn(s);
    expect(s.status).toBe('lost');
  });

  it('Erreichter Ruf gewinnt das Spiel', () => {
    const s = G.createGame(1);
    s.ruf = G.CFG.winRuf - 1;
    const c = s.contracts[0];
    c.ruf = 3;
    s.inv[c.good] = c.amount;
    G.fulfill(s, c.id);
    expect(s.status).toBe('won');
  });

  it('Rang steigt mit dem Ruf', () => {
    expect(G.rangOf(0).name).toBe('Lehrling');
    expect(G.rangOf(40).name).toBe('Gildenvorsteher');
  });
});
