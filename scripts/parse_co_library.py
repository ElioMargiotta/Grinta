#!/usr/bin/env python3
"""
Parses ASF Base CO (Condition physique) booklets into:
  - supabase/migrations/<NNNN>_seed_co_<slug>_library.sql
  - public/exercises/<CODE>_main.png

Sibling of parse_te_library.py — same author/format, but the table layout
is different from the TE booklets:
  * 4 mega-columns (Exercice | Description | Coaching | Variantes)
  * "Coaching" has a single sub-column ("Condition physique") instead of
    four (Tactique / Technique / Force mentale / Condition physique)
  * Bottom band: Déroulement | Paramètres | Remarques théoriques
  * Anchor is "Base CO : <track> Niveau <N>" with track ∈ {Accélérations,
    Changements de direction, Sauts} and level 1..8

Usage (from repo root):
    python3 scripts/parse_co_library.py [chapter]

chapter ∈ {explosivite}. Defaults to 'explosivite'.
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

SOURCE = "asf_co_2026"

# Per-chapter config. Add an entry here when you parse a new CO booklet.
CHAPTERS: dict[str, dict[str, str]] = {
    "explosivite": {
        "pdf": "explosivité.pdf",
        "sql": "supabase/migrations/0010_seed_co_explosivite_library.sql",
        "theme": "Explosivité",
        "code_prefix": "CO_EX",
    },
}

# Anchor: "Base CO : <track> Niveau <N>". Tracks are hard-coded because they
# carry meaning (we map them onto the `track` column for filtering).
ANCHOR_RE = re.compile(
    r"^\s*Base CO\s*:\s*(Accélérations|Changements de direction|Sauts)\s+Niveau\s+(\d+)"
)
TOP_HEADER_RE = re.compile(r"Organisation\s+Condition physique\s+Description")
INTER_HEADER_RE = re.compile(r"^\s*Exercice\s+Description\s+Coaching\s+Variantes")
PAGE_NUM_RE = re.compile(r"^\s*\d{1,3}(?:\s+\d{1,3})*\s*$")

TRACK_SLUGS = {
    "Accélérations": "ACC",
    "Changements de direction": "CD",
    "Sauts": "S",
}


@dataclass
class CoExercise:
    code: str
    track: str               # "Accélérations" / "Changements de direction" / "Sauts"
    level: int               # 1..8
    titre: str
    description: str
    dimensions: str
    player_count_text: str
    condition_physique: list[str] = field(default_factory=list)
    parametres: list[str] = field(default_factory=list)
    remarques: str = ""
    variantes_text: str = ""
    main_image: str = ""
    pdf_page: int = 0
    page_pos: int = 0        # 0 = top exercise on page, 1 = bottom

    @property
    def niveau(self) -> str:
        return f"Base CO: {self.track} Niveau {self.level}"

    @property
    def organisation(self) -> str:
        parts: list[str] = []
        if self.dimensions:
            parts.append(f"Dimensions\n{self.dimensions}")
        if self.player_count_text:
            parts.append(f"Joueurs\n{self.player_count_text}")
        if self.parametres:
            parts.append("Paramètres\n" + "\n".join(self.parametres))
        if self.remarques:
            parts.append(f"Remarques théoriques\n{self.remarques}")
        return "\n".join(parts)


def run_cmd(cmd: list[str]) -> str:
    return subprocess.check_output(cmd, text=True)


def detect_columns(header_line: str) -> list[int] | None:
    """Find start positions of column headers in a layout-mode line.
    Returns [org_x, cp_x, desc_x] for the top-band header."""
    positions: list[int] = []
    for lbl in ("Organisation", "Condition physique", "Description"):
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
    """Collapse wrap-continuation lines into a tag list (capital/digit → new tag)."""
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
    return "\n".join(merge_tags(lines))


def parse_org_block(lines: list[str]) -> tuple[str, str]:
    """Parse the Organisation column (Dimensions, Joueurs — no Durée here)."""
    dimensions: list[str] = []
    joueurs: list[str] = []
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
        if s in ("Durée", "Organisation"):
            continue
        if current == "dim":
            dimensions.append(s)
        elif current == "jou":
            joueurs.append(s)
    return ("\n".join(merge_tags(dimensions)), "\n".join(merge_tags(joueurs)))


def parse_page(page: str, pidx: int, code_prefix: str) -> list[CoExercise]:
    lines = page.split("\n")

    # Lock column positions from the first top-band header on the page.
    cols: list[int] | None = None
    for line in lines:
        if TOP_HEADER_RE.search(line):
            cols = detect_columns(line)
            if cols:
                break
    if not cols:
        return []
    org_x, cp_x, desc_x = cols

    anchors: list[tuple[int, str, int]] = []
    for i, line in enumerate(lines):
        m = ANCHOR_RE.match(line)
        if m:
            anchors.append((i, m.group(1), int(m.group(2))))

    exercises: list[CoExercise] = []
    for ai, (anchor_idx, track, lvl) in enumerate(anchors):
        next_idx = anchors[ai + 1][0] if ai + 1 < len(anchors) else len(lines)
        block = lines[anchor_idx:next_idx]

        # Band split — first row where the Organisation column starts with "Déroulement".
        split_idx = -1
        for i, line in enumerate(block):
            if slice_col(line, org_x, cp_x).strip().startswith("Déroulement"):
                split_idx = i
                break
        if split_idx < 0:
            continue

        # Truncate at the next exercise's mega-header or at a stray page number.
        end_idx = len(block)
        for i in range(split_idx + 1, len(block)):
            if INTER_HEADER_RE.match(block[i]) or PAGE_NUM_RE.match(block[i]):
                end_idx = i
                break
        top = block[1:split_idx]
        bot = block[split_idx + 1 : end_idx]

        # --- Top band ---
        org_lines = [slice_col(l, org_x, cp_x) for l in top]
        cp_lines = [slice_col(l, cp_x, desc_x) for l in top]
        var_top_lines = [slice_col(l, desc_x, None) for l in top]

        dims, joueurs = parse_org_block(org_lines)
        # Strip the "Condition physique" column header line if it leaked in.
        cp_tags = merge_tags(
            [l for l in cp_lines if l.strip() != "Condition physique"]
        )
        # Top variantes column also starts with a "Description" / "Organisation"
        # header pair (column header + first sub-header). Strip those.
        var_top_items: list[str] = []
        for raw in var_top_lines:
            s = raw.strip()
            if s in ("Description", "Organisation"):
                continue
            var_top_items.append(raw)
        variantes_top = join_paragraphs(var_top_items)

        # --- Bottom band ---
        der_lines = [slice_col(l, org_x, cp_x) for l in bot]
        der_items = merge_tags(der_lines)
        if not der_items:
            continue
        titre = der_items[0]
        description = "\n".join(der_items[1:])

        param_lines = [slice_col(l, cp_x, desc_x) for l in bot]
        parametres = merge_tags(
            [l for l in param_lines if l.strip() != "Paramètres"]
        )

        rem_lines = [slice_col(l, desc_x, None) for l in bot]
        remarques = join_paragraphs(
            [l for l in rem_lines if l.strip() != "Remarques théoriques"]
        )

        track_slug = TRACK_SLUGS.get(track, "X")
        code = f"{code_prefix}_{track_slug}_{lvl}"

        exercises.append(
            CoExercise(
                code=code,
                track=track,
                level=lvl,
                titre=titre,
                description=description,
                dimensions=dims,
                player_count_text=joueurs,
                condition_physique=cp_tags,
                parametres=parametres,
                remarques=remarques,
                variantes_text=variantes_top,
                pdf_page=pidx,
                page_pos=ai,
            )
        )
    return exercises


def parse_all(pdf_path: str, code_prefix: str) -> list[CoExercise]:
    text = run_cmd(["pdftotext", "-layout", pdf_path, "-"])
    pages = text.split("\f")
    out: list[CoExercise] = []
    for pidx, page in enumerate(pages, start=1):
        out.extend(parse_page(page, pidx, code_prefix))
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
    # CO booklets don't carry an intensity tag — explosivité is by definition high.
    return "high"


def extract_main_images(exercises: list[CoExercise], pdf_path: str) -> None:
    """Each PDF page lays out 2 exercises × 1 image each (no variation images).
    The page-image stream is [top main, bot main]."""
    listing = run_cmd(["pdfimages", "-list", pdf_path])
    rows = [r for r in listing.splitlines() if re.match(r"^\s*\d+", r)]
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
            offset = ex.page_pos  # 0 for top, 1 for bottom
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


def render_seed(exercises: list[CoExercise], theme: str, pdf_name: str) -> str:
    header = f"""-- Auto-generated by scripts/parse_co_library.py
-- Imports the ASF "{theme}" Base CO (Condition physique) library
-- from {pdf_name}.
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
        rows.append(
            "  (\n"
            f"    null, '{SOURCE}', '{ex.code}', {sql_text(ex.titre)}, null,\n"
            f"    {sql_text(ex.titre)},\n"
            f"    {sql_text(theme)}, {sql_text(ex.track)}, {ex.level}, {sql_text(ex.niveau)},\n"
            f"    {sql_text(ex.description)},\n"
            f"    null,\n"
            f"    {sql_text(ex.organisation)},\n"
            f"    null, {sql_text(intensity)}, array[]::text[],\n"
            f"    {sql_text_array(ex.condition_physique)},\n"
            f"    array[]::text[],\n"
            f"    array[]::text[],\n"
            f"    array[]::text[],\n"
            f"    '/exercises/{ex.code}_main.png',\n"
            f"    {sql_text(ex.variantes_text)},\n"
            f"    null\n"
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
    chapter_key = sys.argv[1] if len(sys.argv) > 1 else "explosivite"
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

    if not os.path.exists(pdf_path):
        print(f"missing PDF at {pdf_path}", file=sys.stderr)
        sys.exit(1)

    exercises = parse_all(pdf_path, code_prefix)
    # Sort by track then level for a stable seed.
    track_order = {"Accélérations": 0, "Changements de direction": 1, "Sauts": 2}
    exercises.sort(key=lambda e: (track_order.get(e.track, 99), e.level))

    print(f"== [{chapter_key}] parsed {len(exercises)} exercises")
    for ex in exercises:
        print(
            f"  {ex.code:14s}  {ex.track:25s}  L{ex.level}  "
            f"page={ex.pdf_page} pos={ex.page_pos}  titre={ex.titre!r}  "
            f"cp={len(ex.condition_physique)} par={len(ex.parametres)} "
            f"rem={'y' if ex.remarques else 'n'} var={'y' if ex.variantes_text else 'n'}"
        )

    extract_main_images(exercises, pdf_path)

    sql = render_seed(exercises, theme, os.path.basename(pdf_path))
    with open(out_sql, "w") as f:
        f.write(sql)
    print(f"== wrote {out_sql}")


if __name__ == "__main__":
    main()
