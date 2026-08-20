/**
 * Simulazione della corsa cavalli: pura, senza DOM/React, così è testabile e
 * riusabile da un game loop unico (vedi HorseRace in App.jsx).
 *
 * Ogni cavallo ha uno stato interno (velocità, forma, resistenza) aggiornato
 * a step fissi: la velocità insegue un "target" con inerzia, mai un salto.
 * Il vincitore è già deciso da chi chiama questa funzione (la logica di
 * gioco, per quota — vedi resolve() in App.jsx): qui si costruisce solo una
 * corsa credibile che porta lì, correggendo con dolcezza nel tratto finale
 * se il vincitore non fosse già in testa.
 */

export const RACE_TICKS = 56;
/** Da che punto della gara (0..1) può scattare la correzione finale. */
const CORRECTION_FROM = 0.62;

function personality(rng, quota) {
  // quota bassa = favorito: un vantaggio medio nella velocità di base, ma
  // resta un dado vero — non decide la gara da solo.
  const favor = 1 / Math.sqrt(Math.max(1, quota));
  return {
    baseSpeed: 0.74 + favor * 0.2 + rng() * 0.22,
    stamina: 0.5 + rng() * 0.5,       // quanto regge nel finale
    consistency: 0.3 + rng() * 0.55,  // quanto è "liscio" il suo passo
    sprintChance: 0.25 + rng() * 0.4, // probabilità di uno scatto nel finale
    startQuality: 0.35 + rng() * 0.6, // quanto parte bene ai blocchi
  };
}

/**
 * @param {{nome:string, quota:number}[]} horses
 * @param {number} winnerIndex indice del cavallo che deve vincere
 * @param {() => number} rng generatore [0,1) — iniettabile per i test
 * @returns {{ frames: number[][], order: number[], events: {tick:number, type:string, horse:number}[] }}
 *   `frames[t][i]` è la posizione normalizzata (0..1) del cavallo `i` al tick `t`.
 */
export function simulateRace(horses, winnerIndex, rng = Math.random) {
  const n = horses.length;
  const stats = horses.map((h) => personality(rng, h.quota));
  const pos = new Array(n).fill(0);
  const vel = stats.map((s) => s.baseSpeed * (0.12 + s.startQuality * 0.3));
  const frames = [pos.slice()];
  const events = [];
  let lastLeader = -1;

  for (let t = 1; t <= RACE_TICKS; t++) {
    const phase = t / RACE_TICKS;
    for (let i = 0; i < n; i++) {
      const s = stats[i];
      const staminaFactor = phase < 0.7 ? 1 : 1 - (1 - s.stamina) * ((phase - 0.7) / 0.3) * 0.55;
      let target = s.baseSpeed * staminaFactor;
      if (phase > 0.72 && phase < 0.94 && rng() < s.sprintChance * 0.07) {
        target *= 1.4;
        events.push({ tick: t, type: "sprint", horse: i });
      }
      if (rng() < (1 - s.consistency) * 0.025) target *= 0.65; // un piccolo calo, mai uno stop secco
      // la velocità insegue il target con inerzia: mai un salto di colpo
      vel[i] += (target - vel[i]) * 0.16 + (rng() - 0.5) * 0.018 * (1 - s.consistency);
      vel[i] = Math.max(0.04, vel[i]);
      pos[i] += vel[i];
    }

    // correzione finale morbida: se il vincitore designato non è (ancora) in
    // testa, riceve una spinta proporzionale al distacco — mai un balzo, solo
    // qualche punto percentuale a step, sui tick che restano.
    if (phase >= CORRECTION_FROM) {
      const leadPos = Math.max(...pos);
      const gap = leadPos - pos[winnerIndex];
      if (gap > 0) {
        const remaining = Math.max(1, RACE_TICKS - t);
        const push = gap / remaining + gap * 0.12;
        vel[winnerIndex] += push;
        pos[winnerIndex] += push;
      }
    }

    const leader = pos.indexOf(Math.max(...pos));
    if (leader !== lastLeader && lastLeader !== -1 && phase > 0.15) {
      events.push({ tick: t, type: "sorpasso", horse: leader });
    }
    lastLeader = leader;

    frames.push(pos.slice());
  }

  // Garanzia: il vincitore designato deve essere davanti a tutti all'ultimo
  // tick. La correzione qui sopra ce la porta quasi sempre da sola; se resta
  // un residuo (corsa molto compatta), lo si assorbe sugli ultimi pochi tick
  // con una rampa smussata, mai su un solo frame.
  const finish = frames[frames.length - 1];
  const finishMax = Math.max(...finish);
  if (finish[winnerIndex] < finishMax) {
    const deficit = finishMax - finish[winnerIndex];
    const tailLen = Math.min(6, frames.length - 1);
    for (let k = 1; k <= tailLen; k++) {
      const idx = frames.length - 1 - tailLen + k;
      const eased = (k / tailLen) ** 2;
      frames[idx][winnerIndex] += deficit * eased;
    }
  }

  const finalPos = frames[frames.length - 1];
  const maxFinal = Math.max(...finalPos, 1e-6);
  const norm = frames.map((f) => f.map((p) => Math.min(1, Math.max(0, p / maxFinal))));

  const order = horses.map((_, i) => i).sort((a, b) => finalPos[b] - finalPos[a]);
  const photoFinish = order.length > 1 && (finalPos[order[0]] - finalPos[order[1]]) / maxFinal < 0.035;
  if (photoFinish) events.push({ tick: RACE_TICKS, type: "fotofinish", horse: order[0] });

  return { frames: norm, order, events, ticks: RACE_TICKS };
}
