export function normalizeVietnameseText(input: string): string {
  return input.normalize('NFC');
}

export function normalizeVietnameseTextList(items: string[]): string[] {
  return items.map(normalizeVietnameseText);
}
