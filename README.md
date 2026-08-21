# CULTRASH

Quiz di gruppo all'italiana, in due modalità:

- **Party** — lo schermo grande sta sul computer, i telefoni fanno da buzzer. Si apre una
  stanza, gli altri entrano con un codice di quattro lettere e si gioca.
- **Nomad** — nessuno schermo condiviso: ogni giocatore, compreso chi crea la stanza, gioca solo
  dal proprio telefono. Vedi [`NOMAD.md`](NOMAD.md) per come funziona e i suoi limiti noti.

Otto categorie — musica, sport, trash, cultura, cibo & cucina, cinema, gaming, piccante — e
diciannove minigiochi con meccaniche diverse fra loro: nessuno è la stessa domanda con un
punteggio ridipinto.

C'è anche una seconda modalità di serata, **Red Flag** (scelte, confessioni, voti e hot seat:
vince chi accumula meno bandiere rosse), selezionabile dalla stessa schermata di setup accanto
al Quiz Classico.

---

## Come si gioca

1. Sul computer: apri l'app, scegli **Schermo principale**, imposta durata, difficoltà e formazione.
2. Compare un **codice di quattro lettere**. Manda il link dell'app agli altri.
3. Sul telefono: **Sono un giocatore**, codice, nome. In modalità squadre uno la fonda col nome che vuole e gli altri ci entrano.
4. **Round 1** — ognuno (o ogni squadra) sceglie la propria categoria: lì vale ×2, gli altri prendono metà punti. Prima di rispondere si può anche attivare il rischio (dal telefono): raddoppia il punteggio se giusta, −75 se sbagliata.
5. Poi partono i minigiochi, estratti a caso a ogni partita.

### I minigiochi

| Gioco | Meccanica |
|---|---|
| Vero o falso | affermazioni secche, due tasti, conta l'ordine di arrivo |
| Tre indizi | gli indizi compaiono uno alla volta, rispondere subito vale doppio |
| Più o meno | due cose a confronto, quale è di più |
| A occhio | si scrive un numero, vince chi si avvicina |
| Sputa il rospo | metà tempo, punti che si sciolgono a vista |
| Vietato sbagliare | domande trabocchetto, ±120 |
| Rubapunti | citazioni celebri; chi indovina sceglie a chi rubare |
| Doppio o niente | sicuro (+80) oppure doppio (+200 / −100), scelto prima di rispondere |
| La puntata | si punta al buio, prima di vedere la domanda |
| La ruota | si risponde al buio, la ruota decide quanto vale |
| La corsa dei cavalli | quattro cavalli, quattro quote |
| La roulette | tredici caselle, rosso/nero/pari/dispari o numero secco |
| Roulette russa | sei caselle, una sola è quella storta |
| Chi di voi | si vota una persona del gruppo |
| Staffetta emoji *(squadre)* | rebus di emoji, risponde solo chi è di turno |
| En plein *(squadre)* | ognuno riceve una domanda diversa sul proprio telefono |
| L'intruso *(squadre)* | quattro nomi, uno non c'entra |
| Compatti *(squadre)* | nessuna risposta giusta: conta scegliere tutti la stessa |
| Il pezzo mancante *(squadre)* | puzzle sul telefono, lettere, la squadra ricompone la parola |

**Sui round d'azzardo:** si scommettono soltanto i punti della partita. Non esistono denaro,
acquisti né premi reali; anche a zero punti si può sempre puntare il minimo (50), così nessuno
resta escluso dai round d'azzardo, e il punteggio non scende mai sotto zero. Se il gioco finisce
in mano a ragazzini, la sezione si può togliere in due righe (vedi *Personalizzare*).

---

## Avvio rapido

```bash
git clone https://github.com/Leoragno/cultrash.git
cd cultrash
npm install
cp .env.example .env   # poi valorizza le variabili VITE_APPWRITE_* (vedi sotto)
npm run dev
```

Il backend predefinito (`VITE_SYNC=appwrite`) parla direttamente con Appwrite Database: non
serve avviare nessun server per giocare da più dispositivi, basta Vite.

`npm run dev` avvia comunque due processi (utili se passi a `VITE_SYNC=rest`):

- **Vite** su `http://localhost:5173` — l'interfaccia
- **il server di sincronizzazione** su `http://localhost:8787` — usato solo in modalità `rest`

Apri `http://localhost:5173` sul computer. Per collegare i telefoni della stessa rete usa
l'indirizzo locale della macchina (`http://192.168.x.x:5173`) dopo aver avviato Vite con
`npm run dev:web -- --host`.

### Produzione

Il sito è pubblicato su **Appwrite Sites** (build automatica da questo repo: `npm install` →
`npm run build` → serve `dist/`). Per un deploy manuale con la CLI di Appwrite:

```bash
appwrite sites create-deployment --site-id cultrash --code . --activate true
```

In alternativa, senza Appwrite, resta disponibile il vecchio percorso a server unico:

```bash
npm run build   # genera dist/
npm start       # il server serve dist/ e le API sulla stessa porta (richiede VITE_SYNC=rest)
```

---

## Come funziona la sincronizzazione

Non c'è WebSocket e non c'è database. Il gioco usa uno **spazio chiave/valore condiviso** e fa
polling ogni 1,3–1,6 secondi:

- `cultrash:<STANZA>:state` — scritta solo dallo schermo grande, letta dai telefoni
- `cultrash:<STANZA>:p:<id>` — una per giocatore, scritta solo da lui, letta dallo schermo grande

Ogni chiave ha un unico scrittore: niente conflitti, niente merge. Il punteggio velocità è
calcolato **sul telefono** al momento del tocco, quindi il ritardo del polling non penalizza
nessuno.

Lo strato è dietro un adattatore in `src/sync/`, con la stessa interfaccia di prima:

| Backend | Quando | `VITE_SYNC` |
|---|---|---|
| `rest` | multi-dispositivo, usa `server/index.js` | `rest` *(predefinito)* |
| `local` | schede dello stesso browser, per sviluppare da soli | `local` |

Il server tiene tutto **in memoria** con scadenza a sei ore: le partite durano una serata e non
c'è niente da conservare. Se ti serve la persistenza, sostituisci la `Map` in `server/index.js`
con Redis o Postgres: l'interfaccia sono quattro funzioni.

---

## Struttura

```
├── index.html
├── server/index.js          # API di sincronizzazione + file statici
├── src/
│   ├── App.jsx              # tutto il gioco: banche dati, host, telefono, Nomad
│   ├── main.jsx
│   ├── index.css
│   ├── game/
│   │   ├── utils.js         # funzioni pure (puzzle, roulette, squadre, chiavi)
│   │   └── utils.test.js
│   ├── nomad/                # logica pura di Nomad (vedi NOMAD.md): stati, round, QR
│   │   ├── engine.js          # macchina a stati e timer
│   │   ├── musicRound.js      # punteggio "Indovina la Canzone/Sigla"
│   │   └── qrcode.js          # matrice QR del codice stanza
│   └── sync/                # adattatore: rest.js, appwrite.js e local.js
└── .github/workflows/ci.yml
```

Le banche dati stanno in cima a `src/App.jsx`, una costante per minigioco: `Q` (domande per
categoria, con `d` = difficoltà 2 o 3), `VF`, `INDIZI`, `PIUMENO`, `STIMA`, `LAMPO`,
`TRABOCCHETTI`, `CITAZIONI`, `DOPPIO`, `DEFINIZIONI`, `EMOJI`, `INTRUSO`, `OPINIONI`, `VOTI`,
`WORDS`, `PENITENZE`, `CAVALLI`.

---

## Personalizzare

**Aggiungere domande.** Apri `src/App.jsx`, trova la costante giusta, aggiungi una voce con lo
stesso formato. Per la banca principale serve anche `d: 2` (media) o `d: 3` (difficile): il
livello *Da esperti* pesca solo dalle difficili.

**Togliere un minigioco.** Cancella la sua voce da `MG` o `TEAM_MG`. Il resto si adegua da solo:
la scaletta si costruisce leggendo quelle due tabelle.

**Togliere l'azzardo.** Rimuovi `puntata`, `ruota`, `cavalli`, `roulette` e `russa` da `MG`.

**Cambiare i tempi.** `MODES` (durata sessione) e `DIFF` (moltiplicatori di tempo e punti).

---

## Test

```bash
npm test
```

Coprono le funzioni pure: risolvibilità del puzzle, distribuzione delle lettere, margine della
roulette identico su ogni tipo di puntata, formato del codice stanza, validazione delle squadre.

La logica di punteggio dei singoli round si prova più comodamente a mano, con più finestre
aperte in modalità `local`.

---

## Limiti noti

- Il polling comporta **1–2 secondi** di latenza sui cambi di schermata. Per abbassarla servirebbe
  un WebSocket: il posto giusto è `src/sync/rest.js`, l'interfaccia non cambia.
- Lo stato sta in memoria: **riavviare il server interrompe le partite in corso**.
- Le stanze non hanno password. Chi indovina un codice di quattro lettere può entrare: per una
  serata fra amici va bene, per altro serve un minimo di autenticazione.
- Massimo otto giocatori e quattro squadre, per come sono disegnate le schermate.

## Licenza

MIT — vedi [LICENSE](LICENSE).
