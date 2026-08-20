/**
 * Question Selection Engine — cronologia globale anti-ripetizione.
 *
 * Contesto: questo progetto non ha un database. Le domande sono array JS
 * bundlati nel client, e l'unico storage persistente è il localStorage del
 * dispositivo che fa da schermo host (vedi ./sound.js e i commenti in
 * server/index.js: la sincronizzazione fra host e telefoni è volutamente
 * effimera, "le partite durano una serata e non c'è niente da conservare").
 * Questo motore usa quindi lo stesso storage per un compito diverso — una
 * cronologia densa (non solo "vista sì/no") che sopravvive fra una partita e
 * l'altra e fra stanze diverse aperte dallo stesso dispositivo, che è la
 * condizione reale in cui questo problema si presenta (stesso host, sere e
 * stanze diverse).
 *
 * Ogni "pool" (una banca domande, es. "vf", "q:musica", "canzone"...) tiene
 * per ogni domanda: quante volte è stata usata e a quale "generazione" del
 * pool (un contatore di estrazioni, non il tempo di calendario: così il
 * cooldown si adatta da solo al ritmo di gioco reale, non a una finestra di
 * giorni scelta a caso — vedi `adaptiveCooldown`).
 */

const STORE_KEY = "cultrash:qengine:v1";

/* ---------------- storage (iniettabile: default localStorage, altrimenti
 * una Map in memoria per Node/test/SSR) ---------------- */

/** Store in memoria: usato come fallback fuori dal browser, ed esportato
 *  perché i test possano isolare ogni caso senza toccare un localStorage
 *  reale (qui non c'è jsdom: l'ambiente dei test è Node puro). */
export function createMemoryStore() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, v); },
  };
}

const fallbackStore = createMemoryStore();

function defaultStore() {
  return typeof localStorage !== "undefined" ? localStorage : fallbackStore;
}

function loadHistory(store) {
  try {
    const raw = store.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : { rev: 0, pools: {} };
  } catch (_) {
    return { rev: 0, pools: {} };
  }
}

function saveHistory(store, hist) {
  try { store.setItem(STORE_KEY, JSON.stringify(hist)); } catch (_) { /* noop: storage piena o assente */ }
}

function getPool(hist, poolKey) {
  if (!hist.pools[poolKey]) hist.pools[poolKey] = { gen: 0, items: {} };
  return hist.pools[poolKey];
}

function recordFor(pool, key) {
  return pool.items[key] || { uses: 0, lastUsedGen: -Infinity, lastUsedAt: 0 };
}

/* ---------------- cooldown adattivo ----------------
 * Niente giorni fissi: il cooldown è una frazione della dimensione del pool,
 * espresso in "quante altre estrazioni dallo stesso pool devono passare"
 * prima che una domanda torni pienamente eleggibile. Un pool da 10.000
 * domande ha un cooldown assoluto molto più lungo di uno da 1.000, e la
 * rotazione risultante segue da sé il ritmo di utilizzo reale (tante partite
 * al giorno maturano il cooldown più in fretta, poche lo maturano più
 * lentamente) senza dover stimare "domande al giorno". */
const ROTATION_FRACTION = 0.55;
const MIN_COOLDOWN_GENS = 1;

export function adaptiveCooldown(poolSize) {
  if (poolSize <= 1) return 0;
  return Math.max(MIN_COOLDOWN_GENS, Math.min(poolSize - 1, Math.round(poolSize * ROTATION_FRACTION)));
}

/* ---------------- scoring ---------------- */

const W = { freshness: 40, rarity: 24, category: 12, difficulty: 10, diversity: 8, random: 10 };

function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

function scoreCandidate(record, ctx) {
  const neverUsed = record.uses === 0;
  const elapsedGens = neverUsed ? Infinity : ctx.poolGen - record.lastUsedGen;
  const onCooldown = !neverUsed && elapsedGens < ctx.cooldownGens;
  const freshness = neverUsed ? 1 : clamp01(elapsedGens / (ctx.cooldownGens * 2 || 1));
  const rarity = 1 / (1 + record.uses);
  const category = ctx.cat != null ? 1 / (1 + (ctx.catCounts[ctx.cat] || 0)) : 1;
  const difficulty = ctx.diff != null ? 1 / (1 + (ctx.diffCounts[ctx.diff] || 0)) : 1;
  const diversity = ctx.topic != null ? 1 / (1 + (ctx.topicCounts[ctx.topic] || 0)) : 1;
  const random = Math.random();
  const score = W.freshness * freshness + W.rarity * rarity + W.category * category
    + W.difficulty * difficulty + W.diversity * diversity + W.random * random;
  return { score, neverUsed, onCooldown, elapsedGens };
}

/** Selezione pesata: le domande con punteggio più alto hanno una probabilità
 *  molto maggiore di uscire, ma non è mai una scelta deterministica.
 *
 *  Standardizza i punteggi (z-score) prima di passarli a un softmax, invece
 *  di usare il punteggio grezzo come peso proporzionale: una roulette-wheel
 *  lineare diluisce le differenze reali quando i candidati condividono una
 *  base comune alta (es. bilanciamento categoria/difficoltà neutro per
 *  entrambi) — la parte che li distingue davvero finisce per pesare poco sul
 *  totale. Con lo z-score la scala assoluta non conta: conta solo quanto un
 *  candidato si stacca dagli altri *in questo confronto*, che è esattamente
 *  quello che deve guidare la scelta. */
export function weightedChoice(scored) {
  if (scored.length === 1) return scored[0];
  const scores = scored.map((x) => x.score);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((a, b) => a + (b - mean) ** 2, 0) / scores.length;
  const std = Math.sqrt(variance) || 1;
  const weights = scores.map((s) => Math.exp((s - mean) / std));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < scored.length; i++) {
    r -= weights[i];
    if (r <= 0) return scored[i];
  }
  return scored[scored.length - 1];
}

/* ---------------- selezione con livelli di fallback progressivi ----------------
 * L1 mai usate globalmente · L2 fuori cooldown · L3 a metà cooldown ·
 * L4 qualsiasi cosa nel pool (compreso in cooldown) · L5 ultima spiaggia:
 * anche domande già usate in QUESTA partita, se il pool è troppo piccolo per
 * evitarlo (es. una banca da 7 elementi in una modalità che ne chiede di
 * più). Non si atterra mai su un random totale finché un livello migliore
 * ha candidati. */
function selectFromCandidates(annotated, ctx) {
  const l1 = annotated.filter((x) => x.rec.neverUsed);
  if (l1.length) return { picked: weightedChoice(l1), level: 1 };
  const l2 = annotated.filter((x) => !x.rec.onCooldown);
  if (l2.length) return { picked: weightedChoice(l2), level: 2 };
  const halfCooldown = ctx.cooldownGens / 2;
  const l3 = annotated.filter((x) => x.rec.elapsedGens >= halfCooldown);
  if (l3.length) return { picked: weightedChoice(l3), level: 3 };
  if (annotated.length) return { picked: weightedChoice(annotated), level: 4 };
  return null;
}

const MAX_RETRIES = 4;

/**
 * Sceglie una domanda da `candidates` evitando ripetizioni globali recenti
 * (storage condiviso, quindi valido anche fra stanze diverse) e quelle già
 * uscite in questa partita (`session`).
 *
 * @param {string} poolKey identifica la banca dati (una per minigioco/categoria)
 * @param {any[]} candidates elementi fra cui scegliere (già filtrati per difficoltà a monte)
 * @param {object} opts
 *   - keyOf(item) -> stringa stabile (default: indice nell'array)
 *   - difficultyOf(item), categoryOf(item), topicOf(item): opzionali, per il bilanciamento
 *   - session: { used: {[poolKey]: Set}, catCounts: {}, diffCounts: {}, topicCounts: {} }
 *   - avoid: Set aggiuntivo di chiavi da escludere (es. i compagni in En Plein)
 *   - store: storage iniettabile (default localStorage) — usato nei test
 * @returns {{item:any, meta:{level:number, forcedRepeat:boolean}}|null}
 */
export function pickQuestion(poolKey, candidates, opts = {}) {
  const keyOf = opts.keyOf || ((_, i) => String(i));
  const store = opts.store || defaultStore();
  const session = opts.session || { used: {}, catCounts: {}, diffCounts: {}, topicCounts: {} };
  const sessionUsed = session.used[poolKey] || (session.used[poolKey] = new Set());
  const avoid = opts.avoid;

  if (!candidates.length) return null;

  const withKeys = candidates.map((item, i) => ({ item, key: String(keyOf(item, i)) }));
  let pool0 = withKeys.filter((x) => !sessionUsed.has(x.key) && !(avoid && avoid.has(x.key)));
  let forcedRepeat = false;
  if (!pool0.length) { pool0 = withKeys; forcedRepeat = true; } // livello 5: pool esaurito in questa partita

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const hist = loadHistory(store);
    const rev = hist.rev || 0;
    const pool = getPool(hist, poolKey);
    const cooldownGens = adaptiveCooldown(candidates.length);
    const ctx = {
      poolGen: pool.gen, cooldownGens,
      cat: null, catCounts: session.catCounts,
      diff: null, diffCounts: session.diffCounts,
      topic: null, topicCounts: session.topicCounts,
    };
    const annotated = pool0.map((x) => ({
      ...x,
      cat: opts.categoryOf ? opts.categoryOf(x.item) : null,
      diff: opts.difficultyOf ? opts.difficultyOf(x.item) : null,
      topic: opts.topicOf ? opts.topicOf(x.item) : null,
    })).map((x) => {
      const rec = recordFor(pool, x.key);
      const scored = scoreCandidate(rec, { ...ctx, cat: x.cat, diff: x.diff, topic: x.topic });
      return { ...x, score: scored.score, rec: { ...rec, ...scored } };
    });

    const chosen = selectFromCandidates(annotated, ctx);
    if (!chosen) return null;
    const { picked, level } = chosen;

    // commit ottimistico: rilegge subito prima di scrivere e riparte da capo
    // se qualcun altro (un'altra scheda/stanza) ha scritto nel frattempo.
    const hist2 = loadHistory(store);
    if ((hist2.rev || 0) !== rev) continue;
    const p2 = getPool(hist2, poolKey);
    p2.gen = (p2.gen || 0) + 1;
    const prevRec = recordFor(p2, picked.key);
    p2.items[picked.key] = { uses: prevRec.uses + 1, lastUsedGen: p2.gen, lastUsedAt: Date.now() };
    hist2.rev = rev + 1;
    saveHistory(store, hist2);

    sessionUsed.add(picked.key);
    if (picked.cat != null) session.catCounts[picked.cat] = (session.catCounts[picked.cat] || 0) + 1;
    if (picked.diff != null) session.diffCounts[picked.diff] = (session.diffCounts[picked.diff] || 0) + 1;
    if (picked.topic != null) session.topicCounts[picked.topic] = (session.topicCounts[picked.topic] || 0) + 1;

    return { item: picked.item, meta: { level, forcedRepeat, key: picked.key } };
  }

  // tentativi esauriti (contesa molto insistente): procede comunque con
  // l'ultimo stato disponibile, piuttosto che far fallire la partita.
  const hist = loadHistory(store);
  const pool = getPool(hist, poolKey);
  const annotated = pool0.map((x) => ({ ...x, rec: recordFor(pool, x.key) }));
  const picked = annotated[Math.floor(Math.random() * annotated.length)];
  pool.gen = (pool.gen || 0) + 1;
  pool.items[picked.key] = { uses: (picked.rec.uses || 0) + 1, lastUsedGen: pool.gen, lastUsedAt: Date.now() };
  hist.rev = (hist.rev || 0) + 1;
  saveHistory(store, hist);
  sessionUsed.add(picked.key);
  return { item: picked.item, meta: { level: 5, forcedRepeat: true, key: picked.key } };
}

/** Stato di sessione "vuoto": da creare a inizio partita (quiz o red flag) e
 *  scartare alla fine, così le domande non si ripetono nella stessa serata e
 *  la varietà di categoria/difficoltà è valutata sulla partita in corso. */
export function createSession() {
  return { used: {}, catCounts: {}, diffCounts: {}, topicCounts: {} };
}

/** Estrae una categoria pesando quelle meno proposte in questa partita
 *  (bilanciamento categoria per i round ad estrazione libera, es. "La Puntata"). */
export function pickCategory(cats, session) {
  if (cats.length <= 1) return cats[0];
  const scored = cats.map((c) => ({ item: c, score: 1 / (1 + (session.catCounts[c] || 0)) + Math.random() * 0.3 }));
  return weightedChoice(scored).item;
}

/* ---------------- telemetria ---------------- */

/** Statistiche di un pool: utile per verificare nel tempo che il tasso di
 *  ripetizione stia davvero scendendo (vedi README/telemetria in console). */
export function getPoolStats(poolKey, store = defaultStore()) {
  const hist = loadHistory(store);
  const pool = hist.pools[poolKey];
  if (!pool) return { poolKey, gen: 0, distinctUsed: 0, totalUses: 0, neverUsedKnown: 0 };
  const records = Object.values(pool.items);
  const totalUses = records.reduce((s, r) => s + r.uses, 0);
  return {
    poolKey,
    gen: pool.gen,
    distinctUsed: records.length,
    totalUses,
    avgUsesPerItem: records.length ? totalUses / records.length : 0,
    lastUsedAt: records.reduce((m, r) => Math.max(m, r.lastUsedAt || 0), 0),
  };
}

export function getAllPoolStats(store = defaultStore()) {
  const hist = loadHistory(store);
  return Object.keys(hist.pools).map((k) => getPoolStats(k, store));
}

export const _internal = { loadHistory, saveHistory, getPool, recordFor, scoreCandidate, STORE_KEY };
