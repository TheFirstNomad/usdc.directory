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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          admin_address: string
          created_at: string
          id: string
          metadata: Json | null
          partner_id: string | null
          partner_name: string | null
          reason: string | null
        }
        Insert: {
          action: string
          admin_address: string
          created_at?: string
          id?: string
          metadata?: Json | null
          partner_id?: string | null
          partner_name?: string | null
          reason?: string | null
        }
        Update: {
          action?: string
          admin_address?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          partner_id?: string | null
          partner_name?: string | null
          reason?: string | null
        }
        Relationships: []
      }
      admin_sig_nonces: {
        Row: {
          admin_address: string
          signature: string
          used_at: string
        }
        Insert: {
          admin_address: string
          signature: string
          used_at?: string
        }
        Update: {
          admin_address?: string
          signature?: string
          used_at?: string
        }
        Relationships: []
      }
      agent_api_payments: {
        Row: {
          agent_wallet: string | null
          amount_usdc: number
          chain: string
          endpoint: string
          id: string
          method: string
          paid_at: string
          payment_id: string
          scheme: string
        }
        Insert: {
          agent_wallet?: string | null
          amount_usdc: number
          chain: string
          endpoint: string
          id?: string
          method: string
          paid_at?: string
          payment_id: string
          scheme?: string
        }
        Update: {
          agent_wallet?: string | null
          amount_usdc?: number
          chain?: string
          endpoint?: string
          id?: string
          method?: string
          paid_at?: string
          payment_id?: string
          scheme?: string
        }
        Relationships: []
      }
      agent_boosts: {
        Row: {
          amount_usdc: number
          chain: string
          created_at: string
          expires_at: string
          id: string
          partner_id: string
          payment_id: string
        }
        Insert: {
          amount_usdc: number
          chain: string
          created_at?: string
          expires_at: string
          id?: string
          partner_id: string
          payment_id: string
        }
        Update: {
          amount_usdc?: number
          chain?: string
          created_at?: string
          expires_at?: string
          id?: string
          partner_id?: string
          payment_id?: string
        }
        Relationships: []
      }
      agent_rate_limits: {
        Row: {
          bucket_key: string
          created_at: string
          endpoint: string
          id: string
        }
        Insert: {
          bucket_key: string
          created_at?: string
          endpoint: string
          id?: string
        }
        Update: {
          bucket_key?: string
          created_at?: string
          endpoint?: string
          id?: string
        }
        Relationships: []
      }
      deployment_checks: {
        Row: {
          checked_at: string
          duration_ms: number | null
          error: string | null
          has_module_script: boolean | null
          has_root: boolean | null
          html_bytes: number | null
          id: string
          mount_success: boolean
          script_count: number | null
          status_code: number | null
          url: string
        }
        Insert: {
          checked_at?: string
          duration_ms?: number | null
          error?: string | null
          has_module_script?: boolean | null
          has_root?: boolean | null
          html_bytes?: number | null
          id?: string
          mount_success?: boolean
          script_count?: number | null
          status_code?: number | null
          url: string
        }
        Update: {
          checked_at?: string
          duration_ms?: number | null
          error?: string | null
          has_module_script?: boolean | null
          has_root?: boolean | null
          html_bytes?: number | null
          id?: string
          mount_success?: boolean
          script_count?: number | null
          status_code?: number | null
          url?: string
        }
        Relationships: []
      }
      partners: {
        Row: {
          badge_nonce: number
          badge_token_id: number | null
          badge_tx_hash: string | null
          badge_voucher_issued_at: string | null
          boosted_until: string | null
          categories: string[]
          created_at: string
          description: string
          featured: boolean | null
          id: string
          logo_emoji: string | null
          logo_url: string | null
          name: string
          networks: string[]
          payment_id: string | null
          payment_status: string
          region: string | null
          updated_at: string
          usdc_score: number | null
          use_cases: string[] | null
          verified: boolean
          wallet_address: string | null
          website: string | null
        }
        Insert: {
          badge_nonce?: number
          badge_token_id?: number | null
          badge_tx_hash?: string | null
          badge_voucher_issued_at?: string | null
          boosted_until?: string | null
          categories?: string[]
          created_at?: string
          description: string
          featured?: boolean | null
          id?: string
          logo_emoji?: string | null
          logo_url?: string | null
          name: string
          networks?: string[]
          payment_id?: string | null
          payment_status?: string
          region?: string | null
          updated_at?: string
          usdc_score?: number | null
          use_cases?: string[] | null
          verified?: boolean
          wallet_address?: string | null
          website?: string | null
        }
        Update: {
          badge_nonce?: number
          badge_token_id?: number | null
          badge_tx_hash?: string | null
          badge_voucher_issued_at?: string | null
          boosted_until?: string | null
          categories?: string[]
          created_at?: string
          description?: string
          featured?: boolean | null
          id?: string
          logo_emoji?: string | null
          logo_url?: string | null
          name?: string
          networks?: string[]
          payment_id?: string | null
          payment_status?: string
          region?: string | null
          updated_at?: string
          usdc_score?: number | null
          use_cases?: string[] | null
          verified?: boolean
          wallet_address?: string | null
          website?: string | null
        }
        Relationships: []
      }
      submissions: {
        Row: {
          categories: string[]
          company_name: string
          contact_email: string
          created_at: string
          description: string
          id: string
          logo_url: string | null
          networks: string[]
          partner_id: string | null
          payment_id: string | null
          payment_status: string
          region: string | null
          reject_reason: string | null
          status: string
          wallet_address: string | null
          website: string
        }
        Insert: {
          categories?: string[]
          company_name: string
          contact_email: string
          created_at?: string
          description: string
          id?: string
          logo_url?: string | null
          networks?: string[]
          partner_id?: string | null
          payment_id?: string | null
          payment_status?: string
          region?: string | null
          reject_reason?: string | null
          status?: string
          wallet_address?: string | null
          website: string
        }
        Update: {
          categories?: string[]
          company_name?: string
          contact_email?: string
          created_at?: string
          description?: string
          id?: string
          logo_url?: string | null
          networks?: string[]
          partner_id?: string | null
          payment_id?: string | null
          payment_status?: string
          region?: string | null
          reject_reason?: string | null
          status?: string
          wallet_address?: string | null
          website?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners_public"
            referencedColumns: ["id"]
          },
        ]
      }
      x402_nonces: {
        Row: {
          amount_usdc: number
          chain: string
          created_at: string
          endpoint: string | null
          id: string
          nonce: string
          payer: string | null
          settled: boolean
          settled_at: string | null
          tx_hash: string | null
        }
        Insert: {
          amount_usdc: number
          chain: string
          created_at?: string
          endpoint?: string | null
          id?: string
          nonce: string
          payer?: string | null
          settled?: boolean
          settled_at?: string | null
          tx_hash?: string | null
        }
        Update: {
          amount_usdc?: number
          chain?: string
          created_at?: string
          endpoint?: string | null
          id?: string
          nonce?: string
          payer?: string | null
          settled?: boolean
          settled_at?: string | null
          tx_hash?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      partners_public: {
        Row: {
          boosted_until: string | null
          categories: string[] | null
          created_at: string | null
          description: string | null
          featured: boolean | null
          id: string | null
          logo_emoji: string | null
          logo_url: string | null
          name: string | null
          networks: string[] | null
          region: string | null
          updated_at: string | null
          usdc_score: number | null
          use_cases: string[] | null
          verified: boolean | null
          website: string | null
        }
        Insert: {
          boosted_until?: string | null
          categories?: string[] | null
          created_at?: string | null
          description?: string | null
          featured?: boolean | null
          id?: string | null
          logo_emoji?: string | null
          logo_url?: string | null
          name?: string | null
          networks?: string[] | null
          region?: string | null
          updated_at?: string | null
          usdc_score?: number | null
          use_cases?: string[] | null
          verified?: boolean | null
          website?: string | null
        }
        Update: {
          boosted_until?: string | null
          categories?: string[] | null
          created_at?: string | null
          description?: string | null
          featured?: boolean | null
          id?: string | null
          logo_emoji?: string | null
          logo_url?: string | null
          name?: string | null
          networks?: string[] | null
          region?: string | null
          updated_at?: string | null
          usdc_score?: number | null
          use_cases?: string[] | null
          verified?: boolean | null
          website?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      cleanup_admin_sig_nonces: { Args: never; Returns: undefined }
      cleanup_agent_rate_limits: { Args: never; Returns: undefined }
      cleanup_deployment_checks: { Args: never; Returns: undefined }
      get_my_listings: {
        Args: { _wallet_address: string }
        Returns: {
          categories: string[]
          description: string
          id: string
          logo_emoji: string
          logo_url: string
          name: string
          region: string
          website: string
        }[]
      }
      is_listing_owner: {
        Args: { _listing_id: string; _wallet_address: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
