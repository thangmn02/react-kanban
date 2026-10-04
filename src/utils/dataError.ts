/** Supabase errors are plain objects, not Error instances. */
export function dataErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error
    && typeof error.message === 'string' && error.message.trim()) return error.message;
  return fallback;
}

export function isMissingDatabaseField(error: unknown, field: string): boolean {
  if (!error || typeof error !== 'object' || !('code' in error)) return false;
  return ['42703', 'PGRST204'].includes(String(error.code))
    && dataErrorMessage(error, '').includes(field);
}

export function isMissingDatabaseTable(error: unknown, tables: string[]): boolean {
  if (!error || typeof error !== 'object' || !('code' in error)) return false;
  return ['42P01', 'PGRST205'].includes(String(error.code))
    && tables.some((table) => dataErrorMessage(error, '').includes(table));
}
