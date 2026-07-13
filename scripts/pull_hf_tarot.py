#!/usr/bin/env python3
"""
Arcana S2 — Hugging Face tarot dataset ingestion + local preprocessing.

Source dataset: barissglc/tarot (~5.77k rows; columns: Card 1, Card 2, Card 3, Reading).
An optional local copy can live at public/tarot_readings.parquet. That raw
parquet is ignored by git; the normalized JSON runtime artifacts are committed.

This script normalizes card names, then emits two lazy-loadable JSON artifacts
into public/arcana/data/ (served as static files and fetched on demand so the
app's JS bundle is never inflated by the ~3.7 MB corpus):

  1. hf_tarot_readings.json  — normalized reading rows
  2. hf_tarot_index.json     — lookup indexes for fast three-card retrieval

Usage:
    python scripts/pull_hf_tarot.py

Loading order (first that works wins):
    1. Local parquet via `duckdb` (public/tarot_readings.parquet)
    2. Hugging Face `datasets` library (datasets.load_dataset("barissglc/tarot"))
    3. Download the source parquet from Hugging Face, then read it via `duckdb`

No network access or AI APIs are required when the local parquet is present.
"""

from __future__ import annotations

import json
import os
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOCAL_PARQUET = ROOT / "public" / "tarot_readings.parquet"
OUT_DIR = ROOT / "public" / "arcana" / "data"
READINGS_OUT = OUT_DIR / "hf_tarot_readings.json"
INDEX_OUT = OUT_DIR / "hf_tarot_index.json"

DATASET_ID = "barissglc/tarot"
PARQUET_URL = f"https://huggingface.co/datasets/{DATASET_ID}/resolve/main/tarot_readings.parquet"
CARD_COLUMNS = ("Card 1", "Card 2", "Card 3")
READING_COLUMN = "Reading"

# Aliases that reconcile dataset slugs with the internal Arcana card catalog
# (src/features/arcana/arcanaCards.ts). The dataset uses "The wheel of fortune"
# while the internal catalog id is "wheel-of-fortune".
SLUG_ALIASES = {
    "the-wheel-of-fortune": "wheel-of-fortune",
}


def slugify(name: str) -> str:
    """lower-case, trim, collapse to a stable hyphen slug."""
    s = (name or "").strip().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"-+", "-", s).strip("-")
    return SLUG_ALIASES.get(s, s)


def normalize_card_name(name: str) -> str:
    """Trim and title-case the display name in a stable way."""
    return re.sub(r"\s+", " ", (name or "").strip())


def combo_key(slugs: list[str]) -> str:
    """Order-independent key for an exact three-card combo lookup."""
    return "|".join(sorted(slugs))


def import_duckdb():
    """Import duckdb, tolerating wheels that expose the native module only."""
    try:
        import duckdb  # type: ignore

        if hasattr(duckdb, "connect"):
            return duckdb
    except ModuleNotFoundError:
        pass

    try:
        import _duckdb as duckdb  # type: ignore

        return duckdb
    except ModuleNotFoundError:
        return None


def load_local_parquet() -> list[dict] | None:
    if not LOCAL_PARQUET.exists():
        return None

    duckdb = import_duckdb()
    if duckdb is None:
        sys.exit("ERROR: need `duckdb` installed to read the local parquet. Try: pip install duckdb")

    print(f"Loading local parquet '{LOCAL_PARQUET.name}' via duckdb...")
    con = duckdb.connect()
    cursor = con.execute(f"SELECT * FROM read_parquet('{LOCAL_PARQUET.as_posix()}')")
    columns = [d[0].strip() for d in cursor.description]
    rows = []
    for record in cursor.fetchall():
        rows.append({col: value for col, value in zip(columns, record)})
    return rows


def download_parquet() -> None:
    print(f"Downloading source parquet from {PARQUET_URL}...")
    LOCAL_PARQUET.parent.mkdir(parents=True, exist_ok=True)
    urllib.request.urlretrieve(PARQUET_URL, LOCAL_PARQUET)


def load_rows() -> list[dict]:
    """Return rows as dicts with the four expected columns."""
    # 1) Local parquet when present. This is the normal offline path.
    local_rows = load_local_parquet()
    if local_rows is not None:
        return local_rows

    # 2) Hugging Face datasets library
    try:
        from datasets import load_dataset  # type: ignore

        print(f"Loading dataset '{DATASET_ID}' via Hugging Face datasets...")
        ds = load_dataset(DATASET_ID, split="train")
        return [dict(row) for row in ds]
    except Exception as exc:  # noqa: BLE001 - intentional broad fallback
        print(f"  HF datasets unavailable ({exc.__class__.__name__}): falling back to source parquet.")

    # 3) Pull the parquet, then read it locally.
    try:
        download_parquet()
    except Exception as exc:  # noqa: BLE001 - surface actionable setup
        sys.exit(
            f"ERROR: could not download {PARQUET_URL} ({exc.__class__.__name__}).\n"
            f"Install `datasets`, or place the parquet at {LOCAL_PARQUET}."
        )

    local_rows = load_local_parquet()
    if local_rows is None:
        sys.exit(f"ERROR: downloaded parquet missing at {LOCAL_PARQUET}.")
    return local_rows


def build() -> None:
    rows = load_rows()
    print(f"Loaded {len(rows)} raw rows.")

    readings: list[dict] = []
    by_combo: dict[str, list[int]] = {}
    by_slug: dict[str, list[int]] = {}
    all_slugs: set[str] = set()
    skipped = 0

    for raw in rows:
        # Column names may carry leading spaces in the parquet export.
        def get(col: str):
            if col in raw:
                return raw[col]
            for key in raw:
                if key.strip() == col:
                    return raw[key]
            return None

        cards = [normalize_card_name(get(c)) for c in CARD_COLUMNS]
        reading = (get(READING_COLUMN) or "").strip()

        if not all(cards) or not reading:
            skipped += 1
            continue

        slugs = [slugify(c) for c in cards]
        key = combo_key(slugs)
        index = len(readings)

        readings.append(
            {
                "id": index,
                "cards": cards,
                "cardSlugs": slugs,
                "comboKey": key,
                "reading": reading,
            }
        )

        by_combo.setdefault(key, []).append(index)
        for slug in slugs:
            all_slugs.add(slug)
            by_slug.setdefault(slug, []).append(index)

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    with READINGS_OUT.open("w", encoding="utf-8") as fh:
        json.dump(readings, fh, ensure_ascii=False, separators=(",", ":"))

    index_payload = {
        "meta": {
            "source": DATASET_ID,
            "rowCount": len(readings),
            "uniqueCombos": len(by_combo),
            "uniqueSlugs": len(all_slugs),
        },
        "slugs": sorted(all_slugs),
        # Exact three-card combo -> reading ids (order-independent key).
        "byCombo": by_combo,
        # Single slug -> reading ids, used for overlap-count fallback selection.
        "bySlug": by_slug,
    }

    with INDEX_OUT.open("w", encoding="utf-8") as fh:
        json.dump(index_payload, fh, ensure_ascii=False, separators=(",", ":"))

    readings_kb = READINGS_OUT.stat().st_size / 1024
    index_kb = INDEX_OUT.stat().st_size / 1024

    print(f"\nWrote {READINGS_OUT.relative_to(ROOT)}  ({readings_kb:.1f} KB, {len(readings)} rows)")
    print(f"Wrote {INDEX_OUT.relative_to(ROOT)}  ({index_kb:.1f} KB)")
    print(f"  unique combos: {len(by_combo)}")
    print(f"  unique slugs : {len(all_slugs)}")
    if skipped:
        print(f"  skipped rows : {skipped} (missing card or reading)")
    print("\nDone.")


if __name__ == "__main__":
    build()
