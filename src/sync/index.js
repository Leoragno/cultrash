/**
 * Adattatore di sincronizzazione.
 *
 * Il gioco ha bisogno di uno spazio chiave/valore condiviso fra lo schermo
 * grande e i telefoni. Qui dentro decidiamo quale implementazione usare:
 *
 *  - "rest"  → il server incluso in server/index.js (multi-dispositivo, è
 *              quello che serve per giocare davvero)
 *  - "local" → localStorage + BroadcastChannel: funziona solo fra schede
 *              dello stesso browser, comodo per sviluppare da soli
 *
 * L'interfaccia è volutamente identica a quella dello storage degli
 * artifact Claude, così il codice di gioco resta invariato:
 *   get(key, shared) / set(key, value, shared) / list(prefix, shared) / delete(key, shared)
 */

import { restStorage } from "./rest";
import { localStorageSync } from "./local";

const modo = (import.meta.env.VITE_SYNC || "rest").toLowerCase();

export const storage = modo === "local" ? localStorageSync : restStorage;
export const modoSync = modo;
