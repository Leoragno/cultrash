/**
 * Funzioni pure del gioco: nessuna dipendenza da React o dal browser
 * oltre a btoa/atob. Sono qui perché siano testabili in isolamento
 * (vedi utils.test.js).
 */

export const ROU_ROSSO = [1, 4, 5, 8, 9, 12];
export const ROU_NERO = [2, 3, 6, 7, 10, 11];

/** Colore della casella della roulette. Lo zero è verde e batte tutti. */
export const rouColore = (n) => (n === 0 ? "verde" : ROU_ROSSO.includes(n) ? "rosso" : "nero");

/** Offusca la parola del puzzle: non è crittografia, serve solo a non
 *  lasciarla in chiaro nello stato condiviso letto dai telefoni. */
export const encW = (w) => btoa(w.split("").reverse().join(""));
export const decW = (e) => { try { return atob(e).split("").reverse().join(""); } catch (_) { return ""; } };

export const pick = (a) => a[Math.floor(Math.random() * a.length)];
export const shuffle = (a) => [...a].sort(() => Math.random() - 0.5);

/** Chiavi dello spazio condiviso: una per lo stato partita, una per giocatore. */
export const kState = (r) => `cultrash:${r}:state`;
export const kPlayer = (r, id) => `cultrash:${r}:p:${id}`;
export const pPrefix = (r) => `cultrash:${r}:p:`;

/** Codice stanza di 4 lettere, senza I e O per non confonderle con 1 e 0. */
export const code = () =>
  Array.from({ length: 4 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ"[Math.floor(Math.random() * 24)]).join("");

export const uid = () => Math.random().toString(36).slice(2, 8);

/** Distribuisce le lettere di una parola fra i membri di una squadra. */
export function dealLetters(word, members) {
  const out = {};
  members.forEach((m) => { out[m] = ""; });
  shuffle(word.split("")).forEach((ch, i) => { out[members[i % members.length]] += ch; });
  return out;
}

/**
 * Mescola il puzzle partendo dallo stato risolto e applicando solo mosse
 * legali: così la configurazione è per costruzione sempre risolvibile.
 */
export function scrambleTiles(N, BLANK, depth) {
  let t = Array.from({ length: N * N }, (_, i) => i);
  let bi = BLANK;
  for (let k = 0; k < depth; k++) {
    const [r, c] = [Math.floor(bi / N), bi % N];
    const opts = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]
      .filter(([a, b]) => a >= 0 && a < N && b >= 0 && b < N)
      .map(([a, b]) => a * N + b);
    const pickIdx = opts[Math.floor(Math.random() * opts.length)];
    [t[bi], t[pickIdx]] = [t[pickIdx], t[bi]];
    bi = pickIdx;
  }
  if (t.every((x, i) => x === i)) return scrambleTiles(N, BLANK, depth);
  return t;
}

/** Una squadra è valida se ha almeno due membri e nessuno resta fuori. */
export function teamsValid(players, formation) {
  if (formation === "solo") return players.length >= 2;
  const ids = [...new Set(players.map((p) => p.team).filter(Boolean))];
  if (ids.length < 2) return false;
  if (players.some((p) => !p.team)) return false;
  return ids.every((t) => players.filter((p) => p.team === t).length >= 2);
}
