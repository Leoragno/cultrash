/**
 * Backend di sincronizzazione su Appwrite Database.
 *
 * Stessa interfaccia REST (get/set/delete/list), ma niente server Express
 * da avviare: il browser parla direttamente con Appwrite. Ogni chiave dello
 * spazio condiviso diventa un documento nella collection `kv`, con `key`
 * come attributo indicizzato (univoco) e `expiresAt` per scartare le
 * stanze vecchie — Appwrite non ha una TTL nativa sui documenti, quindi la
 * scadenza è applicata qui in lettura, come faceva `server/index.js`.
 *
 * L'id del documento è derivato deterministicamente dalla chiave (vedi
 * `docId`), invece di cercarla con una query prima di ogni lettura/scrittura:
 * get/set diventano una sola chiamata diretta (getDocument/upsertDocument)
 * anziché due, ed è impossibile che due scritture concorrenti sulla stessa
 * chiave creino due documenti diversi (prima poteva succedere: la ricerca
 * per query non è atomica, e con l'indice unique su `key` la seconda
 * scrittura falliva con un conflitto invece di aggiornare quella giusta).
 */

import { Client, Databases, Query } from "appwrite";

const TTL_MS = 1000 * 60 * 60 * 6; // una stanza scade dopo sei ore, come il vecchio server

const DB = import.meta.env.VITE_APPWRITE_DATABASE_ID || "cultrash";
const COLLECTION = import.meta.env.VITE_APPWRITE_COLLECTION_ID || "kv";

const client = new Client()
  .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT)
  .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID);

const databases = new Databases(client);

function scaduto(doc) {
  return !doc || new Date(doc.expiresAt).getTime() < Date.now();
}

/** Chiave logica -> id documento Appwrite: solo [a-z0-9], lunghezza fissa. */
function docId(key) {
  let h1 = 0x811c9dc5, h2 = 0x1000193;
  for (let i = 0; i < key.length; i++) {
    const c = key.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 + c, 2654435761) >>> 0;
  }
  return "k" + h1.toString(36) + h2.toString(36);
}

export const appwriteStorage = {
  available: Boolean(import.meta.env.VITE_APPWRITE_PROJECT_ID),

  async get(key) {
    const doc = await databases.getDocument(DB, COLLECTION, docId(key));
    if (scaduto(doc)) throw new Error("chiave assente");
    return { key, value: doc.value, shared: true };
  },

  async set(key, value) {
    const expiresAt = new Date(Date.now() + TTL_MS).toISOString();
    await databases.upsertDocument(DB, COLLECTION, docId(key), { key, value, expiresAt });
    return { key, value, shared: true };
  },

  async delete(key) {
    try { await databases.deleteDocument(DB, COLLECTION, docId(key)); } catch (_) {}
    return { key, deleted: true, shared: true };
  },

  async list(prefix = "") {
    const r = await databases.listDocuments(DB, COLLECTION, [
      Query.startsWith("key", prefix),
      Query.limit(200),
    ]);
    const ora = Date.now();
    const keys = r.documents.filter((d) => new Date(d.expiresAt).getTime() >= ora).map((d) => d.key);
    return { keys, prefix, shared: true };
  },
};
