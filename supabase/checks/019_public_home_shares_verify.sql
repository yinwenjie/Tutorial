-- Verify Phase 1.17.3 public-home-share storage and RPC boundaries.
-- Run this file in Supabase Dashboard SQL Editor after:
-- - supabase/migrations/017_public_home_shares.sql
--
-- Sections 1-7 are read-only. Section 8 is an optional transaction-scoped
-- A/B verification and requires replacing its UUID placeholders.

-- 1. The share table should be isolated, present, and protected by RLS.
select
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename = 'public_home_shares';

-- Expected:
-- - exactly one row with rowsecurity = true.

-- 2. Required columns, types, and nullable state.
select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'public_home_shares'
order by ordinal_position;

-- Expected columns:
-- - id, user_id, home_space_id, token_hash, document_json, payload_version,
--   status, expires_at, published_at, updated_at, revoked_at.
-- - token_hash and document_json are not nullable.
-- - no sync-space credential, encrypted document, audit, or recovery columns.

-- 3. Foreign keys and constraints should retain the owner/home-space boundary.
select
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as constraint_definition
from pg_constraint
where conrelid = 'public.public_home_shares'::regclass
order by conname;

-- Expected:
-- - composite (home_space_id, user_id) FK to home_spaces(id, user_id), on delete cascade.
-- - unique home_space_id and token_hash.
-- - status, timestamp, token-hash, payload-version, payload-schema and expiry checks.

-- 4. There must be no direct table access or RLS policy for frontend roles.
select
  grantee,
  table_name,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'public_home_shares'
  and grantee in ('anon', 'authenticated', 'PUBLIC')
order by grantee, privilege_type;

-- Expected: 0 rows.

select
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'public_home_shares'
order by policyname;

-- Expected: 0 rows. Access is RPC-only.

-- 5. RPC ownership, security-definer mode, and fixed search paths.
select
  p.proname as function_name,
  p.prosecdef as security_definer,
  coalesce(array_to_string(p.proconfig, ', '), '') as function_config
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'upsert_public_home_share',
    'get_public_home_share_metadata',
    'revoke_public_home_share',
    'read_public_home_share'
  )
order by p.proname;

-- Expected:
-- - four rows; security_definer = true.
-- - function_config includes a fixed search_path beginning with public.

-- 6. Frontend execute grants must follow the minimal matrix.
select
  routine_name,
  grantee,
  privilege_type
from information_schema.routine_privileges
where specific_schema = 'public'
  and routine_name in (
    'upsert_public_home_share',
    'get_public_home_share_metadata',
    'revoke_public_home_share',
    'read_public_home_share',
    'hash_public_home_share_token',
    'public_home_document_v1_valid',
    'public_home_json_has_exact_keys',
    'public_home_text_valid',
    'public_home_url_valid'
  )
  and grantee in ('anon', 'authenticated', 'PUBLIC')
order by routine_name, grantee;

-- Expected:
-- - authenticated EXECUTE only: upsert_public_home_share,
--   get_public_home_share_metadata, revoke_public_home_share.
-- - anon + authenticated EXECUTE only: read_public_home_share.
-- - no frontend-role execute rows for helper/hash/schema functions.

-- 7. Stored rows must still satisfy the strict v1 public schema, and only the
-- allowed public columns are readable through the public function definition.
select
  count(*) filter (where not public.public_home_document_v1_valid(document_json))
    as invalid_document_count,
  count(*) filter (where payload_version <> 1) as invalid_version_count,
  count(*) filter (where status = 'active' and revoked_at is not null) as invalid_active_state_count,
  count(*) filter (where status = 'revoked' and revoked_at is null) as invalid_revoked_state_count
from public.public_home_shares;

-- Expected: all counts = 0.

select pg_get_functiondef('public.read_public_home_share(text)'::regprocedure)
  as public_read_function_definition;

-- Expected:
-- - returns only payload_version and document_json.
-- - filters token_hash, active status, expiry, account-managed space, and schema validity.
-- - contains no read-event/audit insert.

-- 8. Optional A/B functional verification. Replace all UUID placeholders
-- before running. This block rolls back every test write and raises an error
-- immediately if any expectation fails.
-- - USER_A_UUID: authenticated owner of HOME_SPACE_A_UUID (account-managed)
-- - USER_B_UUID: a different authenticated user
-- - HOME_SPACE_A_UUID: an account-managed public.home_spaces.id owned by user A
-- - HOME_SPACE_B_UUID: an account-managed public.home_spaces.id owned by user B
--
-- This block intentionally uses synthetic 43-character test tokens only. Do
-- not paste a real share URL or real token into SQL Editor.
/*
begin;

create temp table public_home_share_verify_context (
  user_a uuid not null,
  user_b uuid not null,
  home_space_a uuid not null,
  home_space_b uuid not null,
  token_a text not null,
  token_a_expired text not null,
  token_b text not null,
  token_random text not null,
  document_a jsonb not null,
  document_a_updated jsonb not null,
  document_b jsonb not null
) on commit drop;

insert into public_home_share_verify_context (
  user_a,
  user_b,
  home_space_a,
  home_space_b,
  token_a,
  token_a_expired,
  token_b,
  token_random,
  document_a,
  document_a_updated,
  document_b
)
values (
  'USER_A_UUID'::uuid,
  'USER_B_UUID'::uuid,
  'HOME_SPACE_A_UUID'::uuid,
  'HOME_SPACE_B_UUID'::uuid,
  repeat('A', 43),
  repeat('D', 43),
  repeat('B', 43),
  repeat('C', 43),
  '{
    "version": 1,
    "documentTitle": "Public verification A",
    "theme": { "presetId": "classic", "accent": "#246bfe" },
    "groups": [{
      "id": "group-1",
      "title": "Verification A",
      "order": 1,
      "sites": [{
        "id": "site-1-1",
        "name": "Example A",
        "url": "https://example.com/a/",
        "mark": "A",
        "order": 1
      }]
    }]
  }'::jsonb,
  '{
    "version": 1,
    "documentTitle": "Public verification A updated",
    "theme": { "presetId": "classic", "accent": "#246bfe" },
    "groups": [{
      "id": "group-1",
      "title": "Verification A updated",
      "order": 1,
      "sites": [{
        "id": "site-1-1",
        "name": "Example A updated",
        "url": "https://example.com/a-updated/",
        "mark": "AU",
        "order": 1
      }]
    }]
  }'::jsonb,
  '{
    "version": 1,
    "documentTitle": "Public verification B",
    "theme": { "presetId": "classic", "accent": "#246bfe" },
    "groups": [{
      "id": "group-1",
      "title": "Verification B",
      "order": 1,
      "sites": [{
        "id": "site-1-1",
        "name": "Example B",
        "url": "https://example.com/b/",
        "mark": "B",
        "order": 1
      }]
    }]
  }'::jsonb
);

do $$
declare
  v_context record;
begin
  select *
  into v_context
  from public_home_share_verify_context;

  if v_context.user_a = v_context.user_b then
    raise exception 'USER_A_UUID and USER_B_UUID must be different';
  end if;

  if v_context.home_space_a = v_context.home_space_b then
    raise exception 'HOME_SPACE_A_UUID and HOME_SPACE_B_UUID must be different';
  end if;

  if not exists (
    select 1
    from public.home_spaces hs
    where hs.id = v_context.home_space_a
      and hs.user_id = v_context.user_a
      and hs.access_mode = 'account-managed'
  ) then
    raise exception 'HOME_SPACE_A_UUID must be owned by USER_A_UUID and account-managed';
  end if;

  if not exists (
    select 1
    from public.home_spaces hs
    where hs.id = v_context.home_space_b
      and hs.user_id = v_context.user_b
      and hs.access_mode = 'account-managed'
  ) then
    raise exception 'HOME_SPACE_B_UUID must be owned by USER_B_UUID and account-managed';
  end if;
end;
$$;

create temp table public_home_share_verify_baseline as
select *
from public.public_home_shares phs
where phs.home_space_id in (
  (select home_space_a from public_home_share_verify_context),
  (select home_space_b from public_home_share_verify_context)
);

select set_config('request.jwt.claim.sub', (select user_a::text from public_home_share_verify_context), true);
set local role authenticated;

select *
from public.upsert_public_home_share(
  (select home_space_a from public_home_share_verify_context),
  (select token_a from public_home_share_verify_context),
  (select document_a from public_home_share_verify_context)
);

do $$
declare
  v_count integer;
begin
  select count(*)
  into v_count
  from public.get_public_home_share_metadata(
    (select home_space_a from public_home_share_verify_context)
  );

  if v_count <> 1 then
    raise exception 'owner A metadata count expected 1, got %', v_count;
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', (select user_b::text from public_home_share_verify_context), true);
set local role authenticated;

select *
from public.upsert_public_home_share(
  (select home_space_b from public_home_share_verify_context),
  (select token_b from public_home_share_verify_context),
  (select document_b from public_home_share_verify_context)
);

do $$
declare
  v_count integer;
begin
  select count(*)
  into v_count
  from public.get_public_home_share_metadata(
    (select home_space_a from public_home_share_verify_context)
  );

  if v_count <> 0 then
    raise exception 'owner B metadata count for A expected 0, got %', v_count;
  end if;

  select count(*)
  into v_count
  from public.get_public_home_share_metadata(
    (select home_space_b from public_home_share_verify_context)
  );

  if v_count <> 1 then
    raise exception 'owner B metadata count for B expected 1, got %', v_count;
  end if;
end;
$$;

do $$
begin
  perform public.revoke_public_home_share(
    (select home_space_a from public_home_share_verify_context)
  );
  raise exception 'other owner unexpectedly revoked share';
exception
  when insufficient_privilege or invalid_authorization_specification then
    raise notice 'other owner revoke correctly denied';
end;
$$;

do $$
begin
  perform public.upsert_public_home_share(
    (select home_space_a from public_home_share_verify_context),
    (select token_a_expired from public_home_share_verify_context),
    (select document_a_updated from public_home_share_verify_context)
  );
  raise exception 'other owner unexpectedly published share';
exception
  when insufficient_privilege or invalid_authorization_specification then
    raise notice 'other owner publish correctly denied';
end;
$$;

reset role;
set local role anon;

do $$
begin
  perform 1 from public.public_home_shares limit 1;
  raise exception 'anon unexpectedly read public_home_shares directly';
exception
  when insufficient_privilege then
    raise notice 'anon direct table read correctly denied';
end;
$$;

do $$
declare
  v_count integer;
begin
  select count(*)
  into v_count
  from public.read_public_home_share(
    (select token_a from public_home_share_verify_context)
  );

  if v_count <> 1 then
    raise exception 'active token A read count expected 1, got %', v_count;
  end if;

  select count(*)
  into v_count
  from public.read_public_home_share(
    (select token_b from public_home_share_verify_context)
  );

  if v_count <> 1 then
    raise exception 'active token B read count expected 1, got %', v_count;
  end if;

  select count(*)
  into v_count
  from public.read_public_home_share(
    (select token_random from public_home_share_verify_context)
  );

  if v_count <> 0 then
    raise exception 'random token read count expected 0, got %', v_count;
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', (select user_a::text from public_home_share_verify_context), true);
set local role authenticated;
select *
from public.revoke_public_home_share(
  (select home_space_a from public_home_share_verify_context)
);

reset role;
set local role anon;
do $$
declare
  v_count integer;
begin
  select count(*)
  into v_count
  from public.read_public_home_share(
    (select token_a from public_home_share_verify_context)
  );

  if v_count <> 0 then
    raise exception 'revoked original token read count expected 0, got %', v_count;
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', (select user_a::text from public_home_share_verify_context), true);
set local role authenticated;
select *
from public.upsert_public_home_share(
  (select home_space_a from public_home_share_verify_context),
  (select token_a_expired from public_home_share_verify_context),
  (select document_a_updated from public_home_share_verify_context)
);

reset role;
update public.public_home_shares phs
set
  published_at = now() - interval '2 hours',
  expires_at = now() - interval '1 hour',
  updated_at = now()
where phs.home_space_id = (
  select home_space_a from public_home_share_verify_context
);

set local role anon;
do $$
declare
  v_count integer;
begin
  select count(*)
  into v_count
  from public.read_public_home_share(
    (select token_a_expired from public_home_share_verify_context)
  );

  if v_count <> 0 then
    raise exception 'expired token read count expected 0, got %', v_count;
  end if;
end;
$$;

reset role;
select
  'phase_1_17_6_ab_checks_passed_before_rollback' as check_name,
  (select count(*) from public_home_share_verify_baseline) as baseline_rows_preserved_by_rollback;

rollback;
*/
