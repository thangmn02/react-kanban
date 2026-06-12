# Arcana — Asset & Content Attribution

## Card & pack art (DX-Tarots)

The Arcana feature renders pixel-art card faces and booster art derived from the
**DX-Tarots (Deluxe Consumables)** Balatro mod by JeffVi.

- Upstream: https://github.com/JeffVi/DX-Tarots
- License: GPL-3.0 (per the mod repository)
- Bundled assets (copied into `public/arcana/atlas/`):
  - `tarots.png`  — from `assets/2x/Tarots_dx.png` (10×6 grid, 142×190 per frame)
  - `packs.png`   — from `assets/2x/booster_dx.png` (4×9 grid)

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
