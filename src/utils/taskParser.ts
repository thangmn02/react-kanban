export function parseTaskLines(value: string): string[] {
  if (!value) return [];
  
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}
