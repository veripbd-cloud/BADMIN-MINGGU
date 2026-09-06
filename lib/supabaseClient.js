import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Client ini dipakai di komponen React (browser). Terikat aturan RLS
// di schema.sql — player cuma bisa baca/tulis data yang diizinkan.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
