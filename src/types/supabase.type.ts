import type {
  Database as GeneratedDatabase,
  Json,
  Tables,
  TablesInsert,
  TablesUpdate,
} from './database.types';

// Optional task fields are proposed separately from the hosted schema snapshot.
// Keep the generated baseline intact; services handle exact missing-column errors.
type TaskTable = GeneratedDatabase['public']['Tables']['tasks'];
export type Database = Omit<GeneratedDatabase, 'public'> & {
  public: Omit<GeneratedDatabase['public'], 'Tables'> & {
    Tables: Omit<GeneratedDatabase['public']['Tables'], 'tasks'> & {
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
