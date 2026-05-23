export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            tasks: {
                Row: {
                    id: string
                    list_id: string
                    title: string
                    description: string | null
                    priority: string
                    due_date: string | null
                    position: number
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    list_id: string
                    title: string
                    description?: string | null
                    priority?: string
                    due_date?: string | null
                    position: number
                }
                Update: {
                    id?: string
                    list_id?: string
                    title?: string
                    description?: string | null
                    priority?: string
                    due_date?: string | null
                    position?: number
                }
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            [_ in never]: never
        }
        Enums: {
            [_ in never]: never
        }
    }
}
