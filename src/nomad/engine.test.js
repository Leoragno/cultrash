import { describe, it, expect } from "vitest";
import { PHASE, canTransition, assertTransition, timeWindow, remainingMs, isExpired, makeRoundId } from "./engine";

describe("state machine NOMAD", () => {
  it("consente il flusso lineare atteso", () => {
    expect(canTransition(PHASE.LOBBY, PHASE.STARTING)).toBe(true);
    expect(canTransition(PHASE.STARTING, PHASE.ROUND_INTRO)).toBe(true);
    expect(canTransition(PHASE.ROUND_INTRO, PHASE.PLAYING)).toBe(true);
    expect(canTransition(PHASE.PLAYING, PHASE.ANSWER_LOCKED)).toBe(true);
    expect(canTransition(PHASE.ANSWER_LOCKED, PHASE.RESULTS)).toBe(true);
    expect(canTransition(PHASE.RESULTS, PHASE.NEXT_ROUND)).toBe(true);
  });

  it("da NEXT_ROUND permette sia un altro round sia la fine partita", () => {
    expect(canTransition(PHASE.NEXT_ROUND, PHASE.ROUND_INTRO)).toBe(true);
    expect(canTransition(PHASE.NEXT_ROUND, PHASE.GAME_OVER)).toBe(true);
  });

  it("blocca stati impossibili", () => {
    expect(canTransition(PHASE.LOBBY, PHASE.PLAYING)).toBe(false);
    expect(canTransition(PHASE.RESULTS, PHASE.PLAYING)).toBe(false);
    expect(canTransition(PHASE.GAME_OVER, PHASE.LOBBY)).toBe(false);
  });

  it("assertTransition lancia solo sulle transizioni non valide", () => {
    expect(assertTransition(PHASE.LOBBY, PHASE.STARTING)).toBe(PHASE.STARTING);
    expect(() => assertTransition(PHASE.LOBBY, PHASE.RESULTS)).toThrow();
  });
});

describe("orologio NOMAD (timestamp assoluti, non setInterval isolati)", () => {
  it("timeWindow calcola inizio e fine assoluti dalla durata", () => {
    const w = timeWindow(1000, 5000);
    expect(w).toEqual({ startsAt: 1000, endsAt: 6000 });
  });

  it("remainingMs non va mai sotto zero", () => {
    expect(remainingMs(2000, 1000)).toBe(1000);
    expect(remainingMs(1000, 2000)).toBe(0);
  });

  it("isExpired è vero solo a tempo scaduto", () => {
    expect(isExpired(2000, 1000)).toBe(false);
    expect(isExpired(2000, 2000)).toBe(true);
    expect(isExpired(2000, 3000)).toBe(true);
  });
});

describe("id round", () => {
  it("è stabile e distinto per indice, per l'idempotenza dei submit", () => {
    expect(makeRoundId(1)).toBe("nr1");
    expect(makeRoundId(2)).not.toBe(makeRoundId(1));
  });
});
