export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      proposals: {
        Row: {
          id: string
          job_id: string
          user_id: string
          proposal_text: string
          rate: number
          payment_type: "hourly" | "project"
          has_done_before: boolean
          portfolio_images: string[]
          status: "pending" | "accepted" | "rejected"
          created_at: string
          updated_at: string
          currency: string
        }
        Insert: {
          id?: string
          job_id: string
          user_id: string
          proposal_text: string
          rate: number
          payment_type: "hourly" | "project"
          has_done_before: boolean
          portfolio_images?: string[]
          status?: "pending" | "accepted" | "rejected"
          created_at?: string
          updated_at?: string
          currency: string
        }
        Update: {
          id?: string
          job_id?: string
          user_id?: string
          proposal_text?: string
          rate?: number
          payment_type?: "hourly" | "project"
          has_done_before?: boolean
          portfolio_images?: string[]
          status?: "pending" | "accepted" | "rejected"
          created_at?: string
          updated_at?: string
          currency?: string
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
