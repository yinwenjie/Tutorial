-- Verify the Phase 1.17 publication hotfix after running:
-- - supabase/migrations/017_public_home_shares.sql
-- - supabase/migrations/018_public_home_share_upsert_conflict_fix.sql

-- 1. The live function must use the named unique constraint. This avoids the
-- RETURNS TABLE output-variable ambiguity raised as PostgreSQL error 42702.
select
  position(
    'on conflict on constraint public_home_shares_one_per_home_space'
    in lower(pg_get_functiondef(
      'public.upsert_public_home_share(uuid,text,jsonb)'::regprocedure
    ))
  ) > 0 as conflict_target_is_unambiguous;

-- Expected: true.

-- 2. The owner RPC must remain security-definer with a fixed search path.
select
  p.prosecdef as security_definer,
  coalesce(array_to_string(p.proconfig, ', '), '') as function_config
from pg_proc p
where p.oid = 'public.upsert_public_home_share(uuid,text,jsonb)'::regprocedure;

-- Expected:
-- - security_definer = true
-- - function_config includes search_path=public, extensions

-- 3. Only authenticated retains EXECUTE among frontend roles.
select
  grantee,
  privilege_type
from information_schema.routine_privileges
where specific_schema = 'public'
  and routine_name = 'upsert_public_home_share'
  and grantee in ('anon', 'authenticated', 'PUBLIC')
order by grantee;

-- Expected: exactly one authenticated / EXECUTE row.

-- Then rerun Section 8 of 019_public_home_shares_verify.sql with test UUIDs.
-- The owner upsert must return one metadata row instead of PostgreSQL 42702.
