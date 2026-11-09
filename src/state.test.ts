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
    expect(G.sell(s, 'erz')).not.toBeNull();
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

  it('Spiel endet nach der letzten Runde mit dem Vergleich der Rufwerte', () => {
    const s = G.createGame(1);
    for (let i = 0; i < G.CFG.maxTurns; i++) G.endTurn(s);
    const best = Math.max(0, ...s.rivals.map((r) => r.ruf));
    expect(s.status).toBe(s.ruf >= best ? 'won' : 'lost');
  });

  it('Bei Gleichstand am Zeitlimit gewinnt der Spieler', () => {
    const s = G.createGame(1);
    s.rivals = [];
    s.ruf = 0;
    for (let i = 0; i < G.CFG.maxTurns; i++) G.endTurn(s);
    expect(s.status).toBe('won');
  });

  it('Zwei verschiedene Rivalen werden ausgelost', () => {
    const s = G.createGame(3);
    expect(s.rivals.length).toBe(2);
    expect(s.rivals[0].id).not.toBe(s.rivals[1].id);
  });

  it('Rivale mit 40 Ruf beendet die Partie als Niederlage', () => {
    const s = G.createGame(1);
    s.rivals = [{ id: 'verwalter', ruf: 39 }];
    G.endTurn(s);
    expect(s.status).toBe('lost');
  });

  it('Der Verwaltungsrat lehnt Bündnisse ab', () => {
    const s = G.createGame(1);
    s.rivals = [{ id: 'verwalter', ruf: 0 }];
    expect(G.buendnisSchliessen(s, 'verwalter')).not.toBeNull();
  });

  it('Bündnis bricht, wenn die Gegenleistung fehlt, und kostet Ruf', () => {
    const s = G.createGame(1);
    s.rivals = [{ id: 'haendler', ruf: 0 }];
    s.ruf = 5;
    s.gold = 100;
    expect(G.buendnisSchliessen(s, 'haendler')).toBeNull();
    s.gold = 0;
    G.endTurn(s);
    expect(s.buendnis).toBeNull();
    expect(s.ruf).toBe(2);
  });

  it('Die Schwierigkeit wird gespeichert', () => {
    expect(G.createGame(1, 'meister').schwierigkeit).toBe('meister');
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

  it('Versorgte Bevölkerung wird nicht in einer Runde unglücklich', () => {
    const s = G.createGame(1);
    s.inv.brot = 10;
    s.inv.tuch = 10;
    const z = s.zufriedenheit;
    G.endTurn(s);
    expect(s.zufriedenheit).toBeGreaterThan(z);
  });

  it('Ohne Versorgung sinkt die Zufriedenheit langsamer als sie vorher steigt', () => {
    const s = G.createGame(1);
    s.inv.brot = 0;
    s.inv.tuch = 0;
    const z = s.zufriedenheit;
    G.endTurn(s);
    expect(z - s.zufriedenheit).toBeLessThanOrEqual(10);
    expect(s.pop).toBe(G.CFG.startPop);
  });

  it('Bevölkerung wächst nur bei voller Versorgung', () => {
    const s = G.createGame(1);
    s.inv.brot = 10;
    s.inv.tuch = 10;
    G.endTurn(s);
    expect(s.pop).toBe(G.CFG.startPop + 1);
  });

  it('Werkstatt ist vor der Forschung gesperrt', () => {
    const s = G.createGame(1);
    expect(G.freigegeben(s, 'werkstatt')).toBe(false);
    expect(G.build(s, 0, 'werkstatt')).not.toBeNull();
  });

  it('Forschung braucht Wissen und schaltet die Werkstatt frei', () => {
    const s = G.createGame(1);
    expect(G.forschen(s, 'handwerk')).not.toBeNull();
    s.wissen = 5;
    expect(G.forschen(s, 'handwerk')).toBeNull();
    expect(s.wissen).toBe(3);
    expect(G.freigegeben(s, 'werkstatt')).toBe(true);
  });

  it('Schreibstube liefert Wissen pro Runde', () => {
    const s = G.createGame(1);
    G.build(s, 0, 'schreibstube');
    G.endTurn(s);
    expect(s.wissen).toBe(2);
  });

  it('Stadtrat erweitert das Raster auf 16 Plätze', () => {
    const s = G.createGame(1);
    s.wissen = 100;
    G.forschen(s, 'verwaltung');
    expect(s.slots.length).toBe(12);
    G.forschen(s, 'verwaltung');
    expect(s.slots.length).toBe(16);
  });

  it('Kontor hebt den Verkaufspreis auf 90 Prozent', () => {
    const s = G.createGame(1);
    s.inv.erz = 1;
    s.wissen = 100;
    const p = s.prices.erz;
    const gold = s.gold;
    G.sell(s, 'erz');
    expect(s.gold - gold).toBe(Math.floor(p * 0.8));
    G.forschen(s, 'handel');
    s.inv.erz = 1;
    const gold2 = s.gold;
    const p2 = s.prices.erz;
    G.sell(s, 'erz');
    expect(s.gold - gold2).toBe(Math.floor(p2 * 0.9));
  });

  it('Rang steigt mit dem Ruf', () => {
    expect(G.rangOf(0).name).toBe('Lehrling');
    expect(G.rangOf(40).name).toBe('Gildenvorsteher');
  });
});
