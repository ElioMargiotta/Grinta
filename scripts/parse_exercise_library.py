#!/usr/bin/env python3
"""
Parses the four ASF / clubcorner phase PDFs into:
  - supabase/migrations/0004_seed_clubcorner_library.sql
  - public/exercises/<CODE>_main.png   (one diagram per exercise)

Usage (from repo root):
    python3 scripts/parse_exercise_library.py
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass, field

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DOWNLOADS = os.path.expanduser("~/Downloads")
OUT_SQL = os.path.join(REPO, "supabase/migrations/0004_seed_clubcorner_library.sql")
OUT_IMG = os.path.join(REPO, "public/exercises")

PHASE_FILES = [
    ("Mon équipe possède le ballon",        "mon_equipe_possede_ballon.pdf"),
    ("Mon équipe perd le ballon",           "Mon equipe perd le ballon.pdf"),
    ("Mon équipe ne possède pas le ballon", "mon equipe ne possède pas le ballon.pdf"),
    ("Mon équipe récupère le ballon",       "mon equipe recup le ballon.pdf"),
]

TRACK_BY_CODE = {
    "Basis": "Base TA",
    "Entwicklung": "Développement TA",
    "Strategie": "Stratégie Team",
}

TAG_HEADERS = ["Forme physique", "Tactique", "Mentalité", "Technique"]
TAG_KEY = {
    "Forme physique": "forme_physique",
    "Tactique":       "tactique",
    "Mentalité":      "mentalite",
    "Technique":      "technique",
}


@dataclass
class Exercise:
    code: str
    titre: str
    theme: str
    track: str
    level: int
    description: str
    duration_min: int | None = None
    duration_max: int | None = None
    dimensions: str = ""
    player_count: int | None = None
    sequence_duration: str = ""
    volume_duration: str = ""
    forme_physique: list[str] = field(default_factory=list)
    tactique: list[str] = field(default_factory=list)
    mentalite: list[str] = field(default_factory=list)
    technique: list[str] = field(default_factory=list)
    variation_less_text: str = ""
    variation_more_text: str = ""
    main_image_page: int = 0  # 1-indexed PDF page where main diagram lives

    @property
    def niveau(self) -> str:
        return f"{self.track}: Niveau {self.level}" if self.track else ""

    @property
    def duree(self) -> str:
        if self.duration_min and self.duration_max:
            return f"{self.duration_min}-{self.duration_max}min"
        if self.duration_min:
            return f"{self.duration_min}min"
        return ""

    @property
    def organisation(self) -> str:
        parts: list[str] = []
        if self.dimensions:
            parts.append(f"Dimensions\n{self.dimensions}")
        if self.player_count is not None:
            label = "Joueurs"
            parts.append(f"{label}\n{self.player_count} joueurs")
        seq = []
        if self.sequence_duration:
            seq.append(self.sequence_duration)
        if self.volume_duration:
            seq.append(f"(volume total de {self.volume_duration})")
        if seq:
            parts.append("Durée\n" + "\n".join(seq))
        return "\n".join(parts)


def run(cmd: list[str], **kwargs) -> str:
    return subprocess.check_output(cmd, text=True, **kwargs)


def pdf_pages(path: str) -> list[str]:
    """Return one string per PDF page, preserving reading order."""
    text = run(["pdftotext", path, "-"])
    return text.split("\f")


def page_for_offset(pages: list[str], offset: int) -> int:
    """1-indexed PDF page that the character `offset` (in the joined text)
    falls into. Account for the fact that splitting on \f loses exactly
    one character per page boundary."""
    seen = 0
    for i, p in enumerate(pages, start=1):
        seen += len(p) + 1  # +1 for the \f
        if offset < seen:
            return i
    return len(pages)


def parse_minutes_range(s: str) -> tuple[int | None, int | None]:
    # "00:10 - 00:15" → (10, 15)
    m = re.search(r"(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})", s)
    if not m:
        return None, None
    a = int(m.group(1)) * 60 + int(m.group(2))
    b = int(m.group(3)) * 60 + int(m.group(4))
    # The PDF uses HH:MM where MM is always 00 — the value is in minutes.
    return a if a else int(m.group(2)), b if b else int(m.group(4))


def parse_player_count(s: str) -> int | None:
    m = re.search(r"(\d+)", s)
    return int(m.group(1)) if m else None


def derive_intensity(forme_physique: list[str]) -> str | None:
    for t in forme_physique:
        low = t.lower()
        if "intensité élevée" in low:
            return "high"
        if "intensité moyenne" in low:
            return "medium"
        if "intensité faible" in low or "intensité basse" in low:
            return "low"
    return None


PHASE_HEADER_PATTERN = re.compile(
    r"\nDescription\nMon équipe (?:possède le ballon|perd le ballon|ne possède pas le ballon|récupère le ballon)\n"
)


def split_exercises(pages: list[str]) -> list[tuple[int, str]]:
    """Find every exercise block in the concatenated text by anchoring on
    `\\nDescription\\nMon équipe ...\\n` and slicing until the next anchor.
    Returns a list of (start_page_1indexed, block_text)."""
    full = "\n".join(pages)
    anchors = [m.start() for m in PHASE_HEADER_PATTERN.finditer("\n" + full)]
    # +1 because the pattern looks back for a leading \n we prepended.
    anchors = [a - 1 if a > 0 else 0 for a in anchors]
    blocks: list[tuple[int, str]] = []
    for i, start in enumerate(anchors):
        end = anchors[i + 1] if i + 1 < len(anchors) else len(full)
        text = full[start:end]
        page = page_for_offset(pages, start)
        blocks.append((page, text))
    return blocks


def parse_exercise(text: str, theme: str, start_page: int) -> Exercise | None:
    lines = [l.rstrip() for l in text.splitlines()]

    # Find the "(Code: ...)" anchor.
    code_line_idx = next(
        (i for i, l in enumerate(lines) if l.strip().startswith("(Code:")), -1
    )
    if code_line_idx < 0:
        return None
    code_match = re.search(r"\(Code:\s*([A-Za-z0-9_-]+)\)", lines[code_line_idx])
    if not code_match:
        return None
    code = code_match.group(1)

    # Track + level live two lines above the (Code:) line.
    track_line = lines[code_line_idx - 1].strip() if code_line_idx >= 1 else ""
    if not re.match(r"^[A-Za-zé]+ TA: Niveau \d+|Stratégie Team: Niveau \d+", track_line):
        # Sometimes blank line in between — search upward.
        for j in range(code_line_idx - 1, max(0, code_line_idx - 5), -1):
            if "Niveau" in lines[j]:
                track_line = lines[j].strip()
                break
    track_m = re.match(
        r"^(Base TA|Développement TA|Stratégie Team)\s*:\s*Niveau\s+(\d+)$",
        track_line,
    )
    if not track_m:
        # Fall back to deriving from the code's "<phase>_<track>_<level>" tokens.
        # Hyphenated phases (OFF-DEF) → `parts[0] == "OFF-DEF"`; underscores follow.
        parts = code.split("_")
        track_token = parts[1] if len(parts) >= 3 else ""
        track = TRACK_BY_CODE.get(track_token, track_token)
        level_n = int(parts[-1]) if parts and parts[-1].isdigit() else 0
    else:
        track = track_m.group(1)
        level_n = int(track_m.group(2))

    # Title: first non-empty line after "(Code:)" that isn't a "Durée:"
    # header (some exercises put the duration before the title). Then
    # merge any immediately-following continuation lines (lowercase or
    # short fragments produced by PDF line-wrapping).
    title_start = -1
    for i, l in enumerate(lines[code_line_idx + 1 :], start=code_line_idx + 1):
        s = l.strip()
        if not s:
            continue
        if s.startswith("Durée:"):
            continue
        title_start = i
        break
    if title_start < 0:
        return None
    title_lines = [lines[title_start].strip()]
    j = title_start + 1
    while j < len(lines):
        s = lines[j].strip()
        if not s:
            break
        if s.startswith("Durée:") or s == "Dimensions" or s == "Joueurs":
            break
        first = s[0]
        # A continuation line starts lowercase, with `(`, or with a digit
        # — never a new sentence.
        if first.isupper():
            break
        title_lines.append(s)
        j += 1
    title = " ".join(title_lines).strip()

    # Description: lines after the title block up to the "Durée:" line.
    desc_lines: list[str] = []
    for l in lines[j:]:
        s = l.strip()
        if s.startswith("Durée:") or s == "Dimensions" or s == "Joueurs":
            break
        desc_lines.append(s)
    description = "\n".join([l for l in desc_lines if l]).strip()

    duree_match = re.search(r"Durée:\s*([0-9:]+)\s*-\s*([0-9:]+)", text)
    duration_min, duration_max = (None, None)
    if duree_match:
        a = duree_match.group(1)
        b = duree_match.group(2)
        ah, am = a.split(":")
        bh, bm = b.split(":")
        duration_min = int(ah) * 60 + int(am)
        duration_max = int(bh) * 60 + int(bm)

    # Right-column block: Dimensions, Joueurs, Durée (per-sequence + volume).
    def field_after(label: str, stop_labels: list[str]) -> str:
        m = re.search(
            rf"\b{re.escape(label)}\b\s*\n([\s\S]*?)(?=\n(?:{'|'.join(re.escape(s) for s in stop_labels)})\b|\Z)",
            text,
        )
        return m.group(1).strip() if m else ""

    dimensions = field_after("Dimensions", ["Joueurs", "Forme physique", "Entraînement", "Description"])
    joueurs_block = field_after("Joueurs", ["Durée", "Forme physique", "Entraînement", "Description"])
    durations_block_match = re.search(
        r"\bJoueurs\b[\s\S]*?\bDurée\b\s*\n([\s\S]*?)(?=\n(?:Forme physique|Entraînement|Description)\b|\Z)",
        text,
    )
    durations_block = durations_block_match.group(1).strip() if durations_block_match else ""

    player_count = parse_player_count(joueurs_block)

    seq_lines = [l for l in durations_block.splitlines() if l.strip()]
    sequence_duration = seq_lines[0].strip() if seq_lines else ""
    volume_match = re.search(r"\(volume total de\s*([^)]+)\)", durations_block)
    volume_duration = volume_match.group(1).strip() if volume_match else ""

    # Coaching-point families (4 columns).
    tags: dict[str, list[str]] = {k: [] for k in TAG_KEY.values()}
    for header in TAG_HEADERS:
        m = re.search(
            rf"\b{re.escape(header)}\b\s*\n([\s\S]*?)(?=\n(?:{'|'.join(re.escape(h) for h in TAG_HEADERS if h != header)}|Entraînement|Variations|Possibilités|Description)\b|\Z)",
            text,
        )
        if m:
            block = m.group(1)
            collected: list[str] = []
            for line in block.splitlines():
                s = line.strip()
                if not s:
                    continue
                # A new tag always starts with a capital letter or digit.
                # Anything else (lowercase, parenthesis, semicolon-prefixed
                # continuation) is appended to the previous tag.
                first = s[0]
                is_continuation = (
                    not (first.isupper() or first.isdigit())
                    or first == "("
                )
                if is_continuation and collected:
                    collected[-1] = (collected[-1] + " " + s).strip()
                else:
                    collected.append(s)
            # Merge tags that look split mid-sentence. Previous tag ending
            # in a comma is a wrap; previous ending in a semicolon is a tag
            # separator we'll split below.
            merged: list[str] = []
            for tag in collected:
                if (
                    merged
                    and merged[-1].rstrip().endswith(",")
                ):
                    merged[-1] = (merged[-1] + " " + tag).strip()
                else:
                    merged.append(tag)

            # Some tags have multiple ";"-separated items on one line.
            split_tags: list[str] = []
            for tag in merged:
                for piece in re.split(r";\s+", tag):
                    p = piece.strip().rstrip(";").strip()
                    if p:
                        split_tags.append(p)
            tags[TAG_KEY[header]] = split_tags

    # Variations.
    less_match = re.search(
        r"Variation Moins\s*\n+(?:Organisation\s*\n)?([\s\S]*?)(?=\nVariation Plus\b|\nPossibilités|\nDescription\b|\Z)",
        text,
    )
    more_match = re.search(
        r"Variation Plus\s*\n+(?:Organisation\s*\n)?([\s\S]*?)(?=\nPossibilités|\nDescription\b|\Z)",
        text,
    )
    variation_less = (less_match.group(1).strip() if less_match else "").strip()
    variation_more = (more_match.group(1).strip() if more_match else "").strip()

    return Exercise(
        code=code,
        titre=title,
        theme=theme,
        track=track,
        level=level_n,
        description=description,
        duration_min=duration_min,
        duration_max=duration_max,
        dimensions=dimensions,
        player_count=player_count,
        sequence_duration=sequence_duration,
        volume_duration=volume_duration,
        forme_physique=tags["forme_physique"],
        tactique=tags["tactique"],
        mentalite=tags["mentalite"],
        technique=tags["technique"],
        variation_less_text=variation_less,
        variation_more_text=variation_more,
        main_image_page=start_page,
    )


def extract_main_images(pdf_path: str, exercises: list[Exercise]) -> None:
    """Extract the first image on each exercise's first page → public/exercises/<CODE>_main.png."""
    listing = run(["pdfimages", "-list", pdf_path])
    rows = [r for r in listing.splitlines() if re.match(r"^\s*\d+", r)]
    page_to_first_index: dict[int, int] = {}
    for idx, row in enumerate(rows):
        cols = row.split()
        page = int(cols[0])
        # first column type entry per page wins.
        page_to_first_index.setdefault(page, idx)

    with tempfile.TemporaryDirectory() as tmp:
        prefix = os.path.join(tmp, "img")
        run(["pdfimages", "-png", pdf_path, prefix])
        for ex in exercises:
            idx = page_to_first_index.get(ex.main_image_page)
            if idx is None:
                print(f"  (no image found for {ex.code} on page {ex.main_image_page})", file=sys.stderr)
                continue
            src = f"{prefix}-{idx:03d}.png"
            dst = os.path.join(OUT_IMG, f"{ex.code}_main.png")
            if os.path.exists(src):
                shutil.copy(src, dst)


def sql_text(s: str | None) -> str:
    if s is None or s == "":
        return "null"
    needs_e = "\n" in s or "\\" in s
    escaped = s.replace("'", "''")
    if needs_e:
        escaped = escaped.replace("\n", "\\n").replace("\\n", "\\n")
        return f"E'{escaped}'"
    return f"'{escaped}'"


def sql_text_array(items: list[str]) -> str:
    if not items:
        return "array[]::text[]"
    inside = ",".join(sql_text(i) for i in items)
    return f"array[{inside}]"


def sql_int(n: int | None) -> str:
    return "null" if n is None else str(n)


def render_seed(exercises: list[Exercise]) -> str:
    header = """-- Auto-generated by scripts/parse_exercise_library.py
-- Imports the clubcorner / ASF training library (4 phase PDFs).
-- Run order: this migration depends on 0003_exercise_library.sql.
-- Idempotent: ON CONFLICT (code) does an upsert.

insert into exercises (
  trainer_id, source, code, name, category,
  titre, theme, track, level, niveau,
  description, duree, organisation,
  duration_minutes, intensity, equipment,
  forme_physique, tactique, mentalite, technique,
  main_image,
  variation_less_text, variation_more_text
) values
"""
    rows = []
    for ex in exercises:
        intensity = derive_intensity(ex.forme_physique)
        rows.append(
            "  (\n"
            f"    null, 'clubcorner_2026', '{ex.code}', {sql_text(ex.titre)}, null,\n"
            f"    {sql_text(ex.titre)},\n"
            f"    {sql_text(ex.theme)}, {sql_text(ex.track)}, {ex.level}, {sql_text(ex.niveau)},\n"
            f"    {sql_text(ex.description)},\n"
            f"    {sql_text(ex.duree)},\n"
            f"    {sql_text(ex.organisation)},\n"
            f"    {sql_int(ex.duration_min)}, {sql_text(intensity)}, array[]::text[],\n"
            f"    {sql_text_array(ex.forme_physique)},\n"
            f"    {sql_text_array(ex.tactique)},\n"
            f"    {sql_text_array(ex.mentalite)},\n"
            f"    {sql_text_array(ex.technique)},\n"
            f"    '/exercises/{ex.code}_main.png',\n"
            f"    {sql_text(ex.variation_less_text)},\n"
            f"    {sql_text(ex.variation_more_text)}\n"
            "  )"
        )

    footer = """
on conflict (code) where code is not null do update set
  name             = excluded.name,
  titre            = excluded.titre,
  theme            = excluded.theme,
  track            = excluded.track,
  level            = excluded.level,
  niveau           = excluded.niveau,
  description      = excluded.description,
  duree            = excluded.duree,
  organisation     = excluded.organisation,
  duration_minutes = excluded.duration_minutes,
  intensity        = excluded.intensity,
  equipment        = excluded.equipment,
  forme_physique   = excluded.forme_physique,
  tactique         = excluded.tactique,
  mentalite        = excluded.mentalite,
  technique        = excluded.technique,
  main_image          = excluded.main_image,
  variation_less_text = excluded.variation_less_text,
  variation_more_text = excluded.variation_more_text,
  source           = excluded.source;
"""
    return header + ",\n".join(rows) + footer


def main() -> None:
    os.makedirs(OUT_IMG, exist_ok=True)

    all_exercises: list[Exercise] = []
    for phase, fname in PHASE_FILES:
        pdf_path = os.path.join(DOWNLOADS, fname)
        if not os.path.exists(pdf_path):
            print(f"  ! missing {pdf_path}", file=sys.stderr)
            continue
        print(f"-- parsing {fname} ({phase})")
        pages = pdf_pages(pdf_path)
        blocks = split_exercises(pages)
        exos: list[Exercise] = []
        for start, block_text in blocks:
            ex = parse_exercise(block_text, phase, start)
            if ex:
                exos.append(ex)
        print(f"   {len(exos)} exercises")
        extract_main_images(pdf_path, exos)
        all_exercises.extend(exos)

    print(f"== total {len(all_exercises)} exercises")
    sql = render_seed(all_exercises)
    with open(OUT_SQL, "w") as f:
        f.write(sql)
    print(f"== wrote {OUT_SQL}")


if __name__ == "__main__":
    main()
