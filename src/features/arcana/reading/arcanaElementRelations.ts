import type { ArcanaElement } from './arcanaCardSemantics';

// ---------------------------------------------------------------------------
// Arcana V2 — elemental relationship model
//
// The classic dignity scheme, kept as an explicit, configurable table instead
// of being buried inside conditionals:
//   - resonance: same element — the pair amplifies one shared current.
//   - support:   fire feeds on air; water settles into earth (friendly suits).
//   - tension:   fire vs water; air vs earth (contrary dignities).
//   - neutral:   fire ~ earth; air ~ water (neither feeds nor fights).
//   - spirit:    outside the cycle — never dominant, never conflicting.
// ---------------------------------------------------------------------------

export type ArcanaElementRelation = 'resonance' | 'support' | 'tension' | 'neutral';

const R = 'resonance' as const;
const S = 'support' as const;
const T = 'tension' as const;
const N = 'neutral' as const;

export const arcanaElementRelations: Record<ArcanaElement, Record<ArcanaElement, ArcanaElementRelation>> = {
  fire: { fire: R, water: T, air: S, earth: N, spirit: N },
  water: { fire: T, water: R, air: N, earth: S, spirit: N },
  air: { fire: S, water: N, air: R, earth: T, spirit: N },
  earth: { fire: N, water: S, air: T, earth: R, spirit: N },
  spirit: { fire: N, water: N, air: N, earth: N, spirit: R },
};

/** Relationship between two elements (order-independent by construction). */
export function getArcanaElementRelation(a: ArcanaElement, b: ArcanaElement): ArcanaElementRelation {
  return arcanaElementRelations[a][b];
}

/** Whether this relationship is worth narrating as a spread-level signal. */
export function isNotableRelation(relation: ArcanaElementRelation): boolean {
  return relation !== 'neutral';
}
