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

-- 8. Optional A/B functional verification. Replace all placeholders before
-- running. It rolls back every test write.
-- - USER_A_UUID: authenticated owner of HOME_SPACE_A_UUID (account-managed)
-- - USER_B_UUID: a different authenticated user
-- - HOME_SPACE_A_UUID: an account-managed public.home_spaces.id owned by user A
-- - HOME_SPACE_B_UUID: an account-managed public.home_spaces.id owned by user B
--
-- Expected:
-- - user A can publish and see metadata for A.
-- - user B sees zero metadata rows for A and receives an authorization error
--   for A's upsert/revoke operations.
-- - anon cannot directly select public_home_shares.
-- - anon can read only with the active token; random, revoked and expired
--   tokens all return 0 rows from read_public_home_share.
/*
begin;

-- Use a freshly generated 43-character test token. Do not use a real share URL.
select set_config('request.jwt.claim.sub', 'USER_A_UUID', true);
set local role authenticated;

select *
from public.upsert_public_home_share(
  'HOME_SPACE_A_UUID'::uuid,
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  '{
    "version": 1,
    "documentTitle": "Public verification",
    "theme": { "presetId": "classic", "accent": "#246bfe" },
    "groups": [{
      "id": "group-1",
      "title": "Verification",
      "order": 1,
      "sites": [{
        "id": "site-1-1",
        "name": "Example",
        "url": "https://example.com/",
        "mark": "E",
        "order": 1
      }]
    }]
  }'::jsonb
);

select 'owner_metadata_count' as check_name, count(*) as value
from public.get_public_home_share_metadata('HOME_SPACE_A_UUID'::uuid);

reset role;
select set_config('request.jwt.claim.sub', 'USER_B_UUID', true);
set local role authenticated;

select 'other_owner_metadata_count' as check_name, count(*) as value
from public.get_public_home_share_metadata('HOME_SPACE_A_UUID'::uuid);

do $$
begin
  perform public.revoke_public_home_share('HOME_SPACE_A_UUID'::uuid);
  raise exception 'other owner unexpectedly revoked share';
exception
  when insufficient_privilege or invalid_authorization_specification then
    raise notice 'other owner revoke correctly denied';
end;
$$;

do $$
begin
  perform public.upsert_public_home_share(
    'HOME_SPACE_A_UUID'::uuid,
    'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
    '{"version":1,"documentTitle":"x","theme":{"presetId":"classic","accent":"#246bfe"},"groups":[{"id":"group-1","title":"x","order":1,"sites":[{"id":"site-1-1","name":"x","url":"https://example.com/","mark":"x","order":1}]}]}'::jsonb
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
  perform 1 from public.public_home_shares;
  raise exception 'anon unexpectedly read public_home_shares directly';
exception
  when insufficient_privilege then
    raise notice 'anon direct table read correctly denied';
end;
$$;

-- This public read should return exactly one row for the active token, and
-- zero rows for the random token.
select 'active_token_count' as check_name, count(*) as value
from public.read_public_home_share('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
select 'random_token_count' as check_name, count(*) as value
from public.read_public_home_share('CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC');

reset role;
select set_config('request.jwt.claim.sub', 'USER_A_UUID', true);
set local role authenticated;
select * from public.revoke_public_home_share('HOME_SPACE_A_UUID'::uuid);

reset role;
set local role anon;
select 'revoked_original_token_count' as check_name, count(*) as value
from public.read_public_home_share('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');

rollback;
*/

-- Test expiry by updating expires_at only inside a separate rollback
-- transaction as a table owner, then confirm read_public_home_share returns
-- 0 rows. Never paste a production share token into SQL Editor.
