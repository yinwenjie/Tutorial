-- Fix Phase 1.17 public-share publication on databases that already ran 017.
--
-- The original ON CONFLICT (home_space_id) target is ambiguous inside a
-- RETURNS TABLE PL/pgSQL function because home_space_id is also an implicit
-- output variable. PostgreSQL raises 42702 only when the INSERT statement is
-- first executed, so migration creation and read-only checks can still pass.

begin;

create or replace function public.upsert_public_home_share(
  p_home_space_id uuid,
  p_token text,
  p_document_json jsonb
)
returns table (
  home_space_id uuid,
  status text,
  payload_version integer,
  expires_at timestamptz,
  published_at timestamptz,
  updated_at timestamptz,
  revoked_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_existing_token_hash text;
  v_home_space_id uuid;
  v_token_hash text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_token is null
    or char_length(p_token) <> 43
    or p_token !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'Invalid public share token' using errcode = '22023';
  end if;

  if not public.public_home_document_v1_valid(p_document_json) then
    raise exception 'Invalid public share document' using errcode = '22023';
  end if;

  select hs.id
  into v_home_space_id
  from public.home_spaces hs
  where hs.id = p_home_space_id
    and hs.user_id = auth.uid()
    and hs.access_mode = 'account-managed'
  for update;

  if v_home_space_id is null then
    raise exception 'Public sharing unavailable for this home space' using errcode = '28000';
  end if;

  v_token_hash := public.hash_public_home_share_token(p_token);

  select phs.token_hash
  into v_existing_token_hash
  from public.public_home_shares phs
  where phs.home_space_id = v_home_space_id
  for update;

  if v_existing_token_hash = v_token_hash then
    raise exception 'A new public share token is required' using errcode = '22023';
  end if;

  insert into public.public_home_shares (
    user_id,
    home_space_id,
    token_hash,
    document_json,
    payload_version,
    status,
    expires_at,
    published_at,
    updated_at,
    revoked_at
  )
  values (
    auth.uid(),
    v_home_space_id,
    v_token_hash,
    p_document_json,
    1,
    'active',
    null,
    now(),
    now(),
    null
  )
  on conflict on constraint public_home_shares_one_per_home_space do update
  set
    user_id = excluded.user_id,
    token_hash = excluded.token_hash,
    document_json = excluded.document_json,
    payload_version = excluded.payload_version,
    status = 'active',
    expires_at = null,
    published_at = case
      when public.public_home_shares.status = 'active' then public.public_home_shares.published_at
      else now()
    end,
    updated_at = now(),
    revoked_at = null;

  return query
  select
    phs.home_space_id,
    phs.status,
    phs.payload_version,
    phs.expires_at,
    phs.published_at,
    phs.updated_at,
    phs.revoked_at
  from public.public_home_shares phs
  where phs.home_space_id = v_home_space_id;
end;
$$;

revoke all on function public.upsert_public_home_share(uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.upsert_public_home_share(uuid, text, jsonb)
  to authenticated;

commit;
