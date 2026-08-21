/**
 * Macchina a stati e utilità temporali di NOMAD — pure, senza dipendenze da
 * React o dal browser (testabili in isolamento, vedi engine.test.js).
 *
 * NOMAD non ha uno schermo condiviso: chi crea la stanza ("il regista")
 * esegue lo stesso tipo di loop di orchestrazione che in CLASSIC gira
 * sull'host, ma il suo telefono resta un telefono come gli altri — vedi i
 * commenti in App.jsx (NomadOrchestrator) per come questo modulo viene usato.
 */

export const PHASE = {
  LOBBY: "LOBBY",
  STARTING: "STARTING",
  ROUND_INTRO: "ROUND_INTRO",
  PLAYING: "PLAYING",
  ANSWER_LOCKED: "ANSWER_LOCKED",
  RESULTS: "RESULTS",
  NEXT_ROUND: "NEXT_ROUND",
  GAME_OVER: "GAME_OVER",
};

/** Transizioni valide: evita stati impossibili (es. da LOBBY dritti a
 *  PLAYING) invece di affidarsi a booleani scollegati. */
const TRANSITIONS = {
  [PHASE.LOBBY]: [PHASE.STARTING],
  [PHASE.STARTING]: [PHASE.ROUND_INTRO],
  [PHASE.ROUND_INTRO]: [PHASE.PLAYING],
  [PHASE.PLAYING]: [PHASE.ANSWER_LOCKED],
  [PHASE.ANSWER_LOCKED]: [PHASE.RESULTS],
  [PHASE.RESULTS]: [PHASE.NEXT_ROUND],
  [PHASE.NEXT_ROUND]: [PHASE.ROUND_INTRO, PHASE.GAME_OVER],
  [PHASE.GAME_OVER]: [],
};

export function canTransition(from, to) {
  return !!TRANSITIONS[from]?.includes(to);
}

/** Ritorna `to` se la transizione è legale, altrimenti lancia: usarla nei
 *  punti in cui il regista cambia fase, così un bug di flusso fallisce
 *  rumorosamente invece di lasciare la stanza in uno stato incoerente. */
export function assertTransition(from, to) {
  if (!canTransition(from, to)) throw new Error(`NOMAD: transizione non valida ${from} -> ${to}`);
  return to;
}

/** Finestra temporale assoluta (timestamp, non durate): il client calcola il
 *  countdown locale confrontando questi timestamp con `Date.now()`, mai
 *  affidandosi a un proprio timer isolato — vedi useNomadClock in App.jsx. */
export function timeWindow(now, durationMs) {
  return { startsAt: now, endsAt: now + durationMs };
}

export function remainingMs(endsAt, now = Date.now()) {
  return Math.max(0, endsAt - now);
}

export function isExpired(endsAt, now = Date.now()) {
  return now >= endsAt;
}

export function makeRoundId(roundIndex) {
  return `nr${roundIndex}`;
}
