import { describe, it, expect } from "vitest";
import { createSession } from "../game/questionEngine";
import { pickTrack, scoreSubmission, buildResults } from "./musicRound";

const BANK = [
  { id: "a", start: 0, title: "Zitti e Buoni", artist: "Måneskin" },
  { id: "b", start: 0, title: "Azzurro", artist: "Adriano Celentano" },
  { id: "c", start: 0, title: "Perdono", artist: "Tiziano Ferro" },
];

describe("pickTrack", () => {
  it("sceglie sempre un brano della banca", () => {
    for (let i = 0; i < 20; i++) {
      const t = pickTrack(BANK, createSession(), "test-pool-" + i);
      expect(BANK).toContain(t);
    }
  });
});

describe("scoreSubmission", () => {
  const track = { title: "Azzurro", artist: "Adriano Celentano" };

  it("assegna 250 punti con titolo e artista giusti", () => {
    const r = scoreSubmission(track, { title: "Azzurro", artist: "Adriano Celentano" });
    expect(r).toMatchObject({ pts: 250, titleOk: true, artistOk: true });
  });

  it("assegna 150 punti col solo titolo giusto", () => {
    const r = scoreSubmission(track, { title: "Azzurro", artist: "Vasco Rossi" });
    expect(r).toMatchObject({ pts: 150, titleOk: true, artistOk: false });
  });

  it("tollera piccole varianti del testo (maiuscole, spazi, articoli)", () => {
    const r = scoreSubmission(track, { title: "  azzurro  ", artist: "celentano" });
    expect(r.pts).toBe(250);
  });

  it("non assegna punti se il titolo è sbagliato, anche con artista giusto", () => {
    const r = scoreSubmission(track, { title: "Un'altra canzone", artist: "Adriano Celentano" });
    expect(r).toMatchObject({ pts: 0, titleOk: false });
  });

  it("non assegna punti a chi passa o non risponde", () => {
    expect(scoreSubmission(track, { pass: true }).pts).toBe(0);
    expect(scoreSubmission(track, null).pts).toBe(0);
  });
});

describe("buildResults", () => {
  const track = { title: "Azzurro", artist: "Adriano Celentano" };
  const players = [
    { id: "p1", name: "Marco", color: "#fff" },
    { id: "p2", name: "Luca", color: "#000" },
    { id: "p3", name: "Sara", color: "#111" },
  ];

  it("ordina i giocatori per punti decrescenti", () => {
    const submissions = {
      p1: { title: "Azzurro", artist: "Sbagliato" },   // 150
      p2: { title: "Azzurro", artist: "Adriano Celentano" }, // 250
      p3: { pass: true },                               // 0
    };
    const rows = buildResults(track, players, submissions);
    expect(rows.map((r) => r.id)).toEqual(["p2", "p1", "p3"]);
    expect(rows[0].pts).toBe(250);
    expect(rows[2].pts).toBe(0);
  });

  it("include una riga per ogni giocatore anche senza risposta inviata", () => {
    const rows = buildResults(track, players, {});
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.pts === 0 && !r.answered)).toBe(true);
  });
});
