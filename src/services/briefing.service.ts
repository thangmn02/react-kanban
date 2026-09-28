import supabase, { requireSupabaseClient } from '../lib/supabase';
import {
  localCreateBriefingPin,
  localDeleteBriefingPin,
  localFetchBriefingPins,
  localFetchAllTasks,
} from '../infrastructure/local/localBoardStore';
import type { BriefingPin, CreateBriefingPinInput } from '../types/briefing.type';
import type { BriefingPinInsert, BriefingPinRow } from '../types/supabase.type';

function mapBriefingPin(row: BriefingPinRow): BriefingPin {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    createdBy: row.created_by,
    sourceType: row.source_type as BriefingPin['sourceType'],
    sourceLabel: row.source_label,
    authorName: row.author_name,
    quotedText: row.quoted_text,
    linkUrl: row.link_url,
    taskId: row.task_id,
    whyMatters: row.why_matters,
    pinnedAt: row.pinned_at,
    createdAt: row.created_at,
  };
}

export async function fetchBriefingPins(workspaceId: string): Promise<BriefingPin[]> {
  if (!supabase) return localFetchBriefingPins(workspaceId).map(mapBriefingPin);
  const { data, error } = await requireSupabaseClient()
    .from('briefing_pins')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapBriefingPin);
}

export async function createBriefingPin(input: CreateBriefingPinInput): Promise<BriefingPin> {
  const payload: BriefingPinInsert = {
    workspace_id: input.workspaceId,
    created_by: input.createdBy,
    source_type: input.sourceType,
    source_label: input.sourceLabel,
    author_name: input.authorName,
    quoted_text: input.quotedText,
    link_url: input.linkUrl ?? null,
    task_id: input.taskId ?? null,
    why_matters: input.whyMatters,
  };
  if (!supabase) return mapBriefingPin(localCreateBriefingPin(payload));
  const { data, error } = await requireSupabaseClient().from('briefing_pins').insert(payload).select('*').single();
  if (error) throw error;
  if (!data) throw new Error('Briefing pin was not created.');
  return mapBriefingPin(data);
}

export async function deleteBriefingPin(pinId: string): Promise<void> {
  if (!supabase) {
    localDeleteBriefingPin(pinId);
    return;
  }
  const { error } = await requireSupabaseClient().from('briefing_pins').delete().eq('id', pinId);
  if (error) throw error;
}

export async function fetchBriefingPinTaskBoard(workspaceId: string, taskId: string): Promise<string | null> {
  if (!supabase) {
    return localFetchAllTasks(workspaceId).find((task) => task.id === taskId)?.board_id ?? null;
  }
  const { data, error } = await requireSupabaseClient()
    .from('tasks')
    .select('board_id')
    .eq('workspace_id', workspaceId)
    .eq('id', taskId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  return data?.board_id ?? null;
}

export function subscribeToBriefingPins(workspaceId: string, onChange: () => void): () => void {
  if (!supabase) return () => undefined;
  const client = requireSupabaseClient();
  const channel = client.channel(`briefing-pins-realtime-${workspaceId}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'briefing_pins', filter: `workspace_id=eq.${workspaceId}`,
    }, onChange)
    .subscribe();
  return () => { void client.removeChannel(channel); };
}
