/**
 * Backend di sincronizzazione su Appwrite Database.
 *
 * Stessa interfaccia REST (get/set/delete/list), ma niente server Express
 * da avviare: il browser parla direttamente con Appwrite. Ogni chiave dello
 * spazio condiviso diventa un documento nella collection `kv`, con `key`
 * come attributo indicizzato (univoco) e `expiresAt` per scartare le
 * stanze vecchie — Appwrite non ha una TTL nativa sui documenti, quindi la
 * scadenza è applicata qui in lettura, come faceva `server/index.js`.
 */

import { Client, Databases, ID, Query } from "appwrite";

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

async function trova(key) {
  const r = await databases.listDocuments(DB, COLLECTION, [Query.equal("key", key), Query.limit(1)]);
  return r.documents[0] ?? null;
}

export const appwriteStorage = {
  available: Boolean(import.meta.env.VITE_APPWRITE_PROJECT_ID),

  async get(key) {
    const doc = await trova(key);
    if (scaduto(doc)) throw new Error("chiave assente");
    return { key, value: doc.value, shared: true };
  },

  async set(key, value) {
    const expiresAt = new Date(Date.now() + TTL_MS).toISOString();
    const esistente = await trova(key);
    if (esistente) {
      await databases.updateDocument(DB, COLLECTION, esistente.$id, { value, expiresAt });
    } else {
      await databases.createDocument(DB, COLLECTION, ID.unique(), { key, value, expiresAt });
    }
    return { key, value, shared: true };
  },

  async delete(key) {
    const esistente = await trova(key);
    if (esistente) await databases.deleteDocument(DB, COLLECTION, esistente.$id);
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
