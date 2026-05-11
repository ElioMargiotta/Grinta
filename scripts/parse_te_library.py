#!/usr/bin/env python3
"""
Parses the ASF Base TE technical-gesture booklets into:
  - supabase/migrations/<NNNN>_seed_te_<slug>_library.sql
  - public/exercises/<CODE>_main.png

This is the technical-gesture sibling of parse_exercise_library.py — the
clubcorner library covers tactical phases (Mon équipe possède le ballon …)
while this script covers the Base TE booklets, where each booklet shares
the same 5-column table layout but covers a different theme.

Usage (from repo root):
    python3 scripts/parse_te_library.py [chapter]

chapter ∈ {passe, conduite}. Defaults to 'passe'.
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
OUT_IMG = os.path.join(REPO, "public/exercises")

SOURCE = "asf_te_2026"
TRACK = "Base TE"

# Per-chapter config. Add an entry here when you parse a new TE booklet.
CHAPTERS: dict[str, dict[str, str]] = {
    "passe": {
        "pdf": "TE-Prise_balle_passe.pdf",
        "sql": "supabase/migrations/0006_seed_te_library.sql",
        "theme": "Passe et prise de balle",
        "code_prefix": "TE_PB",
        "chapter_re": r"Passe et prise de balle\s+(\d)\s*[–\-]\s*Base TE\s+NIVEAU",
    },
    "conduite": {
        "pdf": "conduite_balle_dribble.pdf",
        "sql": "supabase/migrations/0007_seed_te_conduite_library.sql",
        "theme": "Conduite du ballon et dribble",
        "code_prefix": "TE_CD",
        "chapter_re": r"Conduite du ballon et dribble\s+(\d)\s*[–\-]\s*Base TE\s+NIVEAU",
    },
}

ANCHOR_RE = re.compile(r"^\s*Base TE:\s*Niveau\s+(\d)-(\d)\b")
TOP_HEADER_RE = re.compile(r"Organisation\s+Tactique\s+Technique\s+Moins")
BOT_HEADER_RE = re.compile(r"Déroulement\s+Force mentale\s+Condition physique\s+Description")
# Inter-exercise mega-header row that sits between two stacked exercise tables.
INTER_HEADER_RE = re.compile(r"^\s*Exercice\s+Description\s+Coaching\s+Variante\s*$")
# Page-footer page number (a line containing only a number, possibly indented).
PAGE_NUM_RE = re.compile(r"^\s*\d{1,3}\s*$")


@dataclass
class TeExercise:
    code: str
    level: int               # 1, 2, or 3
    sub: int                 # 1..6
    titre: str               # Title from Déroulement first line
    description: str         # Body of Déroulement
    dimensions: str
    player_count_text: str
    sequence_duration: str
    volume_duration: str
    tactique: list[str] = field(default_factory=list)
    technique: list[str] = field(default_factory=list)
    force_mentale: list[str] = field(default_factory=list)
    condition_physique: list[str] = field(default_factory=list)
    variation_less_text: str = ""
    variation_more_text: str = ""
    pdf_page: int = 0
    page_pos: int = 0        # 0 = top exercise on page, 1 = bottom
    chapter_n: int = 0       # "Passe et prise de balle 1/2/3"

    @property
    def niveau(self) -> str:
        return f"{TRACK}: Niveau {self.level}"

    @property
    def duree(self) -> str:
        return self.sequence_duration

    @property
    def organisation(self) -> str:
        parts: list[str] = []
        if self.dimensions:
            parts.append(f"Dimensions\n{self.dimensions}")
        if self.player_count_text:
            parts.append(f"Joueurs\n{self.player_count_text}")
        seq: list[str] = []
        if self.sequence_duration:
            seq.append(self.sequence_duration)
        if self.volume_duration:
            seq.append(f"(volume total de {self.volume_duration})")
        if seq:
            parts.append("Durée\n" + "\n".join(seq))
        return "\n".join(parts)


def run_cmd(cmd: list[str]) -> str:
    return subprocess.check_output(cmd, text=True)


def detect_columns(header_line: str) -> list[int] | None:
    """Find start positions of column headers in a layout-mode line."""
    labels = ["Organisation", "Tactique", "Technique", "Moins (-)", "Plus (+)"]
    positions: list[int] = []
    for lbl in labels:
        idx = header_line.find(lbl)
        if idx < 0:
            return None
        positions.append(idx)
    return positions


def slice_col(line: str, start: int, end: int | None) -> str:
    if len(line) <= start:
        return ""
    if end is None:
        return line[start:]
    return line[start:end]


def merge_tags(lines: list[str]) -> list[str]:
    """Collapse wrap-continuation lines into a tag list."""
    result: list[str] = []
    for raw in lines:
        s = raw.strip()
        if not s:
            continue
        first = s[0]
        is_continuation = (not (first.isupper() or first.isdigit())) or first == "("
        if is_continuation and result:
            result[-1] = (result[-1] + " " + s).strip()
        else:
            result.append(s)
    return [t.strip().rstrip(",;").strip() for t in result if t.strip()]


def join_paragraphs(lines: list[str]) -> str:
    """Same wrap-merge as merge_tags, but kept as multi-line text."""
    items = merge_tags(lines)
    return "\n".join(items)


def parse_org_block(lines: list[str]) -> tuple[str, str, str, str]:
    """Parse the Organisation column into (dimensions, joueurs, sequence, volume)."""
    dimensions: list[str] = []
    joueurs: list[str] = []
    duree: list[str] = []
    current: str | None = None
    for raw in lines:
        s = raw.strip()
        if not s:
            continue
        if s == "Dimensions":
            current = "dim"
            continue
        if s == "Joueurs":
            current = "jou"
            continue
        if s == "Durée":
            current = "dur"
            continue
        if current == "dim":
            dimensions.append(s)
        elif current == "jou":
            joueurs.append(s)
        elif current == "dur":
            duree.append(s)
    seq = duree[0] if duree else ""
    vol = ""
    for l in duree:
        m = re.search(r"\(volume total(?:e)?\s+(?:de\s+)?([^)]+)\)", l)
        if m:
            vol = m.group(1).strip()
            break
    # Merge wrapped dimension lines (continuation lines join with previous).
    dims_merged = merge_tags(dimensions)
    jou_merged = merge_tags(joueurs)
    return ("\n".join(dims_merged), "\n".join(jou_merged), seq, vol)


def parse_page(page: str, pidx: int, chapter_n: int, code_prefix: str) -> list[TeExercise]:
    lines = page.split("\n")
    # Find the top header line on this page to lock in column positions.
    cols: list[int] | None = None
    for line in lines:
        if TOP_HEADER_RE.search(line):
            cols = detect_columns(line)
            if cols:
                break
    if not cols:
        return []
    org_x, tac_x, tec_x, less_x, more_x = cols

    # Collect anchor line indexes.
    anchors: list[tuple[int, int, int]] = []
    for i, line in enumerate(lines):
        m = ANCHOR_RE.match(line)
        if m:
            anchors.append((i, int(m.group(1)), int(m.group(2))))

    exercises: list[TeExercise] = []
    for ai, (anchor_idx, lvl, sub) in enumerate(anchors):
        next_idx = anchors[ai + 1][0] if ai + 1 < len(anchors) else len(lines)
        block = lines[anchor_idx:next_idx]

        # Locate band split — the row whose Organisation-column starts with "Déroulement".
        split_idx = -1
        for i, line in enumerate(block):
            if slice_col(line, org_x, tac_x).strip().startswith("Déroulement"):
                split_idx = i
                break
        if split_idx < 0:
            continue

        # Each exercise's table is bounded above (at split_idx) and below
        # by either the next anchor or the next exercise's mega-header
        # "Exercice  Description  Coaching  Variante" row, whichever comes
        # first. Without this stop, the next table's header tokens bleed
        # into our column slices (description ends with "Description",
        # variations end with "Varian", page numbers leak in as tags …).
        end_idx = len(block)
        for i in range(split_idx + 1, len(block)):
            if INTER_HEADER_RE.match(block[i]) or PAGE_NUM_RE.match(block[i]):
                end_idx = i
                break
        top = block[1:split_idx]
        bot = block[split_idx + 1 : end_idx]

        # --- Top band ---
        org_lines = [slice_col(l, org_x, tac_x) for l in top]
        tac_lines = [slice_col(l, tac_x, tec_x) for l in top]
        tec_lines = [slice_col(l, tec_x, less_x) for l in top]
        # Strip the column header "Organisation"/"Tactique"/"Technique" — those are
        # already on the anchor line itself (block[0]), so `top` shouldn't contain
        # them, but be defensive.
        dims, joueurs, seq, vol = parse_org_block(org_lines)
        tactique = merge_tags([l for l in tac_lines if l.strip() != "Tactique"])
        technique = merge_tags([l for l in tec_lines if l.strip() != "Technique"])

        # --- Bottom band ---
        der_lines_raw = [slice_col(l, org_x, tac_x) for l in bot]
        der_items = merge_tags(der_lines_raw)
        if not der_items:
            continue
        titre = der_items[0]
        description = "\n".join(der_items[1:])

        fm_lines = [slice_col(l, tac_x, tec_x) for l in bot]
        cp_lines = [slice_col(l, tec_x, less_x) for l in bot]
        less_lines = [slice_col(l, less_x, more_x) for l in bot]
        more_lines = [slice_col(l, more_x, None) for l in bot]

        force_mentale = merge_tags(fm_lines)
        condition_physique = merge_tags(cp_lines)
        variation_less = join_paragraphs(less_lines)
        variation_more = join_paragraphs(more_lines)

        # Strip any leading "Description" / "Organisation" headers in variations:
        # the bottom-band column header row was already skipped, but defensive.
        variation_less = re.sub(r"^Description\n?", "", variation_less)
        variation_more = re.sub(r"^Description\n?", "", variation_more)

        code = f"{code_prefix}_{lvl}-{sub}"
        exercises.append(
            TeExercise(
                code=code,
                level=lvl,
                sub=sub,
                titre=titre,
                description=description,
                dimensions=dims,
                player_count_text=joueurs,
                sequence_duration=seq,
                volume_duration=vol,
                tactique=tactique,
                technique=technique,
                force_mentale=force_mentale,
                condition_physique=condition_physique,
                variation_less_text=variation_less,
                variation_more_text=variation_more,
                pdf_page=pidx,
                page_pos=ai,
                chapter_n=chapter_n,
            )
        )
    return exercises


def parse_all(pdf_path: str, chapter_re: re.Pattern[str], code_prefix: str) -> list[TeExercise]:
    text = run_cmd(["pdftotext", "-layout", pdf_path, "-"])
    pages = text.split("\f")
    out: list[TeExercise] = []
    chapter_n = 0
    for pidx, page in enumerate(pages, start=1):
        m = chapter_re.search(page)
        if m:
            chapter_n = int(m.group(1))
        out.extend(parse_page(page, pidx, chapter_n, code_prefix))
    return out


def derive_intensity(condition_physique: list[str]) -> str | None:
    for t in condition_physique:
        low = t.lower()
        if "intensité élevée" in low:
            return "high"
        if "intensité moyenne" in low:
            return "medium"
        if "intensité faible" in low or "intensité basse" in low:
            return "low"
    return None


def extract_main_images(exercises: list[TeExercise], pdf_path: str) -> None:
    """Each PDF page lays out 2 exercises × 3 images (main, moins, plus).
    The page-image stream is: [top main, top less, top more, bot main, bot less, bot more].
    We grab the top exercise's image at index 0 of its page, and the bottom at index 3.
    """
    listing = run_cmd(["pdfimages", "-list", pdf_path])
    rows = [r for r in listing.splitlines() if re.match(r"^\s*\d+", r)]
    # Map page → list of absolute image indexes (in PDF stream order).
    page_to_imgs: dict[int, list[int]] = {}
    for idx, row in enumerate(rows):
        page = int(row.split()[0])
        page_to_imgs.setdefault(page, []).append(idx)

    os.makedirs(OUT_IMG, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        prefix = os.path.join(tmp, "img")
        run_cmd(["pdfimages", "-png", pdf_path, prefix])
        for ex in exercises:
            page_imgs = page_to_imgs.get(ex.pdf_page, [])
            offset = ex.page_pos * 3  # 0 for top, 3 for bottom
            if offset >= len(page_imgs):
                print(
                    f"  (no image at page {ex.pdf_page} offset {offset} for {ex.code})",
                    file=sys.stderr,
                )
                continue
            abs_idx = page_imgs[offset]
            src = f"{prefix}-{abs_idx:03d}.png"
            dst = os.path.join(OUT_IMG, f"{ex.code}_main.png")
            if os.path.exists(src):
                shutil.copy(src, dst)
            else:
                print(f"  (missing {src})", file=sys.stderr)


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


def render_seed(exercises: list[TeExercise], theme: str, pdf_name: str) -> str:
    header = f"""-- Auto-generated by scripts/parse_te_library.py
-- Imports the ASF "{theme}" Base TE library
-- (technical-gesture exercises) from {pdf_name}.
-- Run order: depends on 0003_exercise_library.sql.
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
    rows: list[str] = []
    for ex in exercises:
        intensity = derive_intensity(ex.condition_physique)
        # Derive a numeric duration_minutes from the sequence duration (best-effort).
        dmin: int | None = None
        m = re.search(r"(\d+)\s*[’']", ex.sequence_duration)
        if m:
            dmin = int(m.group(1))
        rows.append(
            "  (\n"
            f"    null, '{SOURCE}', '{ex.code}', {sql_text(ex.titre)}, null,\n"
            f"    {sql_text(ex.titre)},\n"
            f"    {sql_text(theme)}, {sql_text(TRACK)}, {ex.level}, {sql_text(ex.niveau)},\n"
            f"    {sql_text(ex.description)},\n"
            f"    {sql_text(ex.duree)},\n"
            f"    {sql_text(ex.organisation)},\n"
            f"    {sql_int(dmin)}, {sql_text(intensity)}, array[]::text[],\n"
            f"    {sql_text_array(ex.condition_physique)},\n"
            f"    {sql_text_array(ex.tactique)},\n"
            f"    {sql_text_array(ex.force_mentale)},\n"
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
    chapter_key = sys.argv[1] if len(sys.argv) > 1 else "passe"
    if chapter_key not in CHAPTERS:
        print(
            f"unknown chapter '{chapter_key}'. choices: {', '.join(CHAPTERS)}",
            file=sys.stderr,
        )
        sys.exit(2)
    cfg = CHAPTERS[chapter_key]
    pdf_path = os.path.join(REPO, cfg["pdf"])
    out_sql = os.path.join(REPO, cfg["sql"])
    theme = cfg["theme"]
    code_prefix = cfg["code_prefix"]
    chapter_re = re.compile(cfg["chapter_re"], re.IGNORECASE)

    if not os.path.exists(pdf_path):
        print(f"missing PDF at {pdf_path}", file=sys.stderr)
        sys.exit(1)

    exercises = parse_all(pdf_path, chapter_re, code_prefix)
    exercises.sort(key=lambda e: (e.level, e.sub))

    print(f"== [{chapter_key}] parsed {len(exercises)} exercises")
    for ex in exercises:
        print(
            f"  {ex.code:12s}  L{ex.level}  sub={ex.sub}  page={ex.pdf_page}  "
            f"titre={ex.titre!r}  tac={len(ex.tactique)} tec={len(ex.technique)} "
            f"fm={len(ex.force_mentale)} cp={len(ex.condition_physique)}"
        )

    extract_main_images(exercises, pdf_path)

    sql = render_seed(exercises, theme, os.path.basename(pdf_path))
    with open(out_sql, "w") as f:
        f.write(sql)
    print(f"== wrote {out_sql}")


if __name__ == "__main__":
    main()
