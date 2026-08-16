/**
 * Backend di sviluppo: localStorage come deposito, BroadcastChannel per
 * svegliare le altre schede. Serve per provare host e telefoni aprendo
 * più finestre dello stesso browser, senza far girare il server.
 *
 * NON funziona fra dispositivi diversi: per quello serve il backend REST.
 */

const PREFISSO = "cultrash-sync:";
const canale = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("cultrash") : null;

const disponibile = typeof localStorage !== "undefined";

export const localStorageSync = {
  available: disponibile,

  async get(key) {
    const v = disponibile ? localStorage.getItem(PREFISSO + key) : null;
    if (v == null) throw new Error("chiave assente");
    return { key, value: v, shared: true };
  },

  async set(key, value) {
    localStorage.setItem(PREFISSO + key, value);
    canale?.postMessage({ key });
    return { key, value, shared: true };
  },

  async delete(key) {
    localStorage.removeItem(PREFISSO + key);
    canale?.postMessage({ key });
    return { key, deleted: true, shared: true };
  },

  async list(prefix = "") {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFISSO + prefix)) keys.push(k.slice(PREFISSO.length));
    }
    return { keys, prefix, shared: true };
  },
};
