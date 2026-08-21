import { describe, it, expect } from "vitest";
import {
  rouColore, encW, decW, code, dealLetters, teamsValid, ROU_ROSSO, ROU_NERO,
} from "./utils";

describe("roulette", () => {
  it("ha sei caselle rosse, sei nere e lo zero verde", () => {
    expect(ROU_ROSSO).toHaveLength(6);
    expect(ROU_NERO).toHaveLength(6);
    expect(rouColore(0)).toBe("verde");
  });

  it("assegna un colore a ogni numero senza sovrapposizioni", () => {
    const tutti = [...ROU_ROSSO, ...ROU_NERO].sort((a, b) => a - b);
    expect(tutti).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("paga allo stesso modo puntata semplice e numero secco", () => {
    // Il margine del banco deve essere identico, altrimenti una delle due
    // puntate diventa una scelta sempre sbagliata.
    const semplice = (6 / 13) * 1 - (7 / 13);
    const numero = (1 / 13) * 11 - (12 / 13);
    expect(semplice).toBeCloseTo(numero, 6);
  });
});

describe("parola del puzzle", () => {
  it("si ricostruisce dopo l'offuscamento", () => {
    expect(decW(encW("TELEVOTO"))).toBe("TELEVOTO");
  });

  it("non lascia la parola leggibile in chiaro", () => {
    expect(encW("SANREMO")).not.toContain("SANREMO");
  });
});

describe("lettere distribuite fra i membri", () => {
  it.each([
    ["SANREMO", 2], ["SANREMO", 3], ["TIRAMISU", 4], ["RIGORE", 2],
  ])("con %s in %i ricompongono la parola", (parola, n) => {
    const membri = Array.from({ length: n }, (_, i) => "p" + i);
    const lettere = dealLetters(parola, membri);
    const unite = Object.values(lettere).join("").split("").sort().join("");
    expect(unite).toBe(parola.split("").sort().join(""));
    // Nessuno deve restare a mani vuote se le lettere bastano per tutti.
    if (parola.length >= n) Object.values(lettere).forEach((l) => expect(l.length).toBeGreaterThan(0));
  });
});

describe("codice stanza", () => {
  it("è di quattro lettere senza I e O", () => {
    for (let i = 0; i < 200; i++) {
      const c = code();
      expect(c).toMatch(/^[A-HJ-NP-Z]{4}$/);
    }
  });
});

describe("validazione squadre", () => {
  const t = (team) => ({ id: Math.random().toString(36).slice(2), team });

  it("blocca una squadra con una persona sola", () => {
    expect(teamsValid([t("a"), t("a"), t("b")], "squadre")).toBe(false);
  });

  it("blocca se qualcuno è senza squadra", () => {
    expect(teamsValid([t("a"), t("a"), t("b"), t(null)], "squadre")).toBe(false);
  });

  it("consente due squadre da due", () => {
    expect(teamsValid([t("a"), t("a"), t("b"), t("b")], "squadre")).toBe(true);
  });

  it("in squadre da uno bastano due giocatori", () => {
    expect(teamsValid([t(null), t(null)], "solo")).toBe(true);
    expect(teamsValid([t(null)], "solo")).toBe(false);
  });
});
