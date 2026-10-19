-- HANYA MEMBACA, tidak mengubah apa pun. Jalankan di Supabase -> SQL Editor.
-- Yang diharapkan:
--  1) Semua baris RLS bertuliskan 'aktif'.
--  2) Untuk pendaftaran_sesi hanya ada policy SELECT (tidak ada INSERT/UPDATE).
--  3) Ada satu baris TRIGGER bertuliskan 'versi baru'. Kalau 'versi LAMA' atau tidak ada baris
--     TRIGGER sama sekali, jalankan migrasi_lock_profiles.sql.
select 'RLS' as jenis, c.relname::text as nama,
       case when c.relrowsecurity then 'aktif' else 'MATI' end as detail
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
union all
select 'POLICY', p.tablename::text || ' / ' || p.policyname::text, p.cmd::text
from pg_policies p
where p.schemaname = 'public'
union all
select 'TRIGGER', t.tgname::text,
       case when pg_get_functiondef(t.tgfoid) like '%TG_OP%'
            then 'versi baru (insert + update) - BAGUS'
            else 'versi LAMA (update saja) - perlu diperbarui' end
from pg_trigger t
where t.tgrelid = 'public.profiles'::regclass and not t.tgisinternal
order by 1, 2;
