export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      books: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          downloads: number
          file_path: string
          file_size: number | null
          id: string
          title: string
          uploaded_by: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          downloads?: number
          file_path: string
          file_size?: number | null
          id?: string
          title: string
          uploaded_by?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          downloads?: number
          file_path?: string
          file_size?: number | null
          id?: string
          title?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      contest_attempts: {
        Row: {
          answers: Json | null
          contest_id: string
          device_fingerprint: string | null
          id: string
          ip_address: string | null
          is_winner: boolean
          prize_awarded: number
          rank: number | null
          score: number | null
          started_at: string
          status: string
          submitted_at: string | null
          user_id: string
          violations: number
        }
        Insert: {
          answers?: Json | null
          contest_id: string
          device_fingerprint?: string | null
          id?: string
          ip_address?: string | null
          is_winner?: boolean
          prize_awarded?: number
          rank?: number | null
          score?: number | null
          started_at?: string
          status?: string
          submitted_at?: string | null
          user_id: string
          violations?: number
        }
        Update: {
          answers?: Json | null
          contest_id?: string
          device_fingerprint?: string | null
          id?: string
          ip_address?: string | null
          is_winner?: boolean
          prize_awarded?: number
          rank?: number | null
          score?: number | null
          started_at?: string
          status?: string
          submitted_at?: string | null
          user_id?: string
          violations?: number
        }
        Relationships: []
      }
      contests: {
        Row: {
          active: boolean
          category_id: string | null
          contest_type: string
          created_at: string
          duration_minutes: number
          ends_at: string | null
          entry_fee: number
          first_prize: number
          id: string
          max_participants: number
          num_questions: number
          prize_pool: number
          results_status: string
          starts_at: string | null
          title: string
        }
        Insert: {
          active?: boolean
          category_id?: string | null
          contest_type?: string
          created_at?: string
          duration_minutes?: number
          ends_at?: string | null
          entry_fee?: number
          first_prize?: number
          id?: string
          max_participants?: number
          num_questions?: number
          prize_pool?: number
          results_status?: string
          starts_at?: string | null
          title: string
        }
        Update: {
          active?: boolean
          category_id?: string | null
          contest_type?: string
          created_at?: string
          duration_minutes?: number
          ends_at?: string | null
          entry_fee?: number
          first_prize?: number
          id?: string
          max_participants?: number
          num_questions?: number
          prize_pool?: number
          results_status?: string
          starts_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "contests_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      deposit_requests: {
        Row: {
          admin_note: string | null
          amount: number
          created_at: string
          id: string
          payer_upi: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          screenshot_url: string | null
          status: string
          upi_utr: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          created_at?: string
          id?: string
          payer_upi?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          screenshot_url?: string | null
          status?: string
          upi_utr: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          created_at?: string
          id?: string
          payer_upi?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          screenshot_url?: string | null
          status?: string
          upi_utr?: string
          user_id?: string
        }
        Relationships: []
      }
      live_scores: {
        Row: {
          away_score: string
          away_team: string
          created_at: string
          home_score: string
          home_team: string
          id: string
          is_live: boolean
          league: string | null
          match_time: string | null
          sort_order: number
          sport: string
          status: string
          updated_at: string
        }
        Insert: {
          away_score?: string
          away_team: string
          created_at?: string
          home_score?: string
          home_team: string
          id?: string
          is_live?: boolean
          league?: string | null
          match_time?: string | null
          sort_order?: number
          sport?: string
          status?: string
          updated_at?: string
        }
        Update: {
          away_score?: string
          away_team?: string
          created_at?: string
          home_score?: string
          home_team?: string
          id?: string
          is_live?: boolean
          league?: string | null
          match_time?: string | null
          sort_order?: number
          sport?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      missions: {
        Row: {
          active: boolean
          code: string
          created_at: string
          description: string | null
          ends_at: string | null
          goal_type: string
          goal_value: number
          id: string
          kind: string
          reward_box_tier: string | null
          reward_coins: number
          reward_xp: number
          sort_order: number
          starts_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          description?: string | null
          ends_at?: string | null
          goal_type: string
          goal_value?: number
          id?: string
          kind: string
          reward_box_tier?: string | null
          reward_coins?: number
          reward_xp?: number
          sort_order?: number
          starts_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          description?: string | null
          ends_at?: string | null
          goal_type?: string
          goal_value?: number
          id?: string
          kind?: string
          reward_box_tier?: string | null
          reward_coins?: number
          reward_xp?: number
          sort_order?: number
          starts_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      otp_codes: {
        Row: {
          attempts: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          identifier: string
          purpose: string
          user_id: string | null
        }
        Insert: {
          attempts?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          identifier: string
          purpose: string
          user_id?: string | null
        }
        Update: {
          attempts?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          identifier?: string
          purpose?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          banned: boolean
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          phone_verified: boolean
          referral_code: string | null
          wallet_balance: number
        }
        Insert: {
          banned?: boolean
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          phone_verified?: boolean
          referral_code?: string | null
          wallet_balance?: number
        }
        Update: {
          banned?: boolean
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          phone_verified?: boolean
          referral_code?: string | null
          wallet_balance?: number
        }
        Relationships: []
      }
      questions: {
        Row: {
          category_id: string
          correct_index: number
          created_at: string
          difficulty: string | null
          explanation: string | null
          id: string
          options: Json
          question: string
          time_seconds: number
        }
        Insert: {
          category_id: string
          correct_index: number
          created_at?: string
          difficulty?: string | null
          explanation?: string | null
          id?: string
          options: Json
          question: string
          time_seconds?: number
        }
        Update: {
          category_id?: string
          correct_index?: number
          created_at?: string
          difficulty?: string | null
          explanation?: string | null
          id?: string
          options?: Json
          question?: string
          time_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "questions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_boxes: {
        Row: {
          created_at: string
          id: string
          opened: boolean
          opened_at: string | null
          reward_coins: number | null
          reward_xp: number | null
          source: string
          tier: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          opened?: boolean
          opened_at?: string | null
          reward_coins?: number | null
          reward_xp?: number | null
          source: string
          tier?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          opened?: boolean
          opened_at?: string | null
          reward_coins?: number | null
          reward_xp?: number | null
          source?: string
          tier?: string
          user_id?: string
        }
        Relationships: []
      }
      seasonal_events: {
        Row: {
          active: boolean
          banner_url: string | null
          bonus_xp_multiplier: number
          created_at: string
          description: string | null
          ends_at: string
          id: string
          name: string
          reward_pool: number
          starts_at: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          banner_url?: string | null
          bonus_xp_multiplier?: number
          created_at?: string
          description?: string | null
          ends_at: string
          id?: string
          name: string
          reward_pool?: number
          starts_at: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          banner_url?: string | null
          bonus_xp_multiplier?: number
          created_at?: string
          description?: string | null
          ends_at?: string
          id?: string
          name?: string
          reward_pool?: number
          starts_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          note: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          note?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          note?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_missions: {
        Row: {
          claimed_at: string | null
          completed_at: string | null
          created_at: string
          id: string
          mission_id: string
          period_key: string
          progress: number
          updated_at: string
          user_id: string
        }
        Insert: {
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          mission_id: string
          period_key: string
          progress?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          mission_id?: string
          period_key?: string
          progress?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_missions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_xp: {
        Row: {
          boxes_earned: number
          created_at: string
          level: number
          updated_at: string
          user_id: string
          xp: number
        }
        Insert: {
          boxes_earned?: number
          created_at?: string
          level?: number
          updated_at?: string
          user_id: string
          xp?: number
        }
        Update: {
          boxes_earned?: number
          created_at?: string
          level?: number
          updated_at?: string
          user_id?: string
          xp?: number
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          admin_note: string | null
          amount: number
          created_at: string
          id: string
          payout_ref: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          upi_id: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          created_at?: string
          id?: string
          payout_ref?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          upi_id: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          created_at?: string
          id?: string
          payout_ref?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          upi_id?: string
          user_id?: string
        }
        Relationships: []
      }
      xp_events: {
        Row: {
          amount: number
          created_at: string
          id: string
          meta: Json | null
          ref_id: string | null
          source: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          meta?: Json | null
          ref_id?: string | null
          source: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          meta?: Json | null
          ref_id?: string | null
          source?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_declare_contest_result: {
        Args: {
          _attempt_id: string
          _contest_id: string
          _prize: number
          _rank: number
        }
        Returns: undefined
      }
      auto_score_contest: { Args: { _contest_id: string }; Returns: number }
      claim_mission: {
        Args: { _user_mission_id: string }
        Returns: {
          reward_coins: number
          reward_xp: number
        }[]
      }
      grant_xp: {
        Args: {
          _amount: number
          _meta?: Json
          _ref?: string
          _source: string
          _user_id: string
        }
        Returns: {
          leveled_up: boolean
          new_level: number
          new_xp: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_book_download: {
        Args: { _book_id: string }
        Returns: undefined
      }
      join_contest: {
        Args: { _contest_id: string }
        Returns: {
          already: boolean
          attempt_id: string
          charged: number
        }[]
      }
      open_reward_box: {
        Args: { _box_id: string }
        Returns: {
          reward_coins: number
          reward_xp: number
          tier: string
        }[]
      }
      refresh_user_missions: { Args: { _user_id?: string }; Returns: number }
      xp_to_level: { Args: { _xp: number }; Returns: number }
    }
    Enums: {
      app_role: "admin" | "user" | "editor" | "moderator"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user", "editor", "moderator"],
    },
  },
} as const
