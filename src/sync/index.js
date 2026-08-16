/**
 * Adattatore di sincronizzazione.
 *
 * Il gioco ha bisogno di uno spazio chiave/valore condiviso fra lo schermo
 * grande e i telefoni. Qui dentro decidiamo quale implementazione usare:
 *
 *  - "appwrite" → Appwrite Database (vedi ./appwrite.js): niente server da
 *                 avviare, il browser scrive/legge direttamente su Appwrite
 *  - "rest"     → il server incluso in server/index.js (multi-dispositivo,
 *                 utile in locale o senza un progetto Appwrite configurato)
 *  - "local"    → localStorage + BroadcastChannel: funziona solo fra schede
 *                 dello stesso browser, comodo per sviluppare da soli
 *
 * L'interfaccia è volutamente identica a quella dello storage degli
 * artifact Claude, così il codice di gioco resta invariato:
 *   get(key, shared) / set(key, value, shared) / list(prefix, shared) / delete(key, shared)
 */

import { restStorage } from "./rest";
import { localStorageSync } from "./local";
import { appwriteStorage } from "./appwrite";

const modo = (import.meta.env.VITE_SYNC || "rest").toLowerCase();

const BACKEND = { local: localStorageSync, appwrite: appwriteStorage, rest: restStorage };

export const storage = BACKEND[modo] ?? restStorage;
export const modoSync = modo;
