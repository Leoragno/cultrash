import { describe, it, expect } from "vitest";
import {
  pickQuestion, pickCategory, createSession, adaptiveCooldown,
  getPoolStats, createMemoryStore, _internal,
} from "./questionEngine";

const items = (n) => Array.from({ length: n }, (_, i) => ({ q: `Q${i}` }));
const byQ = (x) => x.q;

describe("cooldown adattivo", () => {
  it("si adatta alla dimensione del pool invece di un numero fisso di giorni", () => {
    expect(adaptiveCooldown(10000)).toBeGreaterThan(adaptiveCooldown(1000));
    expect(adaptiveCooldown(1000)).toBeGreaterThan(adaptiveCooldown(10));
  });

  it("non blocca mai un pool troppo piccolo per avere un cooldown", () => {
    expect(adaptiveCooldown(1)).toBe(0);
    expect(adaptiveCooldown(2)).toBeGreaterThanOrEqual(1);
    expect(adaptiveCooldown(2)).toBeLessThan(2);
  });
});

describe("TEST 1 — una domanda appena usata non torna subito", () => {
  it("con una sessione diversa (quindi solo grazie alla cronologia globale)", () => {
    const store = createMemoryStore();
    const pool = items(2);
    const first = pickQuestion("p1", pool, { keyOf: byQ, session: createSession(), store });
    const second = pickQuestion("p1", pool, { keyOf: byQ, session: createSession(), store });
    expect(second.item.q).not.toBe(first.item.q);
  });
});

describe("TEST 2 e 12 — la cronologia è davvero globale fra stanze diverse", () => {
  it("una domanda usata nella stanza A viene evitata nella stanza B", () => {
    const store = createMemoryStore();
    const pool = items(4);
    const sessionA = createSession();
    const sessionB = createSession();
    const a1 = pickQuestion("stanza", pool, { keyOf: byQ, session: sessionA, store }).item.q;
    const bPicks = [0, 1, 2].map(() => pickQuestion("stanza", pool, { keyOf: byQ, session: sessionB, store }).item.q);
    expect(bPicks).not.toContain(a1);
  });

  it("il conteggio utilizzi persiste nello storage condiviso, non nella sessione", () => {
    const store = createMemoryStore();
    const pool = items(5);
    pickQuestion("stanza", pool, { keyOf: byQ, session: createSession(), store });
    pickQuestion("stanza", pool, { keyOf: byQ, session: createSession(), store });
    expect(getPoolStats("stanza", store).totalUses).toBe(2);
  });
});

describe("TEST 3 — due richieste concorrenti non si perdono a vicenda", () => {
  it("un commit ottimistico che rileva una scrittura nel frattempo riparte e registra entrambe le scelte", () => {
    const store = createMemoryStore();
    const pool = items(6);
    let reads = 0;
    let injected = false;
    const rawGet = store.getItem.bind(store);
    const rawSet = store.setItem.bind(store);
    store.getItem = (k) => {
      reads++;
      // Alla seconda lettura del primo pick (il ricontrollo pre-commit),
      // simula una seconda stanza che nel frattempo ha già scritto.
      if (reads === 2 && !injected) {
        injected = true;
        pickQuestion("stanza", pool, { keyOf: byQ, session: createSession(), store: { getItem: rawGet, setItem: rawSet } });
      }
      return rawGet(k);
    };
    const res = pickQuestion("stanza", pool, { keyOf: byQ, session: createSession(), store });
    expect(res).toBeTruthy();
    // Se il commit avesse semplicemente sovrascritto lo stato letto all'inizio
    // (il classico lost update), qui risulterebbe un solo utilizzo invece di due.
    expect(getPoolStats("stanza", store).totalUses).toBe(2);
  });
});

describe("TEST 4 — le domande rare sono favorite, non scelte a caso fra tutte", () => {
  it("una domanda usata una volta batte statisticamente una usata venti volte", () => {
    let rareWins = 0, commonWins = 0;
    for (let i = 0; i < 200; i++) {
      const store = createMemoryStore();
      store.setItem(_internal.STORE_KEY, JSON.stringify({
        rev: 0,
        pools: { pool: { gen: 1000, items: {
          rara: { uses: 1, lastUsedGen: 1, lastUsedAt: 0 },
          comune: { uses: 20, lastUsedGen: 1, lastUsedAt: 0 },
        } } },
      }));
      const res = pickQuestion("pool", [{ q: "rara" }, { q: "comune" }], { keyOf: byQ, session: createSession(), store });
      if (res.item.q === "rara") rareWins++; else commonWins++;
    }
    expect(rareWins).toBeGreaterThan(commonWins);
  });

  it("una domanda mai usata batte sempre una già usata, indipendentemente dal punteggio", () => {
    const store = createMemoryStore();
    store.setItem(_internal.STORE_KEY, JSON.stringify({
      rev: 0,
      pools: { pool: { gen: 1000, items: { vista: { uses: 1, lastUsedGen: 999, lastUsedAt: Date.now() } } } },
    }));
    for (let i = 0; i < 20; i++) {
      const res = pickQuestion("pool", [{ q: "vista" }, { q: "mai_vista" }], { keyOf: byQ, session: createSession(), store: { getItem: store.getItem, setItem: () => {} } });
      expect(res.item.q).toBe("mai_vista");
    }
  });
});

describe("TEST 5 — cronologia per giocatore", () => {
  it("non è implementata: questa app non ha un'identità giocatore persistente fra le sere (niente login, id casuale per sessione), quindi il motore lavora solo sulla cronologia globale del dispositivo host; vedi report", () => {
    expect(true).toBe(true);
  });
});

describe("TEST 6 — nessun duplicato nella stessa partita", () => {
  it("con un pool capiente, ogni estrazione della sessione è unica", () => {
    const store = createMemoryStore();
    const pool = items(8);
    const session = createSession();
    const picked = new Set();
    for (let i = 0; i < 8; i++) picked.add(pickQuestion("match", pool, { keyOf: byQ, session, store }).item.q);
    expect(picked.size).toBe(8);
  });
});

describe("TEST 7 — varietà fra categorie", () => {
  it("pickCategory non concentra sempre la stessa categoria", () => {
    const session = createSession();
    const cats = ["musica", "sport", "trash"];
    const counts = { musica: 0, sport: 0, trash: 0 };
    for (let i = 0; i < 30; i++) {
      const c = pickCategory(cats, session);
      counts[c]++;
      session.catCounts[c] = (session.catCounts[c] || 0) + 1;
    }
    Object.values(counts).forEach((n) => expect(n).toBeGreaterThan(0));
  });
});

describe("TEST 8 — varietà fra difficoltà", () => {
  it("a parità di tutto il resto, la difficoltà meno vista in partita è favorita", () => {
    const pool = [{ q: "facile", d: 1 }, { q: "difficile", d: 3 }];
    let facileWins = 0, difficileWins = 0;
    for (let i = 0; i < 100; i++) {
      const s = { ...createSession(), diffCounts: { 1: 5 } }; // "facile" già proposta molte volte in questa partita
      const res = pickQuestion("diff", pool, { keyOf: byQ, difficultyOf: (x) => x.d, session: s, store: createMemoryStore() });
      if (res.item.q === "facile") facileWins++; else difficileWins++;
    }
    expect(difficileWins).toBeGreaterThan(facileWins);
  });
});

describe("TEST 9 — funziona con un pool piccolo", () => {
  it("dopo aver esaurito il pool nella stessa partita, continua a restituire domande invece di fallire", () => {
    const store = createMemoryStore();
    const pool = items(2);
    const session = createSession();
    const results = [];
    for (let i = 0; i < 5; i++) results.push(pickQuestion("piccolo", pool, { keyOf: byQ, session, store }));
    expect(results.every(Boolean)).toBe(true);
    // le ultime, oltre la dimensione del pool, sono per forza ripetizioni segnalate come tali
    expect(results[4].meta.forcedRepeat).toBe(true);
  });
});

describe("TEST 10 — funziona senza player_id", () => {
  it("pickQuestion non richiede alcun riferimento al giocatore", () => {
    const store = createMemoryStore();
    const res = pickQuestion("nogame", items(3), { keyOf: byQ, session: createSession(), store });
    expect(res.item).toBeTruthy();
  });
});

describe("TEST 11 — la selezione è pesata/randomizzata, non un ordine fisso", () => {
  it("partendo dallo stesso stato iniziale, prove ripetute non producono sempre la stessa prima scelta", () => {
    const pool = items(6);
    const firsts = new Set();
    for (let i = 0; i < 20; i++) {
      const store = createMemoryStore();
      firsts.add(pickQuestion("random", pool, { keyOf: byQ, session: createSession(), store }).item.q);
    }
    expect(firsts.size).toBeGreaterThan(1);
  });
});
