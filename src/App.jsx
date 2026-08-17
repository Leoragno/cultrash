import { storage } from "./sync";
import { pick, shuffle, kState, kPlayer, pPrefix, code, uid, encW, decW, rouColore, scrambleTiles } from "./game/utils";
import { sfx } from "./game/sound";
import { useState, useEffect, useRef, useCallback } from "react";

/* ============================================================
   CULTRASH PARTY
   Schermo grande sul computer · i telefoni sono i buzzer.
   ROUND 1: ognuno sceglie la sua categoria.
   POI: minigiochi a regole cambiate.
   ============================================================ */

const C = {
  ink: "#140620", ink2: "#22093A", viola: "#3A1163",
  magenta: "#FF2E86", lime: "#C6FF3D", gold: "#FFC93C",
  cyan: "#37E5F5", arancio: "#FF7A3D", cream: "#FFF3E6",
};

const CATS = {
  musica: { name: "MUSICA", color: C.lime, tag: "volume alto" },
  sport: { name: "SPORT", color: C.cyan, tag: "da bar" },
  trash: { name: "TRASH", color: C.magenta, tag: "prima serata" },
  cultura: { name: "CULTURA", color: C.arancio, tag: "salotto buono" },
  piccante: { name: "PICCANTE", color: C.gold, tag: "dopo le 23" },
};

const MODES = {
  flash: { label: "Flash", t: 12, own: 1, mgs: 2, qmg: 2, desc: "Una domanda a testa, poi 2 minigiochi. Il tempo di un caffè." },
  normale: { label: "Normale", t: 18, own: 2, mgs: 3, qmg: 3, desc: "Due domande a testa, poi 3 minigiochi. La serata standard." },
  long: { label: "Maratona", t: 22, own: 3, mgs: 5, qmg: 3, desc: "Tre a testa e 5 minigiochi. Si finisce che è tardi." },
};

const DIFF = {
  facile: { label: "Aperitivo", pool: [2], tmul: 1.3, pmul: 1, desc: "Solo domande di media tosta e tempo abbondante." },
  medio: { label: "Serata", pool: [2, 3], tmul: 1, pmul: 1.2, desc: "Medie e difficili mescolate. Il livello giusto." },
  duro: { label: "Da esperti", pool: [3], tmul: 0.75, pmul: 1.5, desc: "Solo domande difficili, poco tempo, punti pesanti." },
};

const MG = {
  verofalso: { name: "VERO O FALSO", color: C.lime, kind: "vf", rule: "Affermazioni secche, due tasti soli. Conta l'ordine di arrivo: 250 al primo che azzecca, 150 al secondo, 75 al terzo. Sbagliare non costa niente, esitare sì." },
  indizi: { name: "TRE INDIZI", color: C.magenta, kind: "clue", rule: "Gli indizi compaiono uno alla volta. Rispondi sul primo e vali doppio, aspetta il terzo e prendi le briciole. Sbagliata: −120." },
  piumeno: { name: "PIÙ O MENO", color: C.cyan, kind: "duel", rule: "Due cose a confronto, una sola è quella giusta. Chi indovina strappa 80 punti a chi comanda la classifica." },
  stima: { name: "A OCCHIO", color: C.gold, kind: "num", rule: "Niente risposte pronte: scrivete un numero. Chi si avvicina di più incassa 250, poi 150 e 75. Chi non risponde perde 50." },
  lampo: { name: "SPUTA IL ROSPO", color: C.lime, kind: "lampo", rule: "Metà del tempo normale e punti che si sciolgono secondo per secondo: si parte da 240 e si scende. Sbagliare non toglie niente, pensarci sì." },
  trabocchetto: { name: "VIETATO SBAGLIARE", color: C.magenta, kind: "trap", rule: "Domande fatte apposta per fregarvi: la risposta ovvia quasi mai è quella giusta. Giusta +120, sbagliata o silenzio −120." },
  citazioni: { name: "RUBAPUNTI", color: C.cyan, kind: "quote", rule: "Chi ha detto questa frase? Chi indovina sceglie dal telefono a chi rubare 80 punti. Le amicizie si vedono qui." },
  doppio: { name: "DOPPIO O NIENTE", color: C.arancio, kind: "risk", rule: "Prima di rispondere scegli: sicuro (+80 e nessun rischio) oppure doppio (+200 se azzecchi, −100 se sbagli)." },
  puntata: { name: "LA PUNTATA", color: C.magenta, kind: "bet", rule: "Prima di vedere la domanda si punta: 50, 150, 300 o tutto quello che avete. Giusta e incassate la puntata, sbagliata e la lasciate sul tavolo. Si punta solo coi punti della partita." },
  ruota: { name: "LA RUOTA", color: C.gold, kind: "wheel", rule: "Rispondete al buio: solo dopo gira la ruota e decide quanto vale il round. Può raddoppiare, triplicare o dimezzare tutto, nel bene e nel male." },
  cavalli: { name: "LA CORSA DEI CAVALLI", color: C.lime, kind: "azzardo", rule: "Quattro cavalli, quattro quote. Puntate su uno e guardate la corsa: chi indovina incassa la puntata moltiplicata per la quota, gli altri la lasciano lì." },
  roulette: { name: "LA ROULETTE", color: C.magenta, kind: "azzardo", rule: "Tredici caselle. Rosso, nero, pari o dispari pagano il doppio; il numero secco paga dodici volte. Lo zero verde si prende tutto." },
  russa: { name: "ROULETTE RUSSA", color: C.cyan, kind: "azzardo", rule: "Sei caselle, una sola è quella storta. Chi la sceglie lascia metà dei suoi punti, chi la evita ne guadagna 120. Nessuno sa dove sia finché non si apre." },
  vote: { name: "CHI DI VOI", color: C.arancio, kind: "vote", rule: "Niente risposta giusta: si vota una persona del gruppo. Il più votato incassa 150, chi indovina la maggioranza 60." },
};

const TEAM_MG = {
  staffetta: { name: "STAFFETTA EMOJI", color: C.arancio, team: true, kind: "emoji", rule: "Un rebus di emoji per volta: risponde uno della squadra a caso, sempre diverso finché non è toccato a tutti. Gli altri hanno i tasti bloccati e possono solo urlare." },
  enplein: { name: "EN PLEIN", color: C.lime, team: true, kind: "each", rule: "Ognuno riceve sul telefono una domanda diversa dagli altri: 100 punti per ogni membro che azzecca la sua, più 100 a testa se la squadra fa percorso netto." },
  intruso: { name: "L'INTRUSO", color: C.lime, team: true, kind: "odd", rule: "Quattro nomi, uno non c'entra niente. Risponde uno della squadra a caso, sempre diverso finché non è toccato a tutti: gli altri stanno a guardare. Se lo becca, 150 punti per tutti i compagni." },
  compatti: { name: "COMPATTI", color: C.cyan, team: true, kind: "opinion", rule: "Domanda senza risposta giusta: conta solo che la squadra scelga la stessa opzione. 200 a testa se siete unanimi, zero se qualcuno fa di testa sua." },
  puzzle: { name: "IL PEZZO MANCANTE", color: C.gold, team: true, kind: "puzzle", rule: "Ognuno ha un puzzle da ricomporre sul telefono. Chi lo finisce scopre le sue lettere: la squadra le mette insieme, ricava la parola e la scrive. Vince chi la manda per prima." },
};

const MG_ALL = { ...MG, ...TEAM_MG };

const PUZZLE_T = 100;
const BET_T = 15;
const BET_OPTS = [50, 150, 300];
const AZZ_T = 25;
const CAVALLI = [
  { nome: "FULMINE DI SCORTA", quota: 2 },
  { nome: "ULTIMO TRENO", quota: 3 },
  { nome: "SANREMO MIO", quota: 5 },
  { nome: "ZOCCOLO DURO", quota: 8 },
];
// rouColore, con le liste rosso/nero, è importato da ./game/utils
const RUOTA = [
  { m: 0.5, label: "MEZZO", note: "la ruota vi ha snobbati" },
  { m: 1, label: "×1", note: "valore pieno, niente di che" },
  { m: 2, label: "×2", note: "raddoppia tutto" },
  { m: 3, label: "×3", note: "colpo grosso" },
  { m: 2, label: "×2", note: "raddoppia tutto" },
  { m: 0.5, label: "MEZZO", note: "la ruota vi ha snobbati" },
];

/* ---- banche dati dedicate: ogni minigioco ha le sue ---- */
const VF = [
  { q: "I Måneskin hanno vinto l'Eurovision prima di Sanremo.", v: false, f: "Prima Sanremo 2021, poi l'Eurovision lo stesso anno." },
  { q: "Dante ha scritto la Divina Commedia in latino.", v: false, f: "In volgare fiorentino: fu una scelta politica, non solo stilistica." },
  { q: "Su Venere un anno dura meno di un giorno.", v: true, f: "Ruota su sé stessa in 243 giorni terrestri, orbita in 225." },
  { q: "Il format del Grande Fratello è nato in Italia.", v: false, f: "Olanda, 1999, idea di John de Mol." },
  { q: "L'Australia è più estesa della Groenlandia.", v: true, f: "Circa 7,7 milioni di km² contro 2,1." },
  { q: "Il Festival di Sanremo si è sempre tenuto all'Ariston.", v: false, f: "Le prime edizioni erano al Casinò municipale." },
  { q: "Quincy Jones ha prodotto «Thriller».", v: true, f: "Aveva già prodotto «Off the Wall» per lo stesso Michael Jackson." },
  { q: "Casanova è morto a Venezia.", v: false, f: "Morì in Boemia, bibliotecario nel castello di Dux." },
  { q: "Il Milan ha vinto più Champions League dell'Inter.", v: true, f: "Sette contro tre." },
  { q: "L'ossitocina si libera anche con un semplice abbraccio.", v: true, f: "Per questo la chiamano ormone delle coccole." },
  { q: "Wimbledon si gioca sulla terra rossa.", v: false, f: "È l'unico Slam rimasto sull'erba." },
  { q: "«Il Gattopardo» fu pubblicato mentre l'autore era in vita.", v: false, f: "Uscì postumo nel 1958, dopo vari rifiuti editoriali." },
  { q: "Il Marchese de Sade è morto in manicomio.", v: true, f: "A Charenton, nel 1814, dove continuò a scrivere e a far recitare gli internati." },
  { q: "Neil Armstrong e Buzz Aldrin scesero sulla Luna insieme.", v: false, f: "Armstrong per primo, Aldrin circa venti minuti dopo." },
  { q: "La capitale dell'Australia è Sydney.", v: false, f: "È Canberra, costruita apposta per mettere pace tra Sydney e Melbourne." },
  { q: "Il primo Mondiale di calcio fu vinto dall'Uruguay.", v: true, f: "1930, in casa, contro l'Argentina." },
];

const INDIZI = [
  { clues: ["Scrittore italiano del Novecento", "Studiava i segni e i loro significati", "Ha scritto un giallo ambientato in un'abbazia"], a: ["Umberto Eco", "Italo Calvino", "Primo Levi", "Leonardo Sciascia"], c: 0, f: "«Il nome della rosa», 1980: semiotica travestita da thriller." },
  { clues: ["Album del 1982", "Il disco più venduto della storia", "Contiene «Billie Jean»"], a: ["Thriller", "Back in Black", "The Wall", "Rumours"], c: 0, f: "Michael Jackson con Quincy Jones alla produzione." },
  { clues: ["Corre su due ruote", "Il suo numero è stato ritirato", "Nove titoli mondiali in tutte le classi"], a: ["Valentino Rossi", "Giacomo Agostini", "Max Biaggi", "Marco Simoncelli"], c: 0, f: "Agostini ne ha vinti quindici, ma il 46 è di Rossi." },
  { clues: ["Isola greca", "Sorge su una caldera vulcanica", "Case bianche e cupole blu sulle cartoline"], a: ["Santorini", "Creta", "Mykonos", "Rodi"], c: 0, f: "L'eruzione minoica del XVII secolo a.C. le ha dato quella forma." },
  { clues: ["Pittrice del Novecento", "Messicana", "Un terzo della sua opera sono autoritratti"], a: ["Frida Kahlo", "Tamara de Lempicka", "Georgia O'Keeffe", "Artemisia Gentileschi"], c: 0, f: "«Dipingo me stessa perché sono sola», diceva." },
  { clues: ["Nasce nel 1951", "Si tiene in Liguria", "Dura cinque serate e blocca il paese"], a: ["Il Festival di Sanremo", "Il Festivalbar", "L'Eurovision", "Il Premio Tenco"], c: 0, f: "Le prime edizioni si tenevano al Casinò, non all'Ariston." },
  { clues: ["Regista italiano", "Aristocratico milanese", "Ha diretto «Il Gattopardo»"], a: ["Luchino Visconti", "Vittorio De Sica", "Michelangelo Antonioni", "Pier Paolo Pasolini"], c: 0, f: "La scena del ballo gli costò mesi di riprese." },
  { clues: ["Ormone", "Lo chiamano delle coccole", "Sale con abbracci e allattamento"], a: ["Ossitocina", "Dopamina", "Serotonina", "Adrenalina"], c: 0, f: "Prodotta dall'ipotalamo, rilasciata dall'ipofisi." },
  { clues: ["Strumento a corde", "Ottantotto tasti", "Le corde sono percosse da martelletti"], a: ["Il pianoforte", "Il clavicembalo", "L'arpa", "L'organo"], c: 0, f: "Nel clavicembalo le corde sono pizzicate: per questo non fa piano e forte." },
  { clues: ["Fenomeno da telefono", "Nome preso da un fantasma", "Sparire senza spiegazioni"], a: ["Il ghosting", "Il breadcrumbing", "Il catfishing", "Il gaslighting"], c: 0, f: "Il breadcrumbing invece è lasciare briciole d'attenzione per tenerti lì." },
  { clues: ["Città italiana", "Prima capitale del Regno", "Casa dei Savoia"], a: ["Torino", "Firenze", "Roma", "Milano"], c: 0, f: "Capitale dal 1861 al 1865, poi Firenze e infine Roma." },
  { clues: ["Compositore", "Prete e violinista veneziano", "Insegnava in un orfanotrofio femminile"], a: ["Antonio Vivaldi", "Claudio Monteverdi", "Domenico Scarlatti", "Arcangelo Corelli"], c: 0, f: "Il «prete rosso», per il colore dei capelli." },
];

const PIUMENO = [
  { q: "Chi ha vinto più Champions League?", a: ["Milan", "Inter"], c: 0, f: "Sette contro tre." },
  { q: "Quale fiume è più lungo?", a: ["Po", "Tevere"], c: 0, f: "652 km contro 405." },
  { q: "Cosa è arrivato prima?", a: ["Il primo Sanremo", "La prima TV italiana"], c: 0, f: "Sanremo 1951, le trasmissioni Rai regolari 1954." },
  { q: "Quale film è uscito prima?", a: ["Jurassic Park", "Titanic"], c: 0, f: "1993 contro 1997." },
  { q: "Chi ha più Palloni d'Oro?", a: ["Messi", "Cristiano Ronaldo"], c: 0, f: "Otto contro cinque." },
  { q: "Quale pianeta è più grande?", a: ["Saturno", "Nettuno"], c: 0, f: "Saturno è il secondo del sistema solare, Nettuno il quarto." },
  { q: "Quale canzone è più vecchia?", a: ["Volare", "Vita spericolata"], c: 0, f: "1958 contro 1983." },
  { q: "Quale paese è più esteso?", a: ["Italia", "Regno Unito"], c: 0, f: "Circa 302.000 km² contro 244.000." },
  { q: "Chi è nato prima?", a: ["Freud", "Jung"], c: 0, f: "1856 contro 1875: quasi vent'anni di differenza, e si vede nel loro rapporto." },
  { q: "Quale monumento romano è più antico?", a: ["Il Colosseo", "Il Pantheon attuale"], c: 0, f: "Colosseo inaugurato nell'80, il Pantheon di Adriano è del 126." },
  { q: "Chi ha venduto più dischi?", a: ["Michael Jackson", "Madonna"], c: 0, f: "Entrambi enormi, ma «Thriller» da solo sposta l'ago." },
  { q: "Quale sport è arrivato prima alle Olimpiadi moderne?", a: ["L'atletica", "La pallavolo"], c: 0, f: "Atletica dal 1896, pallavolo solo dal 1964." },
  { q: "Quale città ha più abitanti?", a: ["Roma", "Milano"], c: 0, f: "Circa 2,7 milioni contro 1,4 nel solo comune." },
  { q: "Quale opera è più antica?", a: ["La Divina Commedia", "Il Decameron"], c: 0, f: "Commedia iniziata intorno al 1307, Decameron intorno al 1349." },
];

const STIMA = [
  { q: "In che anno è caduto il Muro di Berlino?", v: 1989, u: "" , f: "9 novembre 1989, complice anche un annuncio dato male in conferenza stampa." },
  { q: "Quanti canti ha in tutto la Divina Commedia?", v: 100, u: "canti", f: "34 Inferno, 33 Purgatorio, 33 Paradiso." },
  { q: "Quanti metri misura esattamente una maratona?", v: 42195, u: "metri", f: "La distanza fu fissata a Londra 1908 per arrivare sotto il palco reale." },
  { q: "Quanti tasti ha un pianoforte moderno?", v: 88, u: "tasti", f: "52 bianchi e 36 neri." },
  { q: "Quante ossa ha in media un adulto?", v: 206, u: "ossa", f: "Da neonati sono oltre 270: molte poi si fondono." },
  { q: "A che età è morto Mozart?", v: 35, u: "anni", f: "1791, lasciando il Requiem incompiuto." },
  { q: "In che anno è uscito il primo iPhone?", v: 2007, u: "", f: "Presentato a gennaio, in vendita a giugno." },
  { q: "Quante edizioni di Sanremo si erano tenute fino al 2025 compreso?", v: 75, u: "edizioni", f: "La prima nel 1951: il Festival ha saltato pochissimi anni." },
  { q: "Quanti elementi contiene oggi la tavola periodica?", v: 118, u: "elementi", f: "L'ultimo, l'oganesson, è stato riconosciuto nel 2016." },
  { q: "Quanti giocatori ci sono in campo in totale in una partita di calcio?", v: 22, u: "giocatori", f: "Undici per parte, portieri compresi." },
  { q: "In che anno è nato il primo campionato mondiale di Formula 1?", v: 1950, u: "", f: "Prima gara a Silverstone." },
  { q: "Quanti chilometri separa la Terra dalla Luna, in media?", v: 384400, u: "km", f: "La luce ci mette poco più di un secondo." },
];

const EMOJI = [
  { q: "👽📞🏠", a: ["E.T.", "Alien", "Interstellar", "Contact"], c: 0, f: "1982, Spielberg." },
  { q: "🚢🧊💔", a: ["Titanic", "Poseidon", "The Perfect Storm", "Master and Commander"], c: 0, f: "1997, undici Oscar." },
  { q: "🦁👑🌍", a: ["Il Re Leone", "Madagascar", "Jumanji", "Zootropolis"], c: 0, f: "1994, poi rifatto in digitale nel 2019." },
  { q: "🔥🏝️💔", a: ["Temptation Island", "L'Isola dei Famosi", "Survivor", "Pechino Express"], c: 0, f: "Il falò di confronto è ormai un genere letterario." },
  { q: "💌📺😢", a: ["C'è posta per te", "Uomini e Donne", "Amici", "Verissimo"], c: 0, f: "La busta che si chiude vale più di mille finali." },
  { q: "👨‍🍳🔪⏱️", a: ["MasterChef", "Cucine da incubo", "Quattro Ristoranti", "Bake Off"], c: 0, f: "Format britannico del 1990." },
  { q: "🎓🏫📻", a: ["Il Collegio", "La Pupa e il Secchione", "Amici", "Il Grande Fratello"], c: 0, f: "Prima edizione ambientata nel 1960." },
  { q: "🐟🔍🌊", a: ["Alla ricerca di Nemo", "Lo squalo", "Aquaman", "La Sirenetta"], c: 0, f: "Pixar, 2003." },
  { q: "🕷️🕸️🏙️", a: ["Spider-Man", "Ant-Man", "Venom", "Batman"], c: 0, f: "Personaggio nato nel 1962." },
  { q: "🎸👑🎤", a: ["Bohemian Rhapsody", "Rocketman", "A Star is Born", "Walk the Line"], c: 0, f: "Biopic sui Queen, 2018." },
  { q: "💍🌋🧝", a: ["Il Signore degli Anelli", "Harry Potter", "Le cronache di Narnia", "Il Trono di Spade"], c: 0, f: "Girato interamente in Nuova Zelanda." },
  { q: "🎭🇫🇷💰", a: ["Il conte di Montecristo", "I miserabili", "Il fantasma dell'Opera", "Cyrano"], c: 0, f: "Dumas, 1844: vendetta servita fredda in mille pagine." },
];

const INTRUSO = [
  { q: "Trova l'intruso", a: ["Picasso", "Botticelli", "Raffaello", "Caravaggio"], c: 0, f: "Gli altri tre sono pittori italiani di secoli passati, Picasso è spagnolo del Novecento." },
  { q: "Trova l'intruso", a: ["Danubio", "Po", "Adige", "Tevere"], c: 0, f: "Il Danubio non scorre in Italia." },
  { q: "Trova l'intruso", a: ["Luna", "Mercurio", "Venere", "Marte"], c: 0, f: "La Luna è un satellite, non un pianeta." },
  { q: "Trova l'intruso", a: ["MasterChef", "Sanremo", "Festivalbar", "Eurovision"], c: 0, f: "Gli altri tre sono manifestazioni musicali." },
  { q: "Trova l'intruso", a: ["Coppa Davis", "Wimbledon", "Roland Garros", "US Open"], c: 0, f: "La Davis è una competizione a squadre, gli altri sono tornei del Grande Slam." },
  { q: "Trova l'intruso", a: ["Darwin", "Freud", "Jung", "Adler"], c: 0, f: "Darwin è un naturalista, gli altri tre vengono dalla psicoanalisi." },
  { q: "Trova l'intruso", a: ["Penicillina", "Ossitocina", "Adrenalina", "Cortisolo"], c: 0, f: "La penicillina è un antibiotico, gli altri sono ormoni." },
  { q: "Trova l'intruso", a: ["Buffon", "Totti", "Del Piero", "Baggio"], c: 0, f: "Buffon è un portiere, gli altri tre giocavano davanti." },
  { q: "Trova l'intruso", a: ["Ciao Darwin", "Uomini e Donne", "Amici", "C'è posta per te"], c: 0, f: "Gli altri tre sono programmi condotti da Maria De Filippi." },
  { q: "Trova l'intruso", a: ["Divina Commedia", "Decameron", "Kamasutra", "Delta di Venere"], c: 0, f: "Gli altri tre hanno una fama decisamente più piccante." },
  { q: "Trova l'intruso", a: ["Beethoven", "Vivaldi", "Bach", "Händel"], c: 0, f: "Beethoven appartiene al classicismo e al primo romanticismo, gli altri al barocco." },
  { q: "Trova l'intruso", a: ["Canberra", "Sydney", "Melbourne", "Perth"], c: 0, f: "Canberra è la capitale, le altre tre no." },
];

const LAMPO = [
  { q: "Quante corde ha un violino?", a: ["Quattro", "Sei", "Cinque", "Tre"], c: 0, f: "Sol, Re, La, Mi." },
  { q: "Di che colore è la maglia del leader al Tour de France?", a: ["Gialla", "Rosa", "Verde", "Bianca"], c: 0, f: "Gialla come la carta del giornale che organizzava la corsa." },
  { q: "Qual è il simbolo chimico del sodio?", a: ["Na", "So", "Sd", "S"], c: 0, f: "Dal latino natrium." },
  { q: "Quante zampe ha un ragno?", a: ["Otto", "Sei", "Dieci", "Dodici"], c: 0, f: "Gli insetti ne hanno sei: il ragno non è un insetto." },
  { q: "Qual è la capitale della Norvegia?", a: ["Oslo", "Bergen", "Stoccolma", "Helsinki"], c: 0, f: "Si chiamava Christiania fino al 1925." },
  { q: "Chi ha dipinto la volta della Cappella Sistina?", a: ["Michelangelo", "Raffaello", "Botticelli", "Leonardo"], c: 0, f: "Quattro anni di lavoro, quasi tutti in piedi." },
  { q: "Quante carte ha un mazzo da poker senza jolly?", a: ["52", "48", "54", "40"], c: 0, f: "Tredici valori per quattro semi." },
  { q: "Quanti gironi ha l'Inferno di Dante?", a: ["Nove", "Sette", "Dodici", "Dieci"], c: 0, f: "L'ultimo è ghiacciato, non infuocato." },
  { q: "In quale continente si trova il Perù?", a: ["Sud America", "Centro America", "Asia", "Africa"], c: 0, f: "Capitale Lima, sull'oceano Pacifico." },
  { q: "Quanti anni dura il mandato di un presidente degli Stati Uniti?", a: ["Quattro", "Cinque", "Sei", "Sette"], c: 0, f: "Rinnovabile una sola volta dal 1951." },
  { q: "Chi ha scritto «Pinocchio»?", a: ["Collodi", "Rodari", "Salgari", "De Amicis"], c: 0, f: "Pseudonimo di Carlo Lorenzini, dal paese della madre." },
  { q: "Quanti giocatori ha in campo una squadra di rugby a 15?", a: ["Quindici", "Tredici", "Undici", "Sedici"], c: 0, f: "Il nome del gioco lo dice, ma in tanti sbagliano di fretta." },
];

const TRABOCCHETTI = [
  { q: "Quanti animali di ogni specie portò Mosè sull'arca?", a: ["Nessuno", "Due", "Sette", "Uno"], c: 0, f: "L'arca era di Noè. Mosè c'entra niente." },
  { q: "In una corsa superi il secondo: in che posizione sei?", a: ["Secondo", "Primo", "Terzo", "Dipende"], c: 0, f: "Prendi il suo posto, non quello di chi comanda." },
  { q: "Un aereo precipita sul confine: dove si seppelliscono i superstiti?", a: ["Da nessuna parte", "Nel primo paese", "Nel secondo", "Dove decide la famiglia"], c: 0, f: "I superstiti sono vivi." },
  { q: "Quanti mesi dell'anno hanno 28 giorni?", a: ["Dodici", "Uno", "Due", "Nessuno"], c: 0, f: "Tutti ne hanno almeno 28." },
  { q: "Di che colore è la «scatola nera» di un aereo?", a: ["Arancione", "Nera", "Rossa", "Grigia"], c: 0, f: "Arancione acceso, per ritrovarla tra i rottami." },
  { q: "Il Mar Morto è un mare?", a: ["No, è un lago", "Sì", "È un golfo", "È un fiume salato"], c: 0, f: "Lago salato senza sbocchi: per questo è così denso." },
  { q: "Il pomodoro è un frutto o una verdura?", a: ["Un frutto", "Una verdura", "Un tubero", "Un legume"], c: 0, f: "Botanicamente è una bacca. In cucina fate come volete." },
  { q: "Quante volte al giorno le lancette di un orologio si sovrappongono?", a: ["22", "24", "12", "48"], c: 0, f: "Undici volte ogni dodici ore, non dodici." },
  { q: "Quale isola è più grande?", a: ["La Sicilia", "La Sardegna", "Sono uguali", "Corsica"], c: 0, f: "Circa 25.700 km² contro 24.000." },
  { q: "Se accendi un fiammifero in una stanza buia con candela, lampada e stufa, cosa accendi per primo?", a: ["Il fiammifero", "La candela", "La lampada", "La stufa"], c: 0, f: "Senza fiammifero acceso non accendi niente." },
];

const CITAZIONI = [
  { q: "«Veni, vidi, vici»", a: ["Giulio Cesare", "Augusto", "Nerone", "Cicerone"], c: 0, f: "Dopo la rapidissima campagna contro Farnace, nel 47 a.C." },
  { q: "«Elementare, Watson»", a: ["Sherlock Holmes", "Hercule Poirot", "Padre Brown", "Philip Marlowe"], c: 0, f: "Curiosità: nei racconti di Conan Doyle questa frase esatta non compare mai." },
  { q: "«E pur si muove»", a: ["Galileo Galilei", "Copernico", "Keplero", "Giordano Bruno"], c: 0, f: "Attribuzione leggendaria: nessuno l'ha mai sentita davvero pronunciare." },
  { q: "«Ho un sogno»", a: ["Martin Luther King", "Malcolm X", "Nelson Mandela", "Gandhi"], c: 0, f: "Washington, agosto 1963, davanti a oltre 200.000 persone." },
  { q: "«Che la Forza sia con te»", a: ["Star Wars", "Star Trek", "Dune", "Blade Runner"], c: 0, f: "Nel primo film del 1977 la dicono più personaggi." },
  { q: "«Un piccolo passo per un uomo»", a: ["Neil Armstrong", "Buzz Aldrin", "Gagarin", "Collins"], c: 0, f: "Sulla frase esatta si discute ancora per via di un fruscio radio." },
  { q: "«Houston, abbiamo un problema»", a: ["Apollo 13", "Apollo 11", "Gravity", "Interstellar"], c: 0, f: "La frase reale era leggermente diversa: il film l'ha resa memorabile." },
  { q: "«Cogito ergo sum»", a: ["Cartesio", "Kant", "Spinoza", "Hume"], c: 0, f: "Il punto fermo che resiste anche al dubbio più radicale." },
  { q: "«Datemi un punto d'appoggio e solleverò il mondo»", a: ["Archimede", "Pitagora", "Euclide", "Talete"], c: 0, f: "Sulla leva, a Siracusa, nel III secolo a.C." },
  { q: "«Stay hungry, stay foolish»", a: ["Steve Jobs", "Bill Gates", "Elon Musk", "Jeff Bezos"], c: 0, f: "Stanford, 2005: la frase però la prese in prestito da una rivista degli anni '70." },
  { q: "«Il dado è tratto»", a: ["Giulio Cesare", "Annibale", "Alessandro Magno", "Traiano"], c: 0, f: "Al passaggio del Rubicone: da lì non si torna indietro." },
  { q: "«Francamente me ne infischio»", a: ["Via col vento", "Casablanca", "Il Padrino", "Quarto potere"], c: 0, f: "1939: all'epoca fu quasi uno scandalo per la censura americana." },
];

const DOPPIO = [
  { q: "In quale città ha sede il quartier generale della NATO?", a: ["Bruxelles", "Ginevra", "L'Aia", "Strasburgo"], c: 0, f: "Trasferito da Parigi nel 1967." },
  { q: "Quale metallo è liquido a temperatura ambiente?", a: ["Mercurio", "Piombo", "Stagno", "Zinco"], c: 0, f: "Fonde a −39 °C." },
  { q: "Chi ha scritto «Il piccolo principe»?", a: ["Saint-Exupéry", "Verne", "Camus", "Prévert"], c: 0, f: "Aviatore, scomparso in volo nel 1944." },
  { q: "Qual è l'oceano più profondo?", a: ["Pacifico", "Atlantico", "Indiano", "Artico"], c: 0, f: "La fossa delle Marianne supera gli 11.000 metri." },
  { q: "Chi descrisse per primo la circolazione del sangue?", a: ["William Harvey", "Pasteur", "Vesalio", "Galeno"], c: 0, f: "1628: smontò secoli di teorie sbagliate." },
  { q: "Quanti fusi orari attraversa la Russia?", a: ["Undici", "Sette", "Nove", "Quindici"], c: 0, f: "Da Kaliningrad alla Kamchatka." },
  { q: "Chi ha dipinto «La ronda di notte»?", a: ["Rembrandt", "Vermeer", "Van Gogh", "Rubens"], c: 0, f: "1642, ad Amsterdam. E non è affatto una scena notturna." },
  { q: "Qual è la lingua più parlata al mondo come madrelingua?", a: ["Cinese mandarino", "Inglese", "Spagnolo", "Hindi"], c: 0, f: "L'inglese vince invece contando chi la parla come seconda lingua." },
  { q: "Chi introdusse in Europa la stampa a caratteri mobili?", a: ["Gutenberg", "Manuzio", "Caxton", "Plantin"], c: 0, f: "Intorno al 1450: in Asia esisteva già da secoli." },
  { q: "In che anno è entrato in vigore il trattato di Maastricht?", a: ["1993", "1989", "1997", "2002"], c: 0, f: "Firmato nel 1992, operativo dall'anno dopo." },
];

const DEFINIZIONI = [
  { q: "Cosa significa «effimero»?", a: ["Che dura pochissimo", "Che è invisibile", "Che è finto", "Che è enorme"], c: 0, f: "Dal greco: che dura un giorno solo." },
  { q: "Cosa significa «procrastinare»?", a: ["Rimandare", "Insistere", "Sabotare", "Accelerare"], c: 0, f: "Dal latino: spostare a domani." },
  { q: "Cosa significa «ubiquo»?", a: ["Presente ovunque", "Sempre in ritardo", "Difficile da capire", "Molto raro"], c: 0, f: "Dal latino ubique, dappertutto." },
  { q: "Cosa significa «lapidario»?", a: ["Breve e tagliente", "Confuso", "Pieno di lusinghe", "Molto lungo"], c: 0, f: "Come un'iscrizione sulla pietra: poche parole, definitive." },
  { q: "Cosa significa «aulico»?", a: ["Solenne e ricercato", "Volgare", "Improvvisato", "Segreto"], c: 0, f: "Il linguaggio della corte, aula in latino." },
  { q: "Cosa significa «serendipità»?", a: ["Trovare per caso qualcosa di prezioso", "Perdere la memoria", "Ripetersi", "Fingere disinteresse"], c: 0, f: "Coniata nel Settecento da una fiaba persiana." },
  { q: "Cosa indica il «petricore»?", a: ["L'odore della pioggia sulla terra", "Il rumore del tuono", "Una roccia vulcanica", "Il gusto del ferro"], c: 0, f: "Termine coniato da due ricercatori australiani nel 1964." },
  { q: "Cosa significa «catartico»?", a: ["Che libera e purifica", "Che confonde", "Che addormenta", "Che irrita"], c: 0, f: "Dalla catarsi della tragedia greca." },
  { q: "Cosa significa «sinestesia»?", a: ["Mescolare sensi diversi", "Perdere la voce", "Ripetere un suono", "Dimenticare le parole"], c: 0, f: "«Un urlo nero», per dire: colore applicato a un suono." },
  { q: "Cosa significa «anacronismo»?", a: ["Qualcosa fuori dal suo tempo", "Un errore di calcolo", "Una parola straniera", "Un ritardo cronico"], c: 0, f: "Come un orologio da polso in un film sull'antica Roma." },
  { q: "Cosa significa «idiosincrasia»?", a: ["Avversione istintiva", "Simpatia immediata", "Abitudine noiosa", "Talento naturale"], c: 0, f: "In medicina indica una reazione anomala e personale." },
  { q: "Cosa significa «apatia»?", a: ["Assenza di emozioni", "Rabbia improvvisa", "Paura del vuoto", "Eccesso di entusiasmo"], c: 0, f: "Per gli stoici però era una virtù, non un difetto." },
  { q: "Cosa significa «epifania», in senso figurato?", a: ["Una rivelazione improvvisa", "Una lunga attesa", "Un addio", "Un errore ripetuto"], c: 0, f: "Dal greco: manifestazione." },
  { q: "Cosa significa «pletora»?", a: ["Quantità eccessiva", "Mancanza totale", "Piccolo difetto", "Confine netto"], c: 0, f: "Nato come termine medico: eccesso di sangue." },
];

const OPINIONI = [
  { q: "Qual è la cosa più trash della televisione italiana?", a: ["Il falò di confronto", "Il trono over", "La busta che si chiude", "Il televoto a pagamento"] },
  { q: "Cosa vi rappresenta di più come squadra?", a: ["Il ritardo cronico", "L'ottimismo ingiustificato", "Il rancore sportivo", "La fame perenne"] },
  { q: "Quale categoria vi fa più paura stasera?", a: ["Cultura", "Sport", "Musica", "Piccante"] },
  { q: "Il peggior modo di essere lasciati?", a: ["Un messaggio", "Il silenzio totale", "Una lettera", "Di persona, al ristorante"] },
  { q: "La cosa più sopravvalutata degli ultimi anni?", a: ["I brunch", "I capodanni", "I concerti negli stadi", "Le serie da dieci stagioni"] },
  { q: "Qual è il tormentone più insopportabile?", a: ["Quello dell'estate", "Quello di Sanremo", "Quello di TikTok", "Quello dei matrimoni"] },
  { q: "Il vero lusso, oggi?", a: ["Il silenzio", "Il tempo libero", "La batteria carica", "Un parcheggio"] },
  { q: "Come finisce questa serata?", a: ["Con un litigio", "Con altre tre partite", "Con qualcuno addormentato", "Con una rivincita"] },
  { q: "La scusa migliore per non uscire?", a: ["Il lavoro", "Il mal di testa", "Il cane", "La verità"] },
  { q: "Cosa vi salverebbe a un esame?", a: ["La fortuna", "La faccia tosta", "Le ripetizioni dell'ultimo minuto", "La preghiera"] },
];

const WORDS = [
  { w: "SANREMO", hint: "Ci si ferma davanti alla TV a febbraio" },
  { w: "KARAOKE", hint: "Si canta male, ma con convinzione" },
  { w: "REALITY", hint: "Telecamere accese anche di notte" },
  { w: "TELEVOTO", hint: "Costa e non serve a niente, eppure" },
  { w: "CANZONE", hint: "Ha strofa e ritornello" },
  { w: "CONCERTO", hint: "Si esce sordi e felici" },
  { w: "APPLAUSO", hint: "Arriva alla fine, se ve lo meritate" },
  { w: "RIGORE", hint: "Dagli undici metri" },
  { w: "MERCATO", hint: "Finestra di gennaio, per gli sportivi" },
  { w: "TROFEO", hint: "Si alza al cielo" },
  { w: "CINEMA", hint: "Buio, popcorn e telefoni spenti" },
  { w: "ROMANZO", hint: "Ha capitoli e un finale discutibile" },
  { w: "SELFIE", hint: "Braccio teso e sorriso finto" },
  { w: "TIRAMISU", hint: "Mascarpone, caffè e discussioni" },
  { w: "BALLETTO", hint: "Passi a tempo, o quasi" },
  { w: "TELEFONO", hint: "Quello che avete in mano adesso" },
];


const TEAM_COLORS = [C.magenta, C.lime, C.cyan, C.gold];
const MAX_TEAMS = 4;

const PCOL = [C.magenta, C.lime, C.cyan, C.gold, C.arancio, "#B87BFF", "#4DFFB0", "#FF5C5C"];
const LETTERS = ["A", "B", "C", "D"];
const HOST_TICK = 200, POLL_PLAYER = 1300, POLL_HOST = 1500;

/* ---------------- BANCA DOMANDE ---------------- */
const Q = {
  musica: [
    { d: 2, q: "Chi canta «Zitti e buoni»?", a: ["Måneskin", "Pinguini Tattici Nucleari", "Coma_Cose", "Psicologi"], c: 0, f: "Sanremo 2021 e poi Eurovision. Il nome è danese: significa «chiaro di luna»." },
    { d: 2, q: "Chi canta «Soldi», vincitrice di Sanremo 2019?", a: ["Mahmood", "Ultimo", "Irama", "Achille Lauro"], c: 0, f: "Poi secondo all'Eurovision. Il ritornello in arabo lo canta mezza Europa senza saperlo." },
    { d: 2, q: "«Brividi» è il duetto di...", a: ["Mahmood e Blanco", "Fedez e J-Ax", "Mengoni ed Elodie", "Sangiovanni e Madame"], c: 0, f: "Sanremo 2022. Uno dei singoli più ascoltati di sempre in Italia." },
    { d: 2, q: "Qual è il vero nome di Sfera Ebbasta?", a: ["Gionata Boschetti", "Federico Lucia", "Alessandro Aleotti", "Marco Zangirolami"], c: 0, f: "Da Cinisello Balsamo. «Ebbasta» nasce da un intercalare." },
    { d: 2, q: "Chi canta «Vita spericolata»?", a: ["Vasco Rossi", "Ligabue", "Zucchero", "Jovanotti"], c: 0, f: "Sanremo 1983: arrivò penultima. Poi è diventata un inno nazionale." },
    { d: 2, q: "Chi canta «Nel blu dipinto di blu», meglio nota come «Volare»?", a: ["Domenico Modugno", "Claudio Villa", "Nilla Pizzi", "Adriano Celentano"], c: 0, f: "Sanremo 1958. Tuttora una delle canzoni italiane più suonate al mondo." },
    { d: 2, q: "Di quale città erano i Beatles?", a: ["Liverpool", "Londra", "Manchester", "Dublino"], c: 0, f: "Si formarono nel 1960 e si sciolsero dieci anni dopo. Dieci anni." },
    { d: 2, q: "Chi canta «Bohemian Rhapsody»?", a: ["Queen", "Led Zeppelin", "The Who", "Pink Floyd"], c: 0, f: "1975, quasi sei minuti: la radio disse che era troppo lunga. Aveva torto." },
    { d: 2, q: "Qual è l'album più venduto di sempre?", a: ["Thriller", "Back in Black", "The Dark Side of the Moon", "21"], c: 0, f: "Michael Jackson, 1982. Il «Re del Pop» si è guadagnato il titolo lì." },
    { d: 2, q: "Chi ha scritto «Imagine»?", a: ["John Lennon", "Paul McCartney", "Bob Dylan", "George Harrison"], c: 0, f: "1971. Yoko Ono è stata riconosciuta co-autrice solo nel 2017." },
    { d: 2, q: "L'Inno alla gioia, inno europeo, è tratto da una sinfonia di...", a: ["Beethoven", "Mozart", "Bach", "Brahms"], c: 0, f: "La Nona, 1824. Beethoven era ormai completamente sordo quando la compose." },
    { d: 2, q: "Il reggae nasce in quale paese?", a: ["Giamaica", "Cuba", "Brasile", "Nigeria"], c: 0, f: "Anni '60. Bob Marley lo ha portato ovunque nel decennio successivo." },
    { d: 2, q: "Chi canta «Rolling in the Deep»?", a: ["Adele", "Amy Winehouse", "Duffy", "Florence Welch"], c: 0, f: "Dall'album 21, uno dei più venduti del secolo." },
    { d: 2, q: "Come si chiama il tour record di Taylor Swift?", a: ["The Eras Tour", "Reputation Tour", "Lover Fest", "Red Tour"], c: 0, f: "Primo tour della storia a superare il miliardo di dollari di incassi." },
    { d: 2, q: "Il «rickroll» ti porta a sentire quale canzone?", a: ["Never Gonna Give You Up", "Sandstorm", "All Star", "Africa"], c: 0, f: "Rick Astley, 1987. Uno scherzo da internet che dura da vent'anni." },
    { d: 2, q: "Qual è il video più visto di sempre su YouTube?", a: ["Baby Shark Dance", "Despacito", "Shape of You", "See You Again"], c: 0, f: "Superò Despacito nel 2020. La civiltà ha scelto." },
    { d: 2, q: "«Despacito» è cantata da...", a: ["Luis Fonsi", "Enrique Iglesias", "Maluma", "Ricky Martin"], c: 0, f: "Con Daddy Yankee. Il remix con Bieber la fece esplodere ovunque." },
    { d: 2, q: "Chi canta «Andiamo a comandare»?", a: ["Fabio Rovazzi", "Gabry Ponte", "Shade", "Rocco Hunt"], c: 0, f: "2016. Nato come parodia, finito primo in classifica." },
    { d: 3, q: "In che anno esce «Sgt. Pepper’s Lonely Hearts Club Band» dei Beatles?", a: ["1967", "1963", "1970", "1972"], c: 0, f: "Copertina con 57 personaggi reali. Ogni volto fu autorizzato uno per uno." },
    { d: 3, q: "Come si chiama la bassista dei Måneskin?", a: ["Victoria De Angelis", "Ethan Torchio", "Thomas Raggi", "Giorgia Soleri"], c: 0, f: "Metà danese. Il nome della band lo ha proposto lei." },
    { d: 3, q: "Chi ha prodotto l’album «Thriller»?", a: ["Quincy Jones", "Rick Rubin", "Phil Spector", "George Martin"], c: 0, f: "Aveva già prodotto «Off the Wall». Il sodalizio più redditizio della storia del pop." },
    { d: 3, q: "Quante sinfonie ha composto Beethoven?", a: ["9", "5", "12", "7"], c: 0, f: "La Decima esiste solo in abbozzi. Da allora, superstizione tra i compositori." },
    { d: 3, q: "In che anno si è tenuto il primo Eurovision Song Contest?", a: ["1956", "1964", "1949", "1972"], c: 0, f: "A Lugano, con sette paesi. Vinse la Svizzera in casa." },
    { d: 3, q: "Quale strumento suonava Charlie Parker?", a: ["Sax contralto", "Tromba", "Pianoforte", "Contrabbasso"], c: 0, f: "Detto «Bird». Con Gillespie ha inventato il bebop." },
    { d: 3, q: "Qual è il primo album dei Pink Floyd?", a: ["The Piper at the Gates of Dawn", "The Wall", "Meddle", "Animals"], c: 0, f: "1967, ancora con Syd Barrett alla guida." },
    { d: 3, q: "Quale gruppo ha inciso «OK Computer»?", a: ["Radiohead", "Blur", "Oasis", "Pulp"], c: 0, f: "1997. Doveva essere un disco sul rumore di fondo della modernità." },
    { d: 3, q: "In che anno si sono sciolti ufficialmente i Beatles?", a: ["1970", "1966", "1974", "1968"], c: 0, f: "McCartney annunciò l’uscita ad aprile, poco prima del suo primo disco solista." },
    { d: 3, q: "Chi ha composto «Nessun dorma»?", a: ["Puccini", "Verdi", "Rossini", "Donizetti"], c: 0, f: "Dalla Turandot, che Puccini lasciò incompiuta alla sua morte." },
    { d: 3, q: "In che anno si tenne il festival di Woodstock?", a: ["1969", "1972", "1965", "1975"], c: 0, f: "Tre giorni, mezzo milione di persone e parecchio fango." },
    { d: 2, q: "In quale città americana è nato il jazz?", a: ["New Orleans", "Chicago", "Memphis", "Detroit"], c: 0, f: "Fine '800, dal mix di blues, ragtime e bande di ottoni. Da lì partì per il mondo." },
    { d: 2, q: "Quanti tasti ha un pianoforte a coda standard?", a: ["88", "76", "96", "64"], c: 0, f: "52 bianchi e 36 neri. Lo standard si è fissato solo a fine Ottocento." },
    { d: 2, q: "Chi ha composto l'opera «Carmen»?", a: ["Georges Bizet", "Giuseppe Verdi", "Giacomo Puccini", "Gioachino Rossini"], c: 0, f: "Debuttò a Parigi nel 1875 tra i fischi. Bizet morì tre mesi dopo, senza saperla diventare un classico." },
    { d: 2, q: "Chi ha composto l'opera «Il flauto magico»?", a: ["Mozart", "Haydn", "Beethoven", "Salieri"], c: 0, f: "1791, l'ultimo anno di vita di Mozart. Un'opera piena di massoneria in codice." },
    { d: 2, q: "Nel canto lirico, qual è la voce femminile più acuta?", a: ["Soprano", "Contralto", "Mezzosoprano", "Basso"], c: 0, f: "Dal contralto più grave al soprano più acuto: quattro categorie principali per voce femminile." },
    { d: 2, q: "Chi ha composto la colonna sonora de «Il buono, il brutto, il cattivo»?", a: ["Ennio Morricone", "Nino Rota", "Nicola Piovani", "Riz Ortolani"], c: 0, f: "Il fischio del tema è entrato nella cultura pop più della trama del film." },
    { d: 3, q: "In che anno debutta MTV negli Stati Uniti?", a: ["1981", "1975", "1985", "1990"], c: 0, f: "Il primo video mandato in onda fu «Video Killed the Radio Star» dei Buggles. Profetico." },
    { d: 3, q: "Chi ha composto le «Variazioni Goldberg»?", a: ["Johann Sebastian Bach", "Georg Friedrich Händel", "Antonio Vivaldi", "Domenico Scarlatti"], c: 0, f: "Scritte, si dice, per curare l'insonnia di un conte. Funzionano meglio come sveglia culturale." },
  ],
  sport: [
    { d: 2, q: "In che anno l'Italia ha vinto il suo ultimo Mondiale di calcio?", a: ["2006", "1994", "2010", "1998"], c: 0, f: "Finale a Berlino contro la Francia, vinta ai rigori." },
    { d: 2, q: "Chi ha segnato il rigore decisivo nella finale del Mondiale 2006?", a: ["Fabio Grosso", "Alessandro Del Piero", "Andrea Pirlo", "Marco Materazzi"], c: 0, f: "Quinto rigore. Prima aveva segnato il gol al 119' contro la Germania." },
    { d: 2, q: "Chi era il ct dell'Italia campione del mondo nel 2006?", a: ["Marcello Lippi", "Roberto Mancini", "Cesare Prandelli", "Antonio Conte"], c: 0, f: "Nel 2021 Mancini fece il bis all'Europeo." },
    { d: 2, q: "Contro chi ha vinto l'Italia l'Europeo del 2021?", a: ["Inghilterra", "Spagna", "Germania", "Francia"], c: 0, f: "A Wembley, ai rigori. In casa loro." },
    { d: 2, q: "Quante squadre giocano in Serie A?", a: ["20", "18", "22", "16"], c: 0, f: "Sono 20 dalla stagione 2004-05." },
    { d: 2, q: "Il «derby della Madonnina» è tra quali squadre?", a: ["Inter e Milan", "Roma e Lazio", "Juve e Toro", "Genoa e Samp"], c: 0, f: "Il nome viene dalla Madonnina sul Duomo di Milano." },
    { d: 2, q: "Quante Champions League ha vinto il Milan?", a: ["7", "5", "3", "9"], c: 0, f: "Seconda solo al Real Madrid nell'albo d'oro." },
    { d: 2, q: "Quanti Mondiali ha vinto il Brasile?", a: ["5", "4", "3", "6"], c: 0, f: "Record assoluto. L'Italia è a quota 4." },
    { d: 2, q: "Al Giro d'Italia il leader indossa la maglia...", a: ["Rosa", "Gialla", "Verde", "Bianca"], c: 0, f: "Rosa come la carta della Gazzetta dello Sport, che organizza la corsa." },
    { d: 2, q: "Quanti giocatori ha in campo una squadra di pallavolo?", a: ["6", "5", "7", "8"], c: 0, f: "Uno di loro, il libero, ha la maglia diversa e non può attaccare." },
    { d: 2, q: "Nel basket, quanto vale un canestro da oltre l'arco?", a: ["3 punti", "2 punti", "4 punti", "1 punto"], c: 0, f: "La linea da tre è arrivata nell'NBA solo nel 1979." },
    { d: 2, q: "Chi è soprannominato «il Pupone»?", a: ["Francesco Totti", "Alessandro Del Piero", "Gigi Buffon", "Christian Vieri"], c: 0, f: "Una vita sola alla Roma: 25 anni in giallorosso." },
    { d: 2, q: "In quale sport si assegna il Sei Nazioni?", a: ["Rugby", "Calcio", "Hockey", "Cricket"], c: 0, f: "L'Italia partecipa dal 2000." },
    { d: 2, q: "Jannik Sinner ha vinto il suo primo Slam in quale torneo?", a: ["Australian Open", "Wimbledon", "Roland Garros", "US Open"], c: 0, f: "2024, rimontando due set nella finale." },
    { d: 2, q: "Su quale superficie si gioca Wimbledon?", a: ["Erba", "Terra rossa", "Cemento", "Sintetico"], c: 0, f: "L'unico Slam ancora sull'erba: si gioca dal 1877." },
    { d: 2, q: "Ogni quanti anni si tengono le Olimpiadi estive?", a: ["4", "2", "5", "3"], c: 0, f: "Le invernali si alternano, sfalsate di due anni." },
    { d: 2, q: "Dove si tengono le Olimpiadi invernali del 2026?", a: ["Milano-Cortina", "Torino", "Innsbruck", "Sapporo"], c: 0, f: "Prima volta con due città capofila nel nome ufficiale." },
    { d: 2, q: "Quanti titoli mondiali di Formula 1 hanno Schumacher e Hamilton a testa?", a: ["7", "5", "6", "8"], c: 0, f: "Record condiviso. Fangio ne aveva 5 negli anni '50." },
    { d: 2, q: "Quante volte Valentino Rossi è stato campione del mondo, in tutte le classi?", a: ["9", "7", "11", "5"], c: 0, f: "Il 46 è stato ritirato dalla MotoGP in suo onore." },
    { d: 2, q: "Chi detiene il record mondiale dei 100 metri?", a: ["Usain Bolt", "Tyson Gay", "Yohan Blake", "Carl Lewis"], c: 0, f: "9 secondi e 58, Berlino 2009. E nessuno si avvicina." },
    { d: 3, q: "Chi ha vinto il primo Mondiale di calcio della storia, nel 1930?", a: ["Uruguay", "Brasile", "Italia", "Argentina"], c: 0, f: "Giocato in casa. Le due squadre finaliste portarono ognuna il proprio pallone: uno per tempo." },
    { d: 3, q: "Quante Coppe dei Campioni/Champions ha vinto la Juventus?", a: ["2", "4", "1", "3"], c: 0, f: "1985 e 1996. Più nove finali perse: un record meno felice." },
    { d: 3, q: "Quante medaglie d’oro olimpiche ha vinto Michael Phelps?", a: ["23", "14", "19", "28"], c: 0, f: "Record assoluto. Il secondo nella storia è a quota 9." },
    { d: 3, q: "Quanti chilometri misura esattamente una maratona?", a: ["42,195", "40", "45,5", "41,300"], c: 0, f: "La distanza nasce dalle Olimpiadi di Londra 1908, allungata per arrivare sotto il palco reale." },
    { d: 3, q: "Chi è stato l’ultimo italiano a vincere il Tour de France?", a: ["Marco Pantani", "Vincenzo Nibali", "Ivan Basso", "Gilberto Simoni"], c: 0, f: "1998, con doppietta Giro-Tour. Nibali ha vinto il Tour nel 2014... da italiano successivo, ma Pantani resta il riferimento del secolo scorso." },
    { d: 3, q: "In quale anno Roma ha ospitato le Olimpiadi estive?", a: ["1960", "1948", "1972", "1936"], c: 0, f: "La maratona fu vinta a piedi nudi da Abebe Bikila, sull’Appia Antica." },
    { d: 3, q: "Quanti set servono per vincere un match maschile in uno Slam?", a: ["3 su 5", "2 su 3", "4 su 7", "3 su 4"], c: 0, f: "Solo nei quattro Slam. Nel resto del circuito si gioca al meglio dei tre." },
    { d: 3, q: "Quante volte l’Italia aveva vinto la Coppa Davis prima del 2023?", a: ["Una", "Tre", "Nessuna", "Cinque"], c: 0, f: "Solo nel 1976, in Cile, in un’edizione politicamente rovente." },
    { d: 3, q: "In che anno si è corso il primo mondiale di Formula 1?", a: ["1950", "1946", "1958", "1962"], c: 0, f: "Prima gara a Silverstone, vinta da Giuseppe Farina su Alfa Romeo." },
    { d: 3, q: "Chi vinse il primo Tour de France, nel 1903?", a: ["Maurice Garin", "Ottavio Bottecchia", "Henri Desgrange", "Lucien Petit-Breton"], c: 0, f: "Sei tappe lunghissime, spesso corse di notte." },
    { d: 3, q: "Quanti Roland Garros ha vinto Rafael Nadal?", a: ["14", "9", "11", "17"], c: 0, f: "Un dominio senza paragoni nella storia dello sport." },
    { d: 2, q: "Quanti giocatori di movimento (portiere escluso) schiera in campo una squadra di calcio?", a: ["10", "9", "11", "8"], c: 0, f: "Undici in totale con il portiere: la regola è fissa dal 1897." },
    { d: 2, q: "In quale sport si segna un «touchdown»?", a: ["Football americano", "Rugby", "Baseball", "Hockey su ghiaccio"], c: 0, f: "Vale 6 punti, più il tentativo di trasformazione dopo." },
    { d: 2, q: "Quanti cerchi ha la bandiera olimpica?", a: ["5", "4", "6", "7"], c: 0, f: "Uno per continente, intrecciati apposta per rappresentare l'unione." },
    { d: 2, q: "Qual è lo sport nazionale del Giappone?", a: ["Sumo", "Judo", "Baseball", "Karate"], c: 0, f: "Le sue origini religiose risalgono a oltre 1500 anni fa, legate ai riti shintoisti." },
    { d: 2, q: "Quanti minuti dura, escluso recupero, un tempo regolamentare di calcio?", a: ["45", "40", "50", "30"], c: 0, f: "Novanta minuti totali dal 1866: prima ogni partita si accordava a parte." },
    { d: 2, q: "Quanti round dura tipicamente un match di boxe per un titolo mondiale?", a: ["12", "10", "15", "8"], c: 0, f: "Fino al 1982 erano 15: si ridussero a 12 dopo un incontro finito tragicamente male." },
    { d: 3, q: "In che anno e città si tennero le prime Olimpiadi moderne?", a: ["1896, Atene", "1900, Parigi", "1904, St. Louis", "1908, Londra"], c: 0, f: "241 atleti, tutti uomini, da 14 nazioni. Le donne arrivarono solo nel 1900." },
    { d: 3, q: "Chi vinse il primo Pallone d'Oro della storia, nel 1956?", a: ["Stanley Matthews", "Alfredo Di Stéfano", "Lev Yashin", "Bobby Charlton"], c: 0, f: "Inglese, aveva 41 anni. Ancora oggi resta il vincitore più anziano di sempre." },
  ],
  trash: [
    { d: 2, q: "Chi conduce «Uomini e Donne»?", a: ["Maria De Filippi", "Barbara d'Urso", "Ilary Blasi", "Michelle Hunziker"], c: 0, f: "In onda dal 1996. Praticamente un'istituzione antropologica." },
    { d: 2, q: "In «Temptation Island», come si chiama il pergolato dove si guardano i video?", a: ["Il pinnettu", "Il bunker", "La capanna", "Il falò"], c: 0, f: "«Pinnettu» è il nome di una capanna tipica sarda. Cultura, baby." },
    { d: 2, q: "In che anno è andata in onda la prima edizione italiana del Grande Fratello?", a: ["2000", "1997", "2003", "2005"], c: 0, f: "Settembre 2000. Il format nasce in Olanda da un'idea di John de Mol." },
    { d: 2, q: "Chi condusse le prime edizioni del Grande Fratello italiano?", a: ["Daria Bignardi", "Alessia Marcuzzi", "Simona Ventura", "Alfonso Signorini"], c: 0, f: "Una giornalista seria che presentava un reality: il vero salto quantico della TV italiana." },
    { d: 2, q: "Ad «Amici» le due squadre storiche sono di che colore?", a: ["Bianca e blu", "Rossa e nera", "Verde e oro", "Gialla e viola"], c: 0, f: "Il talent va in onda dal 2001, prima col titolo «Saranno famosi»." },
    { d: 2, q: "Chi conduce «Ciao Darwin»?", a: ["Paolo Bonolis", "Gerry Scotti", "Amadeus", "Carlo Conti"], c: 0, f: "Con Luca Laurenti. Il titolo cita Darwin perché il format gioca sulla «selezione»." },
    { d: 2, q: "In quale città si trova il teatro Ariston, casa di Sanremo?", a: ["Sanremo", "Milano", "Napoli", "Torino"], c: 0, f: "Il Festival esiste dal 1951: all'inizio si faceva al Casinò." },
    { d: 2, q: "Chi ha vinto il Festival di Sanremo 2024?", a: ["Angelina Mango", "Geolier", "Annalisa", "Mahmood"], c: 0, f: "Con «La noia». È la figlia del cantautore Pino Mango." },
    { d: 2, q: "Chi ha condotto per anni il Grande Fratello VIP?", a: ["Alfonso Signorini", "Paolo Bonolis", "Enrico Papi", "Teo Mammucari"], c: 0, f: "Prima di tutto è direttore di un settimanale di gossip. Coerenza totale." },
    { d: 2, q: "Come si chiama la sezione di «Uomini e Donne» dedicata ai non giovanissimi?", a: ["Trono over", "Trono senior", "Trono d'oro", "Trono libero"], c: 0, f: "L'altra è il «trono classico». Sì, esiste una tassonomia." },
    { d: 2, q: "In «MasterChef Italia» quale grembiule si conquista per entrare in gara?", a: ["Bianco", "Nero", "Rosso", "Blu"], c: 0, f: "Il format è nato in Regno Unito nel 1990." },
    { d: 2, q: "Nella prima edizione de «Il Collegio», in che anno erano catapultati i ragazzi?", a: ["1960", "1982", "1971", "1954"], c: 0, f: "Niente smartphone per settimane: il vero horror generazionale." },
    { d: 2, q: "Quale reality spedisce i vip su un'isola a patire la fame?", a: ["L'Isola dei Famosi", "Pechino Express", "La Talpa", "Boss in incognito"], c: 0, f: "Format di origine scandinava, poi esploso in mezzo mondo." },
    { d: 2, q: "Chi ha inventato il format del Grande Fratello?", a: ["John de Mol", "Simon Cowell", "Mark Burnett", "Endemol Rossi"], c: 0, f: "Olandese. Il nome viene dal «Grande Fratello» di Orwell in 1984." },
    { d: 2, q: "Chi conduce «C'è posta per te»?", a: ["Maria De Filippi", "Silvia Toffanin", "Mara Venier", "Caterina Balivo"], c: 0, f: "La busta che si chiude è patrimonio immateriale dell'umanità." },
    { d: 2, q: "«Non è la Rai» è il programma cult di quale decennio?", a: ["Anni '90", "Anni '70", "Anni 2000", "Anni 2010"], c: 0, f: "1991-1995. Ideato da Gianni Boncompagni." },
    { d: 2, q: "TikTok è di proprietà di quale azienda?", a: ["ByteDance", "Tencent", "Alibaba", "Meta"], c: 0, f: "In Cina esiste una versione gemella, Douyin, con contenuti diversi." },
    { d: 2, q: "Cosa vuol dire «shippare» due persone?", a: ["Tifare perché stiano insieme", "Bloccarle sui social", "Presentarle a un amico", "Copiarne lo stile"], c: 0, f: "Da «relationship». Prima esisteva solo nelle fan fiction, ora si fa coi coinquilini." },
    { d: 2, q: "«Bella ciao» è tornata virale nel mondo grazie a quale serie?", a: ["La casa di carta", "Narcos", "Gomorra", "Élite"], c: 0, f: "Nella serie è il canto dei rapinatori: resistenza e colpo grosso insieme." },
    { d: 3, q: "Chi ha vinto la primissima edizione del Grande Fratello italiano?", a: ["Cristina Plevani", "Pietro Taricone", "Marina La Rosa", "Salvo Veneziano"], c: 0, f: "2000. Bagnina bresciana, vinse 250 milioni di lire." },
    { d: 3, q: "Chi ha condotto la prima edizione italiana de «L’Isola dei Famosi»?", a: ["Simona Ventura", "Alessia Marcuzzi", "Ilary Blasi", "Vladimir Luxuria"], c: 0, f: "2003, su Rai 2. All’epoca era il reality più visto d’Italia." },
    { d: 3, q: "In che anno Amadeus ha condotto il suo primo Sanremo?", a: ["2020", "2018", "2022", "2016"], c: 0, f: "Poi altre quattro edizioni di fila. Un piccolo regno." },
    { d: 3, q: "Chi ha vinto la prima edizione di MasterChef Italia?", a: ["Spyros Theodoridis", "Federico Ferrero", "Stefano Callegaro", "Erica Liverani"], c: 0, f: "Stagione 2011-12, la prima in assoluto in Italia." },
    { d: 3, q: "In quale paese e anno nasce il format del Grande Fratello?", a: ["Paesi Bassi, 1999", "Regno Unito, 1997", "Stati Uniti, 2000", "Germania, 1998"], c: 0, f: "Prima edizione olandese. L’Italia arrivò un anno dopo." },
    { d: 3, q: "Come si chiamava «Amici» alla sua nascita, nel 2001?", a: ["Saranno famosi", "Star Academy", "Talenti", "Scuola di stelle"], c: 0, f: "Il titolo citava il film e la serie americana degli anni ’80." },
    { d: 3, q: "Chi ha vinto la prima edizione del Grande Fratello VIP italiano?", a: ["Alessia Macari", "Cristina Plevani", "Daniele Bossari", "Walter Nudo"], c: 0, f: "Edizione 2016-17, la prima con Signorini ancora opinionista." },
    { d: 3, q: "In che anno è nato il Festivalbar?", a: ["1964", "1972", "1958", "1980"], c: 0, f: "Si votava con i tappi delle bibite nei jukebox: marketing puro." },
    { d: 3, q: "Chi ha condotto la prima edizione italiana di «X Factor»?", a: ["Francesco Facchinetti", "Alessandro Cattelan", "Enrico Papi", "Simona Ventura"], c: 0, f: "2008, su Rai 2. Cattelan arrivò nel 2011." },
    { d: 3, q: "Su quale rete andava in onda «Drive In»?", a: ["Italia 1", "Rai 2", "Canale 5", "Rete 4"], c: 0, f: "1983-1988: da lì è uscita mezza comicità televisiva italiana." },
    { d: 2, q: "In quali studi si trova storicamente la casa del Grande Fratello italiano?", a: ["Cinecittà, Roma", "Milano", "Torino", "Napoli"], c: 0, f: "Gli stessi studi dove si giravano i kolossal del cinema italiano del dopoguerra." },
    { d: 2, q: "Nel linguaggio dei social, «influencer» indica chi...", a: ["Condiziona il pubblico con i propri contenuti", "Modera i commenti", "Gestisce la pubblicità di un sito", "Crea meme virali"], c: 0, f: "È entrata nei principali vocabolari italiani solo a metà anni 2010." },
    { d: 2, q: "Nel linguaggio social, «cringe» descrive...", a: ["Un imbarazzo che si prova per altri", "Un contenuto molto divertente", "Un video virale", "Una lite tra follower"], c: 0, f: "Dall'inglese «rabbrividire». È diventato aggettivo prima ancora di essere tradotto." },
    { d: 2, q: "In una serie TV, un «cliffhanger» è...", a: ["Un finale in sospeso che lascia col fiato sospeso", "Un colpo di scena a metà puntata", "Un personaggio che scompare", "Un flashback improvviso"], c: 0, f: "Il nome viene letteralmente da eroi appesi a una scogliera nei serial d'inizio '900." },
    { d: 3, q: "In che anno debutta MTV in Italia?", a: ["1997", "1991", "2001", "1985"], c: 0, f: "Prima c'era soprattutto Videomusic a occupare il panorama musicale in tv." },
    { d: 3, q: "Il termine «catfishing» prende il nome da...", a: ["Un documentario del 2010", "Una serie animata", "Un tormentone di MTV", "Un romanzo distopico"], c: 0, f: "«Catfish», di Nev Schulman. Diventò poi anche un reality show." },
    { d: 3, q: "In quale paese nasce il format originale di «The Voice»?", a: ["Paesi Bassi", "Stati Uniti", "Regno Unito", "Svezia"], c: 0, f: "Ideato dallo stesso John de Mol del Grande Fratello. Un signore con un certo fiuto." },
    { d: 3, q: "Il format originale di «Temptation Island» nasce in quale paese?", a: ["Stati Uniti", "Italia", "Argentina", "Australia"], c: 0, f: "Prodotto dalla Fox nel 2001. In Italia arrivò solo nel 2014." },
  ],
  cultura: [
    { d: 2, q: "Chi ha dipinto «La nascita di Venere»?", a: ["Botticelli", "Caravaggio", "Raffaello", "Tiziano"], c: 0, f: "Circa 1485, agli Uffizi di Firenze." },
    { d: 2, q: "In che anno scoppia la Rivoluzione francese?", a: ["1789", "1848", "1776", "1815"], c: 0, f: "Presa della Bastiglia: 14 luglio 1789." },
    { d: 2, q: "In quante cantiche è divisa la Divina Commedia?", a: ["Tre", "Due", "Cinque", "Sette"], c: 0, f: "Inferno, Purgatorio, Paradiso: 100 canti in tutto." },
    { d: 2, q: "Qual è il simbolo chimico dell'oro?", a: ["Au", "Ag", "Or", "Go"], c: 0, f: "Dal latino «aurum». Ag invece è l'argento." },
    { d: 2, q: "Qual è il pianeta più vicino al Sole?", a: ["Mercurio", "Venere", "Marte", "Terra"], c: 0, f: "Ma il più caldo è Venere, per via dell'effetto serra." },
    { d: 2, q: "Dove si trova «L'Ultima Cena» di Leonardo?", a: ["Milano", "Firenze", "Roma", "Venezia"], c: 0, f: "Santa Maria delle Grazie. Dipinta a secco: per questo si è rovinata subito." },
    { d: 2, q: "Chi ha scritto «1984»?", a: ["George Orwell", "Aldous Huxley", "Ray Bradbury", "Philip K. Dick"], c: 0, f: "Pubblicato nel 1949. Da lì arriva anche il nome del reality." },
    { d: 2, q: "Qual è il fiume più lungo d'Italia?", a: ["Po", "Adige", "Tevere", "Arno"], c: 0, f: "652 km, dal Monviso all'Adriatico." },
    { d: 2, q: "Chi ha composto «Le quattro stagioni»?", a: ["Vivaldi", "Bach", "Mozart", "Verdi"], c: 0, f: "Pubblicate nel 1725. Il prete rosso di Venezia." },
    { d: 2, q: "Quale filosofo è legato alla frase «so di non sapere»?", a: ["Socrate", "Platone", "Aristotele", "Cartesio"], c: 0, f: "Non scrisse mai nulla: lo conosciamo grazie a Platone." },
    { d: 2, q: "In che anno cade il Muro di Berlino?", a: ["1989", "1991", "1985", "1979"], c: 0, f: "9 novembre. Anche per colpa di un annuncio dato male in conferenza stampa." },
    { d: 2, q: "Qual è la capitale dell'Australia?", a: ["Canberra", "Sydney", "Melbourne", "Perth"], c: 0, f: "Costruita da zero come compromesso tra Sydney e Melbourne che litigavano." },
    { d: 2, q: "Che forma ha la molecola del DNA?", a: ["Doppia elica", "Sfera", "Cubo", "Spirale piatta"], c: 0, f: "Watson, Crick e i dati cruciali di Rosalind Franklin, 1953." },
    { d: 2, q: "Chi ha scritto «Il nome della rosa»?", a: ["Umberto Eco", "Italo Calvino", "Primo Levi", "Dino Buzzati"], c: 0, f: "1980. Un giallo medievale pieno di semiotica che ha venduto milioni di copie." },
    { d: 2, q: "Dove è esposta la Gioconda?", a: ["Louvre, Parigi", "Uffizi, Firenze", "Prado, Madrid", "British Museum"], c: 0, f: "Nel 1911 fu rubata da un italiano che voleva «riportarla a casa»." },
    { d: 2, q: "In quale città nasce il Rinascimento?", a: ["Firenze", "Roma", "Venezia", "Napoli"], c: 0, f: "Con i soldi dei Medici, che erano banchieri prima che mecenati." },
    { d: 2, q: "Chi è stato il primo uomo a camminare sulla Luna?", a: ["Neil Armstrong", "Buzz Aldrin", "Yuri Gagarin", "Michael Collins"], c: 0, f: "20 luglio 1969. E sì: Buzz Aldrin era il secondo. Buzz, capito?" },
    { d: 2, q: "Chi ha scritto «Il Gattopardo»?", a: ["Tomasi di Lampedusa", "Verga", "Pirandello", "Sciascia"], c: 0, f: "Pubblicato postumo nel 1958, dopo essere stato rifiutato dagli editori." },
    { d: 2, q: "Quante ossa ha in media lo scheletro di un adulto?", a: ["206", "150", "312", "98"], c: 0, f: "Da neonati sono oltre 270: molte poi si fondono." },
    { d: 2, q: "Frida Kahlo era...", a: ["Pittrice messicana", "Attrice argentina", "Scultrice spagnola", "Fotografa cubana"], c: 0, f: "Un terzo della sua opera sono autoritratti: «dipingo me stessa perché sono sola»." },
    { d: 3, q: "In che anno è stata firmata la Magna Carta?", a: ["1215", "1066", "1348", "1492"], c: 0, f: "Re Giovanni d’Inghilterra la firmò sotto la minaccia dei baroni. Base di molte costituzioni moderne." },
    { d: 3, q: "Qual è l’elemento più abbondante nell’universo?", a: ["Idrogeno", "Ossigeno", "Carbonio", "Ferro"], c: 0, f: "Circa il 75% della materia ordinaria. Il secondo è l’elio." },
    { d: 3, q: "Quale italiano ha vinto il Nobel per la Letteratura nel 1997?", a: ["Dario Fo", "Eugenio Montale", "Salvatore Quasimodo", "Grazia Deledda"], c: 0, f: "Attore e drammaturgo. La motivazione citava i giullari medievali." },
    { d: 3, q: "In quanti libri è divisa l’Eneide?", a: ["12", "24", "10", "16"], c: 0, f: "Virgilio morì prima di rifinirla e chiese che venisse bruciata. Augusto disse di no." },
    { d: 3, q: "Chi ha scoperto la penicillina?", a: ["Alexander Fleming", "Louis Pasteur", "Robert Koch", "Jonas Salk"], c: 0, f: "1928, per distrazione: una muffa contaminò una piastra dimenticata." },
    { d: 3, q: "In che anno cade l’Impero romano d’Occidente?", a: ["476 d.C.", "410 d.C.", "395 d.C.", "527 d.C."], c: 0, f: "Deposizione di Romolo Augustolo. Data di comodo: il crollo fu lentissimo." },
    { d: 3, q: "Chi ha formulato il principio di indeterminazione?", a: ["Heisenberg", "Schrödinger", "Bohr", "Planck"], c: 0, f: "1927. Non puoi conoscere con precisione posizione e quantità di moto insieme." },
    { d: 3, q: "Qual è la capitale del Kazakistan?", a: ["Astana", "Almaty", "Bishkek", "Tashkent"], c: 0, f: "Si è chiamata Nur-Sultan dal 2019 al 2022, poi è tornata Astana." },
    { d: 3, q: "Chi ha scritto «La coscienza di Zeno»?", a: ["Italo Svevo", "Luigi Pirandello", "Giovanni Verga", "Cesare Pavese"], c: 0, f: "1923. Fu Joyce, suo insegnante di inglese a Trieste, a spingerlo a pubblicare." },
    { d: 3, q: "Quale città fu la prima capitale del Regno d’Italia?", a: ["Torino", "Firenze", "Roma", "Milano"], c: 0, f: "Dal 1861 al 1865, poi Firenze e infine Roma nel 1871." },
    { d: 3, q: "In che anno fu pubblicata «L’origine delle specie»?", a: ["1859", "1871", "1832", "1905"], c: 0, f: "La prima tiratura andò esaurita in un giorno." },
    { d: 3, q: "Quanti elementi contiene oggi la tavola periodica?", a: ["118", "103", "92", "127"], c: 0, f: "L’ultimo riconosciuto è l’oganesson, nel 2016." },
    { d: 2, q: "Chi ha scritto «Cent'anni di solitudine»?", a: ["Gabriel García Márquez", "Mario Vargas Llosa", "Jorge Luis Borges", "Pablo Neruda"], c: 0, f: "1967. Gli valse il Nobel nel 1982, «per i suoi romanzi in cui il fantastico e il realistico si fondono»." },
    { d: 2, q: "In quale oceano si trova la Fossa delle Marianne, il punto più profondo della Terra?", a: ["Oceano Pacifico", "Oceano Atlantico", "Oceano Indiano", "Oceano Artico"], c: 0, f: "Quasi 11.000 metri di profondità: l'Everest ci starebbe dentro con margine." },
    { d: 2, q: "Chi ha dipinto «Guernica»?", a: ["Pablo Picasso", "Salvador Dalí", "Joan Miró", "Diego Rivera"], c: 0, f: "1937, contro il bombardamento nazifascista dell'omonima città basca." },
    { d: 2, q: "Qual è la lingua con più parlanti madrelingua al mondo?", a: ["Cinese mandarino", "Inglese", "Spagnolo", "Hindi"], c: 0, f: "Oltre 900 milioni di madrelingua. L'inglese vince solo contando i parlanti come seconda lingua." },
    { d: 2, q: "Chi ha teorizzato la relatività generale?", a: ["Albert Einstein", "Isaac Newton", "Niels Bohr", "Max Planck"], c: 0, f: "1915. Confermata sperimentalmente solo nel 1919, durante un'eclissi di sole." },
    { d: 2, q: "Chi ha scritto «Il Principe»?", a: ["Niccolò Machiavelli", "Dante Alighieri", "Francesco Guicciardini", "Baldassarre Castiglione"], c: 0, f: "1513. Scritto in esilio dalla politica fiorentina, sperando di rientrarci." },
    { d: 3, q: "Qual è la capitale del Canada?", a: ["Ottawa", "Toronto", "Montreal", "Vancouver"], c: 0, f: "Scelta nel 1857 come compromesso tra Quebec e Ontario. Toronto resta la città più popolosa, non la capitale." },
    { d: 3, q: "Quale scienziata ha vinto il Premio Nobel in due discipline scientifiche diverse?", a: ["Marie Curie", "Rosalind Franklin", "Lise Meitner", "Dorothy Hodgkin"], c: 0, f: "Fisica nel 1903, Chimica nel 1911. Resta l'unica persona ad aver vinto Nobel scientifici in due campi diversi." },
  ],
  piccante: [
    { d: 2, s: 1, q: "Il Kamasutra è un testo originario di quale paese?", a: ["India", "Giappone", "Grecia", "Egitto"], c: 0, f: "Scritto in sanscrito. E per due terzi parla di corteggiamento e vita sociale." },
    { d: 2, s: 1, q: "Chi ha scritto «Cinquanta sfumature di grigio»?", a: ["E. L. James", "Stephenie Meyer", "Anaïs Nin", "Erica Jong"], c: 0, f: "Nato come fan fiction di Twilight. La letteratura fa strade misteriose." },
    { d: 2, s: 1, q: "Quale ormone è soprannominato «ormone delle coccole»?", a: ["Ossitocina", "Adrenalina", "Insulina", "Cortisolo"], c: 0, f: "Si libera con abbracci, baci e allattamento. Anche accarezzando il cane." },
    { d: 2, s: 1, q: "La filofobia è la paura di...", a: ["Innamorarsi", "Parlare in pubblico", "Essere toccati", "Restare soli"], c: 0, f: "Dal greco «philos», amore. Metà dei tuoi ex, spiegati." },
    { d: 2, s: 1, q: "Afrodite è la dea greca di...", a: ["Amore e bellezza", "Guerra", "Caccia", "Saggezza"], c: 0, f: "Da lei viene la parola «afrodisiaco»." },
    { d: 2, s: 1, q: "Qual è il corrispettivo romano di Afrodite?", a: ["Venere", "Giunone", "Minerva", "Diana"], c: 0, f: "Botticelli le ha dedicato il quadro più corteggiato di Firenze." },
    { d: 2, s: 1, q: "Casanova, il seduttore più famoso della storia, era di quale città?", a: ["Venezia", "Roma", "Napoli", "Palermo"], c: 0, f: "Giacomo Casanova, 1725. Fu anche bibliotecario: finì i suoi giorni tra i libri." },
    { d: 2, s: 1, q: "Quale cibo Casanova considerava il suo afrodisiaco preferito?", a: ["Le ostriche", "Il tartufo", "Il cioccolato", "Il peperoncino"], c: 0, f: "Ricche di zinco, in effetti. Il resto era marketing personale." },
    { d: 2, s: 1, q: "Da quale scrittore prende il nome il «sadismo»?", a: ["Marchese de Sade", "Lord Byron", "Baudelaire", "D'Annunzio"], c: 0, f: "E il masochismo dall'austriaco Leopold von Sacher-Masoch." },
    { d: 2, s: 1, q: "Chi ha reso celebre il termine «libido»?", a: ["Freud", "Jung", "Nietzsche", "Pavlov"], c: 0, f: "Jung poi la ridefinì come energia psichica generale. Litigarono anche per quello." },
    { d: 2, s: 1, q: "Il «punto G» prende il nome da...", a: ["Un ginecologo tedesco", "Una dea greca", "Un film francese", "Una canzone"], c: 0, f: "Ernst Gräfenberg. Un cognome, un destino." },
    { d: 2, s: 1, q: "«9 settimane e ½» è un film cult di quale decennio?", a: ["Anni '80", "Anni '60", "Anni 2000", "Anni '90"], c: 0, f: "1986, con Kim Basinger e Mickey Rourke. La scena del frigorifero: sai quale." },
    { d: 2, s: 1, q: "Nel gergo social, cosa vuol dire «ghosting»?", a: ["Sparire senza spiegazioni", "Fingersi single", "Corteggiare due persone", "Controllare i profili altrui"], c: 0, f: "Cugino stretto del «breadcrumbing»: briciole d'attenzione per tenerti lì." },
    { d: 2, s: 1, q: "Cos'è una «situationship»?", a: ["Una relazione mai definita", "Una coppia aperta", "Un ex che torna", "Un amico di famiglia"], c: 0, f: "Il limbo dantesco, ma con i messaggi visualizzati alle 2 di notte." },
    { d: 2, s: 1, q: "Barry White, re delle serate romantiche, è famoso per una voce...", a: ["Bassissima", "Acutissima", "Nasale", "Roca da rock"], c: 0, f: "Basso profondo. Ha venduto oltre 100 milioni di dischi con quel timbro." },
    { d: 2, s: 1, q: "Quale isola greca è la cartolina più abusata dei tramonti romantici?", a: ["Santorini", "Creta", "Rodi", "Corfù"], c: 0, f: "Le case bianche e blu nascono su una caldera vulcanica. Romanticismo geologico." },
    { d: 2, s: 1, q: "Il profumo «Opium», scandalo pubblicitario del 1977, è della maison...", a: ["Yves Saint Laurent", "Chanel", "Dior", "Gucci"], c: 0, f: "Le campagne furono censurate in mezzo mondo. Vendette comunque tantissimo." },
    { d: 2, s: 1, q: "In «Il Gattopardo» la celebre scena del ballo mette in scena soprattutto...", a: ["La tensione tra Angelica e Tancredi", "Un duello", "Un funerale", "Uno sbarco"], c: 0, f: "Visconti ci mise mesi a girarla. Sensualità in guanti bianchi: il massimo livello." },
    { d: 3, s: 1, q: "A quale periodo risale il Kamasutra?", a: ["III-V secolo d.C.", "XII secolo", "I secolo a.C.", "VIII secolo"], c: 0, f: "Attribuito a Vatsyayana. In Europa arrivò solo nell’Ottocento, con una traduzione semiclandestina." },
    { d: 3, s: 1, q: "Chi ha scritto «L’amante di Lady Chatterley»?", a: ["D. H. Lawrence", "Henry Miller", "Vladimir Nabokov", "Alberto Moravia"], c: 0, f: "1928. In Gran Bretagna fu processato per oscenità: assolto solo nel 1960." },
    { d: 3, s: 1, q: "«Delta di Venere» è un’opera di...", a: ["Anaïs Nin", "Marguerite Duras", "Colette", "Erica Jong"], c: 0, f: "Scritti negli anni ’40 per un collezionista che pagava un dollaro a pagina." },
    { d: 3, s: 1, q: "Chi era Messalina?", a: ["Moglie dell’imperatore Claudio", "Una sacerdotessa greca", "Una regina egizia", "Una poetessa romana"], c: 0, f: "La sua fama scandalosa arriva quasi tutta da fonti ostili. La storiografia moderna ci va cauta." },
    { d: 3, s: 1, q: "Chi ha diretto «Ultimo tango a Parigi»?", a: ["Bernardo Bertolucci", "Federico Fellini", "Michelangelo Antonioni", "Pier Paolo Pasolini"], c: 0, f: "1972. In Italia le copie furono ordinate al rogo da un tribunale." },
    { d: 3, s: 1, q: "Quante novelle contiene il Decameron?", a: ["100", "50", "120", "75"], c: 0, f: "Dieci giornate per dieci narratori. Molte sono decisamente spinte." },
    { d: 3, s: 1, q: "La «Venere di Willendorf» risale a quale periodo?", a: ["Paleolitico", "Neolitico", "Età del bronzo", "Epoca romana"], c: 0, f: "Circa 25.000 anni fa, undici centimetri di calcare. La prima icona del corpo femminile." },
    { d: 3, s: 1, q: "Chi ha scritto «Lolita»?", a: ["Vladimir Nabokov", "Henry Miller", "D. H. Lawrence", "Philip Roth"], c: 0, f: "1955: rifiutato da quattro editori americani, uscì prima a Parigi." },
    { d: 3, s: 1, q: "«Tropico del Cancro» è un’opera di...", a: ["Henry Miller", "Charles Bukowski", "Jack Kerouac", "William Burroughs"], c: 0, f: "1934: negli Stati Uniti fu vietato per quasi trent’anni." },
    { d: 3, s: 1, q: "In quale museo si trova il «Gabinetto Segreto» con i reperti erotici di Pompei?", a: ["Museo Archeologico di Napoli", "Musei Capitolini", "Uffizi", "Museo Egizio di Torino"], c: 0, f: "Per due secoli visitabile solo con permesso speciale." },
    { d: 3, s: 1, q: "Dove morì Giacomo Casanova?", a: ["In Boemia", "A Venezia", "A Parigi", "A Napoli"], c: 0, f: "Bibliotecario nel castello di Dux: finì i suoi giorni tra i libri e i ricordi." },
    { d: 2, s: 1, q: "Chi ha scolpito «Il bacio», la celebre scultura di due amanti abbracciati?", a: ["Auguste Rodin", "Antonio Canova", "Gian Lorenzo Bernini", "Michelangelo"], c: 0, f: "1889. Nacque come dettaglio di un'opera più grande, poi diventò celebre da sola." },
    { d: 2, s: 1, q: "Il film «Dirty Dancing» è ambientato in quale decennio?", a: ["Anni '60", "Anni '50", "Anni '70", "Anni '80"], c: 0, f: "Estate 1963, in un resort di villeggiatura. Il ballo finale resta il più imitato della storia del cinema." },
    { d: 2, s: 1, q: "Chi ha diretto il thriller erotico «Basic Instinct»?", a: ["Paul Verhoeven", "Adrian Lyne", "Brian De Palma", "David Fincher"], c: 0, f: "1992. La scena dell'interrogatorio fece discutere per anni, ben oltre la trama." },
    { d: 2, s: 1, q: "Da quale dea prende il nome la parola «afrodisiaco»?", a: ["Afrodite", "Era", "Artemide", "Demetra"], c: 0, f: "Tutto ciò che «risveglia» l'amore porta il suo nome da millenni." },
    { d: 3, s: 1, q: "Chi si nasconde dietro lo pseudonimo Pauline Réage, autrice di «Histoire d'O»?", a: ["Anne Desclos", "Simone de Beauvoir", "Marguerite Yourcenar", "Colette"], c: 0, f: "Rivelò la sua identità solo nel 1994, a quasi 40 anni dalla pubblicazione del libro." },
    { d: 3, s: 1, q: "I Lupercalia, riti di fertilità dell'antica Roma a metà febbraio, erano dedicati al dio...", a: ["Fauno", "Marte", "Bacco", "Vulcano"], c: 0, f: "Si dice siano all'origine, molto alla lontana, di San Valentino." },
    { d: 3, s: 1, q: "In quale secolo visse Saffo, la poetessa greca di Lesbo celebre per i suoi versi d'amore?", a: ["VII-VI secolo a.C.", "IV-III secolo a.C.", "I secolo d.C.", "X secolo a.C."], c: 0, f: "Di lei restano solo frammenti: un intero papiro con versi suoi è un evento archeologico." },
    { d: 3, s: 1, q: "L'«Ars Amatoria», manuale poetico di seduzione, è opera di quale autore latino?", a: ["Ovidio", "Virgilio", "Orazio", "Catullo"], c: 0, f: "Gli costò, insieme ad altri motivi mai del tutto chiariti, l'esilio voluto da Augusto." },
    { d: 2, s: 2, q: "Secondo diversi studi sessuologici, quanto dura in media un rapporto penetrativo etero, dai preliminari all'orgasmo?", a: ["Circa 5-7 minuti", "Circa 20 minuti", "Circa 45 secondi", "Circa un'ora"], c: 0, f: "La forbice reale è ampia (dai 3 ai 13 minuti nei vari studi), ma la percezione soggettiva è sempre più generosa dei cronometri." },
    { d: 3, s: 2, q: "Secondo gli studi, quale percentuale di donne raggiunge l'orgasmo con la sola penetrazione, senza stimolazione del clitoride?", a: ["Meno di un quarto", "Quasi tutte", "Circa la metà", "Circa i tre quarti"], c: 0, f: "La ricerca è chiara da decenni: il clitoride è il vero protagonista, non un optional." },
    { d: 2, s: 2, q: "Cosa indica l'acronimo BDSM?", a: ["Bondage, disciplina, dominazione/sottomissione, sadomaso", "Bisex, dating, single, monogamia", "Body, desiderio, sensualità, mistero", "Bacio, dolcezza, seduzione, magia"], c: 0, f: "Un ombrello che copre pratiche molto diverse tra loro, unite da una parola chiave: il consenso." },
    { d: 2, s: 2, q: "A cosa serve una \"safeword\" (parola di sicurezza) durante un gioco erotico?", a: ["A fermare tutto immediatamente se serve", "A scegliere la posizione successiva", "A indicare che si vuole ricominciare", "A chiamare il partner in modo affettuoso"], c: 0, f: "Di solito è una parola normalissima e fuori contesto, tipo «ananas»: impossibile confonderla con un gemito." },
    { d: 2, s: 2, q: "Cos'è il \"poliamore\"?", a: ["Avere più relazioni sentimentali consensuali insieme", "Innamorarsi una volta sola nella vita", "Amare più il partner che sé stessi", "Un termine per l'amore a distanza"], c: 0, f: "La parola chiave, di nuovo, è consenso: tutte le persone coinvolte sanno e sono d'accordo." },
    { d: 2, s: 2, q: "In epoca vittoriana, per curare la cosiddetta \"isteria femminile\" i medici usavano uno strumento che oggi conosciamo come...", a: ["Il vibratore", "Il termometro", "Lo stetoscopio", "Il ventaglio"], c: 0, f: "Inizialmente era un dispositivo medico. La sua vera vocazione arrivò dopo, e con più successo." },
    { d: 3, s: 2, q: "Il \"punto P\", equivalente maschile del punto G, corrisponde a quale organo?", a: ["La prostata", "I testicoli", "Il perineo esterno", "L'uretra"], c: 0, f: "Raggiungibile solo per via interna: motivo per cui se ne parla meno, ma esiste eccome." },
    { d: 3, s: 2, q: "Cosa significa la pratica chiamata \"edging\"?", a: ["Avvicinarsi all'orgasmo e fermarsi più volte prima di raggiungerlo", "Fare sesso sul bordo del letto", "Praticare sesso in un luogo rischioso", "Alternare partner diversi in una serata"], c: 0, f: "Una tecnica tanto amata quanto crudele, a seconda di chi la subisce." },
    { d: 2, s: 2, q: "Quale tipo di lubrificante NON va mai abbinato a un preservativo in lattice?", a: ["A base oleosa (olio, vaselina)", "A base acquosa", "A base di silicone", "Nessuno, vanno bene tutti"], c: 0, f: "L'olio indebolisce il lattice e può romperlo: con i preservativi, meglio acqua o silicone." },
    { d: 3, s: 2, q: "Come si chiama tecnicamente il preservativo pensato per essere indossato dalla partner con vagina?", a: ["Preservativo femminile (femidom)", "Diaframma", "Spirale", "Anello vaginale"], c: 0, f: "Si inserisce prima del rapporto e, a differenza di quello maschile, può restare in posizione per ore." },
    { d: 2, s: 2, q: "Cosa indica la sigla NSFW, usata spesso online per i contenuti piccanti?", a: ["Not Safe For Work", "No Sex For Women", "New Style For Women", "Never Stop For Wonders"], c: 0, f: "Il campanello d'allarme universale prima di aprire un link al lavoro." },
    { d: 2, s: 2, q: "Cosa indica il termine \"feticismo\" in ambito sessuale?", a: ["Un'attrazione forte legata a un oggetto o parte del corpo specifica", "La paura del contatto fisico", "Un rituale scaramantico prima del sesso", "Il rifiuto della monogamia"], c: 0, f: "Dai piedi al pizzo, dal cuoio alle divise: la lista è lunga quanto la fantasia umana." },
    { d: 2, s: 2, q: "Secondo diversi sondaggi, quante calorie si bruciano mediamente durante un rapporto sessuale di circa 25 minuti?", a: ["Circa 100, come una camminata veloce", "Circa 800, come una maratona", "Circa 10, quasi nulla", "Circa 1500, come tre ore di palestra"], c: 0, f: "Meno di quanto promettono i titoli acchiappaclic, ma sempre meglio di stare fermi sul divano." },
    { d: 2, s: 2, q: "Cos'è un \"friend with benefits\"?", a: ["Un amico con cui si ha anche un rapporto sessuale senza impegno", "Un collega che offre sconti aziendali", "Un partner che paga sempre le cene", "Un amico d'infanzia ritrovato"], c: 0, f: "L'equilibrio più difficile da mantenere di tutta la vita sentimentale: chiedete a chi ci ha provato." },
    { d: 2, s: 2, q: "Cosa indica il termine \"catfishing\", spesso citato nel dating online?", a: ["Fingersi un'altra persona online per sedurre qualcuno", "Rifiutare tutti i match su un'app", "Fare più appuntamenti nello stesso giorno", "Bloccare un ex dopo la rottura"], c: 0, f: "Nome nato da un documentario del 2010, oggi di uso comunissimo su ogni app di incontri." },
    { d: 2, s: 2, q: "Nel gergo del dating, cosa significa \"talking stage\"?", a: ["La fase in cui ci si scrive senza essere ancora una coppia", "Il primo litigio di coppia", "Una terapia di coppia", "Un discorso di rottura preparato"], c: 0, f: "Può durare settimane o anni: la zona grigia più chiacchierata delle chat moderne." },
    { d: 2, s: 2, q: "Cosa indica l'espressione \"vanilla\", usata per descrivere una vita sessuale?", a: ["Convenzionale, senza pratiche particolari", "Molto sperimentale", "Priva di desiderio", "Legata solo a una persona per sempre"], c: 0, f: "Presa in prestito dal gelato più semplice del menù: nulla di male, è solo un gusto tra tanti." },
    { d: 3, s: 2, q: "Cosa indica il \"consenso entusiasta\" (enthusiastic consent), un concetto centrale nell'educazione sessuale moderna?", a: ["Un sì chiaro, libero ed entusiasta, non solo l'assenza di un no", "Un contratto scritto prima del rapporto", "Il consenso dato una volta per tutta la relazione", "Un'approvazione data da terzi"], c: 0, f: "L'idea guida è semplice: il silenzio non è un sì, e si può cambiare idea in ogni momento." },
    { d: 2, s: 3, q: "Come si chiama in gergo il sesso orale praticato a un uomo?", a: ["Pompino", "Marchetta", "Spagnola", "Ditalino"], c: 0, f: "Termine tecnico: fellatio. Ma tra amici, diciamocelo, nessuno usa quello." },
    { d: 2, s: 3, q: "Qual è il termine tecnico per il sesso orale praticato su una donna?", a: ["Cunnilingus", "Fellatio", "Anilingus", "Petting"], c: 0, f: "Dal latino cunnus + lingere. I romani, come al solito, avevano già una parola per tutto." },
    { d: 2, s: 3, q: "Come si dice in italiano la posizione sessuale nota internazionalmente come \"doggy style\"?", a: ["Alla pecorina", "Alla missionaria", "Ad amazzone", "A cucchiaio"], c: 0, f: "Nome zoologico un po' ovunque nel mondo: solo la specie di riferimento cambia da lingua a lingua." },
    { d: 2, s: 3, q: "Come si chiama la posizione in cui la partner sopra guida il rapporto?", a: ["Ad amazzone (o cowgirl)", "Alla pecorina", "Alla missionaria", "A cucchiaio"], c: 0, f: "Dal nome delle guerriere a cavallo dell'antichità: il controllo, letteralmente, cambia di mano." },
    { d: 3, s: 3, q: "Cosa indica il termine \"gola profonda\" (deep throat), reso celebre da un film del 1972?", a: ["Un sesso orale molto profondo", "Un bacio prolungato", "Un massaggio alla schiena", "Una posizione acrobatica"], c: 0, f: "Il film in questione fu tra i primi porno a uscire nei cinema mainstream americani, tra code e scandali." },
    { d: 2, s: 3, q: "Cosa indica l'acronimo MILF, entrato ormai nel linguaggio comune?", a: ["Una madre considerata sessualmente attraente", "Una influencer del fitness", "Una app di dating per genitori single", "Un tipo di lingerie"], c: 0, f: "Popolarizzato dal film «American Pie» del 1999, ma il concetto esisteva ovviamente molto prima." },
    { d: 2, s: 3, q: "Cosa indica il termine \"squirting\" in ambito sessuale?", a: ["L'emissione di liquido durante l'eccitazione o l'orgasmo femminile", "Un tipo di massaggio erotico", "L'uso di olio durante il sesso", "Una posizione acrobatica specifica"], c: 0, f: "Un fenomeno reale su cui la scienza ha discusso a lungo (e discute ancora) circa la sua esatta origine." },
    { d: 2, s: 3, q: "Cosa si intende con \"gangbang\" in gergo esplicito?", a: ["Un rapporto sessuale di gruppo con una sola persona al centro", "Un locale a luci rosse", "Una festa in maschera", "Un tipo di locale musicale underground"], c: 0, f: "Termine nato nel gergo americano già negli anni '20, oggi entrato stabilmente nel vocabolario esplicito internazionale." },
    { d: 3, s: 3, q: "Cosa indica il termine \"cuckold\", spesso abbreviato in \"cuck\"?", a: ["Chi trae eccitazione dal fatto che il partner sia con altri", "Chi è sempre fedelissimo", "Chi organizza feste a tema", "Un termine per i single cronici"], c: 0, f: "Dal francese antico «cucu», il cuculo che depone uova nei nidi altrui: l'etimologia è più vecchia di internet." },
    { d: 2, s: 3, q: "Come si chiama in gergo la pratica della masturbazione reciproca senza penetrazione?", a: ["Petting", "Cruising", "Spooning", "Ghosting"], c: 0, f: "Dall'inglese «to pet», accarezzare: molto più letterale di quanto sembri." },
    { d: 2, s: 3, q: "Cos'è un \"plug anale\"?", a: ["Un sex toy pensato per la stimolazione o dilatazione anale", "Un tipo di preservativo rinforzato", "Un accessorio per il bondage ai polsi", "Un lubrificante specifico"], c: 0, f: "La forma conica non è un caso: pensata apposta per restare in posizione in sicurezza." },
    { d: 2, s: 3, q: "Cosa significa l'espressione \"fare 69\"?", a: ["Praticare sesso orale reciproco e simultaneo", "Fare sesso nell'anno del proprio segno zodiacale", "Una posizione con le gambe incrociate", "Un rapporto della durata di 69 minuti"], c: 0, f: "Il nome viene proprio dalla forma che i due corpi disegnano, capovolti l'uno sull'altro." },
    { d: 3, s: 3, q: "Da cosa deriva il termine \"orgia\"?", a: ["Dal greco «orgia», riti misterici legati al culto di Dioniso", "Da un imperatore romano di nome Orgius", "Da una città greca chiamata Orgia", "Da una pianta afrodisiaca dell'antichità"], c: 0, f: "Il significato è cambiato nei millenni, il divertimento un po' meno." },
    { d: 2, s: 3, q: "Cosa indica il \"dirty talk\"?", a: ["Parlare in modo esplicito durante il sesso per eccitare il partner", "Litigare durante un rapporto", "Parlare di ex durante un appuntamento", "Un messaggio provocatorio via chat"], c: 0, f: "Per alcuni è la parte migliore, per altri la più imbarazzante: non esiste un gusto sbagliato." },
    { d: 2, s: 3, q: "Cosa indica in gergo il termine \"morning wood\"?", a: ["L'erezione mattutina spontanea", "Una posizione sessuale in piedi", "Un tipo di legno usato in bondage artigianale", "Un soprannome per un partner molto resistente"], c: 0, f: "Un riflesso fisiologico legato ai cicli del sonno, non necessariamente al sogno appena fatto." },
    { d: 2, s: 3, q: "Cos'è un \"succhiotto\"?", a: ["Un livido lasciato baciando e succhiando la pelle", "Un tipo di bacio leggero sulla guancia", "Un massaggio ai piedi", "Un soprannome affettuoso per il partner"], c: 0, f: "Tecnicamente è un piccolo ematoma da rottura di capillari. Romantico, in fondo, fino a un certo punto." },
    { d: 2, s: 3, q: "Cosa indica \"marchetta\", nel gergo colloquiale italiano riferito al sesso orale?", a: ["Un sinonimo informale di pompino", "Un tatuaggio piccolo e discreto", "Un regalo di scuse dopo un litigio", "Un soprannome per il primo appuntamento"], c: 0, f: "In altri contesti «marchetta» significa tutt'altro (una pubblicità occulta): l'italiano ama riciclare le parole." },
    { d: 3, s: 3, q: "Cosa indica il termine inglese \"aftercare\", molto usato nell'ambiente BDSM?", a: ["Le attenzioni e le coccole dopo un rapporto intenso", "La pulizia dei sex toy dopo l'uso", "Una visita medica di controllo", "Il tempo di attesa tra un rapporto e l'altro"], c: 0, f: "Rassicurare, coccolare, parlare: la parte meno fotografata ma più importante di tutte." },
  ],
};

const VOTI = [
  "Chi di voi finirebbe in un reality nel giro di un anno?",
  "Chi risponderebbe a un ex alle tre di notte?",
  "Chi conosce a memoria più canzoni di Sanremo?",
  "Chi sparirebbe da una chat senza dire niente?",
  "Chi si presenterebbe in ritardo al proprio matrimonio?",
  "Chi vincerebbe una gara di ballo improvvisata in cucina?",
  "Chi corregge gli altri sui congiuntivi?",
  "Chi ordinerebbe la stessa cosa in ogni ristorante del mondo?",
  "Chi litigherebbe con l'arbitro alla partitella del sabato?",
  "Chi ha il ripiano dei messaggi non letti più drammatico?",
  "Chi diventerebbe famoso su TikTok per sbaglio?",
  "Chi resterebbe sveglio fino all'alba a parlare di filosofia?",
  "Chi si perderebbe in una città con il navigatore acceso?",
  "Chi organizzerebbe la vacanza di gruppo con un foglio di calcolo?",
];

const PENITENZE = [
  "Manda un vocale di 10 secondi cantando a un contatto a caso della rubrica.",
  "Racconta il tuo peggior appuntamento. Hai 30 secondi, niente sconti.",
  "Fai un complimento sincero a ogni giocatore. Senza ridere.",
  "Mostra l'ultima foto della galleria. Sì, quella.",
  "Imita chi hai alla sinistra finché non indovina chi sei.",
  "Balla 15 secondi senza musica.",
  "Leggi ad alta voce l'ultimo messaggio che hai inviato.",
  "Parla con l'accento scelto dal gruppo fino alla prossima domanda.",
  "Dichiara il tuo crush famoso e difendilo per 20 secondi.",
  "Fai un discorso di ringraziamento da Sanremo. Con lacrima.",
  "Scegli un giocatore: da ora ti presenta prima di ogni risposta.",
  "Posa da statua greca per 10 secondi mentre gli altri ti giudicano.",
  "Fai la telecronaca dell'ultima domanda come se fosse un rigore al 90°.",
  "Racconta una bugia su di te: se il gruppo ci casca, riprendi 50 punti.",
];

/** «Ti conosco bene» (categoria Piccante): la casa risponde in segreto,
 *  gli altri indovinano. Nessuna risposta giusta, solo preferenze. */
const CONFRONTI = [
  { a: "Cena a lume di candela", b: "Avventura last minute" },
  { a: "Messaggio audace di notte", b: "Sguardo intenso dal vivo" },
  { a: "Un bacio a sorpresa", b: "Una dichiarazione sincera" },
  { a: "Locale elegante", b: "Serata in pigiama a casa" },
  { a: "Flirtare per messaggio", b: "Flirtare guardandosi negli occhi" },
  { a: "Weekend romantico", b: "Notte di follie" },
  { a: "Complimento sull'aspetto", b: "Complimento sull'intelligenza" },
  { a: "Sedurre con le parole", b: "Sedurre con i fatti" },
  { a: "Ballare stretti", b: "Baciarsi al buio" },
  { a: "Regalo audace", b: "Regalo sentimentale" },
  { a: "Vestito elegante", b: "Look succinto" },
  { a: "Fare la prima mossa", b: "Farsi corteggiare" },
  { a: "Confessare un desiderio", b: "Mantenere il mistero" },
  { a: "Baciare per primi", b: "Farsi baciare" },
  { a: "Serata intima in due", b: "Festa hot con gli amici" },
  { a: "Sussurrare", b: "Gridare" },
  { a: "Toccare per primi", b: "Aspettare di essere toccati" },
  { a: "Sedurre con lo sguardo", b: "Sedurre con la voce" },
  { a: "Cena afrodisiaca", b: "Film piccante insieme" },
  { a: "Chat bollente", b: "Videochiamata bollente" },
  { a: "Iniziare tu il gioco", b: "Farlo iniziare a loro" },
  { a: "Weekend fuori porta", b: "Notte in un hotel di lusso" },
  { a: "Luci soffuse", b: "Buio totale" },
  { a: "Profumo che seduce", b: "Pelle nuda e basta" },
];

const TITOLI = [
  { t: "Re/Regina del Trash", d: "Sa tutto di Sanremo, niente della Rivoluzione francese." },
  { t: "Enciclopedia Vivente", d: "Alle feste è insopportabile. Ma vince." },
  { t: "Fascino Fatale", d: "Ha risposto giusto solo alle domande piccanti. Tutto torna." },
  { t: "Cuore Impavido", d: "Ha rischiato su tutto. Ha funzionato. Quasi sempre." },
];

/* ---------------- utility ---------------- */

const display = { fontFamily: "'Anton','Haettenschweiler','Arial Black',sans-serif", letterSpacing: ".02em", lineHeight: 0.92 };
const shell = {
  minHeight: "100vh",
  background: `radial-gradient(120% 80% at 50% -10%, ${C.viola} 0%, ${C.ink2} 45%, ${C.ink} 100%)`,
  color: C.cream,
  fontFamily: "'Space Grotesk','Trebuchet MS',system-ui,sans-serif",
};
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Anton&family=Space+Grotesk:wght@400;500;700&display=swap');
@keyframes tvin{from{transform:scale(.95);opacity:0}to{transform:none;opacity:1}}
@keyframes glow{0%,100%{filter:brightness(1)}50%{filter:brightness(1.4)}}
@keyframes pop{from{transform:scale(.8);opacity:0}to{transform:none;opacity:1}}
@keyframes shake{10%,90%{transform:translateX(-2px)}20%,80%{transform:translateX(4px)}30%,50%,70%{transform:translateX(-8px)}40%,60%{transform:translateX(8px)}}
@keyframes ringPulse{0%,100%{box-shadow:0 0 0 0 rgba(198,255,61,.55)}50%{box-shadow:0 0 0 10px rgba(198,255,61,0)}}
@keyframes ringPulseHot{0%,100%{box-shadow:0 0 0 0 rgba(255,46,134,.6)}50%{box-shadow:0 0 0 12px rgba(255,46,134,0)}}
@keyframes bump{0%{transform:scale(1)}40%{transform:scale(1.35)}100%{transform:scale(1)}}
@keyframes riseIn{from{transform:translateY(18px);opacity:0}to{transform:translateY(0);opacity:1}}
@keyframes fall{from{transform:translateY(-10vh) rotate(0deg);opacity:1}to{transform:translateY(110vh) rotate(540deg);opacity:.9}}
@keyframes sweep{0%{background-position:-200% 0}100%{background-position:200% 0}}
@keyframes gallop{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
@keyframes spinFace{from{transform:rotate(0)}to{transform:rotate(360deg)}}
@keyframes tickPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.18)}}
.tvin{animation:tvin .3s ease-out}
.glow{animation:glow 1.4s ease-in-out infinite}
.pop{animation:pop .25s ease-out both}
.shake{animation:shake .5s ease-in-out both}
.buzzer-on{animation:ringPulse 1.1s ease-in-out infinite}
.buzzer-hot{animation:ringPulseHot 1.1s ease-in-out infinite}
.bump{animation:bump .35s ease-out both}
.rise-in{animation:riseIn .4s ease-out both}
.confetti-piece{position:fixed;top:0;width:9px;height:14px;pointer-events:none;z-index:60;animation:fall linear forwards}
.sweep-bar{background-image:linear-gradient(100deg,transparent 40%,rgba(255,255,255,.35) 50%,transparent 60%);background-size:250% 100%;animation:sweep 1.1s linear infinite}
.gallop{animation:gallop .5s ease-in-out infinite}
.spin-face{animation:spinFace 2.2s cubic-bezier(.2,.8,.3,1) both}
.tick-pulse{animation:tickPulse .35s ease-out both}
.press{transition:transform .07s ease,box-shadow .07s ease}
.press:active{transform:translate(3px,3px);box-shadow:none!important}
button:focus-visible{outline:3px solid ${C.cream};outline-offset:3px}
input{font-family:inherit}
@media (prefers-reduced-motion:reduce){.tvin,.glow,.pop,.shake,.buzzer-on,.buzzer-hot,.bump,.rise-in,.confetti-piece,.sweep-bar,.gallop,.spin-face,.tick-pulse{animation:none!important}}
`;

const CONFETTI_COLORS = [C.magenta, C.lime, C.gold, C.cyan, C.arancio, C.cream];

/** Coriandoli CSS: niente asset, solo pezzetti colorati che cadono. */
function Confetti({ n = 60 }) {
  const pieces = useState(() => Array.from({ length: n }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.6,
    duration: 2.6 + Math.random() * 1.6,
    color: pick(CONFETTI_COLORS),
    rot: Math.random() * 60 - 30,
  })))[0];
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      {pieces.map((p) => (
        <span key={p.id} className="confetti-piece" style={{
          left: `${p.left}%`, background: p.color, animationDelay: `${p.delay}s`, animationDuration: `${p.duration}s`,
          transform: `rotate(${p.rot}deg)`,
        }} />
      ))}
    </div>
  );
}

/* ============================================================ */
export default function CultrashParty() {
  const [role, setRole] = useState(null);
  const ok = storage.available;
  return (
    <div style={shell}>
      <style>{CSS}</style>
      {!role && <Roles onPick={setRole} storageOk={!!ok} />}
      {role === "idee" && <Suggest onExit={() => setRole(null)} />}
      {role === "host" && <Host onExit={() => setRole(null)} />}
      {role === "player" && <Player onExit={() => setRole(null)} />}
    </div>
  );
}

function Roles({ onPick, storageOk }) {
  return (
    <div className="tvin mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-10">
      <p className="mb-3 text-xs font-bold uppercase tracking-widest" style={{ color: C.lime }}>Quiz di gruppo · schermo grande + telefoni</p>
      <h1 className="text-6xl uppercase sm:text-8xl" style={display}>Cul<span style={{ color: C.magenta }}>trash</span></h1>
      <div className="mt-4 -rotate-1 px-4 py-3" style={{ background: C.magenta }}>
        <p className="text-sm font-bold uppercase" style={{ color: C.ink }}>Primo round: la tua categoria. Poi cambiano le regole e si fa male.</p>
      </div>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <button onClick={() => onPick("host")} className="press border-2 p-5 text-left" style={{ borderColor: C.lime, background: "rgba(198,255,61,.08)", boxShadow: `6px 6px 0 ${C.lime}` }}>
          <p className="text-3xl uppercase" style={{ ...display, color: C.lime }}>Schermo principale</p>
          <p className="mt-1 text-sm opacity-80">Sul computer o sulla TV. Scegli la modalità e apri la stanza.</p>
        </button>
        <button onClick={() => onPick("player")} className="press border-2 p-5 text-left" style={{ borderColor: C.magenta, background: "rgba(255,46,134,.08)", boxShadow: `6px 6px 0 ${C.magenta}` }}>
          <p className="text-3xl uppercase" style={{ ...display, color: C.magenta }}>Sono un giocatore</p>
          <p className="mt-1 text-sm opacity-80">Sul telefono. Codice della stanza e diventi un buzzer.</p>
        </button>
      </div>
      <button onClick={() => onPick("idee")} className="press mt-4 w-full border-2 border-dashed p-4 text-left"
        style={{ borderColor: C.gold, color: C.cream }}>
        <p className="text-2xl uppercase" style={{ ...display, color: C.gold }}>Proponi un gioco</p>
        <p className="mt-1 text-sm opacity-80">Hai un'idea per un minigioco? Scrivila qui: categoria, difficoltà e formazione.</p>
      </button>

      <div className="mt-8 border-l-4 pl-4 text-sm opacity-80" style={{ borderColor: C.gold }}>
        <p className="font-bold" style={{ color: C.gold }}>Come si parte</p>
        <p className="mt-1">1. Apri l'app sul computer e scegli «Schermo principale».</p>
        <p>2. Condividi il link dell'app agli amici (tasto Condividi in alto).</p>
        <p>3. Loro lo aprono sul telefono, scelgono «Sono un giocatore» e digitano il codice.</p>
        <p className="mt-2 text-xs opacity-70">Nomi e punteggi della stanza sono visibili a chi usa l'app: usa soprannomi.</p>
      </div>
      {!storageOk && <p className="mt-6 border-2 p-3 text-sm" style={{ borderColor: C.magenta }}>La sincronizzazione non è disponibile qui. Apri l'app dal link condiviso per giocare su più dispositivi.</p>}
    </div>
  );
}

/* ============================================================
   PROPOSTE — l'utente suggerisce nuovi giochi
   ============================================================ */
const IDEA_CATS = [...Object.keys(CATS), "trasversale"];
const IDEA_FORMS = [
  { k: "solo", label: "Squadre da 1" },
  { k: "squadre", label: "Squadre da 2+" },
  { k: "entrambe", label: "Va bene per entrambe" },
];

function Suggest({ onExit }) {
  const [text, setText] = useState("");
  const [cat, setCat] = useState(null);
  const [diff, setDiff] = useState(null);
  const [form, setForm] = useState(null);
  const [by, setBy] = useState("");
  const [sent, setSent] = useState(false);
  const [list, setList] = useState(null);
  const [err, setErr] = useState("");

  const ready = text.trim().length >= 12 && cat && diff && form;

  const load = useCallback(async () => {
    try {
      const r = await storage.list("cultrash:idea:", true);
      const keys = (r?.keys || []).sort().reverse().slice(0, 8);
      const out = [];
      for (const k of keys) {
        try { out.push(JSON.parse((await storage.get(k, true)).value)); } catch (_) {}
      }
      setList(out);
    } catch (_) { setList([]); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function send() {
    if (!ready) return;
    const idea = {
      text: text.trim().slice(0, 400),
      cat, diff, form,
      by: by.trim().slice(0, 14) || "anonimo",
      at: Date.now(),
    };
    try {
      await storage.set(`cultrash:idea:${Date.now()}_${uid()}`, JSON.stringify(idea), true);
      setSent(true);
      setText(""); setCat(null); setDiff(null); setForm(null);
      load();
    } catch (_) { setErr("Non è stato possibile salvare la proposta. Riprova tra poco."); }
  }

  const Chip = ({ on, color, children, onClick }) => (
    <button onClick={onClick} className="press border-2 px-3 py-2 text-sm font-bold uppercase"
      style={{ borderColor: color, background: on ? color : "transparent", color: on ? C.ink : color }}>
      {children}
    </button>
  );

  return (
    <div className="tvin mx-auto max-w-2xl px-6 py-10">
      <button onClick={onExit} className="mb-4 text-xs font-bold uppercase tracking-widest opacity-60">← indietro</button>
      <h2 className="text-5xl uppercase" style={display}>Proponi un gioco</h2>
      <p className="mb-6 text-sm opacity-70">
        Regole nuove, meccaniche assurde, round che vorresti vedere. Le proposte restano nella stanza pubblica dell'app: leggibili da chiunque la usi, quindi niente dati personali.
      </p>

      <p className="mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: C.lime }}>L'idea</p>
      <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 400))} rows={5}
        placeholder="Es: un round dove la squadra deve indovinare una canzone da tre emoji, e chi sbaglia canta il ritornello a cappella."
        className="w-full border-2 bg-transparent px-4 py-3 text-base"
        style={{ borderColor: "rgba(255,243,230,.3)", color: C.cream }} />
      <p className="mt-1 text-right text-xs opacity-50">{text.length}/400</p>

      <p className="mt-6 mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: C.lime }}>Per quale categoria</p>
      <div className="flex flex-wrap gap-2">
        {IDEA_CATS.map((k) => (
          <Chip key={k} on={cat === k} color={CATS[k]?.color || C.cream} onClick={() => setCat(k)}>
            {CATS[k]?.name || "Trasversale"}
          </Chip>
        ))}
      </div>

      <p className="mt-6 mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: C.lime }}>Per quale difficoltà</p>
      <div className="flex flex-wrap gap-2">
        {Object.entries(DIFF).map(([k, d]) => (
          <Chip key={k} on={diff === k} color={C.cyan} onClick={() => setDiff(k)}>{d.label}</Chip>
        ))}
      </div>

      <p className="mt-6 mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: C.lime }}>Per quale formazione</p>
      <div className="flex flex-wrap gap-2">
        {IDEA_FORMS.map((f) => (
          <Chip key={f.k} on={form === f.k} color={C.arancio} onClick={() => setForm(f.k)}>{f.label}</Chip>
        ))}
      </div>

      <p className="mt-6 mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: C.lime }}>Come ti firmi (facoltativo)</p>
      <input value={by} onChange={(e) => setBy(e.target.value.slice(0, 14))} placeholder="Un soprannome"
        className="w-full border-2 bg-transparent px-4 py-3 text-lg font-bold"
        style={{ borderColor: "rgba(255,243,230,.3)", color: C.cream }} />

      <button onClick={send} disabled={!ready} className="press mt-6 w-full py-5 text-3xl uppercase"
        style={{ ...display, background: ready ? C.gold : "rgba(255,243,230,.15)", color: ready ? C.ink : "rgba(255,243,230,.4)", boxShadow: ready ? `6px 6px 0 ${C.magenta}` : "none" }}>
        Mandala
      </button>
      {!ready && <p className="mt-2 text-center text-xs opacity-60">Servono almeno una frase di senso compiuto e le tre scelte qui sopra.</p>}
      {sent && <p className="mt-3 text-center text-sm font-bold" style={{ color: C.lime }}>Proposta salvata. Se è buona finisce nel gioco.</p>}
      {err && <p className="mt-3 text-center text-sm" style={{ color: C.magenta }}>{err}</p>}

      <h3 className="mt-12 text-2xl uppercase" style={display}>Ultime proposte</h3>
      {list === null && <p className="mt-2 text-sm opacity-60">Sto caricando...</p>}
      {list?.length === 0 && <p className="mt-2 text-sm opacity-60">Ancora nessuna. Sii il primo.</p>}
      <div className="mt-3 space-y-2">
        {(list || []).map((it, i) => (
          <div key={i} className="border-2 p-3" style={{ borderColor: "rgba(255,243,230,.2)" }}>
            <p className="text-sm">{it.text}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold uppercase">
              <span className="px-2 py-1" style={{ background: CATS[it.cat]?.color || C.cream, color: C.ink }}>{CATS[it.cat]?.name || "Trasversale"}</span>
              <span className="px-2 py-1" style={{ background: C.cyan, color: C.ink }}>{DIFF[it.diff]?.label || it.diff}</span>
              <span className="px-2 py-1" style={{ background: C.arancio, color: C.ink }}>{IDEA_FORMS.find((f) => f.k === it.form)?.label || it.form}</span>
              <span className="opacity-60">— {it.by}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   HOST
   ============================================================ */
function Host({ onExit }) {
  const [room] = useState(code);
  const [screen, setScreen] = useState("setup");
  const [mode, setMode] = useState("normale");
  const [diff, setDiff] = useState("medio");
  const [teamMode, setTeamMode] = useState("solo");
  const [enabled, setEnabled] = useState({ musica: true, sport: true, trash: true, cultura: true, piccante: true });
  const [players, setPlayers] = useState([]);
  const [g, setG] = useState(null);
  const [left, setLeft] = useState(18);
  const [answered, setAnswered] = useState({});
  const [outcome, setOutcome] = useState(null);
  const [err, setErr] = useState("");

  const M = MODES[mode];
  const D = DIFF[diff];
  const T = Math.round(M.t * D.tmul);
  const cats = Object.keys(enabled).filter((k) => enabled[k]);

  const playersRef = useRef(players), gRef = useRef(g), ansRef = useRef({}), usedRef = useRef({});
  const flowRef = useRef([]), betsRef = useRef({}), posRef = useRef({ b: 0, q: 0 }), cfgRef = useRef({ T, cats }), teamsRef = useRef([]);
  const tn = (tid) => teamsRef.current.find((t) => t.i === tid)?.name || "Squadra";
  playersRef.current = players; gRef.current = g;
  cfgRef.current = { T, cats, pool: D.pool, pmul: D.pmul, diffLabel: D.label, teamMode };

  const teamsList = [];
  players.forEach((p) => {
    if (!p.team || teamsList.find((t) => t.i === p.team)) return;
    teamsList.push({ i: p.team, name: "Squadra", color: TEAM_COLORS[teamsList.length % TEAM_COLORS.length] });
  });
  players.forEach((p) => {
    if (!p.team || !p.teamName) return;
    const t = teamsList.find((x) => x.i === p.team);
    if (t && t.name === "Squadra") t.name = p.teamName;
  });
  teamsRef.current = teamsList;

  const push = useCallback(async (p) => {
    try { await storage.set(kState(room), JSON.stringify({ ...p, ts: Date.now() }), true); setErr(""); }
    catch (_) { setErr("Sincronizzazione instabile: i telefoni potrebbero aggiornarsi in ritardo."); }
  }, [room]);

  const pub = (ps) => ps.map((p) => ({ id: p.id, name: p.name, color: p.color, score: p.score, team: p.team ?? null }));
  const totQ = () => flowRef.current.reduce((s, b) => s + b.n, 0);
  const doneQ = () => flowRef.current.slice(0, posRef.current.b).reduce((s, b) => s + b.n, 0) + posRef.current.q;

  /* lobby */
  useEffect(() => {
    if (screen !== "lobby") return;
    let stop = false;
    const scan = async () => {
      try {
        const res = await storage.list(pPrefix(room), true);
        await Promise.all((res?.keys || []).map((k) => k.split(":").pop()).map(async (id) => {
          try {
            const r = await storage.get(kPlayer(room, id), true);
            const d = JSON.parse(r.value);
            if (stop) return;
            setPlayers((ps) => {
              const ex = ps.find((p) => p.id === id);
              if (!ex) {
                if (ps.length >= 8) return ps;
                return [...ps, { id, name: (d.name || "Anonimo").slice(0, 12), color: PCOL[ps.length % PCOL.length], score: 0, right: 0, wrong: 0, risk: 0, team: d.team || null, teamName: d.teamName || null }];
              }
              if ((d.team || null) !== ex.team || (d.teamName || null) !== ex.teamName)
                return ps.map((p) => (p.id === id ? { ...p, team: d.team || null, teamName: d.teamName || null } : p));
              return ps;
            });
          } catch (_) {}
        }));
      } catch (_) {}
    };
    scan();
    const t = setInterval(scan, POLL_HOST);
    return () => { stop = true; clearInterval(t); };
  }, [screen, room]);

  useEffect(() => {
    if (screen !== "lobby") return;
    push({ phase: "lobby", players: pub(players), room, mode: M.label, teamMode, teams: teamsList });
  }, [screen, players, teamMode]); // eslint-disable-line

  /* raccolta input dai telefoni */
  useEffect(() => {
    if (screen !== "game") return;
    const t = setInterval(async () => {
      const cur = gRef.current;
      if (!cur) return;

      if (cur.phase === "choose") {
        try {
          const r = await storage.get(kPlayer(room, cur.chooser), true);
          const d = JSON.parse(r.value);
          if (d.pickFor === cur.rid && d.pickCat && CATS[d.pickCat]) applyPick(d.pickCat);
        } catch (_) {}
        return;
      }
      if (cur.phase === "azzardo") {
        await Promise.all(playersRef.current.map(async (p) => {
          if (ansRef.current[p.id]) return;
          try {
            const r = await storage.get(kPlayer(room, p.id), true);
            const d = JSON.parse(r.value);
            if (d.rid === cur.rid && d.pick) {
              ansRef.current[p.id] = { pick: d.pick, bet: d.bet ?? 50 };
              setAnswered((a) => ({ ...a, [p.id]: true }));
            }
          } catch (_) {}
        }));
        if (playersRef.current.length && playersRef.current.every((p) => ansRef.current[p.id])) resolve();
        return;
      }
      if (cur.phase === "bet") {
        await Promise.all(playersRef.current.map(async (p) => {
          if (betsRef.current[p.id] != null) return;
          try {
            const r = await storage.get(kPlayer(room, p.id), true);
            const d = JSON.parse(r.value);
            if (d.rid === cur.rid && typeof d.bet === "number") {
              betsRef.current[p.id] = d.bet;
              setAnswered((a) => ({ ...a, [p.id]: true }));
            }
          } catch (_) {}
        }));
        if (playersRef.current.every((p) => betsRef.current[p.id] != null)) {
          const { b, q } = posRef.current;
          ask(b, q);
        }
        return;
      }
      if (cur.phase === "puzzle") {
        const teamsDone = new Set();
        await Promise.all(playersRef.current.map(async (p) => {
          const have = ansRef.current[p.id];
          if (have?.word) { if (p.team) teamsDone.add(p.team); return; }
          try {
            const r = await storage.get(kPlayer(room, p.id), true);
            const d = JSON.parse(r.value);
            if (d.rid === cur.rid && (d.puzzleDone || d.word)) {
              ansRef.current[p.id] = { puzzle: !!d.puzzleDone, word: !!d.word, elapsed: d.elapsed ?? PUZZLE_T };
              setAnswered((a) => ({ ...a, [p.id]: d.word ? "parola" : "pezzo" }));
              if (d.word && p.team) teamsDone.add(p.team);
            }
          } catch (_) {}
        }));
        const activeTeams = new Set(playersRef.current.filter((p) => p.team).map((p) => p.team));
        if (activeTeams.size && teamsDone.size >= activeTeams.size) resolve();
        return;
      }
      if (cur.phase === "spicy") {
        await Promise.all(playersRef.current.map(async (p) => {
          if (ansRef.current[p.id]) return;
          try {
            const r = await storage.get(kPlayer(room, p.id), true);
            const d = JSON.parse(r.value);
            if (d.rid !== cur.rid) return;
            if (p.id === cur.owner && d.mine) {
              ansRef.current[p.id] = { mine: d.mine };
              setAnswered((a) => ({ ...a, [p.id]: true }));
            } else if (p.id !== cur.owner && d.guess) {
              ansRef.current[p.id] = { guess: d.guess };
              setAnswered((a) => ({ ...a, [p.id]: true }));
            }
          } catch (_) {}
        }));
        if (playersRef.current.length && playersRef.current.every((p) => ansRef.current[p.id])) resolve();
        return;
      }
      if (cur.phase !== "quiz" && cur.phase !== "vote") return;

      await Promise.all(playersRef.current.map(async (p) => {
        if (ansRef.current[p.id]) return;
        try {
          const r = await storage.get(kPlayer(room, p.id), true);
          const d = JSON.parse(r.value);
          if (d.rid !== cur.rid) return;
          if (cur.phase === "vote" && d.vote) {
            ansRef.current[p.id] = { vote: d.vote };
            setAnswered((a) => ({ ...a, [p.id]: true }));
          } else if (cur.phase === "quiz" && cur.kind === "num" && typeof d.num === "number") {
            ansRef.current[p.id] = { num: d.num, elapsed: Math.min(cfgRef.current.T, Math.max(0, d.elapsed ?? cfgRef.current.T)) };
            setAnswered((a) => ({ ...a, [p.id]: true }));
          } else if (cur.phase === "quiz" && typeof d.answer === "number") {
            ansRef.current[p.id] = { answer: d.answer, elapsed: Math.min(cfgRef.current.T, Math.max(0, d.elapsed ?? cfgRef.current.T)), risk: !!d.risk };
            setAnswered((a) => ({ ...a, [p.id]: true }));
          }
        } catch (_) {}
      }));
      if (playersRef.current.length && playersRef.current.every((p) => ansRef.current[p.id])) resolve();
    }, POLL_HOST);
    return () => clearInterval(t);
  }, [screen, room]); // eslint-disable-line

  /* timer */
  useEffect(() => {
    if (!g || (g.phase !== "quiz" && g.phase !== "vote" && g.phase !== "puzzle" && g.phase !== "bet" && g.phase !== "azzardo" && g.phase !== "spicy")) return;
    if (left <= 0) {
      if (g.phase === "bet") { const { b, q } = posRef.current; ask(b, q); return; }
      resolve(); return;
    }
    const t = setTimeout(() => setLeft((l) => +(l - HOST_TICK / 1000).toFixed(2)), HOST_TICK);
    return () => clearTimeout(t);
  }, [g, left]); // eslint-disable-line

  function draw(cat) {
    const pool = Q[cat];
    let allowed = pool.map((_, i) => i).filter((i) => cfgRef.current.pool.includes(pool[i].d));
    if (cat === "piccante") {
      // la categoria sale di intensità (s: 1 soft -> 3 esplicito) più la si sceglie nella serata.
      const askedCount = (usedRef.current[cat] || []).length;
      const tier = askedCount < 2 ? 1 : askedCount < 4 ? 2 : 3;
      const atTier = allowed.filter((i) => (pool[i].s || 1) <= tier);
      if (atTier.length) allowed = atTier;
    }
    const idxs = allowed.length ? allowed : pool.map((_, i) => i);
    const seen = usedRef.current[cat] || [];
    const free = idxs.filter((i) => !seen.includes(i));
    const list = free.length ? free : idxs;
    const idx = pick(list);
    usedRef.current[cat] = free.length ? [...seen, idx] : [idx];
    const it = pool[idx];
    const o = shuffle([0, 1, 2, 3]);
    return { q: it.q, f: it.f, a: o.map((i) => it.a[i]), c: o.indexOf(it.c) };
  }

  /* ---- costruzione partita ---- */
  function buildFlow(ps) {
    let own;
    if (cfgRef.current.teamMode === "squadre") {
      const active = [...new Set(ps.filter((p) => p.team != null).map((p) => p.team))];
      own = shuffle(active).map((ti) => {
        const mem = pick(ps.filter((p) => p.team === ti));
        return { kind: "own", team: ti, pid: mem.id, n: M.own };
      });
    } else {
      own = shuffle(ps).map((p) => ({ kind: "own", pid: p.id, n: M.own }));
    }
    let bag = Object.keys(MG);
    if (ps.length < 3) bag = bag.filter((m) => m !== "vote");
    let chosen;
    if (cfgRef.current.teamMode === "squadre") {
      const teamGames = shuffle(Object.keys(TEAM_MG));
      const solos = shuffle(bag);
      const nTeamG = Math.min(teamGames.length, Math.max(1, Math.ceil(M.mgs / 2)));
      chosen = shuffle([...teamGames.slice(0, nTeamG), ...solos.slice(0, Math.max(0, M.mgs - nTeamG))]);
    } else {
      chosen = shuffle(bag).slice(0, Math.min(M.mgs, bag.length));
    }
    const UNA_SOLA = ["puzzle", "cavalli", "roulette", "russa"];
    const mgs = chosen.map((m) => ({ kind: "mg", mg: m, n: UNA_SOLA.includes(m) ? 1 : m === "vote" ? Math.min(2, M.qmg) : m === "staffetta" ? Math.max(M.qmg, maxTeamSize(ps)) : M.qmg }));
    return [...own, ...mgs];
  }

  function maxTeamSize(ps) {
    const c = {};
    ps.forEach((p) => { if (p.team != null) c[p.team] = (c[p.team] || 0) + 1; });
    return Math.max(1, ...Object.values(c));
  }

  function startMatch() {
    sfx.start();
    flowRef.current = buildFlow(players);
    usedRef.current = {};
    setScreen("game");
    runBlock(0);
  }

  async function runBlock(i) {
    posRef.current = { b: i, q: 0 };
    const b = flowRef.current[i];
    if (!b) return endMatch();
    if (b.kind === "own") {
      const p = playersRef.current.find((x) => x.id === b.pid);
      const tname = b.team ? tn(b.team) : null;
      const rid = `pick-${i}`;
      const state = { phase: "choose", chooser: b.pid, chooserName: p?.name, ownerTeam: b.team ?? null, teamName: tname, rid, cats: cfgRef.current.cats, blockLabel: tname ? `Categoria di ${tname}` : `Categoria di ${p?.name}`, qn: doneQ(), qtot: totQ() };
      setG(state);
      await push({ ...state, players: pub(playersRef.current), room });
      setTimeout(() => {
        const cur = gRef.current;
        if (cur?.phase === "choose" && cur.rid === rid) applyPick(pick(cfgRef.current.cats));
      }, 22000);
    } else {
      const state = { phase: "mgintro", mg: b.mg, blockLabel: MG_ALL[b.mg].name, qn: doneQ(), qtot: totQ() };
      setG(state);
      await push({ ...state, players: pub(playersRef.current), room });
      setTimeout(() => (b.mg === "puntata" ? askBet(i, 0) : ask(i, 0)), 4200);
    }
  }

  function applyPick(cat) {
    const i = posRef.current.b;
    if (flowRef.current[i]) flowRef.current[i].cat = cat;
    ask(i, 0);
  }

  async function askBet(bi, qi) {
    posRef.current = { b: bi, q: qi };
    betsRef.current = {};
    setAnswered({});
    setOutcome(null);
    const rid = `bet-${bi}-${qi}`;
    const state = { phase: "bet", rid, mg: "puntata", kind: "bet", opts: BET_OPTS, time: BET_T, qn: doneQ() + 1, qtot: totQ(), blockLabel: MG_ALL.puntata.name, diffLabel: cfgRef.current.diffLabel };
    setG(state);
    setLeft(BET_T);
    await push({ ...state, players: pub(playersRef.current), room });
  }

  /** Sceglie un membro a caso per ogni squadra: mai lo stesso due volte di fila,
   *  e nessuno si ripete finché tutti gli altri compagni non hanno avuto un turno. */
  function pickTurnPerTeam(key) {
    const byT = {};
    playersRef.current.forEach((p) => { if (p.team != null) (byT[p.team] = byT[p.team] || []).push(p); });
    const queues = usedRef.current[key] || {};
    const chosen = Object.entries(byT).map(([ti, mem]) => {
      let q = queues[ti];
      if (!q || !q.length) {
        q = shuffle(mem.map((p) => p.id));
        if (mem.length > 1 && q[0] === queues[`${ti}_prev`]) [q[0], q[1]] = [q[1], q[0]];
      }
      const id = q.shift();
      queues[ti] = q;
      queues[`${ti}_prev`] = id;
      return mem.find((p) => p.id === id) || mem[0];
    });
    usedRef.current[key] = queues;
    return { activeIds: chosen.map((p) => p.id), activeNames: chosen.map((p) => p.name) };
  }

  async function ask(bi, qi) {
    posRef.current = { b: bi, q: qi };
    const b = flowRef.current[bi];
    ansRef.current = {};
    setAnswered({});
    setOutcome(null);
    const rid = `${bi}-${qi}`;
    const owner = b.kind === "own" ? playersRef.current.find((p) => p.id === b.pid) : null;

    if (b.kind === "own" && b.cat === "piccante") {
      const seen = usedRef.current.confronti || [];
      const confronto = pick(CONFRONTI.filter((c) => !seen.includes(c.a))) || pick(CONFRONTI);
      usedRef.current.confronti = [...seen, confronto.a];
      const state = { phase: "spicy", rid, cat: "piccante", rule: "own", confronto, owner: owner?.id, ownerName: owner?.name, ownerTeam: b.team ?? null, teamName: b.team ? tn(b.team) : null, time: T, qn: doneQ() + 1, qtot: totQ(), blockLabel: b.team ? `Categoria di ${tn(b.team)}` : `Categoria di ${owner?.name}` };
      setG(state);
      setLeft(T);
      await push({ ...state, players: pub(playersRef.current), room });
      return;
    }

    if (b.kind === "mg" && b.mg === "vote") {
      const prompt = pick(VOTI.filter((v) => !(usedRef.current.voti || []).includes(v))) || pick(VOTI);
      usedRef.current.voti = [...(usedRef.current.voti || []), prompt];
      const state = { phase: "vote", rid, mg: "vote", prompt, time: T, qn: doneQ() + 1, qtot: totQ(), blockLabel: MG_ALL.vote.name };
      setG(state);
      setLeft(T);
      await push({ ...state, players: pub(playersRef.current), room });
      return;
    }

    if (b.kind === "mg" && ["cavalli", "roulette", "russa"].includes(b.mg)) {
      const state = { phase: "azzardo", rid, mg: b.mg, kind: "azzardo", game: b.mg, cavalli: b.mg === "cavalli" ? CAVALLI : null, opts: BET_OPTS, time: AZZ_T, qn: doneQ() + 1, qtot: totQ(), blockLabel: MG_ALL[b.mg].name, diffLabel: cfgRef.current.diffLabel };
      setG({ ...state, rule: b.mg });
      setLeft(AZZ_T);
      await push({ ...state, players: pub(playersRef.current), room });
      return;
    }

    if (b.kind === "mg" && b.mg === "puzzle") {
      const seen = usedRef.current.words || [];
      const item = pick(WORDS.filter((x) => !seen.includes(x.w))) || pick(WORDS);
      usedRef.current.words = [...seen, item.w];
      const letters = {};
      const byT = {};
      playersRef.current.forEach((p) => { if (p.team) (byT[p.team] = byT[p.team] || []).push(p); });
      Object.values(byT).forEach((mem) => {
        mem.forEach((p) => { letters[p.id] = ""; });
        shuffle(item.w.split("")).forEach((ch, i) => { letters[mem[i % mem.length].id] += ch; });
      });
      const state = { phase: "puzzle", rid, mg: "puzzle", hint: item.hint, wordLen: item.w.length, letters, w: encW(item.w), time: PUZZLE_T, qn: doneQ() + 1, qtot: totQ(), blockLabel: MG_ALL.puzzle.name };
      setG({ ...state, word: item.w, rule: "puzzle" });
      setLeft(PUZZLE_T);
      await push({ ...state, players: pub(playersRef.current), room });
      return;
    }

    const rule = b.kind === "own" ? "own" : b.mg;
    let cat = null, q = null, extra = {};
    const once = (key, arr, keyf = (x) => x.q) => {
      const seen = usedRef.current[key] || [];
      const it = pick(arr.filter((x) => !seen.includes(keyf(x)))) || pick(arr);
      usedRef.current[key] = [...seen, keyf(it)];
      return it;
    };

    if (b.kind === "own") {
      cat = b.cat;
      q = draw(cat);
    } else if (b.mg === "verofalso") {
      const it = once("vf", VF);
      q = { q: it.q, a: ["VERO", "FALSO"], c: it.v ? 0 : 1, f: it.f };
    } else if (b.mg === "indizi") {
      const it = once("ind", INDIZI, (x) => x.clues[0]);
      const o = shuffle([0, 1, 2, 3]);
      q = { q: "Di chi o cosa si parla?", clues: it.clues, a: o.map((i) => it.a[i]), c: o.indexOf(it.c), f: it.f };
    } else if (b.mg === "piumeno") {
      const it = once("pm", PIUMENO);
      const flip = Math.random() < .5;
      q = { q: it.q, a: flip ? [it.a[1], it.a[0]] : it.a, c: flip ? 1 : 0, f: it.f };
    } else if (b.mg === "stima") {
      const it = once("st", STIMA);
      q = { q: it.q, a: [], c: -1, f: it.f, unit: it.u, value: it.v };
    } else if (b.mg === "staffetta") {
      const it = once("em", EMOJI);
      const o = shuffle([0, 1, 2, 3]);
      q = { q: it.q, a: o.map((i) => it.a[i]), c: o.indexOf(it.c), f: it.f };
    } else if (b.mg === "intruso") {
      const it = once("odd", INTRUSO, (x) => x.a.join());
      const o = shuffle([0, 1, 2, 3]);
      q = { q: it.q, a: o.map((i) => it.a[i]), c: o.indexOf(it.c), f: it.f };
    } else if (b.mg === "lampo") {
      const it = once("lampo", LAMPO);
      const o = shuffle([0, 1, 2, 3]);
      q = { q: it.q, a: o.map((i) => it.a[i]), c: o.indexOf(it.c), f: it.f };
    } else if (b.mg === "trabocchetto") {
      const it = once("trap", TRABOCCHETTI);
      const o = shuffle([0, 1, 2, 3]);
      q = { q: it.q, a: o.map((i) => it.a[i]), c: o.indexOf(it.c), f: it.f };
    } else if (b.mg === "citazioni") {
      const it = once("quote", CITAZIONI);
      const o = shuffle([0, 1, 2, 3]);
      q = { q: it.q, a: o.map((i) => it.a[i]), c: o.indexOf(it.c), f: it.f };
    } else if (b.mg === "doppio") {
      const it = once("dop", DOPPIO);
      const o = shuffle([0, 1, 2, 3]);
      q = { q: it.q, a: o.map((i) => it.a[i]), c: o.indexOf(it.c), f: it.f };
    } else if (b.mg === "enplein") {
      const per = {}, perC = {}, perF = {};
      playersRef.current.forEach((p) => {
        const it = once("def", DEFINIZIONI);
        const o = shuffle([0, 1, 2, 3]);
        per[p.id] = { q: it.q, a: o.map((i) => it.a[i]) };
        perC[p.id] = o.indexOf(it.c);
        perF[p.id] = it.f;
      });
      q = { q: "Ognuno ha la sua domanda sul telefono", a: [], c: -1, f: "Ognuno aveva una definizione diversa: il percorso netto valeva doppio." };
      extra = { per, perC, perF };
    } else if (b.mg === "puntata" || b.mg === "ruota") {
      cat = pick(cfgRef.current.cats);
      q = draw(cat);
    } else if (b.mg === "compatti") {
      const it = once("op", OPINIONI);
      q = { q: it.q, a: it.a, c: -1, f: "Nessuna risposta era giusta: contava solo andare d'accordo." };
    } else {
      cat = pick(cfgRef.current.cats);
      q = draw(cat);
    }

    let activeIds = null, activeNames = null;
    if (b.kind === "mg" && b.mg === "staffetta") {
      ({ activeIds, activeNames } = pickTurnPerTeam("staffettaTurn"));
    } else if (b.kind === "mg" && b.mg === "intruso") {
      ({ activeIds, activeNames } = pickTurnPerTeam("intrusoTurn"));
    }
    const kind = b.kind === "own" ? "quiz" : MG_ALL[b.mg].kind;
    const state = { phase: "quiz", rid, cat, q, rule, kind, mg: b.kind === "mg" ? b.mg : null, owner: owner?.id, ownerName: owner?.name, ownerTeam: b.team ?? null, teamName: b.team ? tn(b.team) : null, activeIds, activeNames, time: b.kind === "mg" && b.mg === "lampo" ? Math.max(6, Math.round(T / 2)) : T, diffLabel: cfgRef.current.diffLabel, qn: doneQ() + 1, qtot: totQ(), blockLabel: b.kind === "own" ? (b.team ? `Categoria di ${tn(b.team)}` : `Categoria di ${owner?.name}`) : MG_ALL[b.mg].name, ...extra };
    setG(state);
    setLeft(b.kind === "mg" && b.mg === "lampo" ? Math.max(6, Math.round(T / 2)) : T);
    const pubQ = { q: q.q, a: q.a, clues: q.clues, unit: q.unit };
    await push({ ...state, perC: undefined, perF: undefined, q: pubQ, players: pub(playersRef.current), room });
  }

  async function resolve() {
    const cur = gRef.current;
    if (!cur || (cur.phase !== "quiz" && cur.phase !== "vote" && cur.phase !== "puzzle" && cur.phase !== "azzardo" && cur.phase !== "spicy")) return;
    const ps = playersRef.current;

    if (cur.phase === "spicy") {
      const K = cfgRef.current.pmul;
      const mine = ansRef.current[cur.owner]?.mine ?? null;
      let rightCount = 0;
      const res = {};
      let updated = ps.map((p) => {
        if (p.id === cur.owner) return p;
        const g = ansRef.current[p.id]?.guess;
        const right = mine != null && g === mine;
        if (right) rightCount++;
        const pts = right ? Math.round(120 * K) : 0;
        res[p.id] = { ok: right, pts, answered: !!g, note: !g ? "muto: bonus bruciato" : right ? "ti conosce bene" : "toppato" };
        return { ...p, score: Math.max(0, p.score + pts), right: p.right + (right ? 1 : 0), wrong: p.wrong + (right ? 0 : 1) };
      });
      const bonus = mine != null ? Math.round((40 + rightCount * 30) * K) : 0;
      res[cur.owner] = { ok: mine != null, pts: bonus, answered: mine != null, note: mine == null ? "non ha risposto: niente bonus" : rightCount === 0 ? "un mistero per tutti" : `${rightCount} vi hanno capito` };
      updated = updated.map((p) => (p.id === cur.owner ? { ...p, score: Math.max(0, p.score + bonus) } : p));
      setG({ ...cur, phase: "spicyres", mine });
      setPlayers(updated);
      setOutcome(res);
      await push({ phase: "spicyres", rid: cur.rid, confronto: cur.confronto, mine, owner: cur.owner, blockLabel: cur.blockLabel, res, players: pub(updated), room });
      return;
    }
    const res = {};
    let updated;

    if (cur.phase === "azzardo") {
      const K = cfgRef.current.pmul;
      const res2 = {};
      let esito = {};
      if (cur.game === "cavalli") {
        const pesi = CAVALLI.map((c) => 1 / c.quota);
        const tot = pesi.reduce((a, b) => a + b, 0);
        let r = Math.random() * tot, vinc = 0;
        for (let i = 0; i < pesi.length; i++) { r -= pesi[i]; if (r <= 0) { vinc = i; break; } }
        esito = { vincitore: vinc, label: CAVALLI[vinc].nome, sub: `quota ${CAVALLI[vinc].quota}` };
      } else if (cur.game === "roulette") {
        const n = Math.floor(Math.random() * 13);
        esito = { numero: n, colore: rouColore(n), label: String(n), sub: `${rouColore(n)}${n === 0 ? " · lo zero si prende tutto" : n % 2 === 0 ? " · pari" : " · dispari"}` };
      } else {
        const slot = 1 + Math.floor(Math.random() * 6);
        esito = { slot, label: `Casella ${slot}`, sub: "era quella storta" };
      }

      const updated2 = ps.map((p) => {
        const a = ansRef.current[p.id];
        let pts = 0, note = "";
        if (!a) { pts = cur.game === "russa" ? 0 : -50; note = "non ha puntato"; }
        else if (cur.game === "cavalli") {
          const bet = Math.min(a.bet, Math.max(50, p.score));
          const c = CAVALLI[a.pick.cavallo];
          if (a.pick.cavallo === esito.vincitore) { pts = Math.round(bet * (c.quota - 1)); note = `${c.nome} a quota ${c.quota}`; }
          else { pts = -bet; note = `puntava su ${c.nome}`; }
        } else if (cur.game === "roulette") {
          const bet = Math.min(a.bet, Math.max(50, p.score));
          const n = esito.numero, k = a.pick.tipo;
          let vinto = false, mult = 1;
          if (k === "num") { vinto = a.pick.numero === n; mult = 11; }
          else if (n !== 0) {
            if (k === "rosso" || k === "nero") vinto = rouColore(n) === k;
            if (k === "pari") vinto = n % 2 === 0;
            if (k === "dispari") vinto = n % 2 === 1;
          }
          pts = vinto ? Math.round(bet * mult) : -bet;
          note = vinto ? "pagata" : n === 0 ? "lo zero si è preso tutto" : `puntava ${k === "num" ? a.pick.numero : k}`;
        } else {
          if (a.pick.slot === esito.slot) { pts = -Math.round(Math.max(100, p.score / 2)); note = "ha aperto quella storta"; }
          else { pts = Math.round(120 * K); note = "scampata"; }
        }
        res2[p.id] = { pts, ok: pts > 0, answered: !!a, note };
        return { ...p, score: Math.max(0, p.score + pts) };
      });

      setG({ ...cur, phase: "azzardores", esito });
      setPlayers(updated2);
      setOutcome(res2);
      await push({ phase: "azzardores", rid: cur.rid, game: cur.game, esito, res: res2, blockLabel: MG_ALL[cur.game].name, players: pub(updated2), room });
      return;
    }

    if (cur.phase === "puzzle") {
      const K = cfgRef.current.pmul;
      const tTime = {};
      ps.forEach((p) => {
        const a = ansRef.current[p.id];
        if (a?.word && p.team && (tTime[p.team] == null || a.elapsed < tTime[p.team])) tTime[p.team] = a.elapsed;
      });
      const order = Object.keys(tTime).sort((a, b) => tTime[a] - tTime[b]);
      const prize = [300, 200, 120, 80];
      updated = ps.map((p) => {
        const idx = p.team ? order.indexOf(p.team) : -1;
        const size = p.team ? ps.filter((x) => x.team === p.team).length : 1;
        const pts = idx >= 0 ? Math.round(((prize[idx] ?? 80) * K) / size) : 0;
        const a = ansRef.current[p.id] || {};
        res[p.id] = {
          ok: idx === 0, pts, answered: !!a.puzzle,
          note: idx === 0 ? "prima squadra!" : idx > 0 ? `${idx + 1}º posto` : a.puzzle ? "puzzle fatto, parola no" : "puzzle non finito",
        };
        return { ...p, score: Math.max(0, p.score + pts), right: p.right + (idx >= 0 ? 1 : 0), wrong: p.wrong + (idx >= 0 ? 0 : 1) };
      });
      setG({ ...cur, phase: "puzzleres", order, times: tTime });
      setPlayers(updated);
      setOutcome(res);
      await push({ phase: "puzzleres", rid: cur.rid, word: cur.word, hint: cur.hint, res, blockLabel: MG_ALL.puzzle.name, players: pub(updated), room });
      return;
    }

    if (cur.phase === "vote") {
      const tally = {};
      ps.forEach((p) => { const v = ansRef.current[p.id]?.vote; if (v) tally[v] = (tally[v] || 0) + 1; });
      const max = Math.max(0, ...Object.values(tally));
      const win = Object.keys(tally).filter((k) => tally[k] === max);
      updated = ps.map((p) => {
        let pts = 0;
        if (win.includes(p.id)) pts += 150;
        const v = ansRef.current[p.id]?.vote;
        if (v && win.includes(v)) pts += 60;
        res[p.id] = { pts, ok: win.includes(p.id), answered: !!v, votes: tally[p.id] || 0, votedFor: v };
        return { ...p, score: Math.max(0, p.score + pts) };
      });
      setG({ ...cur, phase: "voteres", tally, win });
      setPlayers(updated);
      setOutcome(res);
      await push({ phase: "voteres", rid: cur.rid, prompt: cur.prompt, res, blockLabel: MG_ALL.vote.name, players: pub(updated), room });
      return;
    }

    if (cur.rule === "ruota" && !cur.spin) {
      const spin = pick(RUOTA);
      cur.spin = spin;
      setG((x) => ({ ...x, spin }));
    }
    const t = cfgRef.current.T, K = cfgRef.current.pmul;
    const correct = ps.filter((p) => ansRef.current[p.id]?.answer === cur.q.c)
      .sort((a, b) => ansRef.current[a.id].elapsed - ansRef.current[b.id].elapsed);
    const isTeam = cfgRef.current.teamMode === "squadre";
    const totals = {};
    ps.forEach((p) => { const k = isTeam ? p.team : p.id; if (k != null) totals[k] = (totals[k] || 0) + p.score; });
    const leadKey = Object.keys(totals).sort((a, b) => totals[b] - totals[a])[0];
    const victim = isTeam
      ? [...ps].filter((p) => String(p.team) === leadKey).sort((a, b) => b.score - a.score)[0]
      : ps.find((p) => p.id === leadKey);
    const leaderLabel = isTeam && leadKey != null ? tn(leadKey) : victim?.name;
    const stolen = {};
    const stimaOrder = cur.rule === "stima"
      ? ps.filter((p) => typeof ansRef.current[p.id]?.num === "number")
          .sort((x, y) => {
            const dx = Math.abs(ansRef.current[x.id].num - cur.q.value);
            const dy = Math.abs(ansRef.current[y.id].num - cur.q.value);
            return dx === dy ? ansRef.current[x.id].elapsed - ansRef.current[y.id].elapsed : dx - dy;
          }).map((p) => p.id)
      : [];

    /* aggregati di squadra per i minigiochi collettivi */
    const squad = {};
    if (isTeam) {
      ps.forEach((p) => { if (p.team != null) (squad[p.team] = squad[p.team] || []).push(p); });
    }
    const squadInfo = {};
    Object.entries(squad).forEach(([ti, mem]) => {
      const answers = mem.map((p) => ansRef.current[p.id]);
      const allAnswered = answers.every(Boolean);
      const allRight = allAnswered && mem.every((mp) => ansRef.current[mp.id]?.answer === (cur.perC ? cur.perC[mp.id] : cur.q.c));
      const first = answers[0]?.answer;
      const allSame = allAnswered && answers.every((a) => a.answer === first);
      squadInfo[ti] = { allAnswered, allRight, allSame, sameCorrect: allSame && first === cur.q.c, size: mem.length };
    });

    /* l'intruso lo becca (o no) un solo membro a caso: l'esito vale per tutta la squadra */
    const intrusoTeamOk = {}, intrusoResponder = {};
    if (cur.rule === "intruso" && Array.isArray(cur.activeIds)) {
      cur.activeIds.forEach((pid) => {
        const pl = ps.find((x) => x.id === pid);
        if (pl?.team != null) {
          intrusoTeamOk[pl.team] = ansRef.current[pid]?.answer === cur.q.c;
          intrusoResponder[pl.team] = pl.name;
        }
      });
    }

    updated = ps.map((p) => {
      const a = ansRef.current[p.id];
      const cIdx = cur.perC ? cur.perC[p.id] : cur.q.c;
      const ok = cur.rule === "stima" ? false : cur.rule === "intruso" ? !!intrusoTeamOk[p.team] : !!a && a.answer === cIdx;
      const base = a ? Math.round((100 + ((t - a.elapsed) / t) * 100) * K) : 0;
      let pts = 0, note = "";
      switch (cur.rule) {
        case "own": {
          const home = cur.ownerTeam != null ? p.team === cur.ownerTeam : p.id === cur.owner;
          if (home) { pts = ok ? base * 2 : 0; note = ok ? "in casa ×2" : "sbagliata in casa"; }
          else { pts = ok ? Math.round(base / 2) : 0; note = ok ? "metà punti" : ""; }
          if (a?.risk) pts = ok ? pts * 2 : -75;
          break;
        }
        case "verofalso": {
          const pos = correct.findIndex((x) => x.id === p.id);
          pts = Math.round((pos === 0 ? 250 : pos === 1 ? 150 : pos === 2 ? 75 : 0) * K);
          note = pos === 0 ? "primo!" : pos === 1 ? "secondo" : pos === 2 ? "terzo" : ok ? "troppo tardi" : "";
          break;
        }
        case "indizi": {
          const fase = a ? (a.elapsed < t / 3 ? 1 : a.elapsed < (2 * t) / 3 ? 2 : 3) : 3;
          const mult = fase === 1 ? 2 : fase === 2 ? 1.4 : 1;
          pts = ok ? Math.round(120 * K * mult) : -120;
          note = ok ? `preso al ${fase}º indizio` : a ? "sbagliata" : "muto";
          break;
        }
        case "piumeno":
          if (ok) {
            const v = Math.round(80 * K);
            pts = v;
            const same = isTeam ? String(p.team) === leadKey : p.id === victim?.id;
            if (victim && !same) { stolen[victim.id] = (stolen[victim.id] || 0) + v; note = `ruba a ${leaderLabel}`; }
          }
          break;
        case "staffetta": {
          const mine = cur.activeIds?.includes(p.id);
          if (!mine) { pts = 0; note = "in panchina"; }
          else { pts = ok ? Math.round(base * 1.5) : 0; note = ok ? "turno tuo, centrato" : "turno tuo, buttato"; }
          break;
        }
        case "intruso": {
          const mine = cur.activeIds?.includes(p.id);
          const chi = intrusoResponder[p.team] || "il compagno";
          pts = ok ? Math.round(150 * K) : 0;
          note = mine
            ? (ok ? "l'hai beccato: punti per tutti" : "intruso non trovato")
            : (ok ? `${chi} l'ha beccato` : `${chi} non l'ha trovato`);
          break;
        }
        case "compatti": {
          const inf = squadInfo[p.team] || {};
          if (inf.allSame) { pts = Math.round(200 * K); note = "unanimi"; }
          else { pts = 0; note = inf.allAnswered ? "ognuno per sé" : "manca qualcuno"; }
          break;
        }
        case "lampo": {
          const tt = cur.time || t;
          pts = ok ? Math.round((60 + (Math.max(0, tt - a.elapsed) / tt) * 180) * K) : 0;
          note = ok ? (a.elapsed < tt / 3 ? "fulminante" : "presa al volo") : a ? "sbagliata, ma gratis" : "";
          break;
        }
        case "trabocchetto":
          pts = ok ? Math.round(120 * K) : -120;
          note = ok ? "non ci sei cascato" : a ? "ci sei cascato" : "muto";
          break;
        case "citazioni":
          if (ok) {
            const v = Math.round(80 * K);
            pts = v;
            const scelto = ps.find((x) => x.id === a.target) || victim;
            const stesso = scelto && (isTeam ? String(scelto.team) === String(p.team) : scelto.id === p.id);
            if (scelto && !stesso) { stolen[scelto.id] = (stolen[scelto.id] || 0) + v; note = `ruba a ${scelto.name}`; }
            else note = "nessuno da derubare";
          }
          break;
        case "doppio":
          if (a?.risk) { pts = ok ? Math.round(200 * K) : -100; note = ok ? "doppio incassato" : "doppio fallito"; }
          else { pts = ok ? Math.round(80 * K) : 0; note = ok ? "andato sul sicuro" : "sul sicuro, ma sbagliata"; }
          break;
        case "enplein": {
          const inf = squadInfo[p.team] || {};
          pts = ok ? Math.round(100 * K) : 0;
          if (inf.allRight) { pts += Math.round(100 * K); note = "percorso netto"; }
          else if (!a) note = "bonus bruciato";
          else if (!ok) note = "l'anello debole";
          break;
        }
        case "puntata": {
          const bet = Math.min(betsRef.current[p.id] ?? 50, Math.max(50, p.score));
          pts = ok ? bet : -bet;
          note = ok ? `puntata di ${bet} incassata` : a ? `${bet} lasciati sul tavolo` : `${bet} persi senza rispondere`;
          break;
        }
        case "ruota": {
          const m = cur.spin?.m ?? 1;
          pts = Math.round((ok ? 100 : -50) * m * K);
          note = `${ok ? "giusta" : a ? "sbagliata" : "muto"} · ${cur.spin?.label || "×1"}`;
          break;
        }
        case "stima": {
          const pos = stimaOrder.indexOf(p.id);
          if (!a || typeof a.num !== "number") { pts = -50; note = "nemmeno un tentativo"; break; }
          const scarto = Math.abs(a.num - cur.q.value);
          pts = Math.round((pos === 0 ? 250 : pos === 1 ? 150 : pos === 2 ? 75 : 30) * K);
          if (scarto === 0) { pts += Math.round(100 * K); note = "in pieno!"; }
          else note = `${pos === 0 ? "il più vicino" : `scarto di ${scarto}`}`;
          break;
        }
        default:
          pts = ok ? base : 0;
      }
      const pen = !ok && a && ((cur.rule === "doppio" && a?.risk) || cur.rule === "indizi") ? pick(PENITENZE) : null;
      res[p.id] = { ok, pts, answered: !!a, risk: a?.risk, pen, note, owner: p.id === cur.owner };
      return { ...p, score: Math.max(0, p.score + pts), right: p.right + (ok ? 1 : 0), wrong: p.wrong + (ok ? 0 : 1), risk: p.risk + (a?.risk ? 1 : 0) };
    }).map((p) => {
      if (!stolen[p.id]) return p;
      res[p.id] = { ...res[p.id], pts: res[p.id].pts - stolen[p.id], note: `derubato di ${stolen[p.id]}` };
      return { ...p, score: Math.max(0, p.score - stolen[p.id]) };
    });

    setG({ ...cur, phase: "result" });
    setPlayers(updated);
    setOutcome(res);
    await push({ phase: "result", rid: cur.rid, cat: cur.cat, rule: cur.rule, spin: cur.spin || null, blockLabel: cur.blockLabel, q: { q: cur.q.q, a: cur.q.a, c: cur.q.c, f: cur.q.f }, res, players: pub(updated), room });
  }

  function next() {
    const { b, q } = posRef.current;
    const blk = flowRef.current[b];
    if (q + 1 < blk.n) (blk.mg === "puntata" ? askBet(b, q + 1) : ask(b, q + 1));
    else if (b + 1 < flowRef.current.length) runBlock(b + 1);
    else endMatch();
  }

  async function endMatch() {
    const rank = [...playersRef.current].sort((a, b) => b.score - a.score);
    setScreen("podio");
    await push({ phase: "podio", players: pub(rank), room });
  }

  const teamCounts = teamsList.map((t) => players.filter((p) => p.team === t.i).length);
  const lobbyReady = cats.length > 0 && (teamMode === "solo"
    ? players.length >= 2
    : teamsList.length >= 2 && players.every((p) => p.team) && teamCounts.every((n) => n >= 2));

  if (screen === "setup")
    return <HostSetup {...{ mode, setMode, diff, setDiff, teamMode, setTeamMode, enabled, setEnabled, onExit }}
      onOpen={() => setScreen("lobby")} />;

  if (screen === "lobby")
    return <HostLobby {...{ room, players, err, M, D, T, teamMode, teamsList }} canStart={lobbyReady} onStart={startMatch} />;

  if (screen === "podio") {
    const rank = [...players].sort((a, b) => b.score - a.score);
    return <HostPodio rank={rank} teamMode={teamMode} teamsList={teamsList} onExit={onExit} onAgain={() => {
      setPlayers((ps) => ps.map((p) => ({ ...p, score: 0, right: 0, wrong: 0, risk: 0 })));
      flowRef.current = buildFlow(players); usedRef.current = {}; setScreen("game"); runBlock(0);
    }} />;
  }

  return <HostGame {...{ g, left, T, players, answered, outcome, next, room, err, teamMode, teamsList }} />;
}

function HostSetup({ mode, setMode, diff, setDiff, teamMode, setTeamMode, enabled, setEnabled, onOpen, onExit }) {
  const n = Object.values(enabled).filter(Boolean).length;
  return (
    <div className="tvin mx-auto max-w-3xl px-6 py-10">
      <button onClick={onExit} className="mb-4 text-xs font-bold uppercase tracking-widest opacity-60">← indietro</button>
      <h2 className="text-5xl uppercase" style={display}>Che serata è</h2>
      <p className="mb-4 text-sm opacity-70">Prima cosa: quanto dura.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {Object.entries(MODES).map(([k, m]) => {
          const on = mode === k;
          return (
            <button key={k} onClick={() => setMode(k)} className="press border-2 p-4 text-left"
              style={{ borderColor: C.lime, background: on ? C.lime : "transparent", color: on ? C.ink : C.cream, boxShadow: on ? `5px 5px 0 ${C.magenta}` : "none" }}>
              <p className="text-3xl uppercase" style={display}>{m.label}</p>
              <p className="mt-1 text-xs font-bold" style={{ opacity: on ? 0.8 : 0.65 }}>{m.desc}</p>
            </button>
          );
        })}
      </div>

      <h3 className="mt-10 text-2xl uppercase" style={display}>Quanto tosta</h3>
      <p className="mb-3 text-sm opacity-70">Cambia le domande che escono, il tempo e quanto valgono i punti.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {Object.entries(DIFF).map(([k, d]) => {
          const on = diff === k;
          return (
            <button key={k} onClick={() => setDiff(k)} className="press border-2 p-4 text-left"
              style={{ borderColor: C.cyan, background: on ? C.cyan : "transparent", color: on ? C.ink : C.cream, boxShadow: on ? `5px 5px 0 ${C.gold}` : "none" }}>
              <p className="text-2xl uppercase" style={display}>{d.label}</p>
              <p className="mt-1 text-xs font-bold" style={{ opacity: on ? 0.8 : 0.65 }}>{d.desc}</p>
              <p className="mt-2 text-xs font-bold uppercase">
                {Math.round(MODES[mode].t * d.tmul)}s · punti ×{d.pmul}
              </p>
            </button>
          );
        })}
      </div>

      <h3 className="mt-10 text-2xl uppercase" style={display}>Formazione</h3>
      <p className="mb-3 text-sm opacity-70">Si gioca sempre a squadre: cambia solo quante persone ci stanno dentro.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {[["solo", "Squadre da 1", "Una squadra per persona: 5 giocatori = 5 squadre. Tutti contro tutti."], ["squadre", "Squadre da 2 o più", "Uno fonda la squadra e le dà un nome, gli altri entrano. Punti in comune."]].map(([k, t, d]) => {
          const on = teamMode === k;
          return (
            <button key={k} onClick={() => setTeamMode(k)} className="press border-2 p-4 text-left"
              style={{ borderColor: C.arancio, background: on ? C.arancio : "transparent", color: on ? C.ink : C.cream, boxShadow: on ? `5px 5px 0 ${C.cyan}` : "none" }}>
              <p className="text-2xl uppercase" style={display}>{t}</p>
              <p className="mt-1 text-xs font-bold" style={{ opacity: on ? 0.85 : 0.65 }}>{d}</p>
            </button>
          );
        })}
      </div>
      {teamMode === "squadre" && (
        <div className="mt-3 border-2 px-4 py-3" style={{ borderColor: C.cyan }}>
          <p className="text-sm font-bold" style={{ color: C.cyan }}>Le squadre le fanno loro</p>
          <p className="mt-1 text-sm opacity-80">
            Dal telefono, uno scrive il nome della squadra e la fonda; gli altri la vedono comparire e ci entrano con un tocco.
            Massimo quattro squadre, minimo due persone ciascuna. Si parte quando nessuno è rimasto fuori.
          </p>
        </div>
      )}

      <h3 className="mt-10 text-2xl uppercase" style={display}>Categorie disponibili</h3>
      <p className="mb-3 text-sm opacity-70">Sono quelle tra cui ognuno sceglierà la propria nel primo round.</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {Object.entries(CATS).map(([k, v]) => {
          const on = enabled[k];
          return (
            <button key={k} onClick={() => setEnabled((e) => ({ ...e, [k]: !e[k] }))} className="press border-2 px-3 py-4 text-left"
              style={{ borderColor: v.color, background: on ? v.color : "transparent", color: on ? C.ink : v.color }}>
              <span className="text-lg uppercase" style={display}>{v.name}</span>
              <span className="block text-xs font-bold">{on ? "in gioco" : "spenta"}</span>
            </button>
          );
        })}
      </div>

      <h3 className="mt-10 text-2xl uppercase" style={display}>Come funziona</h3>
      <div className="mt-2 space-y-2 text-sm">
        <p className="border-l-4 pl-3" style={{ borderColor: C.gold }}>
          <b>Round 1 — La tua categoria.</b> Domande classiche: si sceglie dal telefono, chi gioca in casa vale ×2 e gli altri prendono metà punti. Dopo, ogni minigioco ha meccanica e domande tutte sue.
        </p>
        <p className="border-l-4 pl-3" style={{ borderColor: CATS.piccante.color }}>
          <b style={{ color: CATS.piccante.color }}>Piccante</b> <span className="text-xs uppercase opacity-70">eccezione</span> — «Ti conosco bene»: niente domande, si scoprono a vicenda. Chi gioca in casa risponde in segreto a un «o l'uno o l'altro» su di sé, gli altri indovinano cosa ha scelto.
        </p>
        {Object.values(MG).map((m) => (
          <p key={m.name} className="border-l-4 pl-3" style={{ borderColor: m.color }}>
            <b style={{ color: m.color }}>{m.name}.</b> {m.rule}
          </p>
        ))}
        {teamMode === "squadre" && Object.values(TEAM_MG).map((m) => (
          <p key={m.name} className="border-l-4 pl-3" style={{ borderColor: m.color, background: "rgba(255,243,230,.05)" }}>
            <b style={{ color: m.color }}>{m.name}</b> <span className="text-xs uppercase opacity-70">solo a squadre</span> — {m.rule}
          </p>
        ))}
        <p className="text-xs opacity-60">I minigiochi vengono estratti a caso a ogni partita.</p>
        <p className="text-xs opacity-60">Nei round d'azzardo si scommettono soltanto i punti della partita: l'app non prevede denaro, acquisti o premi reali.</p>
      </div>

      <button onClick={() => { sfx.select(); onOpen(); }} disabled={!n} className="press mt-8 w-full py-6 text-4xl uppercase"
        style={{ ...display, background: n ? C.magenta : "rgba(255,243,230,.15)", color: n ? C.cream : "rgba(255,243,230,.4)", boxShadow: n ? `7px 7px 0 ${C.lime}` : "none" }}>
        Apri la stanza
      </button>
    </div>
  );
}

function HostLobby({ room, players, canStart, onStart, err, M, D, T, teamMode, teamsList }) {
  const countRef = useRef(players.length);
  useEffect(() => {
    if (players.length > countRef.current) sfx.join();
    countRef.current = players.length;
  }, [players.length]);
  return (
    <div className="tvin mx-auto max-w-4xl px-6 py-10">
      <p className="text-xs font-bold uppercase tracking-widest" style={{ color: C.lime }}>
        Stanza aperta · {M.label.toLowerCase()} · livello {D.label.toLowerCase()} · {T}s a domanda · {teamMode === "squadre" ? `${teamsList.length || "nessuna"} squadra${teamsList.length === 1 ? "" : "e"} fondate` : "una squadra a testa"} · {M.own} domande per squadra + {M.mgs} minigiochi
      </p>
      <div className="mt-2 flex flex-wrap items-end gap-6">
        <div>
          <p className="text-sm uppercase opacity-70">Codice</p>
          <p className="text-8xl uppercase" style={{ ...display, color: C.gold }}>{room}</p>
        </div>
        <div className="max-w-sm border-l-4 pl-4 text-sm opacity-85" style={{ borderColor: C.magenta }}>
          <p>Sul telefono: apri il link di questa app, scegli <b>Sono un giocatore</b> e digita il codice.</p>
        </div>
      </div>
      <p className="mt-10 text-sm uppercase tracking-widest opacity-70">In collegamento ({players.length})</p>
      {teamMode === "squadre" ? (
        <div className="mt-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {teamsList.map((t) => {
              const mem = players.filter((p) => p.team === t.i);
              const short = mem.length < 2;
              return (
                <div key={t.i} className="border-2 p-3" style={{ borderColor: t.color, opacity: short ? 0.75 : 1 }}>
                  <div className="flex items-baseline justify-between">
                    <p className="text-2xl uppercase" style={{ ...display, color: t.color }}>{t.name}</p>
                    <p className="text-xs font-bold uppercase" style={{ color: short ? C.gold : t.color }}>
                      {mem.length} {mem.length === 1 ? "persona" : "persone"}{short ? " · ne serve un'altra" : ""}
                    </p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {mem.map((p) => <span key={p.id} className="pop px-3 py-1 font-bold" style={{ background: t.color, color: C.ink }}>{p.name}</span>)}
                    {!mem.length && <span className="text-sm opacity-50">vuota</span>}
                  </div>
                </div>
              );
            })}
          </div>
          {!teamsList.length && (
            <p className="border-2 px-4 py-6 text-center text-lg opacity-60" style={{ borderColor: "rgba(255,243,230,.2)" }}>
              Nessuna squadra fondata. Dal telefono: uno scrive il nome e la crea, gli altri ci entrano.
            </p>
          )}
          {players.some((p) => !p.team) && (
            <div className="mt-3 border-2 px-3 py-2" style={{ borderColor: C.gold }}>
              <p className="text-sm" style={{ color: C.gold }}>
                Ancora senza squadra: {players.filter((p) => !p.team).map((p) => p.name).join(", ")}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-3">
          {players.map((p) => <div key={p.id} className="pop px-4 py-3 text-xl font-bold" style={{ background: p.color, color: C.ink }}>{p.name}</div>)}
          {!players.length && <p className="text-lg opacity-50">Nessuno ancora. Il vuoto cosmico.</p>}
        </div>
      )}
      {err && <p className="mt-4 text-sm" style={{ color: C.gold }}>{err}</p>}
      <button onClick={onStart} disabled={!canStart} className="press mt-12 w-full py-6 text-4xl uppercase"
        style={{ ...display, background: canStart ? C.magenta : "rgba(255,243,230,.15)", color: canStart ? C.cream : "rgba(255,243,230,.4)", boxShadow: canStart ? `7px 7px 0 ${C.lime}` : "none" }}>
        Sigla e via
      </button>
      <p className="mt-3 text-center text-xs opacity-50">
        {teamMode === "squadre"
          ? "Ognuno sceglie la squadra dal telefono. Si parte quando ogni squadra ha almeno due persone."
          : `Ogni giocatore è una squadra a sé: adesso siete ${players.length}, quindi ${players.length} squadre.`}
      </p>
    </div>
  );
}

function HostGame({ g, left, T, players, answered, outcome, next, room, err, teamMode, teamsList }) {
  const seenRef = useRef({ key: null, tickAt: null });

  /* suoni: cambio fase/domanda, ed esito (giusto/sbagliato/azzardo/puzzle) */
  useEffect(() => {
    if (!g) return;
    const key = `${g.phase}:${g.rid || ""}`;
    if (seenRef.current.key === key) return;
    seenRef.current.key = key;
    if (["choose", "mgintro", "quiz", "vote", "puzzle", "bet", "azzardo", "spicy"].includes(g.phase)) sfx.whoosh();
    else if (g.phase === "azzardores") { sfx.drumroll(); setTimeout(() => sfx.reveal(), 550); }
    else if (g.phase === "spicyres") { sfx.drumroll(); setTimeout(() => sfx.reveal(), 500); }
    else if (g.phase === "puzzleres") {
      const anyWin = outcome && Object.values(outcome).some((o) => o?.ok);
      (anyWin ? sfx.win : sfx.wrong)();
    } else if (g.phase === "result" || g.phase === "voteres") {
      const vals = outcome ? Object.values(outcome) : [];
      const goodShare = vals.length ? vals.filter((o) => o?.pts > 0).length / vals.length : 0;
      (goodShare >= 0.5 ? sfx.correct : sfx.wrong)();
    }
  }, [g?.phase, g?.rid]); // eslint-disable-line

  /* tick del timer negli ultimi secondi */
  useEffect(() => {
    if (!g || (g.phase !== "quiz" && g.phase !== "vote" && g.phase !== "puzzle" && g.phase !== "spicy")) return;
    const secs = Math.ceil(left);
    if (secs === seenRef.current.tickAt) return;
    seenRef.current.tickAt = secs;
    if (secs > 0 && secs <= 5) (secs === 1 ? sfx.tock : sfx.tick)();
  }, [left, g?.phase]); // eslint-disable-line

  if (!g) return null;
  const cc = g.cat ? CATS[g.cat] : null;
  const mg = g.mg ? MG_ALL[g.mg] : null;
  const accent = mg?.color || cc?.color || C.cream;
  const timed = g.phase === "quiz" || g.phase === "vote";
  const lowTime = timed && left < 5;
  const goNext = () => { sfx.select(); next(); };

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-6">
      <div className="mb-4 flex items-center justify-between text-xs font-bold uppercase tracking-widest">
        <span style={{ color: accent }}>{g.blockLabel} {g.qn ? `· ${g.qn}/${g.qtot}` : ""}</span>
        <span className="opacity-60">{g.diffLabel ? `${g.diffLabel} · ` : ""}Stanza {room}</span>
      </div>

      {g.phase === "choose" && (
        <div className="tvin flex flex-1 flex-col items-center justify-center text-center">
          <p className="text-sm uppercase tracking-widest opacity-60">Sta scegliendo la sua categoria</p>
          <p className="pop glow my-4 text-7xl uppercase" style={{ ...display, color: players.find((p) => p.id === g.chooser)?.color }}>{g.chooserName}</p>
          <div className="flex flex-wrap justify-center gap-2">
            {g.cats.map((k, i) => <span key={k} className="rise-in border-2 px-4 py-2 text-xl uppercase" style={{ ...display, borderColor: CATS[k].color, color: CATS[k].color, animationDelay: `${i * 0.05}s` }}>{CATS[k].name}</span>)}
          </div>
          <p className="mt-6 text-sm opacity-60">Guarda il telefono. E scegli con giudizio: qui vale doppio.</p>
        </div>
      )}

      {g.phase === "mgintro" && (
        <div className="tvin flex flex-1 flex-col items-center justify-center text-center">
          <p className="text-sm uppercase tracking-widest opacity-60">Minigioco</p>
          <p className="pop glow my-4 text-7xl uppercase" style={{ ...display, color: mg.color }}>{mg.name}</p>
          <p className="rise-in max-w-2xl border-2 px-6 py-4 text-xl" style={{ borderColor: mg.color, animationDelay: ".15s" }}>{mg.rule}</p>
        </div>
      )}

      {(g.phase === "azzardo" || g.phase === "azzardores") && (
        <div key={g.phase} className="tvin flex flex-1 flex-col">
          {g.phase === "azzardo" && (
            <div className="mb-4 h-3 w-full" style={{ background: "rgba(255,243,230,.15)" }}>
              <div className="h-3" style={{ width: `${(Math.max(0, left) / AZZ_T) * 100}%`, background: accent, transition: "width .2s linear" }} />
            </div>
          )}
          <span className="mb-4 self-start -rotate-1 px-3 py-1 text-sm font-bold uppercase" style={{ background: accent, color: C.ink }}>{g.blockLabel}</span>

          {g.phase === "azzardo" ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              {g.game === "cavalli" && (
                <div className="w-full space-y-2">
                  {CAVALLI.map((c, i) => (
                    <div key={i} className="gallop flex items-center gap-4 border-2 px-4 py-4" style={{ borderColor: accent, animationDelay: `${i * 0.09}s` }}>
                      <span className="text-4xl" style={{ ...display, color: accent }}>{i + 1}</span>
                      <span className="flex-1 text-3xl uppercase" style={display}>{c.nome}</span>
                      <span className="text-2xl font-bold">quota {c.quota}</span>
                    </div>
                  ))}
                </div>
              )}
              {g.game === "roulette" && (
                <div className="sweep-bar grid w-full grid-cols-7 gap-2">
                  {Array.from({ length: 13 }, (_, n) => (
                    <div key={n} className="flex aspect-square items-center justify-center text-3xl font-bold"
                      style={{ background: n === 0 ? "#2FBF71" : rouColore(n) === "rosso" ? C.magenta : "#1B1226", color: C.cream, border: `2px solid ${C.line || "rgba(255,243,230,.2)"}` }}>{n}</div>
                  ))}
                </div>
              )}
              {g.game === "russa" && (
                <div className="grid w-full grid-cols-3 gap-3">
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <div key={n} className="tick-pulse flex aspect-square items-center justify-center border-4 text-5xl" style={{ ...display, borderColor: accent, color: accent, animationDelay: `${n * 0.1}s`, animationIterationCount: "infinite", animationDuration: "1.4s" }}>{n}</div>
                  ))}
                </div>
              )}
              <p className="mt-6 text-xl opacity-70">Puntate dal telefono. {g.game === "russa" ? "Una casella su sei è quella storta." : "Si punta solo con i punti della partita."}</p>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <p className="text-sm uppercase tracking-widest opacity-60">{g.game === "cavalli" ? "Ha vinto" : g.game === "roulette" ? "È uscito" : "Era carica"}</p>
              <p className="pop my-3 text-8xl uppercase glow" style={{ ...display, color: accent }}>{g.esito.label}</p>
              <p className="text-2xl opacity-80">{g.esito.sub}</p>
              <div className="mt-6 w-full space-y-2">
                {players.map((p, i) => (
                  <div key={p.id} className="rise-in flex items-center gap-3 border-2 px-4 py-3" style={{ borderColor: outcome?.[p.id]?.pts > 0 ? C.lime : "rgba(255,243,230,.15)", animationDelay: `${i * 0.06}s` }}>
                    <span className="flex-1 text-2xl font-bold" style={{ color: p.color }}>{p.name}</span>
                    <span className="text-sm opacity-70">{outcome?.[p.id]?.note}</span>
                    <span className="bump text-2xl font-bold" style={{ color: outcome?.[p.id]?.pts > 0 ? C.lime : C.magenta }}>
                      {outcome?.[p.id]?.pts > 0 ? `+${outcome[p.id].pts}` : outcome?.[p.id]?.pts}
                    </span>
                  </div>
                ))}
              </div>
              <button onClick={goNext} className="press mt-6 w-full py-5 text-3xl uppercase" style={{ ...display, background: C.cream, color: C.ink, boxShadow: `6px 6px 0 ${C.magenta}` }}>
                {g.qn >= g.qtot ? "Verdetto finale" : "Avanti"}
              </button>
            </div>
          )}
        </div>
      )}

      {g.phase === "bet" && (
        <div className="tvin flex flex-1 flex-col items-center justify-center text-center">
          <div className="mb-4 h-3 w-full" style={{ background: "rgba(255,243,230,.15)" }}>
            <div className="h-3" style={{ width: `${(Math.max(0, left) / BET_T) * 100}%`, background: C.magenta, transition: "width .2s linear" }} />
          </div>
          <p className="text-sm uppercase tracking-widest opacity-60">Si punta al buio</p>
          <p className="my-3 text-7xl uppercase glow" style={{ ...display, color: C.magenta }}>Quanto vi giocate?</p>
          <p className="max-w-2xl text-xl opacity-80">La domanda arriva dopo. Giusta: incassate la puntata. Sbagliata: la lasciate sul tavolo.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {players.map((p) => (
              <div key={p.id} className="px-4 py-3 text-xl font-bold"
                style={{ background: answered[p.id] ? p.color : "rgba(255,243,230,.07)", color: answered[p.id] ? C.ink : C.cream }}>
                {p.name} {answered[p.id] ? "· puntato" : `· ${p.score}`}
              </div>
            ))}
          </div>
          <p className="mt-6 text-xs opacity-50">Si gioca solo con i punti della partita. Nessun soldo, mai.</p>
        </div>
      )}

      {(g.phase === "puzzle" || g.phase === "puzzleres") && (
        <div key={g.phase} className="tvin flex flex-1 flex-col">
          {g.phase === "puzzle" && (
            <div className="mb-4 h-3 w-full" style={{ background: "rgba(255,243,230,.15)" }}>
              <div className="h-3" style={{ width: `${(Math.max(0, left) / (g.time || PUZZLE_T)) * 100}%`, background: left < 15 ? C.magenta : C.gold, transition: "width .2s linear" }} />
            </div>
          )}
          <div className="mb-4 flex items-center justify-between">
            <span className="-rotate-1 px-3 py-1 text-sm font-bold uppercase" style={{ background: C.gold, color: C.ink }}>Il pezzo mancante</span>
            <span className="text-4xl font-bold" style={{ color: left < 15 ? C.magenta : C.cream }}>{g.phase === "puzzle" ? Math.ceil(Math.max(0, left)) : "—"}</span>
          </div>

          {g.phase === "puzzle" ? (
            <>
              <p className="text-xl opacity-70">Indizio</p>
              <h2 className="mb-2 text-4xl font-bold leading-tight sm:text-5xl">{g.hint}</h2>
              <p className="mb-6 text-2xl" style={{ color: C.gold }}>{g.wordLen} lettere · sparse tra i vostri telefoni</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {teamsList.map((t) => {
                  const mem = players.filter((p) => p.team === t.i);
                  const done = mem.filter((p) => answered[p.id]).length;
                  const word = mem.some((p) => answered[p.id] === "parola");
                  return (
                    <div key={t.i} className="border-2 p-4" style={{ borderColor: t.color, background: word ? t.color : "transparent", color: word ? C.ink : C.cream }}>
                      <p className="text-3xl uppercase" style={{ ...display, color: word ? C.ink : t.color }}>{t.name}</p>
                      <p className="text-lg font-bold">{word ? "PAROLA INVIATA" : `${done}/${mem.length} puzzle completati`}</p>
                    </div>
                  );
                })}
              </div>
              <p className="mt-6 text-lg opacity-60">Finito il puzzle, ognuno vede le proprie lettere. Poi urlatele forte, ma non troppo.</p>
            </>
          ) : (
            <>
              <p className="text-xl opacity-70">La parola era</p>
              <h2 className="mb-6 text-6xl uppercase" style={display}>
                {g.word.split("").map((ch, i) => (
                  <span key={i} className="pop inline-block" style={{ color: C.gold, animationDelay: `${i * 0.06}s` }}>{ch}</span>
                ))}
              </h2>
              <div className="space-y-2">
                {teamsList.map((t, i) => {
                  const rank = (g.order || []).indexOf(t.i);
                  const mem = players.filter((p) => p.team === t.i);
                  const pts = mem.reduce((s, p) => s + (outcome?.[p.id]?.pts || 0), 0);
                  return (
                    <div key={t.i} className={`rise-in flex items-center gap-3 border-2 px-4 py-3 ${rank === 0 ? "glow" : ""}`} style={{ borderColor: rank === 0 ? t.color : "rgba(255,243,230,.15)", animationDelay: `${i * 0.08}s` }}>
                      <span className="text-3xl" style={{ ...display, color: t.color }}>{rank >= 0 ? rank + 1 : "—"}</span>
                      <span className="flex-1 text-2xl uppercase" style={display}>{t.name}</span>
                      <span className="text-lg opacity-70">{rank >= 0 ? `${Math.round(g.times?.[t.i] || 0)}s` : "non ci sono arrivati"}</span>
                      {pts > 0 && <span className="bump text-2xl font-bold" style={{ color: C.lime }}>+{pts}</span>}
                    </div>
                  );
                })}
              </div>
              <button onClick={goNext} className="press mt-6 w-full py-5 text-3xl uppercase" style={{ ...display, background: C.cream, color: C.ink, boxShadow: `6px 6px 0 ${C.magenta}` }}>
                {g.qn >= g.qtot ? "Verdetto finale" : "Avanti"}
              </button>
            </>
          )}
        </div>
      )}

      {(g.phase === "vote" || g.phase === "voteres") && (
        <div key={g.phase} className="tvin flex flex-1 flex-col">
          {g.phase === "vote" && (
            <div className="mb-4 h-3 w-full" style={{ background: "rgba(255,243,230,.15)" }}>
              <div className="h-3" style={{ width: `${(Math.max(0, left) / T) * 100}%`, background: left < 5 ? C.magenta : C.arancio, transition: "width .2s linear" }} />
            </div>
          )}
          <span className="mb-4 self-start -rotate-1 px-3 py-1 text-sm font-bold uppercase" style={{ background: C.arancio, color: C.ink }}>Chi di voi</span>
          <h2 className="mb-8 text-4xl font-bold leading-tight sm:text-5xl">{g.prompt}</h2>
          {g.phase === "voteres" && outcome && (
            <div className="space-y-2">
              {[...players].sort((a, b) => (outcome[b.id]?.votes || 0) - (outcome[a.id]?.votes || 0)).map((p, i) => (
                <div key={p.id} className={`rise-in flex items-center gap-3 border-2 px-4 py-3 ${outcome[p.id]?.ok ? "glow" : ""}`} style={{ borderColor: outcome[p.id]?.ok ? p.color : "rgba(255,243,230,.15)", animationDelay: `${i * 0.07}s` }}>
                  <span className="flex-1 text-2xl font-bold" style={{ color: p.color }}>{p.name}</span>
                  <span className="text-xl">{outcome[p.id]?.votes || 0} voti</span>
                  {outcome[p.id]?.pts > 0 && <span className="bump text-xl font-bold" style={{ color: C.lime }}>+{outcome[p.id].pts}</span>}
                </div>
              ))}
              <button onClick={goNext} className="press mt-5 w-full py-5 text-3xl uppercase" style={{ ...display, background: C.cream, color: C.ink, boxShadow: `6px 6px 0 ${C.magenta}` }}>Avanti</button>
            </div>
          )}
        </div>
      )}

      {(g.phase === "spicy" || g.phase === "spicyres") && (
        <div key={g.phase} className="tvin flex flex-1 flex-col">
          {g.phase === "spicy" && (
            <div className="mb-4 h-3 w-full" style={{ background: "rgba(255,243,230,.15)" }}>
              <div className={`h-3 ${left < 5 ? "glow" : ""}`} style={{ width: `${(Math.max(0, left) / T) * 100}%`, background: left < 5 ? C.magenta : C.gold, transition: "width .2s linear" }} />
            </div>
          )}
          <span className="mb-2 self-start -rotate-1 px-3 py-1 text-sm font-bold uppercase" style={{ background: C.gold, color: C.ink }}>{g.blockLabel}</span>
          <p className="mb-4 text-sm uppercase tracking-widest opacity-60">Ti conosco bene</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {["a", "b"].map((k) => {
              const picked = g.phase === "spicyres" && g.mine === k;
              return (
                <div key={k} className={`border-2 px-6 py-10 text-center text-2xl font-bold ${picked ? "pop glow" : ""}`}
                  style={{ borderColor: picked ? C.lime : C.gold, background: picked ? C.lime : "rgba(255,243,230,.04)", color: picked ? C.ink : C.cream, opacity: g.phase === "spicyres" && !picked ? 0.4 : 1 }}>
                  {g.confronto[k]}
                </div>
              );
            })}
          </div>
          {g.phase === "spicy" && <p className="mt-4 text-lg opacity-70">{g.teamName || g.ownerName} sceglie di nascosto sul telefono. Gli altri indovinano cosa ha scelto.</p>}
          {g.phase === "spicyres" && outcome && (
            <div className="mt-6">
              <div className="space-y-2">
                {players.filter((p) => p.id !== g.owner).map((p, i) => (
                  <div key={p.id} className={`rise-in flex items-center gap-3 border-2 px-4 py-3 ${outcome[p.id]?.ok ? "glow" : ""}`} style={{ borderColor: outcome[p.id]?.ok ? p.color : "rgba(255,243,230,.15)", animationDelay: `${i * 0.06}s` }}>
                    <span className="flex-1 text-xl font-bold" style={{ color: p.color }}>{p.name}</span>
                    <span className="text-sm opacity-70">{outcome[p.id]?.note}</span>
                    {outcome[p.id]?.pts > 0 && <span className="bump text-xl font-bold" style={{ color: C.lime }}>+{outcome[p.id].pts}</span>}
                  </div>
                ))}
                {(() => {
                  const own = outcome[g.owner];
                  const ownerP = players.find((p) => p.id === g.owner);
                  return (
                    <div className="rise-in flex items-center gap-3 border-2 px-4 py-3" style={{ borderColor: C.gold, animationDelay: `${players.length * 0.06}s` }}>
                      <span className="flex-1 text-xl font-bold" style={{ color: ownerP?.color }}>{ownerP?.name} <span className="text-xs uppercase opacity-70">(la casa)</span></span>
                      <span className="text-sm opacity-70">{own?.note}</span>
                      {own?.pts > 0 && <span className="bump text-xl font-bold" style={{ color: C.lime }}>+{own.pts}</span>}
                    </div>
                  );
                })()}
              </div>
              <button onClick={goNext} className="press mt-5 w-full py-5 text-3xl uppercase" style={{ ...display, background: C.cream, color: C.ink, boxShadow: `6px 6px 0 ${C.magenta}` }}>
                {g.qn >= g.qtot ? "Verdetto finale" : "Avanti"}
              </button>
            </div>
          )}
        </div>
      )}

      {(g.phase === "quiz" || g.phase === "result") && g.q && (
        <div key={`${g.rid}-${g.phase}`} className="tvin flex flex-1 flex-col">
          <div className="mb-4 h-3 w-full" style={{ background: "rgba(255,243,230,.15)" }}>
            <div className="h-3" style={{ width: `${(g.phase === "quiz" ? Math.max(0, left) / T : 0) * 100}%`, background: left < 5 ? C.magenta : accent, transition: "width .2s linear" }} />
          </div>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {cc && <span className="-rotate-1 px-3 py-1 text-sm font-bold uppercase" style={{ background: cc.color, color: C.ink }}>{cc.name}</span>}
              {mg && <span className="px-3 py-1 text-sm font-bold uppercase" style={{ background: mg.color, color: C.ink }}>{mg.name}</span>}
              {g.rule === "own" && <span className="px-3 py-1 text-sm font-bold uppercase" style={{ border: `2px solid ${C.cream}` }}>casa di {g.teamName || g.ownerName} ×2</span>}
              {(g.rule === "staffetta" || g.rule === "intruso") && g.activeNames && (
                <span className={`px-3 py-1 text-sm font-bold uppercase ${lowTime ? "buzzer-hot" : "buzzer-on"}`} style={{ background: C.cream, color: C.ink }}>{g.rule === "staffetta" ? "al buzzer" : "risponde"}: {g.activeNames.join(" · ")}</span>
              )}
            </div>
            <span key={g.phase === "quiz" ? Math.ceil(Math.max(0, left)) : "res"} className={`text-4xl font-bold ${lowTime ? "tick-pulse" : ""}`} style={{ color: left < 5 ? C.magenta : C.cream }}>{g.phase === "quiz" ? Math.ceil(Math.max(0, left)) : "—"}</span>
          </div>

          {g.rule === "enplein" ? (
            <div className="mb-6 border-2 px-6 py-8 text-center" style={{ borderColor: accent }}>
              <p className="text-4xl uppercase" style={{ ...display, color: accent }}>Ognuno la sua domanda</p>
              <p className="mt-2 text-lg opacity-70">Guardate il vostro telefono: nessuno può copiare dal compagno.</p>
              {g.phase === "result" && g.perF && (
                <div className="mt-4 space-y-1 text-left text-sm">
                  {players.map((p) => (
                    <p key={p.id}><b style={{ color: p.color }}>{p.name}</b> — {g.per?.[p.id]?.q} <span className="opacity-60">{g.perF[p.id]}</span></p>
                  ))}
                </div>
              )}
            </div>
          ) : g.kind === "emoji" ? (
            <p className="mb-6 text-center text-8xl">{g.q.q}</p>
          ) : (
            <h2 className="mb-4 text-4xl font-bold leading-tight sm:text-5xl">{g.q.q}</h2>
          )}

          {g.kind === "clue" && (
            <div className="mb-6 space-y-2">
              {g.q.clues.map((cl, i) => {
                const visibile = g.phase === "result" || left <= T - (i * T) / 3;
                return (
                  <div key={i} className={`flex items-center gap-3 border-2 px-4 py-3 text-2xl ${visibile ? "pop" : ""}`}
                    style={{ borderColor: visibile ? accent : "rgba(255,243,230,.15)", opacity: visibile ? 1 : .35 }}>
                    <span className="text-lg font-bold" style={{ color: accent }}>{i + 1}</span>
                    {visibile ? cl : "· · ·"}
                  </div>
                );
              })}
            </div>
          )}

          {g.kind === "num" ? (
            <div className="border-2 px-6 py-8 text-center" style={{ borderColor: accent }}>
              {g.phase === "result" ? (
                <>
                  <p className="text-sm uppercase tracking-widest opacity-60">Il numero esatto era</p>
                  <p className="pop text-7xl" style={{ ...display, color: C.gold }}>{g.q.value} {g.q.unit}</p>
                  <div className="mt-4 flex flex-wrap justify-center gap-3">
                    {players.map((p, i) => (
                      <span key={p.id} className="rise-in px-3 py-1 text-lg font-bold" style={{ background: outcome?.[p.id]?.pts > 0 ? C.lime : "rgba(255,243,230,.08)", color: outcome?.[p.id]?.pts > 0 ? C.ink : C.cream, animationDelay: `${i * 0.05}s` }}>
                        {p.name}: {answered[p.id] ? (outcome?.[p.id]?.note || "") : "niente"}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-3xl opacity-70">Scrivete un numero sul telefono. {g.q.unit ? `In ${g.q.unit}.` : ""}</p>
              )}
            </div>
          ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {g.q.a.map((a, i) => {
              const right = g.phase === "result" && i === g.q.c;
              return (
                <div key={i} className={`flex items-center gap-3 border-2 px-4 py-5 text-xl font-bold ${right ? "pop" : ""}`}
                  style={{ borderColor: right ? C.lime : accent, background: right ? C.lime : g.phase === "result" ? "rgba(255,243,230,.04)" : "rgba(0,0,0,.25)", color: right ? C.ink : C.cream, opacity: g.phase === "result" && !right ? 0.5 : 1 }}>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center text-lg" style={{ background: right ? C.ink : accent, color: right ? C.lime : C.ink }}>{LETTERS[i]}</span>
                  {a}
                </div>
              );
            })}
          </div>
          )}

          {g.phase === "result" && g.spin && (
            <div className="pop mt-6 border-4 px-6 py-5 text-center" style={{ borderColor: C.gold, background: "rgba(255,201,60,.1)" }}>
              <p className="text-xs uppercase tracking-widest" style={{ color: C.gold }}>La ruota si è fermata su</p>
              <p className="glow text-7xl uppercase" style={{ ...display, color: C.gold }}>{g.spin.label}</p>
              <p className="text-lg opacity-80">{g.spin.note}</p>
            </div>
          )}

          {g.phase === "result" && (
            <div className="mt-6">
              <div className="border-2 px-4 py-3" style={{ borderColor: C.gold }}>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: C.gold }}>Lo sapevi</p>
                <p className="mt-1 text-lg opacity-90">{g.q.f}</p>
              </div>
              {outcome && players.some((p) => outcome[p.id]?.pen) && (
                <div className="mt-3 border-2 px-4 py-3" style={{ borderColor: C.magenta }}>
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: C.magenta }}>Penitenze</p>
                  {players.filter((p) => outcome[p.id]?.pen).map((p) => (
                    <p key={p.id} className="mt-1 text-lg"><b style={{ color: p.color }}>{p.name}</b> — {outcome[p.id].pen}</p>
                  ))}
                </div>
              )}
              <button onClick={goNext} className="press mt-5 w-full py-5 text-3xl uppercase" style={{ ...display, background: C.cream, color: C.ink, boxShadow: `6px 6px 0 ${C.magenta}` }}>
                {g.qn >= g.qtot ? "Verdetto finale" : "Avanti"}
              </button>
            </div>
          )}
        </div>
      )}

      {teamMode === "squadre" && (
        <div className="mt-6 flex flex-wrap gap-3">
          {teamsList.map((t) => {
            const tot = players.filter((p) => p.team === t.i).reduce((s, p) => s + p.score, 0);
            return (
              <div key={t.i} className="flex items-center gap-3 px-4 py-2" style={{ background: t.color, color: C.ink }}>
                <span className="text-xl uppercase" style={display}>{t.name}</span>
                <span key={tot} className="bump text-2xl font-bold">{tot}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-8 flex flex-wrap gap-2 border-t pt-4" style={{ borderColor: "rgba(255,243,230,.15)" }}>
        {players.map((p) => {
          const o = outcome?.[p.id];
          const done = answered[p.id];
          const showRes = g.phase === "result" || g.phase === "voteres";
          const active = g.activeIds?.includes(p.id);
          return (
            <div key={p.id} className={`flex items-center gap-2 px-3 py-2 ${active ? (lowTime ? "buzzer-hot" : "buzzer-on") : ""}`}
              style={{
                background: showRes ? (o?.pts > 0 ? C.lime : "rgba(255,243,230,.07)") : done ? p.color : "rgba(255,243,230,.07)",
                color: showRes ? (o?.pts > 0 ? C.ink : C.cream) : done ? C.ink : C.cream,
                outline: p.id === g.owner || p.id === g.chooser ? `2px solid ${C.cream}` : "none",
              }}>
              <span className="font-bold">{p.name}</span>
              <span key={p.score} className="bump text-lg font-bold">{p.score}</span>
              {showRes && o && o.pts !== 0 && <span className="bump text-sm font-bold">{o.pts > 0 ? `+${o.pts}` : o.pts}</span>}
              {showRes && o?.note && <span className="text-xs">{o.note}</span>}
              {timed && done && <span className="pop text-sm font-bold">pronto</span>}
            </div>
          );
        })}
      </div>
      {err && <p className="mt-2 text-xs" style={{ color: C.gold }}>{err}</p>}
    </div>
  );
}

function HostPodio({ rank, teamMode, teamsList, onAgain, onExit }) {
  useEffect(() => { sfx.podium(); }, []);
  const tMeta = (id) => teamsList?.find((t) => t.i === id) || { name: "Squadra", color: C.cream };
  if (teamMode === "squadre") {
    const tot = {};
    rank.forEach((p) => { if (p.team != null) tot[p.team] = (tot[p.team] || 0) + p.score; });
    const tRank = Object.keys(tot).map(Number).sort((a, b) => tot[b] - tot[a]);
    const winT = tRank[0];
    return (
      <div className="tvin mx-auto max-w-3xl px-6 py-10">
        <Confetti />
        <p className="text-sm uppercase tracking-widest" style={{ color: C.lime }}>La squadra della serata</p>
        <h2 className="pop glow my-2 text-7xl uppercase" style={{ ...display, color: tMeta(winT).color }}>{tMeta(winT).name}</h2>
        <div className="rise-in -rotate-1 px-4 py-3" style={{ background: tMeta(winT).color, color: C.ink, animationDelay: ".15s" }}>
          <p className="text-3xl uppercase" style={display}>{tot[winT]} punti</p>
          <p className="text-sm font-bold">{rank.filter((p) => p.team === winT).map((p) => p.name).join(" · ")}</p>
        </div>
        <div className="mt-8 space-y-4">
          {tRank.map((ti, i) => (
            <div key={ti} className="rise-in border-2 p-4" style={{ borderColor: tMeta(ti).color, animationDelay: `${0.2 + i * 0.09}s` }}>
              <div className="flex items-center gap-3">
                <span className="text-4xl" style={{ ...display, color: tMeta(ti).color }}>{i + 1}</span>
                <span className="flex-1 text-2xl uppercase" style={display}>{tMeta(ti).name}</span>
                <span className="text-3xl font-bold">{tot[ti]}</span>
              </div>
              <div className="mt-2 space-y-1">
                {rank.filter((p) => p.team === ti).map((p) => (
                  <p key={p.id} className="text-sm opacity-80">{p.name} — {p.score} punti · {p.right} giuste, {p.wrong} sbagliate</p>
                ))}
              </div>
            </div>
          ))}
        </div>
        <button onClick={onAgain} className="press mt-8 w-full py-5 text-3xl uppercase" style={{ ...display, background: C.lime, color: C.ink, boxShadow: `6px 6px 0 ${C.magenta}` }}>Rivincita</button>
        <button onClick={onExit} className="press mt-3 w-full border-2 py-3 text-sm font-bold uppercase" style={{ borderColor: "rgba(255,243,230,.3)", color: C.cream }}>Chiudi la stanza</button>
      </div>
    );
  }
  const win = rank[0];
  const titolo = win ? TITOLI[(win.right * 3 + win.risk) % TITOLI.length] : TITOLI[0];
  return (
    <div className="tvin mx-auto max-w-3xl px-6 py-10">
      <Confetti />
      <p className="text-sm uppercase tracking-widest" style={{ color: C.lime }}>E il vincitore della serata</p>
      <h2 className="pop glow my-2 text-7xl uppercase" style={{ ...display, color: win?.color }}>{win?.name}</h2>
      <div className="rise-in -rotate-1 px-4 py-3" style={{ background: C.gold, color: C.ink, animationDelay: ".15s" }}>
        <p className="text-3xl uppercase" style={display}>{titolo.t}</p>
        <p className="text-sm font-bold">{titolo.d}</p>
      </div>
      <div className="mt-8 space-y-2">
        {rank.map((p, i) => (
          <div key={p.id} className="rise-in flex items-center gap-4 border-2 px-4 py-3" style={{ borderColor: i === 0 ? p.color : "rgba(255,243,230,.15)", animationDelay: `${0.2 + i * 0.08}s` }}>
            <span className="text-4xl" style={{ ...display, color: p.color }}>{i + 1}</span>
            <div className="flex-1">
              <p className="text-xl font-bold">{p.name}</p>
              <p className="text-xs opacity-60">{p.right} giuste · {p.wrong} sbagliate · {p.risk} rischi</p>
            </div>
            <span className="text-3xl font-bold">{p.score}</span>
          </div>
        ))}
      </div>
      <button onClick={onAgain} className="press mt-8 w-full py-5 text-3xl uppercase" style={{ ...display, background: C.lime, color: C.ink, boxShadow: `6px 6px 0 ${C.magenta}` }}>
        Rivincita, stessi giocatori
      </button>
      <button onClick={onExit} className="press mt-3 w-full border-2 py-3 text-sm font-bold uppercase" style={{ borderColor: "rgba(255,243,230,.3)", color: C.cream }}>
        Chiudi la stanza
      </button>
    </div>
  );
}

/* ---------------- ROUND D'AZZARDO ---------------- */
function AzzardoRound({ s, me, write }) {
  const [pick, setPick] = useState(null);
  const [sent, setSent] = useState(false);
  const punti = me?.score || 0;

  async function manda(bet) {
    if (sent || !pick) return;
    setSent(true);
    await write({ rid: s.rid, pick, bet });
  }

  if (s.game === "russa")
    return (
      <div className="tvin flex flex-1 flex-col">
        <p className="text-3xl uppercase" style={{ ...display, color: C.cyan }}>Scegli una casella</p>
        <p className="mb-3 text-sm opacity-70">Una delle sei è quella storta: chi la apre lascia metà dei suoi punti. Le altre cinque valgono 120.</p>
        <div className="grid flex-1 grid-cols-3 gap-2">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <button key={n} onClick={() => { setPick({ slot: n }); setSent(true); write({ rid: s.rid, pick: { slot: n }, bet: 0 }); }}
              disabled={sent} className={`press flex items-center justify-center text-4xl ${pick?.slot === n ? "bump" : ""}`}
              style={{ ...display, background: sent ? "rgba(255,243,230,.1)" : C.cyan, color: sent ? C.cream : C.ink, boxShadow: sent ? "none" : "5px 5px 0 rgba(0,0,0,.45)" }}>
              {n}
            </button>
          ))}
        </div>
        {sent && <p className="mt-3 text-center text-sm opacity-70">Scelta fatta. Ora si apre.</p>}
      </div>
    );

  return (
    <div className="tvin flex flex-1 flex-col">
      <p className="text-2xl uppercase" style={{ ...display, color: s.game === "cavalli" ? C.lime : C.magenta }}>
        {s.game === "cavalli" ? "Su chi punti?" : "Dove punti?"}
      </p>
      <p className="mb-2 text-xs opacity-60">Hai {punti} punti. Si gioca solo con quelli.</p>

      {s.game === "cavalli" ? (
        <div className="flex flex-col gap-2">
          {(s.cavalli || []).map((c, i) => (
            <button key={i} onClick={() => setPick({ cavallo: i })} disabled={sent}
              className={`press flex items-center justify-between px-4 py-3 text-left ${pick?.cavallo === i ? "bump" : ""}`}
              style={{ background: pick?.cavallo === i ? C.cream : C.lime, color: C.ink, opacity: sent && pick?.cavallo !== i ? .3 : 1 }}>
              <span className="text-xl uppercase" style={display}>{c.nome}</span>
              <span className="text-sm font-bold">quota {c.quota}</span>
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            {["rosso", "nero", "pari", "dispari"].map((k) => (
              <button key={k} onClick={() => setPick({ tipo: k })} disabled={sent}
                className="press px-3 py-3 text-sm font-bold uppercase"
                style={{ background: pick?.tipo === k ? C.cream : k === "rosso" ? C.magenta : k === "nero" ? "#1B1226" : "rgba(255,243,230,.12)", color: pick?.tipo === k ? C.ink : C.cream, border: `2px solid ${C.magenta}` }}>
                {k} <span className="opacity-70">×2</span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs uppercase tracking-widest opacity-60">oppure il numero secco · ×12</p>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {Array.from({ length: 13 }, (_, n) => (
              <button key={n} onClick={() => setPick({ tipo: "num", numero: n })} disabled={sent}
                className="press aspect-square text-lg font-bold"
                style={{ background: pick?.tipo === "num" && pick.numero === n ? C.cream : n === 0 ? "#2FBF71" : rouColore(n) === "rosso" ? C.magenta : "#1B1226", color: pick?.tipo === "num" && pick.numero === n ? C.ink : C.cream }}>
                {n}
              </button>
            ))}
          </div>
        </>
      )}

      <p className="mt-4 text-xs uppercase tracking-widest opacity-60">quanto punti</p>
      <div className="mt-1 grid grid-cols-4 gap-2">
        {[...(s.opts || BET_OPTS), "tutto"].map((o) => {
          const val = o === "tutto" ? Math.max(50, punti) : o;
          return (
            <button key={String(o)} onClick={() => manda(val)} disabled={!pick || sent}
              className="press py-3 text-sm font-bold uppercase"
              style={{ background: !pick || sent ? "rgba(255,243,230,.12)" : C.gold, color: !pick || sent ? "rgba(255,243,230,.4)" : C.ink }}>
              {o === "tutto" ? "tutto" : o}
            </button>
          );
        })}
      </div>
      {!pick && <p className="mt-2 text-center text-xs opacity-60">Prima scegli dove puntare, poi quanto.</p>}
      {sent && <p className="mt-2 text-center text-sm opacity-70">Puntata registrata. Che sia quel che sarà.</p>}
    </div>
  );
}

/* ---------------- PUZZLE SCORREVOLE ---------------- */
function PuzzleRound({ s, id, write }) {
  const N = 3, BLANK = N * N - 1;
  const [tiles, setTiles] = useState(() => scrambleTiles(N, BLANK, 14));
  const [moves, setMoves] = useState(0);
  const [guess, setGuess] = useState("");
  const [sent, setSent] = useState(false);
  const [wrong, setWrong] = useState(false);
  const startRef = useRef(Date.now());
  const doneRef = useRef(false);
  const solved = tiles.every((t, i) => t === i);
  const myLetters = (s.letters || {})[id] || "";
  const target = decW(s.w || "");
  const hue = (id.charCodeAt(0) * 37 + (s.rid || "").length * 53) % 360;

  useEffect(() => {
    if (!solved || doneRef.current) return;
    doneRef.current = true;
    write({ rid: s.rid, puzzleDone: true, elapsed: (Date.now() - startRef.current) / 1000 });
  }, [solved]); // eslint-disable-line

  function tap(i) {
    const bi = tiles.indexOf(BLANK);
    const [r1, c1] = [Math.floor(i / N), i % N];
    const [r2, c2] = [Math.floor(bi / N), bi % N];
    if (Math.abs(r1 - r2) + Math.abs(c1 - c2) !== 1) return;
    const t = [...tiles];
    [t[i], t[bi]] = [t[bi], t[i]];
    setTiles(t);
    setMoves((m) => m + 1);
  }

  async function submit() {
    const g = guess.trim().toUpperCase();
    if (!g) return;
    if (g !== target) { setWrong(true); setTimeout(() => setWrong(false), 1200); return; }
    setSent(true);
    await write({ rid: s.rid, puzzleDone: true, word: true, elapsed: (Date.now() - startRef.current) / 1000 });
  }

  return (
    <div className="tvin flex flex-1 flex-col">
      <p className="text-xs font-bold uppercase" style={{ color: C.gold }}>Il pezzo mancante · {s.wordLen} lettere</p>
      <p className="mb-3 text-base font-bold">{s.hint}</p>

      {!solved ? (
        <>
          <div className="mx-auto grid w-full max-w-xs gap-1" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
            {tiles.map((t, i) => (
              <button key={i} onClick={() => tap(i)} aria-label={`pezzo ${i + 1}`}
                className="press aspect-square w-full"
                style={t === BLANK ? { background: "rgba(255,243,230,.06)" } : {
                  backgroundImage: `conic-gradient(from ${hue}deg at 35% 30%, hsl(${hue},90%,60%), hsl(${(hue + 70) % 360},90%,55%), hsl(${(hue + 160) % 360},85%,60%), hsl(${(hue + 250) % 360},90%,58%), hsl(${hue},90%,60%))`,
                  backgroundSize: "300% 300%",
                  backgroundPosition: `${(t % N) * 50}% ${Math.floor(t / N) * 50}%`,
                  boxShadow: "2px 2px 0 rgba(0,0,0,.5)",
                }} />
            ))}
          </div>
          <p className="mt-3 text-center text-sm opacity-70">Tocca i pezzi vicini al buco per spostarli. Mosse: {moves}</p>
          <p className="mt-1 text-center text-xs opacity-50">Finché non lo completi, le tue lettere restano nascoste. E la squadra ti aspetta.</p>
        </>
      ) : (
        <>
          <p className="text-sm uppercase tracking-widest" style={{ color: C.lime }}>Puzzle completato · le tue lettere</p>
          <div className="my-3 flex flex-wrap justify-center gap-2">
            {myLetters.split("").map((ch, i) => (
              <span key={i} className="pop flex h-16 w-14 items-center justify-center text-4xl" style={{ ...display, background: C.gold, color: C.ink }}>{ch}</span>
            ))}
          </div>
          <p className="mb-2 text-center text-sm opacity-70">Urlale ai compagni, prendete le loro e componete la parola.</p>
          {sent ? (
            <div className="pop glow mt-2 px-4 py-6 text-center" style={{ background: C.lime, color: C.ink }}>
              <p className="text-3xl uppercase" style={display}>Inviata</p>
              <p className="text-sm font-bold">Se siete i primi, sono 300 punti.</p>
            </div>
          ) : (
            <>
              <input value={guess} onChange={(e) => setGuess(e.target.value.toUpperCase().slice(0, 16))} placeholder="LA PAROLA"
                className={`w-full border-2 bg-transparent px-4 py-4 text-center text-3xl font-bold tracking-widest ${wrong ? "shake" : ""}`}
                style={{ borderColor: wrong ? C.magenta : C.gold, color: wrong ? C.magenta : C.cream }} autoCapitalize="characters" />
              <button onClick={submit} className="press mt-3 w-full py-4 text-2xl uppercase"
                style={{ ...display, background: C.gold, color: C.ink, boxShadow: `5px 5px 0 ${C.magenta}` }}>Mandala</button>
              {wrong && <p className="mt-2 text-center text-sm font-bold" style={{ color: C.magenta }}>Non è quella. Riprovate, il tempo corre.</p>}
            </>
          )}
        </>
      )}
    </div>
  );
}


/* ============================================================
   PLAYER
   ============================================================ */
function Player({ onExit }) {
  const [id] = useState(() => {
    try {
      const saved = localStorage.getItem("cultrash:pid");
      if (saved) return saved;
      const fresh = uid();
      localStorage.setItem("cultrash:pid", fresh);
      return fresh;
    } catch (_) { return uid(); }
  });
  const [room, setRoom] = useState("");
  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);
  const [s, setS] = useState(null);
  const [answer, setAnswer] = useState(null);
  const [risk, setRisk] = useState(false);
  const [pendingTeam, setPendingTeam] = useState(null);
  const [newTeam, setNewTeam] = useState("");
  const [bar, setBar] = useState(0);
  const [msg, setMsg] = useState("");
  const [numGuess, setNumGuess] = useState("");
  const [clueStep, setClueStep] = useState(0);
  const [pendAns, setPendAns] = useState(null);
  const startRef = useRef(0), ridRef = useRef(""), riskRef = useRef(false);
  riskRef.current = risk;

  useEffect(() => {
    if (s?.kind !== "clue" || s?.phase !== "quiz") return;
    const T = s.time || 18;
    const t1 = setTimeout(() => setClueStep(1), (T / 3) * 1000);
    const t2 = setTimeout(() => setClueStep(2), ((2 * T) / 3) * 1000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [s?.rid, s?.kind, s?.phase]); // eslint-disable-line

  useEffect(() => {
    if (!joined) return;
    let stop = false;
    const tick = async () => {
      try {
        const r = await storage.get(kState(room), true);
        if (stop) return;
        const st = JSON.parse(r.value);
        setS(st);
        setMsg("");
        if ((st.phase === "quiz" || st.phase === "vote" || st.phase === "choose" || st.phase === "spicy") && st.rid !== ridRef.current) {
          ridRef.current = st.rid;
          startRef.current = Date.now();
          setAnswer(null); setRisk(false); setNumGuess(""); setClueStep(0); setPendAns(null);
          if (st.phase !== "choose") { setBar(100); setTimeout(() => !stop && setBar(0), 60); }
        }
      } catch (_) { setMsg("Sto ricollegando..."); }
    };
    tick();
    const t = setInterval(tick, POLL_PLAYER);
    return () => { stop = true; clearInterval(t); };
  }, [joined, room]);

  async function join() {
    const r = room.trim().toUpperCase();
    if (r.length !== 4 || !name.trim()) return;
    try { await storage.get(kState(r), true); }
    catch (_) { setMsg("Codice non trovato. Controlla lo schermo grande."); return; }
    try {
      let prev = {};
      try { const pr = await storage.get(kPlayer(r, id), true); prev = JSON.parse(pr.value) || {}; } catch (_) {}
      await storage.set(kPlayer(r, id), JSON.stringify({ ...prev, id, name: name.trim().slice(0, 12), joined: Date.now() }), true);
      setRoom(r); setJoined(true);
    } catch (_) { setMsg("Non riesco a entrare. Riprova tra un secondo."); }
  }

  async function write(obj) {
    try { await storage.set(kPlayer(room, id), JSON.stringify({ id, name, ...obj }), true); return true; }
    catch (_) { setMsg("Non inviato. Riprova."); return false; }
  }

  function tapAnswer(i) {
    if (s?.rule === "citazioni") { setPendAns(i); return; }
    sendAnswer(i);
  }
  async function sendAnswer(i, extra = {}) {
    if (answer !== null || s?.phase !== "quiz") return;
    setAnswer(i);
    setPendAns(null);
    const elapsed = (Date.now() - startRef.current) / 1000;
    const ok = await write({ rid: s.rid, answer: i, elapsed, risk: riskRef.current, ...extra });
    if (!ok) setAnswer(null);
  }
  async function sendBet(n) {
    if (answer !== null || s?.phase !== "bet") return;
    setAnswer(n);
    const ok = await write({ rid: s.rid, bet: n });
    if (!ok) setAnswer(null);
  }
  async function sendNum() {
    if (answer !== null || s?.phase !== "quiz" || !numGuess) return;
    setAnswer(Number(numGuess));
    const elapsed = (Date.now() - startRef.current) / 1000;
    const ok = await write({ rid: s.rid, num: Number(numGuess), elapsed });
    if (!ok) setAnswer(null);
  }
  async function sendVote(pid) {
    if (answer !== null || s?.phase !== "vote") return;
    setAnswer(pid);
    const ok = await write({ rid: s.rid, vote: pid });
    if (!ok) setAnswer(null);
  }
  async function sendSpicy(k) {
    if (answer !== null || s?.phase !== "spicy") return;
    setAnswer(k);
    const ok = await write(s.owner === id ? { rid: s.rid, mine: k } : { rid: s.rid, guess: k });
    if (!ok) setAnswer(null);
  }
  async function sendPick(cat) {
    if (answer !== null) return;
    setAnswer(cat);
    const ok = await write({ pickFor: s.rid, pickCat: cat });
    if (!ok) setAnswer(null);
  }
  async function sendTeam(t) {
    setPendingTeam(t);
    await write({ team: t });
  }
  async function createTeam() {
    const nm = newTeam.trim().slice(0, 16);
    if (!nm) return;
    const tid = "sq_" + uid();
    setPendingTeam(tid);
    setNewTeam("");
    await write({ team: tid, teamName: nm });
  }

  if (!joined)
    return (
      <div className="tvin mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
        <button onClick={onExit} className="mb-6 text-xs font-bold uppercase tracking-widest opacity-60">← indietro</button>
        <h2 className="text-5xl uppercase" style={display}>Entra in stanza</h2>
        <p className="mb-6 text-sm opacity-70">Il codice è sullo schermo grande.</p>
        <input value={room} onChange={(e) => setRoom(e.target.value.toUpperCase().slice(0, 4))} placeholder="CODICE"
          className="w-full border-2 bg-transparent px-4 py-4 text-center text-5xl font-bold tracking-widest"
          style={{ borderColor: C.gold, color: C.gold }} inputMode="text" autoCapitalize="characters" />
        <input value={name} onChange={(e) => setName(e.target.value.slice(0, 12))} placeholder="Il tuo nome"
          className="mt-3 w-full border-2 bg-transparent px-4 py-3 text-xl font-bold" style={{ borderColor: "rgba(255,243,230,.3)", color: C.cream }} />
        <button onClick={join} className="press mt-6 w-full py-5 text-3xl uppercase" style={{ ...display, background: C.magenta, color: C.cream, boxShadow: `6px 6px 0 ${C.lime}` }}>Sono pronto</button>
        {msg && <p className="mt-4 text-center text-sm" style={{ color: C.gold }}>{msg}</p>}
      </div>
    );

  const me = s?.players?.find((p) => p.id === id);
  const myTeam = me?.team ?? pendingTeam;
  const myTeamMeta = (s?.teams || []).find((t) => t.i === myTeam);
  const myTeamName = myTeamMeta?.name || null;
  const teamScore = myTeam != null && s?.players ? s.players.filter((p) => p.team === myTeam).reduce((a, p) => a + p.score, 0) : null;
  const myQ = (s?.per && s.per[id]) || s?.q || { q: "", a: [] };
  const benched = (s?.rule === "staffetta" || s?.rule === "intruso") && Array.isArray(s.activeIds) && !s.activeIds.includes(id);
  const mine = s?.res?.[id];
  const cc = s?.cat ? CATS[s.cat] : null;
  const mg = s?.mg ? MG_ALL[s.mg] : null;
  const accent = mg?.color || cc?.color || C.lime;
  const myTurn = s?.phase === "choose" && s.chooser === id;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-5">
      <div className="mb-3 flex items-center justify-between text-xs font-bold uppercase tracking-widest">
        <span style={{ color: myTeamMeta?.color || me?.color || C.lime }}>
          {name}{myTeamName ? ` · ${myTeamName}` : ""}
        </span>
        <span className="opacity-60">{teamScore != null ? `squadra ${teamScore}` : me ? `${me.score} punti` : `stanza ${room}`}</span>
      </div>

      {(!s || s.phase === "lobby") && (
        s?.teamMode === "squadre" ? (
          <div className="tvin flex flex-1 flex-col">
            <p className="text-3xl uppercase" style={{ ...display, color: C.gold }}>Squadre</p>
            <p className="mb-3 text-sm opacity-70">Uno crea la squadra e le dà un nome, gli altri ci entrano. Minimo due per squadra.</p>

            <div className="flex flex-col gap-2">
              {(s.teams || []).map((t) => {
                const mem = (s.players || []).filter((p) => p.team === t.i);
                const on = myTeam === t.i;
                return (
                  <button key={t.i} onClick={() => sendTeam(t.i)} className="press flex flex-col justify-center px-4 py-3 text-left"
                    style={{ background: on ? C.cream : t.color, color: C.ink, boxShadow: on ? "none" : "5px 5px 0 rgba(0,0,0,.45)" }}>
                    <span className="flex items-center justify-between">
                      <span className="text-2xl uppercase" style={display}>{t.name}</span>
                      <span className="text-xs font-bold uppercase">{on ? "ci sei tu" : mem.length ? `entra (${mem.length})` : "entra"}</span>
                    </span>
                    <span className="text-xs font-bold">{mem.length ? mem.map((p) => p.name).join(", ") : "ancora vuota"}</span>
                  </button>
                );
              })}
              {!(s.teams || []).length && <p className="py-4 text-center text-sm opacity-60">Nessuna squadra ancora. Creane una tu.</p>}
            </div>

            {(s.teams || []).length < MAX_TEAMS ? (
              <div className="mt-4 border-2 p-3" style={{ borderColor: C.lime }}>
                <p className="mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: C.lime }}>Crea una nuova squadra</p>
                <input value={newTeam} onChange={(e) => setNewTeam(e.target.value.slice(0, 16))} placeholder="Nome della squadra"
                  className="w-full border-2 bg-transparent px-3 py-3 text-lg font-bold"
                  style={{ borderColor: "rgba(255,243,230,.3)", color: C.cream }} />
                <button onClick={createTeam} disabled={!newTeam.trim()}
                  className="press mt-2 w-full py-3 text-xl uppercase"
                  style={{ ...display, background: newTeam.trim() ? C.lime : "rgba(255,243,230,.15)", color: newTeam.trim() ? C.ink : "rgba(255,243,230,.4)" }}>
                  Fondala
                </button>
              </div>
            ) : (
              <p className="mt-4 text-center text-xs opacity-60">Massimo quattro squadre: entra in una di quelle.</p>
            )}

            {myTeam && <p className="mt-3 text-center text-sm opacity-70">Sei con {myTeamName}. Puoi ancora cambiare idea.</p>}
          </div>
        ) : (
          <div className="tvin flex flex-1 flex-col items-center justify-center text-center">
            <p className="pop glow text-4xl uppercase" style={{ ...display, color: C.lime }}>Sei dentro</p>
            <p className="mt-3 text-sm opacity-70">Guarda lo schermo grande. Si parte a momenti.</p>
          </div>
        )
      )}

      {s?.phase === "choose" && (
        myTurn ? (
          <div className="tvin flex flex-1 flex-col">
            <p className="text-3xl uppercase" style={{ ...display, color: C.gold }}>Scegli la tua categoria</p>
            <p className="mb-3 text-sm opacity-70">Nella tua categoria vali doppio. Ma se sbagli, lo vedono tutti.</p>
            <div className="flex flex-1 flex-col gap-2">
              {s.cats.map((k) => {
                const v = CATS[k];
                const sel = answer === k;
                return (
                  <button key={k} onClick={() => sendPick(k)} disabled={answer !== null}
                    className={`press flex flex-1 items-center px-4 py-4 text-left ${sel ? "bump" : ""}`}
                    style={{ background: sel ? C.cream : v.color, color: C.ink, opacity: answer !== null && !sel ? 0.25 : 1, boxShadow: answer !== null ? "none" : "5px 5px 0 rgba(0,0,0,.45)" }}>
                    <span className="text-2xl uppercase" style={display}>{v.name}</span>
                    <span className="ml-auto text-xs font-bold uppercase">{v.tag}</span>
                  </button>
                );
              })}
            </div>
            {answer && <p className="mt-3 text-center text-sm opacity-70">Scelta fatta. Ora dimostralo.</p>}
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <p className="text-sm uppercase tracking-widest opacity-60">Sta scegliendo</p>
            <p className="text-4xl uppercase" style={{ ...display, color: C.gold }}>{s.chooserName}</p>
            <p className="mt-3 text-sm opacity-70">Tu rispondi lo stesso, ma vali metà punti.</p>
          </div>
        )
      )}

      {s?.phase === "mgintro" && mg && (
        <div className="tvin flex flex-1 flex-col items-center justify-center text-center">
          <p className="text-xs uppercase tracking-widest opacity-60">Minigioco</p>
          <p className="glow text-4xl uppercase" style={{ ...display, color: mg.color }}>{mg.name}</p>
          <p className="mt-4 border-2 px-4 py-3 text-sm" style={{ borderColor: mg.color }}>{mg.rule}</p>
        </div>
      )}

      {s?.phase === "quiz" && s.q && (
        <div className="tvin flex flex-1 flex-col">
          <div className="mb-2 h-2 w-full" style={{ background: "rgba(255,243,230,.15)" }}>
            <div className="h-2" style={{ width: `${bar}%`, background: accent, transition: `width ${s.time || 18}s linear` }} />
          </div>
          <p className="mb-2 text-xs font-bold uppercase" style={{ color: accent }}>
            {mg ? mg.name
              : s.ownerTeam != null
                ? (s.ownerTeam === myTeam ? "CASA VOSTRA · vale ×2" : `Categoria di ${s.teamName} · metà punti`)
                : s.owner === id ? "CASA TUA · vale ×2" : `Categoria di ${s.ownerName} · metà punti`}
          </p>
          {(s.rule === "staffetta" || s.rule === "intruso") && (
            <p className={`mb-2 border-2 px-3 py-2 text-sm font-bold ${benched ? "" : "buzzer-hot"}`} style={{ borderColor: C.arancio, color: benched ? C.cream : C.arancio }}>
              {benched
                ? "Tocca a un compagno: tasti bloccati. Puoi solo urlare."
                : s.rule === "staffetta" ? "Tocca a te. Tutta la squadra dipende da questo." : "Tocca a te. Se lo becchi, i punti vanno a tutta la squadra."}
            </p>
          )}
          {s.rule === "compatti" && <p className="mb-2 text-xs font-bold" style={{ color: C.cyan }}>Nessuna risposta è giusta: conta solo scegliere tutti la stessa. Accordatevi, in fretta.</p>}
          {s.rule === "verofalso" && <p className="mb-2 text-xs font-bold" style={{ color: C.lime }}>Vero o falso. Sbagliare non costa: contano i riflessi.</p>}
          {s.rule === "ruota" && <p className="mb-2 text-xs font-bold" style={{ color: C.gold }}>Rispondi al buio: la ruota decide dopo quanto vale, anche in negativo.</p>}
          {s.rule === "puntata" && <p className="mb-2 text-xs font-bold" style={{ color: C.magenta }}>Hai puntato. Adesso non puoi più tirarti indietro.</p>}

          {s.rule === "enplein" && <p className="mb-2 text-xs font-bold" style={{ color: C.lime }}>Questa domanda è solo tua: i compagni ne hanno una diversa.</p>}
          {s.rule === "trabocchetto" && <p className="mb-2 text-xs font-bold" style={{ color: C.magenta }}>Occhio: la risposta che ti viene per prima è quasi sempre la trappola.</p>}
          {s.rule === "lampo" && <p className="mb-2 text-xs font-bold" style={{ color: C.lime }}>I punti si sciolgono a vista. Sbagliare non costa: spara.</p>}
          {s.rule === "citazioni" && <p className="mb-2 text-xs font-bold" style={{ color: C.cyan }}>Se azzecchi, dopo scegli tu a chi rubare 80 punti.</p>}

          {s.kind === "emoji"
            ? <p className="mb-3 text-center text-6xl">{myQ.q}</p>
            : <p className="mb-3 text-base font-bold leading-snug">{myQ.q}</p>}

          {s.kind === "clue" && (
            <div className="mb-3 space-y-1">
              {s.q.clues.map((cl, i) => {
                const visibile = clueStep >= i;
                return (
                  <p key={i} className="border-2 px-3 py-2 text-sm"
                    style={{ borderColor: visibile ? accent : "rgba(255,243,230,.15)", opacity: visibile ? 1 : .4 }}>
                    <b style={{ color: accent }}>{i + 1}.</b> {visibile ? cl : "ancora nascosto"}
                  </p>
                );
              })}
              <p className="text-xs opacity-60">Più indizi aspetti, meno vale: al primo raddoppia.</p>
            </div>
          )}

          {s.kind === "num" ? (
            <div className="flex flex-1 flex-col justify-center">
              <input value={numGuess} onChange={(e) => setNumGuess(e.target.value.replace(/[^0-9]/g, "").slice(0, 9))}
                inputMode="numeric" placeholder="0" disabled={answer !== null}
                className="w-full border-2 bg-transparent px-4 py-6 text-center text-5xl font-bold"
                style={{ borderColor: C.gold, color: C.cream }} />
              {s.q.unit && <p className="mt-2 text-center text-sm opacity-70">{s.q.unit}</p>}
              <button onClick={() => sendNum()} disabled={answer !== null || !numGuess}
                className="press mt-4 w-full py-5 text-2xl uppercase"
                style={{ ...display, background: answer !== null || !numGuess ? "rgba(255,243,230,.15)" : C.gold, color: answer !== null || !numGuess ? "rgba(255,243,230,.4)" : C.ink }}>
                {answer !== null ? "numero inviato" : "manda il numero"}
              </button>
              <p className="mt-2 text-center text-xs opacity-60">Chi si avvicina di più vince. Chi non risponde perde 50.</p>
            </div>
          ) : (
          <div className="flex flex-1 flex-col gap-3">
            {myQ.a.map((a, i) => {
              const sel = (answer === i) || (pendAns === i), off = ((answer !== null || pendAns !== null) && !sel) || benched;
              return (
                <button key={i} onClick={() => tapAnswer(i)} disabled={answer !== null || pendAns !== null || benched}
                  className={`press flex flex-1 items-center gap-3 px-4 py-4 text-left text-lg font-bold ${sel ? "bump" : ""}`}
                  style={{ background: sel ? C.cream : accent, color: C.ink, opacity: off ? 0.25 : 1, boxShadow: off || sel ? "none" : "5px 5px 0 rgba(0,0,0,.45)" }}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center text-xl" style={{ background: C.ink, color: sel ? C.cream : accent, ...display }}>{LETTERS[i]}</span>
                  {a}
                </button>
              );
            })}
          </div>
          )}
          {pendAns !== null && s.rule === "citazioni" && (
            <div className="mt-3 border-2 p-3" style={{ borderColor: C.cyan }}>
              <p className="mb-2 text-sm font-bold" style={{ color: C.cyan }}>Se hai indovinato, a chi rubi 80 punti?</p>
              <div className="grid grid-cols-2 gap-2">
                {(s.players || []).filter((o) => o.id !== id && (myTeam ? o.team !== myTeam : true)).map((o) => (
                  <button key={o.id} onClick={() => sendAnswer(pendAns, { target: o.id })}
                    className="press px-3 py-3 text-sm font-bold" style={{ background: o.color, color: C.ink }}>
                    {o.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          {(s.rule === "own" || s.rule === "doppio") && (
            <button onClick={() => setRisk((r) => !r)} disabled={answer !== null || pendAns !== null}
              className="press mt-3 w-full border-2 py-3 text-sm font-bold uppercase tracking-wide"
              style={{ borderColor: C.gold, background: risk ? C.gold : "transparent", color: risk ? C.ink : C.gold, opacity: answer !== null ? 0.4 : 1 }}>
              {s.rule === "doppio"
                ? (risk ? "DOPPIO attivo · +200 o −100" : "Vai sul sicuro · +80. Tocca per il doppio")
                : (risk ? "Rischio attivo · ×2, se sbagli −75" : "Attiva rischio ×2")}
            </button>
          )}
          {answer !== null && <p className="mt-2 text-center text-sm opacity-70">Risposta inviata. Ora si soffre.</p>}
        </div>
      )}

      {s?.phase === "bet" && (
        <div className="tvin flex flex-1 flex-col">
          <p className="text-3xl uppercase" style={{ ...display, color: C.magenta }}>Quanto punti?</p>
          <p className="mb-1 text-sm opacity-70">Non hai ancora visto la domanda. Giusta: incassi. Sbagliata: la perdi.</p>
          <p className="mb-3 text-xs opacity-50">Si punta solo coi punti della partita.</p>
          <div className="flex flex-1 flex-col gap-2">
            {[...(s.opts || BET_OPTS), "tutto"].map((o) => {
              const val = o === "tutto" ? Math.max(50, me?.score || 0) : o;
              const sel = answer === val;
              return (
                <button key={String(o)} onClick={() => sendBet(val)} disabled={answer !== null}
                  className="press flex flex-1 items-center justify-between px-4 py-4 text-left"
                  style={{ background: sel ? C.cream : C.magenta, color: C.ink, opacity: answer !== null && !sel ? .25 : 1, boxShadow: answer !== null ? "none" : "5px 5px 0 rgba(0,0,0,.45)" }}>
                  <span className="text-3xl uppercase" style={display}>{o === "tutto" ? "TUTTO" : o}</span>
                  <span className="text-xs font-bold uppercase">{o === "tutto" ? `${val} punti` : "punti"}</span>
                </button>
              );
            })}
          </div>
          {answer !== null && <p className="mt-3 text-center text-sm opacity-70">Puntata registrata. Ora la domanda.</p>}
        </div>
      )}

      {s?.phase === "azzardo" && <AzzardoRound key={s.rid} s={s} me={me} write={write} />}

      {s?.phase === "azzardores" && (
        <div className="tvin flex flex-1 flex-col justify-center text-center">
          <p className="text-xs uppercase tracking-widest opacity-60">{s.game === "cavalli" ? "Ha vinto" : s.game === "roulette" ? "È uscito" : "Era carica"}</p>
          <p className="pop glow my-2 text-5xl uppercase" style={{ ...display, color: C.gold }}>{s.esito.label}</p>
          <div className={`mt-4 px-4 py-5 ${mine?.pts > 0 ? "pop" : "shake"}`} style={{ background: mine?.pts > 0 ? C.lime : C.magenta, color: mine?.pts > 0 ? C.ink : C.cream }}>
            <p className="text-4xl uppercase" style={display}>{mine?.pts > 0 ? `+${mine.pts}` : mine?.pts ?? 0}</p>
            <p className="text-sm font-bold">{mine?.note}</p>
          </div>
        </div>
      )}

      {s?.phase === "puzzle" && <PuzzleRound key={s.rid} s={s} id={id} write={write} />}

      {s?.phase === "puzzleres" && (
        <div className="tvin flex flex-1 flex-col justify-center">
          <div className={`px-4 py-5 text-center ${mine?.pts > 0 ? "pop" : "shake"}`} style={{ background: mine?.pts > 0 ? C.lime : C.magenta, color: mine?.pts > 0 ? C.ink : C.cream }}>
            <p className="text-4xl uppercase" style={display}>{mine?.pts > 0 ? `+${mine.pts}` : "0 punti"}</p>
            <p className="text-sm font-bold">{mine?.note}</p>
          </div>
          <p className="mt-4 text-center text-lg">La parola era <b style={{ color: C.gold }}>{s.word}</b></p>
        </div>
      )}

      {s?.phase === "vote" && (
        <div className="tvin flex flex-1 flex-col">
          <div className="mb-2 h-2 w-full" style={{ background: "rgba(255,243,230,.15)" }}>
            <div className="h-2" style={{ width: `${bar}%`, background: C.arancio, transition: `width ${s.time || 18}s linear` }} />
          </div>
          <p className="mb-1 text-xs font-bold uppercase" style={{ color: C.arancio }}>Chi di voi</p>
          <p className="mb-3 text-base font-bold leading-snug">{s.prompt}</p>
          <div className="flex flex-1 flex-col gap-2">
            {s.players.map((p) => {
              const sel = answer === p.id, off = answer !== null && !sel;
              return (
                <button key={p.id} onClick={() => sendVote(p.id)} disabled={answer !== null}
                  className="press flex flex-1 items-center px-4 py-3 text-left text-lg font-bold"
                  style={{ background: sel ? C.cream : p.color, color: C.ink, opacity: off ? 0.25 : 1, boxShadow: off || sel ? "none" : "5px 5px 0 rgba(0,0,0,.45)" }}>
                  {p.name}{p.id === id && <span className="ml-2 text-xs uppercase">(tu)</span>}
                </button>
              );
            })}
          </div>
          {answer && <p className="mt-2 text-center text-sm opacity-70">Voto espresso. Nessuno lo saprà. Forse.</p>}
        </div>
      )}

      {(s?.phase === "result" || s?.phase === "voteres") && (
        <div key={s.rid} className="tvin flex flex-1 flex-col justify-center">
          <div className={`px-4 py-5 text-center ${mine?.pts > 0 ? "pop" : "shake"}`} style={{ background: mine?.pts > 0 ? C.lime : C.magenta, color: mine?.pts > 0 ? C.ink : C.cream }}>
            <p className="text-4xl uppercase" style={display}>
              {mine ? (mine.pts > 0 ? `+${mine.pts}` : mine.pts < 0 ? `${mine.pts}` : "0 punti") : "niente"}
            </p>
            <p className="text-sm font-bold">
              {s.phase === "voteres"
                ? mine?.ok ? "Il gruppo ha parlato: sei tu." : "Stavolta l'hanno scampata gli altri."
                : mine?.ok ? "Giusta. Che presenza scenica." : mine?.answered ? "Sbagliata. Capita ai migliori." : "Troppo lento."}
            </p>
            {mine?.note && <p className="mt-1 text-xs font-bold uppercase">{mine.note}</p>}
            {s.spin && <p className="mt-1 text-xs font-bold uppercase">ruota: {s.spin.label}</p>}
          </div>
          {mine?.pen && (
            <div className="mt-4 border-4 px-4 py-5" style={{ borderColor: C.gold }}>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: C.gold }}>Penitenza</p>
              <p className="mt-1 text-xl font-bold leading-snug">{mine.pen}</p>
            </div>
          )}
          <p className="mt-6 text-center text-sm opacity-60">Il resto è sullo schermo grande.</p>
        </div>
      )}

      {s?.phase === "spicy" && (
        <div className="tvin flex flex-1 flex-col">
          <div className="mb-2 h-2 w-full" style={{ background: "rgba(255,243,230,.15)" }}>
            <div className="h-2" style={{ width: `${bar}%`, background: C.gold, transition: `width ${s.time || 18}s linear` }} />
          </div>
          <p className="mb-1 text-xs font-bold uppercase" style={{ color: C.gold }}>Ti conosco bene</p>
          <p className="mb-3 text-base font-bold leading-snug">
            {s.owner === id ? "Scegli in segreto. Nessuno lo sa finché non si rivela." : `Cosa avrà scelto ${s.teamName || s.ownerName}?`}
          </p>
          <div className="flex flex-1 flex-col gap-3">
            {["a", "b"].map((k) => {
              const sel = answer === k, off = answer !== null && !sel;
              return (
                <button key={k} onClick={() => sendSpicy(k)} disabled={answer !== null}
                  className={`press flex flex-1 items-center justify-center px-4 py-6 text-center text-xl font-bold ${sel ? "bump" : ""}`}
                  style={{ background: sel ? C.cream : C.gold, color: C.ink, opacity: off ? 0.25 : 1, boxShadow: off || sel ? "none" : "5px 5px 0 rgba(0,0,0,.45)" }}>
                  {s.confronto?.[k]}
                </button>
              );
            })}
          </div>
          {answer && <p className="mt-2 text-center text-sm opacity-70">{s.owner === id ? "Scelto. Vediamo chi ti conosce." : "Detto. Ora si scopre."}</p>}
        </div>
      )}

      {s?.phase === "spicyres" && (
        <div key={s.rid} className="tvin flex flex-1 flex-col justify-center text-center">
          <p className="text-xs uppercase tracking-widest opacity-60">La scelta vera era</p>
          <p className="pop glow my-2 text-2xl font-bold" style={{ color: C.gold }}>{s.confronto?.[s.mine]}</p>
          <div className={`mt-4 px-4 py-5 ${mine?.pts > 0 ? "pop" : "shake"}`} style={{ background: mine?.pts > 0 ? C.lime : "rgba(255,243,230,.08)", color: mine?.pts > 0 ? C.ink : C.cream }}>
            <p className="text-4xl uppercase" style={display}>{mine?.pts > 0 ? `+${mine.pts}` : "0 punti"}</p>
            <p className="text-sm font-bold">{mine?.note}</p>
          </div>
          <p className="mt-6 text-center text-sm opacity-60">Il resto è sullo schermo grande.</p>
        </div>
      )}

      {s?.phase === "podio" && (
        <div className="tvin flex flex-1 flex-col justify-center">
          <p className="text-center text-xs uppercase tracking-widest opacity-60">Classifica finale</p>
          {s.players.map((p, i) => (
            <div key={p.id} className={`rise-in mt-2 flex items-center gap-3 border-2 px-3 py-3 ${p.id === id ? "glow" : ""}`} style={{ borderColor: p.id === id ? p.color : "rgba(255,243,230,.15)", animationDelay: `${i * 0.08}s` }}>
              <span className="text-2xl" style={{ ...display, color: p.color }}>{i + 1}</span>
              <span className="flex-1 font-bold">{p.name}</span>
              <span className="font-bold">{p.score}</span>
            </div>
          ))}
        </div>
      )}

      {msg && <p className="mt-3 text-center text-xs" style={{ color: C.gold }}>{msg}</p>}
    </div>
  );
}
