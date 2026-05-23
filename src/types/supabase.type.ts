export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      boards: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      lists: {
        Row: {
          id: string;
          board_id: string;
          title: string;
          position: number;
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          board_id: string;
          title: string;
          position?: number;
          created_at?: string;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          board_id?: string;
          title?: string;
          position?: number;
          created_at?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'lists_board_id_fkey';
            columns: ['board_id'];
            isOneToOne: false;
            referencedRelation: 'boards';
            referencedColumns: ['id'];
          }
        ];
      };
      tasks: {
        Row: {
          id: string;
          board_id: string;
          list_id: string;
          title: string;
          description: string | null;
          priority: 'High' | 'Medium' | 'Low' | 'Lowest' | null;
          start_date: string | null;
          due_date: string | null;
          category1: string | null;
          category2: string | null;
          assignees: Json | null;
          image: string | null;
          attachments: Json | null;
          is_done: boolean;
          position: number;
          created_at: string;
          updated_at: string | null;
          deleted_at: string | null;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          board_id: string;
          list_id: string;
          title: string;
          description?: string | null;
          priority?: 'High' | 'Medium' | 'Low' | 'Lowest' | null;
          start_date?: string | null;
          due_date?: string | null;
          category1?: string | null;
          category2?: string | null;
          assignees?: Json | null;
          image?: string | null;
          attachments?: Json | null;
          is_done?: boolean;
          position?: number;
          created_at?: string;
          updated_at?: string | null;
          deleted_at?: string | null;
          archived_at?: string | null;
        };
        Update: {
          id?: string;
          board_id?: string;
          list_id?: string;
          title?: string;
          description?: string | null;
          priority?: 'High' | 'Medium' | 'Low' | 'Lowest' | null;
          start_date?: string | null;
          due_date?: string | null;
          category1?: string | null;
          category2?: string | null;
          assignees?: Json | null;
          image?: string | null;
          attachments?: Json | null;
          is_done?: boolean;
          position?: number;
          created_at?: string;
          updated_at?: string | null;
          deleted_at?: string | null;
          archived_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'tasks_board_id_fkey';
            columns: ['board_id'];
            isOneToOne: false;
            referencedRelation: 'boards';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tasks_list_id_fkey';
            columns: ['list_id'];
            isOneToOne: false;
            referencedRelation: 'lists';
            referencedColumns: ['id'];
          }
        ];
      };
      task_checklist_items: {
        Row: {
          id: string;
          task_id: string;
          content: string;
          is_done: boolean;
          position: number;
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id: string;
          task_id: string;
          content: string;
          is_done?: boolean;
          position?: number;
          created_at?: string;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          task_id?: string;
          content?: string;
          is_done?: boolean;
          position?: number;
          created_at?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'task_checklist_items_task_id_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          }
        ];
      };
      task_labels: {
        Row: {
          id: string;
          board_id: string;
          name: string;
          color: string;
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id: string;
          board_id: string;
          name: string;
          color: string;
          created_at?: string;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          board_id?: string;
          name?: string;
          color?: string;
          created_at?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'task_labels_board_id_fkey';
            columns: ['board_id'];
            isOneToOne: false;
            referencedRelation: 'boards';
            referencedColumns: ['id'];
          }
        ];
      };
      task_label_links: {
        Row: {
          task_id: string;
          label_id: string;
          created_at: string;
        };
        Insert: {
          task_id: string;
          label_id: string;
          created_at?: string;
        };
        Update: {
          task_id?: string;
          label_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'task_label_links_task_id_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_label_links_label_id_fkey';
            columns: ['label_id'];
            isOneToOne: false;
            referencedRelation: 'task_labels';
            referencedColumns: ['id'];
          }
        ];
      };
      task_activities: {
        Row: {
          id: string;
          task_id: string;
          action: string;
          details: Json;
          actor: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          action: string;
          details: Json;
          actor: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          action?: string;
          details?: Json;
          actor?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'task_activities_task_id_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type BoardRow = Database['public']['Tables']['boards']['Row'];
export type BoardInsert = Database['public']['Tables']['boards']['Insert'];
export type BoardUpdate = Database['public']['Tables']['boards']['Update'];

export type ListRow = Database['public']['Tables']['lists']['Row'];
export type ListInsert = Database['public']['Tables']['lists']['Insert'];
export type ListUpdate = Database['public']['Tables']['lists']['Update'];

export type TaskRow = Database['public']['Tables']['tasks']['Row'];
export type TaskInsert = Database['public']['Tables']['tasks']['Insert'];
export type TaskUpdate = Database['public']['Tables']['tasks']['Update'];
export type TaskChecklistItemRow = Database['public']['Tables']['task_checklist_items']['Row'];
export type TaskChecklistItemInsert = Database['public']['Tables']['task_checklist_items']['Insert'];
export type TaskChecklistItemUpdate = Database['public']['Tables']['task_checklist_items']['Update'];
export type TaskLabelRow = Database['public']['Tables']['task_labels']['Row'];
export type TaskLabelInsert = Database['public']['Tables']['task_labels']['Insert'];
export type TaskLabelUpdate = Database['public']['Tables']['task_labels']['Update'];
export type TaskLabelLinkRow = Database['public']['Tables']['task_label_links']['Row'];
export type TaskLabelLinkInsert = Database['public']['Tables']['task_label_links']['Insert'];
export type TaskLabelLinkUpdate = Database['public']['Tables']['task_label_links']['Update'];
export type TaskActivityRow = Database['public']['Tables']['task_activities']['Row'];
export type TaskActivityInsert = Database['public']['Tables']['task_activities']['Insert'];
export type TaskActivityUpdate = Database['public']['Tables']['task_activities']['Update'];
