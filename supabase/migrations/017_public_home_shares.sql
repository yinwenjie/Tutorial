begin;

-- Phase 1.17.3: revocable public snapshots for account-managed home spaces.
-- Public shares are intentionally isolated from encrypted sync_spaces,
-- account-managed credentials, cloud history, and audit metadata.

create or replace function public.public_home_json_has_exact_keys(
  p_value jsonb,
  p_expected_keys text[]
)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  v_key text;
begin
  if p_value is null or jsonb_typeof(p_value) <> 'object' then
    return false;
  end if;

  if (
    select count(*)
    from jsonb_object_keys(p_value)
  ) <> coalesce(array_length(p_expected_keys, 1), 0) then
    return false;
  end if;

  for v_key in
    select jsonb_object_keys(p_value)
  loop
    if not (v_key = any(p_expected_keys)) then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

revoke all on function public.public_home_json_has_exact_keys(jsonb, text[]) from public, anon, authenticated;

create or replace function public.public_home_text_valid(
  p_value jsonb,
  p_max_length integer
)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  v_text text;
begin
  if p_value is null
    or jsonb_typeof(p_value) <> 'string'
    or p_max_length is null
    or p_max_length < 1 then
    return false;
  end if;

  v_text := p_value #>> '{}';
  return char_length(v_text) between 1 and p_max_length
    and btrim(v_text) = v_text;
end;
$$;

revoke all on function public.public_home_text_valid(jsonb, integer) from public, anon, authenticated;

create or replace function public.public_home_url_valid(p_value jsonb)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  v_url text;
begin
  if not public.public_home_text_valid(p_value, 2048) then
    return false;
  end if;

  v_url := p_value #>> '{}';

  -- The client parser enforces the complete canonical URL contract. This
  -- database gate independently rejects non-HTTP(S), credentials, whitespace,
  -- non-canonical host casing, and URLs that omit the canonical path slash.
  return v_url ~ '^https?://(\[[0-9a-f:.]+\]|[a-z0-9][a-z0-9.-]*)(:[0-9]+)?/[^[:space:]]*$';
end;
$$;

revoke all on function public.public_home_url_valid(jsonb) from public, anon, authenticated;

create or replace function public.public_home_document_v1_valid(p_document_json jsonb)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  v_group jsonb;
  v_group_index integer;
  v_groups jsonb;
  v_site jsonb;
  v_site_index integer;
  v_sites jsonb;
  v_total_sites integer := 0;
begin
  if p_document_json is null
    or jsonb_typeof(p_document_json) <> 'object'
    or octet_length(p_document_json::text) > 262144
    or not public.public_home_json_has_exact_keys(
      p_document_json,
      array['version', 'documentTitle', 'theme', 'groups']
    ) then
    return false;
  end if;

  if jsonb_typeof(p_document_json -> 'version') <> 'number'
    or p_document_json ->> 'version' <> '1'
    or not public.public_home_text_valid(p_document_json -> 'documentTitle', 80)
    or not public.public_home_json_has_exact_keys(
      p_document_json -> 'theme',
      array['presetId', 'accent']
    ) then
    return false;
  end if;

  if p_document_json #>> '{theme,presetId}' not in (
    'classic', 'focus', 'dense', 'soft', 'glass', 'editorial', 'terminal',
    'mono', 'millennium', 'slate', 'mint', 'indigo', 'sunrise'
  )
    or char_length(p_document_json #>> '{theme,accent}') <> 7
    or left(p_document_json #>> '{theme,accent}', 1) <> '#'
    or substring(p_document_json #>> '{theme,accent}' from 2) !~ '^[0-9a-f]+$' then
    return false;
  end if;

  v_groups := p_document_json -> 'groups';
  if jsonb_typeof(v_groups) <> 'array'
    or jsonb_array_length(v_groups) not between 1 and 60 then
    return false;
  end if;

  for v_group_index in 0 .. jsonb_array_length(v_groups) - 1 loop
    v_group := v_groups -> v_group_index;
    if not public.public_home_json_has_exact_keys(v_group, array['id', 'title', 'order', 'sites'])
      or v_group ->> 'id' <> 'group-' || (v_group_index + 1)::text
      or jsonb_typeof(v_group -> 'order') <> 'number'
      or v_group ->> 'order' <> (v_group_index + 1)::text
      or not public.public_home_text_valid(v_group -> 'title', 80) then
      return false;
    end if;

    v_sites := v_group -> 'sites';
    if jsonb_typeof(v_sites) <> 'array'
      or jsonb_array_length(v_sites) not between 1 and 100 then
      return false;
    end if;

    v_total_sites := v_total_sites + jsonb_array_length(v_sites);
    if v_total_sites > 2000 then
      return false;
    end if;

    for v_site_index in 0 .. jsonb_array_length(v_sites) - 1 loop
      v_site := v_sites -> v_site_index;
      if not public.public_home_json_has_exact_keys(v_site, array['id', 'name', 'url', 'mark', 'order'])
        or v_site ->> 'id' <> format('site-%s-%s', v_group_index + 1, v_site_index + 1)
        or jsonb_typeof(v_site -> 'order') <> 'number'
        or v_site ->> 'order' <> (v_site_index + 1)::text
        or not public.public_home_text_valid(v_site -> 'name', 80)
        or not public.public_home_text_valid(v_site -> 'mark', 20)
        or not public.public_home_url_valid(v_site -> 'url') then
        return false;
      end if;
    end loop;
  end loop;

  return v_total_sites between 1 and 2000;
end;
$$;

revoke all on function public.public_home_document_v1_valid(jsonb) from public, anon, authenticated;

create or replace function public.hash_public_home_share_token(p_token text)
returns text
language sql
stable
set search_path = public, extensions
as $$
  select encode(
    extensions.digest(('mylinker-public-share-v1:' || coalesce(p_token, ''))::text, 'sha256'::text),
    'hex'
  );
$$;

revoke all on function public.hash_public_home_share_token(text) from public, anon, authenticated;

create table if not exists public.public_home_shares (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  home_space_id uuid not null,
  token_hash text not null,
  document_json jsonb not null,
  payload_version integer not null default 1,
  status text not null default 'active',
  expires_at timestamptz,
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint public_home_shares_home_space_owner_fk
    foreign key (home_space_id, user_id)
    references public.home_spaces(id, user_id)
    on delete cascade,
  constraint public_home_shares_one_per_home_space unique (home_space_id),
  constraint public_home_shares_token_hash_unique unique (token_hash),
  constraint public_home_shares_token_hash_valid check (
    char_length(token_hash) = 64
    and token_hash ~ '^[0-9a-f]+$'
  ),
  constraint public_home_shares_payload_version_valid check (payload_version = 1),
  constraint public_home_shares_document_valid check (public.public_home_document_v1_valid(document_json)),
  constraint public_home_shares_status_valid check (status in ('active', 'revoked')),
  constraint public_home_shares_status_timestamps_valid check (
    (status = 'active' and revoked_at is null)
    or (status = 'revoked' and revoked_at is not null)
  ),
  constraint public_home_shares_expiry_valid check (
    expires_at is null or expires_at > published_at
  )
);

create index if not exists public_home_shares_user_id_idx
  on public.public_home_shares(user_id);

alter table public.public_home_shares enable row level security;

revoke all on table public.public_home_shares from public;
revoke all on table public.public_home_shares from anon;
revoke all on table public.public_home_shares from authenticated;

drop trigger if exists public_home_shares_set_updated_at on public.public_home_shares;
create trigger public_home_shares_set_updated_at
before update on public.public_home_shares
for each row execute function public.set_updated_at();

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
  -- RETURNS TABLE declares a PL/pgSQL output variable named home_space_id.
  -- Naming the constraint avoids a 42702 ambiguity between that variable and
  -- the table column when PostgreSQL first executes this statement.
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

create or replace function public.get_public_home_share_metadata(p_home_space_id uuid)
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
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

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
  join public.home_spaces hs
    on hs.id = phs.home_space_id
    and hs.user_id = phs.user_id
  where phs.home_space_id = p_home_space_id
    and phs.user_id = auth.uid()
    and hs.access_mode = 'account-managed';
end;
$$;

create or replace function public.revoke_public_home_share(p_home_space_id uuid)
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
  v_home_space_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
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

  update public.public_home_shares phs
  set
    status = 'revoked',
    revoked_at = coalesce(phs.revoked_at, now()),
    updated_at = now(),
    token_hash = case
      when phs.status = 'active' then encode(
        extensions.digest(
          ('mylinker-public-share-revoked-v1:' || extensions.gen_random_uuid()::text)::text,
          'sha256'::text
        ),
        'hex'
      )
      else phs.token_hash
    end
  where phs.home_space_id = v_home_space_id;

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

create or replace function public.read_public_home_share(p_token text)
returns table (
  payload_version integer,
  document_json jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Invalid, expired, revoked, and unknown tokens intentionally all return
  -- zero rows. The public route must render the same generic unavailable UI.
  if p_token is null
    or char_length(p_token) <> 43
    or p_token !~ '^[A-Za-z0-9_-]+$' then
    return;
  end if;

  return query
  select
    phs.payload_version,
    phs.document_json
  from public.public_home_shares phs
  join public.home_spaces hs
    on hs.id = phs.home_space_id
    and hs.user_id = phs.user_id
  where phs.token_hash = public.hash_public_home_share_token(p_token)
    and phs.status = 'active'
    and (phs.expires_at is null or phs.expires_at > now())
    and hs.access_mode = 'account-managed'
    and public.public_home_document_v1_valid(phs.document_json);
end;
$$;

revoke all on function public.upsert_public_home_share(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.get_public_home_share_metadata(uuid) from public, anon, authenticated;
revoke all on function public.revoke_public_home_share(uuid) from public, anon, authenticated;
revoke all on function public.read_public_home_share(text) from public, anon, authenticated;

grant execute on function public.upsert_public_home_share(uuid, text, jsonb) to authenticated;
grant execute on function public.get_public_home_share_metadata(uuid) to authenticated;
grant execute on function public.revoke_public_home_share(uuid) to authenticated;
grant execute on function public.read_public_home_share(text) to anon, authenticated;

commit;
