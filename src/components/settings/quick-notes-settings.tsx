import { Switch } from '@astryxdesign/core/Switch';
import { isTauri } from '@tauri-apps/api/core';
import { useI18n } from '../../i18n';
import { setFloatingQuickNotes, useFloatingQuickNotes } from '../../features/notes/quick-notes-preferences';

/** Desktop only: Quick Notes open as floating note windows (default) or as the in-app card. */
export default function QuickNotesSettings() {
  const { t } = useI18n();
  const floating = useFloatingQuickNotes();
  if (!isTauri()) return null;
  return <Switch label={t('settings.floatingQuickNotes')} description={t('settings.floatingQuickNotesHint')} value={floating} onChange={setFloatingQuickNotes} />;
}
