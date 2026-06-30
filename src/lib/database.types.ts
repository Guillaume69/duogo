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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activities: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      cities: {
        Row: {
          center: unknown
          country_code: string
          created_at: string
          id: string
          name: string
          slug: string
          timezone: string
        }
        Insert: {
          center: unknown
          country_code: string
          created_at?: string
          id?: string
          name: string
          slug: string
          timezone?: string
        }
        Update: {
          center?: unknown
          country_code?: string
          created_at?: string
          id?: string
          name?: string
          slug?: string
          timezone?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          invitation_id: string
          updated_at: string
          user_a: string
          user_b: string
        }
        Insert: {
          created_at?: string
          id?: string
          invitation_id: string
          updated_at?: string
          user_a: string
          user_b: string
        }
        Update: {
          created_at?: string
          id?: string
          invitation_id?: string
          updated_at?: string
          user_a?: string
          user_b?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: true
            referencedRelation: "invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_user_a_fkey"
            columns: ["user_a"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_user_b_fkey"
            columns: ["user_b"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          activity_id: string
          awaiting_response_from: string | null
          created_at: string
          id: string
          location_id: string | null
          message: string | null
          recipient_id: string
          scheduled_date: string
          scheduled_time: string | null
          sender_id: string
          status: Database["public"]["Enums"]["invitation_status"]
          time_slot: Database["public"]["Enums"]["time_slot"] | null
          updated_at: string
        }
        Insert: {
          activity_id: string
          awaiting_response_from?: string | null
          created_at?: string
          id?: string
          location_id?: string | null
          message?: string | null
          recipient_id: string
          scheduled_date: string
          scheduled_time?: string | null
          sender_id: string
          status?: Database["public"]["Enums"]["invitation_status"]
          time_slot?: Database["public"]["Enums"]["time_slot"] | null
          updated_at?: string
        }
        Update: {
          activity_id?: string
          awaiting_response_from?: string | null
          created_at?: string
          id?: string
          location_id?: string | null
          message?: string | null
          recipient_id?: string
          scheduled_date?: string
          scheduled_time?: string | null
          sender_id?: string
          status?: Database["public"]["Enums"]["invitation_status"]
          time_slot?: Database["public"]["Enums"]["time_slot"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_awaiting_response_from_fkey"
            columns: ["awaiting_response_from"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      location_activities: {
        Row: {
          activity_id: string
          location_id: string
        }
        Insert: {
          activity_id: string
          location_id: string
        }
        Update: {
          activity_id?: string
          location_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_activities_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_activities_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string | null
          city_id: string
          created_at: string
          geog: unknown
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          address?: string | null
          city_id: string
          created_at?: string
          geog: unknown
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          address?: string | null
          city_id?: string
          created_at?: string
          geog?: unknown
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "locations_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_activities: {
        Row: {
          activity_id: string
          created_at: string
          profile_id: string
        }
        Insert: {
          activity_id: string
          created_at?: string
          profile_id: string
        }
        Update: {
          activity_id?: string
          created_at?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_activities_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_activities_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          bio: string | null
          birth_date: string | null
          city_id: string | null
          created_at: string
          device_location: unknown
          display_name: string | null
          gender: Database["public"]["Enums"]["gender"] | null
          id: string
          onboarding_completed: boolean | null
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          bio?: string | null
          birth_date?: string | null
          city_id?: string | null
          created_at?: string
          device_location?: unknown
          display_name?: string | null
          gender?: Database["public"]["Enums"]["gender"] | null
          id: string
          onboarding_completed?: boolean | null
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          bio?: string | null
          birth_date?: string | null
          city_id?: string | null
          created_at?: string
          device_location?: unknown
          display_name?: string | null
          gender?: Database["public"]["Enums"]["gender"] | null
          id?: string
          onboarding_completed?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          created_at: string
          id: string
          platform: Database["public"]["Enums"]["push_platform"]
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform: Database["public"]["Enums"]["push_platform"]
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: Database["public"]["Enums"]["push_platform"]
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      find_nearby_locations: {
        Args: { p_activity_id: string; p_limit?: number }
        Returns: {
          address: string
          distance_m: number
          id: string
          name: string
        }[]
      }
      find_nearby_people: {
        Args: {
          p_activity_ids?: string[]
          p_age_maxs?: number[]
          p_age_mins?: number[]
          p_genders?: Database["public"]["Enums"]["gender"][]
          p_limit?: number
          p_offset?: number
          p_radius_km?: number
        }
        Returns: {
          activity_ids: string[]
          activity_names: string[]
          age: number
          already_invited: boolean
          avatar_path: string
          city_id: string
          display_name: string
          distance_m: number
          gender: Database["public"]["Enums"]["gender"]
          id: string
          invited_by_them: boolean
        }[]
      }
      get_invitation: {
        Args: { p_id: string }
        Returns: {
          activity_id: string
          activity_name: string
          awaiting_me: boolean
          created_at: string
          direction: string
          id: string
          location_address: string
          location_distance_m: number
          location_id: string
          location_name: string
          message: string
          other_avatar_path: string
          other_city_name: string
          other_distance_m: number
          other_id: string
          other_name: string
          scheduled_date: string
          scheduled_time: string
          status: Database["public"]["Enums"]["invitation_status"]
          time_slot: Database["public"]["Enums"]["time_slot"]
          updated_at: string
        }[]
      }
      get_my_invitations: {
        Args: never
        Returns: {
          activity_id: string
          activity_name: string
          awaiting_me: boolean
          created_at: string
          direction: string
          id: string
          location_id: string
          location_name: string
          message: string
          other_avatar_path: string
          other_id: string
          other_name: string
          scheduled_date: string
          scheduled_time: string
          status: Database["public"]["Enums"]["invitation_status"]
          time_slot: Database["public"]["Enums"]["time_slot"]
          updated_at: string
        }[]
      }
      get_my_profile: {
        Args: never
        Returns: {
          avatar_path: string
          bio: string
          birth_date: string
          city_id: string
          created_at: string
          display_name: string
          gender: Database["public"]["Enums"]["gender"]
          id: string
          onboarding_completed: boolean
          updated_at: string
        }[]
      }
      get_person: {
        Args: { p_id: string }
        Returns: {
          active_invitation_id: string
          activity_ids: string[]
          activity_names: string[]
          age: number
          already_invited: boolean
          avatar_path: string
          bio: string
          city_id: string
          display_name: string
          distance_m: number
          gender: Database["public"]["Enums"]["gender"]
          id: string
          invited_by_them: boolean
        }[]
      }
      modify_invitation: {
        Args: {
          p_activity_id: string
          p_date: string
          p_invitation_id: string
          p_location_id?: string
          p_message?: string
          p_time?: string
          p_time_slot?: Database["public"]["Enums"]["time_slot"]
        }
        Returns: string
      }
      respond_invitation: {
        Args: { p_accept: boolean; p_invitation_id: string }
        Returns: string
      }
      send_invitation: {
        Args: {
          p_activity_id: string
          p_date: string
          p_location_id?: string
          p_message?: string
          p_recipient_id: string
          p_time?: string
          p_time_slot?: Database["public"]["Enums"]["time_slot"]
        }
        Returns: string
      }
      set_my_location: {
        Args: { p_lat: number; p_lng: number }
        Returns: {
          matched_city_id: string
          matched_city_name: string
        }[]
      }
      snapped_distance_m: {
        Args: { p_origin: unknown; p_target: unknown }
        Returns: number
      }
    }
    Enums: {
      gender: "male" | "female" | "other"
      invitation_status:
        | "pending"
        | "accepted"
        | "declined"
        | "changes_requested"
      push_platform: "ios" | "android"
      time_slot: "morning" | "afternoon" | "evening"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      gender: ["male", "female", "other"],
      invitation_status: [
        "pending",
        "accepted",
        "declined",
        "changes_requested",
      ],
      push_platform: ["ios", "android"],
      time_slot: ["morning", "afternoon", "evening"],
    },
  },
} as const
