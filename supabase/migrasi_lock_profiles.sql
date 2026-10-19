-- Mencegah user mengubah sendiri kolom sensitif di profil, DAN mencegah orang
-- mendaftar lalu langsung menulis role = 'super_admin' / status 'approved'.
-- Berlaku untuk INSERT dan UPDATE. Service role (API admin) tidak terkena batasan ini.
create or replace function prevent_self_privilege_escalation()
returns trigger as $$
begin
  if auth.role() <> 'service_role' then
    if TG_OP = 'INSERT' then
      new.role := 'player';
      new.status_approval := 'pending';
      new.level_final := null;
    elsif TG_OP = 'UPDATE' then
      if new.tipe is distinct from old.tipe
         or new.role is distinct from old.role
         or new.level_self is distinct from old.level_self
         or new.level_final is distinct from old.level_final
         or new.status_approval is distinct from old.status_approval
      then
        raise exception 'Kolom ini tidak boleh diubah sendiri, hanya lewat admin.';
      end if;
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, auth, pg_catalog;

drop trigger if exists trg_prevent_self_privilege_escalation on profiles;
create trigger trg_prevent_self_privilege_escalation
before insert or update on profiles
for each row execute function prevent_self_privilege_escalation();
