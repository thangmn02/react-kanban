export type BriefingPinSourceType = 'note' | 'email' | 'chat' | 'meeting';

export interface BriefingPin {
  id: string;
  workspaceId: string;
  createdBy: string;
  sourceType: BriefingPinSourceType;
  sourceLabel: string;
  authorName: string;
  quotedText: string;
  linkUrl: string | null;
  taskId: string | null;
  whyMatters: string;
  pinnedAt: string;
  createdAt: string;
}

export interface CreateBriefingPinInput {
  workspaceId: string;
  createdBy: string;
  sourceType: BriefingPinSourceType;
  sourceLabel: string;
  authorName: string;
  quotedText: string;
  linkUrl?: string | null;
  taskId?: string | null;
  whyMatters: string;
}
