import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error(
        "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
      );
    }
    _supabase = createClient(supabaseUrl, supabaseServiceKey);
  }
  return _supabase;
}

export type Submission = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  category: string;
  description: string;
  link: string | null;
  email: string | null;
  contact_consent: boolean;
  publish_consent: boolean;
  status: "pending" | "approved" | "rejected";
  cluster_id: string | null;
  nomination_count: number;
  created_at: string;
};
