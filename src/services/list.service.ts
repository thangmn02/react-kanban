import supabase, { requireSupabaseClient } from '../lib/supabase';
import type { ListInsert, ListRow } from '../types/supabase.type';
import {
  localCreateList,
  localDeleteList,
  localUpdateListPositions,
} from '../infrastructure/local/localBoardStore';

interface UpdateListPositionPayload {
  id: string;
  position: number;
}

export async function createList(listData: ListInsert): Promise<ListRow> {
  if (!supabase) {
    return localCreateList(listData);
  }

  const client = requireSupabaseClient();
  const { data, error } = await client
    .from('lists')
    .insert(listData)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteList(listId: string): Promise<void> {
  if (!supabase) {
    localDeleteList(listId);
    return;
  }

  const client = requireSupabaseClient();
  const { error } = await client
    .from('lists')
    .delete()
    .eq('id', listId);

  if (error) {
    throw error;
  }
}

export async function updateListPositions(listPositions: UpdateListPositionPayload[]): Promise<void> {
  if (!supabase) {
    localUpdateListPositions(listPositions);
    return;
  }

  const client = requireSupabaseClient();
  await Promise.all(listPositions.map(async ({ id, position }) => {
    const { error } = await client
      .from('lists')
      .update({ position })
      .eq('id', id);

    if (error) {
      throw error;
    }
  }));
}
