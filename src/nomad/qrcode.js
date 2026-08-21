/**
 * Wrapper minimo sulla libreria `qrcode` (unica dipendenza nuova aggiunta
 * per NOMAD, richiesta esplicitamente dal codice-stanza condivisibile via
 * QR): produce solo la matrice di moduli, il disegno SVG resta a chi la usa
 * — così i colori seguono l'identità visiva di CULTRASH invece del solito
 * bianco e nero, restando comunque ad alto contrasto per la fotocamera.
 */
import QRCode from "qrcode";

/** @returns {{ path: string, size: number, margin: number }} un singolo
 *  `<path>` con tutti i moduli scuri (un rect per modulo, unione via path
 *  invece di un <rect> per modulo: molto più leggero nel DOM). */
export function qrPath(text, { margin = 2 } = {}) {
  const q = QRCode.create(text, { errorCorrectionLevel: "M" });
  const n = q.modules.size;
  let d = "";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (q.modules.get(r, c)) d += `M${c},${r}h1v1h-1z`;
    }
  }
  return { path: d, size: n, margin };
}
