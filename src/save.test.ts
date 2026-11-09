import { describe, it, expect } from 'vitest';
import * as G from './state';
import { serialize, deserialize } from './save';

describe('Speicherstand', () => {
  it('Speichern und Laden bewahrt den Spielstand', () => {
    const s = G.createGame(5, 'meister');
    G.build(s, 0, 'saegewerk');
    G.endTurn(s);
    expect(deserialize(serialize(s))).toEqual(s);
  });

  it('Ungültiger Text ergibt keinen Stand', () => {
    expect(deserialize('kein json')).toBeNull();
    expect(deserialize('{"turn":1}')).toBeNull();
  });

  it('Beendete Partien werden nicht geladen', () => {
    const s = G.createGame(1);
    s.status = 'lost';
    expect(deserialize(serialize(s))).toBeNull();
  });
});
