import { storage } from "./sync";
import { pick, shuffle, kState, kPlayer, pPrefix, code, uid, encW, decW, rouColore, scrambleTiles } from "./game/utils";
import { sfx } from "./game/sound";
import { narrate, stopNarration } from "./game/narrator";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";

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
  rosso: "#FF3B4E", indaco: "#7C4DFF", verde: "#3DDC84",
  flagRed: "#FF1F3D",
};

const CATS = {
  musica: { name: "MUSICA", color: C.lime, tag: "volume alto" },
  sport: { name: "SPORT", color: C.cyan, tag: "da bar" },
  trash: { name: "TRASH", color: C.magenta, tag: "prima serata" },
  cultura: { name: "CULTURA", color: C.arancio, tag: "salotto buono" },
  cibo: { name: "CIBO & CUCINA", color: C.verde, tag: "a tavola" },
  cinema: { name: "CINEMA", color: C.rosso, tag: "luci in sala" },
  gaming: { name: "GAMING", color: C.indaco, tag: "game over" },
  piccante: { name: "PICCANTE", color: C.gold, tag: "dopo le 23" },
};

const MODES = {
  flash: { label: "Flash", t: 14, own: 1, mgs: 3, qmg: 3, desc: "Una domanda a testa, poi 3 minigiochi. Circa 15 minuti." },
  normale: { label: "Normale", t: 18, own: 3, mgs: 7, qmg: 5, desc: "Tre domande a testa, poi 7 minigiochi. Circa mezz'ora." },
  long: { label: "Maratona", t: 22, own: 4, mgs: 10, qmg: 8, desc: "Quattro a testa e 10 minigiochi. Circa un'ora, si finisce che è tardi." },
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

/** Raggruppa i minigiochi individuali in sottosezioni tematiche per la
 *  schermata regole. I minigiochi di squadra (TEAM_MG) restano a parte. */
const MG_GROUPS = [
  { title: "Quiz e trabocchetti", desc: "Domanda, timer, risposta: le fondamenta della serata.", keys: ["verofalso", "indizi", "trabocchetto", "lampo", "citazioni"] },
  { title: "Rischio e azzardo", desc: "Si punta prima di sapere, o si scommette dopo aver risposto.", keys: ["doppio", "puntata", "ruota", "cavalli", "roulette", "russa"] },
  { title: "Indovina e sfida", desc: "Niente crocette: si stima, si duella, si vota.", keys: ["piumeno", "stima", "vote"] },
];

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
  { d: 2, q: "I Måneskin hanno vinto l'Eurovision prima di Sanremo.", v: false, f: "Prima Sanremo 2021, poi l'Eurovision lo stesso anno." },
  { d: 2, q: "Dante ha scritto la Divina Commedia in latino.", v: false, f: "In volgare fiorentino: fu una scelta politica, non solo stilistica." },
  { d: 3, q: "Su Venere un anno dura meno di un giorno.", v: true, f: "Ruota su sé stessa in 243 giorni terrestri, orbita in 225." },
  { d: 2, q: "Il format del Grande Fratello è nato in Italia.", v: false, f: "Olanda, 1999, idea di John de Mol." },
  { d: 3, q: "L'Australia è più estesa della Groenlandia.", v: true, f: "Circa 7,7 milioni di km² contro 2,1." },
  { d: 2, q: "Il Festival di Sanremo si è sempre tenuto all'Ariston.", v: false, f: "Le prime edizioni erano al Casinò municipale." },
  { d: 2, q: "Quincy Jones ha prodotto «Thriller».", v: true, f: "Aveva già prodotto «Off the Wall» per lo stesso Michael Jackson." },
  { d: 3, q: "Casanova è morto a Venezia.", v: false, f: "Morì in Boemia, bibliotecario nel castello di Dux." },
  { d: 2, q: "Il Milan ha vinto più Champions League dell'Inter.", v: true, f: "Sette contro tre." },
  { d: 2, q: "L'ossitocina si libera anche con un semplice abbraccio.", v: true, f: "Per questo la chiamano ormone delle coccole." },
  { d: 2, q: "Wimbledon si gioca sulla terra rossa.", v: false, f: "È l'unico Slam rimasto sull'erba." },
  { d: 3, q: "«Il Gattopardo» fu pubblicato mentre l'autore era in vita.", v: false, f: "Uscì postumo nel 1958, dopo vari rifiuti editoriali." },
  { d: 3, q: "Il Marchese de Sade è morto in manicomio.", v: true, f: "A Charenton, nel 1814, dove continuò a scrivere e a far recitare gli internati." },
  { d: 2, q: "Neil Armstrong e Buzz Aldrin scesero sulla Luna insieme.", v: false, f: "Armstrong per primo, Aldrin circa venti minuti dopo." },
  { d: 2, q: "La capitale dell'Australia è Sydney.", v: false, f: "È Canberra, costruita apposta per mettere pace tra Sydney e Melbourne." },
  { d: 2, q: "Il primo Mondiale di calcio fu vinto dall'Uruguay.", v: true, f: "1930, in casa, contro l'Argentina." },
  { d: 3, q: "Il Colosseo prende il nome da una statua colossale che sorgeva lì vicino.", v: true, f: "Il Colosso di Nerone, alto oltre 30 metri, diede poi il nome all'anfiteatro Flavio." },
  { d: 3, q: "La Torre di Pisa pende fin dalla sua costruzione originale.", v: true, f: "Il terreno cedette già durante i lavori, nel XII secolo: la pendenza è quasi coeva all'edificio." },
  { d: 2, q: "Napoleone era insolitamente basso per l'epoca.", v: false, f: "Era alto circa 1,68 m, nella media francese: il mito nasce da una confusione tra unità di misura." },
  { d: 2, q: "Einstein fu bocciato in matematica a scuola.", v: false, f: "Leggenda urbana: era già tra i migliori della classe in matematica da ragazzo." },
  { d: 2, q: "Gli struzzi nascondono la testa sotto la sabbia quando hanno paura.", v: false, f: "Il mito nasce forse dal gesto di abbassare la testa per girare le uova nel nido." },
  { d: 2, q: "Il miele non scade mai, se conservato correttamente.", v: true, f: "Sono stati trovati vasi di miele ancora commestibile nelle tombe egizie, vecchi di 3000 anni." },
  { d: 2, q: "Le Ferrari sono rosse per un obbligo di regolamento sportivo.", v: false, f: "Il rosso era il colore nazionale assegnato all'Italia nelle gare d'inizio '900, non un obbligo Ferrari." },
  { d: 2, q: "Il Titanic era stato definito «inaffondabile» dalla stampa prima del naufragio.", v: true, f: "Un'espressione poi rimasta tristemente celebre nella storia." },
  { d: 2, q: "La Coca-Cola fu inventata come medicinale.", v: true, f: "Nacque nel 1886 come tonico contro il mal di testa, venduto in farmacia." },
  { d: 2, q: "Van Gogh vendette solo un quadro in vita.", v: true, f: "«La vigna rossa», venduto pochi mesi prima della sua morte." },
  { d: 2, q: "I gatti domestici discendono dai leoni.", v: false, f: "Discendono dal gatto selvatico africano, addomesticato circa 10.000 anni fa." },
  { d: 3, q: "Il Monopoly fu inventato per criticare i monopoli immobiliari.", v: true, f: "Il gioco originale, «The Landlord's Game» del 1904, denunciava la rendita fondiaria." },
  { d: 2, q: "Cleopatra visse più vicina nel tempo alla costruzione delle piramidi che a noi.", v: false, f: "È il contrario: Cleopatra è più vicina a noi nel tempo che alle piramidi, costruite oltre 2000 anni prima di lei." },
  { d: 2, q: "La Grande Muraglia cinese è visibile a occhio nudo dallo spazio.", v: false, f: "Astronauti e agenzie spaziali hanno più volte smentito questo mito diffuso." },
  { d: 3, q: "Il primo SMS della storia diceva «Buon Natale».", v: true, f: "Inviato nel dicembre 1992 da un ingegnere britannico a un collega." },
  { d: 2, q: "Gli squali esistono da prima dei dinosauri.", v: true, f: "Comparvero circa 400 milioni di anni fa, i dinosauri circa 230 milioni di anni fa." },
  { d: 2, q: "Il Partenone di Atene era originariamente dipinto a colori vivaci.", v: true, f: "Oggi lo vediamo bianco, ma i pigmenti residui rivelano colori un tempo sgargianti." },
  { d: 3, q: "L'acqua calda può congelare più in fretta di quella fredda, in certe condizioni.", v: true, f: "È l'«effetto Mpemba», un fenomeno reale e ancora oggetto di studio." },
  { d: 2, q: "Le impronte digitali sono uniche anche nei gemelli identici.", v: true, f: "Nemmeno il DNA identico basta: le impronte si formano da fattori casuali nell'utero." },
  { d: 2, q: "Il primo film sonoro della storia fu «Biancaneve e i sette nani».", v: false, f: "Fu «Il cantante di jazz», 1927: Biancaneve arrivò dieci anni dopo, nel 1937." },
  { d: 2, q: "Il deserto più esteso del mondo è il Sahara.", v: false, f: "Il più esteso è l'Antartide, tecnicamente un deserto polare." },
  { d: 2, q: "La Statua della Libertà fu un regalo della Francia agli Stati Uniti.", v: true, f: "Inaugurata nel 1886, per celebrare il centenario dell'indipendenza americana." },
  { d: 3, q: "Gli antichi romani usavano l'urina per lavare i vestiti.", v: true, f: "L'ammoniaca contenuta serviva da smacchiatore nelle tintorie, le fullonicae." },
  { d: 3, q: "Il primo videogioco della storia fu Pac-Man.", v: false, f: "Tra i primi ci fu «Tennis for Two», 1958, oltre vent'anni prima di Pac-Man." },
  { d: 2, q: "Le zanzare preferiscono pungere chi ha il «sangue dolce».", v: false, f: "Non esiste «sangue dolce»: le attirano CO2 espirata, calore corporeo e odori specifici." },
  { d: 2, q: "Il Big Ben è il nome della campana, non della torre.", v: true, f: "La torre si chiama Elizabeth Tower: Big Ben è il soprannome della campana principale." },
  { d: 2, q: "Napoleone morì in esilio sull'isola di Sant'Elena.", v: true, f: "Un'isola sperduta nell'Atlantico meridionale, dove morì nel 1821." },
  { d: 2, q: "I pinguini vivono anche allo stato naturale nell'emisfero nord.", v: false, f: "Vivono tutti nell'emisfero australe, con piccole eccezioni vicino all'equatore come alle Galápagos." },
  { d: 2, q: "Leonardo da Vinci scriveva da destra a sinistra.", v: true, f: "Scriveva in modo speculare, forse per proteggere i suoi appunti da sguardi indiscreti." },
  { d: 3, q: "Il primo Bancomat della storia fu installato a Londra.", v: true, f: "1967, in una filiale Barclays: il PIN era stampato su carte radioattive per farle riconoscere alla macchina." },
  { d: 3, q: "Il colore originale delle carote era il viola, non l'arancione.", v: true, f: "Le carote arancioni furono selezionate nei Paesi Bassi intorno al XVII secolo." },
  { d: 2, q: "«Amleto» di Shakespeare è ambientato in Italia.", v: false, f: "È ambientato in Danimarca, al castello di Elsinore." },
];

const INDIZI = [
  { d: 2, clues: ["Scrittore italiano del Novecento", "Studiava i segni e i loro significati", "Ha scritto un giallo ambientato in un'abbazia"], a: ["Umberto Eco", "Italo Calvino", "Primo Levi", "Leonardo Sciascia"], c: 0, f: "«Il nome della rosa», 1980: semiotica travestita da thriller." },
  { d: 2, clues: ["Album del 1982", "Il disco più venduto della storia", "Contiene «Billie Jean»"], a: ["Thriller", "Back in Black", "The Wall", "Rumours"], c: 0, f: "Michael Jackson con Quincy Jones alla produzione." },
  { d: 3, clues: ["Corre su due ruote", "Il suo numero è stato ritirato", "Nove titoli mondiali in tutte le classi"], a: ["Valentino Rossi", "Giacomo Agostini", "Max Biaggi", "Marco Simoncelli"], c: 0, f: "Agostini ne ha vinti quindici, ma il 46 è di Rossi." },
  { d: 2, clues: ["Isola greca", "Sorge su una caldera vulcanica", "Case bianche e cupole blu sulle cartoline"], a: ["Santorini", "Creta", "Mykonos", "Rodi"], c: 0, f: "L'eruzione minoica del XVII secolo a.C. le ha dato quella forma." },
  { d: 2, clues: ["Pittrice del Novecento", "Messicana", "Un terzo della sua opera sono autoritratti"], a: ["Frida Kahlo", "Tamara de Lempicka", "Georgia O'Keeffe", "Artemisia Gentileschi"], c: 0, f: "«Dipingo me stessa perché sono sola», diceva." },
  { d: 2, clues: ["Nasce nel 1951", "Si tiene in Liguria", "Dura cinque serate e blocca il paese"], a: ["Il Festival di Sanremo", "Il Festivalbar", "L'Eurovision", "Il Premio Tenco"], c: 0, f: "Le prime edizioni si tenevano al Casinò, non all'Ariston." },
  { d: 3, clues: ["Regista italiano", "Aristocratico milanese", "Ha diretto «Il Gattopardo»"], a: ["Luchino Visconti", "Vittorio De Sica", "Michelangelo Antonioni", "Pier Paolo Pasolini"], c: 0, f: "La scena del ballo gli costò mesi di riprese." },
  { d: 2, clues: ["Ormone", "Lo chiamano delle coccole", "Sale con abbracci e allattamento"], a: ["Ossitocina", "Dopamina", "Serotonina", "Adrenalina"], c: 0, f: "Prodotta dall'ipotalamo, rilasciata dall'ipofisi." },
  { d: 3, clues: ["Strumento a corde", "Ottantotto tasti", "Le corde sono percosse da martelletti"], a: ["Il pianoforte", "Il clavicembalo", "L'arpa", "L'organo"], c: 0, f: "Nel clavicembalo le corde sono pizzicate: per questo non fa piano e forte." },
  { d: 2, clues: ["Fenomeno da telefono", "Nome preso da un fantasma", "Sparire senza spiegazioni"], a: ["Il ghosting", "Il breadcrumbing", "Il catfishing", "Il gaslighting"], c: 0, f: "Il breadcrumbing invece è lasciare briciole d'attenzione per tenerti lì." },
  { d: 2, clues: ["Città italiana", "Prima capitale del Regno", "Casa dei Savoia"], a: ["Torino", "Firenze", "Roma", "Milano"], c: 0, f: "Capitale dal 1861 al 1865, poi Firenze e infine Roma." },
  { d: 3, clues: ["Compositore", "Prete e violinista veneziano", "Insegnava in un orfanotrofio femminile"], a: ["Antonio Vivaldi", "Claudio Monteverdi", "Domenico Scarlatti", "Arcangelo Corelli"], c: 0, f: "Il «prete rosso», per il colore dei capelli." },
  { d: 3, clues: ["Scienziato del XX secolo", "Premio Nobel per la Fisica nel 1921", "La sua formula più famosa è E=mc²"], a: ["Albert Einstein", "Niels Bohr", "Max Planck", "Werner Heisenberg"], c: 0, f: "Il Nobel non fu per la relatività, ma per l'effetto fotoelettrico." },
  { d: 2, clues: ["Pittore olandese", "Si tagliò un orecchio", "Dipinse «Notte stellata»"], a: ["Vincent van Gogh", "Paul Gauguin", "Claude Monet", "Edvard Munch"], c: 0, f: "Vendette un solo quadro in vita, oggi le sue opere valgono decine di milioni." },
  { d: 3, clues: ["Fiume africano", "Il più lungo del mondo", "Attraversa l'Egitto"], a: ["Nilo", "Rio delle Amazzoni", "Congo", "Niger"], c: 0, f: "Per anni si è discusso se fosse più lungo del Rio delle Amazzoni: oggi prevale il Nilo." },
  { d: 3, clues: ["Cantautore genovese", "Ha scritto «La canzone di Marinella»", "Amico e rivale artistico di De André"], a: ["Gino Paoli", "Fabrizio De André", "Luigi Tenco", "Bruno Lauzi"], c: 0, f: "Marinella fu resa celebre anche da Mina, che la interpretò nel 1964." },
  { d: 3, clues: ["Imperatore romano", "Fece costruire il Colosseo", "Della dinastia Flavia"], a: ["Vespasiano", "Nerone", "Traiano", "Adriano"], c: 0, f: "L'opera fu completata dal figlio Tito nell'80 d.C." },
  { d: 2, clues: ["Film del 1994", "Vinse sei premi Oscar", "Tom Hanks corre per tutto il film"], a: ["Forrest Gump", "Rain Man", "Philadelphia", "Cast Away"], c: 0, f: "La celebre panchina delle scene di apertura si trova a Savannah, in Georgia." },
  { d: 2, clues: ["Pianeta del sistema solare", "Ha gli anelli più visibili", "È il secondo per grandezza"], a: ["Saturno", "Giove", "Urano", "Nettuno"], c: 0, f: "Gli anelli sono fatti soprattutto di ghiaccio e polvere di roccia." },
  { d: 2, clues: ["Scrittore russo", "Ha scritto «Delitto e castigo»", "Anche autore de «I fratelli Karamazov»"], a: ["Fëdor Dostoevskij", "Lev Tolstoj", "Anton Čechov", "Nikolaj Gogol'"], c: 0, f: "Da giovane fu condannato a morte, poi graziato all'ultimo momento davanti al plotone." },
  { d: 2, clues: ["Squadra di calcio italiana", "Gioca a San Siro", "Ha vinto sette Champions League"], a: ["Milan", "Inter", "Juventus", "Napoli"], c: 0, f: "Record italiano, secondo solo al Real Madrid nell'albo d'oro." },
  { d: 2, clues: ["Dea della mitologia greca", "Nata dalla testa di Zeus", "Dea della saggezza e della guerra"], a: ["Atena", "Era", "Afrodite", "Artemide"], c: 0, f: "Atene prende il nome proprio da lei, dopo una gara con Poseidone." },
  { d: 3, clues: ["Attrice italiana", "Premio Oscar nel 1962", "Protagonista de «La ciociara»"], a: ["Sophia Loren", "Anna Magnani", "Monica Vitti", "Claudia Cardinale"], c: 0, f: "Prima attrice a vincere un Oscar per un film non in lingua inglese." },
  { d: 3, clues: ["Invenzione dell'Ottocento", "Cambiò le comunicazioni a distanza", "Alexander Graham Bell la brevettò"], a: ["Il telefono", "Il telegrafo", "La radio", "Il fonografo"], c: 0, f: "Il brevetto del 1876 fu conteso per anni con un altro inventore, Antonio Meucci." },
  { d: 2, clues: ["Montagna dell'Himalaya", "La più alta del mondo", "Scalata per la prima volta nel 1953"], a: ["Everest", "K2", "Annapurna", "Kangchenjunga"], c: 0, f: "Edmund Hillary e Tenzing Norgay furono i primi a raggiungerne la vetta." },
  { d: 2, clues: ["Regista americano", "Ha diretto «Lo squalo»", "Anche «E.T.»"], a: ["Steven Spielberg", "George Lucas", "Martin Scorsese", "Francis Ford Coppola"], c: 0, f: "Con «Lo squalo» inventò di fatto il blockbuster estivo moderno." },
  { d: 2, clues: ["Filosofo greco antico", "Maestro di Alessandro Magno", "Allievo di Platone"], a: ["Aristotele", "Socrate", "Platone", "Epicuro"], c: 0, f: "Fondò il Liceo ad Atene, dove insegnava passeggiando coi discepoli." },
  { d: 3, clues: ["Cantante italiana", "Si ritirò dalle scene nel 1978", "Voce di «Grande grande grande»"], a: ["Mina", "Milva", "Ornella Vanoni", "Patty Pravo"], c: 0, f: "Continua a incidere dischi senza mai più esibirsi dal vivo." },
  { d: 2, clues: ["Oceano", "Il più piccolo del mondo", "Si trova intorno al Polo Nord"], a: ["Artico", "Indiano", "Atlantico", "Pacifico"], c: 0, f: "È anche il meno profondo tra gli oceani della Terra." },
  { d: 2, clues: ["Pittore spagnolo", "Fondatore del cubismo", "Dipinse «Guernica»"], a: ["Pablo Picasso", "Salvador Dalí", "Joan Miró", "Diego Rivera"], c: 0, f: "Guernica fu dipinto in poche settimane, per denunciare il bombardamento del 1937." },
  { d: 2, clues: ["Serie TV italiana", "Ambientata negli ambienti della camorra", "Tratta da un romanzo di Roberto Saviano"], a: ["Gomorra", "Romanzo Criminale", "Suburra", "1992"], c: 0, f: "Il romanzo da cui è tratta uscì nel 2006." },
  { d: 2, clues: ["Compositore tedesco", "Divenne sordo in età adulta", "Ha scritto nove sinfonie"], a: ["Ludwig van Beethoven", "Johannes Brahms", "Robert Schumann", "Franz Schubert"], c: 0, f: "Diresse la Nona Sinfonia da sordo, capendo l'applauso solo perché si voltò a guardare." },
  { d: 3, clues: ["Isola italiana", "In eruzione quasi ininterrotta", "Soprannominata «faro del Mediterraneo»"], a: ["Stromboli", "Vulcano", "Ischia", "Lipari"], c: 0, f: "La sua attività costante e visibile di notte le vale quel soprannome." },
  { d: 2, clues: ["Personaggio dei fumetti", "Miliardario e filantropo", "Costruisce un'armatura tecnologica"], a: ["Iron Man", "Batman", "Capitan America", "Thor"], c: 0, f: "Batman è invece un personaggio della DC Comics, non della Marvel." },
  { d: 2, clues: ["Navigatore genovese", "Cercava una rotta per le Indie", "Sbarcò nei Caraibi nel 1492"], a: ["Cristoforo Colombo", "Amerigo Vespucci", "Marco Polo", "Vasco da Gama"], c: 0, f: "Morì convinto di aver raggiunto l'Asia, senza mai sapere di aver trovato un nuovo continente." },
  { d: 2, clues: ["Fenomeno atmosferico", "Nasce dalla rifrazione della luce nelle gocce d'acqua", "Ha sette colori tradizionali"], a: ["L'arcobaleno", "L'aurora boreale", "Il miraggio", "L'alone lunare"], c: 0, f: "Newton fu il primo a scomporre la luce bianca nei sette colori dello spettro." },
];

const PIUMENO = [
  { d: 2, q: "Chi ha vinto più Champions League?", a: ["Milan", "Inter"], c: 0, f: "Sette contro tre." },
  { d: 2, q: "Quale fiume è più lungo?", a: ["Po", "Tevere"], c: 0, f: "652 km contro 405." },
  { d: 2, q: "Cosa è arrivato prima?", a: ["Il primo Sanremo", "La prima TV italiana"], c: 0, f: "Sanremo 1951, le trasmissioni Rai regolari 1954." },
  { d: 2, q: "Quale film è uscito prima?", a: ["Jurassic Park", "Titanic"], c: 0, f: "1993 contro 1997." },
  { d: 2, q: "Chi ha più Palloni d'Oro?", a: ["Messi", "Cristiano Ronaldo"], c: 0, f: "Otto contro cinque." },
  { d: 2, q: "Quale pianeta è più grande?", a: ["Saturno", "Nettuno"], c: 0, f: "Saturno è il secondo del sistema solare, Nettuno il quarto." },
  { d: 2, q: "Quale canzone è più vecchia?", a: ["Volare", "Vita spericolata"], c: 0, f: "1958 contro 1983." },
  { d: 2, q: "Quale paese è più esteso?", a: ["Italia", "Regno Unito"], c: 0, f: "Circa 302.000 km² contro 244.000." },
  { d: 2, q: "Chi è nato prima?", a: ["Freud", "Jung"], c: 0, f: "1856 contro 1875: quasi vent'anni di differenza, e si vede nel loro rapporto." },
  { d: 3, q: "Quale monumento romano è più antico?", a: ["Il Colosseo", "Il Pantheon attuale"], c: 0, f: "Colosseo inaugurato nell'80, il Pantheon di Adriano è del 126." },
  { d: 2, q: "Chi ha venduto più dischi?", a: ["Michael Jackson", "Madonna"], c: 0, f: "Entrambi enormi, ma «Thriller» da solo sposta l'ago." },
  { d: 2, q: "Quale sport è arrivato prima alle Olimpiadi moderne?", a: ["L'atletica", "La pallavolo"], c: 0, f: "Atletica dal 1896, pallavolo solo dal 1964." },
  { d: 2, q: "Quale città ha più abitanti?", a: ["Roma", "Milano"], c: 0, f: "Circa 2,7 milioni contro 1,4 nel solo comune." },
  { d: 3, q: "Quale opera è più antica?", a: ["La Divina Commedia", "Il Decameron"], c: 0, f: "Commedia iniziata intorno al 1307, Decameron intorno al 1349." },
  { d: 2, q: "Quale oceano è più grande?", a: ["Pacifico", "Atlantico"], c: 0, f: "Il Pacifico copre da solo quasi un terzo della superficie terrestre." },
  { d: 2, q: "Tra questi due compositori, chi nacque prima?", a: ["Mozart", "Beethoven"], c: 0, f: "1756 contro 1770: Mozart lo precede di 14 anni." },
  { d: 2, q: "Quale squadra ha vinto più Mondiali di calcio?", a: ["Brasile", "Italia"], c: 0, f: "Cinque titoli contro quattro." },
  { d: 2, q: "Quale libro ha venduto più copie nella storia?", a: ["La Bibbia", "Il Signore degli Anelli"], c: 0, f: "Le stime sulla Bibbia superano i 5 miliardi di copie." },
  { d: 2, q: "Chi ha vinto più Grammy Award?", a: ["Beyoncé", "Adele"], c: 0, f: "Beyoncé ne conta più di 30, il record assoluto." },
  { d: 2, q: "Quale montagna è più alta?", a: ["Everest", "K2"], c: 0, f: "8.849 metri contro 8.611." },
  { d: 3, q: "Quale evento è arrivato prima?", a: ["La caduta del Muro di Berlino", "Lo scioglimento dell'URSS"], c: 0, f: "1989 contro 1991: due anni di differenza." },
  { d: 3, q: "Quale lago è più grande?", a: ["Lago di Garda", "Lago Trasimeno"], c: 0, f: "Il Garda è il più esteso d'Italia, circa 370 km²." },
  { d: 2, q: "Quale invenzione è arrivata prima?", a: ["La radio", "La televisione"], c: 0, f: "La radio si diffonde a inizio '900, la TV solo tra gli anni '30 e '50." },
  { d: 3, q: "Chi ha vinto più Oscar come attrice protagonista, tra queste due?", a: ["Katharine Hepburn", "Meryl Streep"], c: 0, f: "Hepburn ne ha vinti quattro, record assoluto per un singolo premio." },
  { d: 3, q: "Quale animale vive più a lungo, in media?", a: ["La tartaruga delle Galápagos", "L'elefante africano"], c: 0, f: "Le tartarughe giganti possono superare i 150 anni di vita." },
  { d: 2, q: "Quale città ha un'area metropolitana più popolosa?", a: ["Tokyo", "New York"], c: 0, f: "L'area metropolitana di Tokyo supera i 37 milioni di abitanti." },
  { d: 3, q: "Quale pianeta fu scoperto prima?", a: ["Urano", "Nettuno"], c: 0, f: "Urano fu scoperto nel 1781, Nettuno solo nel 1846." },
  { d: 2, q: "Quale film ha incassato di più al box office mondiale?", a: ["Avatar", "Titanic"], c: 0, f: "Avatar resta il campione d'incassi assoluto, davanti a Titanic." },
  { d: 2, q: "Quale paese ha più abitanti?", a: ["India", "Stati Uniti"], c: 0, f: "L'India ha superato la Cina nel 2023 come paese più popoloso al mondo." },
  { d: 3, q: "Chi ha scritto la propria opera più famosa per primo?", a: ["Omero", "Virgilio"], c: 0, f: "L'Iliade precede di secoli l'Eneide, scritta nel I secolo a.C." },
  { d: 2, q: "Quale disco ha venduto di più?", a: ["Thriller di Michael Jackson", "The Dark Side of the Moon dei Pink Floyd"], c: 0, f: "Thriller resta l'album più venduto della storia, con oltre 65 milioni di copie." },
  { d: 2, q: "Quale continente è più esteso?", a: ["Asia", "Africa"], c: 0, f: "L'Asia copre circa 44,5 milioni di km², l'Africa circa 30,3." },
  { d: 2, q: "Chi ha vinto più Wimbledon in singolare maschile?", a: ["Roger Federer", "Novak Djokovic"], c: 0, f: "Federer ne ha vinti otto, record assoluto." },
  { d: 3, q: "Quale opera lirica debuttò prima?", a: ["Il Barbiere di Siviglia", "La Traviata"], c: 0, f: "Rossini la scrisse nel 1816, Verdi arrivò con la Traviata nel 1853." },
  { d: 2, q: "Tra questi due fiumi, qual è il più lungo?", a: ["Rio delle Amazzoni", "Mississippi"], c: 0, f: "Oltre 6.400 km contro circa 3.700." },
  { d: 2, q: "Chi ha più titoli NBA, tra queste due squadre?", a: ["Boston Celtics", "Los Angeles Lakers"], c: 0, f: "I Celtics ne hanno vinti 18, un record che oggi condividono con i Lakers." },
  { d: 3, q: "Quale evento tecnologico è arrivato prima?", a: ["Il primo sito web", "Il primo smartphone touchscreen di massa"], c: 0, f: "Il primo sito web è del 1991, il primo iPhone del 2007." },
  { d: 3, q: "Quale nazione conta più premi Nobel per la letteratura, tra queste due?", a: ["Francia", "Italia"], c: 0, f: "La Francia ne conta il maggior numero assoluto, l'Italia si ferma a sei." },
  { d: 2, q: "Quale pianeta ruota più velocemente su sé stesso?", a: ["Giove", "Terra"], c: 0, f: "Giove compie un giro completo in appena 10 ore, nonostante le sue dimensioni enormi." },
  { d: 3, q: "Quale scoperta scientifica è arrivata prima?", a: ["La penicillina", "La struttura a doppia elica del DNA"], c: 0, f: "La penicillina è del 1928, la struttura del DNA fu descritta nel 1953." },
  { d: 2, q: "Chi ha vinto più scudetti in Serie A, tra queste due squadre?", a: ["Juventus", "Inter"], c: 0, f: "La Juventus ne conta il maggior numero nella storia del campionato italiano." },
  { d: 3, q: "Quale tra questi due sport olimpici esiste da più tempo nel programma?", a: ["Il nuoto", "Il basket"], c: 0, f: "Il nuoto è nel programma olimpico dal 1896, il basket solo dal 1936." },
];

const STIMA = [
  { d: 2, q: "In che anno è caduto il Muro di Berlino?", v: 1989, u: "" , f: "9 novembre 1989, complice anche un annuncio dato male in conferenza stampa." },
  { d: 2, q: "Quanti canti ha in tutto la Divina Commedia?", v: 100, u: "canti", f: "34 Inferno, 33 Purgatorio, 33 Paradiso." },
  { d: 3, q: "Quanti metri misura esattamente una maratona?", v: 42195, u: "metri", f: "La distanza fu fissata a Londra 1908 per arrivare sotto il palco reale." },
  { d: 2, q: "Quanti tasti ha un pianoforte moderno?", v: 88, u: "tasti", f: "52 bianchi e 36 neri." },
  { d: 2, q: "Quante ossa ha in media un adulto?", v: 206, u: "ossa", f: "Da neonati sono oltre 270: molte poi si fondono." },
  { d: 2, q: "A che età è morto Mozart?", v: 35, u: "anni", f: "1791, lasciando il Requiem incompiuto." },
  { d: 2, q: "In che anno è uscito il primo iPhone?", v: 2007, u: "", f: "Presentato a gennaio, in vendita a giugno." },
  { d: 2, q: "Quante edizioni di Sanremo si erano tenute fino al 2025 compreso?", v: 75, u: "edizioni", f: "La prima nel 1951: il Festival ha saltato pochissimi anni." },
  { d: 2, q: "Quanti elementi chimici sono ufficialmente riconosciuti a oggi?", v: 118, u: "elementi", f: "L'ultimo, l'oganesson, è stato riconosciuto nel 2016." },
  { d: 2, q: "Quanti giocatori ci sono in campo in totale in una partita di calcio?", v: 22, u: "giocatori", f: "Undici per parte, portieri compresi." },
  { d: 2, q: "In che anno è nato il primo campionato mondiale di Formula 1?", v: 1950, u: "", f: "Prima gara a Silverstone." },
  { d: 3, q: "Quanti chilometri separa la Terra dalla Luna, in media?", v: 384400, u: "km", f: "La luce ci mette poco più di un secondo." },
  { d: 3, q: "In che anno cade convenzionalmente la fine dell'Impero romano d'Occidente?", v: 476, u: "", f: "Deposizione di Romolo Augustolo, anche se il crollo fu un processo lento." },
  { d: 2, q: "Quanti giorni impiega la Terra a completare un'orbita attorno al Sole?", v: 365, u: "giorni", f: "Per la precisione sono 365 giorni e circa 6 ore, da cui gli anni bisestili." },
  { d: 2, q: "Quanti Mondiali di calcio ha vinto il Brasile?", v: 5, u: "Mondiali", f: "Record assoluto: l'Italia è ferma a quattro." },
  { d: 2, q: "Quanti anni durò la Prima Guerra Mondiale?", v: 4, u: "anni", f: "Dal 1914 al 1918, anche se l'Italia entrò in guerra solo nel 1915." },
  { d: 2, q: "Quanti giocatori di movimento schiera in campo una squadra di calcio, portiere escluso?", v: 10, u: "giocatori", f: "Undici in totale con il portiere." },
  { d: 3, q: "Quanti secondi impiega circa la luce del Sole a raggiungere la Terra?", v: 500, u: "secondi", f: "Circa 8 minuti e 20 secondi: se il Sole si spegnesse ora, ce ne accorgeremmo con questo ritardo." },
  { d: 2, q: "In che anno fu proclamata la Repubblica Italiana?", v: 1946, u: "", f: "Referendum del 2 giugno 1946, dopo il regno dei Savoia." },
  { d: 2, q: "Quanti Paesi fanno parte dell'Unione Europea, oggi?", v: 27, u: "Paesi", f: "Diventati 27 dopo l'uscita del Regno Unito nel 2020." },
  { d: 2, q: "Quanti minuti dura un singolo tempo di una partita di calcio, recupero escluso?", v: 45, u: "minuti", f: "Novanta minuti totali, regola fissata già nel 1866." },
  { d: 2, q: "Quante ore di sonno si raccomandano in media a un adulto?", v: 8, u: "ore", f: "Tra le 7 e le 9 ore, secondo la maggior parte degli esperti." },
  { d: 2, q: "In che anno avvenne lo sbarco sulla Luna dell'Apollo 11?", v: 1969, u: "", f: "20 luglio 1969, con Armstrong e Aldrin." },
  { d: 2, q: "Quanti giocatori compone in campo una squadra di basket?", v: 5, u: "giocatori", f: "Cinque titolari, con una panchina che arriva fino a 12 in totale." },
  { d: 3, q: "Quanti metri quadrati misura circa la Città del Vaticano?", v: 440000, u: "m²", f: "Poco meno di mezzo chilometro quadrato: lo stato più piccolo del mondo." },
  { d: 2, q: "Quanti denti ha in media un adulto, giudizio compresi?", v: 32, u: "denti", f: "Molti però non li sviluppano mai tutti e quattro." },
  { d: 3, q: "In che anno fu introdotta in Europa la stampa a caratteri mobili di Gutenberg?", v: 1450, u: "", f: "Circa il 1450: rivoluzionò la diffusione dei libri in Europa." },
  { d: 3, q: "Quanti chilometri separano Milano da Roma in linea d'aria, circa?", v: 480, u: "km", f: "In auto, seguendo l'autostrada, la distanza reale supera i 570 km." },
  { d: 2, q: "Quante volte batte in media il cuore umano in un minuto, a riposo?", v: 70, u: "battiti", f: "La forbice normale va dai 60 ai 100 battiti al minuto." },
  { d: 2, q: "Quanti anni ha regnato la Regina Elisabetta II del Regno Unito?", v: 70, u: "anni", f: "Dal 1952 al 2022: il regno più lungo della storia britannica." },
  { d: 3, q: "Quanti satelliti naturali ha il pianeta Marte?", v: 2, u: "satelliti", f: "Si chiamano Phobos e Deimos, entrambi piccoli e irregolari." },
  { d: 2, q: "In che anno si tenne la prima edizione dei Giochi Olimpici moderni?", v: 1896, u: "", f: "Ad Atene, con 241 atleti provenienti da 14 nazioni." },
  { d: 3, q: "Quanti giorni dura in media una gravidanza umana dal concepimento?", v: 266, u: "giorni", f: "Circa 38 settimane dal concepimento, o 40 dall'ultima mestruazione, da cui il conto ostetrico." },
  { d: 3, q: "Quanti metri è alta la Statua della Libertà, dalla base al piedistallo fino alla fiaccola?", v: 93, u: "metri", f: "Considerando anche il piedistallo: la sola statua è alta circa 46 metri." },
  { d: 2, q: "In che anno fu abolita la schiavitù negli Stati Uniti?", v: 1865, u: "", f: "Tredicesimo emendamento, alla fine della Guerra Civile americana." },
  { d: 3, q: "Quante lettere ha l'alfabeto italiano di base?", v: 21, u: "lettere", f: "Escludendo J, K, W, X, Y, usate solo in parole di origine straniera." },
];

const EMOJI = [
  { d: 2, q: "👽📞🏠", a: ["E.T.", "Alien", "Interstellar", "Contact"], c: 0, f: "1982, Spielberg." },
  { d: 2, q: "🚢🧊💔", a: ["Titanic", "Poseidon", "The Perfect Storm", "Master and Commander"], c: 0, f: "1997, undici Oscar." },
  { d: 2, q: "🦁👑🌍", a: ["Il Re Leone", "Madagascar", "Jumanji", "Zootropolis"], c: 0, f: "1994, poi rifatto in digitale nel 2019." },
  { d: 2, q: "🔥🏝️💔", a: ["Temptation Island", "L'Isola dei Famosi", "Survivor", "Pechino Express"], c: 0, f: "Il falò di confronto è ormai un genere letterario." },
  { d: 2, q: "💌📺😢", a: ["C'è posta per te", "Uomini e Donne", "Amici", "Verissimo"], c: 0, f: "La busta che si chiude vale più di mille finali." },
  { d: 2, q: "👨‍🍳🔪⏱️", a: ["MasterChef", "Cucine da incubo", "Quattro Ristoranti", "Bake Off"], c: 0, f: "Format britannico del 1990." },
  { d: 2, q: "🎓🏫📻", a: ["Il Collegio", "La Pupa e il Secchione", "Amici", "Il Grande Fratello"], c: 0, f: "Prima edizione ambientata nel 1960." },
  { d: 2, q: "🐟🔍🌊", a: ["Alla ricerca di Nemo", "Lo squalo", "Aquaman", "La Sirenetta"], c: 0, f: "Pixar, 2003." },
  { d: 2, q: "🕷️🕸️🏙️", a: ["Spider-Man", "Ant-Man", "Venom", "Batman"], c: 0, f: "Personaggio nato nel 1962." },
  { d: 2, q: "🎸👑🎤", a: ["Bohemian Rhapsody", "Rocketman", "A Star is Born", "Walk the Line"], c: 0, f: "Biopic sui Queen, 2018." },
  { d: 2, q: "💍🌋🧝", a: ["Il Signore degli Anelli", "Harry Potter", "Le cronache di Narnia", "Il Trono di Spade"], c: 0, f: "Girato interamente in Nuova Zelanda." },
  { d: 3, q: "🎭🇫🇷💰", a: ["Il conte di Montecristo", "I miserabili", "Il fantasma dell'Opera", "Cyrano"], c: 0, f: "Dumas, 1844: vendetta servita fredda in mille pagine." },
  { d: 2, q: "🧙‍♂️⚡🏰", a: ["Harry Potter", "Il Signore degli Anelli", "Merlino", "Le cronache di Narnia"], c: 0, f: "Il primo libro uscì nel 1997, firmato da J.K. Rowling." },
  { d: 2, q: "🦖🏝️🚙", a: ["Jurassic Park", "King Kong", "Godzilla", "L'era glaciale"], c: 0, f: "1993, di Steven Spielberg: rivoluzionò gli effetti speciali con la CGI." },
  { d: 2, q: "👸❄️⛄", a: ["Frozen", "La regina delle nevi", "La Sirenetta", "Encanto"], c: 0, f: "2013, Disney: «Let It Go» divenne un tormentone planetario." },
  { d: 2, q: "🤡🎈🏙️", a: ["It", "Joker", "Batman", "Shutter Island"], c: 0, f: "Tratto dal romanzo di Stephen King, con il pagliaccio Pennywise." },
  { d: 2, q: "🚗💨🏁", a: ["Fast & Furious", "Cars", "Rush", "Ford v Ferrari"], c: 0, f: "Il primo capitolo della saga uscì nel 2001." },
  { d: 2, q: "🕵️‍♂️🔍🇬🇧", a: ["Sherlock Holmes", "Poirot", "James Bond", "Kingsman"], c: 0, f: "Il personaggio di Arthur Conan Doyle debuttò nel 1887." },
  { d: 3, q: "👗👠🏆", a: ["Il diavolo veste Prada", "Sex and the City", "Legalmente bionda", "Pretty Woman"], c: 0, f: "2006, con Meryl Streep nei panni di una temutissima direttrice di moda." },
  { d: 2, q: "🧑‍🚀🌌🛸", a: ["Interstellar", "Gravity", "The Martian", "Star Trek"], c: 0, f: "Diretto da Christopher Nolan, con la colonna sonora di Hans Zimmer." },
  { d: 2, q: "🍫🏭🎩", a: ["La fabbrica di cioccolato", "Hook", "Mary Poppins", "Chitty Chitty Bang Bang"], c: 0, f: "Tratto dal romanzo di Roald Dahl del 1964." },
  { d: 3, q: "🦇🃏🌃", a: ["Batman", "Watchmen", "V per Vendetta", "Sin City"], c: 0, f: "Il personaggio debuttò nei fumetti nel 1939." },
  { d: 2, q: "🏰👑⚔️", a: ["Il Trono di Spade", "Il Signore degli Anelli", "Vikings", "I Medici"], c: 0, f: "Tratta dai romanzi di George R.R. Martin, in onda dal 2011." },
  { d: 2, q: "🎤🇮🇹🌹", a: ["Sanremo", "Amici", "X Factor", "The Voice"], c: 0, f: "Il Festival esiste dal 1951, sempre a fine inverno." },
  { d: 3, q: "🧟‍♂️🚶‍♂️🌆", a: ["The Walking Dead", "World War Z", "28 giorni dopo", "Resident Evil"], c: 0, f: "Tratta dal fumetto omonimo, in onda dal 2010." },
  { d: 2, q: "🎩🐰🃏", a: ["Alice nel paese delle meraviglie", "Il mago di Oz", "Peter Pan", "Mary Poppins"], c: 0, f: "Dal romanzo di Lewis Carroll del 1865." },
  { d: 3, q: "🏎️🔴🐎", a: ["Ferrari", "Cars", "Rush", "Le Mans '66"], c: 0, f: "Il «cavallino rampante» è il simbolo della casa di Maranello dal 1947." },
  { d: 2, q: "🕺🪩🎶", a: ["Saturday Night Fever", "Grease", "La La Land", "Dirty Dancing"], c: 0, f: "1977, con John Travolta: lanciò la moda della disco music nel mondo." },
  { d: 3, q: "🐺🌕😱", a: ["Twilight", "Van Helsing", "Underworld", "Teen Wolf"], c: 0, f: "Saga letteraria di Stephenie Meyer, poi diventata una serie di film." },
  { d: 3, q: "👽🌽🚜", a: ["Signs", "Independence Day", "Arrival", "Men in Black"], c: 0, f: "2002, di M. Night Shyamalan, con Mel Gibson." },
  { d: 2, q: "🥊🇺🇸🏆", a: ["Rocky", "Creed", "Million Dollar Baby", "Raging Bull"], c: 0, f: "1976, con Sylvester Stallone: vinse l'Oscar come miglior film." },
  { d: 3, q: "🧞‍♂️🪔🕌", a: ["Aladdin", "Le mille e una notte", "Sinbad", "Il ladro di Bagdad"], c: 0, f: "Disney, 1992: il genio fu doppiato in originale da Robin Williams." },
  { d: 3, q: "🐭🧀🏰", a: ["Ratatouille", "Cenerentola", "Robin Hood", "Il gatto con gli stivali"], c: 0, f: "Pixar, 2007: ambientato in una cucina parigina." },
  { d: 3, q: "👻🚫👻", a: ["Ghostbusters", "Beetlejuice", "Casper", "La casa"], c: 0, f: "1984, celebre anche per la colonna sonora e la sirena arancione." },
  { d: 3, q: "🦸‍♀️⚡🏛️", a: ["Wonder Woman", "Thor", "Hercules", "300"], c: 0, f: "Personaggio DC Comics del 1941, creato da William Moulton Marston." },
  { d: 3, q: "🎪🦁🎩", a: ["The Greatest Showman", "Dumbo", "Water for Elephants", "Big Fish"], c: 0, f: "2017, musical ispirato liberamente alla figura di P.T. Barnum." },
];

const INTRUSO = [
  { d: 2, q: "Trova l'intruso", a: ["Picasso", "Botticelli", "Raffaello", "Caravaggio"], c: 0, f: "Gli altri tre sono pittori italiani di secoli passati, Picasso è spagnolo del Novecento." },
  { d: 2, q: "Trova l'intruso", a: ["Danubio", "Po", "Adige", "Tevere"], c: 0, f: "Il Danubio non scorre in Italia." },
  { d: 2, q: "Trova l'intruso", a: ["Luna", "Mercurio", "Venere", "Marte"], c: 0, f: "La Luna è un satellite, non un pianeta." },
  { d: 2, q: "Trova l'intruso", a: ["MasterChef", "Sanremo", "Festivalbar", "Eurovision"], c: 0, f: "Gli altri tre sono manifestazioni musicali." },
  { d: 2, q: "Trova l'intruso", a: ["Coppa Davis", "Wimbledon", "Roland Garros", "US Open"], c: 0, f: "La Davis è una competizione a squadre, gli altri sono tornei del Grande Slam." },
  { d: 3, q: "Trova l'intruso", a: ["Darwin", "Freud", "Jung", "Adler"], c: 0, f: "Darwin è un naturalista, gli altri tre vengono dalla psicoanalisi." },
  { d: 3, q: "Trova l'intruso", a: ["Penicillina", "Ossitocina", "Adrenalina", "Cortisolo"], c: 0, f: "La penicillina è un antibiotico, gli altri sono ormoni." },
  { d: 2, q: "Trova l'intruso", a: ["Buffon", "Totti", "Del Piero", "Baggio"], c: 0, f: "Buffon è un portiere, gli altri tre giocavano davanti." },
  { d: 2, q: "Trova l'intruso", a: ["Ciao Darwin", "Uomini e Donne", "Amici", "C'è posta per te"], c: 0, f: "Gli altri tre sono programmi condotti da Maria De Filippi." },
  { d: 2, q: "Trova l'intruso", a: ["Divina Commedia", "Decameron", "Kamasutra", "Delta di Venere"], c: 0, f: "Gli altri tre hanno una fama decisamente più piccante." },
  { d: 2, q: "Trova l'intruso", a: ["Beethoven", "Vivaldi", "Bach", "Händel"], c: 0, f: "Beethoven appartiene al classicismo e al primo romanticismo, gli altri al barocco." },
  { d: 2, q: "Trova l'intruso", a: ["Canberra", "Sydney", "Melbourne", "Perth"], c: 0, f: "Canberra è la capitale, le altre tre no." },
  { d: 3, q: "Trova l'intruso", a: ["Wagner", "Rossini", "Verdi", "Puccini"], c: 0, f: "Wagner è tedesco, gli altri tre sono compositori d'opera italiani." },
  { d: 3, q: "Trova l'intruso", a: ["Marte", "Zeus", "Poseidone", "Ade"], c: 0, f: "Marte è un dio romano, gli altri tre appartengono alla mitologia greca." },
  { d: 2, q: "Trova l'intruso", a: ["Renault", "Ferrari", "Lamborghini", "Maserati"], c: 0, f: "Renault è francese, le altre tre sono case automobilistiche italiane." },
  { d: 3, q: "Trova l'intruso", a: ["Scacchi", "Nuoto", "Atletica", "Ginnastica"], c: 0, f: "Gli scacchi non sono uno sport del programma olimpico, gli altri tre sì fin dalle prime edizioni." },
  { d: 2, q: "Trova l'intruso", a: ["Squalo", "Balena", "Delfino", "Foca"], c: 0, f: "Lo squalo è un pesce, gli altri tre sono mammiferi marini." },
  { d: 2, q: "Trova l'intruso", a: ["Titanic", "Il Padrino", "Scarface", "Quei bravi ragazzi"], c: 0, f: "Titanic non è un film sulla criminalità organizzata, gli altri tre sì." },
  { d: 2, q: "Trova l'intruso", a: ["Champagne", "Prosecco", "Franciacorta", "Asti"], c: 0, f: "Lo Champagne è francese, gli altri tre sono spumanti italiani." },
  { d: 3, q: "Trova l'intruso", a: ["Pascal", "Fahrenheit", "Celsius", "Kelvin"], c: 0, f: "Il pascal misura la pressione, le altre tre sono scale di temperatura." },
  { d: 3, q: "Trova l'intruso", a: ["Monte Bianco", "Everest", "K2", "Kangchenjunga"], c: 0, f: "Il Monte Bianco è in Europa, gli altri tre svettano tra Himalaya e Karakorum, in Asia." },
  { d: 2, q: "Trova l'intruso", a: ["Islanda", "Australia", "Nuova Zelanda", "Figi"], c: 0, f: "L'Islanda è nell'Atlantico del Nord, le altre tre si trovano in Oceania." },
  { d: 2, q: "Trova l'intruso", a: ["Lupo", "Leone", "Tigre", "Giaguaro"], c: 0, f: "Il lupo è un canide, gli altri tre sono grandi felini." },
  { d: 3, q: "Trova l'intruso", a: ["Rembrandt", "Van Gogh", "Monet", "Renoir"], c: 0, f: "Rembrandt è un pittore barocco del Seicento, gli altri tre sono impressionisti dell'Ottocento." },
  { d: 2, q: "Trova l'intruso", a: ["Netflix", "Instagram", "TikTok", "X (Twitter)"], c: 0, f: "Netflix è una piattaforma di streaming, gli altri tre sono social network." },
  { d: 3, q: "Trova l'intruso", a: ["Giappone", "Australia", "Nuova Zelanda", "Figi"], c: 0, f: "Le bandiere di Australia, Nuova Zelanda e Figi contengono la Union Jack britannica, quella del Giappone no." },
  { d: 2, q: "Trova l'intruso", a: ["Serie A", "Champions League", "Europa League", "Conference League"], c: 0, f: "La Serie A è un campionato nazionale, le altre tre sono competizioni europee per club." },
  { d: 2, q: "Trova l'intruso", a: ["Merlo", "Pinguino", "Struzzo", "Kiwi"], c: 0, f: "Il merlo vola, gli altri tre sono uccelli che non volano." },
  { d: 3, q: "Trova l'intruso", a: ["Flauto", "Chitarra", "Violino", "Violoncello"], c: 0, f: "Il flauto è uno strumento a fiato, gli altri tre sono strumenti a corda." },
  { d: 2, q: "Trova l'intruso", a: ["Cyrano de Bergerac", "Amleto", "Otello", "Macbeth"], c: 0, f: "Cyrano de Bergerac non è un'opera di Shakespeare, gli altri tre sì." },
  { d: 2, q: "Trova l'intruso", a: ["Torre Eiffel", "Colosseo", "Pantheon", "Fori Imperiali"], c: 0, f: "La Torre Eiffel è a Parigi, gli altri tre monumenti sono a Roma." },
  { d: 2, q: "Trova l'intruso", a: ["Persiano", "Golden Retriever", "Labrador", "Pastore Tedesco"], c: 0, f: "Il Persiano è una razza di gatto, le altre tre sono razze di cane." },
  { d: 3, q: "Trova l'intruso", a: ["Marte", "Encelado", "Titano", "Europa"], c: 0, f: "Marte è un pianeta, gli altri tre sono lune di Saturno e Giove." },
  { d: 3, q: "Trova l'intruso", a: ["Cina", "Vaticano", "San Marino", "Monaco"], c: 0, f: "La Cina è tra i paesi più estesi al mondo, gli altri tre sono tra i più piccoli." },
  { d: 2, q: "Trova l'intruso", a: ["Couscous", "Sushi", "Paella", "Risotto"], c: 0, f: "Sushi, paella e risotto si preparano con il riso: il couscous è semola di grano." },
  { d: 2, q: "Trova l'intruso", a: ["Antartide", "Asia", "Africa", "Europa"], c: 0, f: "L'Antartide non ha una popolazione stabile né confini nazionali come gli altri continenti abitati." },
];

const LAMPO = [
  { d: 2, q: "Quante corde ha un violino?", a: ["Quattro", "Sei", "Cinque", "Tre"], c: 0, f: "Sol, Re, La, Mi." },
  { d: 2, q: "Di che colore è la maglia del leader al Tour de France?", a: ["Gialla", "Rosa", "Verde", "Bianca"], c: 0, f: "Gialla come la carta del giornale che organizzava la corsa." },
  { d: 2, q: "Qual è il simbolo chimico del sodio?", a: ["Na", "So", "Sd", "S"], c: 0, f: "Dal latino natrium." },
  { d: 2, q: "Quante zampe ha un ragno?", a: ["Otto", "Sei", "Dieci", "Dodici"], c: 0, f: "Gli insetti ne hanno sei: il ragno non è un insetto." },
  { d: 2, q: "Qual è la capitale della Norvegia?", a: ["Oslo", "Bergen", "Stoccolma", "Helsinki"], c: 0, f: "Si chiamava Christiania fino al 1925." },
  { d: 2, q: "Chi ha dipinto la volta della Cappella Sistina?", a: ["Michelangelo", "Raffaello", "Botticelli", "Leonardo"], c: 0, f: "Quattro anni di lavoro, quasi tutti in piedi." },
  { d: 2, q: "Quante carte ha un mazzo da poker senza jolly?", a: ["52", "48", "54", "40"], c: 0, f: "Tredici valori per quattro semi." },
  { d: 3, q: "Quanti gironi ha l'Inferno di Dante?", a: ["Nove", "Sette", "Dodici", "Dieci"], c: 0, f: "L'ultimo è ghiacciato, non infuocato." },
  { d: 2, q: "In quale continente si trova il Perù?", a: ["Sud America", "Centro America", "Asia", "Africa"], c: 0, f: "Capitale Lima, sull'oceano Pacifico." },
  { d: 3, q: "Quanti anni dura il mandato di un presidente degli Stati Uniti?", a: ["Quattro", "Cinque", "Sei", "Sette"], c: 0, f: "Rinnovabile una sola volta dal 1951." },
  { d: 2, q: "Chi ha scritto «Pinocchio»?", a: ["Collodi", "Rodari", "Salgari", "De Amicis"], c: 0, f: "Pseudonimo di Carlo Lorenzini, dal paese della madre." },
  { d: 2, q: "Quanti giocatori ha in campo una squadra di rugby a 15?", a: ["Quindici", "Tredici", "Undici", "Sedici"], c: 0, f: "Il nome del gioco lo dice, ma in tanti sbagliano di fretta." },
  { d: 2, q: "Quanti lati ha un esagono?", a: ["Sei", "Cinque", "Sette", "Otto"], c: 0, f: "Dal greco «hexa», sei." },
  { d: 2, q: "Qual è la capitale del Portogallo?", a: ["Lisbona", "Porto", "Madrid", "Siviglia"], c: 0, f: "Situata alla foce del fiume Tago." },
  { d: 2, q: "Chi ha scritto «I Promessi Sposi»?", a: ["Alessandro Manzoni", "Giovanni Verga", "Ugo Foscolo", "Giacomo Leopardi"], c: 0, f: "Pubblicato in versione definitiva tra il 1840 e il 1842." },
  { d: 2, q: "Quante zampe ha un insetto?", a: ["Sei", "Otto", "Quattro", "Dieci"], c: 0, f: "Per questo il ragno, che ne ha otto, non è un insetto." },
  { d: 2, q: "Quanti satelliti naturali ha la Terra?", a: ["Uno", "Due", "Zero", "Tre"], c: 0, f: "La Luna: l'unico satellite naturale del nostro pianeta." },
  { d: 2, q: "Quante corde ha una chitarra classica?", a: ["Sei", "Quattro", "Otto", "Cinque"], c: 0, f: "Il basso elettrico invece ne ha tipicamente quattro." },
  { d: 2, q: "Qual è il simbolo chimico del ferro?", a: ["Fe", "Fr", "Fi", "Ir"], c: 0, f: "Dal latino «ferrum»." },
  { d: 2, q: "Quante zampe ha un granchio?", a: ["Dieci", "Otto", "Sei", "Dodici"], c: 0, f: "Le ultime due sono spesso trasformate in chele." },
  { d: 3, q: "Quanti continenti ci sono, secondo la classificazione più comune?", a: ["Sette", "Cinque", "Sei", "Otto"], c: 0, f: "Europa, Asia, Africa, Nord America, Sud America, Oceania e Antartide." },
  { d: 2, q: "In quale nazione si trova la Torre di Pisa?", a: ["Italia", "Francia", "Spagna", "Grecia"], c: 0, f: "Si trova in Piazza dei Miracoli, accanto al Duomo." },
  { d: 2, q: "Quanti giorni ha febbraio in un anno bisestile?", a: ["29", "28", "30", "31"], c: 0, f: "Succede ogni quattro anni, con qualche eccezione sui secoli." },
  { d: 2, q: "Qual è l'oceano più esteso del pianeta?", a: ["Pacifico", "Atlantico", "Indiano", "Artico"], c: 0, f: "Copre da solo quasi un terzo della superficie terrestre." },
  { d: 2, q: "Chi ha composto «Le nozze di Figaro»?", a: ["Mozart", "Rossini", "Verdi", "Puccini"], c: 0, f: "1786, su libretto di Lorenzo Da Ponte." },
  { d: 3, q: "Quante ore dura circa un giorno solare medio?", a: ["24", "23", "25", "20"], c: 0, f: "Per la precisione la Terra impiega circa 23 ore e 56 minuti a ruotare su sé stessa." },
  { d: 2, q: "Qual è la lingua ufficiale del Brasile?", a: ["Portoghese", "Spagnolo", "Italiano", "Francese"], c: 0, f: "Unico grande paese sudamericano di lingua portoghese, per via della colonizzazione." },
  { d: 2, q: "Quanti denti da latte ha in genere un bambino?", a: ["20", "24", "28", "32"], c: 0, f: "Iniziano a cadere intorno ai sei anni, sostituiti dai denti permanenti." },
  { d: 2, q: "Chi ha scritto «Orgoglio e pregiudizio»?", a: ["Jane Austen", "Charlotte Brontë", "Virginia Woolf", "Emily Dickinson"], c: 0, f: "Pubblicato nel 1813, inizialmente in forma anonima." },
  { d: 3, q: "Quante strisce ha la bandiera degli Stati Uniti?", a: ["13", "50", "12", "24"], c: 0, f: "Rappresentano le tredici colonie originarie; le 50 stelle sono per gli stati attuali." },
  { d: 3, q: "Qual è il metallo più leggero conosciuto?", a: ["Litio", "Ferro", "Alluminio", "Piombo"], c: 0, f: "Così leggero da galleggiare sull'acqua, se non reagisse violentemente con essa." },
  { d: 2, q: "In quale città si trova il Cremlino?", a: ["Mosca", "San Pietroburgo", "Kiev", "Minsk"], c: 0, f: "Complesso fortificato nel cuore della capitale russa, sede del potere politico." },
  { d: 2, q: "Quanti minuti ha un'ora?", a: ["60", "100", "30", "90"], c: 0, f: "La suddivisione in 60 risale ai sistemi numerici babilonesi." },
  { d: 3, q: "Quante camere ha il Parlamento italiano?", a: ["Due", "Una", "Tre", "Quattro"], c: 0, f: "Camera dei Deputati e Senato della Repubblica, con poteri quasi identici." },
  { d: 3, q: "Qual è il fiume più lungo d'Europa?", a: ["Volga", "Danubio", "Reno", "Po"], c: 0, f: "Scorre quasi interamente in territorio russo." },
  { d: 3, q: "Quanti tasti neri ci sono in un'ottava del pianoforte?", a: ["Cinque", "Sette", "Quattro", "Sei"], c: 0, f: "Contro i sette tasti bianchi della stessa ottava." },
];

const TRABOCCHETTI = [
  { d: 2, q: "Quanti animali di ogni specie portò Mosè sull'arca?", a: ["Nessuno", "Due", "Sette", "Uno"], c: 0, f: "L'arca era di Noè. Mosè c'entra niente." },
  { d: 2, q: "In una corsa superi il secondo: in che posizione sei?", a: ["Secondo", "Primo", "Terzo", "Dipende"], c: 0, f: "Prendi il suo posto, non quello di chi comanda." },
  { d: 2, q: "Un aereo precipita sul confine: dove si seppelliscono i superstiti?", a: ["Da nessuna parte", "Nel primo paese", "Nel secondo", "Dove decide la famiglia"], c: 0, f: "I superstiti sono vivi." },
  { d: 2, q: "Quanti mesi dell'anno hanno 28 giorni?", a: ["Dodici", "Uno", "Due", "Nessuno"], c: 0, f: "Tutti ne hanno almeno 28." },
  { d: 2, q: "Di che colore è la «scatola nera» di un aereo?", a: ["Arancione", "Nera", "Rossa", "Grigia"], c: 0, f: "Arancione acceso, per ritrovarla tra i rottami." },
  { d: 2, q: "Il Mar Morto è un mare?", a: ["No, è un lago", "Sì", "È un golfo", "È un fiume salato"], c: 0, f: "Lago salato senza sbocchi: per questo è così denso." },
  { d: 2, q: "Il pomodoro è un frutto o una verdura?", a: ["Un frutto", "Una verdura", "Un tubero", "Un legume"], c: 0, f: "Botanicamente è una bacca. In cucina fate come volete." },
  { d: 2, q: "Quante volte al giorno le lancette di un orologio si sovrappongono?", a: ["22", "24", "12", "48"], c: 0, f: "Undici volte ogni dodici ore, non dodici." },
  { d: 2, q: "Quale isola è più grande?", a: ["La Sicilia", "La Sardegna", "Sono uguali", "Corsica"], c: 0, f: "Circa 25.700 km² contro 24.000." },
  { d: 2, q: "Se accendi un fiammifero in una stanza buia con candela, lampada e stufa, cosa accendi per primo?", a: ["Il fiammifero", "La candela", "La lampada", "La stufa"], c: 0, f: "Senza fiammifero acceso non accendi niente." },
  { d: 2, q: "Se in una gara superi l'ultimo classificato, che posizione occupi?", a: ["È impossibile: dietro l'ultimo non c'è nessuno da superare", "Penultimo", "Ultimo", "Primo"], c: 0, f: "Un classico controsenso logico." },
  { d: 2, q: "Quanti mesi dell'anno hanno esattamente 30 giorni?", a: ["Quattro", "Sette", "Dodici", "Uno"], c: 0, f: "Aprile, giugno, settembre e novembre: gli altri ne hanno 31, o 28/29 per febbraio." },
  { d: 2, q: "Un uomo vive al ventesimo piano, scende sempre in ascensore fino a terra, ma per tornare sale solo fino al decimo e fa le scale — tranne quando piove. Perché?", a: ["È basso e da terra riesce a premere solo il tasto del decimo piano", "Fa ginnastica", "L'ascensore è guasto sopra il decimo", "Vuole risparmiare energia"], c: 0, f: "Nei giorni di pioggia usa l'ombrello per premere i pulsanti più alti." },
  { d: 3, q: "Hai in mano due monete che fanno insieme 30 centesimi, e una delle due NON è da 5 centesimi: quali sono?", a: ["Una da 25 e una da 5 (solo una delle due non è da 5)", "Due da 15", "Una da 20 e una da 10", "Una da 30 e una da 0"], c: 0, f: "La trappola è pensare che nessuna delle due sia da 5 centesimi." },
  { d: 2, q: "Quanti animali «impuri», secondo il racconto biblico, portò Noè sull'arca per ogni specie?", a: ["Due", "Sette", "Uno", "Quattro"], c: 0, f: "Delle specie «pure» ne portò invece sette coppie, secondo il racconto della Genesi." },
  { d: 3, q: "Quante volte puoi sottrarre 5 dal numero 25?", a: ["Una sola volta: dopo diventa 20, non più 25", "Cinque volte", "Venti volte", "Zero volte"], c: 0, f: "Dopo la prima sottrazione il numero di partenza non è più 25." },
  { d: 3, q: "Il padre di un uomo ha cinque figli: Uno, Due, Tre, Quattro e...?", a: ["Il quinto è l'uomo di cui si parlava all'inizio della domanda", "Cinque", "Sei", "Zero"], c: 0, f: "La domanda parla già di «un uomo»: è lui stesso il quinto figlio." },
  { d: 3, q: "Quanti quadrati si contano in totale su una scacchiera, includendo quelli formati da più caselle insieme?", a: ["204", "64", "100", "32"], c: 0, f: "Sommando i quadrati di ogni dimensione, da 1x1 a 8x8, si arriva a 204." },
  { d: 2, q: "Cosa pesa di più: un chilo di piume o un chilo di ferro?", a: ["Pesano uguale: un chilo è un chilo", "Il ferro", "Le piume", "Dipende dalla bilancia"], c: 0, f: "Il volume cambia, il peso no: un chilo resta un chilo." },
  { d: 3, q: "Un campo si riempie di grano raddoppiando ogni giorno e impiega 30 giorni a riempirsi del tutto: dopo quanti giorni era pieno a metà?", a: ["Al ventinovesimo giorno", "Al quindicesimo giorno", "Al ventesimo giorno", "Al venticinquesimo giorno"], c: 0, f: "Raddoppiando ogni giorno, il giorno prima dell'ultimo il campo è necessariamente pieno solo a metà." },
  { d: 2, q: "In quale mese, secondo un vecchio gioco di parole, «si mangia meno»?", a: ["A febbraio, perché ha meno giorni", "A dicembre", "Ad agosto", "Non cambia mai"], c: 0, f: "«Meno giorni» non significa affatto «meno cibo a pasto», ma la battuta funziona lo stesso." },
  { d: 2, q: "Quanti bicchieri d'acqua puoi bere «a stomaco vuoto», al massimo?", a: ["Uno solo: dopo il primo sorso lo stomaco non è più vuoto", "Due", "Tre", "Nessuno"], c: 0, f: "Un classico paradosso semantico sul significato letterale delle parole." },
  { d: 3, q: "Due padri e due figli vanno a pescare e portano a casa in tutto tre pesci, uno a testa: com'è possibile?", a: ["Sono nonno, padre e figlio: solo tre persone in tutto", "Hanno pescato in due laghi diversi", "Uno dei pesci era finto", "Hanno barato"], c: 0, f: "«Due padri e due figli» descrive tre persone quando c'è di mezzo un nonno." },
  { d: 2, q: "In una gara di canottaggio a 8 concorrenti, se superi il settimo classificato, in che posizione arrivi?", a: ["Settimo: prendi il suo posto, non quello di chi ti precede ancora", "Ottavo", "Sesto", "Primo"], c: 0, f: "Superi solo la persona che ti precedeva direttamente." },
  { d: 3, q: "Un cameriere deve servire 10 piatti con un vassoio che ne porta al massimo 3 alla volta: quanti viaggi in cucina gli servono come minimo?", a: ["Quattro viaggi (3+3+3+1)", "Tre viaggi", "Dieci viaggi", "Cinque viaggi"], c: 0, f: "Con un resto da gestire, l'ultimo viaggio porta solo il piatto rimasto." },
  { d: 3, q: "Se oggi è lunedì, che giorno della settimana sarà tra 100 giorni?", a: ["Mercoledì", "Martedì", "Giovedì", "Venerdì"], c: 0, f: "100 diviso 7 dà resto 2: da lunedì si contano due giorni in avanti." },
  { d: 2, q: "Quanti lati ha, in geometria classica, un cerchio?", a: ["Zero: non ha lati dritti", "Uno", "Due", "Infiniti"], c: 0, f: "Un cerchio è definito come curva chiusa senza lati, a differenza di un poligono." },
  { d: 3, q: "Una lumaca deve risalire un pozzo profondo 10 metri: di giorno sale 3 metri, di notte scivola indietro di 2. In quanti giorni esce dal pozzo?", a: ["Otto giorni", "Dieci giorni", "Cinque giorni", "Sette giorni"], c: 0, f: "L'ultimo giorno, appena raggiunta la cima, non scivola più indietro: il conto va fatto con attenzione." },
  { d: 3, q: "Se lanci una moneta 3 volte e viene sempre testa, qual è la probabilità che venga testa anche al quarto lancio?", a: ["50%, ogni lancio è indipendente dai precedenti", "12,5%", "100%", "0%"], c: 0, f: "La moneta non ha memoria: ogni lancio resta un evento indipendente al 50%." },
  { d: 2, q: "Quanti errori grammaticali contiene questa domanda, se è scritta in modo perfettamente corretto?", a: ["Nessuno", "Uno", "Due", "Tre"], c: 0, f: "A volte il trabocchetto è proprio non fidarsi troppo del proprio istinto." },
];

const CITAZIONI = [
  { d: 2, q: "«Veni, vidi, vici»", a: ["Giulio Cesare", "Augusto", "Nerone", "Cicerone"], c: 0, f: "Dopo la rapidissima campagna contro Farnace, nel 47 a.C." },
  { d: 2, q: "«Elementare, Watson»", a: ["Sherlock Holmes", "Hercule Poirot", "Padre Brown", "Philip Marlowe"], c: 0, f: "Curiosità: nei racconti di Conan Doyle questa frase esatta non compare mai." },
  { d: 2, q: "«E pur si muove»", a: ["Galileo Galilei", "Copernico", "Keplero", "Giordano Bruno"], c: 0, f: "Attribuzione leggendaria: nessuno l'ha mai sentita davvero pronunciare." },
  { d: 2, q: "«Ho un sogno»", a: ["Martin Luther King", "Malcolm X", "Nelson Mandela", "Gandhi"], c: 0, f: "Washington, agosto 1963, davanti a oltre 200.000 persone." },
  { d: 2, q: "«Che la Forza sia con te»", a: ["Star Wars", "Star Trek", "Dune", "Blade Runner"], c: 0, f: "Nel primo film del 1977 la dicono più personaggi." },
  { d: 2, q: "«Un piccolo passo per un uomo»", a: ["Neil Armstrong", "Buzz Aldrin", "Gagarin", "Collins"], c: 0, f: "Sulla frase esatta si discute ancora per via di un fruscio radio." },
  { d: 2, q: "«Houston, abbiamo un problema»", a: ["Apollo 13", "Apollo 11", "Gravity", "Interstellar"], c: 0, f: "La frase reale era leggermente diversa: il film l'ha resa memorabile." },
  { d: 2, q: "«Cogito ergo sum»", a: ["Cartesio", "Kant", "Spinoza", "Hume"], c: 0, f: "Il punto fermo che resiste anche al dubbio più radicale." },
  { d: 2, q: "«Datemi un punto d'appoggio e solleverò il mondo»", a: ["Archimede", "Pitagora", "Euclide", "Talete"], c: 0, f: "Sulla leva, a Siracusa, nel III secolo a.C." },
  { d: 2, q: "«Stay hungry, stay foolish»", a: ["Steve Jobs", "Bill Gates", "Elon Musk", "Jeff Bezos"], c: 0, f: "Stanford, 2005: la frase però la prese in prestito da una rivista degli anni '70." },
  { d: 2, q: "«Il dado è tratto»", a: ["Giulio Cesare", "Annibale", "Alessandro Magno", "Traiano"], c: 0, f: "Al passaggio del Rubicone: da lì non si torna indietro." },
  { d: 2, q: "«Francamente me ne infischio»", a: ["Via col vento", "Casablanca", "Il Padrino", "Quarto potere"], c: 0, f: "1939: all'epoca fu quasi uno scandalo per la censura americana." },
  { d: 2, q: "«Il mio regno per un cavallo!»", a: ["Riccardo III (Shakespeare)", "Enrico V", "Macbeth", "Amleto"], c: 0, f: "Dalla tragedia shakespeariana «Riccardo III», atto V." },
  { d: 2, q: "«Houston, qui base della Tranquillità: l'Aquila è atterrata»", a: ["Neil Armstrong", "Buzz Aldrin", "Michael Collins", "Gagarin"], c: 0, f: "Le prime parole trasmesse dopo l'allunaggio dell'Apollo 11, 1969." },
  { d: 2, q: "«Preferisco morire in piedi che vivere in ginocchio»", a: ["Ernesto «Che» Guevara", "Fidel Castro", "Emiliano Zapata", "Pancho Villa"], c: 0, f: "Attribuita anche ad altri rivoluzionari nella storia, ma resta il suo slogan più celebre." },
  { d: 3, q: "«Se vuoi la pace, prepara la guerra»", a: ["Vegezio, in un trattato militare latino", "Giulio Cesare", "Sun Tzu", "Napoleone"], c: 0, f: "Dall'«Epitoma rei militaris», scritto nel IV secolo d.C." },
  { d: 2, q: "«Ich bin ein Berliner»", a: ["John F. Kennedy", "Ronald Reagan", "Richard Nixon", "Dwight Eisenhower"], c: 0, f: "Berlino Ovest, 1963, in pieno clima di Guerra Fredda." },
  { d: 2, q: "«Tear down this wall!»", a: ["Ronald Reagan", "John F. Kennedy", "George H. W. Bush", "Bill Clinton"], c: 0, f: "Discorso alla Porta di Brandeburgo, 1987, due anni prima della caduta del Muro." },
  { d: 2, q: "«Nel mezzo del cammin di nostra vita»", a: ["Dante Alighieri", "Petrarca", "Boccaccio", "Ariosto"], c: 0, f: "Il verso d'apertura della Divina Commedia, tra i più celebri della letteratura italiana." },
  { d: 3, q: "«I care»", a: ["Don Lorenzo Milani", "Papa Giovanni XXIII", "Padre Pio", "Alcide De Gasperi"], c: 0, f: "Motto della sua scuola di Barbiana, scritto sulla porta dell'aula." },
  { d: 3, q: "«Ave Caesar, morituri te salutant»", a: ["I gladiatori romani, secondo la tradizione", "Giulio Cesare", "Nerone", "Un cronista di Svetonio"], c: 0, f: "Attestata una sola volta da Svetonio, per una battaglia navale simulata: non era una formula di rito abituale." },
  { d: 3, q: "«Un fantasma si aggira per l'Europa»", a: ["Karl Marx (con Friedrich Engels)", "Vladimir Lenin", "Friedrich Nietzsche", "Hegel"], c: 0, f: "Incipit del «Manifesto del Partito Comunista», 1848." },
  { d: 3, q: "«Dio è morto»", a: ["Friedrich Nietzsche", "Karl Marx", "Sigmund Freud", "Arthur Schopenhauer"], c: 0, f: "Da «La gaia scienza», 1882: non una semplice affermazione atea, ma una diagnosi culturale." },
  { d: 2, q: "«Da un grande potere derivano grandi responsabilità»", a: ["Spider-Man (fumetti Marvel)", "Batman", "Superman", "X-Men"], c: 0, f: "Il concetto compare già nel primo albo di Spider-Man, 1962, legato alla figura dello zio Ben." },
  { d: 2, q: "«Hasta la vista, baby»", a: ["Terminator 2 - Il giorno del giudizio", "Terminator", "Rocky IV", "Predator"], c: 0, f: "1991, pronunciata da Arnold Schwarzenegger nei panni del T-800." },
  { d: 2, q: "«May the odds be ever in your favor»", a: ["Hunger Games", "Divergent", "Maze Runner", "Il Trono di Spade"], c: 0, f: "La frase rituale pronunciata prima di ogni edizione dei giochi, nel romanzo e nel film." },
  { d: 2, q: "«Bond. James Bond.»", a: ["James Bond, in «Agente 007 - Licenza di uccidere»", "Jason Bourne", "Ethan Hunt", "Jack Ryan"], c: 0, f: "La celebre presentazione compare per la prima volta nel film del 1962 con Sean Connery." },
  { d: 2, q: "«Sono il re del mondo!»", a: ["Titanic", "Il Padrino", "Rocky", "Pearl Harbor"], c: 0, f: "Gridata da Jack, interpretato da Leonardo DiCaprio, a prua della nave, 1997." },
  { d: 2, q: "«Al mio segnale, scatenate l'inferno»", a: ["Il Gladiatore", "300", "Troy", "Ben-Hur"], c: 0, f: "Pronunciata da Massimo, interpretato da Russell Crowe, all'inizio del film, 2000." },
  { d: 3, q: "«Il potere logora chi non ce l'ha»", a: ["Giulio Andreotti", "Bettino Craxi", "Aldo Moro", "Enrico Berlinguer"], c: 0, f: "Una delle battute più celebri e citate della politica italiana del Novecento." },
  { d: 3, q: "«La storia la scrivono i vincitori»", a: ["Attribuita a Winston Churchill, ma di dubbia autenticità", "Napoleone", "Bismarck", "Charles de Gaulle"], c: 0, f: "Nessuna fonte primaria conferma che Churchill l'abbia mai scritta o detta esattamente così." },
  { d: 2, q: "«Se questo è un uomo»", a: ["Primo Levi", "Elie Wiesel", "Anne Frank", "Liliana Segre"], c: 0, f: "Titolo e verso iniziale della sua testimonianza sulla deportazione ad Auschwitz, 1947." },
  { d: 2, q: "«Tutti gli animali sono uguali, ma alcuni sono più uguali degli altri»", a: ["George Orwell, ne «La fattoria degli animali»", "Aldous Huxley", "Ray Bradbury", "Franz Kafka"], c: 0, f: "1945: una delle frasi satiriche più citate contro i totalitarismi." },
  { d: 2, q: "«Chiedetevi cosa potete fare voi per il vostro paese»", a: ["John F. Kennedy", "Franklin D. Roosevelt", "Barack Obama", "Abraham Lincoln"], c: 0, f: "Dal discorso di insediamento presidenziale, gennaio 1961." },
  { d: 3, q: "«Molti nemici, molto onore»", a: ["Frase ripresa da un antico detto latino, cara alla retorica fascista", "Giuseppe Garibaldi", "Gabriele D'Annunzio", "Vittorio Emanuele III"], c: 0, f: "Divenuta uno slogan politico nell'Italia del ventennio, pur avendo origini più antiche." },
  { d: 3, q: "«Roma non fu fatta in un giorno»", a: ["Proverbio diffuso già nel Medioevo europeo", "Cicerone", "Seneca", "Giulio Cesare"], c: 0, f: "Esiste in varianti simili in molte lingue europee fin dal XII secolo." },
];

const DOPPIO = [
  { d: 2, q: "In quale città ha sede il quartier generale della NATO?", a: ["Bruxelles", "Ginevra", "L'Aia", "Strasburgo"], c: 0, f: "Trasferito da Parigi nel 1967." },
  { d: 2, q: "Quale metallo è liquido a temperatura ambiente?", a: ["Mercurio", "Piombo", "Stagno", "Zinco"], c: 0, f: "Fonde a −39 °C." },
  { d: 2, q: "Chi ha scritto «Il piccolo principe»?", a: ["Saint-Exupéry", "Verne", "Camus", "Prévert"], c: 0, f: "Aviatore, scomparso in volo nel 1944." },
  { d: 2, q: "Qual è l'oceano più profondo?", a: ["Pacifico", "Atlantico", "Indiano", "Artico"], c: 0, f: "La fossa delle Marianne supera gli 11.000 metri." },
  { d: 3, q: "Chi descrisse per primo la circolazione del sangue?", a: ["William Harvey", "Pasteur", "Vesalio", "Galeno"], c: 0, f: "1628: smontò secoli di teorie sbagliate." },
  { d: 3, q: "Quanti fusi orari attraversa la Russia?", a: ["Undici", "Sette", "Nove", "Quindici"], c: 0, f: "Da Kaliningrad alla Kamchatka." },
  { d: 2, q: "Chi ha dipinto «La ronda di notte»?", a: ["Rembrandt", "Vermeer", "Van Gogh", "Rubens"], c: 0, f: "1642, ad Amsterdam. E non è affatto una scena notturna." },
  { d: 2, q: "Qual è la lingua più parlata al mondo come madrelingua?", a: ["Cinese mandarino", "Inglese", "Spagnolo", "Hindi"], c: 0, f: "L'inglese vince invece contando chi la parla come seconda lingua." },
  { d: 2, q: "Chi introdusse in Europa la stampa a caratteri mobili?", a: ["Gutenberg", "Manuzio", "Caxton", "Plantin"], c: 0, f: "Intorno al 1450: in Asia esisteva già da secoli." },
  { d: 2, q: "In che anno è entrato in vigore il trattato di Maastricht?", a: ["1993", "1989", "1997", "2002"], c: 0, f: "Firmato nel 1992, operativo dall'anno dopo." },
  { d: 3, q: "Qual è la montagna più alta d'Europa, contando anche il Caucaso?", a: ["Monte Elbrus", "Monte Bianco", "Cervino", "Gran Sasso"], c: 0, f: "5.642 metri, nel Caucaso russo: escludendo il Caucaso il primato va al Monte Bianco." },
  { d: 2, q: "Qual è la capitale della Svizzera?", a: ["Berna", "Zurigo", "Ginevra", "Basilea"], c: 0, f: "Zurigo è la città più popolosa, ma non è la capitale federale." },
  { d: 2, q: "In quale città si trova la sede principale dell'ONU?", a: ["New York", "Ginevra", "Bruxelles", "Vienna"], c: 0, f: "Il Palazzo di Vetro fu inaugurato nel 1952, su un terreno donato da Rockefeller." },
  { d: 2, q: "Qual è l'elemento chimico più leggero della tavola periodica?", a: ["Idrogeno", "Elio", "Litio", "Carbonio"], c: 0, f: "Ha un solo protone ed è l'elemento più abbondante nell'universo." },
  { d: 3, q: "Chi ha scritto «Il Dottor Živago»?", a: ["Boris Pasternak", "Lev Tolstoj", "Fëdor Dostoevskij", "Anton Čechov"], c: 0, f: "1957: pubblicato prima all'estero, non poté essere stampato in URSS." },
  { d: 3, q: "In che anno cadde Costantinopoli, segnando la fine dell'Impero Bizantino?", a: ["1453", "1204", "1071", "1517"], c: 0, f: "Conquistata dagli Ottomani guidati da Maometto II." },
  { d: 2, q: "Qual è il vulcano attivo più alto d'Europa?", a: ["Etna", "Vesuvio", "Stromboli", "Teide"], c: 0, f: "Oltre 3.300 metri, in continua e lenta crescita." },
  { d: 3, q: "Chi compose la musica usata da Kubrick in «2001: Odissea nello spazio»?", a: ["Nessun compositore originale: Kubrick usò musiche classiche preesistenti", "John Williams", "Ennio Morricone", "Bernard Herrmann"], c: 0, f: "Scartò la colonna sonora commissionata e scelse brani di Strauss e Ligeti." },
  { d: 2, q: "Qual è la capitale della Nuova Zelanda?", a: ["Wellington", "Auckland", "Christchurch", "Canberra"], c: 0, f: "Wellington è la capitale, anche se Auckland è la città più popolosa." },
  { d: 2, q: "Chi ha inventato la pila elettrica?", a: ["Alessandro Volta", "Luigi Galvani", "Guglielmo Marconi", "Antonio Meucci"], c: 0, f: "1799-1800: da lì il termine «volt» come unità di misura." },
  { d: 3, q: "Qual è il deserto più esteso dell'Asia?", a: ["Gobi", "Kara Kum", "Thar", "Taklamakan"], c: 0, f: "Si estende tra Cina e Mongolia, per oltre un milione di km²." },
  { d: 3, q: "Chi ha scritto la sinfonia «Dal Nuovo Mondo»?", a: ["Antonín Dvořák", "Gustav Mahler", "Jean Sibelius", "Edvard Grieg"], c: 0, f: "1893, composta durante il soggiorno negli Stati Uniti." },
  { d: 2, q: "Qual è la valuta ufficiale del Giappone?", a: ["Yen", "Won", "Yuan", "Ringgit"], c: 0, f: "Introdotto nel 1871, sostituì il sistema monetario feudale." },
  { d: 3, q: "Chi ha ideato la «piramide dei bisogni» in psicologia?", a: ["Abraham Maslow", "Carl Rogers", "Sigmund Freud", "B.F. Skinner"], c: 0, f: "1943: alla base i bisogni fisiologici, al vertice l'autorealizzazione." },
  { d: 2, q: "In quale nazione si trovano le rovine di Machu Picchu?", a: ["Perù", "Bolivia", "Ecuador", "Cile"], c: 0, f: "Città inca del XV secolo, riscoperta dall'esploratore Hiram Bingham nel 1911." },
  { d: 2, q: "Qual è il principale gas serra prodotto dalle attività umane?", a: ["Anidride carbonica", "Ossigeno", "Azoto", "Idrogeno"], c: 0, f: "Deriva soprattutto dalla combustione di combustibili fossili." },
  { d: 2, q: "Chi dipinse sia il soffitto della Cappella Sistina sia il «Giudizio Universale»?", a: ["Michelangelo", "Raffaello", "Leonardo", "Bramante"], c: 0, f: "Il Giudizio Universale fu completato quasi trent'anni dopo il soffitto." },
  { d: 2, q: "Qual è il fiume più lungo dell'Asia?", a: ["Yangtze", "Fiume Giallo", "Mekong", "Gange"], c: 0, f: "Oltre 6.300 km, quasi interamente in territorio cinese." },
  { d: 3, q: "Chi fondò la dinastia Ming in Cina?", a: ["Zhu Yuanzhang", "Kublai Khan", "Qin Shi Huang", "Sun Yat-sen"], c: 0, f: "1368, dopo aver rovesciato la dinastia mongola Yuan." },
  { d: 2, q: "Qual è il più piccolo tra gli otto pianeti ufficiali del sistema solare?", a: ["Mercurio", "Marte", "Venere", "Plutone"], c: 0, f: "Plutone non è più classificato come pianeta dal 2006: tra gli otto ufficiali, il più piccolo è Mercurio." },
];

const DEFINIZIONI = [
  { d: 2, q: "Cosa significa «effimero»?", a: ["Che dura pochissimo", "Che è invisibile", "Che è finto", "Che è enorme"], c: 0, f: "Dal greco: che dura un giorno solo." },
  { d: 2, q: "Cosa significa «procrastinare»?", a: ["Rimandare", "Insistere", "Sabotare", "Accelerare"], c: 0, f: "Dal latino: spostare a domani." },
  { d: 3, q: "Cosa significa «ubiquo»?", a: ["Presente ovunque", "Sempre in ritardo", "Difficile da capire", "Molto raro"], c: 0, f: "Dal latino ubique, dappertutto." },
  { d: 3, q: "Cosa significa «lapidario»?", a: ["Breve e tagliente", "Confuso", "Pieno di lusinghe", "Molto lungo"], c: 0, f: "Come un'iscrizione sulla pietra: poche parole, definitive." },
  { d: 3, q: "Cosa significa «aulico»?", a: ["Solenne e ricercato", "Volgare", "Improvvisato", "Segreto"], c: 0, f: "Il linguaggio della corte, aula in latino." },
  { d: 2, q: "Cosa significa «serendipità»?", a: ["Trovare per caso qualcosa di prezioso", "Perdere la memoria", "Ripetersi", "Fingere disinteresse"], c: 0, f: "Coniata nel Settecento da una fiaba persiana." },
  { d: 3, q: "Cosa indica il «petricore»?", a: ["L'odore della pioggia sulla terra", "Il rumore del tuono", "Una roccia vulcanica", "Il gusto del ferro"], c: 0, f: "Termine coniato da due ricercatori australiani nel 1964." },
  { d: 2, q: "Cosa significa «catartico»?", a: ["Che libera e purifica", "Che confonde", "Che addormenta", "Che irrita"], c: 0, f: "Dalla catarsi della tragedia greca." },
  { d: 3, q: "Cosa significa «sinestesia»?", a: ["Mescolare sensi diversi", "Perdere la voce", "Ripetere un suono", "Dimenticare le parole"], c: 0, f: "«Un urlo nero», per dire: colore applicato a un suono." },
  { d: 2, q: "Cosa significa «anacronismo»?", a: ["Qualcosa fuori dal suo tempo", "Un errore di calcolo", "Una parola straniera", "Un ritardo cronico"], c: 0, f: "Come un orologio da polso in un film sull'antica Roma." },
  { d: 3, q: "Cosa significa «idiosincrasia»?", a: ["Avversione istintiva", "Simpatia immediata", "Abitudine noiosa", "Talento naturale"], c: 0, f: "In medicina indica una reazione anomala e personale." },
  { d: 2, q: "Cosa significa «apatia»?", a: ["Assenza di emozioni", "Rabbia improvvisa", "Paura del vuoto", "Eccesso di entusiasmo"], c: 0, f: "Per gli stoici però era una virtù, non un difetto." },
  { d: 2, q: "Cosa significa «epifania», in senso figurato?", a: ["Una rivelazione improvvisa", "Una lunga attesa", "Un addio", "Un errore ripetuto"], c: 0, f: "Dal greco: manifestazione." },
  { d: 3, q: "Cosa significa «pletora»?", a: ["Quantità eccessiva", "Mancanza totale", "Piccolo difetto", "Confine netto"], c: 0, f: "Nato come termine medico: eccesso di sangue." },
  { d: 2, q: "Cosa significa «reticente»?", a: ["Che tende a non dire tutto", "Molto loquace", "Timido", "Bugiardo abituale"], c: 0, f: "Dal latino reticere, tacere." },
  { d: 2, q: "Cosa significa «perentorio»?", a: ["Che non ammette repliche", "Gentile e paziente", "Confuso", "Timido"], c: 0, f: "Nel diritto romano indicava un termine improrogabile." },
  { d: 2, q: "Cos'è un «ossimoro»?", a: ["L'accostamento di due termini contraddittori", "Una rima imperfetta", "Un errore grammaticale", "Una ripetizione voluta"], c: 0, f: "Come «silenzio assordante» o «ghiaccio bollente»." },
  { d: 2, q: "Cosa significa «verboso»?", a: ["Che usa troppe parole", "Che parla poco", "Che scrive a mano", "Molto sincero"], c: 0, f: "Dal latino verbum, parola." },
  { d: 2, q: "Cosa significa «ineluttabile»?", a: ["Che non si può evitare", "Facile da capire", "Molto raro", "Reversibile"], c: 0, f: "Dal latino: che non si può eludere." },
  { d: 2, q: "Cosa significa «empatia»?", a: ["La capacità di comprendere le emozioni altrui", "La paura degli spazi chiusi", "L'amore per la natura", "Il bisogno di solitudine"], c: 0, f: "Dal greco empatheia, sentire dentro." },
  { d: 2, q: "Cosa significa «epico», in senso figurato?", a: ["Grandioso e memorabile", "Molto breve", "Comico", "Malinconico"], c: 0, f: "Dal genere letterario dei poemi epici, come l'Iliade." },
  { d: 2, q: "Cosa significa «supponente»?", a: ["Presuntuoso, che si crede superiore", "Modesto", "Distratto", "Curioso"], c: 0, f: "Da «supporre», nel senso di dare per scontata la propria superiorità." },
  { d: 2, q: "Cosa significa «eclettico»?", a: ["Che spazia tra ambiti e stili diversi", "Specializzato in un solo campo", "Indeciso", "Noioso"], c: 0, f: "Dal greco eklektikos, che sceglie il meglio da fonti diverse." },
  { d: 3, q: "Cosa significa «avulso»?", a: ["Staccato dal proprio contesto", "Molto attaccato a qualcosa", "Confuso", "Distratto"], c: 0, f: "Dal latino avellere, strappare via." },
  { d: 3, q: "Cosa significa «manicheo»?", a: ["Che vede tutto in bianco o nero, senza sfumature", "Molto tollerante", "Confuso", "Ottimista"], c: 0, f: "Dal manicheismo, antica dottrina religiosa basata sul dualismo bene-male." },
  { d: 2, q: "Cosa significa «criptico»?", a: ["Di difficile interpretazione, oscuro", "Molto chiaro", "Breve", "Rumoroso"], c: 0, f: "Dal greco kryptos, nascosto." },
  { d: 3, q: "Cosa significa «fatuo»?", a: ["Vano, privo di sostanza", "Molto saggio", "Aggressivo", "Timido"], c: 0, f: "Dal latino fatuus, sciocco." },
  { d: 3, q: "Cosa significa «peregrino», in senso figurato?", a: ["Insolito, raro, originale", "Molto comune", "Religioso", "Straniero soltanto"], c: 0, f: "Indica un pensiero o un'idea fuori dal comune." },
  { d: 2, q: "Cosa significa «ambiguo»?", a: ["Che si presta a più interpretazioni", "Chiarissimo", "Molto lungo", "Ripetitivo"], c: 0, f: "Dal latino ambigere, andare in due direzioni." },
  { d: 3, q: "Cosa significa «iconoclasta»?", a: ["Che rifiuta simboli e convenzioni tradizionali", "Che ama collezionare oggetti d'arte", "Molto religioso", "Timido"], c: 0, f: "Letteralmente «che distrugge le icone», dal movimento bizantino dell'VIII secolo." },
  { d: 2, q: "Cosa significa «assertivo»?", a: ["Che esprime con sicurezza le proprie opinioni, senza aggressività", "Timido e remissivo", "Confuso", "Aggressivo e prepotente"], c: 0, f: "Un concetto chiave della psicologia della comunicazione." },
  { d: 2, q: "Cosa significa «bucolico»?", a: ["Legato alla vita di campagna, idilliaco", "Legato alla vita di città", "Malinconico", "Guerresco"], c: 0, f: "Dal greco boukolikos, pastorale: come le poesie di Virgilio." },
  { d: 2, q: "Cosa significa «sardonico»?", a: ["Beffardo, con un sorriso amaro e ironico", "Allegro e spensierato", "Triste e silenzioso", "Molto gentile"], c: 0, f: "Dal nome di un'erba sarda che, si diceva, provocava spasmi simili a un sorriso." },
  { d: 2, q: "Cosa significa «gratuito», in senso figurato?", a: ["Non giustificato, senza un vero motivo", "Sempre a pagamento", "Molto raro", "Improvviso"], c: 0, f: "In economia significa invece «senza costo»: qui vale il senso figurato." },
  { d: 2, q: "Cosa significa «ermetico»?", a: ["Chiuso, di difficile comprensione", "Molto esplicito", "Rumoroso", "Trasparente"], c: 0, f: "Dal dio Ermete Trismegisto, legato a dottrine esoteriche e a una corrente poetica del Novecento." },
  { d: 3, q: "Cosa significa «istrionico»?", a: ["Teatrale ed esagerato nei modi", "Timido e riservato", "Molto preciso", "Silenzioso"], c: 0, f: "Dal latino histrio, attore." },
  { d: 2, q: "Cos'è l'«afasia»?", a: ["La perdita totale o parziale della capacità di parlare", "La paura del buio", "L'amore per i libri", "L'insonnia cronica"], c: 0, f: "Spesso causata da lesioni cerebrali in specifiche aree del linguaggio." },
  { d: 2, q: "Cos'è un'«epitome»?", a: ["Una sintesi esemplare, la massima espressione di qualcosa", "Un lungo discorso", "Un errore grave", "Una citazione sbagliata"], c: 0, f: "Dal greco epitomē, taglio, riassunto." },
  { d: 2, q: "Cos'è una «diatriba»?", a: ["Un'aspra discussione polemica", "Una poesia d'amore", "Un lungo viaggio", "Un elogio funebre"], c: 0, f: "Nell'antichità indicava anche una lezione filosofica tenuta in pubblico." },
  { d: 2, q: "Cos'è il «vernacolo»?", a: ["Il dialetto o la lingua parlata tipica di un luogo", "Un termine tecnico scientifico", "Una lingua morta", "Un gergo giovanile"], c: 0, f: "Dal latino vernaculus, che riguarda gli schiavi nati in casa, poi esteso al linguaggio locale." },
  { d: 2, q: "Cos'è il «nichilismo»?", a: ["La negazione di ogni valore e verità assoluta", "L'amore per la natura", "La fede cieca in un'ideologia", "La paura del cambiamento"], c: 0, f: "Termine centrale nella filosofia di Nietzsche." },
  { d: 3, q: "Cos'è il «parossismo»?", a: ["Il punto di massima intensità di un fenomeno", "Un momento di calma assoluta", "Un piccolo errore", "Un lungo silenzio"], c: 0, f: "Usato in medicina per le crisi acute, ed esteso a ogni eccesso emotivo." },
];

const OPINIONI = [
  { d: 2, q: "Qual è la cosa più trash della televisione italiana?", a: ["Il falò di confronto", "Il trono over", "La busta che si chiude", "Il televoto a pagamento"] },
  { d: 2, q: "Cosa vi rappresenta di più come squadra?", a: ["Il ritardo cronico", "L'ottimismo ingiustificato", "Il rancore sportivo", "La fame perenne"] },
  { d: 2, q: "Quale categoria vi fa più paura stasera?", a: ["Cultura", "Sport", "Musica", "Piccante"] },
  { d: 2, q: "Il peggior modo di essere lasciati?", a: ["Un messaggio", "Il silenzio totale", "Una lettera", "Di persona, al ristorante"] },
  { d: 2, q: "La cosa più sopravvalutata degli ultimi anni?", a: ["I brunch", "I capodanni", "I concerti negli stadi", "Le serie da dieci stagioni"] },
  { d: 2, q: "Qual è il tormentone più insopportabile?", a: ["Quello dell'estate", "Quello di Sanremo", "Quello di TikTok", "Quello dei matrimoni"] },
  { d: 2, q: "Il vero lusso, oggi?", a: ["Il silenzio", "Il tempo libero", "La batteria carica", "Un parcheggio"] },
  { d: 2, q: "Come finisce questa serata?", a: ["Con un litigio", "Con altre tre partite", "Con qualcuno addormentato", "Con una rivincita"] },
  { d: 2, q: "La scusa migliore per non uscire?", a: ["Il lavoro", "Il mal di testa", "Il cane", "La verità"] },
  { d: 2, q: "Cosa vi salverebbe a un esame?", a: ["La fortuna", "La faccia tosta", "Le ripetizioni dell'ultimo minuto", "La preghiera"] },
  { d: 2, q: "Il vizio più diffuso al mondo?", a: ["Rimandare tutto", "Controllare il telefono ogni due minuti", "Lamentarsi del meteo", "Parlare di dieta senza farla"] },
  { d: 2, q: "La bugia bianca più raccontata?", a: ["«Sto arrivando»", "«Ti sta benissimo»", "«Non ho fame»", "«Ho letto il messaggio dopo»"] },
  { d: 2, q: "Cosa rovina di più una serata tra amici?", a: ["Qualcuno sul telefono tutto il tempo", "Un litigio su cose futili", "Il conto diviso male", "Finire troppo presto"] },
  { d: 2, q: "Qual è la vera prova di un'amicizia?", a: ["Chi ti aiuta a traslocare", "Chi ti risponde a mezzanotte", "Chi ti dice la verità", "Chi ricorda il tuo compleanno"] },
  { d: 2, q: "Il gesto più romantico, secondo voi?", a: ["Ricordarsi i dettagli piccoli", "Un grande gesto pubblico", "Un regalo inaspettato", "Esserci nei momenti brutti"] },
  { d: 2, q: "Qual è la vacanza ideale?", a: ["Mare e ombrellone fermo", "Città d'arte no-stop", "Montagna e silenzio", "Avventura last minute"] },
  { d: 2, q: "La domanda più temuta a una cena di famiglia?", a: ["«E quindi, fidanzato/a?»", "«Ma quanto guadagni?»", "«Quando fate un figlio?»", "«Che lavoro fai di preciso?»"] },
  { d: 2, q: "Cosa rende insopportabile una riunione di lavoro?", a: ["Chi parla e non conclude mai", "Che poteva essere un'email", "Chi arriva sempre in ritardo", "Il caffè finito a metà"] },
  { d: 2, q: "Il vero segno di essere diventati adulti?", a: ["Amare andare a dormire presto", "Fare la dichiarazione dei redditi", "Avere una pianta che sopravvive", "Preoccuparsi della schiena"] },
  { d: 2, q: "Cosa vi farebbe cambiare gruppo di amici, sul serio?", a: ["Il tradimento della fiducia", "La distanza fisica", "Interessi troppo diversi", "Niente lo farebbe"] },
  { d: 2, q: "Qual è il vero lusso di un weekend libero?", a: ["Non mettere la sveglia", "Non rispondere ai messaggi", "Un pranzo lunghissimo", "Non uscire di casa"] },
  { d: 2, q: "Cosa fareste per primo con un milione di euro vinto stanotte?", a: ["Comprerei casa", "Investirei tutto", "Farei un viaggio lunghissimo", "Lo terrei fermo, per paura"] },
  { d: 2, q: "Il tratto più sottovalutato in una persona?", a: ["La puntualità", "Il senso dell'umorismo", "La coerenza", "La capacità di ascoltare"] },
  { d: 2, q: "Cosa vi manda in crisi più spesso?", a: ["Scegliere dove mangiare", "Rispondere a un messaggio ambiguo", "Fare la valigia", "Decidere cosa guardare stasera"] },
  { d: 2, q: "Qual è l'abitudine più difficile da abbandonare?", a: ["Controllare i social prima di dormire", "Rimandare la palestra", "Comprare cose inutili online", "Dire «domani inizio la dieta»"] },
  { d: 2, q: "Cosa vale davvero la pena festeggiare in grande?", a: ["I piccoli traguardi quotidiani", "Solo le occasioni importanti", "Ogni scusa è buona", "Niente, la festa è sopravvalutata"] },
  { d: 2, q: "Il rumore più fastidioso in assoluto?", a: ["La sveglia al mattino", "Qualcuno che mastica forte", "Le unghie sulla lavagna", "La notifica continua del telefono"] },
  { d: 2, q: "Qual è la scusa più usata per non rispondere a un messaggio?", a: ["«Non l'avevo visto»", "«Ero impegnatissimo»", "«Il telefono era scarico»", "«Volevo risponderti con calma»"] },
  { d: 2, q: "Cosa fareste nell'ultimo giorno libero prima di una settimana infernale?", a: ["Niente, riposo totale", "Vedrei tutti gli amici possibili", "Farei tutte le commissioni rimandate", "Un viaggio lampo fuori porta"] },
  { d: 2, q: "Il vero segreto di una serata riuscita?", a: ["Le persone giuste, non il posto", "Buon cibo", "Musica giusta", "Niente telefoni sul tavolo"] },
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
  { w: "PODCAST", hint: "Cuffie, voce e una puntata che non finisce mai" },
  { w: "FESTIVAL", hint: "Cinque serate, un teatro, tanti fiori" },
  { w: "STADIO", hint: "Si canta e si soffre insieme, in tanti" },
  { w: "BRINDISI", hint: "Bicchieri alzati e un augurio urlato" },
  { w: "VALIGIA", hint: "Si chiude a fatica prima di ogni viaggio" },
  { w: "PATENTE", hint: "Un esame che si rifà, se serve" },
  { w: "RICETTA", hint: "Segreti di famiglia scritti a mano" },
  { w: "ABBUFFATA", hint: "Il pranzo di Natale, in una parola" },
  { w: "CANESTRO", hint: "Vale due o tre punti, a seconda della linea" },
  { w: "TATUAGGIO", hint: "Un ricordo indelebile, letteralmente" },
  { w: "RIMORCHIO", hint: "Tentativo di conquista, in gergo da bar" },
  { w: "FIDANZATO", hint: "Chi ti aspetta a casa, o dovrebbe" },
  { w: "SORPRESA", hint: "Nascosta fino all'ultimo secondo" },
  { w: "VACANZA", hint: "Si aspetta tutto l'anno e finisce in fretta" },
  { w: "ETICHETTA", hint: "Buone maniere a tavola, o un adesivo sul barattolo" },
  { w: "RITRATTO", hint: "Un volto fermato per sempre su tela o schermo" },
  { w: "BUGIARDO", hint: "Chi giura di aver letto il messaggio e non è vero" },
  { w: "SEGRETO", hint: "Si promette di non dirlo a nessuno" },
  { w: "PALESTRA", hint: "Buoni propositi di gennaio, abbandonati a marzo" },
  { w: "BANDIERA", hint: "Sventola sugli spalti allo stadio" },
  { w: "GELATERIA", hint: "Coni e coppette, meglio in estate" },
  { w: "CAMMINATA", hint: "Si fa la domenica, con calma" },
  { w: "CAROSELLO", hint: "Pubblicità d'altri tempi, in bianco e nero" },
  { w: "TRAGUARDO", hint: "Il nastro che si taglia per primi" },
  { w: "BISCOTTO", hint: "Intinto nel latte o nel caffè, senza vergogna" },
  { w: "VALLETTA", hint: "Sorride accanto al conduttore in TV" },
  { w: "STROFA", hint: "La parte che precede il ritornello" },
  { w: "SPIAGGIA", hint: "Ombrelloni allineati e sabbia ovunque" },
  { w: "MAGLIETTA", hint: "Souvenir da concerto, spesso troppo cara" },
  { w: "MERENDA", hint: "Pane e qualcosa di buono, a metà pomeriggio" },
  { w: "OMBRELLO", hint: "Vi salva dalla pioggia, se ve lo ricordate" },
  { w: "BATTERIA", hint: "Si scarica sempre nel momento sbagliato" },
];


const TEAM_COLORS = [C.magenta, C.lime, C.cyan, C.gold];
const MAX_TEAMS = 4;

const PCOL = [C.magenta, C.lime, C.cyan, C.gold, C.arancio, "#B87BFF", "#4DFFB0", "#FF5C5C", "#3D7DFF", "#FF3DDB"];
const LETTERS = ["A", "B", "C", "D"];
const HOST_TICK = 200, POLL_PLAYER = 1300, POLL_HOST = 1500;

/** Cronologia di ciò che è già stato proposto (domande e minigiochi), salvata
 *  sul dispositivo: così una nuova partita — anche in una stanza diversa —
 *  non ripropone da capo le stesse cose finché non si esaurisce il mazzo. */
const USED_KEY = "cultrash:used:v1";
function loadUsed() {
  try {
    const raw = localStorage.getItem(USED_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (_) { return {}; }
}
function saveUsed(u) {
  try { localStorage.setItem(USED_KEY, JSON.stringify(u)); } catch (_) { /* noop */ }
}

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
    { d: 2, q: "Chi ha vinto Sanremo 2023?", a: ["Marco Mengoni", "Ultimo", "Lazza", "Elodie"], c: 0, f: "Con «Due vite», poi portata all'Eurovision." },
    { d: 2, q: "Chi ha vinto Sanremo 2022?", a: ["Mahmood e Blanco", "Elisa", "Achille Lauro", "Gianni Morandi"], c: 0, f: "Con «Brividi», uno dei singoli più ascoltati di sempre in Italia." },
    { d: 2, q: "Quale cantante italiana vinse Sanremo 1964 con «Non ho l'età», a soli 16 anni?", a: ["Gigliola Cinquetti", "Mina", "Ornella Vanoni", "Milva"], c: 0, f: "La più giovane vincitrice della storia del Festival." },
    { d: 2, q: "In che anno l'Italia ha vinto l'Eurovision con i Måneskin?", a: ["2021", "2019", "2023", "2017"], c: 0, f: "Rotterdam: primo trionfo italiano dopo 31 anni di astinenza." },
    { d: 2, q: "Chi ha vinto l'Eurovision Song Contest 2024 con «The Code»?", a: ["Nemo (Svizzera)", "Loreen (Svezia)", "Bambie Thug (Irlanda)", "Angelina Mango (Italia)"], c: 0, f: "Edizione tenutasi a Malmö, in Svezia." },
    { d: 2, q: "Chi ha fondato l'etichetta discografica Motown?", a: ["Berry Gordy", "Quincy Jones", "Clive Davis", "Ahmet Ertegun"], c: 0, f: "Detroit, 1959: la culla del soul moderno." },
    { d: 2, q: "Chi è soprannominato «il Boss» nel rock americano?", a: ["Bruce Springsteen", "Bob Dylan", "Neil Young", "Tom Petty"], c: 0, f: "Nato nel New Jersey, celebre per «Born to Run»." },
    { d: 2, q: "Chi ha scritto e cantato originariamente «Hallelujah»?", a: ["Leonard Cohen", "Bob Dylan", "Neil Diamond", "Paul Simon"], c: 0, f: "1984: il successo arrivò anni dopo, grazie alle numerose cover." },
    { d: 2, q: "In quale città americana nasce il grunge, con band come Nirvana e Pearl Jam?", a: ["Seattle", "Los Angeles", "Chicago", "Portland"], c: 0, f: "Fine anni '80, sulla scia dell'etichetta indipendente Sub Pop." },
    { d: 2, q: "Chi era il cantante dei Nirvana?", a: ["Kurt Cobain", "Dave Grohl", "Chris Cornell", "Eddie Vedder"], c: 0, f: "Morto nel 1994: Dave Grohl fondò poi i Foo Fighters." },
    { d: 2, q: "Chi ha composto le musiche del musical «Notre-Dame de Paris»?", a: ["Riccardo Cocciante", "Ennio Morricone", "Franco Battiato", "Lucio Dalla"], c: 0, f: "1998, in francese: portato poi in tour in tutto il mondo." },
    { d: 2, q: "Quale cantante è nota come la «Queen of Soul»?", a: ["Aretha Franklin", "Diana Ross", "Whitney Houston", "Tina Turner"], c: 0, f: "«Respect» resta il suo inno più celebre." },
    { d: 2, q: "Chi ha cantato «I Will Always Love You» nel film «Guardia del corpo»?", a: ["Whitney Houston", "Mariah Carey", "Celine Dion", "Barbra Streisand"], c: 0, f: "1992: scritta in origine da Dolly Parton." },
    { d: 2, q: "Quale gruppo ha inciso «Hotel California»?", a: ["Eagles", "Fleetwood Mac", "The Doors", "Creedence Clearwater Revival"], c: 0, f: "1976: l'assolo di chitarra finale è tra i più celebri del rock." },
    { d: 2, q: "Chi ha composto la colonna sonora di «Titanic», con «My Heart Will Go On»?", a: ["James Horner", "John Williams", "Hans Zimmer", "Alan Silvestri"], c: 0, f: "Cantata da Celine Dion, vinse l'Oscar come miglior canzone." },
    { d: 2, q: "Quale strumento suonava principalmente Jimi Hendrix?", a: ["Chitarra elettrica", "Basso", "Batteria", "Tastiera"], c: 0, f: "Mancino, suonava una chitarra destrorsa capovolta." },
    { d: 2, q: "Chi ha composto l'opera «Aida»?", a: ["Giuseppe Verdi", "Giacomo Puccini", "Gioachino Rossini", "Vincenzo Bellini"], c: 0, f: "Debuttò al Cairo nel 1871, per l'inaugurazione del Teatro Khedivial." },
    { d: 2, q: "Chi ha composto «Il barbiere di Siviglia»?", a: ["Gioachino Rossini", "Giuseppe Verdi", "Gaetano Donizetti", "Vincenzo Bellini"], c: 0, f: "Scritta in appena due settimane, secondo la leggenda." },
    { d: 2, q: "Come si chiama il celebre tenore italiano protagonista dei «Tre Tenori»?", a: ["Luciano Pavarotti", "Andrea Bocelli", "Franco Corelli", "Beniamino Gigli"], c: 0, f: "Insieme a Plácido Domingo e José Carreras." },
    { d: 2, q: "Chi ha cantato «Time to Say Goodbye» con Sarah Brightman?", a: ["Andrea Bocelli", "Luciano Pavarotti", "Josh Groban", "Il Volo"], c: 0, f: "1996: uno dei singoli crossover più venduti di sempre." },
    { d: 2, q: "Quale genere musicale nasce a Kingston, in Giamaica, come precursore del reggae?", a: ["Lo ska", "L'hip hop", "Il blues", "Il funk"], c: 0, f: "Anni '50-'60, mescola ritmi caraibici e jazz americano." },
    { d: 2, q: "Chi ha reso celebre il moonwalk come mossa di danza?", a: ["Michael Jackson", "James Brown", "Prince", "Usher"], c: 0, f: "Presentato ufficialmente nel 1983, durante lo speciale TV Motown 25." },
    { d: 2, q: "Qual è il vero cognome della cantante nota come Madonna?", a: ["Ciccone", "Ritchie", "Ross", "Lee"], c: 0, f: "Madonna Louise Ciccone, di origini italiane per parte di padre." },
    { d: 2, q: "Chi ha cantato «Like a Virgin»?", a: ["Madonna", "Cyndi Lauper", "Cher", "Tina Turner"], c: 0, f: "1984: uno dei singoli simbolo degli anni '80." },
    { d: 2, q: "Quale girl band britannica includeva Victoria Beckham?", a: ["Spice Girls", "Girls Aloud", "Sugababes", "All Saints"], c: 0, f: "Formatesi nel 1994, sciolte nel 2000 e poi riunite più volte." },
    { d: 2, q: "Chi ha interpretato «Purple Rain»?", a: ["Prince", "Michael Jackson", "David Bowie", "George Michael"], c: 0, f: "1984: anche colonna sonora dell'omonimo film." },
    { d: 2, q: "Chi ha fondato i Pink Floyd insieme a Syd Barrett?", a: ["Roger Waters", "Eric Clapton", "Jimmy Page", "Ozzy Osbourne"], c: 0, f: "Insieme anche a Nick Mason e Richard Wright." },
    { d: 2, q: "Quale batterista si unì ai Beatles nel 1962, completando la formazione storica?", a: ["Ringo Starr", "George Harrison", "Stuart Sutcliffe", "Billy Preston"], c: 0, f: "Sostituì Pete Best poco prima del grande successo del gruppo." },
    { d: 2, q: "Chi ha scritto «Blowin' in the Wind»?", a: ["Bob Dylan", "Woody Guthrie", "Pete Seeger", "Joan Baez"], c: 0, f: "1962: inno del movimento per i diritti civili americani." },
    { d: 2, q: "Quale cantante britannica ha inciso l'album «21», tra i più venduti degli anni 2010?", a: ["Adele", "Amy Winehouse", "Duffy", "Florence Welch"], c: 0, f: "Il titolo si riferisce alla sua età al momento dell'uscita, nel 2011." },
    { d: 2, q: "Chi ha scritto «We Are the Champions»?", a: ["Freddie Mercury", "Brian May", "John Lennon", "Elton John"], c: 0, f: "Queen, 1977: oggi inno non ufficiale di ogni vittoria sportiva." },
    { d: 2, q: "Quale strumento a fiato è tipico delle bande musicali italiane nelle feste di paese?", a: ["La tromba", "Il violino", "Il pianoforte", "L'arpa"], c: 0, f: "Insieme al clarinetto e al trombone, colonna portante delle bande." },
    { d: 2, q: "Chi ha composto «Va, pensiero», celebre coro dell'opera «Nabucco»?", a: ["Giuseppe Verdi", "Gioachino Rossini", "Vincenzo Bellini", "Gaetano Donizetti"], c: 0, f: "Diventato quasi un secondo inno nazionale italiano non ufficiale." },
    { d: 2, q: "Chi è noto per «Jailhouse Rock», tra i simboli del rock and roll?", a: ["Elvis Presley", "Chuck Berry", "Little Richard", "Buddy Holly"], c: 0, f: "1957: anche protagonista dell'omonimo film." },
    { d: 2, q: "Chi ha fondato la band AC/DC?", a: ["I fratelli Young", "I fratelli Gallagher", "I fratelli Van Halen", "I fratelli Wilson"], c: 0, f: "Angus e Malcolm Young, australiani di origini scozzesi." },
    { d: 2, q: "Quale cantante è nota come «Queen Bey»?", a: ["Beyoncé", "Rihanna", "Alicia Keys", "Nicki Minaj"], c: 0, f: "Ex leader delle Destiny's Child, prima di lanciarsi da solista." },
    { d: 2, q: "Chi ha composto le musiche del film «La vita è bella»?", a: ["Nicola Piovani", "Ennio Morricone", "Nino Rota", "Riz Ortolani"], c: 0, f: "Vinse l'Oscar per la miglior colonna sonora, 1999." },
    { d: 2, q: "Quale gruppo musicale nasce dal talento dei fratelli Gallagher a Manchester?", a: ["Oasis", "Blur", "Pulp", "Suede"], c: 0, f: "Anni '90: rivali storici dei Blur nella cosiddetta «Britpop war»." },
    { d: 2, q: "Quale sassofonista jazz è noto per il soprannome «Trane»?", a: ["John Coltrane", "Miles Davis", "Charlie Parker", "Sonny Rollins"], c: 0, f: "Tra i più influenti musicisti jazz del Novecento." },
    { d: 2, q: "Quale compositore scrisse le musiche per il balletto «Lo schiaccianoci»?", a: ["Pëtr Il'ič Čajkovskij", "Sergej Prokof'ev", "Igor Stravinskij", "Nikolaj Rimskij-Korsakov"], c: 0, f: "1892, San Pietroburgo: oggi un classico intramontabile del Natale." },
    { d: 2, q: "Chi ha composto l'opera rock «Jesus Christ Superstar»?", a: ["Andrew Lloyd Webber", "Elton John", "Freddie Mercury", "Stephen Sondheim"], c: 0, f: "1970, su libretto di Tim Rice: nacque come concept album prima che musical." },
    { d: 2, q: "Chi ha scritto «La canzone del sole»?", a: ["Lucio Battisti", "Fabrizio De André", "Francesco Guccini", "Ivano Fossati"], c: 0, f: "1971, con testi di Mogol: un classico estivo intramontabile della musica italiana." },
    { d: 2, q: "Quale cantautore bolognese ha scritto «4/3/1943», dedicata alla data della propria nascita?", a: ["Lucio Dalla", "Francesco Guccini", "Vasco Rossi", "Gianni Morandi"], c: 0, f: "Il titolo era in origine «Gesù bambino», poi cambiato per motivi di censura." },
    { d: 2, q: "Chi detiene il record di Grammy Award vinti in carriera?", a: ["Beyoncé", "Adele", "Taylor Swift", "Alison Krauss"], c: 0, f: "Oltre 30 statuette, il record assoluto." },
    { d: 2, q: "Quale band ha inciso l'album concept «The Wall»?", a: ["Pink Floyd", "Genesis", "Yes", "King Crimson"], c: 0, f: "1979, doppio disco diventato anche un film nel 1982." },
    { d: 2, q: "Chi ha composto le musiche del balletto «Il lago dei cigni»?", a: ["Čajkovskij", "Stravinskij", "Prokof'ev", "Rimskij-Korsakov"], c: 0, f: "1877, oggi tra i balletti classici più rappresentati al mondo." },
    { d: 2, q: "Qual è la voce femminile più grave nel canto lirico?", a: ["Contralto", "Soprano", "Mezzosoprano", "Basso"], c: 0, f: "Le voci basse femminili sono piuttosto rare nell'opera." },
    { d: 2, q: "Chi inventò il pianoforte, agli inizi del Settecento?", a: ["Bartolomeo Cristofori", "Antonio Stradivari", "Johann Sebastian Bach", "Domenico Scarlatti"], c: 0, f: "Liutaio italiano alla corte dei Medici, intorno al 1700." },
    { d: 3, q: "In che anno esce l'album «Abbey Road» dei Beatles?", a: ["1969", "1967", "1970", "1965"], c: 0, f: "L'ultimo registrato insieme, anche se «Let It Be» uscì dopo." },
    { d: 3, q: "Chi produsse il primo album dei Sex Pistols, «Never Mind the Bollocks»?", a: ["Chris Thomas", "George Martin", "Brian Eno", "Trevor Horn"], c: 0, f: "1977, manifesto del punk britannico." },
    { d: 3, q: "In quale anno nasce convenzionalmente l'hip hop, con una festa di DJ Kool Herc nel Bronx?", a: ["1973", "1965", "1980", "1969"], c: 0, f: "Considerata l'atto fondativo del genere." },
    { d: 3, q: "Chi ha composto l'opera «Tosca»?", a: ["Giacomo Puccini", "Giuseppe Verdi", "Pietro Mascagni", "Umberto Giordano"], c: 0, f: "Debuttò a Roma nel 1900." },
    { d: 3, q: "Quanti Grammy ha vinto complessivamente Michael Jackson in carriera?", a: ["13", "8", "20", "5"], c: 0, f: "Otto dei quali in una sola notte, nel 1984, per «Thriller»." },
    { d: 3, q: "In che anno esce il primo album dei Ramones, atto fondativo del punk rock newyorkese?", a: ["1976", "1970", "1980", "1965"], c: 0, f: "Omonimo: appena 29 minuti, ma cambiò la storia del rock." },
    { d: 3, q: "Chi scrisse il libretto de «Le nozze di Figaro» di Mozart?", a: ["Lorenzo Da Ponte", "Emanuele Schikaneder", "Pietro Metastasio", "Carlo Goldoni"], c: 0, f: "Basato su una commedia di Beaumarchais, censurata all'epoca per motivi politici." },
    { d: 3, q: "In che anno viene fondata la Motown Records?", a: ["1959", "1955", "1965", "1970"], c: 0, f: "Da Berry Gordy, a Detroit." },
    { d: 3, q: "In che anno inizia la prima trasmissione radiofonica regolare in Italia?", a: ["1924", "1930", "1919", "1945"], c: 0, f: "L'URI, poi diventata EIAR e infine RAI, iniziò le trasmissioni da Roma." },
    { d: 3, q: "Chi ha composto la colonna sonora del film «Il Padrino»?", a: ["Nino Rota", "Ennio Morricone", "John Williams", "Bernard Herrmann"], c: 0, f: "Il tema principale è tra i più celebri della storia del cinema." },
    { d: 3, q: "In che anno esplode la «Beatlemania» negli USA, con l'esibizione all'Ed Sullivan Show?", a: ["1964", "1962", "1966", "1960"], c: 0, f: "73 milioni di spettatori televisivi, un record per l'epoca." },
    { d: 3, q: "Chi ha scritto e interpretato originariamente «Suzanne»?", a: ["Leonard Cohen", "Bob Dylan", "Paul Simon", "Neil Young"], c: 0, f: "1967: ispirata a un'amica del cantante a Montreal." },
    { d: 3, q: "In che anno esce il primo album in assoluto dei Rolling Stones?", a: ["1964", "1962", "1967", "1970"], c: 0, f: "Omonimo, pubblicato nel Regno Unito ad aprile." },
    { d: 3, q: "Chi diresse l'orchestra alla prima mondiale del «Sacre du printemps» di Stravinskij, che scatenò una rivolta in teatro?", a: ["Pierre Monteux", "Sergei Diaghilev", "Leopold Stokowski", "Arturo Toscanini"], c: 0, f: "Parigi, 1913: la première fu accolta da fischi e risse in platea." },
    { d: 3, q: "Quanti minuti dura circa la versione originale integrale di «Bohemian Rhapsody»?", a: ["Quasi 6 minuti", "3 minuti", "10 minuti", "8 minuti"], c: 0, f: "Insolitamente lunga per un singolo radiofonico dell'epoca." },
    { d: 3, q: "In che anno viene introdotto il disco a 33 giri dalla Columbia Records?", a: ["1948", "1935", "1955", "1960"], c: 0, f: "Rivoluzionò l'ascolto degli album, permettendo tracce più lunghe." },
    { d: 3, q: "Chi ha composto l'opera «Norma», con la celebre aria «Casta diva»?", a: ["Vincenzo Bellini", "Gaetano Donizetti", "Gioachino Rossini", "Giuseppe Verdi"], c: 0, f: "1831: tra le arie più celebri del repertorio lirico." },
    { d: 3, q: "In che anno viene pubblicato «The Dark Side of the Moon» dei Pink Floyd?", a: ["1973", "1975", "1970", "1979"], c: 0, f: "Rimase in classifica Billboard per centinaia di settimane consecutive." },
    { d: 3, q: "Chi ha composto le musiche del musical «West Side Story»?", a: ["Leonard Bernstein", "Stephen Sondheim", "Andrew Lloyd Webber", "Richard Rodgers"], c: 0, f: "1957, ispirato liberamente a Romeo e Giulietta." },
    { d: 3, q: "In quale città nasce il tango, tra fine Ottocento e inizio Novecento?", a: ["Buenos Aires", "Rio de Janeiro", "Montevideo", "Città del Messico"], c: 0, f: "Nei quartieri popolari del porto, da un mix di influenze europee e africane." },
    { d: 3, q: "Chi ha composto la «Sinfonia n. 5», celebre per i primi quattro accordi del tema iniziale?", a: ["Beethoven", "Brahms", "Schubert", "Mendelssohn"], c: 0, f: "Considerato uno degli incipit più riconoscibili di tutta la musica classica." },
    { d: 3, q: "Quanti dischi ha venduto approssimativamente Elvis Presley nel corso della carriera, secondo le stime più alte?", a: ["Oltre 500 milioni", "Circa 100 milioni", "Circa 50 milioni", "Oltre 1 miliardo"], c: 0, f: "Tra le cifre più alte in assoluto nella storia della musica registrata." },
    { d: 3, q: "Quale compositore austriaco lasciò incompiuto il suo «Requiem»?", a: ["Wolfgang Amadeus Mozart", "Franz Schubert", "Joseph Haydn", "Ludwig van Beethoven"], c: 0, f: "1791: fu completato dopo la sua morte da un allievo, Franz Xaver Süssmayr." },
    { d: 3, q: "In che anno viene fondata la storica casa discografica britannica EMI?", a: ["1931", "1920", "1945", "1955"], c: 0, f: "Dalla fusione di due etichette storiche, tra cui la Gramophone Company." },
    { d: 3, q: "In quale decennio nasce il genere disco, con locali come lo Studio 54 a New York?", a: ["Anni '70", "Anni '60", "Anni '80", "Anni '90"], c: 0, f: "Lo Studio 54 aprì nel 1977, diventando il simbolo dell'epoca." },
    { d: 3, q: "Dove si esibirono per l'ultima volta insieme dal vivo i Beatles, nel gennaio 1969?", a: ["Sul tetto della sede della Apple Records a Londra", "Al Cavern Club di Liverpool", "Allo stadio di Shea", "Alla Royal Albert Hall"], c: 0, f: "L'esibizione fu interrotta dalla polizia per il disturbo alla quiete pubblica." },
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
    { d: 2, q: "Quante volte l'Italia ha vinto complessivamente il Mondiale di calcio?", a: ["4", "3", "5", "2"], c: 0, f: "1934, 1938, 1982, 2006: quattro titoli, secondi solo al Brasile." },
    { d: 2, q: "Chi ha vinto il Pallone d'Oro 2023?", a: ["Lionel Messi", "Erling Haaland", "Kylian Mbappé", "Kevin De Bruyne"], c: 0, f: "Ottavo Pallone d'Oro in carriera per l'argentino, record assoluto." },
    { d: 2, q: "Quante Champions League ha vinto il Real Madrid?", a: ["15", "10", "12", "8"], c: 0, f: "Record assoluto: nessun'altra squadra si avvicina." },
    { d: 2, q: "In quale città si disputa il Roland Garros?", a: ["Parigi", "Londra", "New York", "Melbourne"], c: 0, f: "Si gioca sulla terra rossa, unico Slam su questa superficie." },
    { d: 2, q: "Quanti titoli mondiali di Formula 1 ha vinto Lewis Hamilton?", a: ["7", "5", "6", "8"], c: 0, f: "Record che condivide con Michael Schumacher." },
    { d: 2, q: "Qual è la squadra italiana con più scudetti vinti?", a: ["Juventus", "Inter", "Milan", "Napoli"], c: 0, f: "Oltre 35 titoli, considerando anche quelli poi revocati." },
    { d: 2, q: "In quale sport si vincono Australian Open, Roland Garros, Wimbledon e US Open?", a: ["Il tennis", "Il golf", "Il badminton", "Lo squash"], c: 0, f: "Vincerli tutti nello stesso anno solare è rarissimo: si chiama «Grande Slam»." },
    { d: 2, q: "Quanti giocatori compone una squadra di football americano in campo per squadra?", a: ["11", "9", "12", "15"], c: 0, f: "Come nel calcio, ma con regole di gioco completamente diverse." },
    { d: 2, q: "In quale nazione il cricket è lo sport più seguito in assoluto?", a: ["India", "Stati Uniti", "Cina", "Germania"], c: 0, f: "Diffuso soprattutto nei paesi dell'ex Impero Britannico." },
    { d: 2, q: "Quante volte l'Argentina ha vinto il Mondiale di calcio?", a: ["3", "2", "4", "1"], c: 0, f: "1978, 1986 e 2022, l'ultimo con Messi capitano." },
    { d: 2, q: "In quale disciplina gareggia Marcell Jacobs, oro olimpico a Tokyo 2020?", a: ["Atletica, nei 100 metri", "Nuoto", "Ciclismo", "Salto in alto"], c: 0, f: "Primo italiano a vincere l'oro olimpico nei 100 metri." },
    { d: 2, q: "Quanti punti vale una meta nel rugby?", a: ["5", "3", "6", "7"], c: 0, f: "Più i punti aggiuntivi della trasformazione, se realizzata." },
    { d: 2, q: "Quale ciclista ha vinto cinque Tour de France, tra i pochissimi nella storia?", a: ["Eddy Merckx", "Fausto Coppi", "Marco Pantani", "Gino Bartali"], c: 0, f: "Insieme a lui, solo Anquetil, Hinault e Induráin hanno raggiunto quota cinque." },
    { d: 2, q: "In quale sport si compete per la Coppa America, tra le più antiche competizioni sportive al mondo?", a: ["La vela", "Il golf", "Il rugby", "L'automobilismo"], c: 0, f: "Disputata per la prima volta nel 1851." },
    { d: 2, q: "Quanti giocatori sono in campo per squadra nel calcio a 5 (calcetto)?", a: ["5", "6", "7", "4"], c: 0, f: "Compreso il portiere, su un campo molto più piccolo di quello standard." },
    { d: 2, q: "In quale città si sono svolte le Olimpiadi estive del 2021, rinviate per la pandemia?", a: ["Tokyo", "Parigi", "Rio de Janeiro", "Londra"], c: 0, f: "Ufficialmente ancora chiamate «Tokyo 2020», nonostante lo svolgimento nel 2021." },
    { d: 2, q: "Quante squadre parteciperanno alla fase finale dei Mondiali di calcio dal 2026?", a: ["48", "32", "24", "64"], c: 0, f: "Prima edizione allargata, ospitata da Stati Uniti, Canada e Messico." },
    { d: 2, q: "In quale sport si usano termini come «ace», «break point» e «tie-break»?", a: ["Il tennis", "La pallavolo", "Il badminton", "Lo squash"], c: 0, f: "Il tie-break fu introdotto ufficialmente negli anni '70." },
    { d: 2, q: "Quante Olimpiadi invernali ha organizzato l'Italia prima di Milano-Cortina 2026?", a: ["Due", "Una", "Tre", "Nessuna"], c: 0, f: "Cortina 1956 e Torino 2006." },
    { d: 2, q: "Qual è la lunghezza di una vasca olimpionica di nuoto?", a: ["50 metri", "25 metri", "100 metri", "33 metri"], c: 0, f: "Le vasche corte, invece, misurano 25 metri." },
    { d: 2, q: "Quale allenatore ha vinto più Champions League nella storia?", a: ["Carlo Ancelotti", "Pep Guardiola", "Zinedine Zidane", "Alex Ferguson"], c: 0, f: "Cinque titoli, l'ultimo nel 2024 col Real Madrid." },
    { d: 2, q: "Quanti Australian Open ha vinto Novak Djokovic, record maschile nel torneo?", a: ["10", "7", "8", "9"], c: 0, f: "Il torneo che ama di più, giocato sul cemento di Melbourne." },
    { d: 2, q: "Quanti punti si giocano di norma per vincere un set di pallavolo, oltre al vantaggio di due punti?", a: ["25", "21", "15", "30"], c: 0, f: "Tranne il quinto set decisivo, che si gioca fino a 15." },
    { d: 2, q: "In quale disciplina gareggia un «decatleta»?", a: ["Atletica leggera, in dieci prove", "Nuoto", "Ginnastica", "Triathlon"], c: 0, f: "Dieci discipline in due giorni: tra le prove più complete dello sport." },
    { d: 2, q: "Quale squadra di calcio inglese è nota come «i Red Devils»?", a: ["Manchester United", "Liverpool", "Arsenal", "Chelsea"], c: 0, f: "Soprannome adottato ufficialmente negli anni '60." },
    { d: 2, q: "In quale sport si usa il termine «birdie»?", a: ["Il golf", "Il tennis", "Il badminton", "Il cricket"], c: 0, f: "Indica una buca completata con un colpo in meno rispetto al par." },
    { d: 2, q: "Quanti giocatori compone una squadra di baseball in campo per squadra?", a: ["9", "10", "11", "8"], c: 0, f: "Sport nato negli Stati Uniti nell'Ottocento." },
    { d: 2, q: "Come è soprannominata la nazionale di rugby del Sudafrica?", a: ["Gli Springboks", "Gli All Blacks", "I Wallabies", "I Lions"], c: 0, f: "Campioni del mondo per quattro volte, record insieme alla Nuova Zelanda." },
    { d: 2, q: "Quale nazionale è soprannominata «gli All Blacks» nel rugby?", a: ["La Nuova Zelanda", "L'Australia", "Il Sudafrica", "Il Galles"], c: 0, f: "Famosi anche per la Haka, danza rituale maori eseguita prima delle partite." },
    { d: 2, q: "In quale sport olimpico gareggiava Federica Pellegrini?", a: ["Il nuoto", "L'atletica", "La scherma", "La ginnastica"], c: 0, f: "Oro olimpico nei 200 stile libero a Pechino 2008." },
    { d: 2, q: "Quale sport pratica un «fiorettista»?", a: ["La scherma", "Il tiro con l'arco", "Il tennis", "Il badminton"], c: 0, f: "Fioretto, spada e sciabola sono le tre armi della scherma olimpica." },
    { d: 2, q: "In quale sport si assegna la Ryder Cup?", a: ["Il golf", "Il tennis", "Il rugby", "La vela"], c: 0, f: "Europa contro Stati Uniti, ogni due anni." },
    { d: 2, q: "Quanti Slam ha vinto complessivamente Roger Federer in singolare maschile?", a: ["20", "17", "19", "22"], c: 0, f: "Record poi superato da Djokovic e Nadal." },
    { d: 2, q: "In quale sport invernale si gareggia sulla «pista di bob»?", a: ["Il bob", "Lo sci alpino", "Il pattinaggio", "Lo slittino soltanto"], c: 0, f: "Sport a squadre di due o quattro atleti, nato in Svizzera a fine Ottocento." },
    { d: 2, q: "Qual è la squadra con più titoli nazionali nel campionato tedesco di calcio?", a: ["Bayern Monaco", "Borussia Dortmund", "Schalke 04", "Bayer Leverkusen"], c: 0, f: "Oltre 30 Bundesliga vinte, un dominio quasi assoluto." },
    { d: 2, q: "In quale sport a tappe si assegna la Vuelta a España?", a: ["Il ciclismo", "L'atletica", "Il calcio", "Il nuoto"], c: 0, f: "Terzo grande giro a tappe dopo Giro d'Italia e Tour de France." },
    { d: 2, q: "Quale gioco mentale è riconosciuto come sport dal CIO, pur non essendo nel programma olimpico?", a: ["Gli scacchi", "La dama", "Il bridge", "Il poker"], c: 0, f: "Il Comitato Olimpico lo riconosce ufficialmente come disciplina sportiva." },
    { d: 2, q: "In quale sport si assegna anche una Champions League femminile per club?", a: ["Il calcio", "La pallavolo", "Il basket", "Il rugby"], c: 0, f: "Competizione europea parallela a quella maschile." },
    { d: 2, q: "Quale nuotatore ha vinto otto medaglie d'oro in una sola edizione olimpica, a Pechino 2008?", a: ["Michael Phelps", "Mark Spitz", "Ian Thorpe", "Ryan Lochte"], c: 0, f: "Record assoluto per un singolo atleta in una singola edizione." },
    { d: 2, q: "A cosa serve la Louis Vuitton Cup, legata all'America's Cup di vela?", a: ["A selezionare lo sfidante che affronterà il detentore della coppa", "A premiare il miglior equipaggio femminile", "A finanziare le squadre partecipanti", "A stabilire il percorso di gara"], c: 0, f: "Una sorta di torneo di qualificazione tra gli sfidanti." },
    { d: 2, q: "Quale squadra NBA condivide il record di titoli vinti con i Boston Celtics?", a: ["Los Angeles Lakers", "Chicago Bulls", "Golden State Warriors", "San Antonio Spurs"], c: 0, f: "Entrambe a quota 18 titoli NBA." },
    { d: 2, q: "Quale pilota ha vinto il maggior numero di Gran Premi nella storia della Formula 1?", a: ["Lewis Hamilton", "Michael Schumacher", "Max Verstappen", "Sebastian Vettel"], c: 0, f: "Oltre 100 vittorie in carriera, record assoluto." },
    { d: 2, q: "In quale città si trova il circuito di Monza, storico teatro del Gran Premio d'Italia?", a: ["Monza, in provincia di Monza e Brianza", "Imola", "Mugello", "Vallelunga"], c: 0, f: "Soprannominato «il tempio della velocità»." },
    { d: 2, q: "In quale disciplina olimpica si usano le «parallele» e il «cavallo con maniglie»?", a: ["La ginnastica artistica", "L'atletica", "Il nuoto sincronizzato", "Il pattinaggio artistico"], c: 0, f: "Discipline maschili del programma olimpico di ginnastica." },
    { d: 2, q: "In quale sport, a squadre nazionali, si assegna la Coppa Davis?", a: ["Il tennis", "Il golf", "Il rugby", "Il nuoto"], c: 0, f: "L'Italia l'ha vinta nel 2023 e nel 2024, dopo l'unico successo del 1976." },
    { d: 2, q: "Quali due nazionali sudamericane si dividono il record di vittorie nella Copa América di calcio?", a: ["Argentina e Uruguay", "Solo il Brasile", "Solo il Cile", "Solo la Colombia"], c: 0, f: "Entrambe a quota 15 titoli, record del torneo." },
    { d: 2, q: "In quale sport si usano i termini «placcaggio» e «mischia» in senso proprio?", a: ["Il rugby", "Il football americano soltanto", "L'hockey su ghiaccio", "La lotta libera"], c: 0, f: "Il football americano ha regole di contatto diverse, senza «mischia» formale." },
    { d: 2, q: "Quale ciclista italiano vinse sia il Giro sia il Tour de France nello stesso anno, il 1998?", a: ["Marco Pantani", "Gilberto Simoni", "Ivan Basso", "Vincenzo Nibali"], c: 0, f: "Impresa riuscita a pochissimi corridori nella storia del ciclismo." },
    { d: 2, q: "In quale sport invernale si scende soli, sulla schiena, lungo un budello di ghiaccio?", a: ["Lo slittino", "Il bob", "Lo skeleton", "Lo sci di fondo"], c: 0, f: "Lo skeleton, invece, si affronta a pancia in giù." },
    { d: 2, q: "Quale ex cestista, sei volte campione NBA con i Chicago Bulls, è soprannominato «His Airness»?", a: ["Michael Jordan", "LeBron James", "Kobe Bryant", "Magic Johnson"], c: 0, f: "Considerato da molti il più forte giocatore di basket di sempre." },
    { d: 2, q: "In quale continente si trova il circuito di Suzuka, storico Gran Premio del Giappone?", a: ["Asia", "Europa", "Oceania", "Nord America"], c: 0, f: "Tracciato caratteristico per la sua forma a otto." },
    { d: 3, q: "In che anno l'Italia vinse il suo primo Mondiale di calcio?", a: ["1934", "1938", "1930", "1950"], c: 0, f: "Ospitato in casa, sotto la guida del ct Vittorio Pozzo." },
    { d: 3, q: "Chi vinse il Pallone d'Oro nel 1993, tra i pochi italiani a riceverlo?", a: ["Roberto Baggio", "Paolo Maldini", "Gianluca Vialli", "Alessandro Del Piero"], c: 0, f: "Dopo la finale mondiale persa ai rigori nel '94, restò comunque un'icona." },
    { d: 3, q: "Quante volte la città di Londra ha ospitato le Olimpiadi estive?", a: ["Tre", "Due", "Una", "Quattro"], c: 0, f: "1908, 1948 e 2012: nessun'altra città ne ha ospitate così tante." },
    { d: 3, q: "In che anno debuttò ufficialmente la maglia gialla al Tour de France?", a: ["1919", "1903", "1930", "1947"], c: 0, f: "Introdotta per distinguere meglio il leader della classifica tra il pubblico." },
    { d: 3, q: "Quale pugile è noto per l'espressione «Float like a butterfly, sting like a bee»?", a: ["Muhammad Ali", "Mike Tyson", "Joe Frazier", "George Foreman"], c: 0, f: "Tre volte campione del mondo dei pesi massimi." },
    { d: 3, q: "In che anno fu fondata la FIFA?", a: ["1904", "1900", "1920", "1930"], c: 0, f: "A Parigi, da rappresentanti di sette federazioni europee." },
    { d: 3, q: "Quante volte la Germania ha vinto il Mondiale di calcio?", a: ["4", "3", "5", "2"], c: 0, f: "1954, 1974, 1990 e 2014: alla pari con l'Italia, seconda solo al Brasile." },
    { d: 3, q: "In quale stagione si giocò la prima Coppa dei Campioni, antenata della Champions League?", a: ["1955-56", "1960-61", "1950-51", "1970-71"], c: 0, f: "Vinta dal Real Madrid, che ne avrebbe vinte cinque di fila." },
    { d: 3, q: "Quale tennista ha vinto il Grande Slam in singolare per ben due volte?", a: ["Rod Laver", "Roger Federer", "Bjorn Borg", "Rafael Nadal"], c: 0, f: "Nel 1962 e nel 1969: un'impresa mai più ripetuta da nessun altro." },
    { d: 3, q: "In che decennio furono introdotti i tie-break nel tennis?", a: ["Anni '70", "Anni '60", "Anni '80", "Anni '90"], c: 0, f: "Ideati per accorciare i set interminabili, si diffusero rapidamente in tutti i tornei." },
    { d: 3, q: "Quale nazione vinse la prima Coppa del Mondo di rugby, nel 1987?", a: ["Nuova Zelanda", "Australia", "Sudafrica", "Inghilterra"], c: 0, f: "Ospitata congiuntamente da Nuova Zelanda e Australia." },
    { d: 3, q: "In che anno debuttarono le Olimpiadi invernali, a Chamonix?", a: ["1924", "1908", "1932", "1900"], c: 0, f: "Inizialmente chiamata «Settimana internazionale degli sport invernali»." },
    { d: 3, q: "Quale ciclista detiene il record di vittorie di tappa al Giro d'Italia?", a: ["Mario Cipollini", "Alfredo Binda", "Eddy Merckx", "Fausto Coppi"], c: 0, f: "42 tappe vinte in carriera, un record che resiste da anni." },
    { d: 3, q: "In che anno si disputò la prima edizione della Ryder Cup nel golf?", a: ["1927", "1900", "1950", "1970"], c: 0, f: "Nata da una sfida amichevole tra golfisti americani e britannici." },
    { d: 3, q: "Quanti titoli NBA vinse Bill Russell, record assoluto per un singolo giocatore?", a: ["11", "6", "9", "13"], c: 0, f: "Con i Boston Celtics, tra il 1957 e il 1969." },
    { d: 3, q: "In che anno la pallavolo diventò sport olimpico?", a: ["1964", "1950", "1972", "1936"], c: 0, f: "Introdotta ai Giochi di Tokyo, sia nel torneo maschile che femminile." },
    { d: 3, q: "Quale nazione ha conquistato più medaglie complessive nella storia delle Olimpiadi estive?", a: ["Stati Uniti", "Unione Sovietica/Russia", "Germania", "Gran Bretagna"], c: 0, f: "Un primato che detiene fin dalle prime edizioni moderne." },
    { d: 3, q: "In che anno debuttò il calcio femminile ai Giochi Olimpici?", a: ["1996", "1984", "2000", "1976"], c: 0, f: "Ad Atlanta, con gli Stati Uniti che vinsero l'oro davanti al proprio pubblico." },
    { d: 3, q: "Chi detiene il maggior numero di titoli mondiali nella classe regina del motociclismo?", a: ["Giacomo Agostini", "Valentino Rossi", "Marc Márquez", "Mick Doohan"], c: 0, f: "Otto titoli tra il 1966 e il 1975, contando anche l'ex classe 500." },
    { d: 3, q: "Quale schermidore è tra i più medagliati della storia olimpica italiana, con 13 medaglie complessive?", a: ["Edoardo Mangiarotti", "Valentina Vezzali", "Nedo Nadi", "Aldo Montano"], c: 0, f: "Vinse medaglie olimpiche tra il 1936 e il 1960." },
    { d: 3, q: "In che anno si disputò la prima edizione dei Campionati Europei di calcio per nazioni?", a: ["1960", "1954", "1968", "1972"], c: 0, f: "Vinta dall'Unione Sovietica, in Francia." },
    { d: 3, q: "Quali tre ciclisti condividono il record di cinque vittorie al Giro d'Italia?", a: ["Binda, Coppi e Merckx", "Solo Fausto Coppi", "Solo Alfredo Binda", "Solo Eddy Merckx"], c: 0, f: "Alfredo Binda, Fausto Coppi ed Eddy Merckx, tutti a quota cinque vittorie." },
    { d: 3, q: "In che anno si tenne la prima maratona olimpica moderna, ad Atene?", a: ["1896", "1900", "1908", "1924"], c: 0, f: "Vinta dal greco Spyridon Louis, tra il tripudio del pubblico di casa." },
    { d: 3, q: "Chi ha segnato il maggior numero di punti nella storia dell'NBA?", a: ["LeBron James", "Kareem Abdul-Jabbar", "Kobe Bryant", "Michael Jordan"], c: 0, f: "Ha superato il record storico di Abdul-Jabbar nel 2023." },
    { d: 3, q: "In che anno debuttò lo sci alpino come sport olimpico?", a: ["1936", "1924", "1948", "1952"], c: 0, f: "Ai Giochi invernali di Garmisch-Partenkirchen, in Germania." },
    { d: 3, q: "Quale nazionale vinse il Mondiale di calcio 1950, in casa del Brasile?", a: ["Uruguay", "Brasile", "Italia", "Ungheria"], c: 0, f: "Il celebre «Maracanazo»: il Brasile perse in casa, davanti a quasi 200.000 persone." },
    { d: 3, q: "Quale nazione organizzò e vinse il Mondiale di calcio del 1998?", a: ["Francia", "Brasile", "Italia", "Germania"], c: 0, f: "Battendo il Brasile 3-0 in finale, con tripletta di Zidane e Petit." },
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
    { d: 2, q: "Su quale rete va in onda «Le Iene»?", a: ["Italia 1", "Canale 5", "Rai 1", "La7"], c: 0, f: "In onda dal 1998, mix di inchieste giornalistiche e comicità." },
    { d: 2, q: "Qual è il premio ironico consegnato dagli inviati di «Striscia la Notizia»?", a: ["Il Tapiro d'oro", "Il Cucchiaio di legno", "La Scarpa bucata", "Il Cactus d'argento"], c: 0, f: "Consegnato storicamente da inviati come Valerio Staffelli." },
    { d: 2, q: "Chi conduce «Verissimo» su Canale 5?", a: ["Silvia Toffanin", "Barbara d'Urso", "Mara Venier", "Caterina Balivo"], c: 0, f: "In onda dal 2003, nel weekend pomeridiano." },
    { d: 2, q: "Su quale rete va in onda storicamente «Domenica In»?", a: ["Rai 1", "Canale 5", "Rai 2", "Italia 1"], c: 0, f: "In onda la domenica pomeriggio fin dagli anni '70." },
    { d: 2, q: "Come si chiama il pupazzo rosso simbolo di «Striscia la Notizia»?", a: ["Il Gabibbo", "Il Mago Gabriel", "Uan", "Provolino"], c: 0, f: "Creato da Antonio Ricci, in onda dal 1990." },
    { d: 2, q: "Chi conduce «Ballando con le Stelle»?", a: ["Milly Carlucci", "Maria De Filippi", "Antonella Clerici", "Simona Ventura"], c: 0, f: "In onda dal 2005, format internazionale nato in UK come «Strictly Come Dancing»." },
    { d: 2, q: "Chi conduce storicamente il quiz preserale «I Soliti Ignoti»?", a: ["Amadeus", "Carlo Conti", "Gerry Scotti", "Flavio Insinna"], c: 0, f: "Su Rai 1, con la sfida finale contro il «mistery man»." },
    { d: 2, q: "Quale chef stellato è tra i giudici storici di «MasterChef Italia»?", a: ["Antonino Cannavacciuolo", "Alessandro Borghese", "Bruno Barbieri", "Carlo Cracco"], c: 0, f: "Tra i volti più noti della TV culinaria italiana." },
    { d: 2, q: "Chi conduce «4 Ristoranti»?", a: ["Alessandro Borghese", "Antonino Cannavacciuolo", "Bruno Barbieri", "Carlo Cracco"], c: 0, f: "Format in cui quattro ristoratori si giudicano a vicenda." },
    { d: 2, q: "Come si chiama il people show con vip che imitano grandi artisti della musica, condotto da Carlo Conti?", a: ["Tale e Quale Show", "The Voice Senior", "Amici Celebrities", "Ora o Mai Più"], c: 0, f: "In onda su Rai 1, con giuria fissa a valutare le imitazioni." },
    { d: 2, q: "Chi ha condotto in Italia «Chi vuol essere milionario?»?", a: ["Gerry Scotti", "Fabrizio Frizzi", "Mike Bongiorno", "Paolo Bonolis"], c: 0, f: "In onda dal 2000, format internazionale." },
    { d: 2, q: "Quale storico quiz presentava Mike Bongiorno già negli anni '50?", a: ["Lascia o raddoppia?", "L'eredità", "Affari tuoi", "Il pranzo è servito"], c: 0, f: "Il primo grande quiz della TV italiana, dal 1955." },
    { d: 2, q: "Chi conduce «L'Eredità» su Rai 1?", a: ["Marco Liorni", "Flavio Insinna", "Amadeus", "Pino Insegno"], c: 0, f: "Quiz preserale con la celebre «ghigliottina» finale." },
    { d: 2, q: "Come si chiama la fase finale del gioco «L'Eredità», con cinque indizi da collegare a una parola?", a: ["La ghigliottina", "Il triello", "La sfida finale", "L'ultima parola"], c: 0, f: "Il concorrente ha un minuto di tempo per trovare la parola giusta." },
    { d: 2, q: "Quale app di dating è nota per lo swipe a destra o sinistra sui profili?", a: ["Tinder", "Instagram", "Snapchat", "Tumblr"], c: 0, f: "Lanciata nel 2012, ha reso popolare il gesto dello «swipe»." },
    { d: 2, q: "Cosa indica l'acronimo «FOMO», diffuso nel linguaggio social?", a: ["La paura di perdersi qualcosa", "La voglia di condividere tutto", "Un tipo di filtro fotografico", "Una sigla per gli algoritmi social"], c: 0, f: "Entrata anche nei dizionari inglesi ufficiali." },
    { d: 2, q: "Cosa indica un «reel» su Instagram?", a: ["Un breve video verticale", "Una foto in bianco e nero", "Un sondaggio nelle storie", "Un link esterno"], c: 0, f: "Formato lanciato nel 2020, in risposta diretta al successo di TikTok." },
    { d: 2, q: "Quale social network era associato all'uccellino, prima del rebranding in X?", a: ["Twitter", "Instagram", "Snapchat", "Pinterest"], c: 0, f: "Rinominato X nel 2023 dopo l'acquisizione di Elon Musk." },
    { d: 2, q: "Cosa significa l'espressione «andare virale», riferita a un contenuto online?", a: ["Diffondersi molto rapidamente e ampiamente", "Essere rimosso dalla piattaforma", "Essere modificato con un filtro", "Essere trasmesso in diretta"], c: 0, f: "Il paragone con i virus biologici è voluto: si diffonde da persona a persona." },
    { d: 2, q: "Quale piattaforma di streaming ha lanciato la serie sudcoreana «Squid Game»?", a: ["Netflix", "Amazon Prime Video", "Disney+", "Apple TV+"], c: 0, f: "2021: una delle serie non in lingua inglese più viste della piattaforma." },
    { d: 2, q: "Chi conduce storicamente «Amici», talent show del sabato pomeriggio e serale?", a: ["Maria De Filippi", "Simona Ventura", "Milly Carlucci", "Antonella Clerici"], c: 0, f: "In onda dal 2001, format ideato dalla stessa conduttrice." },
    { d: 2, q: "In quale reality show i concorrenti vivono isolati su un'isola, competendo per la sopravvivenza?", a: ["L'Isola dei Famosi", "Il Grande Fratello", "Pechino Express", "La Talpa"], c: 0, f: "Format nato in Svezia col nome «Expedition Robinson»." },
    { d: 2, q: "Quale reality prevede un viaggio in coppia senza soldi né telefono, con un bancomat sociale?", a: ["Pechino Express", "La Talpa", "Ex on the Beach", "Il Collegio"], c: 0, f: "Le coppie devono farsi ospitare dalla gente del posto lungo il tragitto." },
    { d: 2, q: "In quale programma un concorrente infiltrato sabota segretamente la propria squadra?", a: ["La Talpa", "Il Grande Fratello", "Pechino Express", "Amici"], c: 0, f: "Gli altri concorrenti devono scoprire chi è la «talpa» tra loro." },
    { d: 2, q: "Quale famosa imprenditrice digitale italiana ha fondato il blog «The Blonde Salad»?", a: ["Chiara Ferragni", "Valentina Ferragni", "Giulia De Lellis", "Elisa Maino"], c: 0, f: "Nato come blog di moda nel 2009, poi diventato un impero digitale." },
    { d: 2, q: "Cosa indica il termine «hater» nel linguaggio dei social?", a: ["Chi lascia commenti ostili e denigratori", "Chi crea contenuti virali", "Chi modera un gruppo", "Chi copia lo stile di un altro creator"], c: 0, f: "Dall'inglese «to hate», odiare." },
    { d: 2, q: "Cosa vuol dire «unfollow» su un social network?", a: ["Smettere di seguire un profilo", "Bloccare un utente", "Segnalare un contenuto", "Mettere in pausa le notifiche"], c: 0, f: "Il contrario di «follow», seguire." },
    { d: 2, q: "Quale piattaforma social è nota per i video brevissimi ballati e i trend musicali?", a: ["TikTok", "LinkedIn", "Twitter/X", "Pinterest"], c: 0, f: "Lanciata a livello globale nel 2017, dalla fusione con Musical.ly." },
    { d: 2, q: "Come si chiama la funzione di Instagram che fa scomparire i contenuti dopo 24 ore?", a: ["Le storie", "I reel", "I post", "Gli highlight"], c: 0, f: "Funzione ispirata a Snapchat, che l'aveva inventata per prima." },
    { d: 2, q: "Cosa significa l'espressione «flexare» nel gergo social?", a: ["Mostrare con orgoglio qualcosa che si possiede o si è ottenuto", "Cancellare un post imbarazzante", "Ignorare un commento", "Programmare un post futuro"], c: 0, f: "Dall'inglese «to flex», mostrare i muscoli." },
    { d: 2, q: "Cosa indica il termine «spoiler», molto usato per le serie TV?", a: ["Anticipare una parte della trama, rovinando la sorpresa", "Un errore di montaggio", "Una scena tagliata", "Un finale alternativo"], c: 0, f: "Dall'inglese «to spoil», rovinare." },
    { d: 2, q: "In quale programma culinario è celebre la prova del «Cestino Misterioso»?", a: ["MasterChef Italia", "Bake Off Italia", "La Prova del Cuoco", "Little Big Italy"], c: 0, f: "La prova con ingredienti a sorpresa è tra le più iconiche del programma." },
    { d: 2, q: "Quale programma Rai racconta storie di persone scomparse, condotto per anni da Federica Sciarelli?", a: ["Chi l'ha visto?", "Report", "Le Iene", "Amore Criminale"], c: 0, f: "In onda dal 1989, uno dei programmi d'inchiesta più longevi della TV italiana." },
    { d: 2, q: "Chi ha condotto per anni il people show «Domenica Live»?", a: ["Barbara d'Urso", "Alessia Marcuzzi", "Ilary Blasi", "Michelle Hunziker"], c: 0, f: "In onda su Canale 5 fino al 2021." },
    { d: 2, q: "Quale reality metteva vip e concorrenti alla prova in una fattoria?", a: ["La Fattoria", "L'Isola dei Famosi", "Il Collegio", "Pechino Express"], c: 0, f: "Format andato in onda su Canale 5 a metà anni 2000." },
    { d: 2, q: "Come si chiama la fase finale di «Amici», in onda di sabato sera in primavera?", a: ["Il serale", "Il pomeridiano", "Il day time", "La finalissima soltanto"], c: 0, f: "Segue la prima fase pomeridiana, andata in onda tutto l'inverno." },
    { d: 2, q: "Quale format tv coinvolge sconosciuti che si sposano al primo incontro, decisi da esperti?", a: ["Matrimonio a prima vista", "Uomini e Donne", "Take Me Out", "Il Collegio"], c: 0, f: "Format internazionale, arrivato anche in Italia su Real Time." },
    { d: 2, q: "Su quale rete va in onda tipicamente «Il Collegio»?", a: ["Rai 2", "Canale 5", "Rai 1", "Italia 1"], c: 0, f: "Format che ricostruisce una scuola d'epoca per adolescenti di oggi." },
    { d: 2, q: "Quale conduttore ha presentato cinque edizioni consecutive del Festival di Sanremo, dal 2020 al 2024?", a: ["Amadeus", "Carlo Conti", "Claudio Baglioni", "Pippo Baudo"], c: 0, f: "Un record recente nella storia del Festival." },
    { d: 2, q: "Chi detiene il record storico di conduzioni del Festival di Sanremo, con tredici edizioni?", a: ["Pippo Baudo", "Amadeus", "Mike Bongiorno", "Raffaella Carrà"], c: 0, f: "Nessun altro conduttore si avvicina a questo numero." },
    { d: 2, q: "Cosa si intende per «lipsync» in un talent show canoro?", a: ["Muovere le labbra su una base preregistrata, senza cantare dal vivo", "Cantare a cappella", "Duettare con un altro concorrente", "Cantare con l'autotune"], c: 0, f: "Pratica generalmente vietata nei talent show seri, spesso motivo di squalifica." },
    { d: 2, q: "Cosa indica la parola «trash», riferita a certi contenuti televisivi?", a: ["Contenuti di bassa qualità, ma godibili in modo ironico", "Contenuti estremamente colti e raffinati", "Programmi solo per bambini", "Documentari naturalistici"], c: 0, f: "Dall'inglese «spazzatura», ma nel gergo tv ha assunto un'accezione quasi affettuosa." },
    { d: 2, q: "Quali due piattaforme social offrono entrambe la funzione dei video in diretta, o «live»?", a: ["Instagram e TikTok", "Solo LinkedIn", "Solo Pinterest", "Nessuna, è un'esclusiva TV"], c: 0, f: "Le dirette social hanno cambiato il modo di interagire tra creator e pubblico." },
    { d: 2, q: "Quale talent show musicale ha lanciato sia Alessandra Amoroso sia Emma Marrone?", a: ["Amici", "X Factor", "The Voice", "Sanremo Giovani"], c: 0, f: "Entrambe diplomate alla scuola di Maria De Filippi." },
    { d: 2, q: "Chi ha vinto la prima edizione italiana di «The Voice of Italy»?", a: ["Suzy Zangheri", "Silvia Fabbri", "Mahmood", "Michele Bravi"], c: 0, f: "2013-14, prima stagione condotta da Simona Ventura." },
    { d: 2, q: "Come si definisce, in gergo social, un contenuto pensato apposta per generare polemiche e interazioni?", a: ["Contenuto polemico o «acchiappa-click»", "Contenuto evergreen", "Contenuto sponsorizzato", "Contenuto geolocalizzato"], c: 0, f: "Spesso definito anche «clickbait» quando riguarda titoli ingannevoli." },
    { d: 3, q: "In che anno debutta in Italia «Il Grande Fratello VIP»?", a: ["2016", "2014", "2018", "2020"], c: 0, f: "Prima edizione condotta da Ilary Blasi e Alfonso Signorini insieme." },
    { d: 3, q: "In che anno debutta in Italia il programma «Chi l'ha visto?»?", a: ["1989", "1995", "1985", "2000"], c: 0, f: "Ideato e condotto per anni da Donatella Raffai, poi da Federica Sciarelli." },
    { d: 3, q: "In che anno nasce nel Regno Unito il talent show originale «X Factor»?", a: ["2004", "2000", "2008", "1998"], c: 0, f: "Ideato da Simon Cowell dopo l'esperienza di «Pop Idol»." },
    { d: 3, q: "Quale fu il primo vero e proprio game show della storia della TV italiana?", a: ["Lascia o raddoppia?", "L'Eredità", "Rischiatutto", "Il pranzo è servito"], c: 0, f: "Condotto da Mike Bongiorno dal 1955, fermò le strade il giovedì sera." },
    { d: 3, q: "In che anno debutta «Rischiatutto», altro storico quiz di Mike Bongiorno?", a: ["1970", "1960", "1980", "1965"], c: 0, f: "Celebre per la sfida diretta tra due soli concorrenti." },
    { d: 3, q: "Quale conduttrice italiana è nota come «zia Mara», storico volto della domenica Rai?", a: ["Mara Venier", "Antonella Clerici", "Milly Carlucci", "Caterina Balivo"], c: 0, f: "Alla guida di «Domenica In» per moltissime edizioni, non consecutive." },
    { d: 3, q: "In che anno viene fondato Facebook da Mark Zuckerberg?", a: ["2004", "2000", "2008", "2010"], c: 0, f: "Nato come piattaforma per studenti di Harvard, poi aperto a tutti nel 2006." },
    { d: 3, q: "In che anno viene fondato Instagram?", a: ["2010", "2005", "2012", "2008"], c: 0, f: "Acquistato da Facebook nel 2012 per circa un miliardo di dollari." },
    { d: 3, q: "In che anno viene lanciato YouTube?", a: ["2005", "2000", "2008", "2010"], c: 0, f: "Il primo video caricato si intitolava «Me at the zoo»." },
    { d: 3, q: "Quale fu il primo social network di massa a diffondersi in Italia, prima di Facebook?", a: ["MySpace", "Netlog", "Badoo", "Friendster"], c: 0, f: "Popolare a metà anni 2000, soprattutto tra i giovanissimi." },
    { d: 3, q: "In che anno debutta ufficialmente Twitter, oggi noto come X?", a: ["2006", "2003", "2009", "2012"], c: 0, f: "Nato con il limite dei 140 caratteri per messaggio, poi raddoppiato nel 2017." },
    { d: 3, q: "In che anno viene fondata Netflix, inizialmente come servizio di noleggio DVD per posta?", a: ["1997", "1990", "2005", "2010"], c: 0, f: "Si trasformò in piattaforma di streaming solo dal 2007." },
    { d: 3, q: "Quale programma satirico lanciò Fiorello come volto televisivo nel 1992?", a: ["Karaoke", "Non è la Rai", "Drive In", "Colorado"], c: 0, f: "In onda su Italia 1, condotto proprio da Fiorello." },
    { d: 3, q: "In quale anno viene lanciato TikTok a livello internazionale, con il nome attuale?", a: ["2018", "2015", "2020", "2012"], c: 0, f: "Nato dalla fusione con l'app musical.ly, già popolare tra i più giovani." },
    { d: 3, q: "Chi condusse la primissima edizione di «Amici», quando si chiamava ancora «Saranno famosi»?", a: ["Maria De Filippi", "Simona Ventura", "Milly Carlucci", "Paola Perego"], c: 0, f: "2001, format ancora diverso da quello attuale, senza fase serale." },
    { d: 3, q: "In che anno nasce «Blob» su Rai 3, celebre montaggio satirico di spezzoni tv?", a: ["1989", "1995", "1985", "2000"], c: 0, f: "Ideato da Enrico Ghezzi e Marco Giusti, va in onda ancora oggi ogni sera." },
    { d: 3, q: "In quale decennio nasce il fenomeno dei reality show a livello globale, con format come «Big Brother»?", a: ["Anni '90", "Anni '70", "Anni 2000", "Anni '80"], c: 0, f: "Il format olandese debuttò nel 1999, aprendo la strada a decine di varianti nazionali." },
    { d: 3, q: "Quale conduttrice ha guidato per anni «Pomeriggio Cinque» su Canale 5?", a: ["Barbara d'Urso", "Federica Panicucci", "Paola Perego", "Antonella Clerici"], c: 0, f: "In onda dal primo pomeriggio, per moltissime stagioni." },
    { d: 3, q: "In che anno debutta in Italia Videomusic, precursore italiano di MTV?", a: ["1984", "1990", "1995", "1980"], c: 0, f: "Prima che MTV arrivasse ufficialmente nel nostro paese." },
    { d: 3, q: "In che anno arriva in Italia la prima trasmissione televisiva a colori?", a: ["1977", "1970", "1980", "1965"], c: 0, f: "La Rai introdusse ufficialmente il colore con un certo ritardo rispetto ad altri paesi europei." },
    { d: 3, q: "In che anno nasce il primo network radiofonico privato in Italia, dopo la fine del monopolio Rai?", a: ["1976", "1970", "1980", "1990"], c: 0, f: "Una sentenza della Corte Costituzionale liberalizzò l'etere locale." },
    { d: 3, q: "Quale rete lanciò nel 1992 «The Real World», considerato il primo vero reality show della storia?", a: ["MTV", "CBS", "NBC", "Fox"], c: 0, f: "Seguiva un gruppo di sconosciuti conviventi, ripresi 24 ore su 24." },
    { d: 3, q: "In che anno arriva in Italia la prima edizione di «Pechino Express»?", a: ["2012", "2008", "2015", "2005"], c: 0, f: "Format adattato da un programma neozelandese." },
    { d: 3, q: "In che anno viene lanciato Snapchat, pioniere dei contenuti che scompaiono dopo poche ore?", a: ["2011", "2008", "2015", "2005"], c: 0, f: "Fu la prima app a rendere popolare il formato delle «storie» effimere." },
    { d: 3, q: "In che anno viene fondato LinkedIn, il social network professionale?", a: ["2003", "2000", "2008", "2010"], c: 0, f: "Pensato fin dall'inizio per il networking lavorativo, a differenza degli altri social generalisti." },
    { d: 3, q: "In che anno debutta in Italia la pay-tv satellitare, con i primi operatori del settore?", a: ["1996, con Telepiù e Stream", "1990", "2003, con Sky Italia direttamente", "1985"], c: 0, f: "Sky Italia nacque poi nel 2003 dalla fusione dei due operatori precedenti." },
    { d: 2, q: "Cosa indica il termine «binge-watching», diffuso con l'arrivo dello streaming?", a: ["Guardare più episodi di una serie di fila, senza interruzioni", "Guardare la TV senza audio", "Registrare un programma per vederlo dopo", "Commentare in diretta sui social mentre si guarda"], c: 0, f: "Reso ancora più comune dal rilascio di intere stagioni in un colpo solo su piattaforme come Netflix." },
    { d: 3, q: "In che anno viene fondato Twitch, piattaforma di live streaming diventata centrale per il gaming e l'intrattenimento?", a: ["2011", "2005", "2015", "2008"], c: 0, f: "Nato come costola di una piattaforma di streaming generalista chiamata Justin.tv." },
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
    { d: 2, q: "Chi ha scritto «I promessi sposi»?", a: ["Alessandro Manzoni", "Giovanni Verga", "Ugo Foscolo", "Giacomo Leopardi"], c: 0, f: "Ambientato nella Lombardia del Seicento, sotto la dominazione spagnola." },
    { d: 2, q: "Chi ha dipinto il soffitto della Cappella Sistina?", a: ["Michelangelo", "Raffaello", "Leonardo", "Botticelli"], c: 0, f: "Quattro anni di lavoro, quasi tutti in piedi su un'impalcatura." },
    { d: 2, q: "Qual è il pianeta più grande del sistema solare?", a: ["Giove", "Saturno", "Nettuno", "Urano"], c: 0, f: "Potrebbe contenere al suo interno più di 1300 Terre." },
    { d: 2, q: "Chi ha scritto «Delitto e castigo»?", a: ["Fëdor Dostoevskij", "Lev Tolstoj", "Anton Čechov", "Nikolaj Gogol'"], c: 0, f: "1866, storia di un delitto e del tormento morale che ne segue." },
    { d: 2, q: "Qual è la montagna più alta del mondo?", a: ["Everest", "K2", "Kangchenjunga", "Monte Bianco"], c: 0, f: "8.849 metri, tra Nepal e Cina." },
    { d: 2, q: "Chi sbarcò nei Caraibi nel 1492, convinto di aver raggiunto le Indie?", a: ["Cristoforo Colombo", "Amerigo Vespucci", "Marco Polo", "Vasco da Gama"], c: 0, f: "Morì senza mai sapere di aver trovato un nuovo continente." },
    { d: 2, q: "Qual è la capitale della Francia?", a: ["Parigi", "Lione", "Marsiglia", "Nizza"], c: 0, f: "Attraversata dalla Senna, con oltre 2 milioni di abitanti nel solo comune." },
    { d: 2, q: "Chi ha scritto «Guerra e pace»?", a: ["Lev Tolstoj", "Fëdor Dostoevskij", "Ivan Turgenev", "Anton Čechov"], c: 0, f: "Ambientato durante le guerre napoleoniche in Russia." },
    { d: 2, q: "Qual è l'oceano più esteso della Terra?", a: ["Pacifico", "Atlantico", "Indiano", "Artico"], c: 0, f: "Copre da solo quasi un terzo della superficie terrestre." },
    { d: 2, q: "Chi ha teorizzato l'evoluzione per selezione naturale?", a: ["Charles Darwin", "Gregor Mendel", "Jean-Baptiste Lamarck", "Alfred Wallace"], c: 0, f: "«L'origine delle specie», 1859." },
    { d: 2, q: "In quale città si trova il Colosseo?", a: ["Roma", "Napoli", "Milano", "Verona"], c: 0, f: "Costruito tra il 70 e l'80 d.C. dalla dinastia Flavia." },
    { d: 2, q: "Chi ha scritto «Anna Karenina»?", a: ["Lev Tolstoj", "Fëdor Dostoevskij", "Boris Pasternak", "Ivan Turgenev"], c: 0, f: "1877, tra i romanzi più celebri della letteratura russa." },
    { d: 2, q: "Qual è il metallo più abbondante nella crosta terrestre?", a: ["Alluminio", "Ferro", "Rame", "Oro"], c: 0, f: "Circa l'8% della crosta terrestre in peso." },
    { d: 2, q: "Chi formulò la teoria della relatività ristretta, nel 1905?", a: ["Albert Einstein", "Isaac Newton", "Niels Bohr", "Werner Heisenberg"], c: 0, f: "Lo stesso anno pubblicò anche altri tre articoli rivoluzionari." },
    { d: 2, q: "In quale continente si trova l'Egitto?", a: ["Africa", "Asia", "Europa", "Oceania"], c: 0, f: "Anche se il Sinai, una piccola parte del paese, è geograficamente in Asia." },
    { d: 2, q: "Chi ha scritto «Le avventure di Pinocchio»?", a: ["Carlo Collodi", "Gianni Rodari", "Emilio Salgari", "Edmondo De Amicis"], c: 0, f: "Pubblicato a puntate a partire dal 1881." },
    { d: 2, q: "Qual è il fiume più lungo del mondo?", a: ["Nilo", "Rio delle Amazzoni", "Mississippi", "Yangtze"], c: 0, f: "Per anni si è discusso se fosse più lungo del Rio delle Amazzoni." },
    { d: 2, q: "Chi ha dipinto «Il grido», noto anche come «L'urlo»?", a: ["Edvard Munch", "Vincent van Gogh", "Gustav Klimt", "Egon Schiele"], c: 0, f: "1893, simbolo dell'angoscia esistenziale moderna." },
    { d: 2, q: "In quale paese si trova la città inca di Machu Picchu?", a: ["Perù", "Bolivia", "Ecuador", "Cile"], c: 0, f: "Città del XV secolo, riscoperta nel 1911." },
    { d: 2, q: "Chi ha scritto «Le città invisibili»?", a: ["Italo Calvino", "Umberto Eco", "Primo Levi", "Cesare Pavese"], c: 0, f: "1972, un dialogo immaginario tra Marco Polo e Kublai Khan." },
    { d: 2, q: "Qual è la capitale della Spagna?", a: ["Madrid", "Barcellona", "Siviglia", "Valencia"], c: 0, f: "Situata quasi al centro geografico della penisola iberica." },
    { d: 2, q: "Chi ha scritto la tragedia «Amleto»?", a: ["William Shakespeare", "Christopher Marlowe", "Ben Jonson", "Oscar Wilde"], c: 0, f: "Scritta tra il 1600 e il 1601 circa." },
    { d: 2, q: "Qual è la valuta ufficiale del Regno Unito?", a: ["La sterlina", "L'euro", "Il dollaro", "La corona"], c: 0, f: "Il Regno Unito non ha mai adottato l'euro, nemmeno da membro UE." },
    { d: 2, q: "Chi ha dipinto «Le due Fride»?", a: ["Frida Kahlo", "Diego Rivera", "Remedios Varo", "Leonora Carrington"], c: 0, f: "1939, autoritratto doppio dipinto dopo il divorzio da Diego Rivera." },
    { d: 2, q: "Qual è il deserto più esteso del mondo, contando anche i deserti polari?", a: ["L'Antartide", "Il Sahara", "Il Gobi", "Il Kalahari"], c: 0, f: "Tecnicamente un deserto polare, per la scarsissima piovosità." },
    { d: 2, q: "In quale città si trova la Torre Eiffel?", a: ["Parigi", "Londra", "Roma", "Berlino"], c: 0, f: "Costruita nel 1889 per l'Esposizione Universale." },
    { d: 2, q: "Qual è la capitale della Germania?", a: ["Berlino", "Monaco di Baviera", "Francoforte", "Amburgo"], c: 0, f: "Tornata capitale dopo la riunificazione tedesca del 1990." },
    { d: 2, q: "Chi ha scritto il poema «Orlando furioso»?", a: ["Ludovico Ariosto", "Torquato Tasso", "Matteo Maria Boiardo", "Dante Alighieri"], c: 0, f: "Pubblicato nella sua forma definitiva nel 1532." },
    { d: 2, q: "Qual è il più piccolo stato sovrano del mondo?", a: ["Città del Vaticano", "San Marino", "Monaco", "Liechtenstein"], c: 0, f: "Poco meno di mezzo chilometro quadrato di estensione." },
    { d: 2, q: "Chi ha scritto «Madame Bovary»?", a: ["Gustave Flaubert", "Victor Hugo", "Émile Zola", "Honoré de Balzac"], c: 0, f: "1857, all'epoca processato per oscenità." },
    { d: 2, q: "In quale città si trova il Big Ben?", a: ["Londra", "Edimburgo", "Dublino", "Manchester"], c: 0, f: "In realtà il nome indica la campana, non la torre." },
    { d: 2, q: "Chi ha scritto «Il ritratto di Dorian Gray»?", a: ["Oscar Wilde", "Bram Stoker", "Robert Louis Stevenson", "Arthur Conan Doyle"], c: 0, f: "1890, unico romanzo pubblicato dall'autore." },
    { d: 2, q: "Qual è il vulcano attivo più famoso vicino a Napoli?", a: ["Il Vesuvio", "L'Etna", "Lo Stromboli", "I Campi Flegrei soltanto"], c: 0, f: "Distrusse Pompei ed Ercolano nel 79 d.C." },
    { d: 2, q: "Chi ha scritto «Cime tempestose»?", a: ["Emily Brontë", "Charlotte Brontë", "Jane Austen", "Virginia Woolf"], c: 0, f: "Unico romanzo pubblicato dall'autrice, uscito nel 1847." },
    { d: 2, q: "Qual è la capitale del Giappone?", a: ["Tokyo", "Kyoto", "Osaka", "Yokohama"], c: 0, f: "Kyoto fu capitale imperiale per oltre mille anni, prima di Tokyo." },
    { d: 2, q: "Chi ha formulato le leggi del moto e della gravitazione universale?", a: ["Isaac Newton", "Galileo Galilei", "Albert Einstein", "Johannes Kepler"], c: 0, f: "«Principia Mathematica», 1687." },
    { d: 2, q: "In quale museo si trova «La ronda di notte» di Rembrandt?", a: ["Rijksmuseum di Amsterdam", "Louvre di Parigi", "Prado di Madrid", "National Gallery di Londra"], c: 0, f: "Uno dei dipinti più imponenti e celebri dell'arte olandese." },
    { d: 2, q: "Chi ha scritto «Il gabbiano Jonathan Livingston»?", a: ["Richard Bach", "Paulo Coelho", "Hermann Hesse", "Kahlil Gibran"], c: 0, f: "1970, breve romanzo diventato un classico della narrativa motivazionale." },
    { d: 2, q: "Qual è il paese più esteso del mondo per superficie?", a: ["Russia", "Canada", "Cina", "Stati Uniti"], c: 0, f: "Attraversa undici fusi orari, più di ogni altro paese." },
    { d: 2, q: "Chi ha scritto il poema filosofico «Così parlò Zarathustra»?", a: ["Friedrich Nietzsche", "Arthur Schopenhauer", "Immanuel Kant", "Georg Hegel"], c: 0, f: "Scritto tra il 1883 e il 1885." },
    { d: 2, q: "Chi ha scritto il romanzo «Moby Dick»?", a: ["Herman Melville", "Mark Twain", "Nathaniel Hawthorne", "Edgar Allan Poe"], c: 0, f: "1851, ispirato in parte a un vero naufragio balenifero." },
    { d: 2, q: "Chi ha scritto «I dolori del giovane Werther»?", a: ["Johann Wolfgang von Goethe", "Friedrich Schiller", "Thomas Mann", "Heinrich Heine"], c: 0, f: "1774, scatenò una vera e propria moda emulativa tra i lettori dell'epoca." },
    { d: 2, q: "Qual è il fiume che attraversa la città di Roma?", a: ["Il Tevere", "L'Arno", "Il Po", "L'Adige"], c: 0, f: "405 km, dal Monte Fumaiolo al Mar Tirreno." },
    { d: 2, q: "Quale filosofo greco antico fu maestro di Alessandro Magno?", a: ["Aristotele", "Socrate", "Platone", "Epicuro"], c: 0, f: "Fondò il Liceo ad Atene, dove insegnava passeggiando coi discepoli." },
    { d: 2, q: "In quale città si trova la Torre di Pisa?", a: ["Pisa", "Firenze", "Lucca", "Siena"], c: 0, f: "Iniziò a pendere già durante la sua costruzione, nel XII secolo." },
    { d: 2, q: "Qual è la capitale dell'Egitto?", a: ["Il Cairo", "Alessandria", "Luxor", "Giza"], c: 0, f: "Una delle più grandi aree metropolitane dell'Africa e del Medio Oriente." },
    { d: 2, q: "Chi ha dipinto «Il bacio», celebre opera simbolista?", a: ["Gustav Klimt", "Egon Schiele", "Edvard Munch", "Oskar Kokoschka"], c: 0, f: "1908, oggi conservato al Belvedere di Vienna." },
    { d: 2, q: "In quale paese si trova la Grande Muraglia?", a: ["Cina", "Mongolia", "Corea del Nord", "Vietnam"], c: 0, f: "Costruita e ampliata nel corso di diverse dinastie, per secoli." },
    { d: 2, q: "Chi ha scritto la tragedia «Edipo re»?", a: ["Sofocle", "Eschilo", "Euripide", "Aristofane"], c: 0, f: "Tra le tragedie greche più studiate, alla base della teoria psicoanalitica freudiana." },
    { d: 2, q: "Qual è la capitale dell'India?", a: ["Nuova Delhi", "Mumbai", "Calcutta", "Bangalore"], c: 0, f: "Città pianificata come capitale coloniale britannica a inizio Novecento." },
    { d: 2, q: "Chi ha scritto il romanzo «Il piccolo principe»?", a: ["Antoine de Saint-Exupéry", "Jules Verne", "Albert Camus", "Jacques Prévert"], c: 0, f: "1943, tradotto in centinaia di lingue e dialetti." },
    { d: 2, q: "Qual è la capitale della Russia?", a: ["Mosca", "San Pietroburgo", "Novosibirsk", "Kazan"], c: 0, f: "San Pietroburgo fu capitale imperiale fino al 1918." },
    { d: 2, q: "Chi ha scritto «La metamorfosi»?", a: ["Franz Kafka", "Thomas Mann", "Hermann Hesse", "Stefan Zweig"], c: 0, f: "1915, racconta il risveglio di Gregor Samsa trasformato in insetto." },
    { d: 3, q: "In che anno cade Costantinopoli sotto gli Ottomani?", a: ["1453", "1204", "1071", "1517"], c: 0, f: "Segna convenzionalmente la fine del Medioevo per molti storici." },
    { d: 3, q: "Chi ha scritto il trattato «Il Capitale»?", a: ["Karl Marx", "Friedrich Engels", "Vladimir Lenin", "Georg Hegel"], c: 0, f: "Il primo volume uscì nel 1867, gli altri furono pubblicati postumi da Engels." },
    { d: 3, q: "In che anno fu firmata la Dichiarazione d'Indipendenza degli Stati Uniti?", a: ["1776", "1789", "1800", "1812"], c: 0, f: "4 luglio, a Filadelfia." },
    { d: 3, q: "Chi formulò la tavola periodica degli elementi nella sua forma moderna?", a: ["Dmitrij Mendeleev", "Antoine Lavoisier", "John Dalton", "Marie Curie"], c: 0, f: "1869, lasciando spazi vuoti per elementi non ancora scoperti." },
    { d: 3, q: "In quale anno fu fondata Roma, secondo la tradizione leggendaria?", a: ["753 a.C.", "509 a.C.", "44 a.C.", "27 a.C."], c: 0, f: "Data convenzionale attribuita a Romolo, fondatore mitico della città." },
    { d: 3, q: "Chi ha scritto «Il paradiso perduto»?", a: ["John Milton", "William Blake", "John Donne", "Alexander Pope"], c: 0, f: "1667, poema epico sulla caduta di Adamo ed Eva." },
    { d: 3, q: "In che secolo visse il filosofo cinese Confucio?", a: ["VI-V secolo a.C.", "III secolo a.C.", "I secolo d.C.", "X secolo a.C."], c: 0, f: "Le sue massime furono raccolte dai discepoli nei «Dialoghi»." },
    { d: 3, q: "Chi dipinse «Las Meninas»?", a: ["Diego Velázquez", "Francisco Goya", "El Greco", "Bartolomé Esteban Murillo"], c: 0, f: "1656, celebre per il complesso gioco di sguardi e specchi." },
    { d: 3, q: "In che anno scoppia la Prima Guerra Mondiale?", a: ["1914", "1912", "1916", "1918"], c: 0, f: "Innescata dall'assassinio dell'arciduca Francesco Ferdinando a Sarajevo." },
    { d: 3, q: "Quale filosofo scrisse «Il contratto sociale»?", a: ["Jean-Jacques Rousseau", "Voltaire", "Montesquieu", "John Locke"], c: 0, f: "1762, tra i testi fondanti del pensiero politico moderno." },
    { d: 3, q: "In che anno avvenne lo scisma tra Chiesa cattolica e Chiesa ortodossa?", a: ["1054", "1517", "800", "1204"], c: 0, f: "Noto come «Grande Scisma d'Oriente»." },
    { d: 3, q: "Quale scienziata fornì dati di diffrazione a raggi X decisivi per la scoperta del DNA, senza ricevere il Nobel?", a: ["Rosalind Franklin", "Linus Pauling", "Erwin Chargaff", "Maurice Wilkins"], c: 0, f: "Morì nel 1958, prima che il Nobel venisse assegnato a Watson, Crick e Wilkins." },
    { d: 3, q: "In che anno viene pubblicato il «Manifesto del Partito Comunista»?", a: ["1848", "1867", "1917", "1830"], c: 0, f: "Scritto da Marx ed Engels, nello stesso anno delle rivoluzioni europee." },
    { d: 3, q: "Quale imperatore romano rese il cristianesimo religione tollerata con l'editto di Milano?", a: ["Costantino", "Teodosio", "Diocleziano", "Nerone"], c: 0, f: "313 d.C.: sarà Teodosio a renderlo religione di stato nel 380." },
    { d: 3, q: "In che anno fu proclamato il Regno d'Italia?", a: ["1861", "1848", "1870", "1866"], c: 0, f: "Roma diventerà capitale solo nel 1871, dopo la breccia di Porta Pia del 1870." },
    { d: 3, q: "Chi ha scritto «Alla ricerca del tempo perduto»?", a: ["Marcel Proust", "André Gide", "Albert Camus", "Émile Zola"], c: 0, f: "Sette volumi pubblicati tra il 1913 e il 1927." },
    { d: 3, q: "In che secolo visse il pittore Giotto?", a: ["XIII-XIV secolo", "XV secolo", "XI secolo", "XVI secolo"], c: 0, f: "Considerato il padre della pittura moderna occidentale." },
    { d: 3, q: "Quale trattato pose fine alla Guerra dei Trent'anni, nel 1648?", a: ["La pace di Vestfalia", "Il trattato di Utrecht", "Il congresso di Vienna", "La pace di Augusta"], c: 0, f: "Segnò anche la nascita del moderno sistema degli stati sovrani europei." },
    { d: 3, q: "In che anno cadde il Regno delle Due Sicilie, con la spedizione dei Mille?", a: ["1860", "1848", "1866", "1870"], c: 0, f: "Culminata nell'incontro tra Garibaldi e Vittorio Emanuele II a Teano." },
    { d: 3, q: "Chi scrisse il trattato sulla teoria eliocentrica «De revolutionibus orbium coelestium»?", a: ["Niccolò Copernico", "Galileo Galilei", "Giordano Bruno", "Tycho Brahe"], c: 0, f: "Pubblicato nel 1543, l'anno stesso della sua morte." },
    { d: 3, q: "In che anno termina ufficialmente l'Unione Sovietica?", a: ["1991", "1989", "1985", "1995"], c: 0, f: "Il 25 dicembre 1991, con le dimissioni di Gorbačëv." },
    { d: 3, q: "Chi ha scritto il trattato filosofico «Critica della ragion pura»?", a: ["Immanuel Kant", "Georg Hegel", "Arthur Schopenhauer", "Friedrich Nietzsche"], c: 0, f: "1781, pietra miliare della filosofia moderna occidentale." },
    { d: 3, q: "In che anno fu scoperta la tomba di Tutankhamon?", a: ["1922", "1900", "1935", "1910"], c: 0, f: "Da Howard Carter, nella Valle dei Re, quasi intatta." },
    { d: 3, q: "Quale civiltà precolombiana costruì Machu Picchu?", a: ["Gli Inca", "I Maya", "Gli Aztechi", "Gli Olmechi"], c: 0, f: "XV secolo, nel cuore delle Ande peruviane." },
    { d: 3, q: "In che anno entra in vigore la Costituzione della Repubblica Italiana?", a: ["1948", "1946", "1861", "1970"], c: 0, f: "Il 1° gennaio 1948, dopo l'approvazione dell'Assemblea Costituente." },
    { d: 3, q: "Chi ha scritto il poema epico «Gerusalemme liberata»?", a: ["Torquato Tasso", "Ludovico Ariosto", "Dante Alighieri", "Francesco Petrarca"], c: 0, f: "Pubblicato nel 1581, racconta la prima crociata." },
    { d: 3, q: "In che anno ha inizio la Rivoluzione russa che porterà alla caduta dello zar?", a: ["1917", "1905", "1922", "1914"], c: 0, f: "Due rivoluzioni nello stesso anno: quella di febbraio e quella di ottobre." },
  ],
  cibo: [
    { d: 2, q: "Da quale città prende il nome la pizza Margherita?", a: ["Nessuna: dalla regina Margherita di Savoia", "Napoli", "Margherita di Savoia (BR)", "Roma"], c: 0, f: "1889. I colori pomodoro, mozzarella e basilico richiamavano la bandiera italiana." },
    { d: 2, q: "Qual è l'ingrediente principale del guacamole?", a: ["Avocado", "Pomodoro", "Fagioli", "Peperoncino"], c: 0, f: "Dal nahuatl «ahuacamolli», letteralmente «salsa di avocado»." },
    { d: 2, q: "Da quale paese ha origine il sushi?", a: ["Giappone", "Cina", "Corea del Sud", "Thailandia"], c: 0, f: "Nasce come metodo di conservazione del pesce nel riso fermentato, non come piatto gourmet." },
    { d: 2, q: "Qual è l'ingrediente che rende piccante il peperoncino?", a: ["Capsaicina", "Piperina", "Mentolo", "Allicina"], c: 0, f: "Il piccante si misura in unità Scoville, dal nome del chimico che le ideò nel 1912." },
    { d: 2, q: "Con quale latte si fa tradizionalmente la mozzarella di bufala campana?", a: ["Latte di bufala", "Latte di capra", "Latte di pecora", "Latte vaccino"], c: 0, f: "DOP dal 1996, prodotta soprattutto tra Caserta e Salerno." },
    { d: 2, q: "Qual è l'ingrediente base del tiramisù?", a: ["Mascarpone", "Ricotta", "Panna montata", "Yogurt greco"], c: 0, f: "Ricetta relativamente giovane: le prime tracce scritte risalgono agli anni '60-'70." },
    { d: 2, q: "Da quale pianta si ricava il cioccolato?", a: ["Cacao", "Vaniglia", "Caffè", "Carruba"], c: 0, f: "I semi vengono fermentati, essiccati e tostati prima di diventare cioccolato." },
    { d: 2, q: "Qual è il formaggio tipicamente usato nella vera carbonara?", a: ["Pecorino romano", "Parmigiano", "Grana padano", "Provolone"], c: 0, f: "Niente panna nella ricetta originale: solo uova, guanciale, pecorino e pepe." },
    { d: 2, q: "In quale paese è nato il croissant, oggi simbolo della colazione francese?", a: ["Austria", "Francia", "Belgio", "Italia"], c: 0, f: "Deriverebbe dal «kipferl» viennese, portato in Francia nell'Ottocento." },
    { d: 2, q: "Qual è l'ingrediente che fa lievitare il pane?", a: ["Lievito", "Bicarbonato", "Zucchero", "Sale"], c: 0, f: "Produce anidride carbonica fermentando gli zuccheri dell'impasto, gonfiandolo." },
    { d: 2, q: "Da quale paese arriva originariamente la pasta, secondo la leggenda smentita legata a Marco Polo?", a: ["Nessuna leggenda: è italiana da secoli prima di lui", "Cina", "Persia", "Arabia"], c: 0, f: "Tracce di pasta secca in Sicilia risalgono già al XII secolo, ben prima dei viaggi di Marco Polo." },
    { d: 2, q: "Qual è il liquore base dello Spritz veneziano classico?", a: ["Aperol o Select", "Vodka", "Gin", "Vermouth rosso"], c: 0, f: "Nasce dall'abitudine austro-ungarica di allungare il vino locale, ritenuto troppo forte." },
    { d: 2, q: "Che tipo di alimento è il kimchi coreano?", a: ["Verdura fermentata e piccante", "Zuppa di pesce", "Dolce al riso", "Formaggio stagionato"], c: 0, f: "Di solito a base di cavolo cinese, sale, aglio e peperoncino. Un piatto simbolo della Corea." },
    { d: 2, q: "Qual è l'ingrediente segreto che rende «al dente» la pasta perfetta?", a: ["Il tempo di cottura giusto", "Il bicarbonato", "L'olio nell'acqua", "Il sale grosso"], c: 0, f: "L'olio nell'acqua è un falso mito: non impedisce affatto alla pasta di attaccarsi." },
    { d: 2, q: "Che cos'è il wasabi, tipicamente servito con il sushi?", a: ["Una radice piccante", "Un'alga", "Un tipo di soia", "Un fungo"], c: 0, f: "Il vero wasabi fresco è raro e costoso: spesso al ristorante è rafano tinto di verde." },
    { d: 2, q: "Da quale animale si ricava il prosciutto di Parma?", a: ["Maiale", "Cinghiale", "Vitello", "Anatra"], c: 0, f: "Stagionato almeno 12 mesi, DOP dal 1996." },
    { d: 2, q: "Qual è l'ingrediente principale della paella valenciana tradizionale?", a: ["Riso", "Pasta", "Couscous", "Patate"], c: 0, f: "La ricetta originale, dalla campagna di Valencia, prevedeva coniglio e pollo, non frutti di mare." },
    { d: 2, q: "Che tipo di bevanda è il matcha?", a: ["Tè verde in polvere", "Caffè giapponese", "Infuso di zenzero", "Bevanda fermentata al riso"], c: 0, f: "Le foglie vengono coltivate all'ombra prima di essere macinate finissime." },
    { d: 2, q: "Qual è la salsa base della pizza margherita?", a: ["Pomodoro", "Besciamella", "Pesto", "Panna"], c: 0, f: "Il San Marzano, coltivato vicino al Vesuvio, è tra i pomodori più usati per questa salsa." },
    { d: 2, q: "In quale città italiana è nata la tradizione del panettone?", a: ["Milano", "Torino", "Verona", "Bologna"], c: 0, f: "Diverse leggende ne raccontano l'origine, tutte ambientate a corte, nessuna verificabile." },
    { d: 2, q: "Qual è l'ingrediente che dà il colore giallo al risotto alla milanese?", a: ["Zafferano", "Curcuma", "Curry", "Peperone giallo"], c: 0, f: "Si narra sia nato per scherzo da un vetraio che lo usava per colorare le vetrate del Duomo." },
    { d: 2, q: "Che cos'è l'hummus, piatto tipico mediorientale?", a: ["Crema di ceci", "Zuppa di lenticchie", "Insalata di melanzane", "Purè di patate"], c: 0, f: "Con tahina, limone, aglio e olio: uno dei piatti più contesi della cucina mediorientale." },
    { d: 2, q: "Da quale regione italiana ha origine il pesto alla genovese?", a: ["Liguria", "Toscana", "Campania", "Sicilia"], c: 0, f: "Basilico, pinoli, aglio, parmigiano, pecorino e olio: pestati, non frullati, nella ricetta originale." },
    { d: 2, q: "Qual è l'alcolico usato per fiammeggiare la crêpe Suzette?", a: ["Grand Marnier (o cognac)", "Rum", "Whisky", "Amaretto"], c: 0, f: "Leggenda vuole sia nata per un errore in cucina davanti al futuro Edoardo VII d'Inghilterra." },
    { d: 2, q: "Che cosa sono i canederli, piatto tipico dell'Alto Adige?", a: ["Grosse polpette di pane raffermo", "Gnocchi di patate", "Ravioli ripieni", "Involtini di carne"], c: 0, f: "Spesso serviti in brodo o conditi con burro fuso: retaggio della cucina austro-tedesca." },
    { d: 3, q: "Qual è il fungo più costoso al mondo, molto usato nella cucina piemontese?", a: ["Tartufo bianco d'Alba", "Porcino", "Chiodino", "Champignon"], c: 0, f: "Non si è mai riusciti a coltivarlo con successo: cresce solo spontaneamente." },
    { d: 3, q: "Da quale paese proviene originariamente il caffè, prima di diffondersi nel mondo arabo?", a: ["Etiopia", "Yemen", "Brasile", "Turchia"], c: 0, f: "Secondo la leggenda fu scoperto da un pastore che notò le sue capre iperattive dopo averne mangiato le bacche." },
    { d: 3, q: "Qual è la temperatura ideale per la cottura della pizza in un forno a legna tradizionale napoletano?", a: ["Circa 430-480°C", "Circa 250°C", "Circa 150°C", "Circa 600-700°C"], c: 0, f: "Con queste temperature la pizza napoletana cuoce in appena 60-90 secondi." },
    { d: 3, q: "Che cos'è l'umami, considerato il quinto gusto fondamentale oltre a dolce, salato, amaro e acido?", a: ["Il sapore \"saporito\" tipico del glutammato", "Il gusto piccante", "Il retrogusto amarognolo del caffè", "Il gusto astringente del vino"], c: 0, f: "Scoperto dal chimico giapponese Kikunae Ikeda nel 1908, studiando il dashi." },
    { d: 3, q: "Quale città italiana rivendica l'invenzione dello spritz nella sua forma più diffusa oggi?", a: ["Venezia", "Padova", "Trieste", "Milano"], c: 0, f: "L'Aperol, ingrediente chiave dello spritz moderno, nasce a Padova nel 1919." },
    { d: 3, q: "Qual è il vero nome della salsa che in Italia chiamiamo comunemente «maionese»?", a: ["Non cambia nome: maionese", "Aioli", "Remoulade", "Béarnaise"], c: 0, f: "L'aioli, spesso confusa con la maionese, è invece una salsa a base di aglio e olio, tipica provenzale e catalana." },
    { d: 3, q: "In quale paese è nato il croissant «kipferl» da cui deriva quello francese?", a: ["Austria", "Germania", "Ungheria", "Polonia"], c: 0, f: "Si narra sia stato creato per celebrare la vittoria contro l'assedio ottomano di Vienna nel 1683." },
    { d: 3, q: "Qual è l'unico continente dove non cresce naturalmente il cacao?", a: ["Europa", "Asia", "Oceania", "Antartide (nessun continente, tranne quello ovvio)"], c: 0, f: "Il cacao cresce solo in una fascia tropicale intorno all'equatore: l'Europa non rientra mai in quella zona." },
    { d: 3, q: "Da quale città prende il nome il famoso panino «hamburger»?", a: ["Amburgo", "Francoforte", "Berlino", "Monaco"], c: 0, f: "Portato negli Stati Uniti dagli emigranti tedeschi nell'Ottocento, poi reinventato completamente." },
    { d: 3, q: "Qual è l'ingrediente che rende «piccante» il wasabi vero, chimicamente diverso dalla capsaicina del peperoncino?", a: ["Isotiocianato di allile", "Capsaicina", "Piperina", "Gingerolo"], c: 0, f: "Per questo il piccante del wasabi \"sale al naso\" invece che restare sulla lingua come il peperoncino." },
    { d: 2, q: "Qual è l'ingrediente principale della carbonara, oltre a uova e pecorino?", a: ["Guanciale", "Pancetta", "Speck", "Salame"], c: 0, f: "La pancetta è un errore comune: la vera carbonara usa il guanciale." },
    { d: 2, q: "Da quale animale si ricava il latte per il Grana Padano?", a: ["Mucca", "Capra", "Pecora", "Bufala"], c: 0, f: "Prodotto in una vasta area della Pianura Padana, con regole DOP rigide." },
    { d: 2, q: "Qual è l'ingrediente principale del baba ganoush, piatto mediorientale?", a: ["Melanzana grigliata", "Ceci", "Zucchine", "Peperoni"], c: 0, f: "Simile all'hummus, ma a base di melanzana affumicata invece che ceci." },
    { d: 2, q: "Che cos'è il miso, condimento base della cucina giapponese?", a: ["Pasta fermentata di soia", "Salsa di pesce", "Aceto di riso", "Olio di sesamo"], c: 0, f: "Usato soprattutto per la celebre zuppa omonima." },
    { d: 2, q: "Da quale pianta si ricava lo zucchero più comune al mondo, insieme alla barbabietola?", a: ["La canna da zucchero", "Il mais", "Il grano", "La palma da dattero"], c: 0, f: "Coltivata soprattutto in Brasile, India e sud-est asiatico." },
    { d: 2, q: "Qual è l'ingrediente base della besciamella?", a: ["Burro, farina e latte", "Panna e formaggio", "Uova e olio", "Brodo e farina"], c: 0, f: "Salsa francese, chiamata anche «balsamella» in alcune ricette italiane." },
    { d: 2, q: "Qual è il colore rosso del Campari, tradizionalmente?", a: ["Storicamente ottenuto dalla cocciniglia, oggi da coloranti alimentari", "Dal peperoncino", "Dalla barbabietola", "Dal pomodoro"], c: 0, f: "La ricetta esatta del Campari resta segreta ancora oggi." },
    { d: 2, q: "Che cos'è il tempura, tecnica di cottura giapponese?", a: ["Frittura in pastella leggera", "Cottura al vapore", "Affumicatura", "Marinatura nell'aceto"], c: 0, f: "Introdotta in Giappone dai missionari portoghesi nel XVI secolo." },
    { d: 2, q: "Qual è l'ingrediente principale del ceviche, piatto tipico sudamericano?", a: ["Pesce crudo marinato nel succo di agrumi", "Carne alla griglia", "Riso e fagioli", "Mais bollito"], c: 0, f: "Diffuso soprattutto in Perù ed Ecuador." },
    { d: 2, q: "Da quale paese proviene originariamente il curry, come miscela di spezie?", a: ["India", "Thailandia", "Cina", "Giappone"], c: 0, f: "Il termine «curry» fu poi generalizzato dagli inglesi durante il colonialismo." },
    { d: 2, q: "Cosa rende scuro e concentrato il caffè espresso rispetto ad altre preparazioni?", a: ["L'alta pressione e la tostatura scura", "Il latte aggiunto", "Lo zucchero caramellato", "Il ghiaccio"], c: 0, f: "L'espresso nasce a Milano a inizio Novecento, con le prime macchine a pressione." },
    { d: 2, q: "Che cos'è il kefir?", a: ["Una bevanda fermentata a base di latte", "Un tipo di formaggio stagionato", "Un dolce a base di miele", "Una zuppa fredda"], c: 0, f: "Originario del Caucaso, ricco di fermenti probiotici." },
    { d: 2, q: "Qual è l'ingrediente principale della fonduta valdostana?", a: ["Formaggio Fontina fuso", "Cioccolato fuso", "Panna e funghi", "Besciamella"], c: 0, f: "La fonduta al cioccolato è invece una variante dolce diversa, di origine svizzera." },
    { d: 2, q: "Da quale paese ha origine il goulash, spezzatino con paprika?", a: ["Ungheria", "Austria", "Polonia", "Repubblica Ceca"], c: 0, f: "Nato come piatto dei mandriani, cotto in un calderone sul fuoco all'aperto." },
    { d: 2, q: "Qual è l'ingrediente principale dei mochi giapponesi?", a: ["Riso glutinoso pestato", "Farina di grano", "Fecola di patate", "Farina di mais"], c: 0, f: "Tradizionalmente preparati battendo il riso cotto con grandi magli di legno." },
    { d: 2, q: "Che cos'è il tofu?", a: ["Formaggio di soia, ottenuto cagliando il latte di soia", "Un tipo di alga", "Una farina di legumi", "Un fungo commestibile"], c: 0, f: "Diffuso in tutta l'Asia orientale da oltre duemila anni." },
    { d: 2, q: "Qual è l'ingrediente principale della sangria spagnola?", a: ["Vino rosso e frutta", "Birra e limone", "Rum e menta", "Vodka e frutti rossi"], c: 0, f: "Spesso aromatizzata con cannella o agrumi." },
    { d: 2, q: "Da quale regione italiana ha origine la bagna cauda?", a: ["Piemonte", "Liguria", "Lombardia", "Emilia-Romagna"], c: 0, f: "A base di aglio, acciughe e olio, servita calda con verdure crude." },
    { d: 2, q: "Oltre all'avocado, quali sono gli ingredienti base del guacamole?", a: ["Lime, cipolla e coriandolo", "Solo panna acida", "Solo pomodoro", "Solo peperoncino verde"], c: 0, f: "Le varianti regionali messicane cambiano molto gli ingredienti secondari." },
    { d: 2, q: "Che tipo di alimento è il pastrami?", a: ["Carne di manzo affumicata e speziata", "Un formaggio stagionato", "Un tipo di pane azzimo", "Un dolce ebraico"], c: 0, f: "Piatto simbolo della cucina ebraico-americana di New York." },
    { d: 2, q: "Qual è l'ingrediente principale dello tzatziki greco?", a: ["Yogurt e cetriolo", "Melanzane e tahina", "Pomodoro e feta", "Fave e olio"], c: 0, f: "Spesso aromatizzato con aglio e menta o aneto." },
    { d: 2, q: "Da quale paese ha origine il sashimi?", a: ["Giappone", "Corea del Sud", "Cina", "Thailandia"], c: 0, f: "A differenza del sushi, non prevede riso: è solo pesce crudo tagliato finemente." },
    { d: 2, q: "Qual è l'ingrediente principale del pad thai?", a: ["Noodles di riso saltati", "Riso al vapore", "Spaghetti di grano", "Gnocchi di riso"], c: 0, f: "Piatto simbolo della cucina di strada thailandese." },
    { d: 2, q: "Che cos'è la burrata pugliese?", a: ["Un formaggio fresco con cuore cremoso di stracciatella", "Un salume stagionato", "Un tipo di pane", "Un dolce al cucchiaio"], c: 0, f: "Nata ad Andria, in Puglia, agli inizi del Novecento." },
    { d: 2, q: "Qual è l'ingrediente principale della tortilla de patatas spagnola?", a: ["Patate e uova", "Farina di mais", "Solo formaggio", "Peperoni e cipolle soltanto"], c: 0, f: "Uno dei piatti più iconici e discussi, con o senza cipolla, della cucina spagnola." },
    { d: 2, q: "Da quale area geografica proviene il falafel?", a: ["Medio Oriente, probabilmente l'Egitto in origine", "Italia", "Grecia", "Marocco soltanto"], c: 0, f: "Polpette fritte di ceci o fave, oggi diffuse in tutto il mondo." },
    { d: 2, q: "Qual è l'ingrediente principale della cheesecake classica newyorkese?", a: ["Formaggio cremoso tipo Philadelphia", "Ricotta soltanto", "Panna montata soltanto", "Yogurt greco"], c: 0, f: "La base biscottata è tipicamente di biscotti secchi o pan di Spagna." },
    { d: 2, q: "Che cos'è il dashi, brodo base della cucina giapponese?", a: ["Un brodo di alga kombu e scaglie di bonito", "Un brodo di pollo", "Un brodo di sole verdure", "Un brodo di miso puro"], c: 0, f: "Alla base di zuppe, salse e moltissimi piatti tradizionali giapponesi." },
    { d: 2, q: "Qual è l'ingrediente principale della moussaka greca?", a: ["Melanzane e carne macinata", "Zucchine e formaggio", "Patate e pesce", "Peperoni e riso"], c: 0, f: "Coperta tipicamente da uno strato di besciamella gratinata." },
    { d: 2, q: "Da quale regione italiana ha origine l'arancino/arancina?", a: ["Sicilia", "Campania", "Puglia", "Calabria"], c: 0, f: "Il dibattito su genere maschile o femminile del nome è ancora acceso tra le province siciliane." },
    { d: 2, q: "Qual è l'ingrediente principale del gazpacho andaluso?", a: ["Pomodoro crudo frullato", "Zucca", "Melanzana", "Cavolo"], c: 0, f: "Servito freddo, tipico dell'estate spagnola." },
    { d: 2, q: "Che cos'è il prosecco, dal punto di vista tecnico?", a: ["Uno spumante o vino frizzante italiano", "Un liquore digestivo", "Un vino rosso corposo", "Un distillato"], c: 0, f: "Prodotto principalmente in Veneto e Friuli, dal vitigno Glera." },
    { d: 2, q: "Qual è l'ingrediente principale del pho vietnamita?", a: ["Brodo di carne con noodles di riso", "Riso fritto", "Zuppa di miso", "Curry di cocco"], c: 0, f: "Piatto nazionale del Vietnam, diffuso in tutto il mondo." },
    { d: 2, q: "Da quale paese ha origine il gelato come lo conosciamo, secondo la tradizione più diffusa?", a: ["Italia", "Francia", "Cina", "Turchia"], c: 0, f: "Pur con precedenti antichi in altre culture, la tradizione moderna nasce in Italia." },
    { d: 2, q: "Qual è l'ingrediente principale dei ravioli cinesi (jiaozi)?", a: ["Carne o verdure racchiuse in un involucro di pasta", "Solo riso", "Solo pesce crudo", "Solo tofu"], c: 0, f: "Tradizionalmente si preparano in famiglia per il Capodanno cinese." },
    { d: 2, q: "Che cos'è il kombucha?", a: ["Un tè fermentato", "Un tipo di sushi", "Una salsa piccante", "Un dolce al cucchiaio"], c: 0, f: "Ottenuto fermentando tè zuccherato con una coltura di batteri e lieviti." },
    { d: 2, q: "Qual è l'ingrediente principale della crema pasticcera?", a: ["Uova, zucchero, latte e farina o amido", "Solo panna montata", "Solo mascarpone", "Solo cioccolato fuso"], c: 0, f: "Base di moltissimi dolci italiani, dalle bignè al tiramisù." },
    { d: 2, q: "Da quale paese ha origine il ramen, oggi associato al Giappone?", a: ["Cina, poi reinventato in Giappone", "Solo Giappone", "Corea del Sud", "Vietnam"], c: 0, f: "Arrivò in Giappone nell'Ottocento e venne poi completamente reinterpretato." },
    { d: 2, q: "Qual è l'ingrediente base della polenta?", a: ["Farina di mais", "Farina di grano", "Farina di castagne soltanto", "Farina di riso"], c: 0, f: "Piatto povero diventato simbolo della cucina del Nord Italia." },
    { d: 2, q: "Che cos'è il seitan, alimento a base vegetale?", a: ["Glutine di frumento lavorato", "Un tipo di alga", "Un fungo", "Un legume"], c: 0, f: "Molto usato nella cucina vegetariana e vegana come sostituto della carne." },
    { d: 2, q: "Qual è l'ingrediente principale del tabbouleh libanese?", a: ["Prezzemolo e bulgur", "Riso e pollo", "Melanzane e tahina", "Ceci e cumino"], c: 0, f: "Insalata fresca, spesso arricchita con pomodoro, menta e limone." },
    { d: 2, q: "Da quale regione italiana ha origine la focaccia genovese?", a: ["Liguria", "Puglia", "Toscana", "Sicilia"], c: 0, f: "Impastata con abbondante olio d'oliva, tipicamente bucherellata in superficie." },
    { d: 2, q: "Qual è l'ingrediente principale del cannolo siciliano?", a: ["Ricotta di pecora", "Mascarpone", "Panna montata", "Crema pasticcera soltanto"], c: 0, f: "La scorza croccante viene fritta a parte e farcita solo al momento di servire." },
    { d: 2, q: "Che cos'è l'agrodolce, tecnica presente in molte cucine del mondo?", a: ["L'unione di sapori acidi e dolci nello stesso piatto", "Solo l'uso dell'aceto", "Solo l'uso dello zucchero", "Una tecnica di cottura al vapore"], c: 0, f: "Presente sia nella cucina cinese sia in quella siciliana, con origini indipendenti." },
    { d: 2, q: "Qual è l'ingrediente principale del pesto alla trapanese, variante siciliana?", a: ["Pomodoro, mandorle e basilico", "Solo basilico e pinoli", "Solo noci e gorgonzola", "Solo peperoni"], c: 0, f: "A differenza del pesto genovese, non prevede formaggi in molte varianti." },
    { d: 2, q: "Da quale paese proviene il churro, dolce fritto a forma di bastoncino?", a: ["Spagna", "Messico soltanto", "Portogallo", "Argentina soltanto"], c: 0, f: "Diffuso poi in tutta l'America Latina grazie ai colonizzatori spagnoli." },
    { d: 2, q: "Qual è l'ingrediente principale della crema di limoncello?", a: ["Scorze di limone macerate in alcol", "Succo di limone soltanto", "Buccia d'arancia", "Miele e limone"], c: 0, f: "Tipico della Costiera amalfitana e della Sicilia." },
    { d: 2, q: "Che cos'è la feta, formaggio simbolo della Grecia?", a: ["Formaggio a pasta molle, tradizionalmente di latte di pecora o capra", "Formaggio stagionato di mucca", "Formaggio fuso spalmabile", "Formaggio affumicato"], c: 0, f: "Conservata tradizionalmente in salamoia." },
    { d: 3, q: "In che secolo si diffonde davvero il pomodoro nella cucina italiana, dopo l'arrivo dalle Americhe?", a: ["XVIII secolo", "XV secolo", "XX secolo", "XII secolo"], c: 0, f: "Arrivato in Europa nel Cinquecento, per secoli fu considerato solo una pianta ornamentale o velenosa." },
    { d: 3, q: "In che anno viene inventata la Coca-Cola?", a: ["1886", "1900", "1875", "1920"], c: 0, f: "Creata ad Atlanta da un farmacista come tonico medicinale." },
    { d: 3, q: "Quale sostanza rende il cioccolato tossico per i cani?", a: ["La teobromina", "La caffeina soltanto", "Lo zucchero", "Il glutine"], c: 0, f: "I cani la metabolizzano molto più lentamente degli esseri umani." },
    { d: 3, q: "A cosa si deve soprattutto la forma alta e soffice del panettone diffusa oggi?", a: ["Alla produzione industriale del Novecento", "A una ricetta medievale invariata", "A un'invenzione del Settecento", "A un'usanza dell'antica Roma"], c: 0, f: "La forma a cupola diffusa oggi è relativamente recente rispetto alla lunga storia del dolce." },
    { d: 3, q: "A quale temperatura circa va temperato il cioccolato fondente per una lucentezza perfetta?", a: ["Circa 31-32°C", "Circa 50°C", "Circa 20°C", "Circa 40°C"], c: 0, f: "Il temperaggio stabilizza i cristalli di burro di cacao, evitando striature bianche." },
    { d: 3, q: "In quale secolo viene introdotta in Europa la patata, originaria delle Ande?", a: ["XVI secolo", "XII secolo", "XVIII secolo", "XX secolo"], c: 0, f: "Portata dai conquistadores spagnoli, ci vollero comunque decenni prima che si diffondesse come alimento comune." },
    { d: 3, q: "Da quale lingua deriva probabilmente la parola «pasta»?", a: ["Dal greco «pastá», farina mista a salsa", "Dal latino «panis»", "Dall'arabo, esclusivamente", "Dal cinese «mian»"], c: 0, f: "Il termine arabo «itryah» indicava invece un tipo di pasta secca medievale, diffusa in Sicilia." },
    { d: 3, q: "In che anno viene brevettata la prima macchina per caffè espresso a pressione?", a: ["1901", "1880", "1920", "1950"], c: 0, f: "Brevettata da Luigi Bezzera, a Milano." },
    { d: 3, q: "Qual è l'origine leggendaria del nome «sandwich»?", a: ["Il Conte di Sandwich, per non lasciare il tavolo da gioco", "Una città inglese, senza legami con persone", "Un cuoco francese", "Un termine tedesco"], c: 0, f: "XVIII secolo: la leggenda narra che non volesse interrompere una partita a carte per mangiare." },
    { d: 3, q: "In che anno il franchising moderno di McDonald's prende davvero forma con Ray Kroc?", a: ["1955", "1940", "1970", "1920"], c: 0, f: "Il primo ristorante dei fratelli McDonald risale invece al 1940." },
    { d: 3, q: "Quale specie di pianta del caffè rappresenta circa il 60-70% della produzione mondiale?", a: ["Coffea arabica", "Coffea robusta soltanto", "Coffea liberica", "Coffea canephora esclusivamente"], c: 0, f: "La qualità robusta, più economica, copre gran parte del resto della produzione." },
    { d: 3, q: "In che secolo si diffonde in Europa l'abitudine di bere il tè, importato dalla Cina?", a: ["XVII secolo", "XII secolo", "XX secolo", "XV secolo"], c: 0, f: "Diffuso soprattutto grazie alle compagnie commerciali olandesi e inglesi." },
    { d: 3, q: "Da dove deriva il nome «champagne»?", a: ["Dall'omonima regione francese", "Da un vitigno spagnolo", "Da un termine latino generico per «vino frizzante»", "Da una città tedesca"], c: 0, f: "Solo gli spumanti prodotti in quella specifica regione francese possono chiamarsi ufficialmente così." },
    { d: 3, q: "In che anno viene fondata la catena di pizzerie Pizza Hut?", a: ["1958", "1940", "1970", "1985"], c: 0, f: "Fondata da due fratelli studenti in Kansas, con un piccolo prestito dalla madre." },
    { d: 3, q: "Cosa contribuisce principalmente al gusto amaro del caffè non zuccherato?", a: ["La caffeina e gli acidi clorogenici", "Lo zucchero caramellato", "Il sale", "L'olio essenziale del chicco"], c: 0, f: "La tostatura influenza fortemente l'intensità di questo gusto." },
    { d: 3, q: "In che periodo storico si diffonde in Italia l'uso della forchetta a tavola, oggi scontato?", a: ["Tra l'XI e il XVI secolo, con forte resistenza iniziale", "Nell'antica Roma", "Nel Novecento", "Nel Cinquecento in tutta Europa contemporaneamente"], c: 0, f: "Introdotta prima a Venezia, fu per secoli considerata un vezzo effeminato altrove in Europa." },
    { d: 3, q: "Cosa significa letteralmente l'espressione «al dente», riferita alla cottura della pasta?", a: ["Percepibile ancora, leggermente resistente sotto il dente", "Cotta fino a sfaldarsi", "Cruda al centro", "Bollita più volte"], c: 0, f: "Indica una consistenza né troppo dura né troppo morbida." },
    { d: 3, q: "In che anno circa Louis Pasteur sviluppa la tecnica della pastorizzazione?", a: ["1864", "1900", "1850", "1920"], c: 0, f: "Sviluppata inizialmente per il vino, poi estesa ad altri alimenti liquidi." },
    { d: 3, q: "Qual è l'origine storica del kebab, oggi diffuso globalmente come cibo di strada?", a: ["Medio Oriente e Impero Ottomano", "Cina", "India", "Grecia soltanto"], c: 0, f: "La versione verticale allo spiedo, il döner kebab, si sviluppa nella forma moderna nell'Ottocento turco." },
    { d: 3, q: "In che secolo viene introdotto in Europa lo zucchero di canna su larga scala, tramite il commercio coloniale?", a: ["XVI-XVII secolo", "XII secolo", "XX secolo", "IX secolo"], c: 0, f: "Legato tragicamente anche alla storia della tratta atlantica degli schiavi nelle piantagioni." },
    { d: 3, q: "Da dove deriva, secondo la leggenda, il nome del cocktail «Negroni»?", a: ["Dal Conte Camillo Negroni, a Firenze", "Da una città italiana", "Da un barman francese", "Dal colore del bicchiere usato originariamente"], c: 0, f: "Si narra abbia chiesto al barman di rinforzare un Americano sostituendo la soda con il gin." },
    { d: 2, q: "Qual è l'ingrediente principale della piadina romagnola?", a: ["Farina, acqua, sale e strutto o olio", "Solo farina e acqua", "Farina di mais", "Farina di castagne"], c: 0, f: "Cotta tradizionalmente su una piastra di terracotta chiamata «testo»." },
  ],
  cinema: [
    { d: 2, q: "Chi ha diretto «Titanic»?", a: ["James Cameron", "Steven Spielberg", "Ridley Scott", "Michael Bay"], c: 0, f: "1997. Undici premi Oscar, pareggiando il record di «Ben-Hur»." },
    { d: 2, q: "Quale film ha vinto il primo Oscar della storia, nel 1929?", a: ["Ali", "Il cantante di jazz", "Metropolis", "Luci della città"], c: 0, f: "Cerimonia durata appena 15 minuti, senza suspense: i vincitori erano già noti da mesi." },
    { d: 2, q: "Chi interpreta Jack Sparrow nella saga «Pirati dei Caraibi»?", a: ["Johnny Depp", "Orlando Bloom", "Geoffrey Rush", "Javier Bardem"], c: 0, f: "Depp si ispirò a Keith Richards dei Rolling Stones per il personaggio." },
    { d: 2, q: "In quale città è ambientato «Il Padrino»?", a: ["New York", "Chicago", "Las Vegas", "Boston"], c: 0, f: "1972, di Francis Ford Coppola. La scena della testa di cavallo usò un vero teschio di animale." },
    { d: 2, q: "Chi ha diretto «Pulp Fiction»?", a: ["Quentin Tarantino", "Martin Scorsese", "David Fincher", "Guy Ritchie"], c: 0, f: "1994. Vinse la Palma d'Oro a Cannes, tra i fischi di parte della critica presente." },
    { d: 2, q: "Qual è il film d'animazione Disney più vecchio tra questi?", a: ["Biancaneve e i sette nani", "Il Re Leone", "La Sirenetta", "Aladdin"], c: 0, f: "1937, il primo lungometraggio animato della storia del cinema." },
    { d: 2, q: "Chi interpreta Neo in «Matrix»?", a: ["Keanu Reeves", "Will Smith", "Tom Cruise", "Brad Pitt"], c: 0, f: "1999, delle sorelle Wachowski. Reeves rifiutò il ruolo due volte prima di accettarlo." },
    { d: 2, q: "In quale film compare la celebre frase «Che vada al diavolo, francamente»?", a: ["Via col vento", "Casablanca", "Cittadino Kane", "Il mago di Oz"], c: 0, f: "1939. Costò allo studio una multa per linguaggio scurrile in un'epoca di censura ferrea." },
    { d: 2, q: "Chi ha diretto la trilogia originale de «Il Signore degli Anelli»?", a: ["Peter Jackson", "Guillermo del Toro", "Ridley Scott", "James Cameron"], c: 0, f: "Girata quasi interamente in Nuova Zelanda, tutta insieme in un'unica maratona produttiva." },
    { d: 2, q: "Quale attore ha interpretato Tony Stark / Iron Man nel Marvel Cinematic Universe?", a: ["Robert Downey Jr.", "Chris Evans", "Chris Hemsworth", "Mark Ruffalo"], c: 0, f: "Il ruolo che rilanciò la sua carriera dopo anni difficili." },
    { d: 2, q: "Chi ha diretto «Psyco»?", a: ["Alfred Hitchcock", "Stanley Kubrick", "Orson Welles", "Billy Wilder"], c: 0, f: "1960. La scena della doccia richiese sette giorni di riprese per 45 secondi di film." },
    { d: 2, q: "In quale saga compare il personaggio di Darth Vader?", a: ["Star Wars", "Star Trek", "Dune", "Guardiani della Galassia"], c: 0, f: "La sua voce è di James Earl Jones, che non compare mai a volto scoperto nel casting originale." },
    { d: 2, q: "Chi ha vinto l'Oscar come miglior attore per «Joker» (2019)?", a: ["Joaquin Phoenix", "Leonardo DiCaprio", "Christian Bale", "Jared Leto"], c: 0, f: "Perse quasi 24 kg per il ruolo, seguendo una dieta estrema e non consigliata." },
    { d: 2, q: "Qual è il film con maggiori incassi di sempre al box office mondiale (senza inflazione)?", a: ["Avatar", "Avengers: Endgame", "Titanic", "Star Wars: Il risveglio della Forza"], c: 0, f: "James Cameron ha diretto sia il primo che il terzo film di questa classifica." },
    { d: 2, q: "Chi interpreta Forrest Gump?", a: ["Tom Hanks", "Kevin Costner", "Robin Williams", "Dustin Hoffman"], c: 0, f: "1994. Vinse l'Oscar come miglior attore, il secondo consecutivo per lui." },
    { d: 2, q: "In quale film Leonardo DiCaprio ha finalmente vinto il suo primo Oscar?", a: ["Revenant - Redivivo", "Titanic", "The Wolf of Wall Street", "Inception"], c: 0, f: "2016. Prima di allora aveva collezionato quattro nomination senza mai vincere." },
    { d: 2, q: "Chi ha diretto «Jurassic Park»?", a: ["Steven Spielberg", "George Lucas", "James Cameron", "Robert Zemeckis"], c: 0, f: "1993. Fu tra i primi film a usare estesamente dinosauri in CGI fotorealistica." },
    { d: 2, q: "Qual è il nome della casa di produzione fondata da George Lucas?", a: ["Lucasfilm", "Skywalker Studios", "Industrial Light", "Jedi Pictures"], c: 0, f: "Fondata nel 1971. La divisione effetti speciali, ILM, ha rivoluzionato il cinema." },
    { d: 2, q: "Chi ha diretto «La La Land»?", a: ["Damien Chazelle", "Barry Jenkins", "Denis Villeneuve", "Greta Gerwig"], c: 0, f: "2016. Rimane famoso l'errore alla notte degli Oscar: annunciato vincitore per sbaglio come miglior film." },
    { d: 2, q: "Quale attrice ha interpretato Hermione Granger nella saga di Harry Potter?", a: ["Emma Watson", "Emma Roberts", "Emma Stone", "Bonnie Wright"], c: 0, f: "Aveva 9 anni al provino. Nel cast originale c'erano oltre 300 candidate per il ruolo." },
    { d: 2, q: "In che decennio nasce il cinema, con le prime proiezioni pubbliche dei fratelli Lumière?", a: ["1890", "1900", "1880", "1910"], c: 0, f: "Parigi, 1895. Il primo film mostrava un treno in arrivo: si narra che il pubblico fuggisse terrorizzato." },
    { d: 2, q: "Chi ha diretto «Il Gladiatore»?", a: ["Ridley Scott", "Oliver Stone", "Wolfgang Petersen", "Zack Snyder"], c: 0, f: "2000. Vinse l'Oscar come miglior film, con Russell Crowe protagonista." },
    { d: 2, q: "Qual è il primo film Marvel del Marvel Cinematic Universe?", a: ["Iron Man", "The Incredible Hulk", "Captain America", "Thor"], c: 0, f: "2008. Segnò l'inizio di un universo condiviso che oggi conta decine di film." },
    { d: 2, q: "Chi ha composto la colonna sonora di «Star Wars»?", a: ["John Williams", "Hans Zimmer", "Ennio Morricone", "Danny Elfman"], c: 0, f: "Ha composto anche i temi di Indiana Jones, Jurassic Park e Harry Potter." },
    { d: 3, q: "Chi è il regista italiano vincitore dell'Oscar per «La grande bellezza»?", a: ["Paolo Sorrentino", "Matteo Garrone", "Nanni Moretti", "Marco Bellocchio"], c: 0, f: "2014, miglior film straniero. Roma filmata come pochi film prima." },
    { d: 3, q: "In quale anno esce il primo film sonoro della storia, «Il cantante di jazz»?", a: ["1927", "1930", "1922", "1935"], c: 0, f: "Segnò la fine dell'epoca del muto in modo quasi immediato." },
    { d: 3, q: "Quale attore ha rifiutato il ruolo di Neo in «Matrix» prima che venisse scelto Keanu Reeves?", a: ["Will Smith", "Nicolas Cage", "Brad Pitt", "Johnny Depp"], c: 0, f: "Poi accettò «Wild Wild West»: lui stesso ha ammesso di aver scelto il film sbagliato." },
    { d: 3, q: "Chi ha vinto il maggior numero di Oscar come miglior regista nella storia?", a: ["John Ford", "Steven Spielberg", "William Wyler", "Frank Capra"], c: 0, f: "Quattro statuette, un record ancora imbattuto." },
    { d: 3, q: "Qual è il film più breve ad aver mai vinto l'Oscar come miglior film?", a: ["Marty", "Il Padrino", "Rocky", "Titanic"], c: 0, f: "1955, appena 90 minuti. Da allora nessun film così corto ha più vinto." },
    { d: 3, q: "In quale città è ambientata la maggior parte di «Blade Runner»?", a: ["Los Angeles", "Tokyo", "New York", "Chicago"], c: 0, f: "1982, di Ridley Scott. Ambientato in un futuro distopico che oggi è già passato." },
    { d: 3, q: "Chi ha scritto il romanzo da cui è tratto «Il Padrino»?", a: ["Mario Puzo", "Umberto Eco", "Norman Mailer", "Truman Capote"], c: 0, f: "1969. Coppola e Puzo scrissero insieme la sceneggiatura del film." },
    { d: 3, q: "Quale festival cinematografico assegna la Palma d'Oro?", a: ["Cannes", "Venezia", "Berlino", "Sundance"], c: 0, f: "Il più antico e prestigioso festival del cinema europeo, dal 1946." },
    { d: 2, q: "Quale premio viene assegnato al miglior film al Festival di Venezia?", a: ["Leone d'Oro", "Orso d'Oro", "Palma d'Oro", "Oscar"], c: 0, f: "L'Orso d'Oro è invece di Berlino: tre festival, tre animali diversi." },
    { d: 2, q: "Chi interpreta il Joker nel film «Batman - Il cavaliere oscuro» del 2008?", a: ["Heath Ledger", "Jared Leto", "Joaquin Phoenix", "Jack Nicholson"], c: 0, f: "Vinse l'Oscar postumo come miglior attore non protagonista." },
    { d: 2, q: "In quale film Tom Hanks interpreta un uomo naufragato su un'isola deserta?", a: ["Cast Away", "Apollo 13", "Big", "Philadelphia"], c: 0, f: "2000. Per il ruolo perse oltre 20 kg tra una fase di riprese e l'altra." },
    { d: 2, q: "Chi ha diretto «Inception»?", a: ["Christopher Nolan", "Denis Villeneuve", "David Fincher", "Ridley Scott"], c: 0, f: "2010, con Leonardo DiCaprio: il finale resta uno dei dibattiti più accesi del cinema recente." },
    { d: 2, q: "Chi interpreta Ellen Ripley nella saga di «Alien»?", a: ["Sigourney Weaver", "Linda Hamilton", "Jamie Lee Curtis", "Michelle Yeoh"], c: 0, f: "1979, di Ridley Scott: tra le prime vere eroine action della storia del cinema." },
    { d: 2, q: "Chi ha diretto «Il Silenzio degli Innocenti»?", a: ["Jonathan Demme", "David Fincher", "Martin Scorsese", "Ridley Scott"], c: 0, f: "1991, uno dei pochi horror/thriller a vincere l'Oscar come miglior film." },
    { d: 2, q: "Chi interpreta Hannibal Lecter ne «Il Silenzio degli Innocenti»?", a: ["Anthony Hopkins", "Jack Nicholson", "Anthony Perkins", "Christopher Lee"], c: 0, f: "Vinse l'Oscar con soli 16 minuti di presenza sullo schermo." },
    { d: 2, q: "Chi ha diretto «Il Cavaliere Oscuro»?", a: ["Christopher Nolan", "Tim Burton", "Zack Snyder", "Sam Raimi"], c: 0, f: "2008, secondo capitolo della trilogia di Batman con Christian Bale." },
    { d: 2, q: "Chi interpreta Wolverine nei film degli X-Men?", a: ["Hugh Jackman", "Ryan Reynolds", "Patrick Stewart", "Ian McKellen"], c: 0, f: "Ha interpretato il ruolo per quasi vent'anni consecutivi, un record." },
    { d: 2, q: "Chi ha diretto «Kill Bill»?", a: ["Quentin Tarantino", "Robert Rodriguez", "Guy Ritchie", "Danny Boyle"], c: 0, f: "Diviso in due volumi, usciti nel 2003 e nel 2004." },
    { d: 2, q: "Chi interpreta Rocky Balboa?", a: ["Sylvester Stallone", "Robert De Niro", "Al Pacino", "Burt Reynolds"], c: 0, f: "Scrisse lui stesso la sceneggiatura del primo film, nel 1976." },
    { d: 2, q: "Chi ha diretto «Il Re Leone» originale del 1994?", a: ["Roger Allers e Rob Minkoff", "John Lasseter", "Tim Burton", "Ron Clements"], c: 0, f: "Ispirato liberamente anche all'Amleto di Shakespeare." },
    { d: 2, q: "Chi interpreta Indiana Jones?", a: ["Harrison Ford", "Tom Selleck", "Kurt Russell", "Nicolas Cage"], c: 0, f: "Tom Selleck era la prima scelta, ma dovette rinunciare per impegni televisivi." },
    { d: 2, q: "Chi ha diretto «E.T. l'extra-terrestre»?", a: ["Steven Spielberg", "George Lucas", "Robert Zemeckis", "Ron Howard"], c: 0, f: "1982, per anni il film con maggiori incassi della storia." },
    { d: 2, q: "Chi interpreta Tony Montana in «Scarface»?", a: ["Al Pacino", "Robert De Niro", "Al Lettieri", "Steven Bauer"], c: 0, f: "1983, remake del film del 1932, diretto da Brian De Palma." },
    { d: 2, q: "Chi ha diretto «Le ali della libertà»?", a: ["Frank Darabont", "Rob Reiner", "Ron Howard", "Robert Zemeckis"], c: 0, f: "1994, tratto da un racconto di Stephen King, oggi tra i film più amati nei sondaggi di pubblico." },
    { d: 2, q: "Chi interpreta il Dottor Emmett Brown in «Ritorno al Futuro»?", a: ["Christopher Lloyd", "Michael J. Fox", "Crispin Glover", "Tom Wilson"], c: 0, f: "Michael J. Fox interpreta invece Marty McFly." },
    { d: 2, q: "Chi ha diretto «Il Grande Lebowski»?", a: ["I fratelli Coen", "Wes Anderson", "Quentin Tarantino", "David Lynch"], c: 0, f: "1998, film di culto diventato quasi un fenomeno di costume." },
    { d: 2, q: "Chi interpreta James Bond nei film della saga usciti tra il 2006 e il 2021?", a: ["Daniel Craig", "Pierce Brosnan", "Timothy Dalton", "Roger Moore"], c: 0, f: "Cinque film, con «No Time to Die» come ultimo capitolo." },
    { d: 2, q: "Chi ha diretto «Amélie»?", a: ["Jean-Pierre Jeunet", "Luc Besson", "François Ozon", "Michel Gondry"], c: 0, f: "2001, con Audrey Tautou: uno dei film francesi più amati all'estero." },
    { d: 2, q: "Chi interpreta il protagonista de «Il Grande Gatsby» del 2013?", a: ["Leonardo DiCaprio", "Tobey Maguire", "Toby Stephens", "Robert Redford"], c: 0, f: "Diretto da Baz Luhrmann, tratto dal romanzo di Fitzgerald." },
    { d: 2, q: "Chi ha diretto «Whiplash»?", a: ["Damien Chazelle", "Barry Jenkins", "Ryan Coogler", "Denis Villeneuve"], c: 0, f: "2014, con J.K. Simmons, premio Oscar come non protagonista." },
    { d: 2, q: "Chi interpreta il protagonista in «American Beauty»?", a: ["Kevin Spacey", "Russell Crowe", "Kevin Costner", "Bruce Willis"], c: 0, f: "1999, vinse l'Oscar come miglior film." },
    { d: 2, q: "Chi ha diretto «Parasite»?", a: ["Bong Joon-ho", "Park Chan-wook", "Kim Ki-duk", "Lee Chang-dong"], c: 0, f: "2019, primo film non in lingua inglese a vincere l'Oscar come miglior film." },
    { d: 2, q: "Chi interpreta Michael Corleone ne «Il Padrino»?", a: ["Al Pacino", "Robert De Niro", "James Caan", "John Cazale"], c: 0, f: "Robert De Niro interpreterà lo stesso personaggio da giovane nel secondo capitolo." },
    { d: 2, q: "Chi ha diretto «Il Labirinto del Fauno»?", a: ["Guillermo del Toro", "Alfonso Cuarón", "Alejandro González Iñárritu", "Pedro Almodóvar"], c: 0, f: "2006, ambientato nella Spagna franchista del dopoguerra." },
    { d: 2, q: "Chi interpreta Katniss Everdeen in «Hunger Games»?", a: ["Jennifer Lawrence", "Emma Stone", "Shailene Woodley", "Kristen Stewart"], c: 0, f: "Basato sulla trilogia di romanzi di Suzanne Collins." },
    { d: 2, q: "Chi ha diretto «Mad Max: Fury Road»?", a: ["George Miller", "Christopher Nolan", "Zack Snyder", "James Wan"], c: 0, f: "2015, quarto capitolo della saga, ideata dallo stesso regista fin dal 1979." },
    { d: 2, q: "Chi interpreta l'agente Jason Bourne?", a: ["Matt Damon", "Ben Affleck", "Mark Wahlberg", "Jeremy Renner"], c: 0, f: "Basato sui romanzi di Robert Ludlum." },
    { d: 2, q: "Chi ha diretto «Django Unchained»?", a: ["Quentin Tarantino", "Clint Eastwood", "Sergio Leone", "Robert Rodriguez"], c: 0, f: "2012, ambientato negli Stati Uniti pre-guerra civile." },
    { d: 2, q: "Chi interpreta Marty McFly in «Ritorno al Futuro»?", a: ["Michael J. Fox", "Eric Stoltz", "Corey Feldman", "Charlie Sheen"], c: 0, f: "Eric Stoltz girò alcune scene prima di essere sostituito." },
    { d: 2, q: "Chi ha diretto «C'era una volta in America»?", a: ["Sergio Leone", "Sergio Corbucci", "Dario Argento", "Bernardo Bertolucci"], c: 0, f: "1984, ultimo film diretto dal grande regista italiano del western all'italiana." },
    { d: 2, q: "Chi interpreta il protagonista de «Il Grande Dittatore»?", a: ["Charlie Chaplin", "Buster Keaton", "Stan Laurel", "Harold Lloyd"], c: 0, f: "1940, primo film sonoro dell'attore, satira feroce contro Hitler." },
    { d: 2, q: "Chi ha diretto «Blade Runner 2049»?", a: ["Denis Villeneuve", "Ridley Scott", "Christopher Nolan", "David Fincher"], c: 0, f: "2017, sequel del classico del 1982, con Ryan Gosling e Harrison Ford." },
    { d: 2, q: "Chi interpreta la protagonista, nota come «la Sposa», in «Kill Bill»?", a: ["Uma Thurman", "Lucy Liu", "Daryl Hannah", "Vivica A. Fox"], c: 0, f: "Il ruolo fu scritto appositamente per lei da Tarantino." },
    { d: 2, q: "Chi ha diretto «Il Sesto Senso»?", a: ["M. Night Shyamalan", "Sam Raimi", "Wes Craven", "James Wan"], c: 0, f: "1999, celebre per il colpo di scena finale." },
    { d: 2, q: "Chi interpreta il protagonista in «Taxi Driver»?", a: ["Robert De Niro", "Al Pacino", "Dustin Hoffman", "Jack Nicholson"], c: 0, f: "1976, diretto da Martin Scorsese." },
    { d: 2, q: "Chi ha diretto «Toy Story», primo lungometraggio interamente in CGI della storia?", a: ["John Lasseter", "Andrew Stanton", "Pete Docter", "Brad Bird"], c: 0, f: "1995, Pixar: rivoluzionò per sempre l'animazione." },
    { d: 2, q: "Chi interpreta Freddy Krueger in «Nightmare»?", a: ["Robert Englund", "Jack Nicholson", "Anthony Hopkins", "Christopher Lee"], c: 0, f: "1984, di Wes Craven: il volto storico del personaggio per anni." },
    { d: 2, q: "Chi ha diretto «La Vita è Meravigliosa»?", a: ["Frank Capra", "John Ford", "Billy Wilder", "Alfred Hitchcock"], c: 0, f: "1946, classico natalizio americano rivalutato nel tempo." },
    { d: 2, q: "Chi interpreta Vito Corleone giovane ne «Il Padrino - Parte II»?", a: ["Robert De Niro", "Al Pacino", "Marlon Brando", "James Caan"], c: 0, f: "Marlon Brando lo interpreta invece da anziano nel primo film." },
    { d: 2, q: "Chi ha diretto «Apocalypse Now»?", a: ["Francis Ford Coppola", "Oliver Stone", "Stanley Kubrick", "Michael Cimino"], c: 0, f: "1979, ambientato durante la guerra del Vietnam, ispirato a «Cuore di tenebra» di Conrad." },
    { d: 2, q: "Chi interpreta il protagonista in «Full Metal Jacket»?", a: ["Matthew Modine", "R. Lee Ermey", "Vincent D'Onofrio", "Adam Baldwin"], c: 0, f: "1987, diretto da Stanley Kubrick." },
    { d: 2, q: "Chi ha diretto «2001: Odissea nello spazio»?", a: ["Stanley Kubrick", "Steven Spielberg", "Ridley Scott", "George Lucas"], c: 0, f: "1968, tra i film di fantascienza più influenti mai realizzati." },
    { d: 2, q: "Chi interpreta il protagonista in «Arancia Meccanica»?", a: ["Malcolm McDowell", "Michael Caine", "Terence Stamp", "David Bowie"], c: 0, f: "1971, diretto da Stanley Kubrick, tratto dal romanzo di Anthony Burgess." },
    { d: 2, q: "Chi ha diretto «Shining»?", a: ["Stanley Kubrick", "Wes Craven", "John Carpenter", "Brian De Palma"], c: 0, f: "1980, tratto dal romanzo di Stephen King, che non amò affatto l'adattamento." },
    { d: 2, q: "Chi interpreta il protagonista in «Shining»?", a: ["Jack Nicholson", "Robert De Niro", "Al Pacino", "Dustin Hoffman"], c: 0, f: "La sua interpretazione dello squilibrio mentale del personaggio è entrata nella storia del cinema." },
    { d: 2, q: "Chi ha diretto «Le Iene» (Reservoir Dogs), suo esordio alla regia?", a: ["Quentin Tarantino", "Robert Rodriguez", "Guy Ritchie", "Danny Boyle"], c: 0, f: "1992, il suo primo lungometraggio da regista." },
    { d: 2, q: "Chi interpreta il protagonista in «Good Will Hunting»?", a: ["Matt Damon", "Ben Affleck", "Robin Williams", "Casey Affleck"], c: 0, f: "Damon ed Affleck scrissero insieme la sceneggiatura, vincendo l'Oscar." },
    { d: 2, q: "Chi ha diretto «Il Cigno Nero»?", a: ["Darren Aronofsky", "David Fincher", "Danny Boyle", "Ang Lee"], c: 0, f: "2010, con Natalie Portman, premio Oscar come migliore attrice." },
    { d: 2, q: "Chi interpreta il protagonista in «The Revenant»?", a: ["Leonardo DiCaprio", "Tom Hardy", "Will Poulter", "Domhnall Gleeson"], c: 0, f: "2015, diretto da Alejandro González Iñárritu: il ruolo gli valse il primo Oscar." },
    { d: 2, q: "Chi ha diretto «Interstellar»?", a: ["Christopher Nolan", "Denis Villeneuve", "Ridley Scott", "James Gray"], c: 0, f: "2014, con la consulenza scientifica del fisico Kip Thorne." },
    { d: 3, q: "In che anno esce il primo film della storia del cinema, dei fratelli Lumière?", a: ["1895", "1900", "1888", "1905"], c: 0, f: "«L'arrivo di un treno alla stazione» è tra i più celebri di quella prima proiezione." },
    { d: 3, q: "Chi ha diretto «Metropolis», pietra miliare della fantascienza muta?", a: ["Fritz Lang", "F.W. Murnau", "Robert Wiene", "Georges Méliès"], c: 0, f: "1927, capolavoro tedesco dell'espressionismo cinematografico." },
    { d: 3, q: "In che anno esce «Nosferatu», primo grande film vampiresco della storia?", a: ["1922", "1910", "1930", "1935"], c: 0, f: "Diretto da F.W. Murnau, non autorizzato dagli eredi di Bram Stoker." },
    { d: 3, q: "In che anno esce «Via col vento», tra i primi grandi film a colori della storia?", a: ["1939", "1935", "1945", "1950"], c: 0, f: "Ancora oggi, aggiustando per l'inflazione, tra i film con maggiori incassi di sempre." },
    { d: 3, q: "Chi ha diretto «Quarto Potere» (Citizen Kane)?", a: ["Orson Welles", "John Ford", "Billy Wilder", "Alfred Hitchcock"], c: 0, f: "1941, spesso citato come il miglior film mai realizzato nelle classifiche della critica." },
    { d: 3, q: "In che anno esce «Biancaneve e i sette nani», primo lungometraggio Disney?", a: ["1937", "1928", "1940", "1945"], c: 0, f: "Molti nell'industria previdero un flop clamoroso: fu invece un enorme successo." },
    { d: 3, q: "Quali tre film condividono il record assoluto di undici premi Oscar vinti?", a: ["Ben-Hur, Titanic e Il Signore degli Anelli - Il Ritorno del Re", "Solo Titanic", "Solo Ben-Hur", "Solo La La Land"], c: 0, f: "Nessun altro film ha mai superato quota undici." },
    { d: 3, q: "In che anno esce il primo film della saga di «Star Wars»?", a: ["1977", "1975", "1980", "1970"], c: 0, f: "Il quarto episodio cronologico della saga, uscito per primo." },
    { d: 3, q: "Chi ha diretto «Il Settimo Sigillo»?", a: ["Ingmar Bergman", "Federico Fellini", "Michelangelo Antonioni", "Akira Kurosawa"], c: 0, f: "1957, con la celebre scena della partita a scacchi con la Morte." },
    { d: 3, q: "In che anno esce «La Dolce Vita» di Fellini?", a: ["1960", "1955", "1965", "1970"], c: 0, f: "Vinse la Palma d'Oro a Cannes, nonostante lo scandalo iniziale in Italia." },
    { d: 3, q: "Chi ha diretto «I Sette Samurai»?", a: ["Akira Kurosawa", "Yasujirō Ozu", "Kenji Mizoguchi", "Hayao Miyazaki"], c: 0, f: "1954, ispirò direttamente il western «I magnifici sette»." },
    { d: 3, q: "In che anno esce «2001: Odissea nello spazio» di Kubrick?", a: ["1968", "1965", "1972", "1975"], c: 0, f: "Le sue innovazioni negli effetti speciali restano influenti ancora oggi." },
    { d: 3, q: "Chi ha diretto «Ladri di biciclette», capolavoro del neorealismo italiano?", a: ["Vittorio De Sica", "Roberto Rossellini", "Luchino Visconti", "Federico Fellini"], c: 0, f: "1948, girato con attori non professionisti, come da manifesto del neorealismo." },
    { d: 3, q: "In che anno esce «Roma città aperta» di Rossellini, atto fondativo del neorealismo?", a: ["1945", "1940", "1950", "1935"], c: 0, f: "Girato in condizioni difficilissime, a guerra ancora in corso in altre zone d'Italia." },
    { d: 3, q: "Chi ha diretto «8½»?", a: ["Federico Fellini", "Michelangelo Antonioni", "Pier Paolo Pasolini", "Luchino Visconti"], c: 0, f: "1963, film sulla crisi creativa di un regista, semi-autobiografico." },
    { d: 3, q: "In che decennio nasce il movimento della Nouvelle Vague francese?", a: ["Anni '50-'60", "Anni '30", "Anni '80", "Anni '20"], c: 0, f: "Registi come Godard e Truffaut ne furono protagonisti." },
    { d: 3, q: "Chi ha diretto «Fino all'ultimo respiro» (À bout de souffle)?", a: ["Jean-Luc Godard", "François Truffaut", "Éric Rohmer", "Claude Chabrol"], c: 0, f: "1960, manifesto della Nouvelle Vague francese." },
    { d: 3, q: "In che anno si tiene la prima edizione post-bellica del Festival di Cannes?", a: ["1946", "1932", "1955", "1960"], c: 0, f: "Un primo tentativo nel 1939 fu interrotto dallo scoppio della Seconda Guerra Mondiale." },
    { d: 3, q: "Chi ha diretto «Il Terzo Uomo»?", a: ["Carol Reed", "David Lean", "Alfred Hitchcock", "Michael Powell"], c: 0, f: "1949, ambientato nella Vienna postbellica divisa in zone di occupazione." },
    { d: 3, q: "In che anno esce «Psyco» di Hitchcock?", a: ["1960", "1955", "1965", "1958"], c: 0, f: "Fu il primo film di Hitchcock a mostrare esplicitamente uno sciacquone in azione, un piccolo scandalo per l'epoca." },
    { d: 3, q: "Chi ha diretto «Il Pianista»?", a: ["Roman Polanski", "Steven Spielberg", "Ang Lee", "Alejandro González Iñárritu"], c: 0, f: "2002, vinse tre Oscar, tra cui migliore attore per Adrien Brody." },
  ],
  gaming: [
    { d: 2, q: "Quale idraulico italiano è la mascotte di Nintendo?", a: ["Mario", "Luigi", "Wario", "Toad"], c: 0, f: "Debuttò nel 1981 come «Jumpman» in Donkey Kong, prima di diventare Mario." },
    { d: 2, q: "In quale videogioco si costruisce e sopravvive in un mondo fatto di blocchi cubici?", a: ["Minecraft", "Terraria", "Roblox", "Fortnite"], c: 0, f: "Creato da Markus «Notch» Persson nel 2009. Oggi è il videogioco più venduto di sempre." },
    { d: 2, q: "Quale azienda produce la console PlayStation?", a: ["Sony", "Microsoft", "Nintendo", "Sega"], c: 0, f: "La prima PlayStation uscì nel 1994 in Giappone." },
    { d: 2, q: "Come si chiama il protagonista della saga «The Legend of Zelda»?", a: ["Link", "Zelda", "Ganon", "Navi"], c: 0, f: "Zelda, contrariamente al titolo, è il nome della principessa, non dell'eroe." },
    { d: 2, q: "Quale personaggio è il rivale storico di Sonic the Hedgehog?", a: ["Dr. Eggman", "Bowser", "Knuckles", "Shadow"], c: 0, f: "Chiamato anche Dr. Robotnik nelle versioni americane originali." },
    { d: 2, q: "In quale gioco si affronta la modalità «Battle Royale» su un'isola che si restringe con una tempesta?", a: ["Fortnite", "Minecraft", "Among Us", "The Sims"], c: 0, f: "2017. Il genere Battle Royale esisteva già, ma Fortnite lo rese un fenomeno globale." },
    { d: 2, q: "Quale casa sviluppa la serie di giochi «Call of Duty»?", a: ["Activision", "Electronic Arts", "Ubisoft", "Rockstar Games"], c: 0, f: "Il primo capitolo uscì nel 2003, ambientato nella Seconda Guerra Mondiale." },
    { d: 2, q: "Chi sviluppa la serie «Grand Theft Auto»?", a: ["Rockstar Games", "Ubisoft", "EA Sports", "Bethesda"], c: 0, f: "GTA V, uscito nel 2013, resta tra i prodotti d'intrattenimento più redditizi di sempre." },
    { d: 2, q: "In quale gioco bisogna scoprire chi tra i giocatori è l'«impostore»?", a: ["Among Us", "Fall Guys", "Fortnite", "Valorant"], c: 0, f: "Uscito nel 2018 ma esploso solo nel 2020, complice il lockdown mondiale." },
    { d: 2, q: "Qual è la console portatile più venduta della storia?", a: ["Nintendo DS", "Game Boy", "PSP", "Nintendo Switch"], c: 0, f: "Oltre 154 milioni di unità vendute nel mondo." },
    { d: 2, q: "Come si chiama il creatore della serie «The Legend of Zelda» e «Super Mario»?", a: ["Shigeru Miyamoto", "Hideo Kojima", "Satoru Iwata", "Shigesato Itoi"], c: 0, f: "Ha progettato Mario ispirandosi in parte a Braccio di Ferro e a Topolino." },
    { d: 2, q: "In quale videogioco si allevano e combattono creature chiamate «mostri tascabili»?", a: ["Pokémon", "Digimon", "Yu-Gi-Oh!", "Monster Hunter"], c: 0, f: "Pokémon è l'abbreviazione giapponese di «Pocket Monsters»." },
    { d: 2, q: "Quale sparatutto competitivo di Valve è famoso per il round bomb «difesa/attacco»?", a: ["Counter-Strike", "Overwatch", "Valorant", "Apex Legends"], c: 0, f: "Nato nel 1999 come mod amatoriale del gioco Half-Life." },
    { d: 2, q: "Come si chiama la valuta di gioco iconica della serie «Super Mario»?", a: ["Monete", "Stelle", "Gemme", "Rubini"], c: 0, f: "Cento monete regalano da sempre una vita extra." },
    { d: 2, q: "Quale gioco di simulazione di vita permette di costruire case e gestire personaggi virtuali chiamati Sims?", a: ["The Sims", "Animal Crossing", "Stardew Valley", "Second Life"], c: 0, f: "Il primo capitolo, del 2000, è tra i giochi per PC più venduti di sempre." },
    { d: 2, q: "Quale personaggio Nintendo è noto per la sua fame di funghi che lo fanno diventare grande?", a: ["Mario", "Yoshi", "Kirby", "Wario"], c: 0, f: "Il «Super Fungo» è uno degli oggetti più iconici della storia dei videogiochi." },
    { d: 2, q: "In quale videogioco si esplora una fattoria abbandonata, coltivando e stringendo amicizie in paese?", a: ["Stardew Valley", "Animal Crossing", "Harvest Moon", "Terraria"], c: 0, f: "Sviluppato quasi da solo da un unico programmatore, Eric Barone, in circa quattro anni." },
    { d: 2, q: "Qual è la console più venduta della storia?", a: ["PlayStation 2", "Nintendo Switch", "PlayStation 4", "Xbox 360"], c: 0, f: "Oltre 155 milioni di unità vendute dal suo lancio nel 2000." },
    { d: 2, q: "Come si chiama il protagonista silenzioso della saga «Half-Life»?", a: ["Gordon Freeman", "Master Chief", "Doom Slayer", "Duke Nukem"], c: 0, f: "Non pronuncia mai una parola in tutta la saga: un fisico armato di piede di porco." },
    { d: 2, q: "In quale gioco Nintendo un riccio blu velocissimo è il protagonista?", a: ["Sonic the Hedgehog", "Kirby", "Yoshi's Island", "Star Fox"], c: 0, f: "In realtà è una mascotte Sega, non Nintendo: da sempre la rivale storica." },
    { d: 2, q: "Come si chiama la piattaforma di distribuzione digitale di giochi per PC più diffusa, di proprietà Valve?", a: ["Steam", "Epic Games Store", "GOG", "Origin"], c: 0, f: "Lanciata nel 2003, oggi conta oltre 130 milioni di utenti attivi mensili." },
    { d: 2, q: "Quale serie di giochi vede protagonista l'archeologa Lara Croft?", a: ["Tomb Raider", "Uncharted", "Indiana Jones", "Assassin's Creed"], c: 0, f: "Debuttò nel 1996, tra le prime protagoniste femminili di rilievo nel medium." },
    { d: 2, q: "In quale gioco si affrontano combattimenti a colpi di costruzioni e picconate in stile «sandbox»?", a: ["Minecraft", "Roblox", "Terraria", "Garry's Mod"], c: 0, f: "Notch lo sviluppò ispirandosi a «Dwarf Fortress» e «Infiniminer»." },
    { d: 2, q: "Qual è il nome del casco/elmo iconico indossato da Master Chief in «Halo»?", a: ["Mark VI", "Recon", "EOD", "Hayabusa"], c: 0, f: "La serie Halo ha lanciato la console Xbox come piattaforma seria per gli sparatutto." },
    { d: 3, q: "In che anno è uscita la prima PlayStation?", a: ["1994", "1990", "1998", "2000"], c: 0, f: "Nasce da una collaborazione fallita tra Sony e Nintendo per un lettore CD per SNES." },
    { d: 3, q: "Chi ha ideato la serie «Metal Gear»?", a: ["Hideo Kojima", "Shigeru Miyamoto", "Yoko Taro", "Fumito Ueda"], c: 0, f: "Considerato tra i padri dello «stealth game» moderno, dal 1987." },
    { d: 3, q: "Qual è il videogioco più venduto di sempre in assoluto?", a: ["Minecraft", "Grand Theft Auto V", "Tetris", "Wii Sports"], c: 0, f: "Oltre 300 milioni di copie vendute, contando anche le versioni mobile." },
    { d: 3, q: "In quale anno è stato rilasciato il primo «Tetris»?", a: ["1984", "1979", "1990", "1988"], c: 0, f: "Creato in Unione Sovietica da Alexey Pajitnov su un computer Elektronika 60." },
    { d: 3, q: "Come si chiama lo studio che ha sviluppato «The Witcher 3»?", a: ["CD Projekt Red", "Bethesda", "BioWare", "Larian Studios"], c: 0, f: "Studio polacco, basato sui romanzi fantasy di Andrzej Sapkowski." },
    { d: 3, q: "In quale videogioco compare per la prima volta il personaggio di Pac-Man?", a: ["Pac-Man (1980)", "Galaga", "Space Invaders", "Donkey Kong"], c: 0, f: "L'idea nacque, si dice, da una pizza a cui mancava una fetta." },
    { d: 3, q: "Quale evento competitivo di eSport riempie regolarmente stadi da decine di migliaia di spettatori per «League of Legends»?", a: ["I Mondiali (Worlds)", "The International", "EVO", "Major"], c: 0, f: "La finale mondiale 2021 fu vista da oltre 70 milioni di spettatori unici online." },
    { d: 3, q: "Quale console fu il primo grande insuccesso commerciale di Sega, lanciata nel 1998?", a: ["Dreamcast", "Saturn", "Game Gear", "32X"], c: 0, f: "Dopo il suo fallimento Sega abbandonò per sempre il mercato delle console." },
    { d: 2, q: "Come si chiama la modalità creativa in cui non esistono limiti di risorse in molti videogiochi sandbox?", a: ["Modalità creativa", "Modalità sopravvivenza", "Modalità hardcore", "Modalità storia"], c: 0, f: "In Minecraft permette di volare e costruire senza dover raccogliere materiali." },
    { d: 2, q: "In quale gioco di corse guida per la prima volta il celebre idraulico Mario su un kart?", a: ["Super Mario Kart", "Mario Party", "Diddy Kong Racing", "Crash Team Racing"], c: 0, f: "1992, su Super Nintendo. Il guscio blu resta l'oggetto più temuto di tutta la saga." },
    { d: 2, q: "Qual è il nome del creatore/inventore virtuale dei giochi «SimCity» e «The Sims»?", a: ["Will Wright", "Sid Meier", "Peter Molyneux", "Will Fisher"], c: 0, f: "Prima di The Sims ideò SimCity, ispirato per sua stessa ammissione da un editor di mappe." },
    { d: 2, q: "Quale azienda produce la console Xbox?", a: ["Microsoft", "Sony", "Nintendo", "Sega"], c: 0, f: "La prima Xbox uscì nel 2001, primo ingresso di Microsoft nel mercato console." },
    { d: 2, q: "Come si chiama il fratello di Mario nei giochi Nintendo?", a: ["Luigi", "Wario", "Toad", "Yoshi"], c: 0, f: "Riconoscibile dal colore verde, spesso descritto come più alto e magro di Mario." },
    { d: 2, q: "In quale città virtuale, ispirata a Los Angeles, è ambientato Grand Theft Auto V?", a: ["Los Santos", "Liberty City", "Vice City", "San Fierro"], c: 0, f: "Los Santos è la città reinventata di GTA V, San Andreas e GTA Online." },
    { d: 2, q: "Quale personaggio Nintendo è un cavaliere rosa capace di risucchiare i nemici?", a: ["Kirby", "Yoshi", "Toad", "Waddle Dee"], c: 0, f: "Debuttò nel 1992 su Game Boy." },
    { d: 2, q: "Chi ideò SimCity, capostipite del genere city-builder, nel 1989?", a: ["Will Wright", "Sid Meier", "Peter Molyneux", "Shigeru Miyamoto"], c: 0, f: "Lo stesso designer che avrebbe poi creato The Sims." },
    { d: 2, q: "Quale storica saga giapponese di giochi di ruolo include titoli come «VII» e «X»?", a: ["Final Fantasy", "Dragon Quest", "Persona", "Chrono Trigger"], c: 0, f: "Serie nata nel 1987, con capitoli spesso indipendenti tra loro nella trama." },
    { d: 2, q: "Quale videogioco calcistico è sviluppato annualmente da EA Sports?", a: ["EA Sports FC", "Pro Evolution Soccer", "Football Manager", "Rocket League"], c: 0, f: "Fino al 2022 si chiamava «FIFA», prima di perdere la licenza del nome." },
    { d: 2, q: "Quale drago viola è la mascotte di un famoso platform PlayStation di fine anni '90?", a: ["Spyro", "Crash Bandicoot", "Rayman", "Ratchet"], c: 0, f: "Debuttò nel 1998, diventando una delle mascotte storiche PlayStation." },
    { d: 2, q: "Quale marsupiale arancione è protagonista di una storica serie platform PlayStation?", a: ["Crash Bandicoot", "Spyro", "Sly Cooper", "Jak"], c: 0, f: "Debuttò nel 1996, tra i platform più iconici della prima PlayStation." },
    { d: 2, q: "Quale gioco musicale prevede di premere tasti a tempo su una finta chitarra colorata?", a: ["Guitar Hero", "Rock Band", "Dance Dance Revolution", "Just Dance"], c: 0, f: "Lanciato nel 2005, rese popolarissime le chitarre finte come periferiche." },
    { d: 2, q: "Quale videogioco vede i giocatori costruire e gestire parchi divertimenti virtuali?", a: ["RollerCoaster Tycoon", "SimCity", "Planet Coaster", "Theme Park"], c: 0, f: "1999, creato in gran parte in linguaggio assembly da un solo sviluppatore, Chris Sawyer." },
    { d: 2, q: "Quale personaggio è il principale antagonista della saga «Super Mario»?", a: ["Bowser", "Wario", "King Boo", "Dry Bowser"], c: 0, f: "Re dei Koopa, rapisce ciclicamente la Principessa Peach." },
    { d: 2, q: "Quale gioco open world western vede protagonista un fuorilegge di nome Arthur Morgan?", a: ["Red Dead Redemption 2", "Gun", "Call of Juarez", "Wild West Online"], c: 0, f: "2018, di Rockstar Games, ambientato a fine Ottocento americano." },
    { d: 2, q: "Quale serie survival horror con agenti alle prese con zombie è considerata capostipite del genere moderno?", a: ["Resident Evil", "Silent Hill", "Dead Space", "The Last of Us"], c: 0, f: "Debuttò nel 1996." },
    { d: 2, q: "Quale videogioco musicale giapponese usa dei tamburi taiko come periferica?", a: ["Taiko no Tatsujin", "Guitar Hero", "Just Dance", "Beat Saber"], c: 0, f: "Serie nata nel 2001 in Giappone, molto popolare nelle sale giochi." },
    { d: 2, q: "Quale saga vede il giocatore sconfiggere Ganon per salvare la principessa Zelda?", a: ["The Legend of Zelda", "Dark Souls", "Kingdom Hearts", "Fable"], c: 0, f: "Debuttò nel 1986 su Nintendo Entertainment System." },
    { d: 2, q: "Quale personaggio robotico blu, mascotte Capcom, salta e spara raggi dal braccio?", a: ["Mega Man", "Astro Boy", "Ratchet", "Samus Aran"], c: 0, f: "Debuttò nel 1987, tra le mascotte storiche dei videogiochi giapponesi." },
    { d: 2, q: "Quale saga vede una cacciatrice di taglie in armatura spaziale, protagonista tenuta segreta fino al finale del primo capitolo?", a: ["Metroid", "Halo", "Destiny", "Mass Effect"], c: 0, f: "Samus Aran fu una delle prime protagoniste donna dei videogiochi, nel 1986." },
    { d: 2, q: "Quale gioco arcade vede una rana attraversare strade trafficate e fiumi pericolosi?", a: ["Frogger", "Pac-Man", "Q*bert", "Dig Dug"], c: 0, f: "1981, tra i classici arcade più celebri dell'epoca d'oro dei cabinati." },
    { d: 2, q: "Quale famosa serie strategica a turni permette di costruire un impero attraverso la storia umana?", a: ["Civilization", "Age of Empires", "Total War", "Europa Universalis"], c: 0, f: "Ideata da Sid Meier, dal 1991." },
    { d: 2, q: "Quale saga di combattimento vede protagonisti Ryu e Ken, con mosse come l'Hadouken?", a: ["Street Fighter", "Tekken", "Mortal Kombat", "King of Fighters"], c: 0, f: "Debuttò nel 1987, tra i capostipiti dei picchiaduro moderni." },
    { d: 2, q: "Quale saga di combattimento è nota per le sue fatalities estremamente sanguinose?", a: ["Mortal Kombat", "Street Fighter", "Tekken", "Soulcalibur"], c: 0, f: "1992, causò dibattiti pubblici sulla violenza nei videogiochi, portando poi ai sistemi di rating." },
    { d: 2, q: "Quale videogioco tower defense vede piante difendersi da ondate di zombie in giardino?", a: ["Plants vs. Zombies", "Fortnite", "Left 4 Dead", "World War Z"], c: 0, f: "2009, di PopCap Games, con toni ironici." },
    { d: 2, q: "Quale personaggio, cacciatore di tesori, è protagonista della saga «Uncharted»?", a: ["Nathan Drake", "Sam Fisher", "Ellie", "Joel"], c: 0, f: "Serie di avventura action ispirata ai film di Indiana Jones." },
    { d: 2, q: "Quale serie post-apocalittica vede protagonista Joel scortare la giovane Ellie?", a: ["The Last of Us", "Fallout", "Days Gone", "State of Decay"], c: 0, f: "2013, considerato tra i giochi più acclamati della sua generazione." },
    { d: 2, q: "Quale gioco dark fantasy estremamente punitivo diede origine al termine «souls-like»?", a: ["Dark Souls", "Elden Ring", "Bloodborne", "Sekiro"], c: 0, f: "2011, di FromSoftware." },
    { d: 2, q: "Quale famosa serie di puzzle game vede blocchi colorati cadere e formare linee?", a: ["Tetris", "Candy Crush", "Bejeweled", "Puyo Puyo"], c: 0, f: "Creato in URSS nel 1984, divenne un fenomeno mondiale." },
    { d: 2, q: "Quale gioco gestionale vede il giocatore costruire ferrovie e imprese in epoche storiche diverse?", a: ["Railroad Tycoon", "SimCity", "Anno 1800", "Transport Tycoon"], c: 0, f: "Creato da Sid Meier, dello stesso genio dietro Civilization." },
    { d: 2, q: "Quale videogioco calcistico con automobili acrobatiche è diventato un fenomeno esport?", a: ["Rocket League", "FIFA", "Trackmania", "Mario Kart"], c: 0, f: "2015, mescola calcio e corse con automobili acrobatiche." },
    { d: 2, q: "Quale personaggio Nintendo, un dinosauro verde, accompagna spesso Mario nelle avventure?", a: ["Yoshi", "Birdo", "Wart", "Toadette"], c: 0, f: "Debuttò in Super Mario World, 1990." },
    { d: 2, q: "Quale famosa saga di corse arcade Nintendo include gusci e banane come armi?", a: ["Mario Kart", "Crash Team Racing", "Sonic Racing", "Diddy Kong Racing"], c: 0, f: "Il guscio blu resta l'oggetto più temuto della saga, capace di colpire chi è in testa." },
    { d: 2, q: "Quale videogioco vede il giocatore risolvere enigmi con un cannone che crea portali?", a: ["Portal", "The Talos Principle", "Antichamber", "Quantum Break"], c: 0, f: "2007, di Valve, celebre per l'umorismo nero dell'IA GLaDOS." },
    { d: 2, q: "Quale piattaforma è famosa per i mini-giochi creati dagli utenti stessi, molto popolare tra i più giovani?", a: ["Roblox", "Minecraft", "Fortnite Creative", "Dreams"], c: 0, f: "Lanciata nel 2006, permette di programmare e giocare esperienze create da altri utenti." },
    { d: 2, q: "Quale serie horror giapponese vede protagonisti intrappolati in una cittadina nebbiosa piena di mostri?", a: ["Silent Hill", "Resident Evil", "Fatal Frame", "Clock Tower"], c: 0, f: "1999, noto per l'atmosfera psicologica più che per l'azione pura." },
    { d: 2, q: "Quale saga di ruolo occidentale vede il giocatore esplorare la regione fantasy di Skyrim?", a: ["The Elder Scrolls", "The Witcher", "Dragon Age", "Kingdoms of Amalur"], c: 0, f: "«Skyrim» è il quinto capitolo principale della serie, uscito nel 2011." },
    { d: 2, q: "Quale videogioco vede protagonista un cacciatore di mostri chiamato Geralt di Rivia?", a: ["The Witcher", "Dragon Age", "Elder Scrolls", "Dark Souls"], c: 0, f: "Basato sui romanzi fantasy dello scrittore polacco Andrzej Sapkowski." },
    { d: 2, q: "Quale gioco mobile ha reso celebre il lancio di uccelli contro strutture per colpire maiali verdi?", a: ["Angry Birds", "Cut the Rope", "Fruit Ninja", "Candy Crush"], c: 0, f: "2009, sviluppato dalla finlandese Rovio, diventato anche un franchise cinematografico." },
    { d: 2, q: "Quale gioco mobile ha reso celebre la cattura di creature nelle strade reali tramite realtà aumentata?", a: ["Pokémon GO", "Ingress", "Harry Potter: Wizards Unite", "Jurassic World Alive"], c: 0, f: "2016, sviluppato da Niantic, sfruttando GPS e fotocamera degli smartphone." },
    { d: 2, q: "Quale gioco arcade vede un idraulico salire scale ed evitare botti lanciati da uno scimmione gigante?", a: ["Donkey Kong", "Pac-Man", "Frogger", "Q*bert"], c: 0, f: "1981, primo gioco in cui compare Mario, all'epoca chiamato «Jumpman»." },
    { d: 2, q: "Quale videogioco strategico in tempo reale vede zerg, protoss e terran combattersi nello spazio?", a: ["StarCraft", "Warcraft", "Command & Conquer", "Age of Empires"], c: 0, f: "1998, di Blizzard: pilastro storico degli eSport coreani." },
    { d: 2, q: "Quale MMORPG vede protagonisti eroi che difendono un mondo fantasy chiamato Azeroth?", a: ["World of Warcraft", "The Elder Scrolls", "Final Fantasy XIV", "Guild Wars"], c: 0, f: "2004, tra gli MMORPG più giocati e influenti della storia." },
    { d: 2, q: "Quale console Nintendo introduce per prima i Joy-Con removibili?", a: ["Nintendo Switch", "Wii U", "Nintendo 3DS", "Wii"], c: 0, f: "2017, ibrido tra console fissa e portatile." },
    { d: 2, q: "Quale storica saga di picchiaduro Nintendo mette insieme personaggi di franchise diversi come Mario e Pikachu?", a: ["Super Smash Bros.", "Mario Kart", "Mario Party", "Kirby's Dream Land"], c: 0, f: "Debuttò nel 1999 su Nintendo 64, riunendo per la prima volta mascotte rivali." },
    { d: 2, q: "Quale personaggio giallo pallino è inseguito da fantasmi colorati in un labirinto?", a: ["Pac-Man", "Q*bert", "Dig Dug", "Frogger"], c: 0, f: "1980, uno dei videogiochi arcade più celebri e riconoscibili di sempre." },
    { d: 2, q: "Quale gioco gestionale vede il giocatore curare pazienti con malattie surreali in un ospedale?", a: ["Theme Hospital", "Two Point Hospital", "Project Hospital", "Sim Health"], c: 0, f: "1997, celebre per l'umorismo assurdo delle patologie inventate." },
    { d: 2, q: "Quale serie di giochi calcistici giapponesi è nota anche come «Winning Eleven» in alcuni mercati?", a: ["Pro Evolution Soccer", "FIFA", "Football Manager", "Sensible Soccer"], c: 0, f: "Sviluppata da Konami, storica rivale di FIFA per decenni." },
    { d: 2, q: "Quale videogioco vede il giocatore esplorare le rovine subacquee di una città distopica chiamata Rapture?", a: ["BioShock", "Dishonored", "Prey", "System Shock"], c: 0, f: "2007, ambientato in una città sottomarina ispirata all'oggettivismo di Ayn Rand." },
    { d: 2, q: "Quale famosa saga action-adventure vede protagonisti assassini in lotta contro i Templari attraverso la storia?", a: ["Assassin's Creed", "Uncharted", "Tomb Raider", "Prince of Persia"], c: 0, f: "Debuttò nel 2007, spaziando in epoche storiche diverse a ogni capitolo." },
    { d: 3, q: "In che anno esce in Giappone la prima Famicom, poi diventata Nintendo Entertainment System in Occidente?", a: ["1983", "1985", "1980", "1990"], c: 0, f: "Arrivò negli Stati Uniti solo nel 1985, dopo il crollo del mercato videoludico americano del 1983." },
    { d: 3, q: "In che anno esce il primo Game Boy?", a: ["1989", "1985", "1995", "1980"], c: 0, f: "Nonostante uno schermo monocromatico, vendette oltre 118 milioni di unità nel corso della sua vita commerciale." },
    { d: 3, q: "Chi fondò Blizzard Entertainment nel 1991, col nome originario di Silicon & Synapse?", a: ["Un gruppo di studenti UCLA, tra cui Allen Adham e Mike Morhaime", "Un ex dipendente Nintendo", "Gabe Newell", "Shigeru Miyamoto"], c: 0, f: "Il nome fu cambiato in Blizzard Entertainment solo nel 1994." },
    { d: 3, q: "Chi fondò Valve Corporation, creatrice di Half-Life e Steam?", a: ["Gabe Newell e Mike Harrington, ex dipendenti Microsoft", "Un ex sviluppatore Nintendo", "Un team giapponese", "Shigeru Miyamoto"], c: 0, f: "Fondata nel 1996." },
    { d: 3, q: "Come si chiama uno dei primissimi videogiochi della storia, creato nel 1958 su un oscilloscopio?", a: ["Tennis for Two", "Pong", "Spacewar!", "Nimrod"], c: 0, f: "Creato da un fisico nucleare per intrattenere i visitatori di un laboratorio." },
    { d: 3, q: "In che anno esce «Pong», tra i primi videogiochi arcade di grande successo commerciale?", a: ["1972", "1968", "1980", "1975"], c: 0, f: "Sviluppato da Atari, simulava una semplicissima partita di ping pong." },
    { d: 3, q: "Chi fondò Atari nel 1972, insieme a Ted Dabney?", a: ["Nolan Bushnell", "Steve Jobs", "Gabe Newell", "Shigeru Miyamoto"], c: 0, f: "Tra le prime grandi aziende della storia dei videogiochi." },
    { d: 3, q: "In che anno esce la prima Sony PlayStation in Europa?", a: ["1995", "1994", "1997", "2000"], c: 0, f: "Uscita prima in Giappone nel dicembre 1994, poi in Occidente nel corso del 1995." },
    { d: 3, q: "Quale gioco per Atari 2600, sviluppato in fretta e furia, è diventato il simbolo del crollo del mercato videoludico nordamericano del 1983?", a: ["E.T. l'extra-terrestre", "Pac-Man per Atari", "Pong 2", "Space Invaders"], c: 0, f: "Le copie invendute furono, secondo la leggenda, sepolte in una discarica nel deserto del New Mexico." },
    { d: 3, q: "In che anno esce il primo Sonic the Hedgehog per Sega Genesis/Mega Drive?", a: ["1991", "1985", "1994", "1989"], c: 0, f: "Creato per offrire a Sega una mascotte competitiva contro Mario." },
    { d: 3, q: "Quale azienda sviluppò il primo Doom, pietra miliare degli sparatutto in prima persona?", a: ["id Software", "Epic Games", "Valve", "3D Realms"], c: 0, f: "1993, rivoluzionò il genere FPS e la scena dei mod amatoriali." },
    { d: 3, q: "In che anno esce il primo World of Warcraft?", a: ["2004", "2000", "2008", "1998"], c: 0, f: "Divenne rapidamente l'MMORPG più giocato al mondo per oltre un decennio." },
    { d: 3, q: "Quale azienda produce il Nintendo 64, lanciato nel 1996?", a: ["Nintendo", "Sony", "Sega", "NEC"], c: 0, f: "Prima grande console con controller dotato di levetta analogica integrata di serie." },
    { d: 3, q: "In che anno viene fondata Rockstar Games?", a: ["1998", "1990", "2003", "1985"], c: 0, f: "Fondata a New York, diventerà celebre soprattutto per la serie Grand Theft Auto." },
    { d: 3, q: "Quale fu la prima console con supporto CD-ROM a raggiungere un vero successo commerciale di massa?", a: ["PlayStation", "Sega Saturn", "3DO", "TurboGrafx-CD"], c: 0, f: "Sebbene non fosse la prima assoluta con lettore CD, fu la prima a sfondare davvero sul mercato." },
    { d: 3, q: "In che anno esce il primo Grand Theft Auto?", a: ["1997", "1993", "2001", "1990"], c: 0, f: "Uscito in visuale dall'alto, molto diverso graficamente dai capitoli 3D successivi." },
    { d: 3, q: "Chi è considerato il padre della serie «Final Fantasy»?", a: ["Hironobu Sakaguchi", "Hideo Kojima", "Shigeru Miyamoto", "Yuji Horii"], c: 0, f: "Il nome «Final» nacque, secondo la leggenda, perché doveva essere l'ultimo progetto della sua azienda in crisi finanziaria." },
    { d: 3, q: "In che anno esce la prima Xbox?", a: ["2001", "1998", "2005", "1995"], c: 0, f: "Primo ingresso di Microsoft nel mercato delle console casalinghe." },
    { d: 3, q: "Quale videogioco arcade del 1978 è considerato tra i capostipiti del genere sparatutto?", a: ["Space Invaders", "Asteroids", "Galaxian", "Defender"], c: 0, f: "Creato in Giappone da Tomohiro Nishikado, causò persino una carenza di monete da 100 yen nel paese." },
    { d: 3, q: "In che anno esce il primo capitolo della serie «The Elder Scrolls»?", a: ["1994", "1990", "2000", "1985"], c: 0, f: "Il primo capitolo si intitolava «Arena»." },
    { d: 3, q: "Quale azienda ha creato l'Unreal Engine, oggi tra i motori grafici più usati al mondo?", a: ["Epic Games", "Valve", "id Software", "Unity Technologies"], c: 0, f: "Sviluppato originariamente per il gioco «Unreal», del 1998." },
    { d: 2, q: "Quale azienda giapponese produce le console della serie PlayStation Portable e PS Vita?", a: ["Sony", "Nintendo", "Sega", "Microsoft"], c: 0, f: "La PSP, lanciata nel 2004, fu il primo vero tentativo di Sony nel mercato portatile." },
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
    { d: 2, s: 1, q: "Chi ha scritto «Anna Karenina», storia di una passione proibita nella Russia zarista?", a: ["Lev Tolstoj", "Fëdor Dostoevskij", "Ivan Turgenev", "Aleksandr Puškin"], c: 0, f: "1877: la protagonista paga carissimo il prezzo sociale della propria passione." },
    { d: 2, s: 1, q: "Nella mitologia greca, chi è tradizionalmente considerato figlio di Afrodite e dio del desiderio?", a: ["Eros", "Ares", "Hermes", "Efesto"], c: 0, f: "I romani lo chiamavano Cupido, spesso raffigurato con arco e frecce." },
    { d: 3, s: 1, q: "A chi è tradizionalmente attribuito il «Cantico dei Cantici», testo biblico dal tono sorprendentemente sensuale?", a: ["Salomone", "Davide", "Mosè", "Nessuna attribuzione tradizionale esiste"], c: 0, f: "Uno dei testi più espliciti e poetici sull'amore fisico dell'intera Bibbia." },
    { d: 3, s: 1, q: "Quale dea norrena è associata all'amore, alla bellezza e alla fertilità?", a: ["Freyja", "Frigg", "Idun", "Skadi"], c: 0, f: "Il suo carro era trainato da due gatti, secondo la mitologia norrena." },
    { d: 2, s: 1, q: "Chi ha scritto «Il piacere», romanzo decadente sull'edonismo di fine Ottocento?", a: ["Gabriele D'Annunzio", "Luigi Pirandello", "Italo Svevo", "Giovanni Verga"], c: 0, f: "1889, primo romanzo dell'autore, pieno di lusso, seduzione ed estetismo." },
    { d: 2, s: 1, q: "Quale scultore realizzò «Amore e Psiche», celebre gruppo scultoreo neoclassico oggi al Louvre?", a: ["Antonio Canova", "Gian Lorenzo Bernini", "Auguste Rodin", "Michelangelo"], c: 0, f: "1787-93: cattura l'attimo esatto del risveglio di Psiche al bacio di Amore." },
    { d: 2, s: 1, q: "Nella mitologia greca, chi era Paride, celebre per aver scatenato una guerra per amore di Elena?", a: ["Un principe troiano", "Un re spartano", "Un dio dell'Olimpo", "Un eroe romano"], c: 0, f: "Il suo «giudizio» tra tre dee, scegliendo Afrodite, innescò la guerra di Troia." },
    { d: 2, s: 1, q: "Chi era Cleopatra VII, celebre per le sue relazioni con Cesare e Marco Antonio?", a: ["L'ultima regina dell'Egitto tolemaico", "Una regina persiana", "Un'imperatrice romana di nascita", "Una regina greca del Peloponneso"], c: 0, f: "Parlava diverse lingue e fu un'abile stratega politica, oltre che figura leggendaria." },
    { d: 2, s: 1, q: "Da quale film cult del 1990 nasce la celebre scena del tornio da ceramica tra i protagonisti?", a: ["Ghost - Fantasma", "Pretty Woman", "Dirty Dancing", "Titanic"], c: 0, f: "Con Demi Moore e Patrick Swayze, sulle note di «Unchained Melody»." },
    { d: 2, s: 1, q: "In quale film del 1997, con Kate Winslet e Leonardo DiCaprio, c'è la celebre scena del ritratto?", a: ["Titanic", "Romeo + Giulietta", "Revolutionary Road", "The Reader"], c: 0, f: "La scena fu girata con DiCaprio che disegnava davvero, anche se la mano nel film è di James Cameron." },
    { d: 3, s: 1, q: "Quale poeta latino scrisse gli «Amores», raccolta di elegie d'amore?", a: ["Ovidio", "Catullo", "Properzio", "Tibullo"], c: 0, f: "Stesso autore dell'«Ars Amatoria», tra i più celebri poeti d'amore romani." },
    { d: 2, s: 1, q: "Chi ha scritto le poesie d'amore raccolte nel «Canzoniere», dedicate a Laura?", a: ["Francesco Petrarca", "Dante Alighieri", "Giovanni Boccaccio", "Guido Cavalcanti"], c: 0, f: "Un amore mai corrisposto, cantato per tutta la vita del poeta." },
    { d: 2, s: 1, q: "In quale film Julia Roberts interpreta una escort che si innamora del suo cliente?", a: ["Pretty Woman", "Erin Brockovich", "Notting Hill", "My Best Friend's Wedding"], c: 0, f: "1990, uno dei film romantici più iconici degli anni '90." },
    { d: 2, s: 1, q: "Quale famosa coppia shakespeariana è simbolo dell'amore proibito e tragico per eccellenza?", a: ["Romeo e Giulietta", "Otello e Desdemona", "Antonio e Cleopatra", "Beatrice e Benedetto"], c: 0, f: "Ambientata a Verona, tra due famiglie rivali, i Montecchi e i Capuleti." },
    { d: 2, s: 1, q: "Quale profumo storico, lanciato nel 1921, è associato indelebilmente a Coco Chanel?", a: ["Chanel N°5", "Opium", "Poison", "J'adore"], c: 0, f: "Si narra che Marilyn Monroe dichiarò di indossare a letto «solo qualche goccia» di quel profumo." },
    { d: 3, s: 1, q: "In quale città è ambientato il romanzo «Le relazioni pericolose», sulle manipolazioni amorose dell'aristocrazia?", a: ["Parigi, nella Francia del Settecento", "Londra vittoriana", "Vienna asburgica", "Venezia rinascimentale"], c: 0, f: "1782, romanzo epistolare di Choderlos de Laclos, poi adattato più volte al cinema." },
    { d: 2, s: 1, q: "Quale danza sudamericana è celebre per la sua sensualità e il contatto ravvicinato tra i ballerini?", a: ["Il tango", "La salsa", "Il flamenco", "La bachata"], c: 0, f: "Nato a Buenos Aires tra fine '800 e inizio '900, nei quartieri popolari del porto." },
    { d: 3, s: 1, q: "Chi ha scritto il romanzo «Justine», opera scandalosa attribuita a un celebre nobile francese?", a: ["Marchese de Sade", "Choderlos de Laclos", "Voltaire", "Denis Diderot"], c: 0, f: "1791, tra le opere più controverse della letteratura libertina francese." },
    { d: 3, s: 1, q: "Quale dea egizia era associata all'amore, alla musica e alla fertilità?", a: ["Hathor", "Iside", "Nefertari", "Bastet"], c: 0, f: "Spesso raffigurata con corna di mucca e disco solare." },
    { d: 2, s: 1, q: "In quale opera lirica la protagonista sedurrà il soldato Don José con una celebre habanera?", a: ["Carmen di Bizet", "Tosca di Puccini", "La Traviata di Verdi", "Norma di Bellini"], c: 0, f: "1875, ambientata a Siviglia, tra passione, gelosia e tragedia." },
    { d: 3, s: 1, q: "Quale celebre scultura del Bernini raffigura l'estasi mistica-sensuale di una santa?", a: ["L'estasi di Santa Teresa", "La Pietà", "Apollo e Dafne", "Il ratto di Proserpina"], c: 0, f: "1652, nella chiesa romana di Santa Maria della Vittoria: tra le opere più discusse del barocco." },
    { d: 3, s: 1, q: "Quale celebre coppia medievale, un filosofo e la sua allieva, è nota per lettere d'amore struggenti?", a: ["Abelardo ed Eloisa", "Dante e Beatrice", "Tristano e Isotta", "Lancillotto e Ginevra"], c: 0, f: "XII secolo: la loro storia finì tragicamente, ma le loro lettere sono ancora studiate." },
    { d: 2, s: 1, q: "In quale leggenda medievale un cavaliere e una regina si innamorano bevendo per errore una pozione magica?", a: ["Tristano e Isotta", "Lancillotto e Ginevra", "Abelardo ed Eloisa", "Paolo e Francesca"], c: 0, f: "Una delle storie d'amore tragico più ricorrenti nella letteratura medievale europea." },
    { d: 2, s: 1, q: "Quali due amanti, condannati nell'Inferno dantesco, furono uccisi dal marito di lei?", a: ["Paolo e Francesca", "Tristano e Isotta", "Lancillotto e Ginevra", "Abelardo ed Eloisa"], c: 0, f: "Canto V dell'Inferno: «Amor, ch'a nullo amato amar perdona»." },
    { d: 2, s: 1, q: "Chi ha diretto il film «Il Postino», storia d'amore e poesia con Pablo Neruda?", a: ["Michael Radford", "Giuseppe Tornatore", "Gabriele Salvatores", "Nanni Moretti"], c: 0, f: "1994, con Massimo Troisi, alla sua ultima interpretazione." },
    { d: 2, s: 1, q: "Quale poeta cileno, Premio Nobel, è celebre per le sue «Venti poesie d'amore»?", a: ["Pablo Neruda", "Octavio Paz", "Gabriel García Márquez", "Jorge Luis Borges"], c: 0, f: "Pubblicate quando aveva appena vent'anni, restano tra le sue opere più lette." },
    { d: 3, s: 1, q: "Chi ha scritto «L'insostenibile leggerezza dell'essere», romanzo su amore e libertà?", a: ["Milan Kundera", "Franz Kafka", "Ivan Klíma", "Bohumil Hrabal"], c: 0, f: "1984, ambientato durante la Primavera di Praga." },
    { d: 2, s: 1, q: "In quale film Audrey Hepburn interpreta una principessa che vive una storia d'amore proibita a Roma?", a: ["Vacanze romane", "Colazione da Tiffany", "Sabrina", "Cenerentola a Parigi"], c: 0, f: "1953, con Gregory Peck: le girarono in bianco e nero tra le vie della capitale." },
    { d: 2, s: 1, q: "Quale film musicale del 2016 racconta l'amore tra due sognatori a Los Angeles?", a: ["La La Land", "Whiplash", "Once", "Cantando sotto la pioggia"], c: 0, f: "Con Ryan Gosling ed Emma Stone, celebre per il finale agrodolce." },
    { d: 3, s: 1, q: "Chi ha scritto «Norwegian Wood», romanzo giapponese sull'amore e la perdita?", a: ["Haruki Murakami", "Yukio Mishima", "Kenzaburō Ōe", "Kazuo Ishiguro"], c: 0, f: "1987, titolo ispirato all'omonima canzone dei Beatles." },
    { d: 2, s: 1, q: "In quale film d'animazione Disney due cani innamorati condividono una ciotola di spaghetti?", a: ["Lilli e il Vagabondo", "101 Dalmata", "Il libro della giungla", "Red e Toby"], c: 0, f: "1955, con la celebre scena diventata iconica in tutto il mondo." },
    { d: 2, s: 1, q: "Nel mito greco, chi cerca di riportare in vita la moglie Euridice scendendo negli inferi?", a: ["Orfeo", "Teseo", "Perseo", "Giasone"], c: 0, f: "La perse per aver guardato indietro, infrangendo il patto con gli dei degli inferi." },
    { d: 3, s: 1, q: "Quale scrittrice francese scrisse «Chéri», storia dell'amore tra una donna matura e un uomo giovane?", a: ["Colette", "Simone de Beauvoir", "Marguerite Duras", "George Sand"], c: 0, f: "1920, tra le opere che le valsero fama internazionale." },
    { d: 2, s: 1, q: "In quale mito Zeus si trasforma in cigno per sedurre Leda?", a: ["Il mito di Leda e il cigno", "Il mito di Europa e il toro", "Il mito di Danae e la pioggia d'oro", "Il mito di Io e la nuvola"], c: 0, f: "Tema ripreso in arte da Leonardo, Michelangelo e molti altri." },
    { d: 2, s: 1, q: "In quale mito Zeus si trasforma in toro per rapire una principessa fenicia?", a: ["Il mito di Europa", "Il mito di Leda", "Il mito di Danae", "Il mito di Io"], c: 0, f: "Dal nome di questa principessa deriva il nome del continente europeo." },
    { d: 3, s: 1, q: "Chi ha scritto il romanzo «Memorie di una Geisha», ambientato nel mondo della seduzione giapponese tradizionale?", a: ["Arthur Golden", "Amy Tan", "Lisa See", "Yoko Ogawa"], c: 0, f: "1997: nonostante il narratore in prima persona femminile, l'autore è un uomo americano." },
    { d: 2, s: 1, q: "Chi ha scritto «Cyrano de Bergerac», storia d'amore e poesia nascosta dietro un naso importante?", a: ["Edmond Rostand", "Victor Hugo", "Alexandre Dumas", "Molière"], c: 0, f: "1897, ambientato nella Francia del Seicento, ispirato liberamente a un personaggio storico realmente esistito." },
    { d: 2, s: 1, q: "Quale attrice interpreta la protagonista di «Basic Instinct», al centro della celebre scena dell'interrogatorio?", a: ["Sharon Stone", "Demi Moore", "Kim Basinger", "Michelle Pfeiffer"], c: 0, f: "1992: la scena resta tra le più discusse e citate della storia del cinema hollywoodiano." },
    { d: 3, s: 1, q: "Quale imperatrice cinese, unica donna a governare col titolo ufficiale di imperatrice regnante, è ricordata anche per la sua fama di abile seduttrice politica?", a: ["Wu Zetian", "Cixi", "Yang Guifei", "Nefertiti"], c: 0, f: "Governò durante la dinastia Tang, un caso più unico che raro nella storia cinese." },
    { d: 2, s: 1, q: "Chi ha diretto il film «Moulin Rouge!», ambientato nel celebre cabaret parigino?", a: ["Baz Luhrmann", "Tim Burton", "Guillermo del Toro", "Wes Anderson"], c: 0, f: "2001, con Nicole Kidman ed Ewan McGregor, mix di musical e melodramma." },
    { d: 2, s: 1, q: "Quale celebre cabaret parigino, fondato nel 1889, è famoso per il can-can?", a: ["Moulin Rouge", "Lido", "Crazy Horse", "Folies Bergère"], c: 0, f: "La sua celebre pala eolica rossa è ancora oggi un'icona di Montmartre." },
    { d: 3, s: 1, q: "Chi ha scritto «La Signora delle Camelie», ispirazione per l'opera «La Traviata»?", a: ["Alexandre Dumas figlio", "Victor Hugo", "Gustave Flaubert", "Émile Zola"], c: 0, f: "1848, romanzo ispirato a una vera cortigiana parigina dell'epoca." },
    { d: 2, s: 1, q: "Quale opera verdiana racconta la storia della cortigiana Violetta Valéry?", a: ["La Traviata", "Rigoletto", "Aida", "Otello"], c: 0, f: "1853, tratta dal romanzo di Dumas figlio." },
    { d: 3, s: 1, q: "Chi ha scritto «Effi Briest», sull'adulterio nella società prussiana dell'Ottocento?", a: ["Theodor Fontane", "Thomas Mann", "Heinrich Heine", "Johann Wolfgang von Goethe"], c: 0, f: "1894, spesso paragonato a «Madame Bovary» e «Anna Karenina»." },
    { d: 2, s: 1, q: "Quale danza spagnola, spesso associata a passione e dramma, è originaria dell'Andalusia?", a: ["Il flamenco", "La sevillana", "Il paso doble", "La jota"], c: 0, f: "Con radici gitane, arabe ed ebraiche fuse nella cultura andalusa." },
    { d: 2, s: 1, q: "In quale film Rudolph Valentino, icona del cinema muto, interpreta uno sceicco seduttore?", a: ["Lo sceicco", "Il figlio dello sceicco", "Sangue e arena", "I quattro cavalieri dell'Apocalisse"], c: 0, f: "1921, lo rese uno dei primi grandi sex symbol della storia del cinema." },
    { d: 2, s: 1, q: "Chi è considerato il primo grande «sex symbol» del cinema muto, noto per «Lo sceicco»?", a: ["Rudolph Valentino", "Douglas Fairbanks", "Charlie Chaplin", "John Barrymore"], c: 0, f: "La sua morte prematura, nel 1926, scatenò scene di isteria collettiva tra le fan." },
    { d: 2, s: 1, q: "Quale attrice hollywoodiana, icona di sensualità anni '50, cantò «Happy Birthday» al presidente Kennedy?", a: ["Marilyn Monroe", "Jayne Mansfield", "Brigitte Bardot", "Sophia Loren"], c: 0, f: "1962, con un abito che sembrava cucito addosso, letteralmente." },
    { d: 2, s: 1, q: "Quale attrice francese, sex symbol degli anni '50-'60, è nota anche per il successivo impegno animalista?", a: ["Brigitte Bardot", "Catherine Deneuve", "Jeanne Moreau", "Romy Schneider"], c: 0, f: "Ritiratasi dal cinema nel 1973, si è poi dedicata quasi interamente alla difesa degli animali." },
    { d: 3, s: 1, q: "Quale attrice italiana fu tra i simboli della commedia sexy all'italiana degli anni '70?", a: ["Edwige Fenech", "Sophia Loren", "Anna Magnani", "Monica Vitti"], c: 0, f: "Protagonista di decine di commedie brillanti e leggermente piccanti di quel decennio." },
    { d: 2, s: 1, q: "Come si chiama il genere cinematografico italiano, popolare negli anni '70, con toni leggeri e situazioni piccanti?", a: ["La commedia sexy all'italiana", "Il neorealismo rosa", "Lo spaghetti-erotico", "Il cinema d'autore intimista"], c: 0, f: "Un filone molto popolare nelle sale italiane di quel decennio." },
    { d: 3, s: 1, q: "Quale scrittore inglese scrisse «Fanny Hill», tra i primi romanzi erotici in prosa inglese, nel 1748?", a: ["John Cleland", "Daniel Defoe", "Henry Fielding", "Samuel Richardson"], c: 0, f: "L'autore fu arrestato per la pubblicazione dell'opera." },
    { d: 2, s: 1, q: "Quale imperatore romano è ricordato dalle fonti antiche, spesso ostili, per gli eccessi della sua vita privata?", a: ["Nerone", "Augusto", "Traiano", "Marco Aurelio"], c: 0, f: "Molte delle accuse contro di lui vennero amplificate da storici a lui ostili, come Svetonio e Tacito." },
    { d: 2, s: 1, q: "Quale celebre film musicale del 1975 include il brano «Touch-a Touch-a Touch Me»?", a: ["The Rocky Horror Picture Show", "Grease", "Cabaret", "Hair"], c: 0, f: "Diventato un cult con proiezioni interattive ancora oggi in tutto il mondo." },
    { d: 3, s: 1, q: "Chi interpreta il Dr. Frank-N-Furter in «The Rocky Horror Picture Show»?", a: ["Tim Curry", "Meat Loaf", "Barry Bostwick", "Richard O'Brien"], c: 0, f: "Un ruolo diventato immediatamente iconico nella cultura queer e cult." },
    { d: 3, s: 1, q: "Quale scultura di Canova raffigura Paolina Bonaparte in posa semi-svestita come Venere vincitrice?", a: ["Paolina Borghese come Venere vincitrice", "La danzatrice", "Amore e Psiche", "Le Grazie"], c: 0, f: "1808, ritrae la sorella di Napoleone: causò scandalo alla corte dell'epoca." },
    { d: 2, s: 1, q: "Quale poeta romantico inglese, noto per una vita sentimentale scandalosa, fu descritto come «pazzo, cattivo e pericoloso da conoscere»?", a: ["Lord Byron", "Percy Bysshe Shelley", "John Keats", "William Wordsworth"], c: 0, f: "La frase fu pronunciata da una delle sue amanti, Lady Caroline Lamb." },
    { d: 3, s: 1, q: "Quale cortigiana e poetessa veneziana del Cinquecento è nota per i suoi versi e le sue lettere raffinate?", a: ["Veronica Franco", "Vittoria Colonna", "Gaspara Stampa", "Isabella di Morra"], c: 0, f: "Frequentò intellettuali e nobili, componendo versi che difendevano la dignità delle donne del suo tempo." },
    { d: 2, s: 1, q: "Quale danza, con origini legate alla tradizione mediorientale e nordafricana, è nota anche come «raqs sharqi»?", a: ["La danza orientale, o \"danza del ventre\"", "Il flamenco", "Il tango", "La danza balinese"], c: 0, f: "Le sue origini esatte sono dibattute, tra tradizioni popolari e rituali antichi." },
    { d: 3, s: 1, q: "Chi ha diretto il film erotico-drammatico «9 settimane e ½»?", a: ["Adrian Lyne", "Paul Verhoeven", "Brian De Palma", "Zalman King"], c: 0, f: "1986, controverso all'epoca per le sue scene esplicite per gli standard hollywoodiani." },
    { d: 2, s: 1, q: "Quale film erotico-thriller del 1987, con Michael Douglas e Glenn Close, parla di un'infedeltà dalle conseguenze terribili?", a: ["Attrazione fatale", "Basic Instinct", "Unfaithful", "Proposta indecente"], c: 0, f: "La scena del coniglio bollito è entrata nella cultura popolare come simbolo del film." },
    { d: 2, s: 1, q: "Quale film del 1993, con Demi Moore e Robert Redford, ruota attorno a una proposta economica scandalosa per una notte?", a: ["Proposta indecente", "Ghost - Fantasma", "Attrazione fatale", "Nove settimane e mezzo"], c: 0, f: "Un milione di dollari per una notte: la proposta che dà il titolo al film." },
    { d: 3, s: 1, q: "In quale paese nasce il mito letterario di Don Giovanni, il seduttore punito dal Cielo?", a: ["Spagna", "Francia", "Italia", "Germania"], c: 0, f: "Nato nel teatro spagnolo del Seicento con Tirso de Molina, ne «El burlador de Sevilla»." },
    { d: 2, s: 1, q: "Chi ha composto l'opera «Don Giovanni», sul mito del grande seduttore punito dal Cielo?", a: ["Mozart", "Rossini", "Verdi", "Puccini"], c: 0, f: "1787, su libretto di Lorenzo Da Ponte, lo stesso delle «Nozze di Figaro»." },
    { d: 2, s: 1, q: "Quale personaggio letterario spagnolo è il seduttore per eccellenza da cui deriva l'aggettivo «donnaiolo»?", a: ["Don Giovanni (Don Juan)", "Don Chisciotte", "Figaro", "Cyrano"], c: 0, f: "Nato nel teatro spagnolo del Seicento con Tirso de Molina." },
    { d: 2, s: 1, q: "Quale celebre film del 1961 con Audrey Hepburn è ambientato attorno a una vetrina di gioielleria a New York?", a: ["Colazione da Tiffany", "Sabrina", "Cenerentola a Parigi", "Vacanze romane"], c: 0, f: "Il celebre «little black dress» indossato nel film è diventato un'icona di stile." },
    { d: 3, s: 1, q: "Chi ha scritto il romanzo su cui si basa «Colazione da Tiffany»?", a: ["Truman Capote", "F. Scott Fitzgerald", "Ernest Hemingway", "J.D. Salinger"], c: 0, f: "1958, il romanzo ha un finale diverso, più amaro, rispetto al film." },
    { d: 2, s: 1, q: "Quale celebre attrice italiana, icona internazionale, era soprannominata «La Lollo»?", a: ["Gina Lollobrigida", "Sophia Loren", "Claudia Cardinale", "Silvana Mangano"], c: 0, f: "Il soprannome «La Lollo» la accompagnò per tutta la carriera internazionale." },
    { d: 2, s: 1, q: "In quale film Marilyn Monroe indossa il celebre vestito bianco sollevato da una grata della metropolitana?", a: ["Quando la moglie è in vacanza", "A qualcuno piace caldo", "Gli spostati", "Come sposare un milionario"], c: 0, f: "1955: la scena divenne una delle immagini più iconiche del XX secolo." },
    { d: 3, s: 1, q: "Quale poeta italiano del Novecento è noto anche per versi sensuali e passionali, oltre che per l'attività politica e militare?", a: ["Gabriele D'Annunzio", "Giovanni Pascoli", "Umberto Saba", "Eugenio Montale"], c: 0, f: "Vita e opera furono entrambe all'insegna dell'eccesso e della seduzione." },
    { d: 3, s: 1, q: "Quale celebre coppia di attori formò un sodalizio artistico e sentimentale turbolento, celebre per «Chi ha paura di Virginia Woolf?»?", a: ["Richard Burton ed Elizabeth Taylor", "Humphrey Bogart e Lauren Bacall", "Paul Newman e Joanne Woodward", "Spencer Tracy e Katharine Hepburn"], c: 0, f: "Si sposarono e divorziarono due volte, tra scandali e riconciliazioni pubbliche." },
    { d: 2, s: 1, q: "Chi ha diretto «Casablanca», storia d'amore ambientata durante la Seconda Guerra Mondiale?", a: ["Michael Curtiz", "John Huston", "Billy Wilder", "Howard Hawks"], c: 0, f: "1942, con Humphrey Bogart e Ingrid Bergman: «Suonala ancora, Sam» non viene mai detta esattamente così nel film." },
    { d: 2, s: 1, q: "Quale celebre musical del 1961 racconta una storia alla Romeo e Giulietta ambientata a New York?", a: ["West Side Story", "Grease", "Hair", "Saturday Night Fever"], c: 0, f: "Basato sul musical di Leonard Bernstein, vinse dieci premi Oscar." },
    { d: 2, s: 2, q: "Cosa indica la sigla LGBTQ+?", a: ["Un acronimo inclusivo per identità di genere e orientamenti sessuali non eteronormativi", "Un tipo di terapia di coppia", "Un'app di dating", "Una classificazione medica obsoleta"], c: 0, f: "L'acronimo si è ampliato nel tempo per includere sempre più identità." },
    { d: 2, s: 2, q: "Cosa si intende per «consenso informato» in ambito sessuale?", a: ["Un accordo chiaro, dato conoscendo pienamente cosa si sta accettando", "Un contratto legale scritto", "Un accordo dato una volta per sempre", "Un permesso dato da terzi"], c: 0, f: "Concetto cardine dell'educazione sessuale ed etica relazionale moderna." },
    { d: 2, s: 2, q: "Cosa indica il termine «pansessualità»?", a: ["Attrazione verso le persone indipendentemente dal genere", "Attrazione solo verso più partner contemporaneamente", "Assenza di attrazione sessuale", "Attrazione solo per persone dello stesso segno zodiacale"], c: 0, f: "Distinta dalla bisessualità per l'accento sulla non rilevanza del genere nell'attrazione." },
    { d: 2, s: 2, q: "Cosa indica il termine «asessualità»?", a: ["L'assenza, totale o parziale, di attrazione sessuale verso altri", "L'incapacità fisica di procreare", "La scelta religiosa di castità", "La paura del contatto fisico"], c: 0, f: "Non va confusa con il celibato, che è una scelta, non un orientamento." },
    { d: 3, s: 2, q: "Cosa indicano le sigle «AFAB»/«AMAB», usate in ambito di identità di genere?", a: ["Il sesso assegnato alla nascita (femmina/maschio)", "Un tipo di terapia ormonale", "Un test medico prenatale", "Una classificazione psicologica obsoleta"], c: 0, f: "Termini usati per distinguere il sesso biologico assegnato dall'identità di genere vissuta." },
    { d: 2, s: 2, q: "Cosa indica l'espressione «poliamore etico»?", a: ["Relazioni multiple consensuali basate su onestà e trasparenza tra tutte le parti", "Il tradimento giustificato", "L'amore per più oggetti materiali", "Una terapia di coppia specifica"], c: 0, f: "L'aggettivo «etico» sottolinea l'importanza del consenso informato di tutte le persone coinvolte." },
    { d: 3, s: 2, q: "Cosa indica il termine «demisessualità»?", a: ["Provare attrazione sessuale solo dopo aver sviluppato un forte legame emotivo", "L'attrazione solo per una parte del corpo", "La bisessualità parziale", "L'assenza di attrazione romantica"], c: 0, f: "Considerata da alcuni parte dello spettro asessuale." },
    { d: 2, s: 2, q: "Cosa indica clinicamente il termine «libido»?", a: ["Il desiderio sessuale", "La capacità riproduttiva", "Il livello di ormoni nel sangue", "La frequenza dei rapporti"], c: 0, f: "Termine reso celebre da Freud, poi ripreso e ridefinito da Jung." },
    { d: 2, s: 2, q: "Cosa si intende per «educazione sessuale comprensiva»?", a: ["Un percorso che copre anatomia, consenso, relazioni e salute, non solo la biologia", "Solo l'insegnamento della contraccezione", "Solo l'anatomia riproduttiva", "Un corso religioso sulla castità"], c: 0, f: "Il modello raccomandato dall'OMS per una formazione equilibrata." },
    { d: 2, s: 2, q: "Cosa indica il termine «slut-shaming»?", a: ["Giudicare o denigrare qualcuno per la sua vita sessuale", "Un tipo di terapia comportamentale", "Un rituale di iniziazione", "Una pratica di dating online"], c: 0, f: "Un fenomeno sociale su cui si concentra buona parte della critica femminista contemporanea." },
    { d: 2, s: 2, q: "Cosa indica il termine «love bombing» in una relazione?", a: ["Un eccesso iniziale di attenzioni e gesti romantici, spesso manipolatorio", "Un litigio esplosivo tra partner", "Una dichiarazione d'amore pubblica", "Un regalo molto costoso"], c: 0, f: "Spesso associato a dinamiche relazionali manipolatorie o narcisistiche." },
    { d: 2, s: 2, q: "Cosa indica il termine «red flag», molto usato nel linguaggio del dating moderno?", a: ["Un segnale d'allarme su un comportamento problematico del partner", "Un complimento sincero", "Un regalo simbolico", "Una dichiarazione ufficiale di coppia"], c: 0, f: "Il suo opposto, «green flag», indica invece un segnale positivo." },
    { d: 2, s: 2, q: "Cosa indica il termine «gaslighting» in una relazione?", a: ["Manipolare qualcuno fino a fargli mettere in dubbio la propria percezione della realtà", "Un tipo di terapia di coppia", "Un rituale romantico", "Ignorare volontariamente un messaggio"], c: 0, f: "Il nome deriva da un film del 1944, «Gaslight», dove il protagonista manipola la moglie." },
    { d: 3, s: 2, q: "Cosa si intende per «consenso continuo» in una relazione intima?", a: ["Il consenso può essere ritirato in qualsiasi momento, anche a rapporto già iniziato", "Il consenso dato una sola volta vale per sempre", "Il consenso va rinnovato solo ogni anno", "Il consenso non è mai necessario tra partner stabili"], c: 0, f: "Un principio centrale nell'educazione al consenso moderna." },
    { d: 2, s: 2, q: "Cosa indica il termine tecnico «anorgasmia»?", a: ["La difficoltà o incapacità di raggiungere l'orgasmo", "L'assenza di desiderio sessuale", "Il dolore durante il rapporto", "L'eccessiva sudorazione durante il sesso"], c: 0, f: "Può avere cause sia fisiche sia psicologiche, ed è più comune di quanto si pensi." },
    { d: 3, s: 2, q: "Cosa indica il termine medico «vaginismo»?", a: ["Una contrazione involontaria dei muscoli vaginali che rende dolorosa o impossibile la penetrazione", "Un'infezione batterica comune", "Un tipo di contraccettivo", "Una fase del ciclo mestruale"], c: 0, f: "Una condizione trattabile, spesso con supporto sia medico sia psicologico." },
    { d: 2, s: 2, q: "Quanti giorni dura in media un ciclo mestruale, secondo gli standard medici più diffusi?", a: ["Circa 28 giorni", "Circa 14 giorni", "Circa 45 giorni", "Circa 7 giorni"], c: 0, f: "La variabilità normale va comunque dai 21 ai 35 giorni circa." },
    { d: 2, s: 2, q: "Cosa indica il termine «foreplay» in italiano?", a: ["I preliminari", "La fase post-coitale", "Un tipo di posizione", "Un sinonimo di flirt online"], c: 0, f: "Spesso indicato dagli esperti come elemento chiave della soddisfazione sessuale, specialmente femminile." },
    { d: 2, s: 2, q: "Cosa indica il termine «kink», nel linguaggio della sessualità?", a: ["Un interesse o una pratica sessuale non convenzionale", "Una malattia sessualmente trasmissibile", "Un tipo di contraccettivo", "Un sinonimo di infedeltà"], c: 0, f: "Il termine copre uno spettro amplissimo di preferenze personali." },
    { d: 3, s: 2, q: "Cosa indica l'espressione «zona grigia del consenso»?", a: ["Situazioni ambigue in cui il consenso non è del tutto chiaro o esplicito", "Un tipo di illuminazione per foto intime", "Una fase della relazione senza esclusiva", "Un termine legale desueto"], c: 0, f: "Un concetto molto discusso nell'educazione contemporanea al consenso." },
    { d: 3, s: 2, q: "Cosa indica in sessuologia il termine «plateau», una delle fasi della risposta sessuale?", a: ["La fase di massima eccitazione prima dell'orgasmo", "La fase di rilassamento successiva al rapporto", "La fase iniziale del desiderio", "Un sinonimo di anorgasmia"], c: 0, f: "Fa parte del modello a quattro fasi di Masters e Johnson: eccitazione, plateau, orgasmo, risoluzione." },
    { d: 2, s: 2, q: "Chi ha sviluppato il celebre modello delle quattro fasi della risposta sessuale umana, negli anni '60?", a: ["William Masters e Virginia Johnson", "Sigmund Freud e Carl Jung", "Alfred Kinsey", "Havelock Ellis"], c: 0, f: "Le loro ricerche, basate su osservazioni dirette, furono rivoluzionarie per l'epoca." },
    { d: 3, s: 2, q: "Cosa indica la «scala Kinsey», ideata dal sessuologo Alfred Kinsey?", a: ["Una scala da 0 a 6 per misurare l'orientamento sessuale su uno spettro", "Una scala per misurare l'intensità dell'orgasmo", "Un indice di fertilità femminile", "Un test di compatibilità di coppia"], c: 0, f: "Pubblicata nel 1948, fu tra le prime a proporre un modello non binario dell'orientamento." },
    { d: 2, s: 2, q: "Cosa indica il termine «monogamia seriale»?", a: ["Avere relazioni esclusive una dopo l'altra nel tempo, non contemporanee", "Avere più partner contemporaneamente", "Non avere mai relazioni stabili", "Sposarsi più volte con la stessa persona"], c: 0, f: "Il modello relazionale più diffuso nelle società occidentali contemporanee." },
    { d: 2, s: 2, q: "Cosa indica il termine «cuffing season», diffuso nel linguaggio del dating?", a: ["La tendenza a cercare relazioni stabili durante i mesi freddi invernali", "Una pratica di bondage leggero", "Un tipo di app di incontri", "Un periodo di astinenza volontaria"], c: 0, f: "Il nome gioca sull'idea di essere «ammanettati», cuffed, a un partner durante l'inverno." },
    { d: 2, s: 2, q: "Cosa significa l'acronimo «NSA», usato nel dating casuale?", a: ["No Strings Attached, cioè senza legami", "Not Sexually Active", "New Single Available", "Never Say Anything"], c: 0, f: "Indica un accordo esplicito di relazione senza impegno sentimentale." },
    { d: 3, s: 2, q: "Cosa indica il termine «poliamoria gerarchica»?", a: ["Una struttura poliamorosa con un partner «primario» e altri secondari", "Una gerarchia aziendale applicata alla coppia", "Un tipo di terapia familiare", "Una app di incontri specifica"], c: 0, f: "Contrapposta al «poliamore non gerarchico», dove tutte le relazioni hanno pari importanza dichiarata." },
    { d: 2, s: 2, q: "Cosa indica il termine «sex positive», diffuso nell'educazione sessuale contemporanea?", a: ["Un approccio che considera la sessualità positiva se vissuta con consenso e rispetto", "Un test medico per le infezioni sessuali", "Un tipo di contraccettivo", "Un genere cinematografico"], c: 0, f: "Promuove informazione, consenso e assenza di giudizio sulle scelte sessuali altrui." },
    { d: 2, s: 2, q: "Cosa indica il termine «catcalling»?", a: ["Molestie verbali per strada rivolte a sconosciuti, spesso a sfondo sessuale", "Un tipo di app di dating", "Un rituale di corteggiamento consensuale", "Un termine per il primo appuntamento"], c: 0, f: "Un fenomeno sociale sempre più oggetto di leggi e campagne di sensibilizzazione." },
    { d: 3, s: 2, q: "Cosa indica statisticamente la cosiddetta «orgasm gap»?", a: ["Il divario tra la frequenza di orgasmi maschili e femminili nei rapporti etero", "La differenza di durata media tra un orgasmo maschile e uno femminile", "Un termine medico per la disfunzione erettile", "Un indicatore di fertilità"], c: 0, f: "Diversi studi mostrano un divario significativo nei rapporti eterosessuali, meno marcato in quelli tra donne." },
    { d: 2, s: 2, q: "Cosa indica il termine «cruising», nel gergo dell'incontro sessuale occasionale?", a: ["Cercare un partner sessuale occasionale in luoghi pubblici", "Fare un viaggio romantico in barca", "Scrivere messaggi provocatori online", "Corteggiare qualcuno con costanza"], c: 0, f: "Storicamente associato soprattutto, ma non solo, alla cultura gay maschile prima della diffusione delle app." },
    { d: 3, s: 2, q: "Cosa significa l'acronimo «ENM», sempre più diffuso nel linguaggio relazionale?", a: ["Ethical Non-Monogamy, non monogamia etica", "Extremely New Match", "Exclusive Never Married", "Easy Night Meeting"], c: 0, f: "Ombrello che comprende poliamore, relazioni aperte e altre configurazioni consensuali." },
    { d: 2, s: 2, q: "Cosa indica il termine «micro-cheating»?", a: ["Comportamenti ambigui, non esplicitamente infedeli, ma che superano i confini impliciti della coppia", "Un tradimento fisico di breve durata", "Una piccola bugia innocua", "Un tipo di app di incontri"], c: 0, f: "Un concetto molto dibattuto, perché i confini variano moltissimo da coppia a coppia." },
    { d: 2, s: 2, q: "Cosa indica il termine «benching», nel gergo del dating online?", a: ["Tenere una persona «in panchina» con poco interesse, senza chiudere né impegnarsi", "Bloccare subito un profilo", "Rispondere sempre entro un minuto", "Organizzare appuntamenti multipli lo stesso giorno"], c: 0, f: "Chi «tiene in panchina» mantiene l'opzione aperta senza reale interesse a coltivarla." },
    { d: 2, s: 2, q: "Cosa indica il termine «throuple», entrato nel linguaggio comune per certe configurazioni relazionali?", a: ["Una relazione stabile tra tre persone", "Un tipo di terapia di gruppo", "Un'app di incontri per coppie", "Un termine per il tradimento di gruppo"], c: 0, f: "Fusione delle parole inglesi «three» e «couple»." },
    { d: 2, s: 2, q: "Cosa indica il termine «afterglow», riferito al periodo successivo a un rapporto intimo?", a: ["Il senso di benessere e connessione che segue l'intimità", "La fase di eccitazione iniziale", "Un tipo di illuminazione romantica", "Un sinonimo di aftercare"], c: 0, f: "Distinto dall'aftercare, che indica più le azioni concrete di cura reciproca dopo l'intimità." },
    { d: 2, s: 3, q: "Come si chiama in gergo la masturbazione maschile?", a: ["Sega", "Doccia", "Massaggio", "Allenamento"], c: 0, f: "Termine gergale italiano tra i più diffusi e diretti." },
    { d: 2, s: 3, q: "Qual è il termine tecnico per la masturbazione, in generale?", a: ["Autoerotismo", "Petting", "Coito interrotto", "Preliminari"], c: 0, f: "Dal greco «auto» (sé stesso) ed «eros» (amore/desiderio)." },
    { d: 2, s: 3, q: "Come si chiama in gergo colloquiale italiano il preservativo?", a: ["Goldone", "Palloncino", "Cappuccio", "Ombrello"], c: 0, f: "Termine gergale diffusissimo in Italia, di origine incerta." },
    { d: 2, s: 3, q: "Qual è il termine anatomico corretto per l'insieme delle strutture genitali femminili esterne, spesso confuso con un altro termine?", a: ["Vulva", "Vagina", "Cervice", "Utero"], c: 0, f: "La vagina è il canale interno; la vulva indica l'insieme delle strutture genitali esterne." },
    { d: 2, s: 3, q: "Qual è il termine anatomico corretto per il canale genitale interno femminile?", a: ["Vagina", "Vulva", "Clitoride", "Perineo"], c: 0, f: "Un termine spesso confuso, anche nel linguaggio comune e mediatico, con la vulva." },
    { d: 2, s: 3, q: "Come si chiama in gergo un rapporto sessuale rapido e poco elaborato?", a: ["Sveltina", "Marchetta", "Situationship", "Cruising"], c: 0, f: "Termine colloquiale molto diffuso in italiano." },
    { d: 2, s: 3, q: "Cosa indica il termine gergale «trombare», molto diffuso in italiano colloquiale?", a: ["Un sinonimo informale di avere un rapporto sessuale", "Baciare appassionatamente", "Flirtare senza concludere", "Rompere una relazione"], c: 0, f: "Uno dei tanti sinonimi colloquiali italiani per l'atto sessuale." },
    { d: 2, s: 3, q: "Qual è il termine medico per l'eiaculazione che avviene prima del desiderato dal soggetto?", a: ["Eiaculazione precoce", "Disfunzione erettile", "Anorgasmia", "Vaginismo"], c: 0, f: "Una delle disfunzioni sessuali maschili più comuni, spesso trattabile con supporto medico o psicologico." },
    { d: 2, s: 3, q: "Qual è il termine medico per la difficoltà a raggiungere o mantenere un'erezione?", a: ["Disfunzione erettile", "Eiaculazione precoce", "Anorgasmia", "Priapismo"], c: 0, f: "Ha molte possibili cause, sia fisiche sia psicologiche, ed è molto comune, specie con l'età." },
    { d: 3, s: 3, q: "Cosa indica il termine medico «priapismo»?", a: ["Un'erezione prolungata e dolorosa, non legata a eccitazione sessuale", "Un tipo di contraccettivo maschile", "Un'infezione genitale comune", "Un sinonimo elegante di erezione normale"], c: 0, f: "Prende il nome dal dio greco Priapo, raffigurato con genitali sproporzionati." },
    { d: 2, s: 3, q: "Come si chiama in gergo colloquiale una persona molto attraente fisicamente?", a: ["Un fusto", "Un cesso", "Un pivello", "Un cornuto"], c: 0, f: "Termine colloquiale italiano d'uso comune, con controparte femminile «una gnocca»." },
    { d: 2, s: 3, q: "Come si definisce, in gergo colloquiale italiano, chi corteggia più persone contemporaneamente senza impegnarsi?", a: ["Un farfallone (o una farfalla)", "Un cuckold", "Un catfish", "Uno stalker"], c: 0, f: "L'immagine della farfalla richiama il volare di fiore in fiore." },
    { d: 2, s: 3, q: "Cosa indica il termine gergale «pomiciare»?", a: ["Baciarsi e toccarsi in modo appassionato, senza arrivare necessariamente al rapporto completo", "Litigare rumorosamente", "Corteggiare timidamente", "Rompere una relazione"], c: 0, f: "Termine colloquiale molto diffuso, soprattutto tra i più giovani." },
    { d: 3, s: 3, q: "Cosa indica il termine «orgasmo multiplo»?", a: ["Il raggiungimento di più orgasmi in successione ravvicinata, senza fase refrattaria completa", "Un orgasmo condiviso simultaneamente da due partner", "Un termine per l'orgasmo di gruppo", "Un orgasmo particolarmente intenso"], c: 0, f: "Più comune nella risposta sessuale femminile, ma osservato anche in alcuni uomini." },
    { d: 3, s: 3, q: "Cosa indica il termine «fase refrattaria», dopo l'orgasmo maschile?", a: ["Il periodo di recupero necessario prima di una nuova erezione/eccitazione", "La fase iniziale del desiderio", "Un sinonimo di impotenza permanente", "La fase dei preliminari"], c: 0, f: "La sua durata varia moltissimo da persona a persona e con l'età." },
    { d: 2, s: 3, q: "Come si chiama in gergo la stimolazione manuale dei genitali del partner?", a: ["Masturbazione reciproca", "Petting soltanto", "Fellatio", "Cunnilingus"], c: 0, f: "Può far parte dei preliminari o essere pratica a sé stante." },
    { d: 2, s: 3, q: "Cosa indica il termine «voyeurismo»?", a: ["Trarre eccitazione dall'osservare persone in situazioni intime, spesso senza consenso", "Esibirsi volontariamente in pubblico", "Un tipo di terapia di coppia", "Un sinonimo di gelosia estrema"], c: 0, f: "Nella sua forma non consensuale è anche un reato in molte legislazioni." },
    { d: 2, s: 3, q: "Cosa indica il termine «esibizionismo», in ambito sessuale?", a: ["Trarre eccitazione dal mostrare il proprio corpo o atti intimi ad altri, spesso non consenzienti", "Vestirsi in modo elegante", "Parlare molto di sé stessi", "Un sinonimo di narcisismo generico"], c: 0, f: "Nella sua forma non consensuale è considerato reato in molte legislazioni." },
    { d: 2, s: 3, q: "Come si chiama in gergo un bacio molto profondo e prolungato, con le lingue?", a: ["Bacio alla francese", "Bacio della buonanotte", "Bacio a stampo", "Bacio Eskimo"], c: 0, f: "Nonostante il nome, l'origine del termine «alla francese» resta incerta e dibattuta." },
    { d: 2, s: 3, q: "Cosa indica il termine «bondage», parte dell'acronimo BDSM?", a: ["L'uso di legature o restrizioni fisiche del partner a scopo erotico", "Un tipo di massaggio rilassante", "Un sinonimo di monogamia", "Una terapia di coppia"], c: 0, f: "Dall'inglese «to bind», legare." },
    { d: 3, s: 3, q: "Nel gergo BDSM, cosa indicano i ruoli di «dominante» e «sottomesso»?", a: ["Chi guida e chi si affida nel gioco erotico, sempre su base consensuale", "Ruoli fissi e immutabili nella vita reale della coppia", "Sinonimi di vincitore e perdente in una lite", "Termini legali per una separazione"], c: 0, f: "Molte persone alternano i ruoli, un comportamento noto come «switch»." },
    { d: 3, s: 3, q: "Cosa significa, nel gergo BDSM, essere uno «switch»?", a: ["Alternare tra ruolo dominante e sottomesso a seconda del momento", "Cambiare partner spesso", "Non avere preferenze sessuali definite", "Un sinonimo di poliamore"], c: 0, f: "Molte persone nella comunità kink si identificano proprio in questo ruolo flessibile." },
    { d: 2, s: 3, q: "Cosa indica il termine «roleplay» in ambito intimo?", a: ["Interpretare ruoli o personaggi diversi durante un momento intimo, per gioco", "Un litigio simulato in terapia di coppia", "Un tipo di app di dating", "Un sinonimo di infedeltà immaginaria"], c: 0, f: "Una pratica molto diffusa per aggiungere varietà e fantasia alla vita di coppia." },
    { d: 2, s: 3, q: "Come si chiama in gergo il rapporto sessuale non protetto, senza preservativo?", a: ["Sesso \"a pelle\"", "Sesso vanilla", "Sesso tantrico", "Petting"], c: 0, f: "Espressione colloquiale diffusa, da usare comunque con consapevolezza dei rischi sanitari." },
    { d: 2, s: 3, q: "Cosa indica il termine «sesso tantrico»?", a: ["Una pratica ispirata a tradizioni orientali che unisce intimità fisica e spirituale, con enfasi sulla lentezza", "Un sinonimo di sesso di gruppo", "Una posizione sessuale specifica", "Un termine per il primo rapporto di una coppia"], c: 0, f: "Ispirato ad antiche tradizioni induiste e buddhiste tantriche, reinterpretate in chiave occidentale moderna." },
    { d: 2, s: 3, q: "Cosa indica il termine «lingerie»?", a: ["Biancheria intima femminile, spesso raffinata o sensuale", "Un profumo francese", "Un tipo di massaggio", "Un tessuto specifico per abiti da sera"], c: 0, f: "Termine francese, letteralmente legato al «linge», la biancheria di lino." },
    { d: 2, s: 3, q: "Cosa indica il termine gergale «spogliarello»?", a: ["Uno spettacolo in cui ci si spoglia gradualmente, a scopo di intrattenimento o seduzione", "Un tipo di massaggio rilassante", "Una danza di coppia lenta", "Un sinonimo di corteggiamento timido"], c: 0, f: "Praticato professionalmente in locali dedicati, detti anche di «lap dance» in alcune varianti." },
    { d: 2, s: 3, q: "Cosa indica il termine «lap dance»?", a: ["Un ballo sensuale eseguito molto vicino o sulle gambe del cliente/partner", "Un tipo di terapia fisica", "Una danza di gruppo in discoteca", "Un sinonimo generico di ballo lento"], c: 0, f: "Diffuso soprattutto nei locali specializzati, con regole di contatto che variano da paese a paese." },
    { d: 3, s: 3, q: "Cosa indica il termine «edonismo», applicato in senso ampio anche alla sfera sessuale?", a: ["La ricerca del piacere come valore centrale dell'esistenza", "Il rifiuto totale del piacere fisico", "Una forma di ascetismo religioso", "Un sinonimo di monogamia rigida"], c: 0, f: "Corrente filosofica antica, da Epicuro in poi, spesso associata erroneamente al solo eccesso." },
    { d: 2, s: 3, q: "Cosa indica il termine «coito interrotto», tra i metodi contraccettivi meno affidabili?", a: ["Interrompere il rapporto prima dell'eiaculazione come metodo contraccettivo", "Un sinonimo di impotenza", "Una posizione sessuale specifica", "Un termine per il primo rapporto"], c: 0, f: "Considerato dagli esperti un metodo contraccettivo molto poco affidabile." },
    { d: 3, s: 3, q: "Qual è il termine tecnico per l'assenza di desiderio sessuale, quando diventa fonte di disagio personale?", a: ["Desiderio sessuale ipoattivo", "Anorgasmia", "Vaginismo", "Priapismo"], c: 0, f: "Può avere cause fisiche, psicologiche o relazionali, e riguarda sia uomini sia donne." },
    { d: 2, s: 3, q: "Cosa indica il termine «cybersex»?", a: ["Attività sessuale consensuale mediata da chat, video o altre tecnologie digitali", "Un virus informatico", "Un sinonimo di catfishing", "Un tipo di app di incontri"], c: 0, f: "Diffuso ancora di più con la crescita delle piattaforme di messaggistica e videochiamata." },
    { d: 2, s: 3, q: "Cosa indica il termine «sexting»?", a: ["Scambiarsi messaggi o immagini a sfondo sessuale via telefono", "Fare sesso durante una chiamata in vivavoce per errore", "Un sinonimo di flirt generico", "Un tipo di app di incontri"], c: 0, f: "Fusione delle parole inglesi «sex» e «texting»." },
    { d: 2, s: 3, q: "Cosa indica in gergo, ripreso anche nel titolo di una celebre canzone di De André, l'espressione «bocca di rosa»?", a: ["Una donna libera nell'esprimere la propria sessualità, spesso guardata con ipocrita disapprovazione", "Un tipo di rossetto", "Un fiore afrodisiaco", "Un termine dialettale per un bacio"], c: 0, f: "De André raccontò con affetto e ironia la storia di una donna «di vita facile» arrivata in un paesino." },
    { d: 2, s: 3, q: "Cosa racconta la celebre canzone «Bocca di rosa» di Fabrizio De André?", a: ["L'arrivo in un paesino di una donna libera nella sessualità e le reazioni ipocrite degli abitanti", "Una storia d'amore contrastata tra due famiglie rivali", "Un addio struggente a un amore lontano", "Una critica alla guerra"], c: 0, f: "1967, tra i brani più celebri e discussi del cantautore genovese." },
    { d: 3, s: 3, q: "Cosa indica il termine «libertino», usato spesso in ambito storico e letterario?", a: ["Chi vive la sessualità con grande libertà, sfidando le convenzioni morali del proprio tempo", "Chi è completamente casto", "Un sinonimo di romantico ingenuo", "Un termine per i giovani innamorati"], c: 0, f: "Il Settecento francese, con figure come il Marchese de Sade, fu il secolo d'oro della letteratura libertina." },
    { d: 3, s: 3, q: "Cos'era, storicamente, una «cortigiana», figura spesso associata a fascino e potere di seduzione?", a: ["Una donna di alto rango sociale e culturale, spesso amante di uomini potenti, nelle corti del passato", "Una domestica di corte", "Una dama di compagnia senza altri ruoli", "Una suora di clausura"], c: 0, f: "Figure come Veronica Franco a Venezia univano cultura, arte della conversazione e fascino." },
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
  "Chi di voi cambierebbe canale durante i titoli di coda per non piangere?",
  "Chi di voi arriverebbe in ritardo al proprio funerale?",
  "Chi di voi ha già preparato la playlist per il matrimonio, senza essere fidanzato?",
  "Chi di voi vincerebbe un reality solo per la strategia, non per simpatia?",
  "Chi di voi manderebbe ancora un vocale di cinque minuti per dire una cosa semplice?",
  "Chi di voi si offenderebbe per uno scherzo che ha fatto lui/lei mille volte?",
  "Chi di voi diventerebbe insopportabile con un profilo verificato sui social?",
  "Chi di voi si perderebbe anche con le indicazioni scritte su un foglio?",
  "Chi di voi negozierebbe il prezzo anche al supermercato?",
  "Chi di voi finge di stare bene meglio di tutti gli altri?",
  "Chi di voi ha il gruppo WhatsApp più caotico?",
  "Chi di voi cambierebbe lavoro solo per il logo sulla felpa aziendale?",
  "Chi di voi si commuove guardando le pubblicità di Natale?",
  "Chi di voi litigherebbe con un cameriere per un tavolo?",
  "Chi di voi organizzerebbe una cena a sorpresa e la rovinerebbe parlandone prima?",
  "Chi di voi si ricorda ancora tutte le password del 2015?",
  "Chi di voi farebbe la fila tutta la notte per un concerto?",
  "Chi di voi vincerebbe una discussione con un vigile, almeno in teoria?",
  "Chi di voi ha già litigato con Siri o con Alexa?",
  "Chi di voi cambia strada pur di non incontrare un ex?",
  "Chi di voi torna sempre a chiedere «hai capito cosa intendevo?»",
  "Chi di voi si presenterebbe a una festa in maschera anche senza costume?",
  "Chi di voi darebbe consigli di cucina senza saper cucinare?",
  "Chi di voi rifarebbe il letto solo se arrivano ospiti?",
  "Chi di voi crede ancora un po' agli oroscopi?",
  "Chi di voi ha mandato un messaggio alla persona sbagliata almeno una volta?",
  "Chi di voi resisterebbe più a lungo senza social media?",
  "Chi di voi urlerebbe di gioia per un parcheggio trovato al volo?",
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
  "Manda a un amico un vocale in cui reciti una filastrocca a caso.",
  "Fai dieci flessioni davanti a tutti, contando ad alta voce.",
  "Racconta il tuo momento più imbarazzante degli ultimi cinque anni.",
  "Rispondi a tutte le prossime domande con una voce da cartone animato.",
  "Fai finta di essere un influencer e presenta la stanza come fosse un video promozionale.",
  "Dichiara ad alta voce il tuo peggior difetto, come se lo stessi confessando in pubblico.",
  "Manda un messaggio alla tua mamma dicendole che le vuoi bene, in diretta davanti a tutti.",
  "Fai la caricatura vocale di un giocatore a scelta del gruppo, finché non indovinano chi è.",
  "Racconta la trama del tuo film preferito come se fosse una tragedia greca.",
  "Canta il ritornello dell'ultima canzone che hai ascoltato, senza vergogna.",
  "Fai un tutorial di trenta secondi su qualcosa che non sai fare per niente.",
  "Cammina come un fenicottero fino al punto più lontano della stanza e ritorno.",
  "Dichiara pubblicamente il tuo peggior gusto musicale.",
  "Fai un discorso motivazionale al gruppo come se steste per una finale olimpica.",
  "Imita l'ultimo litigio che hai avuto, interpretando entrambe le parti.",
  "Racconta una barzelletta, anche se fa ridere solo te.",
  "Mostra l'ultima chat che hai scritto, censurando solo i nomi.",
  "Parla per un minuto intero senza mai dire la lettera «S».",
  "Fai un balletto da dieci secondi ispirato al tuo animale preferito.",
  "Racconta il sogno più strano che ricordi.",
  "Fai un annuncio del meteo inventato, con tono da telegiornale.",
  "Descrivi il tuo lavoro o i tuoi studi come se fossero una missione segreta.",
  "Fai una telefonata immaginaria lamentandoti con un servizio clienti.",
  "Canticchia la melodia dell'inno nazionale, senza usare le parole.",
  "Racconta la tua giornata di ieri come se fosse un episodio di un reality drammatico.",
  "Fai il verso di tre animali diversi, a scelta del gruppo.",
  "Recita a memoria l'inizio di una fiaba, inventando il finale sul momento.",
  "Fai un selfie con la faccia più assurda possibile e mostralo al gruppo.",
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
  { a: "Colazione a letto", b: "Cena vista tramonto" },
  { a: "Lettera scritta a mano", b: "Messaggio vocale di notte" },
  { a: "Ballo lento", b: "Corsa sotto la pioggia mano nella mano" },
  { a: "Un mazzo di fiori", b: "Un libro dedicato" },
  { a: "Sorpresa organizzata", b: "Improvvisazione totale" },
  { a: "Baciare in pubblico", b: "Baciare di nascosto" },
  { a: "Vestirsi eleganti per l'altro", b: "Stare comodi in casa insieme" },
  { a: "Guardarsi negli occhi in silenzio", b: "Parlare fino a tardi" },
  { a: "Regalo fatto a mano", b: "Regalo costoso" },
  { a: "Un weekend in montagna", b: "Un weekend in una grande città" },
  { a: "Fidarsi subito", b: "Conquistare la fiducia piano piano" },
  { a: "Dichiararsi per primi", b: "Aspettare un segnale" },
  { a: "Un abbraccio lungo", b: "Una carezza improvvisa" },
  { a: "Cena cucinata insieme", b: "Cena al ristorante" },
  { a: "Un ballo improvvisato in cucina", b: "Una serenata sotto la finestra" },
  { a: "Ricordare ogni anniversario", b: "Vivere alla giornata" },
  { a: "Gelosia leggera", b: "Fiducia totale" },
  { a: "Un selfie di coppia", b: "Un ricordo solo per voi due" },
  { a: "Litigare e chiarire subito", b: "Prendersi tempo per pensare" },
  { a: "Sorprendere con un viaggio", b: "Programmare tutto insieme" },
  { a: "Un bacio sotto la pioggia", b: "Un bacio sotto le stelle" },
  { a: "Complice in pubblico", b: "Riservato in pubblico" },
  { a: "Scriversi ogni giorno", b: "Sentirsi quando serve davvero" },
  { a: "Un regalo a sorpresa", b: "Un regalo chiesto esplicitamente" },
  { a: "Ballare guancia a guancia", b: "Cantare a squarciagola insieme" },
  { a: "Un weekend senza telefono", b: "Condividere ogni foto in tempo reale" },
  { a: "Aspettare il momento giusto", b: "Cogliere l'attimo" },
  { a: "Complimenti espliciti", b: "Sguardi che dicono tutto" },
  { a: "Un picnic romantico", b: "Una cena stellata" },
  { a: "Custodire un segreto insieme", b: "Non avere segreti" },
  { a: "Riconciliarsi con un gesto", b: "Riconciliarsi con le parole" },
  { a: "Un amore prevedibile e stabile", b: "Un amore imprevedibile" },
  { a: "Fare progetti a lungo termine", b: "Vivere il presente" },
  { a: "Corteggiare con la musica", b: "Corteggiare con la cucina" },
  { a: "Un appuntamento al buio", b: "Conoscersi piano, da amici" },
  { a: "Mano nella mano in strada", b: "Un messaggio dolce a sorpresa" },
  { a: "Un weekend avventura", b: "Un weekend relax totale" },
  { a: "Essere corteggiati con costanza", b: "Essere conquistati con un solo grande gesto" },
  { a: "Fidarsi ciecamente", b: "Verificare sempre" },
  { a: "Un amore silenzioso e profondo", b: "Un amore dichiarato ad alta voce" },
  { a: "Ricevere attenzioni davanti a tutti", b: "Riceverle in privato" },
  { a: "Un primo appuntamento classico", b: "Un primo appuntamento fuori dagli schemi" },
  { a: "Restare amici prima di tutto", b: "Buttarsi subito" },
  { a: "Un bacio a sorpresa in ascensore", b: "Un bacio atteso a lungo" },
  { a: "Condividere ogni pensiero", b: "Mantenere un po' di mistero" },
  { a: "Un anniversario festeggiato in grande", b: "Un anniversario vissuto in intimità" },
  { a: "Essere rassicurati con le parole", b: "Essere rassicurati con i gesti" },
  { a: "Un amore che fa ridere", b: "Un amore che fa sognare" },
];

const TITOLI = [
  { t: "Re/Regina del Trash", d: "Sa tutto di Sanremo, niente della Rivoluzione francese." },
  { t: "Enciclopedia Vivente", d: "Alle feste è insopportabile. Ma vince." },
  { t: "Fascino Fatale", d: "Ha risposto giusto solo alle domande piccanti. Tutto torna." },
  { t: "Cuore Impavido", d: "Ha rischiato su tutto. Ha funzionato. Quasi sempre." },
];

/* ---------------- RED FLAG: modalità a sé stante ----------------
 * Non tocca il motore quiz: stato, contenuti e punteggio (bandiere) separati.
 * Vince chi finisce con MENO bandiere. Ogni carta ha un livello (lv 1-4) che
 * segue l'intensità scelta dall'host: il mazzo include tutto ciò che è
 * lv <= livello corrente, quindi alzare l'intensità aggiunge carte più
 * cattive senza togliere quelle più leggere. */
const RF_INTENSITY = [
  { level: 1, key: "flirt", emoji: "🌶️", label: "Flirt", desc: "Leggero, si ride." },
  { level: 2, key: "hot", emoji: "🔥", label: "Hot", desc: "Personale, imbarazzante." },
  { level: 3, key: "redflag", emoji: "🚩", label: "Red Flag", desc: "Scomodo, senza filtri." },
  { level: 4, key: "nofilter", emoji: "💀", label: "No Filter", desc: "Le più cattive." },
];

const RF_SCELTA = [
  { lv: 1, q: "Con chi preferiresti uscire stasera?", a: "La tua crush", b: "La persona più tossica del gruppo" },
  { lv: 1, q: "Chi porteresti a conoscere i tuoi genitori?", a: "Il tuo attuale interesse", b: "Il tuo ex peggiore" },
  { lv: 1, q: "Meglio essere...", a: "Ghostati senza spiegazioni", b: "Lasciati con un vocale di 10 minuti" },
  { lv: 2, q: "Cosa è peggio?", a: "Stalkerare i social di un ex", b: "Farsi beccare a stalkerare" },
  { lv: 2, q: "Chi scegli come complice per un colpo di scena in amore?", a: "Il più bugiardo del gruppo", b: "Il più ingenuo del gruppo" },
  { lv: 2, q: "Meglio...", a: "Un red flag dichiarato", b: "Un green flag che nasconde qualcosa" },
  { lv: 2, q: "Cosa faresti prima?", a: "Rispondere a un ex alle 3 di notte", b: "Rispondere al capo alle 3 di notte" },
  { lv: 2, q: "Chi è più pericoloso in una storia?", a: "Chi promette troppo", b: "Chi non promette niente" },
  { lv: 3, q: "Meglio scoprire che il/la partner...", a: "Ha un ex da cui non si è mai staccato", b: "Ha un profilo segreto sui social" },
  { lv: 3, q: "Chi inviteresti al tuo matrimonio, anche da ex?", a: "Il primo amore", b: "L'ultimo colpo di testa" },
  { lv: 3, q: "Cosa è più da red flag?", a: "Sparire dopo il primo appuntamento", b: "Presentarsi con la lista delle regole" },
  { lv: 3, q: "Meglio...", a: "Un partner geloso ma presente", b: "Un partner libero ma assente" },
  { lv: 3, q: "Chi salveresti in una crisi di gruppo?", a: "Chi dice sempre la verità, anche quando fa male", b: "Chi mente per proteggerti" },
  { lv: 2, q: "Cosa perdoneresti prima?", a: "Una bugia detta per gelosia", b: "Un silenzio durato una settimana" },
  { lv: 1, q: "Meglio...", a: "Innamorarsi troppo in fretta", b: "Non innamorarsi mai abbastanza" },
  { lv: 3, q: "Chi è più da tenere d'occhio?", a: "Chi parla sempre bene di tutti", b: "Chi non parla mai di nessuno" },
  { lv: 4, q: "Se doveste rompere stasera, meglio...", a: "Farlo davanti a tutto il gruppo", b: "Sparire e farlo scoprire dagli altri" },
  { lv: 4, q: "Chi di voi due merita di più un red flag ufficiale?", a: "Chi ha alla sua sinistra", b: "Chi ha alla sua destra" },
  { lv: 4, q: "Meglio...", a: "Un segreto del gruppo detto a un estraneo", b: "Un segreto tuo detto al gruppo sbagliato" },
  { lv: 4, q: "Cosa è più imperdonabile?", a: "Mentire per convenienza", b: "Dire una verità solo per ferire" },
];

const RF_CONFESSIONE = [
  { lv: 1, q: "Qual è la bugia più innocua che dici sempre?" },
  { lv: 1, q: "Qual è il tuo peggior difetto in una relazione, secondo te?" },
  { lv: 1, q: "Hai mai finto di stare bene per non rovinare una serata?" },
  { lv: 2, q: "Hai mai mentito per evitare un impegno e poi hai detto «non significa niente»?" },
  { lv: 2, q: "Hai mai tenuto due persone sulla corda nello stesso periodo?" },
  { lv: 2, q: "Hai mai fatto ghosting a qualcuno di questo gruppo?" },
  { lv: 2, q: "Hai mai usato «sono complicato/a» come scusa per non impegnarti?" },
  { lv: 3, q: "Hai mai controllato il telefono di un/una partner di nascosto?" },
  { lv: 3, q: "Hai mai fatto il/la interessante con qualcuno solo per far ingelosire un altro?" },
  { lv: 3, q: "Hai mai promesso di richiamare e non l'hai mai fatto, di proposito?" },
  { lv: 3, q: "Hai mai detto «ne parliamo dal vivo» solo per guadagnare tempo?" },
  { lv: 3, q: "Hai mai fatto credere di essere single quando non lo eri?" },
  { lv: 3, q: "Hai mai cancellato una chat per non farla vedere a nessuno?" },
  { lv: 2, q: "Hai mai fatto un complimento a qualcuno solo per interesse?" },
  { lv: 3, q: "Hai mai usato questo gruppo per farti notare da un ex?" },
  { lv: 4, q: "Qual è la cosa più meschina che hai fatto per gelosia?" },
  { lv: 4, q: "Hai mai sabotato di proposito la storia di qualcuno di questo gruppo?" },
  { lv: 4, q: "Qual è la bugia più grossa che hai detto a qualcuno seduto qui?" },
  { lv: 4, q: "Chi in questo gruppo tratteresti peggio se non ci fossero testimoni?" },
];

/** Voto segreto su un membro del gruppo: usata sia da «Chi è la Red Flag»
 *  sia, mescolata a RF_CAOS, dalla modalità «Caos». */
const RF_VOTE = [
  { lv: 1, q: "Chi di voi manderebbe un vocale di scuse invece di chiamare?" },
  { lv: 1, q: "Chi di voi si offenderebbe per uno scherzo che ha fatto lui/lei mille volte?" },
  { lv: 1, q: "Chi di voi direbbe «non sono geloso/a» proprio mentre controlla l'orologio?" },
  { lv: 2, q: "Chi di voi ha già fatto ghosting a qualcuno senza sensi di colpa?" },
  { lv: 2, q: "Chi di voi controllerebbe il telefono del/della partner, anche solo una volta?" },
  { lv: 2, q: "Chi di voi direbbe «sto bene» mentre sta malissimo?" },
  { lv: 2, q: "Chi di voi ha una lista segreta di ex da non nominare mai?" },
  { lv: 3, q: "Chi di voi cambierebbe versione dei fatti a seconda di chi ascolta?" },
  { lv: 3, q: "Chi di voi terrebbe un segreto del gruppo, ma solo se conveniente?" },
  { lv: 3, q: "Chi di voi sparirebbe da una chat di gruppo senza spiegazioni?" },
  { lv: 3, q: "Chi di voi giurerebbe di essere cambiato/a, sapendo di non esserlo?" },
  { lv: 3, q: "Chi di voi userebbe «non voglio etichette» per non impegnarsi davvero?" },
  { lv: 2, q: "Chi di voi risponderebbe «dipende» a una domanda che meritava un sì o un no?" },
  { lv: 3, q: "Chi di voi ha già mentito su dove si trovava, anche per una cosa innocua?" },
  { lv: 3, q: "Chi di voi lascerebbe in sospeso qualcuno solo per tenerselo come piano B?" },
  { lv: 3, q: "Chi di voi farebbe il doppio gioco pur di non deludere nessuno?" },
  { lv: 4, q: "Chi di voi mentirebbe spudoratamente in faccia a un amico, se gli convenisse?" },
  { lv: 4, q: "Chi di voi tradirebbe la fiducia del gruppo per una storia che finirà comunque male?" },
];

/** Carte «Caos»: pescate a caso, votano tutti, il tema cambia ogni volta. */
const RF_CAOS = [
  { lv: 1, q: "Chi di voi rovinerebbe una sorpresa solo perché non resiste a stare zitto/a?" },
  { lv: 2, q: "Chi di voi si farebbe corrompere più facilmente con del cibo?" },
  { lv: 2, q: "Chi di voi mentirebbe su un alibi per coprire un amico, senza fare domande?" },
  { lv: 3, q: "Chi di voi sarebbe capace di sabotare una serata altrui per gelosia?" },
  { lv: 3, q: "Chi di voi cambia gruppo di amici più spesso senza spiegare perché?" },
  { lv: 3, q: "Chi di voi accetterebbe soldi per sparire da una vita per un mese?" },
  { lv: 4, q: "Chi di voi tradirebbe questo gruppo per un posto tra le persone «giuste»?" },
  { lv: 4, q: "Chi di voi è più bravo a fingere di non aver fatto qualcosa che ha fatto?" },
  { lv: 4, q: "Chi di voi lascerebbe indietro qualcuno del gruppo se le cose si mettessero male?" },
  { lv: 1, q: "Chi di voi convincerebbe tutti a fare una follia e poi si tirerebbe indietro per primo?" },
];

/** «Bluff»: il bersaglio risponde a voce, decidendo in segreto se dire la
 *  verità o inventare. Il gruppo poi vota se ci ha creduto o no. */
const RF_BLUFF = [
  { lv: 1, q: "Qual è la bugia più assurda che hai raccontato per uscire da un impegno?" },
  { lv: 1, q: "Qual è la scusa più creativa che useresti per arrivare tardi a un appuntamento?" },
  { lv: 1, q: "Qual è il complimento più esagerato che hai mai fatto per fare colpo su qualcuno?" },
  { lv: 2, q: "Qual è la cosa più strana che diresti per fare colpo al primo appuntamento?" },
  { lv: 2, q: "Qual è la bugia bianca che diresti per evitare una lite di coppia?" },
  { lv: 2, q: "Qual è il messaggio più imbarazzante che potresti aver mandato a una crush?" },
  { lv: 2, q: "Qual è il motivo più assurdo per cui potresti aver ignorato un messaggio?" },
  { lv: 2, q: "Qual è la scusa che daresti se ti beccassero a guardare il profilo di un ex?" },
  { lv: 3, q: "Qual è la bugia più grossa che diresti per coprire un amico in una serata andata male?" },
  { lv: 3, q: "Qual è la scusa che useresti per giustificare uno stalking sui social?" },
  { lv: 3, q: "Qual è la bugia che diresti per non ammettere di avere ancora sentimenti per un ex?" },
  { lv: 3, q: "Qual è la versione dei fatti che daresti per non ammettere una gelosia?" },
  { lv: 4, q: "Qual è la bugia più cattiva che diresti per proteggere solo te stesso/a?" },
  { lv: 4, q: "Qual è il segreto più grosso che negheresti fino alla morte?" },
  { lv: 4, q: "Qual è la bugia che diresti in faccia a un amico se ti convenisse davvero?" },
];

/** «Crush»: stesso schema di «Chi è la Red Flag» — voto segreto — ma sul
 *  tema cotte e attrazione nel gruppo. */
const RF_CRUSH = [
  { lv: 1, q: "Chi di voi flirterebbe pur di vincere un gioco?" },
  { lv: 1, q: "Chi di voi arrossisce più facilmente se lo prendono in giro per una cotta?" },
  { lv: 1, q: "Chi di voi ha la cotta più ovvia del gruppo, che notano tutti tranne l'interessato/a?" },
  { lv: 2, q: "Chi di voi ha già avuto una cotta per qualcuno seduto in questa stanza?" },
  { lv: 2, q: "Chi di voi manderebbe un messaggio a una crush solo per farsi vedere online?" },
  { lv: 2, q: "Chi di voi ha già fatto il tenero solo per attirare l'attenzione di qualcuno qui?" },
  { lv: 2, q: "Chi di voi ha una lista di cotte più lunga di quanto ammetta?" },
  { lv: 3, q: "Chi di voi ha una cotta segreta che non ha mai confessato a nessuno?" },
  { lv: 3, q: "Chi di voi cambierebbe programma se sapesse che la sua crush si presenta?" },
  { lv: 3, q: "Chi di voi ha già mentito su chi gli piace davvero?" },
  { lv: 3, q: "Chi di voi si è già ingelosito/a per una cotta non corrisposta?" },
  { lv: 4, q: "Chi di voi ha già provato a rimorchiare l'ex di un amico?" },
  { lv: 4, q: "Chi di voi confesserebbe una cotta per il/la partner di qualcun altro qui presente?" },
  { lv: 4, q: "Chi di voi flirterebbe con la crush di un amico pensando di non essere scoperto?" },
];

const RF_SCELTA_T = 10, RF_CONF_T = 15, RF_VOTE_T = 15, RF_HOTSEAT_T = 30, RF_HOTSEAT_VOTE_T = 12, RF_BLUFF_T = 18, RF_BLUFFVOTE_T = 12;

/** I sei titoli finali, assegnati sulle statistiche raccolte durante la partita. */
const RF_TITLES = [
  { key: "green", emoji: "👑", label: "Green Flag", pick: (st) => [...st].sort((a, b) => a.flags - b.flags)[0] },
  { key: "heartbreaker", emoji: "😏", label: "Heartbreaker", pick: (st) => [...st].sort((a, b) => b.votedFor - a.votedFor)[0] },
  { key: "suprema", emoji: "🚩", label: "Red Flag Suprema", pick: (st) => [...st].sort((a, b) => b.flags - a.flags)[0] },
  { key: "bugiardo", emoji: "🎭", label: "BugiarDO", pick: (st) => [...st].sort((a, b) => (b.passiConf + b.passiHot) - (a.passiConf + a.passiHot))[0] },
  { key: "nonconfessa", emoji: "🫣", label: "Non confessa mai", pick: (st) => [...st].sort((a, b) => b.passiConf - a.passiConf)[0] },
  { key: "peggiore", emoji: "😂", label: "Peggior decisione", pick: (st) => [...st].sort((a, b) => b.sceltaMancate - a.sceltaMancate)[0] },
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
@keyframes spinIdle{from{transform:rotate(0)}to{transform:rotate(360deg)}}
@keyframes stampIn{0%{transform:scale(2.4) rotate(-1deg);opacity:0}60%{transform:scale(.94) rotate(-1deg);opacity:1}100%{transform:scale(1) rotate(-1deg);opacity:1}}
@keyframes slideL{from{transform:translateX(-60px);opacity:0}to{transform:translateX(0);opacity:1}}
@keyframes slideR{from{transform:translateX(60px);opacity:0}to{transform:translateX(0);opacity:1}}
@keyframes grow{from{transform:scaleY(0)}to{transform:scaleY(1)}}
@keyframes flagWave{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(5deg)}}
@keyframes scan{0%{transform:translateY(-100%)}100%{transform:translateY(100vh)}}
@keyframes presenterBob{0%,100%{transform:translateY(0) rotate(-1deg)}50%{transform:translateY(-6px) rotate(1deg)}}
@keyframes presenterBlink{0%,92%,100%{transform:scaleY(1)}96%{transform:scaleY(.1)}}
@keyframes presenterTalk{0%,100%{transform:scaleY(.45)}50%{transform:scaleY(1)}}
@keyframes presenterGlow{0%,100%{opacity:.35;transform:scale(1)}50%{opacity:.65;transform:scale(1.1)}}
@keyframes presenterMicPulse{0%{transform:scale(.5);opacity:.7}100%{transform:scale(2.4);opacity:0}}
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
.wheel-idle{animation:spinIdle 14s linear infinite}
.stamp-in{animation:stampIn .5s cubic-bezier(.2,.7,.3,1) both}
.slide-l{animation:slideL .35s ease-out both}
.slide-r{animation:slideR .35s ease-out both}
.grow-up{transform-origin:bottom;animation:grow .55s cubic-bezier(.2,.8,.3,1) both}
.flag-wave{display:inline-block;animation:flagWave 1.6s ease-in-out infinite;transform-origin:bottom left}
.rf-scan{position:absolute;inset:0;overflow:hidden;pointer-events:none}
.rf-scan::after{content:"";position:absolute;left:0;right:0;height:35%;background:linear-gradient(180deg,transparent,rgba(255,255,255,.05),transparent);animation:scan 7s linear infinite}
.press{transition:transform .07s ease,box-shadow .07s ease}
.press:active{transform:translate(3px,3px);box-shadow:none!important}
button:focus-visible{outline:3px solid ${C.cream};outline-offset:3px}
input{font-family:inherit}
.presenter-bob{animation:presenterBob 2.4s ease-in-out infinite}
.presenter-blink{transform-box:fill-box;transform-origin:center;animation:presenterBlink 4.5s ease-in-out infinite}
.presenter-mouth-talk{transform-box:fill-box;transform-origin:center;animation:presenterTalk .22s ease-in-out infinite}
.presenter-glow{animation:presenterGlow 2.2s ease-in-out infinite}
.presenter-mic-pulse{transform-box:fill-box;transform-origin:center;animation:presenterMicPulse 1s ease-out infinite}
@media (prefers-reduced-motion:reduce){.tvin,.glow,.pop,.shake,.buzzer-on,.buzzer-hot,.bump,.rise-in,.confetti-piece,.sweep-bar,.gallop,.spin-face,.tick-pulse,.wheel-idle,.stamp-in,.slide-l,.slide-r,.grow-up,.flag-wave,.rf-scan::after,.presenter-bob,.presenter-blink,.presenter-mouth-talk,.presenter-glow,.presenter-mic-pulse{animation:none!important}}
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

/** Mascotte presentatore: SVG neo-brutalista, dondola in idle e apre/chiude
 *  la bocca a ripetizione mentre `talking` è vero (sincronizzato a grana
 *  grossa con la voce sintetizzata, non frame-accurate ma sufficiente). */
function Presenter({ talking = false, color = C.gold, size = 132 }) {
  return (
    <div className="relative flex items-center justify-center" style={{ width: size * 1.3, height: size * 1.4 }}>
      <div aria-hidden className="presenter-glow" style={{
        position: "absolute", width: size * 1.05, height: size * 1.05, borderRadius: "9999px",
        background: `radial-gradient(circle, ${color}66, transparent 70%)`, filter: "blur(16px)",
      }} />
      <div className="presenter-bob relative" style={{ width: size, height: size * 1.15 }}>
        <svg viewBox="0 0 140 150" width="100%" height="100%" aria-hidden>
          <ellipse cx="70" cy="144" rx="36" ry="5" fill="rgba(0,0,0,.35)" />
          <path d="M20 150 Q20 104 70 104 Q120 104 120 150 Z" fill={C.ink} stroke={C.cream} strokeWidth="4" />
          <path d="M96 120 Q113 113 116 90" stroke={C.ink} strokeWidth="11" fill="none" strokeLinecap="round" />
          <path d="M96 120 Q113 113 116 90" stroke={color} strokeWidth="5" fill="none" strokeLinecap="round" />
          {talking && <circle className="presenter-mic-pulse" cx="117" cy="87" r="9" fill="none" stroke={color} strokeWidth="2" />}
          <rect x="112" y="93" width="10" height="15" rx="3" fill="#2b2b2b" stroke={C.cream} strokeWidth="1.5" />
          <circle cx="117" cy="86" r="9" fill="#2b2b2b" stroke={C.cream} strokeWidth="2.5" />
          <path d="M60 106 L70 114 L60 122 Z" fill={color} stroke={C.ink} strokeWidth="3" />
          <path d="M80 106 L70 114 L80 122 Z" fill={color} stroke={C.ink} strokeWidth="3" />
          <circle cx="70" cy="114" r="4.5" fill={C.ink} stroke={C.cream} strokeWidth="2" />
          <circle cx="70" cy="58" r="48" fill={color} stroke={C.ink} strokeWidth="5" />
          <path d="M38 28 Q50 4 68 18 Q82 0 100 24" fill="none" stroke={C.ink} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="36" cy="68" r="7" fill={C.magenta} opacity=".5" />
          <circle cx="104" cy="68" r="7" fill={C.magenta} opacity=".5" />
          <rect x="37" y="38" width="20" height="6" rx="3" fill={C.ink} transform="rotate(-8 47 41)" />
          <rect x="83" y="38" width="20" height="6" rx="3" fill={C.ink} transform="rotate(8 93 41)" />
          <ellipse className="presenter-blink" cx="50" cy="56" rx="7.5" ry="9.5" fill={C.ink} />
          <ellipse className="presenter-blink" cx="90" cy="56" rx="7.5" ry="9.5" fill={C.ink} />
          <circle cx="52.5" cy="53" r="2" fill={C.cream} />
          <circle cx="92.5" cy="53" r="2" fill={C.cream} />
          {talking ? (
            <ellipse className="presenter-mouth-talk" cx="70" cy="82" rx="14" ry="10" fill={C.ink} />
          ) : (
            <rect x="55" y="84" width="30" height="5" rx="2.5" fill={C.ink} />
          )}
        </svg>
      </div>
    </div>
  );
}

/** Ruota della roulette vera: 13 spicchi colorati, freccia fissa in alto.
 *  In attesa gira piano; alla rivelazione accelera e si ferma sul numero uscito. */
function RouletteWheel({ numero, spinning, accent }) {
  const SEG = 13;
  const seg = 360 / SEG;
  const targetAngle = useMemo(() => {
    if (numero == null) return 0;
    return 360 * 5 + (360 - (numero * seg + seg / 2));
  }, [numero]); // eslint-disable-line
  const [angle, setAngle] = useState(0);

  useEffect(() => {
    if (spinning && numero != null) {
      setAngle(0);
      const t = setTimeout(() => setAngle(targetAngle), 40);
      return () => clearTimeout(t);
    }
    setAngle(0);
  }, [spinning, numero, targetAngle]);

  const wedges = Array.from({ length: SEG }, (_, n) => {
    const color = n === 0 ? "#2FBF71" : rouColore(n) === "rosso" ? C.magenta : "#1B1226";
    return `${color} ${n * seg}deg ${(n + 1) * seg}deg`;
  }).join(",");

  return (
    <div className="relative mx-auto" style={{ width: 240, height: 240 }}>
      <div aria-hidden className="absolute rounded-full" style={{
        inset: -12, background: "radial-gradient(circle at 35% 30%, #6b431c, #2a1808 65%, #150d06)",
        boxShadow: "0 10px 26px rgba(0,0,0,.55), inset 0 0 0 3px rgba(255,201,60,.35)",
      }} />
      <div className={!spinning ? "wheel-idle" : ""} style={{
        position: "absolute", inset: 0, borderRadius: "9999px", overflow: "hidden",
        background: `conic-gradient(${wedges})`,
        transform: `rotate(${angle}deg)`,
        transition: spinning ? "transform 3.2s cubic-bezier(.13,.85,.18,1)" : "none",
        boxShadow: "inset 0 0 0 2px rgba(255,243,230,.3), inset 0 0 18px rgba(0,0,0,.5)",
      }}>
        {Array.from({ length: SEG }, (_, n) => (
          <div key={n} className="absolute inset-0" style={{ transform: `rotate(${n * seg + seg / 2}deg)` }}>
            <span className="absolute left-1/2 top-2 -translate-x-1/2 text-sm font-bold" style={{ color: C.cream, fontFamily: display.fontFamily, textShadow: "0 1px 2px rgba(0,0,0,.6)" }}>{n}</span>
          </div>
        ))}
      </div>
      <div aria-hidden className="absolute rounded-full" style={{
        left: "50%", top: "50%", width: 42, height: 42, transform: "translate(-50%,-50%)",
        background: "radial-gradient(circle at 35% 30%, #FFE7A8, #FFC93C 55%, #a9791c 100%)",
        boxShadow: "0 3px 8px rgba(0,0,0,.5)",
      }} />
      <div aria-hidden style={{
        position: "absolute", top: -8, left: "50%", transform: "translateX(-50%)",
        width: 0, height: 0, borderLeft: "9px solid transparent", borderRight: "9px solid transparent",
        borderTop: `15px solid ${accent}`, filter: "drop-shadow(0 2px 3px rgba(0,0,0,.55))",
      }} />
    </div>
  );
}

/** Pista dei cavalli: gate di partenza, corsia con erba a righe, traguardo a
 *  scacchi. In attesa i cavalli scalpitano ai blocchi; alla rivelazione
 *  corrono e chi ha vinto (deciso dalla logica di gioco) arriva sempre avanti. */
function HorseRace({ cavalli, winner, racing }) {
  const [go, setGo] = useState(false);
  const [via, setVia] = useState(false);
  const targets = useMemo(() => cavalli.map((c, i) => (
    i === winner
      ? { dist: 88 + Math.random() * 5, dur: 2.1 + Math.random() * 0.35 }
      : { dist: 42 + Math.random() * 36, dur: 1.7 + Math.random() * 0.6 }
  )), [winner]); // eslint-disable-line

  useEffect(() => {
    if (racing && winner != null) {
      setGo(false); setVia(false);
      const t1 = setTimeout(() => { setGo(true); setVia(true); }, 260);
      const t2 = setTimeout(() => setVia(false), 1050);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    setGo(false); setVia(false);
  }, [racing, winner]);

  return (
    <div className="relative w-full overflow-hidden border-2" style={{ borderColor: "rgba(255,243,230,.25)" }}>
      {via && (
        <div className="pop absolute inset-0 z-20 flex items-center justify-center" style={{ background: "rgba(20,6,32,.35)" }}>
          <span className="text-6xl uppercase" style={{ ...display, color: C.gold, textShadow: "0 3px 0 rgba(0,0,0,.6)" }}>Via!</span>
        </div>
      )}
      {cavalli.map((c, i) => (
        <div key={i} className="relative flex items-stretch" style={{
          height: 58, borderTop: i ? "2px solid rgba(0,0,0,.25)" : "none",
          background: `repeating-linear-gradient(90deg, #2c6d3b 0 28px, #275f34 28px 56px)`,
        }}>
          <div className="z-10 flex w-32 shrink-0 flex-col justify-center px-2 sm:w-44" style={{ background: "rgba(20,6,32,.55)" }}>
            <span className="truncate text-xs font-bold uppercase sm:text-sm" style={{ ...display, color: C.cream }}>{c.nome}</span>
            <span className="text-[10px] font-bold opacity-70 sm:text-xs">quota {c.quota}</span>
          </div>
          <div className="relative h-full flex-1">
            <div aria-hidden className="absolute inset-y-0 z-10" style={{
              left: 0, width: 5, background: "repeating-linear-gradient(0deg,#eee 0 7px,#2a1808 7px 14px)",
              opacity: go ? 0 : 1, transition: "opacity .3s ease-out",
            }} />
            <div aria-hidden className="absolute inset-y-0 right-0 z-10" style={{
              width: 8, backgroundImage: "repeating-conic-gradient(#111 0 25%, #eee 0 50%)", backgroundSize: "8px 8px",
            }} />
            <span className="gallop absolute top-1/2 z-10 select-none text-4xl leading-none" style={{
              left: go ? `${targets[i].dist}%` : "2%",
              transform: "translateY(-50%) scaleX(-1)",
              transition: go ? `left ${targets[i].dur}s cubic-bezier(.18,.6,.22,1)` : "none",
              filter: "drop-shadow(0 3px 2px rgba(0,0,0,.4))",
            }}>🏇</span>
          </div>
        </div>
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
  const [partyType, setPartyType] = useState("quiz");
  const [mode, setMode] = useState("normale");
  const [diff, setDiff] = useState("medio");
  const [teamMode, setTeamMode] = useState("solo");
  const [enabled, setEnabled] = useState({ musica: true, sport: true, trash: true, cultura: true, cibo: true, cinema: true, gaming: true, piccante: true });
  const [players, setPlayers] = useState([]);
  const [g, setG] = useState(null);
  const [rf, setRf] = useState(null);
  const [rfIntensity, setRfIntensity] = useState(1);
  const [rfLevel, setRfLevel] = useState(1);
  const [left, setLeft] = useState(18);
  const [answered, setAnswered] = useState({});
  const [outcome, setOutcome] = useState(null);
  const [err, setErr] = useState("");
  const [narrating, setNarrating] = useState(false);

  const M = MODES[mode];
  const D = DIFF[diff];
  const T = Math.round(M.t * D.tmul);
  const cats = Object.keys(enabled).filter((k) => enabled[k]);

  const playersRef = useRef(players), gRef = useRef(g), rfRef = useRef(rf), ansRef = useRef({}), usedRef = useRef(loadUsed());
  const flowRef = useRef([]), betsRef = useRef({}), posRef = useRef({ b: 0, q: 0 }), cfgRef = useRef({ T, cats }), teamsRef = useRef([]);
  const rfFlowRef = useRef([]), rfPosRef = useRef(0), rfLevelRef = useRef(1);
  const nextingRef = useRef(false);
  /** protegge ask()/resolve() da doppie esecuzioni quando polling e timer scattano
   *  quasi in contemporanea sulla stessa fase (gRef.current non è ancora aggiornato). */
  const advancingRef = useRef(false);
  const tn = (tid) => teamsRef.current.find((t) => t.i === tid)?.name || "Squadra";
  playersRef.current = players; gRef.current = g; rfRef.current = rf; rfLevelRef.current = rfLevel;
  cfgRef.current = { T, cats, pool: D.pool, pmul: D.pmul, diffLabel: D.label, teamMode };

  /* persiste su questo dispositivo cosa è già stato proposto, oltre la singola partita */
  useEffect(() => { saveUsed(usedRef.current); }, [g, rf]);

  /* niente voce orfana se si esce dalla partita mentre il presentatore sta parlando */
  useEffect(() => () => stopNarration(), []);

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

  const pub = (ps) => ps.map((p) => ({
    id: p.id, name: p.name, color: p.color, score: p.score, team: p.team ?? null,
    flags: p.flags ?? 0, lastConfessione: p.lastConfessione || null, lastHotseat: p.lastHotseat || null, votedAgainst: p.votedAgainst || null,
  }));
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
                if (ps.length >= 10) return ps;
                return [...ps, { id, name: (d.name || "Anonimo").slice(0, 12), color: PCOL[ps.length % PCOL.length], score: 0, right: 0, wrong: 0, risk: 0, flags: 0, passiConf: 0, passiHot: 0, votedFor: 0, sceltaMancate: 0, team: d.team || null, teamName: d.teamName || null }];
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

      /* schermate di rivelazione: si va avanti da soli quando la maggioranza
       * dei giocatori ha votato "avanti" dal telefono, senza aspettare l'host. */
      if (cur.phase === "result" || cur.phase === "voteres" || cur.phase === "azzardores" || cur.phase === "puzzleres" || cur.phase === "spicyres") {
        await Promise.all(playersRef.current.map(async (p) => {
          if (ansRef.current[p.id]) return;
          try {
            const r = await storage.get(kPlayer(room, p.id), true);
            const d = JSON.parse(r.value);
            if (d.rid === cur.rid && d.ready) {
              ansRef.current[p.id] = true;
              setAnswered((a) => ({ ...a, [p.id]: true }));
            }
          } catch (_) {}
        }));
        const total = playersRef.current.length;
        const readyCount = playersRef.current.filter((p) => ansRef.current[p.id]).length;
        if (total && readyCount * 2 > total) next();
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
      // in staffetta/intruso solo activeIds può rispondere: i compagni in panchina
      // non scriveranno mai nulla, quindi si aspettano solo i turnisti.
      const need = cur.activeIds || playersRef.current.map((p) => p.id);
      if (need.length && need.every((pid) => ansRef.current[pid])) resolve();
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
  /** Pesca `n` elementi da `pool` preferendo quelli non ancora proposti di
   *  recente (tracciati su questo dispositivo sotto `seenKey`): quando il
   *  mazzo si esaurisce riparte un giro nuovo, un po' come per le domande. */
  function pickManyRotating(pool, seenKey, n) {
    const seen = usedRef.current[seenKey] || [];
    let avail = pool.filter((k) => !seen.includes(k));
    const picked = [];
    let newSeen = [...seen];
    while (picked.length < n && pool.length) {
      if (!avail.length) {
        newSeen = [];
        avail = pool.filter((k) => !picked.includes(k));
        if (!avail.length) break;
      }
      const chosen = avail.splice(Math.floor(Math.random() * avail.length), 1)[0];
      picked.push(chosen);
      newSeen.push(chosen);
    }
    usedRef.current[seenKey] = newSeen;
    return picked;
  }

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
      const teamKeys = Object.keys(TEAM_MG);
      const nTeamG = Math.min(teamKeys.length, Math.max(1, Math.ceil(M.mgs / 2)));
      const teamGames = pickManyRotating(teamKeys, "mgTeam", nTeamG);
      const solos = pickManyRotating(bag, "mgSolo", Math.max(0, M.mgs - nTeamG));
      chosen = shuffle([...teamGames, ...solos]);
    } else {
      chosen = pickManyRotating(bag, "mgSolo", Math.min(M.mgs, bag.length));
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
    setScreen("game");
    runBlock(0);
  }

  /* ---------------- RED FLAG: motore separato, stesso storage ---------------- */
  function pickRf(key, arr, keyf = (x) => x.q ?? x) {
    const seen = usedRef.current[key] || [];
    const free = arr.filter((x) => !seen.includes(keyf(x)));
    const list = free.length ? free : arr;
    const it = pick(list);
    usedRef.current[key] = free.length ? [...seen, keyf(it)] : [keyf(it)];
    return it;
  }

  /** Una Confessione e un Hot Seat a testa (mai lo stesso bersaglio due
   *  volte), più Scelta/Chi-è-la-Red-Flag/Caos a riempire, tutto mescolato. */
  function buildRfFlow(ps) {
    const confessione = shuffle(ps).map((p) => ({ kind: "confessione", pid: p.id }));
    const hotseat = shuffle(ps).map((p) => ({ kind: "hotseat", pid: p.id }));
    const bluff = shuffle(ps).map((p) => ({ kind: "bluff", pid: p.id }));
    const extra = Math.max(2, Math.ceil(ps.length / 2));
    const scelta = Array.from({ length: extra }, () => ({ kind: "scelta" }));
    const votoRf = Array.from({ length: extra }, () => ({ kind: "vote", variant: "redflag" }));
    const votoCrush = Array.from({ length: extra }, () => ({ kind: "vote", variant: "crush" }));
    const caosN = Math.max(1, Math.ceil(ps.length / 3));
    const caos = Array.from({ length: caosN }, () => ({ kind: "vote", variant: "caos" }));
    return shuffle([...confessione, ...hotseat, ...bluff, ...scelta, ...votoRf, ...votoCrush, ...caos]);
  }

  function startRedFlag() {
    sfx.start();
    setRfLevel(rfIntensity);
    rfLevelRef.current = rfIntensity;
    rfFlowRef.current = buildRfFlow(players);
    rfPosRef.current = 0;
    setScreen("rf-game");
    askRf(0);
  }

  async function askRf(i) {
    const item = rfFlowRef.current[i];
    if (!item) return endRedFlag();
    rfPosRef.current = i;
    ansRef.current = {};
    setAnswered({});
    setOutcome(null);
    const rid = `rf-${i}`;
    const qn = i + 1, qtot = rfFlowRef.current.length;
    const lv = rfLevelRef.current;
    let state;
    if (item.kind === "scelta") {
      const card = pickRf("rfScelta", RF_SCELTA.filter((x) => x.lv <= lv), (x) => x.q);
      state = { mode: "redflag", phase: "rf-scelta", rid, card, time: RF_SCELTA_T, qn, qtot, level: lv };
    } else if (item.kind === "confessione") {
      const target = playersRef.current.find((p) => p.id === item.pid);
      const card = pickRf("rfConf", RF_CONFESSIONE.filter((x) => x.lv <= lv), (x) => x.q);
      state = { mode: "redflag", phase: "rf-confessione", rid, target: item.pid, targetName: target?.name, card, time: RF_CONF_T, qn, qtot, level: lv };
    } else if (item.kind === "hotseat") {
      const target = playersRef.current.find((p) => p.id === item.pid);
      state = { mode: "redflag", phase: "rf-hotseat", rid, target: item.pid, targetName: target?.name, time: RF_HOTSEAT_T, livePasses: 0, qn, qtot, level: lv };
    } else if (item.kind === "bluff") {
      const target = playersRef.current.find((p) => p.id === item.pid);
      const card = pickRf("rfBluff", RF_BLUFF.filter((x) => x.lv <= lv), (x) => x.q);
      state = { mode: "redflag", phase: "rf-bluff", rid, target: item.pid, targetName: target?.name, card, time: RF_BLUFF_T, qn, qtot, level: lv };
    } else {
      const bank = item.variant === "caos" ? RF_CAOS : item.variant === "crush" ? RF_CRUSH : RF_VOTE;
      const key = item.variant === "caos" ? "rfCaos" : item.variant === "crush" ? "rfCrush" : "rfVote";
      const card = pickRf(key, bank.filter((x) => x.lv <= lv), (x) => x.q);
      state = { mode: "redflag", phase: "rf-vote", rid, variant: item.variant, card, time: RF_VOTE_T, qn, qtot, level: lv };
    }
    setRf(state);
    setLeft(state.time);
    await push({ ...state, players: pub(playersRef.current), room });
  }

  async function resolveRf() {
    if (nextingRef.current) return;
    nextingRef.current = true;
    try {
      const cur = rfRef.current;
      if (!cur) return;
      const ps = playersRef.current;
      const res = {};

      if (cur.phase === "rf-scelta") {
        const tally = { a: 0, b: 0 };
        const missing = [];
        ps.forEach((p) => {
          const v = ansRef.current[p.id]?.choice;
          if (v === "a" || v === "b") tally[v]++; else missing.push(p.id);
        });
        const updated = ps.map((p) => (missing.includes(p.id) ? { ...p, flags: (p.flags || 0) + 1, sceltaMancate: (p.sceltaMancate || 0) + 1 } : p));
        ps.forEach((p) => { res[p.id] = missing.includes(p.id) ? { flag: 1, note: "Non ha scelto: bandiera." } : { flag: 0, note: "Scelta fatta." }; });
        setPlayers(updated);
        setRf({ ...cur, phase: "rf-sceltares", tally, missing });
        await push({ mode: "redflag", phase: "rf-sceltares", rid: cur.rid, card: cur.card, tally, missing, res, qn: cur.qn, qtot: cur.qtot, players: pub(updated), room });
        ansRef.current = {}; setAnswered({});
        return;
      }

      if (cur.phase === "rf-confessione") {
        const d = ansRef.current[cur.target];
        const passed = !d || d.choice === "pass";
        const gain = passed ? 1 : 0;
        const updated = ps.map((p) => (p.id === cur.target ? {
          ...p, flags: (p.flags || 0) + gain, passiConf: (p.passiConf || 0) + (passed ? 1 : 0),
          lastConfessione: { q: cur.card.q, confessed: !passed },
        } : p));
        res[cur.target] = { flag: gain, note: passed ? "Ha passato: bandiera." : "Ha confessato." };
        setPlayers(updated);
        setRf({ ...cur, phase: "rf-confres", passed });
        await push({ mode: "redflag", phase: "rf-confres", rid: cur.rid, target: cur.target, targetName: cur.targetName, card: cur.card, passed, res, qn: cur.qn, qtot: cur.qtot, players: pub(updated), room });
        ansRef.current = {}; setAnswered({});
        return;
      }

      if (cur.phase === "rf-vote") {
        const tally = {};
        ps.forEach((p) => { const v = ansRef.current[p.id]?.vote; if (v) tally[v] = (tally[v] || 0) + 1; });
        const max = Math.max(0, ...Object.values(tally));
        const top = max > 0 ? Object.keys(tally).filter((k) => tally[k] === max) : [];
        const updated = ps.map((p) => {
          const votes = tally[p.id] || 0;
          const gain = top.includes(p.id) ? 1 : 0;
          let next = p;
          if (gain) next = { ...next, flags: (next.flags || 0) + gain, votedFor: (next.votedFor || 0) + 1 };
          if (votes > 0 && votes >= (p.votedAgainst?.votes || 0)) next = { ...next, votedAgainst: { q: cur.card.q, votes } };
          return next;
        });
        ps.forEach((p) => { res[p.id] = { flag: top.includes(p.id) ? 1 : 0, votes: tally[p.id] || 0 }; });
        setPlayers(updated);
        setRf({ ...cur, phase: "rf-voteres", tally, top });
        await push({ mode: "redflag", phase: "rf-voteres", rid: cur.rid, variant: cur.variant, card: cur.card, tally, top, res, qn: cur.qn, qtot: cur.qtot, players: pub(updated), room });
        ansRef.current = {}; setAnswered({});
        return;
      }

      if (cur.phase === "rf-hotseatvote") {
        const voters = ps.filter((p) => p.id !== cur.target);
        const tally = { assolto: 0, redflag: 0 };
        voters.forEach((p) => { const v = ansRef.current[p.id]?.verdict; if (v === "assolto" || v === "redflag") tally[v]++; });
        const verdict = tally.redflag > tally.assolto ? "redflag" : "assolto";
        const passExtra = Math.max(0, (cur.passes || 0) - 3);
        const verdictFlag = verdict === "redflag" ? 1 : 0;
        const totalGain = passExtra + verdictFlag;
        const updated = ps.map((p) => (p.id === cur.target ? {
          ...p, flags: (p.flags || 0) + totalGain, passiHot: (p.passiHot || 0) + passExtra,
          lastHotseat: { verdict, passes: cur.passes || 0 },
        } : p));
        res[cur.target] = { flag: totalGain, note: `${passExtra} da pass extra, ${verdictFlag} dal verdetto.` };
        setPlayers(updated);
        setRf({ ...cur, phase: "rf-hotseatres", verdict, tally, passExtra });
        await push({ mode: "redflag", phase: "rf-hotseatres", rid: cur.rid, target: cur.target, targetName: cur.targetName, verdict, tally, passes: cur.passes || 0, passExtra, res, qn: cur.qn, qtot: cur.qtot, players: pub(updated), room });
        ansRef.current = {}; setAnswered({});
        return;
      }

      if (cur.phase === "rf-bluffvote") {
        const voters = ps.filter((p) => p.id !== cur.target);
        const tally = { verita: 0, bluff: 0 };
        voters.forEach((p) => { const v = ansRef.current[p.id]?.guess; if (v === "verita" || v === "bluff") tally[v]++; });
        const majority = tally.bluff > tally.verita ? "bluff" : "verita";
        const caught = cur.bluffChoice === "bluff" && majority === "bluff";
        const gain = caught ? 1 : 0;
        const updated = ps.map((p) => (p.id === cur.target ? {
          ...p, flags: (p.flags || 0) + gain,
          lastBluff: { q: cur.card.q, choice: cur.bluffChoice, caught },
        } : p));
        res[cur.target] = { flag: gain, note: caught ? "Beccato/a: bandiera." : cur.bluffChoice === "bluff" ? "Bluff riuscito, nessuna bandiera." : "Creduto/a: nessuna bandiera." };
        setPlayers(updated);
        setRf({ ...cur, phase: "rf-bluffres", tally, majority });
        await push({ mode: "redflag", phase: "rf-bluffres", rid: cur.rid, target: cur.target, targetName: cur.targetName, card: cur.card, bluffChoice: cur.bluffChoice, tally, majority, res, qn: cur.qn, qtot: cur.qtot, players: pub(updated), room });
        ansRef.current = {}; setAnswered({});
        return;
      }
    } finally {
      nextingRef.current = false;
    }
  }

  function beginHotseatVote() {
    if (nextingRef.current) return;
    nextingRef.current = true;
    const cur = rfRef.current;
    const passes = cur.livePasses || 0;
    const state = { ...cur, phase: "rf-hotseatvote", passes };
    setRf(state);
    setLeft(RF_HOTSEAT_VOTE_T);
    ansRef.current = {}; setAnswered({});
    const p = push({ mode: "redflag", phase: "rf-hotseatvote", rid: cur.rid, target: cur.target, targetName: cur.targetName, passes, time: RF_HOTSEAT_VOTE_T, qn: cur.qn, qtot: cur.qtot, players: pub(playersRef.current), room });
    Promise.resolve(p).finally(() => { nextingRef.current = false; });
  }

  function beginBluffVote() {
    if (nextingRef.current) return;
    nextingRef.current = true;
    const cur = rfRef.current;
    const bluffChoice = ansRef.current[cur.target]?.choice ?? "verita";
    const state = { ...cur, phase: "rf-bluffvote", bluffChoice };
    setRf(state);
    setLeft(RF_BLUFFVOTE_T);
    ansRef.current = {}; setAnswered({});
    const p = push({ mode: "redflag", phase: "rf-bluffvote", rid: cur.rid, target: cur.target, targetName: cur.targetName, card: cur.card, time: RF_BLUFFVOTE_T, qn: cur.qn, qtot: cur.qtot, players: pub(playersRef.current), room });
    Promise.resolve(p).finally(() => { nextingRef.current = false; });
  }

  function nextRf() {
    if (nextingRef.current) return;
    nextingRef.current = true;
    const p = askRf(rfPosRef.current + 1);
    Promise.resolve(p).finally(() => { nextingRef.current = false; });
  }

  function raiseRfLevel(lv) {
    if (lv <= rfLevelRef.current) return;
    setRfLevel(lv);
    rfLevelRef.current = lv;
  }

  async function endRedFlag() {
    const ps = playersRef.current;
    const rank = [...ps].sort((a, b) => (a.flags || 0) - (b.flags || 0));
    const statFor = (p) => ({ id: p.id, flags: p.flags || 0, votedFor: p.votedFor || 0, passiConf: p.passiConf || 0, passiHot: p.passiHot || 0, sceltaMancate: p.sceltaMancate || 0 });
    const stats = ps.map(statFor);
    const titles = RF_TITLES.map((t) => {
      const w = t.pick(stats);
      return { key: t.key, emoji: t.emoji, label: t.label, winnerId: w?.id, winnerName: ps.find((p) => p.id === w?.id)?.name };
    });
    const state = { mode: "redflag", phase: "rf-report", titles };
    setRf(state);
    await push({ ...state, players: pub(rank), room });
  }

  /* timer Red Flag */
  useEffect(() => {
    if (!rf) return;
    const timed = ["rf-scelta", "rf-confessione", "rf-vote", "rf-hotseat", "rf-hotseatvote", "rf-bluff", "rf-bluffvote"];
    if (!timed.includes(rf.phase)) return;
    if (left <= 0) {
      if (rf.phase === "rf-hotseat") { beginHotseatVote(); return; }
      if (rf.phase === "rf-bluff") { beginBluffVote(); return; }
      resolveRf(); return;
    }
    const t = setTimeout(() => setLeft((l) => +(l - HOST_TICK / 1000).toFixed(2)), HOST_TICK);
    return () => clearTimeout(t);
  }, [rf, left]); // eslint-disable-line

  /* raccolta input dai telefoni — Red Flag */
  useEffect(() => {
    if (screen !== "rf-game") return;
    const t = setInterval(async () => {
      const cur = rfRef.current;
      if (!cur) return;

      if (["rf-sceltares", "rf-confres", "rf-voteres", "rf-hotseatres", "rf-bluffres"].includes(cur.phase)) {
        await Promise.all(playersRef.current.map(async (p) => {
          if (ansRef.current[p.id]) return;
          try {
            const r = await storage.get(kPlayer(room, p.id), true);
            const d = JSON.parse(r.value);
            if (d.rid === cur.rid && d.ready) {
              ansRef.current[p.id] = true;
              setAnswered((a) => ({ ...a, [p.id]: true }));
            }
          } catch (_) {}
        }));
        const total = playersRef.current.length;
        const readyCount = playersRef.current.filter((p) => ansRef.current[p.id]).length;
        if (total && readyCount * 2 > total) nextRf();
        return;
      }

      if (cur.phase === "rf-scelta") {
        await Promise.all(playersRef.current.map(async (p) => {
          if (ansRef.current[p.id]) return;
          try {
            const r = await storage.get(kPlayer(room, p.id), true);
            const d = JSON.parse(r.value);
            if (d.rid === cur.rid && (d.rfChoice === "a" || d.rfChoice === "b")) {
              ansRef.current[p.id] = { choice: d.rfChoice };
              setAnswered((a) => ({ ...a, [p.id]: true }));
            }
          } catch (_) {}
        }));
        if (playersRef.current.length && playersRef.current.every((p) => ansRef.current[p.id])) resolveRf();
        return;
      }

      if (cur.phase === "rf-confessione") {
        try {
          const r = await storage.get(kPlayer(room, cur.target), true);
          const d = JSON.parse(r.value);
          if (d.rid === cur.rid && (d.rfConf === "confess" || d.rfConf === "pass") && !ansRef.current[cur.target]) {
            ansRef.current[cur.target] = { choice: d.rfConf };
            setAnswered({ [cur.target]: true });
            resolveRf();
          }
        } catch (_) {}
        return;
      }

      if (cur.phase === "rf-vote") {
        await Promise.all(playersRef.current.map(async (p) => {
          if (ansRef.current[p.id]) return;
          try {
            const r = await storage.get(kPlayer(room, p.id), true);
            const d = JSON.parse(r.value);
            if (d.rid === cur.rid && d.rfVote) {
              ansRef.current[p.id] = { vote: d.rfVote };
              setAnswered((a) => ({ ...a, [p.id]: true }));
            }
          } catch (_) {}
        }));
        if (playersRef.current.length && playersRef.current.every((p) => ansRef.current[p.id])) resolveRf();
        return;
      }

      if (cur.phase === "rf-hotseat") {
        try {
          const r = await storage.get(kPlayer(room, cur.target), true);
          const d = JSON.parse(r.value);
          if (d.rid === cur.rid && typeof d.hotPass === "number" && d.hotPass !== (cur.livePasses || 0)) {
            setRf((x) => (x?.rid === cur.rid ? { ...x, livePasses: d.hotPass } : x));
          }
        } catch (_) {}
        return;
      }

      if (cur.phase === "rf-hotseatvote") {
        const voters = playersRef.current.filter((p) => p.id !== cur.target);
        await Promise.all(voters.map(async (p) => {
          if (ansRef.current[p.id]) return;
          try {
            const r = await storage.get(kPlayer(room, p.id), true);
            const d = JSON.parse(r.value);
            if (d.rid === cur.rid && (d.rfJudge === "assolto" || d.rfJudge === "redflag")) {
              ansRef.current[p.id] = { verdict: d.rfJudge };
              setAnswered((a) => ({ ...a, [p.id]: true }));
            }
          } catch (_) {}
        }));
        if (voters.length && voters.every((p) => ansRef.current[p.id])) resolveRf();
        return;
      }

      if (cur.phase === "rf-bluff") {
        if (!ansRef.current[cur.target]) {
          try {
            const r = await storage.get(kPlayer(room, cur.target), true);
            const d = JSON.parse(r.value);
            if (d.rid === cur.rid && (d.rfBluff === "verita" || d.rfBluff === "bluff")) {
              ansRef.current[cur.target] = { choice: d.rfBluff };
              setAnswered({ [cur.target]: true });
            }
          } catch (_) {}
        }
        return;
      }

      if (cur.phase === "rf-bluffvote") {
        const voters = playersRef.current.filter((p) => p.id !== cur.target);
        await Promise.all(voters.map(async (p) => {
          if (ansRef.current[p.id]) return;
          try {
            const r = await storage.get(kPlayer(room, p.id), true);
            const d = JSON.parse(r.value);
            if (d.rid === cur.rid && (d.rfBluffGuess === "verita" || d.rfBluffGuess === "bluff")) {
              ansRef.current[p.id] = { guess: d.rfBluffGuess };
              setAnswered((a) => ({ ...a, [p.id]: true }));
            }
          } catch (_) {}
        }));
        if (voters.length && voters.every((p) => ansRef.current[p.id])) resolveRf();
        return;
      }
    }, POLL_HOST);
    return () => clearInterval(t);
  }, [screen, room]); // eslint-disable-line

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
      const advance = () => {
        if (gRef.current?.phase !== "mgintro" || posRef.current.b !== i) return;
        b.mg === "puntata" ? askBet(i, 0) : ask(i, 0);
      };
      setNarrating(true);
      narrate(MG_ALL[b.mg].rule, { onEnd: () => { setNarrating(false); setTimeout(advance, 900); } });
      setTimeout(() => { setNarrating(false); advance(); }, 15000);
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
    if (advancingRef.current) return;
    advancingRef.current = true;
    try {
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
    /** Come draw(): rispetta la difficoltà scelta (se le voci hanno un campo
     *  `d`) e pesca a rotazione, senza ripetere finché non si esaurisce il mazzo. */
    const once = (key, arr, keyf = (x) => x.q) => {
      const allowed = arr.filter((x) => x.d == null || cfgRef.current.pool.includes(x.d));
      const base = allowed.length ? allowed : arr;
      const seen = usedRef.current[key] || [];
      const free = base.filter((x) => !seen.includes(keyf(x)));
      const list = free.length ? free : base;
      const it = pick(list);
      usedRef.current[key] = free.length ? [...seen, keyf(it)] : [keyf(it)];
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
    } finally { advancingRef.current = false; }
  }

  async function resolve() {
    if (advancingRef.current) return;
    advancingRef.current = true;
    try {
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
      ansRef.current = {}; setAnswered({});
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
      ansRef.current = {}; setAnswered({});
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
      ansRef.current = {}; setAnswered({});
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
      ansRef.current = {}; setAnswered({});
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
    ansRef.current = {}; setAnswered({});
    } finally { advancingRef.current = false; }
  }

  function next() {
    if (nextingRef.current) return;
    nextingRef.current = true;
    const { b, q } = posRef.current;
    const blk = flowRef.current[b];
    const p = q + 1 < blk.n ? (blk.mg === "puntata" ? askBet(b, q + 1) : ask(b, q + 1))
      : b + 1 < flowRef.current.length ? runBlock(b + 1) : endMatch();
    Promise.resolve(p).finally(() => { nextingRef.current = false; });
  }

  async function endMatch() {
    const rank = [...playersRef.current].sort((a, b) => b.score - a.score);
    setScreen("podio");
    await push({ phase: "podio", players: pub(rank), room });
  }

  const teamCounts = teamsList.map((t) => players.filter((p) => p.team === t.i).length);
  const lobbyReady = partyType === "redflag"
    ? players.length >= 3
    : cats.length > 0 && (teamMode === "solo"
      ? players.length >= 2
      : teamsList.length >= 2 && players.every((p) => p.team) && teamCounts.every((n) => n >= 2));

  if (screen === "setup")
    return <HostSetup {...{ partyType, setPartyType, mode, setMode, diff, setDiff, teamMode, setTeamMode, enabled, setEnabled, rfIntensity, setRfIntensity, onExit }}
      onOpen={() => setScreen("lobby")} />;

  if (screen === "lobby")
    return <HostLobby {...{ room, players, err, M, D, T, teamMode, teamsList, partyType }} canStart={lobbyReady} onStart={partyType === "redflag" ? startRedFlag : startMatch} />;

  if (screen === "rf-game")
    return <HostRedFlag {...{ rf, left, players, answered, next: nextRf, room, err, rfLevel }} onRaiseLevel={raiseRfLevel} onExit={onExit} onAgain={() => {
      const reset = players.map((p) => ({ ...p, flags: 0, passiConf: 0, passiHot: 0, votedFor: 0, sceltaMancate: 0, lastConfessione: null, lastHotseat: null, votedAgainst: null }));
      setPlayers(reset);
      playersRef.current = reset;
      startRedFlag();
    }} />;

  if (screen === "podio") {
    const rank = [...players].sort((a, b) => b.score - a.score);
    return <HostPodio rank={rank} teamMode={teamMode} teamsList={teamsList} onExit={onExit} onAgain={() => {
      setPlayers((ps) => ps.map((p) => ({ ...p, score: 0, right: 0, wrong: 0, risk: 0 })));
      flowRef.current = buildFlow(players); setScreen("game"); runBlock(0);
    }} />;
  }

  return <HostGame {...{ g, left, T, players, answered, outcome, next, room, err, teamMode, teamsList, narrating }} />;
}

function HostSetup({ partyType, setPartyType, mode, setMode, diff, setDiff, teamMode, setTeamMode, enabled, setEnabled, rfIntensity, setRfIntensity, onOpen, onExit }) {
  const n = Object.values(enabled).filter(Boolean).length;

  const typePicker = (
    <div className="mb-10 grid gap-3 sm:grid-cols-2">
      <button onClick={() => setPartyType("quiz")} className="press border-2 p-5 text-left"
        style={{ borderColor: C.cream, background: partyType === "quiz" ? C.cream : "transparent", color: partyType === "quiz" ? C.ink : C.cream, boxShadow: partyType === "quiz" ? `5px 5px 0 ${C.magenta}` : "none" }}>
        <p className="text-3xl uppercase" style={display}>Quiz classico</p>
        <p className="mt-1 text-xs font-bold" style={{ opacity: partyType === "quiz" ? 0.75 : 0.65 }}>Categorie, minigiochi e classifica generale.</p>
      </button>
      <button onClick={() => setPartyType("redflag")} className="press border-2 p-5 text-left"
        style={{ borderColor: C.flagRed, background: partyType === "redflag" ? C.flagRed : "transparent", color: partyType === "redflag" ? C.cream : C.flagRed, boxShadow: partyType === "redflag" ? `5px 5px 0 ${C.ink2}` : "none" }}>
        <p className="text-3xl uppercase" style={display}><span className="flag-wave inline-block">🚩</span> Red Flag</p>
        <p className="mt-1 text-xs font-bold" style={{ opacity: partyType === "redflag" ? 0.85 : 0.75 }}>Scelte, confessioni, voti e Hot Seat. Vince chi ha meno bandiere.</p>
      </button>
    </div>
  );

  if (partyType === "redflag") {
    const cats = [
      ["Scelta", "Due opzioni orribili, si sceglie dal telefono. Non scegliere = una bandiera."],
      ["Confessione", "Una domanda solo a te. Rispondi, o «Passo» e ti prendi la bandiera."],
      ["Chi è la Red Flag", "Voto segreto su un membro del gruppo. Chi vince la votazione incassa una bandiera."],
      ["Hot Seat", "30 secondi sotto tiro. 3 pass gratis, poi ogni pass è una bandiera. Alla fine si vota: assolto o red flag."],
      ["Bluff", "Rispondi a voce, deciso in segreto: verità o bugia? Il gruppo vota se ci ha creduto. Beccato = bandiera."],
      ["Crush", "Come Chi è la Red Flag, ma sul tema cotte e attrazione nel gruppo."],
      ["Caos", "Carta pescata a caso, tutti votano insieme: nessuno è al sicuro."],
    ];
    return (
      <div className="tvin mx-auto max-w-3xl px-6 py-10">
        <button onClick={onExit} className="mb-4 text-xs font-bold uppercase tracking-widest opacity-60">← indietro</button>
        <h2 className="text-5xl uppercase" style={display}>Che serata è</h2>
        {typePicker}
        <div className="border-2 p-6" style={{ borderColor: C.flagRed, background: "rgba(255,31,61,.06)" }}>
          <p className="text-6xl uppercase" style={{ ...display, color: C.flagRed }}><span className="flag-wave inline-block">🚩</span> Red Flag</p>
          <p className="mt-2 text-sm opacity-80">Il gruppo vota, giudica e si confessa a vicenda. Niente risposte giuste: solo bandiere. Vince chi ne prende meno.</p>

          <h3 className="mt-6 text-xl uppercase" style={display}>Intensità</h3>
          <p className="mb-2 text-xs opacity-70">Si può solo alzare, mai abbassare — anche a partita in corso.</p>
          <div className="grid gap-2 sm:grid-cols-4">
            {RF_INTENSITY.map((lv) => {
              const on = rfIntensity === lv.level;
              return (
                <button key={lv.key} onClick={() => setRfIntensity(lv.level)} className="press border-2 px-3 py-3 text-left"
                  style={{ borderColor: C.flagRed, background: on ? C.flagRed : "transparent", color: on ? C.cream : C.flagRed }}>
                  <p className="text-lg uppercase" style={display}>{lv.emoji} {lv.label}</p>
                  <p className="text-xs font-bold" style={{ opacity: on ? 0.85 : 0.7 }}>{lv.desc}</p>
                </button>
              );
            })}
          </div>

          <h3 className="mt-6 text-xl uppercase" style={display}>Le categorie</h3>
          <div className="mt-2 space-y-2 text-sm">
            {cats.map(([t, d]) => (
              <p key={t} className="border-l-4 pl-3" style={{ borderColor: C.gold }}><b style={{ color: C.gold }}>{t}</b> — {d}</p>
            ))}
            <p className="text-xs opacity-60">Alla fine: classifica per bandiere, sei titoli e un report individuale sul telefono di ognuno.</p>
          </div>
        </div>
        <button onClick={() => { sfx.select(); onOpen(); }} className="press mt-8 w-full py-6 text-4xl uppercase"
          style={{ ...display, background: C.flagRed, color: C.cream, boxShadow: `7px 7px 0 ${C.ink2}` }}>
          Si comincia
        </button>
      </div>
    );
  }

  return (
    <div className="tvin mx-auto max-w-3xl px-6 py-10">
      <button onClick={onExit} className="mb-4 text-xs font-bold uppercase tracking-widest opacity-60">← indietro</button>
      <h2 className="text-5xl uppercase" style={display}>Che serata è</h2>
      {typePicker}
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
        {MG_GROUPS.map((grp) => (
          <div key={grp.title} className="pt-2">
            <h4 className="text-sm uppercase tracking-wide opacity-70" style={display}>{grp.title}</h4>
            <p className="mb-1 text-xs opacity-50">{grp.desc}</p>
            {grp.keys.map((k) => {
              const m = MG[k];
              return (
                <p key={k} className="border-l-4 pl-3" style={{ borderColor: m.color }}>
                  <b style={{ color: m.color }}>{m.name}.</b> {m.rule}
                </p>
              );
            })}
          </div>
        ))}
        {teamMode === "squadre" && (
          <div className="pt-2">
            <h4 className="text-sm uppercase tracking-wide opacity-70" style={display}>Di squadra</h4>
            <p className="mb-1 text-xs opacity-50">Più telefoni della stessa squadra, un solo risultato per tutti.</p>
            {Object.values(TEAM_MG).map((m) => (
              <p key={m.name} className="border-l-4 pl-3" style={{ borderColor: m.color, background: "rgba(255,243,230,.05)" }}>
                <b style={{ color: m.color }}>{m.name}</b> <span className="text-xs uppercase opacity-70">solo a squadre</span> — {m.rule}
              </p>
            ))}
          </div>
        )}
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

function HostLobby({ room, players, canStart, onStart, err, M, D, T, teamMode, teamsList, partyType }) {
  const countRef = useRef(players.length);
  useEffect(() => {
    if (players.length > countRef.current) sfx.join();
    countRef.current = players.length;
  }, [players.length]);
  const isRf = partyType === "redflag";
  return (
    <div className="tvin mx-auto max-w-4xl px-6 py-10">
      <p className="text-xs font-bold uppercase tracking-widest" style={{ color: isRf ? C.flagRed : C.lime }}>
        {isRf
          ? "Stanza aperta · 🚩 red flag · scelte, confessioni, voti e hot seat · vince chi ha meno bandiere"
          : `Stanza aperta · ${M.label.toLowerCase()} · livello ${D.label.toLowerCase()} · ${T}s a domanda · ${teamMode === "squadre" ? (teamsList.length === 0 ? "nessuna squadra fondata" : teamsList.length === 1 ? "1 squadra fondata" : `${teamsList.length} squadre fondate`) : "una squadra a testa"} · ${M.own} domande per squadra + ${M.mgs} minigiochi`}
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
        style={{ ...display, background: canStart ? (isRf ? C.flagRed : C.magenta) : "rgba(255,243,230,.15)", color: canStart ? C.cream : "rgba(255,243,230,.4)", boxShadow: canStart ? `7px 7px 0 ${isRf ? C.ink2 : C.lime}` : "none" }}>
        {isRf ? "Si comincia" : "Sigla e via"}
      </button>
      <p className="mt-3 text-center text-xs opacity-50">
        {isRf
          ? players.length < 3
            ? `Servono almeno 3 giocatori: adesso siete ${players.length}.`
            : `Pronti a giudicarvi a vicenda in ${players.length}.`
          : teamMode === "squadre"
          ? "Ognuno sceglie la squadra dal telefono. Si parte quando ogni squadra ha almeno due persone."
          : `Ogni giocatore è una squadra a sé: adesso siete ${players.length}, quindi ${players.length} squadre.`}
      </p>
    </div>
  );
}

function HostGame({ g, left, T, players, answered, outcome, next, room, err, teamMode, teamsList, narrating }) {
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
          <Presenter talking={narrating} color={mg.color} />
          <p className="rise-in mt-4 max-w-2xl border-2 px-6 py-4 text-xl" style={{ borderColor: mg.color, animationDelay: ".15s" }}>{mg.rule}</p>
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
              {g.game === "cavalli" && <HorseRace cavalli={CAVALLI} winner={null} racing={false} />}
              {g.game === "roulette" && <RouletteWheel numero={null} spinning={false} accent={accent} />}
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
              {g.game === "cavalli" && <HorseRace cavalli={CAVALLI} winner={g.esito.vincitore} racing={true} />}
              {g.game === "roulette" && <RouletteWheel numero={g.esito.numero} spinning={true} accent={accent} />}
              <p className="mt-6 text-sm uppercase tracking-widest opacity-60">{g.game === "cavalli" ? "Ha vinto" : g.game === "roulette" ? "È uscito" : "Era carica"}</p>
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
              <p className="mt-6 text-center text-sm opacity-60">{Object.keys(answered).length}/{players.length} pronti per continuare</p>
              <button onClick={goNext} className="press mt-2 w-full py-5 text-3xl uppercase" style={{ ...display, background: C.cream, color: C.ink, boxShadow: `6px 6px 0 ${C.magenta}` }}>
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
              <p className="mt-6 text-center text-sm opacity-60">{Object.keys(answered).length}/{players.length} pronti per continuare</p>
              <button onClick={goNext} className="press mt-2 w-full py-5 text-3xl uppercase" style={{ ...display, background: C.cream, color: C.ink, boxShadow: `6px 6px 0 ${C.magenta}` }}>
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
              <p className="mt-5 text-center text-sm opacity-60">{Object.keys(answered).length}/{players.length} pronti per continuare</p>
              <button onClick={goNext} className="press mt-2 w-full py-5 text-3xl uppercase" style={{ ...display, background: C.cream, color: C.ink, boxShadow: `6px 6px 0 ${C.magenta}` }}>Avanti</button>
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
              <p className="mt-5 text-center text-sm opacity-60">{Object.keys(answered).length}/{players.length} pronti per continuare</p>
              <button onClick={goNext} className="press mt-2 w-full py-5 text-3xl uppercase" style={{ ...display, background: C.cream, color: C.ink, boxShadow: `6px 6px 0 ${C.magenta}` }}>
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
              <p className="mt-5 text-center text-sm opacity-60">{Object.keys(answered).length}/{players.length} pronti per continuare</p>
              <button onClick={goNext} className="press mt-2 w-full py-5 text-3xl uppercase" style={{ ...display, background: C.cream, color: C.ink, boxShadow: `6px 6px 0 ${C.magenta}` }}>
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

/* ---------------- RED FLAG: schermo grande ---------------- */
/** Timer «a tacche»: 10 blocchi che si spengono, contati a colpo d'occhio. */
function RfTacche({ left, total }) {
  const lit = Math.max(0, Math.min(10, Math.ceil((Math.max(0, left) / total) * 10)));
  const urgent = left < 3;
  return (
    <div className="flex gap-1">
      {Array.from({ length: 10 }, (_, i) => (
        <span key={i} style={{ width: 20, height: 9, background: i < lit ? (urgent ? C.flagRed : C.gold) : "rgba(255,243,230,.15)", transition: "background .15s" }} />
      ))}
    </div>
  );
}

/** Tacche dell'intensità in alto a destra: sempre visibili, l'host può solo alzarle. */
function RfLevelTacche({ level, onRaise }) {
  return (
    <div className="flex items-center gap-1">
      {RF_INTENSITY.map((lv) => {
        const on = lv.level <= level;
        const clickable = onRaise && lv.level > level;
        return (
          <button key={lv.key} onClick={() => clickable && onRaise(lv.level)} disabled={!clickable} title={lv.label}
            className={clickable ? "press" : ""} style={{
              width: 30, height: 24, border: `2px solid ${C.flagRed}`, background: on ? C.flagRed : "transparent",
              opacity: on ? 1 : 0.55, cursor: clickable ? "pointer" : "default", fontSize: 13,
            }}>
            {lv.emoji}
          </button>
        );
      })}
    </div>
  );
}

function HostRedFlag({ rf, left, players, answered, next, room, err, rfLevel, onRaiseLevel, onAgain, onExit }) {
  const seenRef = useRef({ key: null, tickAt: null });
  useEffect(() => {
    if (!rf) return;
    const key = `${rf.phase}:${rf.rid || rf.phase}`;
    if (seenRef.current.key === key) return;
    seenRef.current.key = key;
    if (["rf-scelta", "rf-vote"].includes(rf.phase)) sfx.whoosh();
    else if (rf.phase === "rf-confessione" || rf.phase === "rf-hotseat" || rf.phase === "rf-bluff") { sfx.whoosh(); sfx.rfPulse(); }
    else if (rf.phase === "rf-hotseatvote" || rf.phase === "rf-bluffvote") sfx.whoosh();
    else if (rf.phase === "rf-sceltares" || rf.phase === "rf-voteres") sfx.reveal();
    else if (rf.phase === "rf-confres") (rf.passed ? sfx.rfGuilty() : sfx.rfInnocent());
    else if (rf.phase === "rf-hotseatres") {
      sfx.rfDrumroll();
      setTimeout(() => (rf.verdict === "redflag" ? sfx.rfGuilty() : sfx.rfInnocent()), 1350);
    }
    else if (rf.phase === "rf-bluffres") {
      sfx.rfDrumroll();
      setTimeout(() => (rf.majority === "bluff" ? sfx.rfGuilty() : sfx.rfInnocent()), 1350);
    }
    else if (rf.phase === "rf-report") sfx.podium();
  }, [rf?.phase, rf?.rid]); // eslint-disable-line

  /* battito di tensione negli ultimi secondi */
  useEffect(() => {
    if (!rf || !["rf-confessione", "rf-hotseat", "rf-hotseatvote", "rf-bluff", "rf-bluffvote"].includes(rf.phase)) return;
    const secs = Math.ceil(left);
    if (secs === seenRef.current.tickAt) return;
    seenRef.current.tickAt = secs;
    if (secs > 0 && secs <= 5) sfx.rfPulse();
  }, [left, rf?.phase]); // eslint-disable-line

  if (!rf) return null;
  const goNext = () => { sfx.select(); next(); };
  const timed = ["rf-scelta", "rf-confessione", "rf-vote", "rf-hotseat", "rf-hotseatvote", "rf-bluff", "rf-bluffvote"].includes(rf.phase);
  const voters = rf.phase === "rf-hotseatvote" || rf.phase === "rf-bluffvote" ? Math.max(1, players.length - 1) : players.length;
  const lowTime = timed && left < 5;

  return (
    <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col overflow-hidden px-6 py-6" style={{ color: C.cream }}>
      <div className="rf-scan" aria-hidden />
      <div className="mb-4 flex items-center justify-between text-xs font-bold uppercase tracking-widest">
        <span className="flex items-center gap-2" style={{ color: C.flagRed }}><span className="flag-wave inline-block">🚩</span> Red Flag {rf.qn ? `· ${rf.qn}/${rf.qtot}` : ""}</span>
        <div className="flex items-center gap-4">
          <RfLevelTacche level={rfLevel} onRaise={onRaiseLevel} />
          <span className="opacity-60">Stanza {room}</span>
        </div>
      </div>
      {timed && <div className="mb-6"><RfTacche left={left} total={rf.time} /></div>}

      {rf.phase === "rf-scelta" && (
        <div className="tvin flex flex-1 flex-col items-center justify-center text-center">
          <span className="-rotate-1 px-3 py-1 text-xs font-bold uppercase" style={{ background: C.gold, color: C.ink }}>Scelta</span>
          <p className="my-5 max-w-3xl text-4xl uppercase" style={{ ...display, color: C.cream }}>{rf.card.q}</p>
          <div className="mt-2 grid w-full gap-4 sm:grid-cols-2">
            <div className="slide-l border-2 p-6 text-left" style={{ borderColor: C.cream }}>
              <span className="-rotate-1 inline-block px-2 py-0.5 text-xs font-bold uppercase" style={{ background: C.cream, color: C.ink }}>A</span>
              <p className="mt-3 text-2xl font-bold">{rf.card.a}</p>
            </div>
            <div className="slide-r border-2 p-6 text-left" style={{ borderColor: C.flagRed }}>
              <span className="-rotate-1 inline-block px-2 py-0.5 text-xs font-bold uppercase" style={{ background: C.flagRed, color: C.cream }}>B</span>
              <p className="mt-3 text-2xl font-bold">{rf.card.b}</p>
            </div>
          </div>
          <p className="mt-6 text-sm opacity-60">{Object.keys(answered).length}/{voters} hanno scelto dal telefono · niente scelta = bandiera</p>
        </div>
      )}

      {rf.phase === "rf-sceltares" && (
        <div className="tvin flex flex-1 flex-col items-center justify-center text-center">
          <p className="max-w-2xl text-2xl uppercase" style={{ ...display, color: C.cream }}>{rf.card.q}</p>
          <div className="mt-8 w-full max-w-xl space-y-4">
            {["a", "b"].map((k) => {
              const tot = (rf.tally.a || 0) + (rf.tally.b || 0) || 1;
              const pct = Math.round(((rf.tally[k] || 0) / tot) * 100);
              return (
                <div key={k} className="text-left">
                  <div className="flex items-center justify-between text-sm font-bold">
                    <span style={{ color: k === "a" ? C.cream : C.flagRed }}>{k.toUpperCase()} · {rf.card[k]}</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="mt-1 h-4 w-full" style={{ background: "rgba(255,243,230,.1)" }}>
                    <div className="h-4" style={{ width: `${pct}%`, background: k === "a" ? C.cream : C.flagRed, transition: "width .5s ease-out" }} />
                  </div>
                </div>
              );
            })}
          </div>
          {rf.missing.length > 0 && (
            <p className="mt-4 text-sm font-bold" style={{ color: C.flagRed }}>🚩 bandiera per non aver scelto: {rf.missing.map((id) => players.find((p) => p.id === id)?.name).filter(Boolean).join(", ")}</p>
          )}
          <p className="mt-6 text-center text-sm opacity-60">{Object.keys(answered).length}/{voters} pronti per continuare</p>
          <button onClick={goNext} className="press mt-2 w-full max-w-xl py-5 text-3xl uppercase" style={{ ...display, background: C.flagRed, color: C.cream, boxShadow: `6px 6px 0 ${C.ink2}` }}>
            {rf.qn >= rf.qtot ? "Verdetto finale" : "Avanti"}
          </button>
        </div>
      )}

      {rf.phase === "rf-confessione" && (
        <div className="tvin flex flex-1 flex-col items-center justify-center text-center">
          <span className="pop -rotate-1 px-3 py-1 text-xs font-bold uppercase" style={{ background: C.flagRed, color: C.cream }}>Confessionale</span>
          <p className="pop glow my-4 text-7xl uppercase" style={{ ...display, color: C.flagRed }}>{rf.targetName}</p>
          <p className="max-w-xl text-lg opacity-70">Sta rispondendo dal suo telefono. Rispondere o passare: chi passa si prende una bandiera.</p>
        </div>
      )}

      {rf.phase === "rf-confres" && (
        <div className="tvin flex flex-1 flex-col items-center justify-center text-center">
          <p className="text-xs uppercase tracking-widest opacity-60">Confessionale</p>
          <p className="text-4xl uppercase" style={{ ...display, color: C.cream }}>{rf.targetName}</p>
          <div className={`stamp-in mt-6 inline-block -rotate-1 border-4 px-10 py-5 ${rf.passed ? "" : ""}`} style={{ borderColor: rf.passed ? C.flagRed : C.lime, color: rf.passed ? C.flagRed : C.lime }}>
            <p className="text-5xl uppercase" style={display}>{rf.passed ? "Passo · 🚩" : "Confessato"}</p>
          </div>
          <p className="mt-6 text-center text-sm opacity-60">{Object.keys(answered).length}/{voters} pronti per continuare</p>
          <button onClick={goNext} className="press mt-2 w-full max-w-xl py-5 text-3xl uppercase" style={{ ...display, background: C.flagRed, color: C.cream, boxShadow: `6px 6px 0 ${C.ink2}` }}>
            {rf.qn >= rf.qtot ? "Verdetto finale" : "Avanti"}
          </button>
        </div>
      )}

      {rf.phase === "rf-vote" && (
        <div className="tvin flex flex-1 flex-col items-center justify-center text-center">
          <span className="-rotate-1 px-3 py-1 text-xs font-bold uppercase" style={{ background: rf.variant === "caos" ? C.arancio : rf.variant === "crush" ? C.magenta : C.flagRed, color: rf.variant === "caos" ? C.ink : C.cream }}>
            {rf.variant === "caos" ? "Caos" : rf.variant === "crush" ? "Crush" : "Chi è la Red Flag"}
          </span>
          <div className="mt-4 w-full max-w-2xl border-4 border-dashed p-8" style={{ borderColor: "rgba(255,31,61,.4)" }}>
            <p className="text-sm font-bold uppercase" style={{ color: C.flagRed }}>🫣 Voti chiusi</p>
            <p className="mt-3 text-3xl uppercase" style={{ ...display, color: C.cream }}>{rf.card.q}</p>
            <p className="mt-3 text-sm opacity-60">{Object.keys(answered).length}/{voters} hanno votato</p>
          </div>
        </div>
      )}

      {rf.phase === "rf-voteres" && (
        <div className="tvin flex flex-1 flex-col items-center">
          <p className="text-center text-xl uppercase" style={{ ...display, color: C.cream }}>{rf.card.q}</p>
          <div className="mt-6 w-full max-w-2xl space-y-2">
            {[...players].sort((a, b) => (rf.tally[b.id] || 0) - (rf.tally[a.id] || 0)).map((p) => {
              const votes = rf.tally[p.id] || 0;
              const isTop = rf.top.includes(p.id);
              const maxV = Math.max(1, ...Object.values(rf.tally));
              return (
                <div key={p.id} className="flex items-center gap-3">
                  <span className={`w-28 truncate text-sm font-bold ${isTop ? "stamp-in" : ""}`} style={{ color: isTop ? C.flagRed : C.cream }}>{p.name}{isTop ? " 🚩" : ""}</span>
                  <div className="h-6 flex-1" style={{ background: "rgba(255,243,230,.08)" }}>
                    <div className="h-6" style={{ width: `${(votes / maxV) * 100}%`, background: isTop ? C.flagRed : "rgba(255,243,230,.3)", transition: "width .5s ease-out" }} />
                  </div>
                  <span className="w-6 text-right text-sm font-bold">{votes}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-6 text-center text-sm opacity-60">{Object.keys(answered).length}/{voters} pronti per continuare</p>
          <button onClick={goNext} className="press mt-2 w-full max-w-2xl py-5 text-3xl uppercase" style={{ ...display, background: C.flagRed, color: C.cream, boxShadow: `6px 6px 0 ${C.ink2}` }}>
            {rf.qn >= rf.qtot ? "Verdetto finale" : "Avanti"}
          </button>
        </div>
      )}

      {rf.phase === "rf-hotseat" && (
        <div className="tvin flex flex-1 flex-col items-center justify-center text-center">
          <span className={`pop -rotate-1 px-3 py-1 text-xs font-bold uppercase ${lowTime ? "buzzer-hot" : ""}`} style={{ background: C.flagRed, color: C.cream }}>Hot Seat</span>
          <p className="pop glow my-4 text-8xl uppercase" style={{ ...display, color: C.flagRed }}>{rf.targetName}</p>
          <p className="max-w-xl text-xl font-bold opacity-80">Il gruppo fa domande a voce. 3 pass gratis, poi ogni pass è una bandiera.</p>
          <p className="mt-6 text-3xl font-bold" style={{ color: (rf.livePasses || 0) > 3 ? C.flagRed : C.cream }}>
            Pass: {rf.livePasses || 0}{(rf.livePasses || 0) > 3 ? ` (+${(rf.livePasses || 0) - 3} 🚩)` : " / 3 gratis"}
          </p>
        </div>
      )}

      {rf.phase === "rf-hotseatvote" && (
        <div className="tvin flex flex-1 flex-col items-center justify-center text-center">
          <p className="text-xs uppercase tracking-widest opacity-60">Verdetto Hot Seat</p>
          <p className="pop glow text-6xl uppercase" style={{ ...display, color: C.flagRed }}>{rf.targetName}</p>
          <p className="mt-2 text-sm opacity-70">{rf.passes > 3 ? `${rf.passes - 3} bandiere già in tasca dai pass extra.` : "Nessun pass extra."}</p>
          <p className="mt-6 text-sm opacity-60">{Object.keys(answered).length}/{voters} hanno votato: assolto o red flag</p>
        </div>
      )}

      {rf.phase === "rf-hotseatres" && (
        <div className="tvin flex flex-1 flex-col items-center justify-center text-center">
          <p className="text-4xl uppercase" style={{ ...display, color: C.cream }}>{rf.targetName}</p>
          <div className={`stamp-in mt-6 inline-block -rotate-1 border-4 px-10 py-5 ${rf.verdict === "redflag" ? "shake" : ""}`} style={{ borderColor: rf.verdict === "redflag" ? C.flagRed : C.lime, color: rf.verdict === "redflag" ? C.flagRed : C.lime }}>
            <p className="text-5xl uppercase" style={display}>{rf.verdict === "redflag" ? "🚩 Red Flag" : "Assolto"}</p>
          </div>
          <p className="mt-3 text-sm font-bold opacity-70">{rf.tally.redflag} contro {rf.tally.assolto}{rf.passExtra > 0 ? ` · +${rf.passExtra} 🚩 dai pass extra` : ""}</p>
          <p className="mt-6 text-center text-sm opacity-60">{Object.keys(answered).length}/{voters} pronti per continuare</p>
          <button onClick={goNext} className="press mt-2 w-full max-w-2xl py-5 text-3xl uppercase" style={{ ...display, background: C.flagRed, color: C.cream, boxShadow: `6px 6px 0 ${C.ink2}` }}>
            {rf.qn >= rf.qtot ? "Verdetto finale" : "Avanti"}
          </button>
        </div>
      )}

      {rf.phase === "rf-bluff" && (
        <div className="tvin flex flex-1 flex-col items-center justify-center text-center">
          <span className={`pop -rotate-1 px-3 py-1 text-xs font-bold uppercase ${lowTime ? "buzzer-hot" : ""}`} style={{ background: C.flagRed, color: C.cream }}>🎭 Bluff</span>
          <p className="pop glow my-4 text-7xl uppercase" style={{ ...display, color: C.flagRed }}>{rf.targetName}</p>
          <p className="max-w-xl text-lg opacity-70">Sta decidendo in segreto se dire la verità o bluffare, poi lo dice a voce. Il gruppo vota subito dopo.</p>
        </div>
      )}

      {rf.phase === "rf-bluffvote" && (
        <div className="tvin flex flex-1 flex-col items-center justify-center text-center">
          <p className="text-xs uppercase tracking-widest opacity-60">Verità o bluff?</p>
          <p className="pop glow text-6xl uppercase" style={{ ...display, color: C.flagRed }}>{rf.targetName}</p>
          <p className="mt-2 max-w-xl text-sm opacity-70">{rf.card?.q}</p>
          <p className="mt-6 text-sm opacity-60">{Object.keys(answered).length}/{voters} hanno votato</p>
        </div>
      )}

      {rf.phase === "rf-bluffres" && (
        <div className="tvin flex flex-1 flex-col items-center justify-center text-center">
          <p className="text-4xl uppercase" style={{ ...display, color: C.cream }}>{rf.targetName}</p>
          <p className="mt-2 max-w-xl text-sm opacity-70">{rf.card?.q}</p>
          <div className={`stamp-in mt-6 inline-block -rotate-1 border-4 px-10 py-5 ${rf.bluffChoice === "bluff" && rf.majority === "bluff" ? "shake" : ""}`} style={{ borderColor: rf.bluffChoice === "bluff" ? C.flagRed : C.lime, color: rf.bluffChoice === "bluff" ? C.flagRed : C.lime }}>
            <p className="text-5xl uppercase" style={display}>{rf.bluffChoice === "bluff" ? "Era un bluff" : "Era vero"}</p>
          </div>
          <p className="mt-3 text-sm font-bold opacity-70">Il gruppo ha detto: {rf.majority === "bluff" ? "bluff" : "verità"} · {rf.tally.bluff} contro {rf.tally.verita}</p>
          <p className="mt-1 text-sm font-bold" style={{ color: rf.bluffChoice === "bluff" && rf.majority === "bluff" ? C.flagRed : C.lime }}>
            {rf.bluffChoice === "bluff" && rf.majority === "bluff" ? "🚩 Beccato/a" : rf.bluffChoice === "bluff" ? "Bluff riuscito" : "Creduto/a"}
          </p>
          <p className="mt-6 text-center text-sm opacity-60">{Object.keys(answered).length}/{voters} pronti per continuare</p>
          <button onClick={goNext} className="press mt-2 w-full max-w-2xl py-5 text-3xl uppercase" style={{ ...display, background: C.flagRed, color: C.cream, boxShadow: `6px 6px 0 ${C.ink2}` }}>
            {rf.qn >= rf.qtot ? "Verdetto finale" : "Avanti"}
          </button>
        </div>
      )}

      {rf.phase === "rf-report" && (() => {
        const rank = [...players].sort((a, b) => (a.flags || 0) - (b.flags || 0));
        const podium = [rank[1], rank[0], rank[2]];
        const heights = [150, 210, 120];
        const delays = [0, 0.55, 0.15];
        return (
          <div className="tvin flex flex-1 flex-col">
            <Confetti />
            <p className="text-center text-xs uppercase tracking-widest opacity-60">Red Flag Report</p>
            <p className="my-2 text-center text-5xl uppercase" style={{ ...display, color: C.flagRed }}>La classifica finale</p>

            <div className="mt-4 flex items-end justify-center gap-3">
              {podium.map((p, i) => p && (
                <div key={p.id} className="grow-up flex flex-col items-center" style={{ width: 140, animationDelay: `${delays[i]}s` }}>
                  <p className="mb-2 truncate text-lg font-bold" style={{ color: p.color }}>{p.name}</p>
                  <div className="flex w-full flex-col items-center justify-end border-2 px-2 pb-3" style={{ height: heights[i], borderColor: i === 1 ? C.gold : "rgba(255,243,230,.25)", background: i === 1 ? "rgba(255,201,60,.1)" : "transparent" }}>
                    <span className="text-3xl" style={display}>{i === 1 ? "👑" : ""}</span>
                    <span className="text-2xl font-bold">{p.flags || 0} 🚩</span>
                  </div>
                </div>
              ))}
            </div>

            {rank.length > 3 && (
              <div className="mt-6 space-y-1">
                {rank.slice(3).map((p, i) => (
                  <div key={p.id} className="rise-in flex items-center gap-3 border-2 px-3 py-2" style={{ borderColor: "rgba(255,243,230,.15)", animationDelay: `${i * 0.06}s` }}>
                    <span className="w-6 text-sm opacity-60">{i + 4}</span>
                    <span className="flex-1 font-bold">{p.name}</span>
                    <span className="font-bold">{p.flags || 0} 🚩</span>
                  </div>
                ))}
              </div>
            )}

            <p className="mt-8 text-sm uppercase tracking-widest opacity-70">I titoli della serata</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {(rf.titles || []).map((t) => (
                <div key={t.key} className="border-2 px-4 py-3" style={{ borderColor: C.flagRed }}>
                  <p className="text-lg font-bold" style={{ color: C.flagRed }}>{t.emoji} {t.label}</p>
                  <p className="text-sm font-bold">{t.winnerName || "—"}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-center text-xs opacity-60">Il report individuale è sul telefono di ognuno.</p>

            <button onClick={onAgain} className="press mt-8 w-full py-5 text-3xl uppercase" style={{ ...display, background: C.flagRed, color: C.cream, boxShadow: `6px 6px 0 ${C.ink2}` }}>Rivincita</button>
            <button onClick={onExit} className="press mt-3 w-full border-2 py-3 text-sm font-bold uppercase" style={{ borderColor: "rgba(255,243,230,.3)", color: C.cream }}>Chiudi la stanza</button>
          </div>
        );
      })()}

      {err && <p className="mt-3 text-center text-xs" style={{ color: C.gold }}>{err}</p>}
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

/** Disegni diversi per l'immagine del puzzle scorrevole: niente foto vere
 *  (l'app resta autonoma, senza asset esterni), ma almeno non è sempre
 *  lo stesso vortice ricolorato — cambia anche la forma del pattern. */
const PUZZLE_DESIGNS = [
  (h1, h2, h3, h4) => `conic-gradient(from ${h1}deg at 35% 30%, hsl(${h1},90%,60%), hsl(${h2},90%,55%), hsl(${h3},85%,60%), hsl(${h4},90%,58%), hsl(${h1},90%,60%))`,
  (h1, h2, h3, h4) => `radial-gradient(circle at 30% 30%, hsl(${h1},95%,65%) 0%, hsl(${h2},90%,55%) 35%, hsl(${h3},85%,45%) 70%, hsl(${h4},90%,35%) 100%)`,
  (h1, h2, h3) => `repeating-linear-gradient(45deg, hsl(${h1},85%,58%) 0 12%, hsl(${h2},85%,50%) 12% 24%, hsl(${h3},85%,58%) 24% 36%)`,
  (h1, h2) => `repeating-conic-gradient(from 0deg, hsl(${h1},85%,55%) 0deg 45deg, hsl(${h2},85%,45%) 45deg 90deg)`,
  (h1, h3, h4) => `linear-gradient(120deg, hsl(${h1},90%,60%) 0%, hsl(${h3},85%,45%) 100%), radial-gradient(circle at 70% 70%, hsl(${h4},90%,55%), transparent 60%)`,
  (h1, h2, h3) => `repeating-radial-gradient(ellipse at 50% 40%, hsl(${h1},90%,58%) 0 8%, hsl(${h2},85%,48%) 8% 16%, hsl(${h3},85%,58%) 16% 24%)`,
];

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
  const seed = (s.rid || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0) + id.charCodeAt(0) * 13;
  const hue = (id.charCodeAt(0) * 37 + (s.rid || "").length * 53) % 360;
  const design = PUZZLE_DESIGNS[seed % PUZZLE_DESIGNS.length];
  const bg = design(hue, (hue + 70) % 360, (hue + 160) % 360, (hue + 250) % 360);

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
                  backgroundImage: bg,
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
      const saved = sessionStorage.getItem("cultrash:pid");
      if (saved) return saved;
      const fresh = uid();
      sessionStorage.setItem("cultrash:pid", fresh);
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
  const [ready, setReady] = useState(false);
  const [hotPasses, setHotPasses] = useState(0);
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
        if ((st.phase === "quiz" || st.phase === "vote" || st.phase === "choose" || st.phase === "spicy" || st.phase === "bet" || st.phase === "rf-scelta" || st.phase === "rf-confessione" || st.phase === "rf-vote" || st.phase === "rf-hotseat" || st.phase === "rf-hotseatvote" || st.phase === "rf-bluff" || st.phase === "rf-bluffvote") && st.rid !== ridRef.current) {
          ridRef.current = st.rid;
          startRef.current = Date.now();
          setAnswer(null); setRisk(false); setNumGuess(""); setClueStep(0); setPendAns(null); setReady(false); setHotPasses(0);
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
  async function sendReady() {
    if (ready || !s?.rid) return;
    setReady(true);
    const ok = await write({ rid: s.rid, ready: true });
    if (!ok) setReady(false);
  }
  async function sendRfChoice(k) {
    if (answer !== null || s?.phase !== "rf-scelta") return;
    setAnswer(k);
    const ok = await write({ rid: s.rid, rfChoice: k });
    if (!ok) setAnswer(null);
  }
  async function sendRfConf(choice) {
    if (answer !== null || s?.phase !== "rf-confessione") return;
    setAnswer(choice);
    const ok = await write({ rid: s.rid, rfConf: choice });
    if (!ok) setAnswer(null);
  }
  async function sendRfVote(pid) {
    if (answer !== null || s?.phase !== "rf-vote") return;
    setAnswer(pid);
    const ok = await write({ rid: s.rid, rfVote: pid });
    if (!ok) setAnswer(null);
  }
  async function sendHotPass() {
    if (s?.phase !== "rf-hotseat") return;
    const n = hotPasses + 1;
    setHotPasses(n);
    await write({ rid: s.rid, hotPass: n });
  }
  async function sendRfJudge(v) {
    if (answer !== null || s?.phase !== "rf-hotseatvote") return;
    setAnswer(v);
    const ok = await write({ rid: s.rid, rfJudge: v });
    if (!ok) setAnswer(null);
  }
  async function sendRfBluff(choice) {
    if (answer !== null || s?.phase !== "rf-bluff") return;
    setAnswer(choice);
    const ok = await write({ rid: s.rid, rfBluff: choice });
    if (!ok) setAnswer(null);
  }
  async function sendRfBluffGuess(choice) {
    if (answer !== null || s?.phase !== "rf-bluffvote") return;
    setAnswer(choice);
    const ok = await write({ rid: s.rid, rfBluffGuess: choice });
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
        <span className="opacity-60">{s?.mode === "redflag" ? (me ? `${me.flags || 0} 🚩` : `stanza ${room}`) : teamScore != null ? `squadra ${teamScore}` : me ? `${me.score} punti` : `stanza ${room}`}</span>
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
          <Presenter talking={false} color={mg.color} size={92} />
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
          <button onClick={sendReady} disabled={ready} className="press mt-6 w-full py-4 text-xl uppercase"
            style={{ ...display, background: ready ? "rgba(255,243,230,.12)" : C.lime, color: ready ? "rgba(255,243,230,.5)" : C.ink }}>
            {ready ? "Aspettando gli altri…" : "Avanti"}
          </button>
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
          <button onClick={sendReady} disabled={ready} className="press mt-6 w-full py-4 text-xl uppercase"
            style={{ ...display, background: ready ? "rgba(255,243,230,.12)" : C.lime, color: ready ? "rgba(255,243,230,.5)" : C.ink }}>
            {ready ? "Aspettando gli altri…" : "Avanti"}
          </button>
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
          <button onClick={sendReady} disabled={ready} className="press mt-6 w-full py-4 text-xl uppercase"
            style={{ ...display, background: ready ? "rgba(255,243,230,.12)" : C.lime, color: ready ? "rgba(255,243,230,.5)" : C.ink }}>
            {ready ? "Aspettando gli altri…" : "Avanti"}
          </button>
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
          <button onClick={sendReady} disabled={ready} className="press mt-6 w-full py-4 text-xl uppercase"
            style={{ ...display, background: ready ? "rgba(255,243,230,.12)" : C.lime, color: ready ? "rgba(255,243,230,.5)" : C.ink }}>
            {ready ? "Aspettando gli altri…" : "Avanti"}
          </button>
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

      {s?.phase === "rf-scelta" && (
        <div className="tvin flex flex-1 flex-col">
          <span className="mb-3 inline-flex w-fit items-center gap-1 -rotate-1 px-3 py-1 text-xs font-bold uppercase" style={{ background: C.gold, color: C.ink }}>Scelta</span>
          <p className="mb-4 text-lg font-bold leading-snug">{s.card?.q}</p>
          <div className="flex flex-1 flex-col gap-3">
            {["a", "b"].map((k) => {
              const sel = answer === k, off = answer !== null && !sel;
              return (
                <button key={k} onClick={() => sendRfChoice(k)} disabled={answer !== null}
                  className={`press flex flex-1 items-center justify-center px-4 py-6 text-center text-xl font-bold ${sel ? "bump" : ""}`}
                  style={{ background: sel ? C.cream : k === "a" ? "rgba(255,243,230,.1)" : C.flagRed, color: k === "a" && !sel ? C.cream : sel ? C.ink : C.cream, opacity: off ? 0.25 : 1, boxShadow: off || sel ? "none" : "5px 5px 0 rgba(0,0,0,.45)" }}>
                  {s.card?.[k]}
                </button>
              );
            })}
          </div>
          {answer && <p className="mt-2 text-center text-sm opacity-70">Scelto. Si scopre insieme dopo.</p>}
        </div>
      )}

      {s?.phase === "rf-sceltares" && (
        <div key={s.rid} className="tvin flex flex-1 flex-col justify-center text-center">
          <p className="text-lg font-bold">{s.card?.q}</p>
          <div className="mt-4 space-y-3">
            {["a", "b"].map((k) => {
              const tot = (s.tally?.a || 0) + (s.tally?.b || 0) || 1;
              const pct = Math.round(((s.tally?.[k] || 0) / tot) * 100);
              return (
                <div key={k} className="text-left">
                  <div className="flex items-center justify-between text-xs font-bold uppercase">
                    <span style={{ color: k === "a" ? C.cream : C.flagRed }}>{s.card?.[k]}</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="mt-1 h-3 w-full" style={{ background: "rgba(255,243,230,.1)" }}>
                    <div className="h-3" style={{ width: `${pct}%`, background: k === "a" ? C.cream : C.flagRed, transition: "width .5s ease-out" }} />
                  </div>
                </div>
              );
            })}
          </div>
          {mine && (
            <p className="mt-3 text-sm font-bold" style={{ color: mine.flag ? C.flagRed : C.lime }}>{mine.flag ? "Bandiera: non hai scelto in tempo." : "Nessuna bandiera."}</p>
          )}
          <button onClick={sendReady} disabled={ready} className="press mt-6 w-full py-4 text-xl uppercase"
            style={{ ...display, background: ready ? "rgba(255,243,230,.12)" : C.flagRed, color: ready ? "rgba(255,243,230,.5)" : C.cream }}>
            {ready ? "Aspettando gli altri…" : "Avanti"}
          </button>
        </div>
      )}

      {s?.phase === "rf-confessione" && (
        s.target === id ? (
          <div className="tvin flex flex-1 flex-col">
            <span className="mb-3 inline-flex w-fit items-center gap-1 -rotate-1 px-3 py-1 text-xs font-bold uppercase" style={{ background: C.flagRed, color: C.cream }}>🫣 Confessionale</span>
            <p className="mb-4 text-lg font-bold leading-snug">{s.card?.q}</p>
            <div className="flex flex-1 flex-col gap-3">
              <button onClick={() => sendRfConf("confess")} disabled={answer !== null}
                className={`press flex flex-1 items-center justify-center px-4 py-6 text-center text-xl font-bold ${answer === "confess" ? "bump" : ""}`}
                style={{ background: answer === "confess" ? C.cream : C.lime, color: C.ink, opacity: answer !== null && answer !== "confess" ? 0.25 : 1, boxShadow: answer !== null ? "none" : "5px 5px 0 rgba(0,0,0,.45)" }}>
                Confesso
              </button>
              <button onClick={() => sendRfConf("pass")} disabled={answer !== null}
                className={`press flex flex-1 items-center justify-center px-4 py-6 text-center text-xl font-bold ${answer === "pass" ? "bump" : ""}`}
                style={{ background: answer === "pass" ? C.cream : C.flagRed, color: C.cream, opacity: answer !== null && answer !== "pass" ? 0.25 : 1, boxShadow: answer !== null ? "none" : "5px 5px 0 rgba(0,0,0,.45)" }}>
                Passo 🚩
              </button>
            </div>
            {answer && <p className="mt-2 text-center text-sm opacity-70">Detto. Ora tocca a te dirlo al gruppo.</p>}
          </div>
        ) : (
          <div className="tvin flex flex-1 flex-col items-center justify-center text-center">
            <span className="mb-3 inline-flex w-fit items-center gap-1 -rotate-1 px-3 py-1 text-xs font-bold uppercase" style={{ background: "rgba(255,31,61,.15)", color: C.flagRed }}>🫣 Confessionale</span>
            <p className="text-2xl font-bold" style={{ color: C.flagRed }}>{s.targetName}</p>
            <p className="mt-2 max-w-xs text-sm opacity-70">Sta rispondendo sul suo telefono. Guarda lo schermo grande.</p>
          </div>
        )
      )}

      {s?.phase === "rf-confres" && (
        <div key={s.rid} className="tvin flex flex-1 flex-col justify-center text-center">
          <p className="text-xs uppercase tracking-widest opacity-60">{s.targetName}</p>
          <p className="my-2 text-3xl uppercase" style={{ ...display, color: s.passed ? C.flagRed : C.lime }}>{s.passed ? "Passo · 🚩" : "Confessato"}</p>
          {s.target === id && mine && (
            <p className="mt-2 text-sm font-bold" style={{ color: mine.flag ? C.flagRed : C.lime }}>{mine.note}</p>
          )}
          <button onClick={sendReady} disabled={ready} className="press mt-6 w-full py-4 text-xl uppercase"
            style={{ ...display, background: ready ? "rgba(255,243,230,.12)" : C.flagRed, color: ready ? "rgba(255,243,230,.5)" : C.cream }}>
            {ready ? "Aspettando gli altri…" : "Avanti"}
          </button>
        </div>
      )}

      {s?.phase === "rf-vote" && (
        <div className="tvin flex flex-1 flex-col">
          <span className="buzzer-hot mb-3 inline-flex w-fit items-center gap-1 -rotate-1 px-3 py-1 text-xs font-bold uppercase" style={{ background: s.variant === "crush" ? C.magenta : C.flagRed, color: C.cream }}>
            🔒 {s.variant === "caos" ? "Caos" : s.variant === "crush" ? "Crush" : "Chi è la Red Flag"}
          </span>
          <p className="mb-3 text-base font-bold leading-snug">{s.card?.q}</p>
          <div className="flex flex-1 flex-col gap-2">
            {s.players?.map((p) => {
              const sel = answer === p.id, off = answer !== null && !sel;
              return (
                <button key={p.id} onClick={() => sendRfVote(p.id)} disabled={answer !== null}
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

      {s?.phase === "rf-voteres" && (
        <div key={s.rid} className="tvin flex flex-1 flex-col justify-center text-center">
          <p className="text-sm font-bold opacity-80">{s.card?.q}</p>
          <div className={`mt-4 px-4 py-5 ${mine?.flag ? "shake" : "pop"}`} style={{ background: mine?.flag ? C.flagRed : "rgba(255,243,230,.08)", color: C.cream }}>
            <p className="text-4xl uppercase" style={display}>{mine?.flag ? "🚩 bandiera" : "salvo"}</p>
            {mine?.votes > 0 && <p className="text-sm font-bold">{mine.votes} voti contro di te</p>}
          </div>
          <button onClick={sendReady} disabled={ready} className="press mt-6 w-full py-4 text-xl uppercase"
            style={{ ...display, background: ready ? "rgba(255,243,230,.12)" : C.flagRed, color: ready ? "rgba(255,243,230,.5)" : C.cream }}>
            {ready ? "Aspettando gli altri…" : "Avanti"}
          </button>
        </div>
      )}

      {s?.phase === "rf-hotseat" && (
        s.target === id ? (
          <div className="tvin flex flex-1 flex-col items-center justify-center text-center">
            <span className="mb-3 inline-flex w-fit items-center gap-1 -rotate-1 px-3 py-1 text-xs font-bold uppercase" style={{ background: C.flagRed, color: C.cream }}>Sei tu, Hot Seat</span>
            <p className="mb-6 max-w-xs text-sm opacity-70">Il gruppo ti fa domande a voce. Rispondi, o passa. Dal quarto pass in poi, ogni pass è una bandiera.</p>
            <button onClick={sendHotPass} className="press w-full max-w-xs py-8 text-3xl uppercase"
              style={{ ...display, background: hotPasses >= 3 ? C.flagRed : C.gold, color: C.ink }}>
              Passo ({hotPasses})
            </button>
            {hotPasses > 3 && <p className="mt-2 text-sm font-bold" style={{ color: C.flagRed }}>+{hotPasses - 3} 🚩 dai pass extra</p>}
          </div>
        ) : (
          <div className="tvin flex flex-1 flex-col items-center justify-center text-center">
            <span className="mb-3 inline-flex w-fit items-center gap-1 -rotate-1 px-3 py-1 text-xs font-bold uppercase" style={{ background: "rgba(255,31,61,.15)", color: C.flagRed }}>Hot Seat</span>
            <p className="text-2xl font-bold" style={{ color: C.flagRed }}>{s.targetName}</p>
            <p className="mt-2 max-w-xs text-sm opacity-70">È sotto torchio. Fagli domande a voce, guarda il countdown sullo schermo grande.</p>
          </div>
        )
      )}

      {s?.phase === "rf-hotseatvote" && (
        s.target === id ? (
          <div className="tvin flex flex-1 flex-col items-center justify-center text-center">
            <span className="mb-3 inline-flex w-fit items-center gap-1 -rotate-1 px-3 py-1 text-xs font-bold uppercase" style={{ background: "rgba(255,31,61,.15)", color: C.flagRed }}>Verdetto in arrivo</span>
            <p className="mt-1 max-w-xs text-lg font-bold opacity-80">Il gruppo sta decidendo. Non puoi votare per te stesso.</p>
          </div>
        ) : (
          <div className="tvin flex flex-1 flex-col">
            <span className="mb-3 inline-flex w-fit items-center gap-1 -rotate-1 px-3 py-1 text-xs font-bold uppercase" style={{ background: "rgba(255,31,61,.15)", color: C.flagRed }}>Verdetto per {s.targetName}</span>
            <div className="flex flex-1 flex-col gap-3">
              <button onClick={() => sendRfJudge("assolto")} disabled={answer !== null}
                className={`press flex flex-1 items-center justify-center px-4 py-6 text-center text-xl font-bold ${answer === "assolto" ? "bump" : ""}`}
                style={{ background: answer === "assolto" ? C.cream : C.lime, color: C.ink, opacity: answer !== null && answer !== "assolto" ? 0.25 : 1, boxShadow: answer !== null ? "none" : "5px 5px 0 rgba(0,0,0,.45)" }}>
                Assolto
              </button>
              <button onClick={() => sendRfJudge("redflag")} disabled={answer !== null}
                className={`press flex flex-1 items-center justify-center px-4 py-6 text-center text-xl font-bold ${answer === "redflag" ? "bump" : ""}`}
                style={{ background: answer === "redflag" ? C.cream : C.flagRed, color: C.cream, opacity: answer !== null && answer !== "redflag" ? 0.25 : 1, boxShadow: answer !== null ? "none" : "5px 5px 0 rgba(0,0,0,.45)" }}>
                🚩 Red Flag
              </button>
            </div>
            {answer && <p className="mt-2 text-center text-sm opacity-70">Giudizio espresso.</p>}
          </div>
        )
      )}

      {s?.phase === "rf-hotseatres" && (
        <div key={s.rid} className="tvin flex flex-1 flex-col justify-center text-center">
          <p className="text-xs uppercase tracking-widest opacity-60">{s.targetName}</p>
          <p className="my-2 text-3xl uppercase" style={{ ...display, color: s.verdict === "redflag" ? C.flagRed : C.lime }}>
            {s.verdict === "redflag" ? "🚩 Red Flag" : "Assolto"}
          </p>
          {s.target === id && mine && (
            <p className="mt-2 text-sm font-bold" style={{ color: mine.flag ? C.flagRed : C.lime }}>{mine.note}</p>
          )}
          <button onClick={sendReady} disabled={ready} className="press mt-6 w-full py-4 text-xl uppercase"
            style={{ ...display, background: ready ? "rgba(255,243,230,.12)" : C.flagRed, color: ready ? "rgba(255,243,230,.5)" : C.cream }}>
            {ready ? "Aspettando gli altri…" : "Avanti"}
          </button>
        </div>
      )}

      {s?.phase === "rf-bluff" && (
        s.target === id ? (
          <div className="tvin flex flex-1 flex-col">
            <span className="mb-3 inline-flex w-fit items-center gap-1 -rotate-1 px-3 py-1 text-xs font-bold uppercase" style={{ background: C.flagRed, color: C.cream }}>🎭 Bluff</span>
            <p className="mb-4 text-lg font-bold leading-snug">{s.card?.q}</p>
            <p className="mb-4 text-xs opacity-60">Scegli in segreto, poi rispondi a voce di conseguenza.</p>
            <div className="flex flex-1 flex-col gap-3">
              <button onClick={() => sendRfBluff("verita")} disabled={answer !== null}
                className={`press flex flex-1 items-center justify-center px-4 py-6 text-center text-xl font-bold ${answer === "verita" ? "bump" : ""}`}
                style={{ background: answer === "verita" ? C.cream : C.lime, color: C.ink, opacity: answer !== null && answer !== "verita" ? 0.25 : 1, boxShadow: answer !== null ? "none" : "5px 5px 0 rgba(0,0,0,.45)" }}>
                Dico la verità
              </button>
              <button onClick={() => sendRfBluff("bluff")} disabled={answer !== null}
                className={`press flex flex-1 items-center justify-center px-4 py-6 text-center text-xl font-bold ${answer === "bluff" ? "bump" : ""}`}
                style={{ background: answer === "bluff" ? C.cream : C.flagRed, color: C.cream, opacity: answer !== null && answer !== "bluff" ? 0.25 : 1, boxShadow: answer !== null ? "none" : "5px 5px 0 rgba(0,0,0,.45)" }}>
                Bluffo
              </button>
            </div>
            {answer && <p className="mt-2 text-center text-sm opacity-70">Deciso. Ora dillo al gruppo.</p>}
          </div>
        ) : (
          <div className="tvin flex flex-1 flex-col items-center justify-center text-center">
            <span className="mb-3 inline-flex w-fit items-center gap-1 -rotate-1 px-3 py-1 text-xs font-bold uppercase" style={{ background: "rgba(255,31,61,.15)", color: C.flagRed }}>🎭 Bluff</span>
            <p className="text-2xl font-bold" style={{ color: C.flagRed }}>{s.targetName}</p>
            <p className="mt-2 max-w-xs text-sm opacity-70">Sta decidendo sul suo telefono. Ascolta cosa dice a voce: dovrai giudicare.</p>
          </div>
        )
      )}

      {s?.phase === "rf-bluffvote" && (
        s.target === id ? (
          <div className="tvin flex flex-1 flex-col items-center justify-center text-center">
            <span className="mb-3 inline-flex w-fit items-center gap-1 -rotate-1 px-3 py-1 text-xs font-bold uppercase" style={{ background: "rgba(255,31,61,.15)", color: C.flagRed }}>Il gruppo giudica</span>
            <p className="mt-1 max-w-xs text-lg font-bold opacity-80">Non puoi votare su di te. Aspetta il verdetto.</p>
          </div>
        ) : (
          <div className="tvin flex flex-1 flex-col">
            <span className="mb-3 inline-flex w-fit items-center gap-1 -rotate-1 px-3 py-1 text-xs font-bold uppercase" style={{ background: "rgba(255,31,61,.15)", color: C.flagRed }}>Verità o bluff, per {s.targetName}?</span>
            <p className="mb-3 text-sm opacity-70">{s.card?.q}</p>
            <div className="flex flex-1 flex-col gap-3">
              <button onClick={() => sendRfBluffGuess("verita")} disabled={answer !== null}
                className={`press flex flex-1 items-center justify-center px-4 py-6 text-center text-xl font-bold ${answer === "verita" ? "bump" : ""}`}
                style={{ background: answer === "verita" ? C.cream : C.lime, color: C.ink, opacity: answer !== null && answer !== "verita" ? 0.25 : 1, boxShadow: answer !== null ? "none" : "5px 5px 0 rgba(0,0,0,.45)" }}>
                Vero
              </button>
              <button onClick={() => sendRfBluffGuess("bluff")} disabled={answer !== null}
                className={`press flex flex-1 items-center justify-center px-4 py-6 text-center text-xl font-bold ${answer === "bluff" ? "bump" : ""}`}
                style={{ background: answer === "bluff" ? C.cream : C.flagRed, color: C.cream, opacity: answer !== null && answer !== "bluff" ? 0.25 : 1, boxShadow: answer !== null ? "none" : "5px 5px 0 rgba(0,0,0,.45)" }}>
                Bluff
              </button>
            </div>
            {answer && <p className="mt-2 text-center text-sm opacity-70">Giudizio espresso.</p>}
          </div>
        )
      )}

      {s?.phase === "rf-bluffres" && (
        <div key={s.rid} className="tvin flex flex-1 flex-col justify-center text-center">
          <p className="text-xs uppercase tracking-widest opacity-60">{s.targetName}</p>
          <p className="my-2 text-3xl uppercase" style={{ ...display, color: s.bluffChoice === "bluff" ? C.flagRed : C.lime }}>
            {s.bluffChoice === "bluff" ? "Era un bluff" : "Era vero"}
          </p>
          {s.target === id && mine && (
            <p className="mt-2 text-sm font-bold" style={{ color: mine.flag ? C.flagRed : C.lime }}>{mine.note}</p>
          )}
          <button onClick={sendReady} disabled={ready} className="press mt-6 w-full py-4 text-xl uppercase"
            style={{ ...display, background: ready ? "rgba(255,243,230,.12)" : C.flagRed, color: ready ? "rgba(255,243,230,.5)" : C.cream }}>
            {ready ? "Aspettando gli altri…" : "Avanti"}
          </button>
        </div>
      )}

      {s?.phase === "rf-report" && (() => {
        const rank = [...(s.players || [])].sort((a, b) => (a.flags || 0) - (b.flags || 0));
        const pos = rank.findIndex((p) => p.id === id) + 1;
        const won = (s.titles || []).filter((t) => t.winnerId === id);
        const moments = [];
        if (me?.lastConfessione) moments.push(`«${me.lastConfessione.q}» — ${me.lastConfessione.confessed ? "hai confessato" : "hai passato"}.`);
        if (me?.lastHotseat) moments.push(`Hot Seat: verdetto ${me.lastHotseat.verdict === "redflag" ? "Red Flag" : "assolto"}, ${me.lastHotseat.passes} pass.`);
        if (me?.lastBluff) moments.push(`«${me.lastBluff.q}» — ${me.lastBluff.choice === "bluff" ? "hai bluffato" : "hai detto la verità"}, ${me.lastBluff.caught ? "e ti hanno beccato" : "e te la sei cavata"}.`);
        if (me?.votedAgainst) moments.push(`«${me.votedAgainst.q}» — ${me.votedAgainst.votes} voti contro di te.`);
        return (
          <div className="tvin flex flex-1 flex-col justify-center text-center">
            <p className="text-xs uppercase tracking-widest opacity-60">Il tuo Red Flag Report</p>
            <p className="pop glow my-2 text-5xl uppercase" style={{ ...display, color: C.flagRed }}>{me?.flags || 0} 🚩</p>
            <p className="text-sm opacity-75">{pos}° posto su {rank.length} · vince chi ne ha meno</p>
            {won.length > 0 && (
              <div className="mt-3 space-y-1">
                {won.map((t) => <p key={t.key} className="text-sm font-bold" style={{ color: C.gold }}>{t.emoji} {t.label}</p>)}
              </div>
            )}
            {moments.length > 0 && (
              <div className="mt-6 space-y-2 text-left">
                <p className="text-xs uppercase tracking-widest opacity-60">I tuoi momenti clou</p>
                {moments.map((m, i) => (
                  <p key={i} className="border-l-4 pl-3 text-sm" style={{ borderColor: C.flagRed }}>{m}</p>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {msg && <p className="mt-3 text-center text-xs" style={{ color: C.gold }}>{msg}</p>}
    </div>
  );
}
