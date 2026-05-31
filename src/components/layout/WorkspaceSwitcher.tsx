import type { WorkspaceSummary } from '../../types/auth.type';

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
  if (workspaces.length === 0) {
    return null;
  }

  return (
    <label className="hidden items-center gap-2 md:flex">
      <span className="sr-only">Active workspace</span>
      <select
        value={activeWorkspaceId || ''}
        onChange={(event) => onWorkspaceChange(event.target.value || null)}
        className="max-w-48 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
        aria-label="Active workspace"
      >
        {workspaces.map((workspace) => (
          <option key={workspace.id} value={workspace.id}>
            {workspace.name}
          </option>
        ))}
      </select>
    </label>
  );
}
