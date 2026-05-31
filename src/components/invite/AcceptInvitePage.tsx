import { useCallback, useEffect, useMemo, useState } from 'react';

import { acceptWorkspaceInvite, fetchWorkspaceInviteByToken } from '../../services/invite.service';
import type { AppUser, WorkspaceInvite } from '../../types/auth.type';

interface AcceptInvitePageProps {
  token: string | null;
  currentUser: AppUser;
  onAccepted: (workspaceId: string) => Promise<void>;
  onGoHome: () => void;
  onSignOut: () => Promise<void>;
}

function isInviteExpired(invite: WorkspaceInvite) {
  return new Date(invite.expiresAt).getTime() <= Date.now();
}

function formatInviteDate(date: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
}

export default function AcceptInvitePage({
  token,
  currentUser,
  onAccepted,
  onGoHome,
  onSignOut,
}: AcceptInvitePageProps) {
  const [invite, setInvite] = useState<WorkspaceInvite | null>(null);
  const [isLoadingInvite, setIsLoadingInvite] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const emailMatchesInvite = useMemo(() => {
    if (!invite || !currentUser.email) {
      return false;
    }

    return invite.email.toLowerCase() === currentUser.email.toLowerCase();
  }, [currentUser.email, invite]);

  useEffect(() => {
    let isMounted = true;

    const loadInvite = async () => {
      if (!token) {
        setErrorMessage('Invite link is missing a token.');
        setIsLoadingInvite(false);
        return;
      }

      setIsLoadingInvite(true);

      try {
        const nextInvite = await fetchWorkspaceInviteByToken(token);

        if (!isMounted) {
          return;
        }

        setInvite(nextInvite);
        setErrorMessage(nextInvite ? null : 'Invite was not found for this signed-in email.');
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : 'Unable to load invite.');
        }
      } finally {
        if (isMounted) {
          setIsLoadingInvite(false);
        }
      }
    };

    void loadInvite();

    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleAcceptInvite = useCallback(async () => {
    if (!token) {
      setErrorMessage('Invite link is missing a token.');
      return;
    }

    if (!invite) {
      setErrorMessage('Invite was not found.');
      return;
    }

    if (!currentUser.email) {
      setErrorMessage('Your account does not have an email address. Please sign in again.');
      return;
    }

    if (!emailMatchesInvite) {
      setErrorMessage('This invite is for a different email address.');
      return;
    }

    if (isInviteExpired(invite)) {
      setErrorMessage('This invite has expired. Ask the workspace owner to send a new invite.');
      return;
    }

    setIsAccepting(true);
    setErrorMessage(null);

    try {
      const result = await acceptWorkspaceInvite(token);
      setStatusMessage(result.status === 'already_accepted'
        ? 'Invite already accepted. Opening workspace...'
        : 'Invite accepted. Opening workspace...');
      await onAccepted(result.workspace_id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to accept invite.');
    } finally {
      setIsAccepting(false);
    }
  }, [currentUser.email, emailMatchesInvite, invite, onAccepted, token]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#eef6ff,transparent_34%),#F8F9FA] px-5 py-10">
      <section className="w-full max-w-xl rounded-[32px] border border-white/80 bg-white/92 p-6 shadow-[0_28px_90px_rgba(15,23,42,0.13)] backdrop-blur-xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-blue-600">
              Workspace invite
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-950">
              Join a Kanban workspace
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Signed in as {currentUser.email || currentUser.name}.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void onSignOut()}
            className="cursor-pointer rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-sky-100"
          >
            Switch user
          </button>
        </div>

        <div className="mt-7 rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
          {isLoadingInvite ? (
            <p className="text-sm text-slate-500">Loading invite...</p>
          ) : invite ? (
            <div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{invite.email}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Role: <span className="font-semibold capitalize text-slate-700">{invite.role}</span>
                  </p>
                </div>
                <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold capitalize text-blue-700">
                  {invite.role}
                </span>
              </div>
              <p className="mt-4 text-sm text-slate-500">
                Expires {formatInviteDate(invite.expiresAt)}
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No invite details available.</p>
          )}
        </div>

        {invite && !emailMatchesInvite && (
          <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            This invite belongs to {invite.email}. Sign in with that email to accept it.
          </p>
        )}

        {invite?.acceptedAt && (
          <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            This invite has already been accepted.
          </p>
        )}

        {errorMessage && (
          <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </p>
        )}

        {statusMessage && (
          <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {statusMessage}
          </p>
        )}

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            disabled={isLoadingInvite || isAccepting || !invite || !emailMatchesInvite || Boolean(invite.acceptedAt)}
            onClick={() => void handleAcceptInvite()}
            className="cursor-pointer rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(37,99,235,0.28)] transition hover:-translate-y-0.5 hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60"
          >
            {isAccepting ? 'Accepting...' : 'Accept invite'}
          </button>
          <button
            type="button"
            onClick={onGoHome}
            className="cursor-pointer rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-sky-100"
          >
            Go to dashboard
          </button>
        </div>
      </section>
    </main>
  );
}
