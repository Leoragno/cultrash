/**
 * "Indovina la Canzone/Sigla" per NOMAD — stessa banca dati e stessa regola
 * di punteggio della modalità Party (vedi App.jsx, risoluzione fase "music":
 * 150 punti per il titolo, +100 se anche l'artista è giusto), isolata qui
 * perché sia il regista della stanza NOMAD sia i test la possano usare senza
 * passare dalla UI. Forma pensata per essere il modello dei prossimi giochi
 * NOMAD: pickTrack (setup del round) / scoreSubmission (un giocatore) /
 * buildResults (tutta la stanza) — vedi il commento README-NOMAD in fondo.
 */

import { pickQuestion } from "../game/questionEngine";
import { matchGuess } from "../game/utils";

export const NOMAD_MUSIC_POOL = "nomad-music";

export function pickTrack(bank, session, poolKey = NOMAD_MUSIC_POOL) {
  const picked = pickQuestion(poolKey, bank, { keyOf: (x) => x.title, session });
  return picked?.item || null;
}

/** Punteggio di una singola risposta. `submission` è quanto scritto dal
 *  giocatore ({title, artist} o {pass:true}) o null se non ha risposto in
 *  tempo. Pura e deterministica: il regista la usa per calcolare i punti,
 *  mai il client del giocatore stesso. */
export function scoreSubmission(track, submission) {
  if (!submission || submission.pass) {
    return { pts: 0, titleOk: false, artistOk: false, note: submission?.pass ? "ha passato" : "silenzio" };
  }
  const titleOk = matchGuess(submission.title || "", track.title);
  if (!titleOk) return { pts: 0, titleOk: false, artistOk: false, note: "titolo sbagliato" };
  const artistOk = !!submission.artist && matchGuess(submission.artist, track.artist);
  return { pts: artistOk ? 250 : 150, titleOk, artistOk, note: artistOk ? "titolo e cantante" : "titolo giusto" };
}

/** Righe dei risultati, ordinate per punti decrescenti: quanto basta per
 *  disegnare sia il podio (primi tre) sia l'elenco sotto. */
export function buildResults(track, players, submissions) {
  const rows = players.map((p) => {
    const sub = submissions[p.id] || null;
    const { pts, titleOk, artistOk, note } = scoreSubmission(track, sub);
    return {
      id: p.id, name: p.name, color: p.color,
      title: sub?.title || "", artist: sub?.artist || "",
      answered: !!sub && !sub.pass, passed: !!sub?.pass,
      titleOk, artistOk, pts, note,
    };
  });
  rows.sort((a, b) => b.pts - a.pts);
  return rows;
}
