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
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      _health: {
        Row: {
          additional_info: Json | null
          checked_at: string | null
          id: number
          status: string
        }
        Insert: {
          additional_info?: Json | null
          checked_at?: string | null
          id?: never
          status?: string
        }
        Update: {
          additional_info?: Json | null
          checked_at?: string | null
          id?: never
          status?: string
        }
        Relationships: []
      }
      account_balances: {
        Row: {
          created_at: string
          demo_balance: number
          id: string
          live_balance: number
          today_pnl: number
          total_pnl: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          demo_balance?: number
          id?: string
          live_balance?: number
          today_pnl?: number
          total_pnl?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          demo_balance?: number
          id?: string
          live_balance?: number
          today_pnl?: number
          total_pnl?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bridge_transactions: {
        Row: {
          amount: number
          asset: string
          created_at: string
          dest_tx_hash: string | null
          from_chain: string
          id: string
          initiated_by: string | null
          metadata: Json | null
          source_tx_hash: string | null
          status: string
          to_chain: string
          updated_at: string
        }
        Insert: {
          amount: number
          asset?: string
          created_at?: string
          dest_tx_hash?: string | null
          from_chain: string
          id?: string
          initiated_by?: string | null
          metadata?: Json | null
          source_tx_hash?: string | null
          status?: string
          to_chain: string
          updated_at?: string
        }
        Update: {
          amount?: number
          asset?: string
          created_at?: string
          dest_tx_hash?: string | null
          from_chain?: string
          id?: string
          initiated_by?: string | null
          metadata?: Json | null
          source_tx_hash?: string | null
          status?: string
          to_chain?: string
          updated_at?: string
        }
        Relationships: []
      }
      chat_rooms: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          display_name: string
          id: string
          is_private: boolean
          name: string
          requires_verification: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_name: string
          id?: string
          is_private?: boolean
          name: string
          requires_verification?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_name?: string
          id?: string
          is_private?: boolean
          name?: string
          requires_verification?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      deposits: {
        Row: {
          amount: number
          asset: string
          chain: string
          confirmed_at: string | null
          created_at: string
          from_address: string | null
          id: string
          metadata: Json | null
          status: string
          to_address: string | null
          tx_hash: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          asset?: string
          chain: string
          confirmed_at?: string | null
          created_at?: string
          from_address?: string | null
          id?: string
          metadata?: Json | null
          status?: string
          to_address?: string | null
          tx_hash?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          asset?: string
          chain?: string
          confirmed_at?: string | null
          created_at?: string
          from_address?: string | null
          id?: string
          metadata?: Json | null
          status?: string
          to_address?: string | null
          tx_hash?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          is_deleted: boolean
          is_edited: boolean
          message_type: string
          reply_to: string | null
          room_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          is_edited?: boolean
          message_type?: string
          reply_to?: string | null
          room_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          is_edited?: boolean
          message_type?: string
          reply_to?: string | null
          room_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          email_notifications: boolean
          id: string
          marketing_emails: boolean
          price_alerts: boolean
          push_notifications: boolean
          signal_alerts: boolean
          trading_alerts: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_notifications?: boolean
          id?: string
          marketing_emails?: boolean
          price_alerts?: boolean
          push_notifications?: boolean
          signal_alerts?: boolean
          trading_alerts?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_notifications?: boolean
          id?: string
          marketing_emails?: boolean
          price_alerts?: boolean
          push_notifications?: boolean
          signal_alerts?: boolean
          trading_alerts?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_url: string | null
          created_at: string
          id: string
          is_read: boolean
          message: string
          metadata: Json | null
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          metadata?: Json | null
          title: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          metadata?: Json | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          email: string | null
          full_name: string | null
          id: number
          l2_address: string | null
          location: string | null
          tron_address: string | null
          updated_at: string | null
          user_id: string
          username: string | null
          website: string | null
        }
        Insert: {
          avatar_url?: string | null
          email?: string | null
          full_name?: string | null
          id?: never
          l2_address?: string | null
          location?: string | null
          tron_address?: string | null
          updated_at?: string | null
          user_id: string
          username?: string | null
          website?: string | null
        }
        Update: {
          avatar_url?: string | null
          email?: string | null
          full_name?: string | null
          id?: never
          l2_address?: string | null
          location?: string | null
          tron_address?: string | null
          updated_at?: string | null
          user_id?: string
          username?: string | null
          website?: string | null
        }
        Relationships: []
      }
      Sharma: {
        Row: {
          created_at: string
          id: number
        }
        Insert: {
          created_at?: string
          id?: number
        }
        Update: {
          created_at?: string
          id?: number
        }
        Relationships: []
      }
      trades: {
        Row: {
          account_mode: string
          closed_at: string | null
          contract_address: string | null
          created_at: string
          direction: string
          entry_price: number
          exit_price: number | null
          id: string
          lot_size: number
          pair: string
          pnl: number | null
          settlement_chain: string | null
          source_chain: string | null
          status: string
          stop_loss: number | null
          take_profit: number | null
          transaction_hash: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_mode?: string
          closed_at?: string | null
          contract_address?: string | null
          created_at?: string
          direction: string
          entry_price: number
          exit_price?: number | null
          id?: string
          lot_size: number
          pair: string
          pnl?: number | null
          settlement_chain?: string | null
          source_chain?: string | null
          status?: string
          stop_loss?: number | null
          take_profit?: number | null
          transaction_hash?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_mode?: string
          closed_at?: string | null
          contract_address?: string | null
          created_at?: string
          direction?: string
          entry_price?: number
          exit_price?: number | null
          id?: string
          lot_size?: number
          pair?: string
          pnl?: number | null
          settlement_chain?: string | null
          source_chain?: string | null
          status?: string
          stop_loss?: number | null
          take_profit?: number | null
          transaction_hash?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trading_signals: {
        Row: {
          confidence: number
          created_at: string
          direction: string
          entry_zone: Json | null
          execution_type: string | null
          expires_at: string | null
          explanation: string[] | null
          id: string
          market: string | null
          pair: string
          recommendation: string
          risk_data: Json | null
          signal_data: Json | null
          status: string | null
          stop_loss: number | null
          strategy: string | null
          take_profit: Json | null
          timeframe: string | null
          user_id: string | null
        }
        Insert: {
          confidence: number
          created_at?: string
          direction: string
          entry_zone?: Json | null
          execution_type?: string | null
          expires_at?: string | null
          explanation?: string[] | null
          id?: string
          market?: string | null
          pair: string
          recommendation: string
          risk_data?: Json | null
          signal_data?: Json | null
          status?: string | null
          stop_loss?: number | null
          strategy?: string | null
          take_profit?: Json | null
          timeframe?: string | null
          user_id?: string | null
        }
        Update: {
          confidence?: number
          created_at?: string
          direction?: string
          entry_zone?: Json | null
          execution_type?: string | null
          expires_at?: string | null
          explanation?: string[] | null
          id?: string
          market?: string | null
          pair?: string
          recommendation?: string
          risk_data?: Json | null
          signal_data?: Json | null
          status?: string | null
          stop_loss?: number | null
          strategy?: string | null
          take_profit?: Json | null
          timeframe?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_files: {
        Row: {
          bucket_id: string
          created_at: string
          description: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          is_public: boolean | null
          mime_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          description?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          is_public?: boolean | null
          mime_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          description?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          is_public?: boolean | null
          mime_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          amount: number
          asset: string
          chain: string
          created_at: string
          destination_address: string
          fee: number | null
          id: string
          metadata: Json | null
          processed_at: string | null
          status: string
          tx_hash: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          asset?: string
          chain: string
          created_at?: string
          destination_address: string
          fee?: number | null
          id?: string
          metadata?: Json | null
          processed_at?: string | null
          status?: string
          tx_hash?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          asset?: string
          chain?: string
          created_at?: string
          destination_address?: string
          fee?: number | null
          id?: string
          metadata?: Json | null
          processed_at?: string | null
          status?: string
          tx_hash?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_trade_pnl: {
        Args: { p_current_price: number; p_trade_id: string }
        Returns: number
      }
      cancel_trade: { Args: { p_trade_id: string }; Returns: string }
      close_trade: {
        Args: { p_exit_price: number; p_trade_id: string }
        Returns: string
      }
      create_notification: {
        Args: {
          p_action_url?: string
          p_message: string
          p_metadata?: Json
          p_title: string
          p_type?: string
          p_user_id: string
        }
        Returns: string
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
    Enums: {},
  },
} as const
