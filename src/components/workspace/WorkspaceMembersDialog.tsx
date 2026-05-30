import { useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import type { AppUser, WorkspaceMember, WorkspaceRole, WorkspaceSummary } from '../../types/auth.type';
import WorkspaceMemberRow from './WorkspaceMemberRow';

interface WorkspaceMembersDialogProps {
  isOpen: boolean;
  workspace: WorkspaceSummary | null;
  currentUser: AppUser;
  members: WorkspaceMember[];
  isLoading: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onAddMember: (email: string, role: WorkspaceRole) => Promise<void>;
  onRoleChange: (membershipId: string, role: WorkspaceRole) => Promise<void>;
  onRemoveMember: (membershipId: string) => Promise<void>;
}

export default function WorkspaceMembersDialog({
  isOpen,
  workspace,
  currentUser,
  members,
  isLoading,
  errorMessage,
  onClose,
  onAddMember,
  onRoleChange,
  onRemoveMember,
}: WorkspaceMembersDialogProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<WorkspaceRole>('member');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | null>(null);
  const canManageMembers = workspace?.role === 'owner' || workspace?.role === 'admin';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setSubmitErrorMessage(null);

    try {
      await onAddMember(email, role);
      setEmail('');
      setRole('member');
    } catch (error) {
      setSubmitErrorMessage(error instanceof Error ? error.message : 'Unable to add workspace member.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50">
          <motion.button
            type="button"
            aria-label="Close workspace members dialog"
            className="absolute inset-0 bg-slate-950/30 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="absolute right-0 top-0 flex h-full w-full max-w-lg flex-col overflow-hidden rounded-l-[2rem] border-l border-white/70 bg-[#F8FAFC]/95 shadow-[0_28px_90px_rgba(15,23,42,0.25)] backdrop-blur-2xl"
            initial={{ x: 48, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 48, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="workspace-members-title"
          >
            <header className="border-b border-slate-200/80 bg-white/78 px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-600">
                    Small team
                  </p>
                  <h2 id="workspace-members-title" className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                    Workspace members
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Manage access for {workspace?.name || 'this workspace'}.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full border border-slate-200 bg-white p-2 text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-800 focus:outline-none focus:ring-4 focus:ring-sky-100"
                  aria-label="Close workspace members"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {canManageMembers && (
                <form onSubmit={handleSubmit} className="mb-5 rounded-[1.5rem] border border-white/80 bg-white/82 p-4 shadow-[0_12px_32px_rgba(15,23,42,0.08)]">
                  <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500" htmlFor="workspace-member-email">
                    Add member by email
                  </label>
                  <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                    <input
                      id="workspace-member-email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="teammate@example.com"
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                      required
                    />
                    <select
                      value={role}
                      onChange={(event) => setRole(event.target.value as WorkspaceRole)}
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                      aria-label="New member role"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="mt-3 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(37,99,235,0.25)] transition hover:-translate-y-0.5 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting ? 'Adding...' : 'Add member'}
                  </button>
                  {submitErrorMessage && (
                    <p className="mt-3 rounded-2xl border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                      {submitErrorMessage}
                    </p>
                  )}
                </form>
              )}

              {!canManageMembers && (
                <p className="mb-5 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-500">
                  Your role can view members but cannot manage workspace access.
                </p>
              )}

              {errorMessage && (
                <p className="mb-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {errorMessage}
                </p>
              )}

              <div className="space-y-3">
                {isLoading ? (
                  <p className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-5 text-center text-sm text-slate-500">
                    Loading members...
                  </p>
                ) : members.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-8 text-center text-sm text-slate-500">
                    No members found in this workspace.
                  </p>
                ) : (
                  members.map((member) => (
                    <WorkspaceMemberRow
                      key={member.id}
                      member={member}
                      currentUser={currentUser}
                      canManageMembers={canManageMembers}
                      onRoleChange={onRoleChange}
                      onRemoveMember={onRemoveMember}
                    />
                  ))
                )}
              </div>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
