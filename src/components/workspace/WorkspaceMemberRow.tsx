import type { AppUser, WorkspaceMember, WorkspaceRole } from '../../types/auth.type';

const editableRoles: WorkspaceRole[] = ['admin', 'member', 'viewer'];

interface WorkspaceMemberRowProps {
  member: WorkspaceMember;
  currentUser: AppUser;
  canManageMembers: boolean;
  onRoleChange: (membershipId: string, role: WorkspaceRole) => Promise<void>;
  onRemoveMember: (membershipId: string) => Promise<void>;
}

export default function WorkspaceMemberRow({
  member,
  currentUser,
  canManageMembers,
  onRoleChange,
  onRemoveMember,
}: WorkspaceMemberRowProps) {
  const isCurrentUser = member.userId === currentUser.id;
  const isOwner = member.role === 'owner';
  const canEditMember = canManageMembers && !isOwner && !isCurrentUser;

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/80 p-3 shadow-sm">
      <div className="flex min-w-0 items-center gap-3">
        <img
          src={member.avatarUrl}
          alt={member.name}
          className="h-10 w-10 rounded-full border border-white object-cover shadow-sm"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">
            {member.name}
            {isCurrentUser && <span className="ml-1 text-xs font-medium text-slate-400">(you)</span>}
          </p>
          <p className="truncate text-xs text-slate-500">{member.email || 'No email profile'}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {canEditMember ? (
          <select
            value={member.role}
            onChange={(event) => void onRoleChange(member.id, event.target.value as WorkspaceRole)}
            className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold capitalize text-slate-700 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
            aria-label={`Change role for ${member.name}`}
          >
            {editableRoles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        ) : (
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold capitalize text-slate-600">
            {member.role}
          </span>
        )}

        {canEditMember && (
          <button
            type="button"
            onClick={() => void onRemoveMember(member.id)}
            className="rounded-xl border border-rose-100 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-600 transition hover:border-rose-200 hover:bg-rose-100 focus:outline-none focus:ring-4 focus:ring-rose-100"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
