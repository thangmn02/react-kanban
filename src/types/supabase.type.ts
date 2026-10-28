import type {
  Database as GeneratedDatabase,
  Json,
  Tables,
  TablesInsert,
  TablesUpdate,
} from './database.types';
import type { NoteRow, NoteAccessRow, NoteComment, NotePresentationRow, NoteTaskLink, NoteImage } from '../features/notes/notes-types';
import type { TaskComment } from './saved-context.type';

type NoteTable<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: [] };
type NoteRpc = { Args: { request: Json }; Returns: Json };

// Optional task fields are proposed separately from the hosted schema snapshot.
// Keep the generated baseline intact; services handle exact missing-column errors.
type TaskTable = GeneratedDatabase['public']['Tables']['tasks'];
export type Database = Omit<GeneratedDatabase, 'public'> & {
  public: Omit<GeneratedDatabase['public'], 'Tables'> & {
    Functions: GeneratedDatabase['public']['Functions'] & {
      transition_task_workflow: { Args: { request: Json }; Returns: Json };
      save_note: NoteRpc;
      set_note_access: NoteRpc;
      set_note_deleted: NoteRpc;
      save_note_presentation: NoteRpc;
      mutate_note_comment: NoteRpc;
      reserve_note_image: NoteRpc;
      finalize_note_image: NoteRpc;
      retire_note_image: NoteRpc;
      move_note: NoteRpc;
      mutate_task_comment:NoteRpc;
      set_saved_context:NoteRpc;
      restore_note_revision:NoteRpc;
      list_saved_context:{Args:{actor_user_id:string};Returns:Json};
    };
    Tables: Omit<GeneratedDatabase['public']['Tables'], 'tasks'> & {
      notes: NoteTable<NoteRow>;
      note_access: NoteTable<NoteAccessRow>;
      note_comments: NoteTable<NoteComment>;
      note_user_presentation: NoteTable<NotePresentationRow>;
      note_task_links: NoteTable<NoteTaskLink>;
      note_images: NoteTable<NoteImage>;
      task_comments:NoteTable<TaskComment>;
      note_revisions:NoteTable<{id:string;note_id:string;revision:number;title:string;content:Json;write_token:string;saved_at:string}>;
      tasks: Omit<TaskTable, 'Row' | 'Insert' | 'Update'> & { Row: TaskRow; Insert: TaskInsert; Update: TaskUpdate };
    };
  };
};
export type { Json };

export type BriefingPinRow = Tables<'briefing_pins'>;
export type BriefingPinInsert = TablesInsert<'briefing_pins'>;
export type BriefingPinUpdate = TablesUpdate<'briefing_pins'>;

export type ProfileRow = Tables<'profiles'>;
export type ProfileInsert = TablesInsert<'profiles'>;
export type ProfileUpdate = TablesUpdate<'profiles'>;

export type WorkspaceRow = Tables<'workspaces'>;
export type WorkspaceInsert = TablesInsert<'workspaces'>;
export type WorkspaceUpdate = TablesUpdate<'workspaces'>;

export type WorkspaceMemberRow = Tables<'workspace_members'>;
export type WorkspaceMemberInsert = TablesInsert<'workspace_members'>;
export type WorkspaceMemberUpdate = TablesUpdate<'workspace_members'>;

export type BoardRow = Tables<'boards'>;
export type BoardInsert = TablesInsert<'boards'>;
export type BoardUpdate = TablesUpdate<'boards'>;

export type ListRow = Tables<'lists'>;
export type ListInsert = TablesInsert<'lists'>;
export type ListUpdate = TablesUpdate<'lists'>;

export type TaskRow = Tables<'tasks'> & {
  attachments?: Json | null;
};
export type TaskInsert = TablesInsert<'tasks'> & { attachments?: Json };
export type TaskUpdate = TablesUpdate<'tasks'> & { attachments?: Json };

export type TaskChecklistItemRow = Tables<'task_checklist_items'>;
export type TaskChecklistItemInsert = TablesInsert<'task_checklist_items'>;
export type TaskChecklistItemUpdate = TablesUpdate<'task_checklist_items'>;

export type TaskLabelRow = Tables<'task_labels'>;
export type TaskLabelInsert = TablesInsert<'task_labels'>;
export type TaskLabelUpdate = TablesUpdate<'task_labels'>;

export type TaskLabelLinkRow = Tables<'task_label_links'>;
export type TaskLabelLinkInsert = TablesInsert<'task_label_links'>;
export type TaskLabelLinkUpdate = TablesUpdate<'task_label_links'>;

export type TaskActivityRow = Tables<'task_activities'>;
export type TaskActivityInsert = TablesInsert<'task_activities'>;
export type TaskActivityUpdate = TablesUpdate<'task_activities'>;

export interface HolidayRow {
  id: string;
  name: string;
  date: string;
  country_code: string;
  created_at: string;
}

export type HolidayInsert = HolidayRow;
export type HolidayUpdate = Partial<HolidayRow>;
