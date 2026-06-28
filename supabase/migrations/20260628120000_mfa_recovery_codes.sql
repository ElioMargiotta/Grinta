-- 2FA recovery codes (P2.5).
-- Codes one-time, stockés HASHÉS (SHA-256) dans le schéma privé (non exposé à
-- l'API PostgREST). Tout accès passe par des fonctions SECURITY DEFINER.
-- La désactivation du facteur TOTP lors de la consommation est gérée côté
-- serveur via l'API admin (hors de cette migration).

create table if not exists private.mfa_recovery_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists mfa_recovery_codes_user_idx
  on private.mfa_recovery_codes (user_id);

-- Aucune policy : accès direct refusé. Seules les fonctions SECURITY DEFINER
-- ci-dessous (et le service_role) lisent/écrivent cette table.
alter table private.mfa_recovery_codes enable row level security;

-- Génère un nouveau lot : remplace les codes existants du compte courant.
create or replace function public.generate_mfa_recovery_codes(p_hashes text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  delete from private.mfa_recovery_codes where user_id = auth.uid();
  insert into private.mfa_recovery_codes (user_id, code_hash)
  select auth.uid(), unnest(p_hashes);
end;
$$;

-- Nombre de codes inutilisés du compte courant (pour l'UI).
create or replace function public.count_unused_mfa_recovery_codes()
returns integer
language sql
security definer
set search_path = ''
as $$
  select count(*)::int
  from private.mfa_recovery_codes
  where user_id = auth.uid() and used_at is null;
$$;

-- Consomme un code : le marque utilisé et retourne true si un code valide
-- inutilisé existait pour le compte courant.
create or replace function public.consume_mfa_recovery_code(p_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  select id into v_id
  from private.mfa_recovery_codes
  where user_id = auth.uid() and code_hash = p_hash and used_at is null
  limit 1;
  if v_id is null then
    return false;
  end if;
  update private.mfa_recovery_codes set used_at = now() where id = v_id;
  return true;
end;
$$;

revoke all on function public.generate_mfa_recovery_codes(text[]) from public, anon;
revoke all on function public.count_unused_mfa_recovery_codes() from public, anon;
revoke all on function public.consume_mfa_recovery_code(text) from public, anon;
grant execute on function public.generate_mfa_recovery_codes(text[]) to authenticated;
grant execute on function public.count_unused_mfa_recovery_codes() to authenticated;
grant execute on function public.consume_mfa_recovery_code(text) to authenticated;
