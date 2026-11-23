/** Labels live in note content so they sync and merge with the note. Nested labels use `/`. */
export const MAX_NOTE_LABELS = 20;
export const MAX_NOTE_LABEL_LENGTH = 50;

export function normalizeLabel(value: string): string {
  return value.split('/').map(part => part.replace(/\s+/g, ' ').trim()).filter(Boolean).join('/').slice(0, MAX_NOTE_LABEL_LENGTH).replace(/\/+$/, '');
}

/** Trimmed, de-duplicated (case-insensitive, first spelling wins) and bounded. Unknown input becomes []. */
export function normalizeLabels(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>(), result: string[] = [];
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const label = normalizeLabel(value), key = label.toLocaleLowerCase();
    if (!label || seen.has(key)) continue;
    seen.add(key); result.push(label);
    if (result.length >= MAX_NOTE_LABELS) break;
  }
  return result;
}

/** A note matches a label filter when it has that label or one nested under it. */
export function hasLabel(labels: readonly string[] | undefined, filter: string): boolean {
  const wanted = filter.toLocaleLowerCase();
  return (labels ?? []).some(label => { const value = label.toLocaleLowerCase(); return value === wanted || value.startsWith(`${wanted}/`); });
}

/** Every label and its parents, with how many notes each covers, sorted by path. */
export function labelCounts(notes: readonly { labels?: string[] }[]): { label: string; count: number }[] {
  const counts = new Map<string, { label: string; ids: Set<number> }>();
  notes.forEach((note, index) => {
    for (const label of normalizeLabels(note.labels)) {
      const parts = label.split('/');
      for (let depth = 1; depth <= parts.length; depth++) {
        const path = parts.slice(0, depth).join('/'), key = path.toLocaleLowerCase();
        const entry = counts.get(key) ?? { label: path, ids: new Set<number>() };
        entry.ids.add(index); counts.set(key, entry);
      }
    }
  });
  return [...counts.values()].map(entry => ({ label: entry.label, count: entry.ids.size })).sort((a, b) => a.label.localeCompare(b.label));
}
