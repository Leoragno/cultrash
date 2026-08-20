import { describe, it, expect } from "vitest";
import { simulateRace, RACE_TICKS } from "./raceSim";

const HORSES = [
  { nome: "FULMINE DI SCORTA", quota: 2 },
  { nome: "ULTIMO TRENO", quota: 3 },
  { nome: "SANREMO MIO", quota: 5 },
  { nome: "ZOCCOLO DURO", quota: 8 },
];

/** RNG deterministico e seedabile, per test riproducibili senza Math.random. */
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe("simulateRace", () => {
  it("il cavallo designato vince sempre, qualunque sia il seed", () => {
    for (let seed = 0; seed < 40; seed++) {
      for (let winner = 0; winner < HORSES.length; winner++) {
        const { frames, order } = simulateRace(HORSES, winner, seeded(seed * 97 + winner));
        const last = frames[frames.length - 1];
        expect(last[winner]).toBe(Math.max(...last));
        expect(order[0]).toBe(winner);
      }
    }
  });

  it("nessun cavallo torna indietro (posizione sempre non decrescente)", () => {
    const { frames } = simulateRace(HORSES, 2, seeded(7));
    for (let i = 0; i < HORSES.length; i++) {
      for (let t = 1; t < frames.length; t++) {
        expect(frames[t][i]).toBeGreaterThanOrEqual(frames[t - 1][i] - 1e-9);
      }
    }
  });

  it("le posizioni restano sempre in [0,1]", () => {
    const { frames } = simulateRace(HORSES, 0, seeded(3));
    frames.flat().forEach((p) => {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    });
  });

  it("la simulazione termina sempre con il numero di tick previsto", () => {
    const { frames, ticks } = simulateRace(HORSES, 1, seeded(11));
    expect(ticks).toBe(RACE_TICKS);
    expect(frames.length).toBe(RACE_TICKS + 1); // include il frame di partenza
  });

  it("corse diverse (seed diversi) producono andamenti diversi", () => {
    const a = simulateRace(HORSES, 0, seeded(1));
    const b = simulateRace(HORSES, 0, seeded(2));
    const mid = Math.floor(RACE_TICKS / 2);
    expect(a.frames[mid]).not.toEqual(b.frames[mid]);
  });

  it("funziona anche con due soli cavalli", () => {
    const two = [{ nome: "A", quota: 2 }, { nome: "B", quota: 4 }];
    const { frames, order } = simulateRace(two, 1, seeded(5));
    expect(order[0]).toBe(1);
    expect(frames[frames.length - 1][1]).toBe(1);
  });
});
