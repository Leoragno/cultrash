/**
 * Motore audio sintetizzato via Web Audio API: nessun file da scaricare,
 * solo oscillatori/rumore generati al volo. Pensato per lo schermo
 * principale (host): i telefoni restano muti, come da scelta del gioco.
 *
 * Il primo suono crea l'AudioContext — i browser lo permettono solo dopo
 * un gesto dell'utente (un tap/click), che sullo schermo host avviene
 * sempre prima che serva un suono (aprire la stanza, cliccare Avanti...).
 */

let ctx = null;
let muted = false;

function getCtx() {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

export function setMuted(v) { muted = v; }
export function isMuted() { return muted; }

function envGain(c, gain, t0, dur, attack = 0.005, release) {
  const g = c.createGain();
  const rel = release ?? dur * 0.6;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + attack);
  g.gain.setValueAtTime(gain, Math.max(t0 + attack, t0 + dur - rel));
  g.gain.linearRampToValueAtTime(0, t0 + dur);
  return g;
}

/** Un singolo tono, con eventuale glissando in frequenza. */
function tone({ freq = 440, to, duration = 0.15, type = "sine", gain = 0.18, delay = 0 }) {
  const c = getCtx();
  if (!c || muted) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + duration);
  const g = envGain(c, gain, t0, duration);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

/** Rumore bianco filtrato: per drumroll, sweep, applausi. */
function noise({ duration = 0.3, gain = 0.15, delay = 0, filterFreq = 1200, filterType = "bandpass" }) {
  const c = getCtx();
  if (!c || muted) return;
  const t0 = c.currentTime + delay;
  const n = Math.floor(c.sampleRate * duration);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const filt = c.createBiquadFilter();
  filt.type = filterType;
  filt.frequency.value = filterFreq;
  const g = envGain(c, gain, t0, duration, 0.01);
  src.connect(filt).connect(g).connect(c.destination);
  src.start(t0);
}

/** Sequenza di note, una dopo l'altra: per fanfare e arpeggi. */
function melody(notes, { type = "triangle", gain = 0.16, step = 0.09, noteDur = 0.16 } = {}) {
  notes.forEach((freq, i) => tone({ freq, type, gain, duration: noteDur, delay: i * step }));
}

export const sfx = {
  /** Tick del timer, ultimi secondi. */
  tick: () => tone({ freq: 1046, duration: 0.06, type: "square", gain: 0.1 }),
  /** Ultimo secondo, più grave e urgente. */
  tock: () => tone({ freq: 622, duration: 0.12, type: "square", gain: 0.16 }),
  /** Tap generico (avanti, apri stanza...). */
  select: () => tone({ freq: 740, duration: 0.05, type: "sine", gain: 0.1 }),
  /** Nuova domanda / cambio fase. */
  whoosh: () => noise({ duration: 0.28, gain: 0.1, filterFreq: 2200, filterType: "highpass" }),
  /** Risposta giusta. */
  correct: () => melody([523, 659, 784], { type: "triangle", gain: 0.18, step: 0.07, noteDur: 0.14 }),
  /** Risposta sbagliata / tempo scaduto. */
  wrong: () => { tone({ freq: 220, to: 110, duration: 0.32, type: "sawtooth", gain: 0.16 }); },
  /** Estrazione azzardo: dadi/ruota/carte. */
  drumroll: () => { for (let i = 0; i < 10; i++) noise({ duration: 0.06, gain: 0.09, delay: i * 0.075, filterFreq: 900 }); },
  /** Rivelazione esito (numero, cavallo, casella...). */
  reveal: () => melody([392, 523, 659, 880], { type: "square", gain: 0.15, step: 0.05, noteDur: 0.1 }),
  /** Un giocatore entra in stanza. */
  join: () => tone({ freq: 660, to: 990, duration: 0.12, type: "sine", gain: 0.1 }),
  /** Stanza aperta / partita al via. */
  start: () => melody([440, 554, 659, 880], { type: "sine", gain: 0.14, step: 0.06, noteDur: 0.12 }),
  /** Fanfara podio finale. */
  podium: () => {
    melody([523, 523, 659, 784, 1046], { type: "triangle", gain: 0.2, step: 0.11, noteDur: 0.22 });
    noise({ duration: 0.6, gain: 0.05, delay: 0.05, filterFreq: 4000, filterType: "highpass" });
  },
  /** Puzzle risolto. */
  win: () => melody([659, 784, 988, 1318], { type: "triangle", gain: 0.18, step: 0.08, noteDur: 0.16 }),

  /** Red Flag: battito sordo di tensione, sul countdown del giudizio. */
  rfPulse: () => tone({ freq: 90, duration: 0.16, type: "sine", gain: 0.14 }),
  /** Red Flag: rullo più cupo e lungo prima del verdetto. */
  rfDrumroll: () => {
    for (let i = 0; i < 14; i++) noise({ duration: 0.07, gain: 0.1 + i * 0.006, delay: i * 0.09, filterFreq: 700 });
    tone({ freq: 70, duration: 0.4, type: "sine", gain: 0.2, delay: 1.25 });
  },
  /** Red Flag: sting cupo sul verdetto "red flag". */
  rfGuilty: () => {
    tone({ freq: 220, to: 80, duration: 0.5, type: "sawtooth", gain: 0.22 });
    noise({ duration: 0.35, gain: 0.12, filterFreq: 300, filterType: "lowpass" });
  },
  /** Red Flag: campanello luminoso sul verdetto "assolto". */
  rfInnocent: () => melody([784, 988, 1318], { type: "sine", gain: 0.18, step: 0.08, noteDur: 0.18 }),

  /** Corsa cavalli: segnale di partenza ai blocchi (un accordo che sale, niente sparo). */
  raceStart: () => melody([392, 523, 659], { type: "square", gain: 0.17, step: 0.05, noteDur: 0.1 }),
  /** Corsa cavalli: singolo zoccolo, richiamato a cadenza dal game loop. */
  hoofbeat: () => noise({ duration: 0.05, gain: 0.06, filterFreq: 220, filterType: "lowpass" }),
  /** Roulette: un singolo "tick" della ruota o rimbalzo della pallina; chi
   *  chiama decide il ritmo (si dirada avvicinandosi all'arresto). */
  wheelTick: () => noise({ duration: 0.03, gain: 0.07, filterFreq: 2600, filterType: "highpass" }),
  /** Roulette: rimbalzo della pallina, più acuto e secco del tick della ruota. */
  ballBounce: () => tone({ freq: 1500, to: 950, duration: 0.045, type: "triangle", gain: 0.15 }),
};
