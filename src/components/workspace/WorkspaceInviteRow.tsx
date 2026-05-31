import type { WorkspaceInvite } from '../../types/auth.type';

interface WorkspaceInviteRowProps {
  invite: WorkspaceInvite;
  inviteLink: string;
  canManageMembers: boolean;
  onCopyLink: (inviteLink: string) => void;
  onCancelInvite: (inviteId: string) => Promise<void>;
}

function formatInviteExpiry(expiresAt: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(expiresAt));
}

export default function WorkspaceInviteRow({
  invite,
  inviteLink,
  canManageMembers,
  onCopyLink,
  onCancelInvite,
}: WorkspaceInviteRowProps) {
  return (
    <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{invite.email}</p>
          <p className="mt-1 text-xs text-slate-500">
            Pending {invite.role} invite · expires {formatInviteExpiry(invite.expiresAt)}
          </p>
        </div>
        <span className="rounded-full border border-amber-200 bg-white/70 px-2.5 py-1 text-xs font-semibold capitalize text-amber-700">
          {invite.role}
        </span>
      </div>

      {canManageMembers && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onCopyLink(inviteLink)}
            className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-sky-100"
          >
            Copy link
          </button>
          <button
            type="button"
            onClick={() => void onCancelInvite(invite.id)}
            className="cursor-pointer rounded-xl border border-rose-100 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 focus:outline-none focus:ring-4 focus:ring-rose-100"
          >
            Cancel invite
          </button>
        </div>
      )}
    </div>
  );
}
