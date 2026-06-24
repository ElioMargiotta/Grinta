/**
 * Génération du CSV d'import « Contrôle des présences (CdP) » pour la BDNS
 * (Banque de données nationale du sport, J+S / OFSPO) — issue #59.
 *
 * Le fichier attendu :
 *  - séparateur `;`, fin de ligne CRLF
 *  - encodage Latin (windows-1252) — comme les exports/templates BDNS & ClubCorner
 *  - dates `DD.MM.YYYY`, heures `HH:MM`, durée en minutes
 *
 * L'EN-TÊTE est reproduit VERBATIM du template d'import fourni par la BDNS
 * (fautes comprises : « PERSONELL », « ACHTIVITÉ »). Le PDF officiel utilise
 * l'orthographe correcte ; en cas de rejet à l'import, basculer sur celle-ci.
 */

export const BDNS_HEADER =
  "NUMÉRO PERSONELL;FONCTION;DATE;TYPE D'ACHTIVITÉ;HEURE;DURÉE;LIEU";

/** Durées (minutes) admises par J+S (football, GU2/GU5). Hors set ⇒ avertissement. */
export const JS_ALLOWED_DURATIONS = [45, 60, 75, 90, 120, 150, 180, 210, 240, 270, 300];

export type BdnsFunction = "Participant/e" | "moniteur/trice";
export type BdnsActivity = "Entraînement" | "compétition";

export type BdnsRow = {
  /** N° de personne J+S. */
  personalNumber: string;
  fonction: BdnsFunction;
  /** ISO `YYYY-MM-DD`. */
  dateIso: string;
  type: BdnsActivity;
  /** `HH:MM` ou vide. */
  heure: string;
  /** Durée en minutes, ou null. */
  duree: number | null;
  /** Lieu ou vide. */
  lieu: string;
};

/** `YYYY-MM-DD` → `DD.MM.YYYY`. */
export function toBdnsDate(iso: string): string {
  const m = iso.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

/** Échappe un champ CSV si nécessaire (séparateur `;`, guillemets, retours ligne). */
function csvField(value: string): string {
  if (/[;"\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Assemble le texte CSV (en-tête + lignes), CRLF. */
export function buildBdnsCsv(rows: BdnsRow[]): string {
  const lines = rows.map((r) =>
    [
      r.personalNumber,
      r.fonction,
      toBdnsDate(r.dateIso),
      r.type,
      r.heure,
      r.duree != null ? String(r.duree) : "",
      r.lieu,
    ]
      .map(csvField)
      .join(";"),
  );
  return [BDNS_HEADER, ...lines].join("\r\n") + "\r\n";
}

/**
 * Encode une chaîne en octets windows-1252 / Latin-1 (les 256 premiers points
 * de code coïncident ; suffisant pour `Entraînement`, accents FR). Les rares
 * caractères hors plage retombent sur `?`. Retourne du base64 (transport
 * server → client) — `TextEncoder` ne sait produire que de l'UTF-8.
 */
export function latin1Base64(text: string): string {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    bytes[i] = code <= 0xff ? code : 0x3f; // '?'
  }
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return typeof btoa === "function"
    ? btoa(binary)
    : Buffer.from(bytes).toString("base64");
}
