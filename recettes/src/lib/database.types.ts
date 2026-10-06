// Types de la base, au format généré par la CLI Supabase.
// À régénérer après chaque migration : `npm run db:types` (projet lié).

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Timestamps = { created_at: string };

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; display_name: string; avatar_path: string | null } & Timestamps;
        Insert: { id: string; display_name: string; avatar_path?: string | null; created_at?: string };
        Update: { display_name?: string; avatar_path?: string | null };
        Relationships: [];
      };
      groups: {
        Row: { id: string; name: string; created_by: string } & Timestamps;
        Insert: { id?: string; name: string; created_by?: string; created_at?: string };
        Update: { name?: string };
        Relationships: [
          { foreignKeyName: 'groups_created_by_fkey'; columns: ['created_by']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ];
      };
      group_members: {
        Row: { group_id: string; user_id: string; role: 'admin' | 'member'; joined_at: string };
        Insert: { group_id: string; user_id: string; role?: 'admin' | 'member'; joined_at?: string };
        Update: { role?: 'admin' | 'member' };
        Relationships: [
          { foreignKeyName: 'group_members_group_id_fkey'; columns: ['group_id']; isOneToOne: false; referencedRelation: 'groups'; referencedColumns: ['id'] },
          { foreignKeyName: 'group_members_user_id_fkey'; columns: ['user_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ];
      };
      invitations: {
        Row: { code: string; group_id: string; created_by: string; expires_at: string } & Timestamps;
        Insert: { code: string; group_id: string; created_by?: string; expires_at?: string; created_at?: string };
        Update: { expires_at?: string };
        Relationships: [
          { foreignKeyName: 'invitations_group_id_fkey'; columns: ['group_id']; isOneToOne: false; referencedRelation: 'groups'; referencedColumns: ['id'] },
        ];
      };
      recipes: {
        Row: {
          id: string;
          author_id: string;
          title: string;
          passed_down_by: string | null;
          story: string | null;
          category: RecipeCategory | null;
          servings: number | null;
          servings_label: string | null;
          prep_minutes: number | null;
          cook_minutes: number | null;
          ingredients: Json;
          steps: Json;
          photo_paths: string[];
          original_paths: string[];
          updated_at: string;
          search: unknown;
        } & Timestamps;
        Insert: {
          id?: string;
          author_id?: string;
          title: string;
          passed_down_by?: string | null;
          story?: string | null;
          category?: RecipeCategory | null;
          servings?: number | null;
          servings_label?: string | null;
          prep_minutes?: number | null;
          cook_minutes?: number | null;
          ingredients?: Json;
          steps?: Json;
          photo_paths?: string[];
          original_paths?: string[];
        };
        Update: Partial<Database['public']['Tables']['recipes']['Insert']>;
        Relationships: [
          { foreignKeyName: 'recipes_author_id_fkey'; columns: ['author_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ];
      };
      recipe_shares: {
        Row: { recipe_id: string; group_id: string; shared_at: string };
        Insert: { recipe_id: string; group_id: string; shared_at?: string };
        Update: Record<string, never>;
        Relationships: [
          { foreignKeyName: 'recipe_shares_recipe_id_fkey'; columns: ['recipe_id']; isOneToOne: false; referencedRelation: 'recipes'; referencedColumns: ['id'] },
          { foreignKeyName: 'recipe_shares_group_id_fkey'; columns: ['group_id']; isOneToOne: false; referencedRelation: 'groups'; referencedColumns: ['id'] },
        ];
      };
      reviews: {
        Row: {
          id: string;
          recipe_id: string;
          group_id: string;
          author_id: string;
          rating: number | null;
          comment: string | null;
          photo_path: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          recipe_id: string;
          group_id: string;
          author_id?: string;
          rating?: number | null;
          comment?: string | null;
          photo_path?: string | null;
        };
        Update: { rating?: number | null; comment?: string | null; photo_path?: string | null };
        Relationships: [
          { foreignKeyName: 'reviews_recipe_id_fkey'; columns: ['recipe_id']; isOneToOne: false; referencedRelation: 'recipes'; referencedColumns: ['id'] },
          { foreignKeyName: 'reviews_group_id_fkey'; columns: ['group_id']; isOneToOne: false; referencedRelation: 'groups'; referencedColumns: ['id'] },
          { foreignKeyName: 'reviews_author_id_fkey'; columns: ['author_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ];
      };
      favorites: {
        Row: { user_id: string; recipe_id: string } & Timestamps;
        Insert: { user_id?: string; recipe_id: string; created_at?: string };
        Update: Record<string, never>;
        Relationships: [
          { foreignKeyName: 'favorites_recipe_id_fkey'; columns: ['recipe_id']; isOneToOne: false; referencedRelation: 'recipes'; referencedColumns: ['id'] },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      join_group: { Args: { invite_code: string }; Returns: string };
      invitation_preview: { Args: { invite_code: string }; Returns: { group_id: string; group_name: string; member_count: number }[] };
      set_recipe_groups: { Args: { rid: string; gids: string[] }; Returns: undefined };
      delete_my_account: { Args: Record<string, never>; Returns: undefined };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type RecipeCategory = 'apero' | 'entree' | 'plat' | 'accompagnement' | 'dessert' | 'boisson' | 'autre';

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
