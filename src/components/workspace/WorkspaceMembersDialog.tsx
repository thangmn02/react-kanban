import { useState, type FormEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import type {
  AppUser,
  WorkspaceInvite,
  WorkspaceInviteActionResult,
  WorkspaceInviteRole,
  WorkspaceMember,
  WorkspaceRole,
  WorkspaceSummary,
} from '../../types/auth.type';
import WorkspaceInviteRow from './WorkspaceInviteRow';
import WorkspaceMemberRow from './WorkspaceMemberRow';
import { Skeleton } from '../atoms/skeleton';
import ErrorState from '../atoms/ErrorState';

interface WorkspaceMembersDialogProps {
  isOpen: boolean;
  workspace: WorkspaceSummary | null;
  currentUser: AppUser;
  members: WorkspaceMember[];
  invites: WorkspaceInvite[];
  isLoading: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onAddMember: (email: string, role: WorkspaceInviteRole) => Promise<WorkspaceInviteActionResult>;
  onRoleChange: (membershipId: string, role: WorkspaceRole) => Promise<void>;
  onRemoveMember: (membershipId: string) => Promise<void>;
  onCancelInvite: (inviteId: string) => Promise<void>;
  onRetry?: () => Promise<void> | void;
}

export default function WorkspaceMembersDialog({
  isOpen,
  workspace,
  currentUser,
  members,
  invites,
  isLoading,
  errorMessage,
  onClose,
  onAddMember,
  onRoleChange,
  onRemoveMember,
  onCancelInvite,
  onRetry,
}: WorkspaceMembersDialogProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<WorkspaceInviteRole>('member');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | null>(null);
  const [submitSuccessMessage, setSubmitSuccessMessage] = useState<string | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const canManageMembers = workspace?.role === 'owner' || workspace?.role === 'admin';

  const buildInviteLink = (token: string) => {
    if (typeof window === 'undefined') {
      return `/invite/${token}`;
    }

    return `${window.location.origin}/invite/${token}`;
  };

  const handleCopyInviteLink = (inviteLink: string) => {
    if (!navigator.clipboard) {
      setSubmitErrorMessage('Clipboard is not available in this browser.');
      return;
    }

    void navigator.clipboard.writeText(inviteLink);
    setSubmitErrorMessage(null);
    setSubmitSuccessMessage('Invite link copied.');
  };

  const getInviteResultMessage = (result: WorkspaceInviteActionResult) => {
    if (result.status === 'member_added') {
      return 'Member added to the workspace.';
    }

    if (result.status === 'invite_existing') {
      return 'A pending invite already exists. Copy the link below.';
    }

    return 'Invite created. Copy the link below and send it to your teammate.';
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {    event.preventDefault();
    setIsSubmitting(true);
    setSubmitErrorMessage(null);
    setSubmitSuccessMessage(null);

    try {
      const result = await onAddMember(email, role);
      setEmail('');
      setRole('member');
      setSubmitSuccessMessage(getInviteResultMessage(result));
    } catch (error) {
      setSubmitErrorMessage(error instanceof Error ? error.message : 'Unable to invite workspace member.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetry = () => {
    if (!onRetry) {
      return;
    }
    setIsRetrying(true);
    void Promise.resolve(onRetry()).finally(() => {
      setIsRetrying(false);
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50">
          <motion.button
            type="button"
            aria-label="Close workspace members dialog"
            className="absolute inset-0 bg-slate-950/30 backdrop-blur-sm"
            initial={shouldReduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="absolute right-0 top-0 flex h-full w-full max-w-lg flex-col overflow-hidden rounded-l-3xl border-l border-slate-200/80 bg-[#F8FAFC] shadow-[0_28px_90px_rgba(15,23,42,0.25)]"
            initial={shouldReduceMotion ? false : { x: 48, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { x: 48, opacity: 0 }}
            transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 28 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="workspace-members-title"
          >
            <header className="border-b border-slate-200/80 bg-white px-6 py-5">
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
                  className="cursor-pointer rounded-full border border-slate-200 bg-white p-2 text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-800 focus:outline-none focus:ring-4 focus:ring-sky-100"
                  aria-label="Close workspace members"
                >
                  <svg className="h-5 w-5" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto px-6 py-5" aria-busy={isLoading}>
              {canManageMembers && (
                <form onSubmit={handleSubmit} className="mb-5 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card">
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
                      onChange={(event) => setRole(event.target.value as WorkspaceInviteRole)}
                      className="cursor-pointer rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
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
                    className="mt-3 cursor-pointer rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(37,99,235,0.25)] transition hover:-translate-y-0.5 hover:bg-blue-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting ? 'Sending...' : 'Invite member'}
                  </button>
                  {submitSuccessMessage && (
                    <p className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                      {submitSuccessMessage}
                    </p>
                  )}
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
                <div className="mb-4">
                  <ErrorState
                    title="Couldn't load members"
                    description="We couldn't load this workspace's members and invites. Try again."
                    details={errorMessage}
                    onRetry={onRetry ? handleRetry : undefined}
                    isRetrying={isRetrying}
                    compact
                  />
                </div>
              )}

              <section className="space-y-3">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Current members
                  </h3>
                </div>
                {isLoading ? (
                  <div aria-hidden="true" className="space-y-2">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3"
                      >
                        <Skeleton className="h-9 w-9" rounded="rounded-full" />
                        <div className="min-w-0 flex-1">
                          <Skeleton className="h-3.5 w-32" />
                          <Skeleton className="mt-2 h-3 w-44" />
                        </div>
                        <Skeleton className="h-6 w-16" rounded="rounded-full" />
                      </div>
                    ))}
                  </div>
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
              </section>

              <section className="mt-6 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Pending invites
                  </h3>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                    {invites.length}
                  </span>
                </div>

                {isLoading ? (
                  <div aria-hidden="true" className="space-y-2">
                    {Array.from({ length: 2 }).map((_, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <Skeleton className="h-3.5 w-40" />
                          <Skeleton className="mt-2 h-3 w-28" />
                        </div>
                        <Skeleton className="h-6 w-20" rounded="rounded-full" />
                      </div>
                    ))}
                  </div>
                ) : invites.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-6 text-center text-sm text-slate-500">
                    No pending invites.
                  </p>
                ) : (
                  invites.map((invite) => (
                    <WorkspaceInviteRow
                      key={invite.id}
                      invite={invite}
                      inviteLink={buildInviteLink(invite.token)}
                      canManageMembers={canManageMembers}
                      onCopyLink={handleCopyInviteLink}
                      onCancelInvite={onCancelInvite}
                    />
                  ))
                )}
              </section>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
