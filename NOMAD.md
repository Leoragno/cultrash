# NOMAD

Seconda modalità di CULTRASH: nessuno schermo condiviso. Ogni giocatore, compreso chi crea la
stanza, gioca solo dal proprio telefono.

## Come funziona

1. Dalla schermata iniziale si sceglie **📱 Nomad** invece di **📺 Party**.
2. Chi crea la stanza ("il regista") ottiene un codice di quattro lettere, un QR e un link
   condivisibile (`?room=CODICE&mode=nomad`, apre l'app già sulla schermata di ingresso giusta).
3. Gli altri entrano col codice, col link o inquadrando il QR. In lobby si vede chi c'è, il suo
   colore e se è pronto — nessuno "schermo principale", il regista è solo un giocatore con due
   pulsanti in più (**Avvia partita**, **Termina la partita**).
4. Quando tutti sono pronti, il regista avvia: parte "Indovina la Canzone/Sigla" a round, ognuno
   sul proprio telefono, stesso frammento audio per tutti, titolo+artista da scrivere in privato.
5. Alla fine di ogni round tutti vedono la risposta corretta e i punti assegnati; si passa al
   round successivo in automatico.

## Architettura

Nessuna infrastruttura parallela: stessa sincronizzazione a chiave/valore di Party (`src/sync/`,
polling ogni 1,3–1,6 s), stesse chiavi (`kState`/`kPlayer`), stesso motore domande
(`src/game/questionEngine.js`), stessa banca musicale e stessa regola di punteggio di "Indovina
la Canzone" (150 pt titolo, +100 se anche l'artista è giusto). Una stanza Nomad è semplicemente
un `kState(room)` con `mode:"nomad"`: coesiste senza conflitti con le stanze Party, che usano lo
stesso spazio di chiavi ma un codice diverso.

- **`src/nomad/engine.js`** — macchina a stati pura: `LOBBY → STARTING → ROUND_INTRO → PLAYING →
  ANSWER_LOCKED → RESULTS → NEXT_ROUND → GAME_OVER`, con tabella di transizioni valide (niente
  booleani scollegati) e le utilità di timer basate su timestamp assoluti.
- **`src/nomad/musicRound.js`** — `pickTrack`/`scoreSubmission`/`buildResults`: la forma pensata
  per essere il modello dei prossimi giochi Nomad (vedi sotto).
- **`src/nomad/qrcode.js`** — genera la matrice del QR (libreria `qrcode`, unica dipendenza nuova
  aggiunta, richiesta esplicitamente per il QR del codice stanza).
- **`useNomadOrchestrator`** (in `App.jsx`) — il loop che orchestra la stanza: gira solo nel
  telefono del regista, mai visibile come schermo condiviso. Sceglie il brano, calcola i
  timestamp del round, raccoglie le risposte private di ognuno via poll, calcola i risultati,
  pubblica lo stato pubblico. Il resto del telefono del regista mostra la sua stessa vista da
  giocatore (`NomadPlayerView`) — nessun ramo "schermo" separato.

### Privacy: cosa è pubblico, cosa resta privato

- **Pubblico** (`kState(room)`, letto da tutti): fase, elenco giocatori con punteggio, round
  corrente, i timestamp per l'audio e il countdown. **Il titolo/artista corretti non vengono mai
  scritti qui prima che il round sia chiuso** — restano solo nella memoria del regista (stessa
  scelta già fatta in Party per "Indovina la Canzone", vedi `ask()`/risoluzione fase "music" in
  `App.jsx`), e compaiono nello stato pubblico solo a partire dalla fase `RESULTS`.
- **Privato** (`kPlayer(room, id)`, una chiave a scrittore unico): la risposta di ogni giocatore.
  Solo il regista la legge (per calcolare i punti); nessun altro giocatore la richiede mai.

### Limite di sicurezza onesto

Questa infrastruttura (vedi `src/sync/`) non ha un vero backend con controllo accessi per-chiave:
è un archivio chiave/valore condiviso dove, in teoria, chiunque conosca il formato di una chiave
potrebbe leggerla o scriverla direttamente (bypassando l'app), sia in Party sia in Nomad — il
`README.md` principale lo dichiara già per Party ("le stanze non hanno password... per altro
serve un minimo di autenticazione"). Il "regista" di una stanza Nomad resta quindi un **client
fidato**, non un server: stesso modello di fiducia già in uso per l'host di Party, non una
regressione, ma nemmeno una vera protezione anti-cheat. Risolverlo per davvero richiede una
Function/RPC lato Appwrite (o un backend con autenticazione reale) che validi le scritture e
calcoli i punteggi server-side — fuori portata senza le credenziali del progetto Appwrite.

### Timer e audio

Il regista calcola timestamp assoluti (`introEndsAt`, `audioStartAt`, `answerEndsAt`) e li
pubblica; ogni telefono calcola il proprio countdown locale confrontandoli con `Date.now()`
(`useNomadCountdown`), ricalcolando da zero a ogni tick — mai un contatore che decrementa da
solo. `MusicPlayer` (componente condiviso con Party) accetta un prop opzionale `startAt`: se
presente, schedula la riproduzione su quel timestamp anziché avviarla subito.

**Limite noto**: la YouTube IFrame API non garantisce lo stesso tempo di buffering su device
diversi, quindi la sincronizzazione audio fra telefoni è *best effort* (tipicamente entro qualche
centinaio di ms – 1-2 s), non sample-accurate. Se i giocatori sono nella stessa stanza fisica,
conviene tenere il volume alto solo su un telefono o usare le cuffie.

### Reconnect

Ogni telefono (regista incluso, per la propria vista da giocatore) deriva la schermata
interamente dall'ultimo stato pubblico ricevuto dal poll — mai da uno stato locale accumulato.
Un refresh, una perdita di connessione temporanea o l'app messa in background e poi riaperta si
risolvono da soli al giro di poll successivo, senza gestione speciale.

**Eccezione onesta**: la logica di orchestrazione (fase del round, risposta corretta, timer)
vive solo nella memoria del *browser tab* del regista — esattamente come oggi lo stato di un
host Party. Se quel tab si ricarica a metà partita, quello stato si perde (stesso limite già
presente in Party, non introdotto da Nomad).

### Rischio reale, verificato testando: il tab del regista deve restare in primo piano

Chrome (e i browser mobili in genere) rallentano drasticamente `setTimeout`/`setInterval` nelle
schede in background — se il telefono del regista si blocca lo schermo, o si passa a un'altra
app/scheda, l'avanzamento dei round può fermarsi per tutti, e le risposte inviate proprio in
quella finestra rischiano di non essere lette in tempo. Verificato empiricamente durante lo
sviluppo (non solo un'ipotesi): con la scheda del regista in background, `kState.ts` smette di
avanzare finché non torna in primo piano.

Mitigazioni implementate:

- **Wake Lock API** (`useNomadOrchestrator`): il telefono del regista prova a impedire che lo
  schermo si spenga per tutta la partita. Fallisce in silenzio dove non è supportata (Safari
  desktop, browser vecchi) — non impedisce comunque di cambiare scheda/app.
- **Battito e avviso di stallo**: il regista ripubblica lo stato ogni 4 s anche senza cambi di
  fase; se `kState.ts` non avanza da più di 13 s, tutti i telefoni (regista escluso) vedono un
  avviso "Il regista non risponde da un po'".
- **Avviso in lobby**: il regista viene avvisato esplicitamente di tenere lo schermo acceso e
  l'app in primo piano.

Non c'è modo di eliminare del tutto questo rischio restando client-only: una soluzione robusta
richiede un vero processo server-side (Appwrite Function schedulata, o un piccolo worker) che
orchestri i round indipendentemente dal telefono di chiunque.

## Errori gestiti

Codice inesistente, stanza di modalità sbagliata (Party vs Nomad), partita già iniziata, stanza
piena (`NOMAD_MAX_PLAYERS`), submit di risposta doppio/duplicato (ultimo scritto vince, innocuo),
regista che non risponde (avviso, non blocco totale).

## Architettura dei giochi Nomad

`src/nomad/musicRound.js` è il modello per i prossimi giochi: `pickTrack` (setup del round),
`scoreSubmission` (punteggio di un giocatore, pura, testabile senza fidarsi del client) e
`buildResults` (righe ordinate per la schermata risultati). Un nuovo gioco Nomad implementa le
stesse tre forme e si aggancia allo stesso `useNomadOrchestrator` (fase `PLAYING` → raccolta
submission → `ANSWER_LOCKED` → `RESULTS`), senza toccare la lobby, il reconnect o la state
machine, già generici.

Con questa base, i prossimi giochi elencati nella richiesta originale (ruoli segreti, parole
segrete, votazioni, bluff, domande personali, risposte simultanee, eliminazione, informazioni
diverse per telefono) sono implementabili riusando lo stesso scheletro: il pattern
pubblico/privato già separa "cosa vede la stanza" da "cosa vede solo un giocatore", che è
esattamente il problema che questi giochi pongono.

## Test

```bash
npm test -- src/nomad
```

Copre la macchina a stati (transizioni valide/invalide), la matematica del countdown, il
punteggio (titolo/artista giusti o sbagliati, pass, nessuna risposta) e l'ordinamento dei
risultati. La sincronizzazione end-to-end (poll, reconnect, timer condivisi) è stata verificata
manualmente con due schede del browser durante lo sviluppo, non con test automatici: richiedono
un backend condiviso reale (`VITE_SYNC=rest`, con `server/index.js` avviato) e due identità di
profilo distinte, non riproducibili facilmente in `vitest`.
