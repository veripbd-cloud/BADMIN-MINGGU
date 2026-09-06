import { createClient } from '@supabase/supabase-js';

// PENTING: file ini HANYA boleh diimport dari dalam pages/api/*.js (server-side).
// Jangan pernah import ini dari komponen React biasa — service role key akan
// bocor ke browser kalau begitu.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Helper: cek role user yang lagi request (dipanggil dari dalam API routes)
export async function getProfileFromRequest(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return null;

  const { data: userData, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !userData?.user) return null;

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', userData.user.id)
    .single();

  return profile || null;
}

export function isAdmin(profile) {
  return profile && (profile.role === 'admin' || profile.role === 'super_admin');
}

export function isSuperAdmin(profile) {
  return profile && profile.role === 'super_admin';
}
