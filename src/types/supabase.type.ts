import type {
  Database as GeneratedDatabase,
  Json,
  Tables,
  TablesInsert,
  TablesUpdate,
} from './database.types';

export type Database = GeneratedDatabase;
export type { Json };

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
export type TaskInsert = TablesInsert<'tasks'>;
export type TaskUpdate = TablesUpdate<'tasks'>;

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
