/**
 * Parser & normaliseur du CSV export ClubCorner (contingent / liste de
 * joueurs). Format constaté :
 *  - séparateur `;`
 *  - encodage ISO-8859-15 / windows-1252 (Latin)
 *  - champs vides notés `""`
 *  - dates `DD.MM.YYYY`
 *
 * Réutilisé côté client (preview du wizard) et côté server action
 * (source de vérité de l'import).
 */

export type ClubCornerPlayer = {
  first_name: string;
  last_name: string;
  birth_date: string | null; // ISO YYYY-MM-DD
  position: string | null;
  jersey_number: number | null;
  strong_foot: "left" | "right" | "both" | null;
  license_number: string | null; // CSV "Numéro de passeport"
  js_number: string | null;
  email: string | null;
  phone: string | null;
  nationality: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  canton: string | null;
  guardian_name: string | null;
  guardian_email: string | null;
  guardian_phone: string | null;
  guardian2_name: string | null;
  guardian2_email: string | null;
  guardian2_phone: string | null;
};

export type ParsedRow = {
  rowIndex: number; // 1-based, excluding header
  player: ClubCornerPlayer;
  errors: string[];
};

export type ParseResult = {
  headers: string[];
  rows: ParsedRow[];
  /** Rejet global (mauvais format, en-tête absente, …) */
  fatalError: string | null;
};

const REQUIRED_HEADERS = ["Nom", "Prénom"];

/**
 * Tokenize a single CSV line — supports `"` quoting and `""` escaped quotes.
 * The export does not embed newlines in fields, so a line-based parser is OK.
 */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ";") {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  return out;
}

function trimOrNull(v: string | undefined): string | null {
  if (v === undefined) return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

function parseDate(v: string | undefined): string | null {
  const t = trimOrNull(v);
  if (!t) return null;
  // Accept DD.MM.YYYY (ClubCorner) or already-ISO YYYY-MM-DD
  const dotMatch = t.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (dotMatch) return `${dotMatch[3]}-${dotMatch[2]}-${dotMatch[1]}`;
  const isoMatch = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return t;
  return null;
}

function parseJersey(v: string | undefined): number | null {
  const t = trimOrNull(v);
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 && n < 1000 ? Math.trunc(n) : null;
}

function parseStrongFoot(
  v: string | undefined,
): "left" | "right" | "both" | null {
  const t = trimOrNull(v)?.toLowerCase();
  if (!t) return null;
  if (["gauche", "left", "links", "sinistro"].includes(t)) return "left";
  if (["droite", "right", "rechts", "destro"].includes(t)) return "right";
  if (["les deux", "both", "beide", "entrambi", "ambidextre"].includes(t)) {
    return "both";
  }
  return null;
}

/**
 * Decode a CSV file buffer. Tries UTF-8 (with BOM detection); falls back to
 * windows-1252 (which is what ClubCorner exports by default for Latin).
 */
export function decodeCsv(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  // UTF-8 BOM
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(bytes.subarray(3));
  }
  // Try strict UTF-8 first; on failure fall back to windows-1252.
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

export function parseClubCornerCsv(text: string): ParseResult {
  const lines = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [], fatalError: "Empty file" };
  }

  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  const missing = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
  if (missing.length > 0) {
    return {
      headers,
      rows: [],
      fatalError: `Missing columns: ${missing.join(", ")}`,
    };
  }

  const idx = (name: string): number => headers.indexOf(name);
  const col = {
    last_name: idx("Nom"),
    first_name: idx("Prénom"),
    birth_date: idx("Date de naissance"),
    position: idx("Position durant le match"),
    jersey: idx("Numéro du maillot"),
    foot: idx("Meilleur pied"),
    license: idx("Numéro de passeport"),
    js: idx("Numéro J+S"),
    email: idx("Courriel privé"),
    phone: idx("Téléphone portable"),
    nationality: idx("Pays"),
    address: idx("Adresse"),
    postal: idx("Code postal"),
    city: idx("Lieu"),
    canton: idx("Canton"),
    guardian: idx("Nom/prénom représentant légal"),
    guardian_email: idx("E-Mail parents"),
    guardian_phone: idx("Tél. portable représentant légal"),
    guardian2: idx("Nom/prénom représentant légal 2"),
    guardian2_email: idx("E-Mail parents 2"),
    guardian2_phone: idx("Tél. portable représentant légal 2"),
  };

  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const get = (k: keyof typeof col) =>
      col[k] >= 0 ? cells[col[k]] : undefined;

    const firstName = trimOrNull(get("first_name"));
    const lastName = trimOrNull(get("last_name"));
    const errors: string[] = [];
    if (!firstName) errors.push("missing_first_name");
    if (!lastName) errors.push("missing_last_name");

    const birth_date = parseDate(get("birth_date"));
    if (get("birth_date") && !birth_date) errors.push("invalid_birth_date");

    const player: ClubCornerPlayer = {
      first_name: firstName ?? "",
      last_name: lastName ?? "",
      birth_date,
      position: trimOrNull(get("position")),
      jersey_number: parseJersey(get("jersey")),
      strong_foot: parseStrongFoot(get("foot")),
      license_number: trimOrNull(get("license")),
      js_number: trimOrNull(get("js")),
      email: trimOrNull(get("email")),
      phone: trimOrNull(get("phone")),
      nationality: trimOrNull(get("nationality")),
      address: trimOrNull(get("address")),
      postal_code: trimOrNull(get("postal")),
      city: trimOrNull(get("city")),
      canton: trimOrNull(get("canton")),
      guardian_name: trimOrNull(get("guardian")),
      guardian_email: trimOrNull(get("guardian_email")),
      guardian_phone: trimOrNull(get("guardian_phone")),
      guardian2_name: trimOrNull(get("guardian2")),
      guardian2_email: trimOrNull(get("guardian2_email")),
      guardian2_phone: trimOrNull(get("guardian2_phone")),
    };

    rows.push({ rowIndex: i, player, errors });
  }

  return { headers, rows, fatalError: null };
}
