/**
 * Client dello spazio condiviso servito da server/index.js.
 *
 * Il gioco fa polling ogni 1,3-1,6 secondi: le chiamate sono piccole e
 * il server tiene tutto in memoria, quindi regge tranquillamente una
 * manciata di stanze contemporanee.
 *
 * In sviluppo il proxy di Vite gira /api sul server locale (porta 8787);
 * in produzione il server serve anche i file statici, quindi l'origine
 * è la stessa e non serve configurare nulla.
 */

const BASE = import.meta.env.VITE_API_URL || "/api";

async function chiama(path, opts = {}) {
  const r = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!r.ok) throw new Error(`sync ${r.status}`);
  return r.json();
}

export const restStorage = {
  available: true,

  async get(key) {
    // Coerente con lo storage degli artifact: la chiave assente solleva.
    const d = await chiama(`/kv/${encodeURIComponent(key)}`);
    if (d.value == null) throw new Error("chiave assente");
    return { key, value: d.value, shared: true };
  },

  async set(key, value) {
    await chiama(`/kv/${encodeURIComponent(key)}`, {
      method: "PUT",
      body: JSON.stringify({ value }),
    });
    return { key, value, shared: true };
  },

  async delete(key) {
    await chiama(`/kv/${encodeURIComponent(key)}`, { method: "DELETE" });
    return { key, deleted: true, shared: true };
  },

  async list(prefix = "") {
    const d = await chiama(`/kv?prefix=${encodeURIComponent(prefix)}`);
    return { keys: d.keys || [], prefix, shared: true };
  },
};
