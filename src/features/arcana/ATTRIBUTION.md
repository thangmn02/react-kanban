# Arcana — Asset & Content Attribution

## Card & pack art (DX-Tarots)

The Arcana feature renders pixel-art card faces and booster art derived from the
**DX-Tarots (Deluxe Consumables)** Balatro mod by JeffVi.

- Upstream: https://github.com/JeffVi/DX-Tarots
- License: GPL-3.0 (per the mod repository)
- Bundled assets (copied into `public/arcana/atlas/`):
  - `tarots.png`  — from `assets/2x/Tarots_dx.png` (10×6 grid, 142×190 per frame)
  - `packs.png`   — from `assets/2x/booster_dx.png` (4×9 grid)
  - `minor.png`   — Minor Arcana sheet from the JellyMod assets (7×9 grid)

The sprite sheets follow Balatro's standard 71×95 (2x: 142×190) frame grid. We
slice them with CSS `background-position` (see `arcanaAtlas.ts`); the source PNGs
are used unmodified.

### Important license note

DX-Tarots is GPL-3.0. Bundling its art into this app carries GPL obligations,
and the underlying card imagery may itself derive from Balatro. **Verify license
compatibility and asset provenance before any public/commercial release.** If the
obligations are unacceptable, replace `public/arcana/atlas/*` with original art;
the rest of the feature is asset-path driven and will keep working.

## Foil / holographic behavior

The foil/holo finishes (Holo, Lăng kính, Thiên hà, …) are an original CSS
implementation inspired by general trading-card UX patterns. No Pokémon branding,
Pokémon assets, or third-party holographic code/images are used.

## Reading content

All Vietnamese card meanings, topic/question text, and message templates in this
feature are original to this app. No interpretation text was copied from the
reference mods.

## Three-card reading corpus (Hugging Face: barissglc/tarot)

The reading engine can anchor to a local, static tarot corpus derived from the
**`barissglc/tarot`** Hugging Face dataset (~5,769 three-card spreads; columns
`Card 1`, `Card 2`, `Card 3`, `Reading`).

- The corpus is used **only as a local, offline anchor signal**. Its raw English
  text is never pasted into the UI; visible reading text is composed by
  `arcanaReadingEngine.ts` in the active language, with only broad motifs
  detected from exact/partial corpus matches.
- Dataset page findings checked on 2026-06-13: Hugging Face lists the dataset as
  English text, parquet format, default/train split with 5.77k rows. No explicit
  license field was visible on the dataset page, so verify terms with the
  publisher before redistributing the generated JSON publicly.

### Bundled (runtime) data
- `public/arcana/data/hf_tarot_readings.json` — normalized rows: `{ cards,
  cardSlugs, comboKey, reading }`.
- `public/arcana/data/hf_tarot_index.json` — lookup index: exact unordered
  3-card combo (`byCombo`) + single-slug postings (`bySlug`) for overlap
  fallback.

These JSON files are committed as runtime assets (fetched lazily at runtime via
`hfTarotData.ts`; never fetched from Hugging Face in the browser).

### Documented preprocessing path (regeneration)
To regenerate the JSON:

1. Obtain `barissglc/tarot` with `scripts/pull_hf_tarot.py`, Hugging Face
   `datasets`, or the source parquet export at `public/tarot_readings.parquet`
   (raw parquet is ignored by git).
2. Normalize each card name: trim, lower-case, slugify (`The Sun` → `the-sun`);
   alias `the-wheel-of-fortune` → `wheel-of-fortune` so DX-Tarots card ids match.
3. For each row emit `{ cards, cardSlugs, comboKey, reading }`, where `comboKey`
   is the sorted slugs joined by `|`.
4. Build `byCombo` (comboKey → row ids) and `bySlug` (slug → row ids).
5. Write both files to `public/arcana/data/`.

Card slugs equal the catalog card ids (see `arcanaCards.ts`), so matching is a
direct slug comparison.
