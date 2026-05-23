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
          is_done: boolean;
          position: number;
          created_at: string;
          updated_at: string | null;
          deleted_at: string | null;
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
          is_done?: boolean;
          position?: number;
          created_at?: string;
          updated_at?: string | null;
          deleted_at?: string | null;
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
          is_done?: boolean;
          position?: number;
          created_at?: string;
          updated_at?: string | null;
          deleted_at?: string | null;
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
