// Sprite-atlas helpers for Arcana.
//
// Art assets are derived from two Balatro mods (pixel-art, standard 71x95 grid;
// we use the 2x sheets = 142x190 per frame). See ATTRIBUTION.md.
//
// Major Arcana — DX-Tarots:
//   tarots.png : 1420 x 1140 -> 10 columns x 6 rows
// Minor Arcana — JellyMod:
//   minor.png  :  994 x 1710 ->  7 columns x 9 rows
// Packs — DX-Tarots:
//   packs.png  :  568 x 1710 ->  4 columns x 9 rows

export type ArcanaAtlasName = 'major' | 'minor';

export const arcanaPackAtlasSrc = '/arcana/atlas/packs.png';
export const arcanaPackAtlas = { columns: 4, rows: 9 } as const;

const cardAtlases: Record<ArcanaAtlasName, { src: string; columns: number; rows: number }> = {
  major: { src: '/arcana/atlas/tarots.png', columns: 10, rows: 6 },
  minor: { src: '/arcana/atlas/minor.png', columns: 7, rows: 9 },
};

export interface SpriteStyle {
  backgroundImage: string;
  backgroundSize: string;
  backgroundPosition: string;
  backgroundRepeat: 'no-repeat';
  imageRendering: 'pixelated';
}

function spritePosition(index: number, columns: number, rows: number) {
  const safeIndex = Math.max(0, Math.floor(index));
  const column = safeIndex % columns;
  const row = Math.floor(safeIndex / columns) % rows;
  // Percentage-based background-position keeps the math resolution independent.
  const x = columns > 1 ? (column / (columns - 1)) * 100 : 0;
  const y = rows > 1 ? (row / (rows - 1)) * 100 : 0;
  return { x, y };
}

function spriteStyle(src: string, columns: number, rows: number, index: number): SpriteStyle {
  const { x, y } = spritePosition(index, columns, rows);
  return {
    backgroundImage: `url(${src})`,
    backgroundSize: `${columns * 100}% ${rows * 100}%`,
    backgroundPosition: `${x}% ${y}%`,
    backgroundRepeat: 'no-repeat',
    imageRendering: 'pixelated',
  };
}

export function getArcanaCardSprite(atlas: ArcanaAtlasName, atlasIndex: number): SpriteStyle {
  const { src, columns, rows } = cardAtlases[atlas];
  return spriteStyle(src, columns, rows, atlasIndex);
}

export function getArcanaCardImagePath(atlas: ArcanaAtlasName): string {
  return cardAtlases[atlas].src;
}

export function getArcanaPackSprite(packIndex: number): SpriteStyle {
  return spriteStyle(arcanaPackAtlasSrc, arcanaPackAtlas.columns, arcanaPackAtlas.rows, packIndex);
}
