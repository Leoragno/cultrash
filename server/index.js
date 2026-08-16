/**
 * Server di sincronizzazione di CULTRASH.
 *
 * È volutamente minimo: uno spazio chiave/valore in memoria con scadenza,
 * più i file statici della build. Nessun database, nessun account: le
 * partite durano una serata e non c'è niente da conservare.
 *
 * Avvio:  node server/index.js       (porta 8787, override con PORT)
 */

import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 8787;

/* --- deposito in memoria ------------------------------------------------ */

const TTL_MS = 1000 * 60 * 60 * 6;   // una stanza scade dopo sei ore
const MAX_CHIAVI = 5000;             // tetto di sicurezza
const MAX_VALORE = 256 * 1024;       // 256 KB per chiave, più che sufficiente

/** @type {Map<string, {valore: string, scade: number}>} */
const deposito = new Map();

function pulisci() {
  const ora = Date.now();
  for (const [k, v] of deposito) if (v.scade < ora) deposito.delete(k);
}
setInterval(pulisci, 1000 * 60 * 10).unref?.();

/* --- limite di frequenza molto semplice --------------------------------- */

const finestre = new Map(); // ip -> {conteggio, riparte}
const LIMITE = 600;         // richieste al minuto per IP: il polling ne fa ~40
const FINESTRA = 60 * 1000;

function limita(req, res, next) {
  const ip = req.ip || "sconosciuto";
  const ora = Date.now();
  const f = finestre.get(ip);
  if (!f || f.riparte < ora) {
    finestre.set(ip, { conteggio: 1, riparte: ora + FINESTRA });
    return next();
  }
  if (++f.conteggio > LIMITE) return res.status(429).json({ errore: "troppe richieste" });
  next();
}

/* --- API ---------------------------------------------------------------- */

app.use(express.json({ limit: "512kb" }));
app.use("/api", limita);

// Elenco delle chiavi con un certo prefisso (serve per scoprire i giocatori).
app.get("/api/kv", (req, res) => {
  pulisci();
  const prefix = String(req.query.prefix || "");
  const keys = [...deposito.keys()].filter((k) => k.startsWith(prefix));
  res.json({ keys });
});

app.get("/api/kv/:key", (req, res) => {
  const v = deposito.get(req.params.key);
  if (!v || v.scade < Date.now()) return res.json({ value: null });
  res.json({ value: v.valore });
});

app.put("/api/kv/:key", (req, res) => {
  const { value } = req.body ?? {};
  if (typeof value !== "string") return res.status(400).json({ errore: "value deve essere una stringa" });
  if (value.length > MAX_VALORE) return res.status(413).json({ errore: "valore troppo grande" });
  if (!deposito.has(req.params.key) && deposito.size >= MAX_CHIAVI) {
    pulisci();
    if (deposito.size >= MAX_CHIAVI) return res.status(507).json({ errore: "spazio esaurito" });
  }
  deposito.set(req.params.key, { valore: value, scade: Date.now() + TTL_MS });
  res.json({ ok: true });
});

app.delete("/api/kv/:key", (req, res) => {
  deposito.delete(req.params.key);
  res.json({ ok: true });
});

app.get("/api/salute", (req, res) => res.json({ ok: true, chiavi: deposito.size }));

/* --- file statici della build ------------------------------------------- */

const dist = path.join(__dirname, "..", "dist");
app.use(express.static(dist));
app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(dist, "index.html")));

app.listen(PORT, () => {
  console.log(`CULTRASH in ascolto su http://localhost:${PORT}`);
});
