import type { NextSteps } from '../../features/focus/next-steps';

export interface ResumeCandidate { id: string; title: string; boardId: string; boardTitle: string }

/** The unfinished task paused most recently, among the tasks Home can start. */
export function pickResumeTask<T extends ResumeCandidate>(candidates: T[], nextSteps: NextSteps): T | undefined {
  return candidates.filter(task => nextSteps[task.id]?.pausedAt)
    .sort((a, b) => nextSteps[b.id]!.pausedAt!.localeCompare(nextSteps[a.id]!.pausedAt!))[0];
}
