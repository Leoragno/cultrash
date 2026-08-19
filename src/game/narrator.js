/**
 * Voce del presentatore via Web Speech API: nessun file audio da scaricare,
 * solo sintesi vocale del browser. Parla soltanto sullo schermo host — i
 * telefoni restano muti, stessa scelta già fatta per gli effetti sonori
 * (vedi sound.js).
 */

let cachedVoice = null;
let muted = false;

function supported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Tra le voci italiane preferisce quelle "di rete" (es. Google italiano):
 *  suonano naturali, mentre le voci offline del sistema (es. Microsoft
 *  Cosimo/Elsa su Windows) sono meccaniche e vanno usate solo come ultima
 *  spiaggia se il dispositivo non ha altro. */
function pickVoice() {
  if (!supported()) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const it = voices.filter((v) => v.lang?.toLowerCase().startsWith("it"));
  return it.find((v) => !v.localService) || it[0] || voices.find((v) => !v.localService) || voices[0];
}

if (supported()) {
  cachedVoice = pickVoice();
  window.speechSynthesis.onvoiceschanged = () => { cachedVoice = pickVoice(); };
}

export function isNarratorSupported() { return supported(); }
export function setNarratorMuted(v) { muted = v; if (v) stopNarration(); }

/**
 * Fa parlare il presentatore. Richiama onStart/onEnd per sincronizzare
 * un'animazione (bocca che si muove finché dura la frase). Se la sintesi
 * non è disponibile, muta o la frase è vuota, chiama subito onEnd.
 */
export function narrate(text, { onStart, onEnd } = {}) {
  if (!supported() || muted || !text) { onEnd?.(); return () => {}; }
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "it-IT";
  u.rate = 1;
  u.pitch = 1;
  if (!cachedVoice) cachedVoice = pickVoice();
  if (cachedVoice) u.voice = cachedVoice;
  let ended = false;
  const end = () => { if (!ended) { ended = true; onEnd?.(); } };
  u.onstart = () => onStart?.();
  u.onend = end;
  u.onerror = end;
  const speakNow = () => { try { window.speechSynthesis.speak(u); } catch (_) { end(); } };
  // cancel() e speak() nello stesso tick fanno perdere la frase in Chrome:
  // un giro di event loop di margine basta a farla partire per davvero.
  if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
    window.speechSynthesis.cancel();
    setTimeout(speakNow, 50);
  } else {
    speakNow();
  }
  return () => window.speechSynthesis.cancel();
}

export function stopNarration() {
  if (supported()) window.speechSynthesis.cancel();
}
