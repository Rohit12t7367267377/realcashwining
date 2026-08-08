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
      ad_targets: {
        Row: {
          ad_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          ad_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          ad_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_targets_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ads"
            referencedColumns: ["id"]
          },
        ]
      }
      ads: {
        Row: {
          active: boolean
          audience: string
          body: string | null
          created_at: string
          cta_label: string | null
          ends_at: string | null
          id: string
          image_url: string | null
          link_url: string | null
          starts_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          audience?: string
          body?: string | null
          created_at?: string
          cta_label?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          link_url?: string | null
          starts_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          audience?: string
          body?: string | null
          created_at?: string
          cta_label?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          link_url?: string | null
          starts_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
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
      anticheat_events: {
        Row: {
          attempt_id: string | null
          created_at: string
          event_type: string
          id: string
          meta: Json | null
          severity: string
          user_id: string | null
        }
        Insert: {
          attempt_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          meta?: Json | null
          severity?: string
          user_id?: string | null
        }
        Update: {
          attempt_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          meta?: Json | null
          severity?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "anticheat_events_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "contest_attempts"
            referencedColumns: ["id"]
          },
        ]
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
      app_updates: {
        Row: {
          active: boolean
          created_at: string
          force_update: boolean
          id: string
          message: string | null
          url: string | null
          version: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          force_update?: boolean
          id?: string
          message?: string | null
          url?: string | null
          version: string
        }
        Update: {
          active?: boolean
          created_at?: string
          force_update?: boolean
          id?: string
          message?: string | null
          url?: string | null
          version?: string
        }
        Relationships: []
      }
      banners: {
        Row: {
          active: boolean
          created_at: string
          cta_label: string | null
          ends_at: string | null
          id: string
          image_url: string | null
          link_url: string | null
          sort_order: number | null
          starts_at: string | null
          subtitle: string | null
          title: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          cta_label?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          link_url?: string | null
          sort_order?: number | null
          starts_at?: string | null
          subtitle?: string | null
          title: string
        }
        Update: {
          active?: boolean
          created_at?: string
          cta_label?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          link_url?: string | null
          sort_order?: number | null
          starts_at?: string | null
          subtitle?: string | null
          title?: string
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
      broadcasts: {
        Row: {
          active: boolean
          audience: string
          body: string
          created_at: string
          id: string
          title: string
        }
        Insert: {
          active?: boolean
          audience?: string
          body: string
          created_at?: string
          id?: string
          title: string
        }
        Update: {
          active?: boolean
          audience?: string
          body?: string
          created_at?: string
          id?: string
          title?: string
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
      community_posts: {
        Row: {
          body: string
          comment_count: number
          created_at: string
          hidden: boolean
          id: string
          like_count: number
          media_type: string | null
          media_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string
          comment_count?: number
          created_at?: string
          hidden?: boolean
          id?: string
          like_count?: number
          media_type?: string | null
          media_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          comment_count?: number
          created_at?: string
          hidden?: boolean
          id?: string
          like_count?: number
          media_type?: string | null
          media_url?: string | null
          updated_at?: string
          user_id?: string
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
      contest_comments: {
        Row: {
          body: string
          contest_id: string
          created_at: string
          hidden: boolean
          id: string
          user_id: string
        }
        Insert: {
          body: string
          contest_id: string
          created_at?: string
          hidden?: boolean
          id?: string
          user_id: string
        }
        Update: {
          body?: string
          contest_id?: string
          created_at?: string
          hidden?: boolean
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contest_comments_contest_id_fkey"
            columns: ["contest_id"]
            isOneToOne: false
            referencedRelation: "contests"
            referencedColumns: ["id"]
          },
        ]
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
      coupon_redemptions: {
        Row: {
          amount: number | null
          coupon_id: string
          created_at: string
          id: string
          user_id: string
          xp_amount: number | null
        }
        Insert: {
          amount?: number | null
          coupon_id: string
          created_at?: string
          id?: string
          user_id: string
          xp_amount?: number | null
        }
        Update: {
          amount?: number | null
          coupon_id?: string
          created_at?: string
          id?: string
          user_id?: string
          xp_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          active: boolean
          amount: number
          code: string
          created_at: string
          expires_at: string | null
          id: string
          kind: string
          max_redemptions: number | null
          note: string | null
          per_user_limit: number | null
          redemptions: number
          xp_amount: number | null
        }
        Insert: {
          active?: boolean
          amount?: number
          code: string
          created_at?: string
          expires_at?: string | null
          id?: string
          kind?: string
          max_redemptions?: number | null
          note?: string | null
          per_user_limit?: number | null
          redemptions?: number
          xp_amount?: number | null
        }
        Update: {
          active?: boolean
          amount?: number
          code?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          kind?: string
          max_redemptions?: number | null
          note?: string | null
          per_user_limit?: number | null
          redemptions?: number
          xp_amount?: number | null
        }
        Relationships: []
      }
      creator_profiles: {
        Row: {
          admin_note: string | null
          applied_at: string | null
          avg_rating: number
          created_at: string
          followers_count: number
          monetized: boolean
          ratings_count: number
          status: string
          total_views: number
          updated_at: string
          user_id: string
          watch_seconds: number
        }
        Insert: {
          admin_note?: string | null
          applied_at?: string | null
          avg_rating?: number
          created_at?: string
          followers_count?: number
          monetized?: boolean
          ratings_count?: number
          status?: string
          total_views?: number
          updated_at?: string
          user_id: string
          watch_seconds?: number
        }
        Update: {
          admin_note?: string | null
          applied_at?: string | null
          avg_rating?: number
          created_at?: string
          followers_count?: number
          monetized?: boolean
          ratings_count?: number
          status?: string
          total_views?: number
          updated_at?: string
          user_id?: string
          watch_seconds?: number
        }
        Relationships: []
      }
      cricket_matches: {
        Row: {
          created_at: string
          date_time: string | null
          external_id: string | null
          fetched_at: string | null
          id: string
          is_live: boolean | null
          match_type: string | null
          name: string
          raw: Json | null
          score_a: string | null
          score_b: string | null
          status: string | null
          team_a: string | null
          team_b: string | null
          updated_at: string
          venue: string | null
        }
        Insert: {
          created_at?: string
          date_time?: string | null
          external_id?: string | null
          fetched_at?: string | null
          id?: string
          is_live?: boolean | null
          match_type?: string | null
          name: string
          raw?: Json | null
          score_a?: string | null
          score_b?: string | null
          status?: string | null
          team_a?: string | null
          team_b?: string | null
          updated_at?: string
          venue?: string | null
        }
        Update: {
          created_at?: string
          date_time?: string | null
          external_id?: string | null
          fetched_at?: string | null
          id?: string
          is_live?: boolean | null
          match_type?: string | null
          name?: string
          raw?: Json | null
          score_a?: string | null
          score_b?: string | null
          status?: string | null
          team_a?: string | null
          team_b?: string | null
          updated_at?: string
          venue?: string | null
        }
        Relationships: []
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
      device_bindings: {
        Row: {
          blocked: boolean
          device_id: string
          first_seen: string
          id: string
          ip: string | null
          last_seen: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          blocked?: boolean
          device_id: string
          first_seen?: string
          id?: string
          ip?: string | null
          last_seen?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          blocked?: boolean
          device_id?: string
          first_seen?: string
          id?: string
          ip?: string | null
          last_seen?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      faqs: {
        Row: {
          active: boolean
          answer: string
          category: string | null
          created_at: string
          id: string
          question: string
          sort_order: number | null
        }
        Insert: {
          active?: boolean
          answer: string
          category?: string | null
          created_at?: string
          id?: string
          question: string
          sort_order?: number | null
        }
        Update: {
          active?: boolean
          answer?: string
          category?: string | null
          created_at?: string
          id?: string
          question?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      feedback: {
        Row: {
          admin_reply: string | null
          body: string
          category: string | null
          created_at: string
          id: string
          rating: number | null
          status: string
          user_id: string | null
        }
        Insert: {
          admin_reply?: string | null
          body: string
          category?: string | null
          created_at?: string
          id?: string
          rating?: number | null
          status?: string
          user_id?: string | null
        }
        Update: {
          admin_reply?: string | null
          body?: string
          category?: string | null
          created_at?: string
          id?: string
          rating?: number | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
        }
        Relationships: []
      }
      fraud_flags: {
        Row: {
          admin_note: string | null
          created_at: string
          id: string
          reason: string
          resolved: boolean
          severity: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          id?: string
          reason: string
          resolved?: boolean
          severity?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          id?: string
          reason?: string
          resolved?: boolean
          severity?: string
          user_id?: string
        }
        Relationships: []
      }
      kyc_submissions: {
        Row: {
          admin_note: string | null
          created_at: string
          doc_image_url: string | null
          doc_number: string
          doc_type: string
          full_name: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          selfie_url: string | null
          status: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          doc_image_url?: string | null
          doc_number: string
          doc_type: string
          full_name: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_url?: string | null
          status?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          doc_image_url?: string | null
          doc_number?: string
          doc_type?: string
          full_name?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_url?: string | null
          status?: string
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
      membership_features: {
        Row: {
          created_at: string
          feature_id: string
          membership_id: string
        }
        Insert: {
          created_at?: string
          feature_id: string
          membership_id: string
        }
        Update: {
          created_at?: string
          feature_id?: string
          membership_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_features_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "premium_features"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_features_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          active: boolean | null
          audience: string
          code: string
          created_at: string
          daily_quiz_limit: number | null
          description: string | null
          duration_days: number
          highlight: string | null
          id: string
          name: string
          perks: Json
          price: number
          recommended: boolean
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          audience?: string
          code: string
          created_at?: string
          daily_quiz_limit?: number | null
          description?: string | null
          duration_days?: number
          highlight?: string | null
          id?: string
          name: string
          perks?: Json
          price?: number
          recommended?: boolean
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          audience?: string
          code?: string
          created_at?: string
          daily_quiz_limit?: number | null
          description?: string | null
          duration_days?: number
          highlight?: string | null
          id?: string
          name?: string
          perks?: Json
          price?: number
          recommended?: boolean
          sort_order?: number | null
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
      post_comments: {
        Row: {
          body: string
          created_at: string
          hidden: boolean
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          hidden?: boolean
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          hidden?: boolean
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_ratings: {
        Row: {
          created_at: string
          post_id: string
          stars: number
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          stars: number
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          stars?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_ratings_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_views: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string | null
          watch_seconds: number
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id?: string | null
          watch_seconds?: number
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string | null
          watch_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "post_views_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      premium_features: {
        Row: {
          active: boolean
          code: string
          created_at: string
          description: string | null
          icon: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      prize_awards: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          kind: string
          period: string
          period_key: string
          rank: number | null
          status: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          kind?: string
          period: string
          period_key: string
          rank?: number | null
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          kind?: string
          period?: string
          period_key?: string
          rank?: number | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          banned: boolean
          bio: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          phone_verified: boolean
          referral_code: string | null
          username: string | null
          wallet_balance: number
        }
        Insert: {
          avatar_url?: string | null
          banned?: boolean
          bio?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          phone_verified?: boolean
          referral_code?: string | null
          username?: string | null
          wallet_balance?: number
        }
        Update: {
          avatar_url?: string | null
          banned?: boolean
          bio?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          phone_verified?: boolean
          referral_code?: string | null
          username?: string | null
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
      reading_attempts: {
        Row: {
          accuracy: number
          answers: Json
          correct_count: number
          created_at: string
          id: string
          passage_id: string
          question_order: Json | null
          quiz_seconds_spent: number
          reading_completed: boolean
          reading_seconds_spent: number
          score: number
          started_at: string
          status: string
          submitted_at: string | null
          unanswered_count: number
          updated_at: string
          user_id: string
          wrong_count: number
        }
        Insert: {
          accuracy?: number
          answers?: Json
          correct_count?: number
          created_at?: string
          id?: string
          passage_id: string
          question_order?: Json | null
          quiz_seconds_spent?: number
          reading_completed?: boolean
          reading_seconds_spent?: number
          score?: number
          started_at?: string
          status?: string
          submitted_at?: string | null
          unanswered_count?: number
          updated_at?: string
          user_id: string
          wrong_count?: number
        }
        Update: {
          accuracy?: number
          answers?: Json
          correct_count?: number
          created_at?: string
          id?: string
          passage_id?: string
          question_order?: Json | null
          quiz_seconds_spent?: number
          reading_completed?: boolean
          reading_seconds_spent?: number
          score?: number
          started_at?: string
          status?: string
          submitted_at?: string | null
          unanswered_count?: number
          updated_at?: string
          user_id?: string
          wrong_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "reading_attempts_passage_id_fkey"
            columns: ["passage_id"]
            isOneToOne: false
            referencedRelation: "reading_passages"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_passages: {
        Row: {
          active: boolean
          category_id: string | null
          created_at: string
          difficulty: string
          ends_at: string | null
          entry_fee: number
          id: string
          keep_passage_visible: boolean
          marks_per_question: number
          negative_marks: number
          num_questions: number
          passage: string
          prize_pool: number
          quiz_seconds: number
          reading_seconds: number
          show_explanations: boolean
          shuffle_options: boolean
          shuffle_questions: boolean
          starts_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category_id?: string | null
          created_at?: string
          difficulty?: string
          ends_at?: string | null
          entry_fee?: number
          id?: string
          keep_passage_visible?: boolean
          marks_per_question?: number
          negative_marks?: number
          num_questions?: number
          passage: string
          prize_pool?: number
          quiz_seconds?: number
          reading_seconds?: number
          show_explanations?: boolean
          shuffle_options?: boolean
          shuffle_questions?: boolean
          starts_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category_id?: string | null
          created_at?: string
          difficulty?: string
          ends_at?: string | null
          entry_fee?: number
          id?: string
          keep_passage_visible?: boolean
          marks_per_question?: number
          negative_marks?: number
          num_questions?: number
          passage?: string
          prize_pool?: number
          quiz_seconds?: number
          reading_seconds?: number
          show_explanations?: boolean
          shuffle_options?: boolean
          shuffle_questions?: boolean
          starts_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_passages_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_questions: {
        Row: {
          correct_index: number
          created_at: string
          explanation: string | null
          id: string
          marks: number | null
          options: Json
          passage_id: string
          question: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          correct_index?: number
          created_at?: string
          explanation?: string | null
          id?: string
          marks?: number | null
          options?: Json
          passage_id: string
          question: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          correct_index?: number
          created_at?: string
          explanation?: string | null
          id?: string
          marks?: number | null
          options?: Json
          passage_id?: string
          question?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_questions_passage_id_fkey"
            columns: ["passage_id"]
            isOneToOne: false
            referencedRelation: "reading_passages"
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
      store_orders: {
        Row: {
          admin_note: string | null
          amount: number
          created_at: string
          currency: string
          id: string
          note: string | null
          product_id: string
          quantity: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          note?: string | null
          product_id: string
          quantity?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          note?: string | null
          product_id?: string
          quantity?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "store_products"
            referencedColumns: ["id"]
          },
        ]
      }
      store_products: {
        Row: {
          active: boolean
          created_at: string
          currency: string
          description: string | null
          id: string
          image_url: string | null
          price: number
          sort_order: number
          stock: number
          title: string
          unlimited_stock: boolean
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          image_url?: string | null
          price?: number
          sort_order?: number
          stock?: number
          title: string
          unlimited_stock?: boolean
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          image_url?: string | null
          price?: number
          sort_order?: number
          stock?: number
          title?: string
          unlimited_stock?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      subscription_payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          membership_id: string | null
          order_id: string | null
          payment_id: string | null
          provider: string
          raw: Json | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          membership_id?: string | null
          order_id?: string | null
          payment_id?: string | null
          provider?: string
          raw?: Json | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          membership_id?: string | null
          order_id?: string | null
          payment_id?: string | null
          provider?: string
          raw?: Json | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_payments_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
        ]
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
      user_memberships: {
        Row: {
          admin_note: string | null
          auto_renew: boolean
          created_at: string
          ends_at: string
          id: string
          membership_id: string
          payment_id: string | null
          source: string
          starts_at: string
          status: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          auto_renew?: boolean
          created_at?: string
          ends_at: string
          id?: string
          membership_id: string
          payment_id?: string | null
          source?: string
          starts_at?: string
          status?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          auto_renew?: boolean
          created_at?: string
          ends_at?: string
          id?: string
          membership_id?: string
          payment_id?: string | null
          source?: string
          starts_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_memberships_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_memberships_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "subscription_payments"
            referencedColumns: ["id"]
          },
        ]
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
      is_mutual_follow: { Args: { _a: string; _b: string }; Returns: boolean }
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
      redeem_coupon: {
        Args: { _code: string }
        Returns: {
          amount: number
          note: string
          xp_amount: number
        }[]
      }
      refresh_user_missions: { Args: { _user_id?: string }; Returns: number }
      submit_reading_attempt: {
        Args: {
          _answers: Json
          _attempt_id: string
          _quiz_seconds_spent: number
        }
        Returns: {
          accuracy: number
          correct_count: number
          score: number
          unanswered_count: number
          wrong_count: number
        }[]
      }
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
