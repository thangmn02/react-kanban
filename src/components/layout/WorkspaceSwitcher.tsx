import type { WorkspaceSummary } from '../../types/auth.type';
import { useI18n } from '../../i18n';

interface WorkspaceSwitcherProps {
  workspaces: WorkspaceSummary[];
  activeWorkspaceId: string | null;
  onWorkspaceChange: (workspaceId: string | null) => void;
}

export default function WorkspaceSwitcher({
  workspaces,
  activeWorkspaceId,
  onWorkspaceChange,
}: WorkspaceSwitcherProps) {
  const { t } = useI18n();

  if (workspaces.length === 0) {
    return null;
  }

  return (
    <label className="flex min-w-0 items-center gap-2">
      <span className="sr-only">{t('app.activeWorkspace')}</span>
      <select
        value={activeWorkspaceId || ''}
        onChange={(event) => onWorkspaceChange(event.target.value || null)}
        className="max-w-28 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm font-medium text-slate-700 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100 sm:max-w-48"
        aria-label={t('app.activeWorkspace')}
      >
        {workspaces.map((workspace) => {
          const sameName = workspaces.filter((candidate) => candidate.name === workspace.name)
            .sort((a, b) => a.id.localeCompare(b.id));
          const label = sameName.length > 1
            ? `${workspace.name} (${sameName.findIndex((candidate) => candidate.id === workspace.id) + 1})`
            : workspace.name;
          return <option key={workspace.id} value={workspace.id}>{label}</option>;
        })}
      </select>
    </label>
  );
}
