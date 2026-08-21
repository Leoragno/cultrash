/**
 * Ritento condiviso da rest.js e appwrite.js.
 *
 * Host e telefoni comunicano solo tramite polling su questo storage
 * condiviso: un singolo blip di rete (wifi che scatta, richiesta lenta)
 * non deve far sparire un giocatore dalla lobby o perdere una risposta.
 * Qui ritentiamo automaticamente gli errori transitori (rete assente,
 * timeout, 429 "troppe richieste", 5xx del server) con un piccolo backoff,
 * ma lasciamo fallire subito gli errori permanenti (404 "chiave assente",
 * 400 di validazione, ecc.), che i chiamanti già trattano come stati
 * normali del gioco (es. "quella stanza non esiste").
 */

const TIMEOUT_MS = 8000;
const TENTATIVI = 2;
const RITARDO_MS = 350;

function conTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout sync")), ms);
    promise.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); }
    );
  });
}

function attesa(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Esegue `fn` (che deve restituire una Promise) ritentando in caso di
 * errore transitorio. `codiceErrore(e)` estrae il codice HTTP dall'errore,
 * se disponibile: un 4xx diverso da 429 è considerato permanente.
 */
export async function conRitentativi(fn, codiceErrore = (e) => e?.code) {
  let ultimoErrore;
  for (let i = 0; i <= TENTATIVI; i++) {
    try {
      return await conTimeout(fn(), TIMEOUT_MS);
    } catch (e) {
      ultimoErrore = e;
      const c = codiceErrore(e);
      const permanente = c >= 400 && c < 500 && c !== 429;
      if (permanente || i === TENTATIVI) throw e;
      await attesa(RITARDO_MS * (i + 1));
    }
  }
  throw ultimoErrore;
}
