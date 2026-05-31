/**
 * Parseur ICS minimal (RFC 5545) — pensé pour les calendriers football.ch
 * (matchs officiels d'une équipe). On extrait uniquement ce dont l'app a
 * besoin pour `team_matches` : UID, début/fin, résumé, lieu, description,
 * et l'URL matchcenter quand on la trouve dans le DESCRIPTION.
 *
 * Limitations conscientes :
 *   - On supporte les TZID custom (ex: `TZsfv` chez football.ch) via le
 *     VTIMEZONE → X-LIC-LOCATION qui pointe vers une IANA (Europe/Amsterdam,
 *     Europe/Zurich…). Pour un VTIMEZONE sans X-LIC-LOCATION, on tente le
 *     TZID brut comme nom IANA puis on tombe sur UTC en dernier recours.
 *   - Pas de support des RRULE (récurrences). football.ch émet 1 VEVENT par
 *     match donc on n'en a pas besoin.
 *   - Pas de support des VALUE=DATE (toute la journée) — un match a toujours
 *     une heure. On l'accepte malgré tout en supposant 00:00 si jamais.
 */

export type ParsedEvent = {
  uid: string;
  startsAt: Date;
  endsAt: Date | null;
  summary: string | null;
  location: string | null;
  description: string | null;
  matchUrl: string | null;
};

export type ParseResult = {
  events: ParsedEvent[];
  /** Nom du calendrier (X-WR-CALNAME) si présent. */
  calendarName: string | null;
};

type Line = { name: string; params: Record<string, string>; value: string };

const TZID_TO_IANA: Record<string, string> = {};

function unfold(text: string): string[] {
  // RFC 5545 §3.1 : lignes "pliées" — un CRLF suivi d'espace ou tab fait
  // partie de la ligne précédente. On normalise aussi LF nu (export Windows
  // ↔ Unix).
  const normalized = text.replace(/\r\n/g, "\n");
  const out: string[] = [];
  for (const raw of normalized.split("\n")) {
    if (raw.startsWith(" ") || raw.startsWith("\t")) {
      if (out.length > 0) out[out.length - 1] += raw.slice(1);
    } else {
      out.push(raw);
    }
  }
  return out.filter((l) => l.length > 0);
}

function parseLine(raw: string): Line | null {
  const colonIdx = raw.indexOf(":");
  if (colonIdx === -1) return null;
  const left = raw.slice(0, colonIdx);
  const value = raw.slice(colonIdx + 1);
  const segs = left.split(";");
  const name = segs[0].toUpperCase();
  const params: Record<string, string> = {};
  for (let i = 1; i < segs.length; i++) {
    const eq = segs[i].indexOf("=");
    if (eq === -1) continue;
    params[segs[i].slice(0, eq).toUpperCase()] = segs[i].slice(eq + 1);
  }
  return { name, params, value };
}

function unescapeText(value: string): string {
  // RFC 5545 §3.3.11 — séquences d'échappement dans les TEXT.
  let out = "";
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (c === "\\" && i + 1 < value.length) {
      const next = value[i + 1];
      if (next === "n" || next === "N") out += "\n";
      else if (next === "," || next === ";" || next === "\\") out += next;
      else out += next;
      i++;
    } else {
      out += c;
    }
  }
  return out;
}

/**
 * Convertit `YYYY-MM-DDTHH:MM:SS` exprimé dans la TZ IANA donnée vers un
 * instant UTC. Approche standard : on traite d'abord le quintuplet comme
 * si c'était de l'UTC, on demande à `Intl` ce que cet instant affiche dans
 * la TZ cible, et on déduit l'offset à appliquer.
 */
function localToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  tz: string,
): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute, second);
  let offsetMs: number;
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const parts = dtf.formatToParts(new Date(naive));
    const get = (t: string): number => {
      const p = parts.find((x) => x.type === t);
      return p ? Number(p.value) : 0;
    };
    let tzHour = get("hour");
    if (tzHour === 24) tzHour = 0; // certains navigateurs renvoient 24
    const tzMoment = Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      tzHour,
      get("minute"),
      get("second"),
    );
    offsetMs = tzMoment - naive;
  } catch {
    // TZ inconnu — on retombe sur UTC, mieux que de jeter.
    offsetMs = 0;
  }
  return new Date(naive - offsetMs);
}

function parseDateTimeValue(value: string, tzid: string | null): Date | null {
  // Accepte : 20260606T120000, 20260606T120000Z, 20260606 (VALUE=DATE)
  const dt = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z?))?$/.exec(value);
  if (!dt) return null;
  const year = Number(dt[1]);
  const month = Number(dt[2]);
  const day = Number(dt[3]);
  const hour = dt[4] ? Number(dt[4]) : 0;
  const minute = dt[5] ? Number(dt[5]) : 0;
  const second = dt[6] ? Number(dt[6]) : 0;
  const isUtc = dt[7] === "Z";

  if (isUtc) {
    return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  }

  if (tzid) {
    const iana = TZID_TO_IANA[tzid] ?? tzid;
    return localToUtc(year, month, day, hour, minute, second, iana);
  }

  // Floating local time — on traite comme UTC faute de mieux. Pour football.ch
  // ce cas n'arrive pas car DTSTART vient toujours avec un TZID.
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
}

/**
 * Extrait une URL plausible depuis un DESCRIPTION. Premier match http(s)://
 * gagnant. On bornera la longueur pour ne pas avaler le DESCRIPTION entier
 * si un parser a oublié de découper.
 */
function extractMatchUrl(description: string | null): string | null {
  if (!description) return null;
  const m = /https?:\/\/[^\s,;]+/i.exec(description);
  if (!m) return null;
  const url = m[0].trim();
  return url.length > 500 ? null : url;
}

export function parseIcs(text: string): ParseResult {
  const lines = unfold(text).map(parseLine).filter((l): l is Line => l !== null);

  // 1er passage : VTIMEZONE → mapping TZID → IANA via X-LIC-LOCATION.
  let inVtz = false;
  let currentTzid: string | null = null;
  let currentLocation: string | null = null;
  for (const l of lines) {
    if (l.name === "BEGIN" && l.value === "VTIMEZONE") {
      inVtz = true;
      currentTzid = null;
      currentLocation = null;
      continue;
    }
    if (l.name === "END" && l.value === "VTIMEZONE") {
      if (currentTzid && currentLocation) {
        TZID_TO_IANA[currentTzid] = currentLocation;
      } else if (currentTzid && !TZID_TO_IANA[currentTzid]) {
        TZID_TO_IANA[currentTzid] = currentTzid;
      }
      inVtz = false;
      continue;
    }
    if (!inVtz) continue;
    if (l.name === "TZID") currentTzid = l.value.trim();
    else if (l.name === "X-LIC-LOCATION") currentLocation = l.value.trim();
  }

  // 2e passage : VEVENT.
  const events: ParsedEvent[] = [];
  let inEvent = false;
  let cur: {
    uid: string | null;
    startsAt: Date | null;
    endsAt: Date | null;
    summary: string | null;
    location: string | null;
    description: string | null;
  } | null = null;
  let calendarName: string | null = null;

  for (const l of lines) {
    if (l.name === "BEGIN" && l.value === "VEVENT") {
      inEvent = true;
      cur = {
        uid: null,
        startsAt: null,
        endsAt: null,
        summary: null,
        location: null,
        description: null,
      };
      continue;
    }
    if (l.name === "END" && l.value === "VEVENT") {
      if (cur && cur.uid && cur.startsAt) {
        events.push({
          uid: cur.uid,
          startsAt: cur.startsAt,
          endsAt: cur.endsAt,
          summary: cur.summary,
          location: cur.location,
          description: cur.description,
          matchUrl: extractMatchUrl(cur.description),
        });
      }
      inEvent = false;
      cur = null;
      continue;
    }
    if (!inEvent || !cur) {
      if (l.name === "X-WR-CALNAME") calendarName = unescapeText(l.value);
      continue;
    }
    switch (l.name) {
      case "UID":
        cur.uid = l.value.trim();
        break;
      case "DTSTART":
        cur.startsAt = parseDateTimeValue(l.value, l.params.TZID ?? null);
        break;
      case "DTEND":
        cur.endsAt = parseDateTimeValue(l.value, l.params.TZID ?? null);
        break;
      case "SUMMARY":
        cur.summary = unescapeText(l.value);
        break;
      case "LOCATION":
        cur.location = unescapeText(l.value);
        break;
      case "DESCRIPTION":
        cur.description = unescapeText(l.value);
        break;
    }
  }

  return { events, calendarName };
}
