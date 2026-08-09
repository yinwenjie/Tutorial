-- Verify Phase 1.18.1 administrator identity and append-only audit foundation.
-- Run after supabase/migrations/019_admin_readonly_foundation.sql.
--
-- Sections 1-7 are read-only. Section 8 creates synthetic A/B/C Auth users,
-- administrator rows and audit events inside one transaction and always rolls
-- back. Do not replace the synthetic UUIDs with production user identifiers.

-- 1. Both tables must exist with RLS enabled.
select
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('admin_users', 'admin_audit_events')
order by tablename;

-- Expected:
-- - exactly two rows.
-- - rowsecurity = true for both rows.

-- 2. Required columns, nullability and defaults must match the v1 contract.
select
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('admin_users', 'admin_audit_events')
order by table_name, ordinal_position;

-- Expected:
-- - admin_users has id, user_id, role, enabled, created_by, created_at, updated_at.
-- - admin_audit_events has request/admin/target/action/reason/result/metadata fields.
-- - request_id, admin_auth_user_id, admin_role, action, severity, reason,
--   metadata and created_at are not nullable.

-- 3. Required constraints must exist.
select
  conrelid::regclass as table_name,
  conname,
  contype,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid in (
  'public.admin_users'::regclass,
  'public.admin_audit_events'::regclass
)
order by conrelid::regclass::text, conname;

-- Expected definitions include:
-- - unique admin_users.user_id and unique admin_audit_events.request_id.
-- - owner/admin/support role checks.
-- - the seven fixed actions and three severity values.
-- - reason trim, size, sensitive-shape and session-system-reason checks.
-- - result_count 0-50 and low-sensitive metadata key/value checks.

-- 4. Required operational indexes must exist.
select
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('admin_users', 'admin_audit_events')
order by tablename, indexname;

-- Expected:
-- - admin_users_enabled_role_idx.
-- - audit indexes for admin, target user/home/sync/snapshot, action and created_at.

-- 5. No RLS policy may expose either table to a frontend role.
select
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('admin_users', 'admin_audit_events')
order by tablename, policyname;

-- Expected: 0 rows.

-- 6. Frontend roles must have zero direct table privileges.
select
  grantee,
  table_name,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('admin_users', 'admin_audit_events')
  and grantee in ('anon', 'authenticated', 'PUBLIC')
order by grantee, table_name, privilege_type;

-- Expected: 0 rows.

-- 7. service_role must have only the minimum table privileges.
select
  grantee,
  table_name,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('admin_users', 'admin_audit_events')
  and grantee = 'service_role'
order by table_name, privilege_type;

-- Expected exactly:
-- - admin_users / SELECT.
-- - admin_audit_events / INSERT.
-- - admin_audit_events / SELECT.

-- 7.5. Machine-enforced structural and privilege assertions.
-- The remote deployment workflow relies on exceptions from this block to stop
-- before any later deployment stage is allowed to continue.
do $$
declare
  v_missing_names text[];
  v_role text;
  v_table text;
  v_privilege text;
begin
  if (
    select count(*)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('admin_users', 'admin_audit_events')
      and c.relkind = 'r'
      and c.relrowsecurity
  ) <> 2 then
    raise exception 'Phase 1.18.1 tables are missing or RLS is disabled';
  end if;

  if (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('admin_users', 'admin_audit_events')
  ) <> 22 then
    raise exception 'Phase 1.18.1 administrator column count differs from the fixed contract';
  end if;

  select array_agg(required_name order by required_name)
  into v_missing_names
  from unnest(array[
    'admin_users.id',
    'admin_users.user_id',
    'admin_users.role',
    'admin_users.enabled',
    'admin_users.created_by',
    'admin_users.created_at',
    'admin_users.updated_at',
    'admin_audit_events.id',
    'admin_audit_events.request_id',
    'admin_audit_events.admin_user_id',
    'admin_audit_events.admin_auth_user_id',
    'admin_audit_events.admin_role',
    'admin_audit_events.action',
    'admin_audit_events.severity',
    'admin_audit_events.reason',
    'admin_audit_events.target_user_id',
    'admin_audit_events.target_home_space_id',
    'admin_audit_events.target_sync_space_id',
    'admin_audit_events.target_snapshot_id',
    'admin_audit_events.result_count',
    'admin_audit_events.metadata',
    'admin_audit_events.created_at'
  ]::text[]) as required_name
  where not exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name || '.' || c.column_name = required_name
  );

  if v_missing_names is not null then
    raise exception 'Missing Phase 1.18.1 columns: %', array_to_string(v_missing_names, ', ');
  end if;

  select array_agg(required_name order by required_name)
  into v_missing_names
  from unnest(array[
    'admin_users_pkey',
    'admin_users_user_id_key',
    'admin_users_user_id_fkey',
    'admin_users_created_by_fkey',
    'admin_users_role_valid',
    'admin_users_timestamps_valid',
    'admin_audit_events_pkey',
    'admin_audit_events_request_id_key',
    'admin_audit_events_admin_user_id_fkey',
    'admin_audit_events_admin_role_valid',
    'admin_audit_events_action_valid',
    'admin_audit_events_severity_valid',
    'admin_audit_events_reason_trimmed',
    'admin_audit_events_reason_size',
    'admin_audit_events_reason_no_sensitive_shape',
    'admin_audit_events_session_reason_fixed',
    'admin_audit_events_result_count_valid',
    'admin_audit_events_metadata_object',
    'admin_audit_events_metadata_size',
    'admin_audit_events_metadata_keys_valid',
    'admin_audit_events_metadata_values_valid'
  ]::text[]) as required_name
  where not exists (
    select 1
    from pg_constraint
    where conrelid in (
      'public.admin_users'::regclass,
      'public.admin_audit_events'::regclass
    )
      and conname = required_name
  );

  if v_missing_names is not null then
    raise exception 'Missing Phase 1.18.1 constraints: %', array_to_string(v_missing_names, ', ');
  end if;

  if (
    select count(*)
    from pg_constraint
    where conrelid in (
      'public.admin_users'::regclass,
      'public.admin_audit_events'::regclass
    )
  ) <> 21 then
    raise exception 'Phase 1.18.1 constraint count differs from the fixed contract';
  end if;

  select array_agg(required_name order by required_name)
  into v_missing_names
  from unnest(array[
    'admin_users_pkey',
    'admin_users_user_id_key',
    'admin_users_enabled_role_idx',
    'admin_audit_events_pkey',
    'admin_audit_events_request_id_key',
    'admin_audit_events_admin_created_idx',
    'admin_audit_events_target_user_created_idx',
    'admin_audit_events_target_home_space_created_idx',
    'admin_audit_events_target_sync_space_created_idx',
    'admin_audit_events_target_snapshot_created_idx',
    'admin_audit_events_action_created_idx',
    'admin_audit_events_created_idx'
  ]::text[]) as required_name
  where not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = required_name
  );

  if v_missing_names is not null then
    raise exception 'Missing Phase 1.18.1 indexes: %', array_to_string(v_missing_names, ', ');
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename in ('admin_users', 'admin_audit_events')
  ) then
    raise exception 'Administrator tables must not expose rows through RLS policies';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in ('admin_users', 'admin_audit_events')
      and grantee in ('anon', 'authenticated', 'PUBLIC')
  ) then
    raise exception 'Frontend role has a direct administrator table grant';
  end if;

  foreach v_role in array array['anon', 'authenticated'] loop
    foreach v_table in array array['public.admin_users', 'public.admin_audit_events'] loop
      foreach v_privilege in array array[
        'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'
      ] loop
        if has_table_privilege(v_role, v_table, v_privilege) then
          raise exception 'Frontend role % has effective % privilege on %',
            v_role, v_privilege, v_table;
        end if;
      end loop;
    end loop;
  end loop;

  if (
    select count(*)
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in ('admin_users', 'admin_audit_events')
      and grantee = 'service_role'
  ) <> 3
    or not has_table_privilege('service_role', 'public.admin_users', 'SELECT')
    or has_table_privilege('service_role', 'public.admin_users', 'INSERT')
    or has_table_privilege('service_role', 'public.admin_users', 'UPDATE')
    or has_table_privilege('service_role', 'public.admin_users', 'DELETE')
    or not has_table_privilege('service_role', 'public.admin_audit_events', 'SELECT')
    or not has_table_privilege('service_role', 'public.admin_audit_events', 'INSERT')
    or has_table_privilege('service_role', 'public.admin_audit_events', 'UPDATE')
    or has_table_privilege('service_role', 'public.admin_audit_events', 'DELETE')
  then
    raise exception 'service_role administrator table privileges differ from the minimum matrix';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.admin_users'::regclass
      and tgname = 'admin_users_set_updated_at'
      and not tgisinternal
  ) then
    raise exception 'admin_users updated_at trigger is missing';
  end if;
end;
$$;

select 'admin_readonly_foundation_structural_assertions_ok' as verification_result;

-- 8. Transaction-scoped A=owner, B=support, C=ordinary-account validation.
-- Every row created below is removed by the final rollback.
begin;

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000001181',
    'authenticated',
    'authenticated',
    'phase-1-18-verify-a@example.invalid',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000001182',
    'authenticated',
    'authenticated',
    'phase-1-18-verify-b@example.invalid',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000001183',
    'authenticated',
    'authenticated',
    'phase-1-18-verify-c@example.invalid',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into public.admin_users (
  user_id,
  role,
  created_by,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000001181',
    'owner',
    '00000000-0000-0000-0000-000000001181',
    now() - interval '1 minute',
    now() - interval '1 minute'
  ),
  (
    '00000000-0000-0000-0000-000000001182',
    'support',
    '00000000-0000-0000-0000-000000001181',
    now() - interval '1 minute',
    now() - interval '1 minute'
  );

-- Invalid role, action, severity, reason, result count and metadata must fail.
do $$
declare
  v_admin_user_id uuid;
begin
  select id
  into v_admin_user_id
  from public.admin_users
  where user_id = '00000000-0000-0000-0000-000000001181';

  begin
    insert into public.admin_users (user_id, role)
    values ('00000000-0000-0000-0000-000000001183', 'viewer');
    raise exception 'invalid admin role was accepted';
  exception
    when check_violation then null;
  end;

  begin
    insert into public.admin_audit_events (
      request_id, admin_user_id, admin_auth_user_id, admin_role,
      action, severity, reason
    ) values (
      '00000000-0000-0000-0001-000000000001', v_admin_user_id,
      '00000000-0000-0000-0000-000000001181', 'owner',
      'admin.unknown', 'info', 'Investigate account-managed history.'
    );
    raise exception 'invalid audit action was accepted';
  exception
    when check_violation then null;
  end;

  begin
    insert into public.admin_audit_events (
      request_id, admin_user_id, admin_auth_user_id, admin_role,
      action, severity, reason
    ) values (
      '00000000-0000-0000-0001-000000000002', v_admin_user_id,
      '00000000-0000-0000-0000-000000001181', 'owner',
      'admin.user.resolve', 'critical', 'Investigate account-managed history.'
    );
    raise exception 'invalid audit severity was accepted';
  exception
    when check_violation then null;
  end;

  begin
    insert into public.admin_audit_events (
      request_id, admin_user_id, admin_auth_user_id, admin_role,
      action, severity, reason
    ) values (
      '00000000-0000-0000-0001-000000000003', v_admin_user_id,
      '00000000-0000-0000-0000-000000001181', 'owner',
      'admin.user.resolve', 'info', 'short'
    );
    raise exception 'short audit reason was accepted';
  exception
    when check_violation then null;
  end;

  begin
    insert into public.admin_audit_events (
      request_id, admin_user_id, admin_auth_user_id, admin_role,
      action, severity, reason
    ) values (
      '00000000-0000-0000-0001-000000000004', v_admin_user_id,
      '00000000-0000-0000-0000-000000001181', 'owner',
      'admin.user.resolve', 'info', 'Investigate user@example.invalid issue.'
    );
    raise exception 'email-shaped audit reason was accepted';
  exception
    when check_violation then null;
  end;

  begin
    insert into public.admin_audit_events (
      request_id, admin_user_id, admin_auth_user_id, admin_role,
      action, severity, reason
    ) values (
      '00000000-0000-0000-0001-000000000005', v_admin_user_id,
      '00000000-0000-0000-0000-000000001181', 'owner',
      'admin.user.resolve', 'info', 'Investigate https://example.invalid issue.'
    );
    raise exception 'URL-shaped audit reason was accepted';
  exception
    when check_violation then null;
  end;

  begin
    insert into public.admin_audit_events (
      request_id, admin_user_id, admin_auth_user_id, admin_role,
      action, severity, reason
    ) values (
      '00000000-0000-0000-0001-000000000006', v_admin_user_id,
      '00000000-0000-0000-0000-000000001181', 'owner',
      'admin.user.resolve', 'info',
      'Investigate eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMTgxIn0.signaturevalue1234567890 issue.'
    );
    raise exception 'JWT-shaped audit reason was accepted';
  exception
    when check_violation then null;
  end;

  begin
    insert into public.admin_audit_events (
      request_id, admin_user_id, admin_auth_user_id, admin_role,
      action, severity, reason
    ) values (
      '00000000-0000-0000-0001-000000000007', v_admin_user_id,
      '00000000-0000-0000-0000-000000001181', 'owner',
      'admin.user.resolve', 'info',
      'Investigate hp1_00000000-0000-0000-0000-000000000000_accesssecret_encryptionsecret issue.'
    );
    raise exception 'sync-code-shaped audit reason was accepted';
  exception
    when check_violation then null;
  end;

  begin
    insert into public.admin_audit_events (
      request_id, admin_user_id, admin_auth_user_id, admin_role,
      action, severity, reason, result_count
    ) values (
      '00000000-0000-0000-0001-000000000008', v_admin_user_id,
      '00000000-0000-0000-0000-000000001181', 'owner',
      'admin.user.resolve', 'info', 'Investigate account-managed history.', 51
    );
    raise exception 'out-of-range result count was accepted';
  exception
    when check_violation then null;
  end;

  begin
    insert into public.admin_audit_events (
      request_id, admin_user_id, admin_auth_user_id, admin_role,
      action, severity, reason, metadata
    ) values (
      '00000000-0000-0000-0001-000000000009', v_admin_user_id,
      '00000000-0000-0000-0000-000000001181', 'owner',
      'admin.user.resolve', 'info', 'Investigate account-managed history.',
      '{"email":"forbidden"}'::jsonb
    );
    raise exception 'non-allowlisted audit metadata was accepted';
  exception
    when check_violation then null;
  end;

  begin
    insert into public.admin_audit_events (
      request_id, admin_user_id, admin_auth_user_id, admin_role,
      action, severity, reason, metadata
    ) values (
      '00000000-0000-0000-0001-000000000010', v_admin_user_id,
      '00000000-0000-0000-0000-000000001181', 'owner',
      'admin.user.resolve', 'info', 'Investigate account-managed history.',
      '{"api_version":2}'::jsonb
    );
    raise exception 'invalid audit metadata value was accepted';
  exception
    when check_violation then null;
  end;

  begin
    insert into public.admin_audit_events (
      request_id, admin_user_id, admin_auth_user_id, admin_role,
      action, severity, reason
    ) values (
      '00000000-0000-0000-0001-000000000011', v_admin_user_id,
      '00000000-0000-0000-0000-000000001181', 'owner',
      'admin.session.check', 'info', 'Client supplied context reason.'
    );
    raise exception 'non-system session reason was accepted';
  exception
    when check_violation then null;
  end;
end;
$$;

-- Operator updates must refresh updated_at, but service_role cannot update rows.
update public.admin_users
set enabled = false
where user_id = '00000000-0000-0000-0000-000000001182';

do $$
begin
  if not exists (
    select 1
    from public.admin_users
    where user_id = '00000000-0000-0000-0000-000000001182'
      and updated_at > created_at
  ) then
    raise exception 'admin_users updated_at trigger did not run';
  end if;

  if has_table_privilege('anon', 'public.admin_users', 'SELECT')
    or has_table_privilege('authenticated', 'public.admin_users', 'SELECT')
    or has_table_privilege('anon', 'public.admin_audit_events', 'SELECT')
    or has_table_privilege('authenticated', 'public.admin_audit_events', 'SELECT')
  then
    raise exception 'frontend role received direct administrator table access';
  end if;

  if exists (
    select 1
    from public.admin_users
    where user_id = '00000000-0000-0000-0000-000000001183'
  ) then
    raise exception 'ordinary account C unexpectedly became an administrator';
  end if;
end;
$$;

set local role service_role;

insert into public.admin_audit_events (
  request_id,
  admin_user_id,
  admin_auth_user_id,
  admin_role,
  action,
  severity,
  reason,
  result_count,
  metadata
)
select
  '00000000-0000-0000-0002-000000000001',
  id,
  user_id,
  role,
  'admin.session.check',
  'info',
  'System administrator context check.',
  1,
  '{"api_version":1,"result_status":"ok"}'::jsonb
from public.admin_users
where user_id = '00000000-0000-0000-0000-000000001181';

insert into public.admin_audit_events (
  request_id,
  admin_user_id,
  admin_auth_user_id,
  admin_role,
  action,
  severity,
  reason,
  result_count,
  metadata
)
select
  '00000000-0000-0000-0002-000000000002',
  id,
  user_id,
  role,
  'admin.home_space.list',
  'info',
  'Investigate account-managed history.',
  0,
  '{"api_version":1,"page_direction":"initial","result_status":"empty"}'::jsonb
from public.admin_users
where user_id = '00000000-0000-0000-0000-000000001182';

reset role;

select
  case
    when user_id = '00000000-0000-0000-0000-000000001181' then 'A-owner'
    when user_id = '00000000-0000-0000-0000-000000001182' then 'B-support-disabled'
  end as test_identity,
  role,
  enabled
from public.admin_users
where user_id in (
  '00000000-0000-0000-0000-000000001181',
  '00000000-0000-0000-0000-000000001182'
)
order by user_id;

select
  'C-ordinary' as test_identity,
  not exists (
    select 1
    from public.admin_users
    where user_id = '00000000-0000-0000-0000-000000001183'
  ) as has_no_admin_record;

select
  action,
  admin_role,
  result_count,
  metadata
from public.admin_audit_events
where request_id in (
  '00000000-0000-0000-0002-000000000001',
  '00000000-0000-0000-0002-000000000002'
)
order by request_id;

-- Expected before rollback:
-- - A is enabled owner; B is disabled support; C has no admin record.
-- - exactly two valid service_role audit rows are shown.
-- - every invalid insert above is rejected without aborting the transaction.

rollback;

-- 9. The rollback must remove only the synthetic verification rows.
do $$
begin
  if exists (
    select 1
    from auth.users
    where id in (
      '00000000-0000-0000-0000-000000001181',
      '00000000-0000-0000-0000-000000001182',
      '00000000-0000-0000-0000-000000001183'
    )
  )
    or exists (
      select 1
      from public.admin_users
      where user_id in (
        '00000000-0000-0000-0000-000000001181',
        '00000000-0000-0000-0000-000000001182',
        '00000000-0000-0000-0000-000000001183'
      )
    )
    or exists (
      select 1
      from public.admin_audit_events
      where request_id in (
        '00000000-0000-0000-0001-000000000001',
        '00000000-0000-0000-0001-000000000002',
        '00000000-0000-0000-0001-000000000003',
        '00000000-0000-0000-0001-000000000004',
        '00000000-0000-0000-0001-000000000005',
        '00000000-0000-0000-0001-000000000006',
        '00000000-0000-0000-0001-000000000007',
        '00000000-0000-0000-0001-000000000008',
        '00000000-0000-0000-0001-000000000009',
        '00000000-0000-0000-0001-000000000010',
        '00000000-0000-0000-0001-000000000011',
        '00000000-0000-0000-0002-000000000001',
        '00000000-0000-0000-0002-000000000002'
      )
    )
  then
    raise exception 'Phase 1.18.1 verification rollback left synthetic rows behind';
  end if;
end;
$$;

select 'admin_readonly_foundation_rollback_ok' as verification_result;
