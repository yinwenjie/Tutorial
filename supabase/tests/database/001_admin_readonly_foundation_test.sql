begin;

select plan(46);

select has_table('public', 'admin_users', 'admin_users should exist');
select has_table('public', 'admin_audit_events', 'admin_audit_events should exist');

select is(
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'admin_users'
  ),
  7::bigint,
  'admin_users should expose exactly the planned columns'
);

select is(
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'admin_audit_events'
  ),
  15::bigint,
  'admin_audit_events should expose exactly the planned columns'
);

select is(
  (
    select count(*)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('admin_users', 'admin_audit_events')
      and c.relrowsecurity
  ),
  2::bigint,
  'both administrator tables should have RLS enabled'
);

select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename in ('admin_users', 'admin_audit_events')
  ),
  0::bigint,
  'administrator tables should have no frontend RLS policies'
);

select is(
  (
    select count(*)
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in ('admin_users', 'admin_audit_events')
      and grantee in ('anon', 'authenticated', 'PUBLIC')
  ),
  0::bigint,
  'frontend roles should have no direct administrator table grants'
);

select is(
  (
    select count(*)
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in ('admin_users', 'admin_audit_events')
      and grantee = 'service_role'
  ),
  3::bigint,
  'service_role should have exactly three administrator table grants'
);

select is(
  (
    select string_agg(table_name || ':' || privilege_type, ', ' order by table_name, privilege_type)
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in ('admin_users', 'admin_audit_events')
      and grantee = 'service_role'
  ),
  'admin_audit_events:INSERT, admin_audit_events:SELECT, admin_users:SELECT',
  'service_role grants should match the minimum read/append matrix'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.admin_users'::regclass
      and conname = 'admin_users_role_valid'
      and contype = 'c'
  ),
  'admin role allowlist constraint should exist'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.admin_users'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) = 'UNIQUE (user_id)'
  ),
  'one administrator row per Auth user should be enforced'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.admin_audit_events'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) = 'UNIQUE (request_id)'
  ),
  'one audit event per request id should be enforced'
);

select is(
  (
    select count(*)
    from pg_constraint
    where conrelid = 'public.admin_audit_events'::regclass
      and contype = 'c'
  ),
  12::bigint,
  'audit table should have all role/action/reason/result/metadata checks'
);

select is(
  (
    select count(*)
    from pg_indexes
    where schemaname = 'public'
      and indexname in (
        'admin_users_enabled_role_idx',
        'admin_audit_events_admin_created_idx',
        'admin_audit_events_target_user_created_idx',
        'admin_audit_events_target_home_space_created_idx',
        'admin_audit_events_target_sync_space_created_idx',
        'admin_audit_events_target_snapshot_created_idx',
        'admin_audit_events_action_created_idx',
        'admin_audit_events_created_idx'
      )
  ),
  8::bigint,
  'administrator lookup and audit cursor indexes should exist'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.admin_users'::regclass
      and tgname = 'admin_users_set_updated_at'
      and not tgisinternal
  ),
  'admin_users updated_at trigger should exist'
);

select ok(
  not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.admin_audit_events'::regclass
      and contype = 'f'
      and pg_get_constraintdef(oid) like 'FOREIGN KEY (admin_auth_user_id)%'
  ),
  'admin_auth_user_id should remain an audit snapshot without an Auth foreign key'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.admin_audit_events'::regclass
      and contype = 'f'
      and pg_get_constraintdef(oid) like 'FOREIGN KEY (admin_user_id)%ON DELETE SET NULL'
  ),
  'audit admin row reference should use on-delete-set-null'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.admin_users'::regclass
      and contype = 'f'
      and pg_get_constraintdef(oid) like 'FOREIGN KEY (user_id)%ON DELETE CASCADE'
  ),
  'administrator Auth identity should use on-delete-cascade'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.admin_users'::regclass
      and contype = 'f'
      and pg_get_constraintdef(oid) like 'FOREIGN KEY (created_by)%ON DELETE SET NULL'
  ),
  'administrator creator reference should use on-delete-set-null'
);

create function pg_temp.statement_rejected(p_sql text, p_expected_state text)
returns boolean
language plpgsql
as $$
begin
  execute p_sql;
  return false;
exception
  when others then
    return sqlstate = p_expected_state;
end;
$$;

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
    'phase-1-18-test-a@example.invalid',
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
    'phase-1-18-test-b@example.invalid',
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
    'phase-1-18-test-c@example.invalid',
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

select ok(
  pg_temp.statement_rejected(
    $sql$
      insert into public.admin_users (user_id, role)
      values ('00000000-0000-0000-0000-000000001183', 'viewer')
    $sql$,
    '23514'
  ),
  'invalid administrator role should be rejected'
);

select ok(
  pg_temp.statement_rejected(
    $sql$
      insert into public.admin_audit_events
        (request_id, admin_auth_user_id, admin_role, action, severity, reason)
      values
        ('00000000-0000-0000-0001-000000000001',
         '00000000-0000-0000-0000-000000001181', 'viewer',
         'admin.user.resolve', 'info', 'Investigate account-managed history.')
    $sql$,
    '23514'
  ),
  'invalid audit role snapshot should be rejected'
);

select ok(
  pg_temp.statement_rejected(
    $sql$
      insert into public.admin_audit_events
        (request_id, admin_auth_user_id, admin_role, action, severity, reason)
      values
        ('00000000-0000-0000-0001-000000000002',
         '00000000-0000-0000-0000-000000001181', 'owner',
         'admin.unknown', 'info', 'Investigate account-managed history.')
    $sql$,
    '23514'
  ),
  'unknown audit action should be rejected'
);

select ok(
  pg_temp.statement_rejected(
    $sql$
      insert into public.admin_audit_events
        (request_id, admin_auth_user_id, admin_role, action, severity, reason)
      values
        ('00000000-0000-0000-0001-000000000003',
         '00000000-0000-0000-0000-000000001181', 'owner',
         'admin.user.resolve', 'critical', 'Investigate account-managed history.')
    $sql$,
    '23514'
  ),
  'unknown audit severity should be rejected'
);

select ok(
  pg_temp.statement_rejected(
    $sql$
      insert into public.admin_audit_events
        (request_id, admin_auth_user_id, admin_role, action, severity, reason)
      values
        ('00000000-0000-0000-0001-000000000004',
         '00000000-0000-0000-0000-000000001181', 'owner',
         'admin.user.resolve', 'info', 'short')
    $sql$,
    '23514'
  ),
  'short audit reason should be rejected'
);

select ok(
  pg_temp.statement_rejected(
    $sql$
      insert into public.admin_audit_events
        (request_id, admin_auth_user_id, admin_role, action, severity, reason)
      values
        ('00000000-0000-0000-0001-000000000005',
         '00000000-0000-0000-0000-000000001181', 'owner',
         'admin.user.resolve', 'info', 'Investigate user@example.invalid issue.')
    $sql$,
    '23514'
  ),
  'email-shaped audit reason should be rejected'
);

select ok(
  pg_temp.statement_rejected(
    $sql$
      insert into public.admin_audit_events
        (request_id, admin_auth_user_id, admin_role, action, severity, reason)
      values
        ('00000000-0000-0000-0001-000000000006',
         '00000000-0000-0000-0000-000000001181', 'owner',
         'admin.user.resolve', 'info', 'Investigate https://example.invalid issue.')
    $sql$,
    '23514'
  ),
  'URL-shaped audit reason should be rejected'
);

select ok(
  pg_temp.statement_rejected(
    $sql$
      insert into public.admin_audit_events
        (request_id, admin_auth_user_id, admin_role, action, severity, reason)
      values
        ('00000000-0000-0000-0001-000000000007',
         '00000000-0000-0000-0000-000000001181', 'owner',
         'admin.user.resolve', 'info',
         'Investigate eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMTgxIn0.signaturevalue1234567890 issue.')
    $sql$,
    '23514'
  ),
  'JWT-shaped audit reason should be rejected'
);

select ok(
  pg_temp.statement_rejected(
    $sql$
      insert into public.admin_audit_events
        (request_id, admin_auth_user_id, admin_role, action, severity, reason)
      values
        ('00000000-0000-0000-0001-000000000008',
         '00000000-0000-0000-0000-000000001181', 'owner',
         'admin.user.resolve', 'info',
         'Investigate hp1_00000000-0000-0000-0000-000000000000_accesssecret_encryptionsecret issue.')
    $sql$,
    '23514'
  ),
  'sync-code-shaped audit reason should be rejected'
);

select ok(
  pg_temp.statement_rejected(
    $sql$
      insert into public.admin_audit_events
        (request_id, admin_auth_user_id, admin_role, action, severity, reason, result_count)
      values
        ('00000000-0000-0000-0001-000000000009',
         '00000000-0000-0000-0000-000000001181', 'owner',
         'admin.user.resolve', 'info', 'Investigate account-managed history.', 51)
    $sql$,
    '23514'
  ),
  'result count above one page should be rejected'
);

select ok(
  pg_temp.statement_rejected(
    $sql$
      insert into public.admin_audit_events
        (request_id, admin_auth_user_id, admin_role, action, severity, reason, metadata)
      values
        ('00000000-0000-0000-0001-000000000010',
         '00000000-0000-0000-0000-000000001181', 'owner',
         'admin.user.resolve', 'info', 'Investigate account-managed history.',
         '{"email":"forbidden"}'::jsonb)
    $sql$,
    '23514'
  ),
  'non-allowlisted audit metadata key should be rejected'
);

select ok(
  pg_temp.statement_rejected(
    $sql$
      insert into public.admin_audit_events
        (request_id, admin_auth_user_id, admin_role, action, severity, reason, metadata)
      values
        ('00000000-0000-0000-0001-000000000011',
         '00000000-0000-0000-0000-000000001181', 'owner',
         'admin.user.resolve', 'info', 'Investigate account-managed history.',
         '{"api_version":2}'::jsonb)
    $sql$,
    '23514'
  ),
  'invalid audit metadata value should be rejected'
);

select ok(
  pg_temp.statement_rejected(
    $sql$
      insert into public.admin_audit_events
        (request_id, admin_auth_user_id, admin_role, action, severity, reason)
      values
        ('00000000-0000-0000-0001-000000000012',
         '00000000-0000-0000-0000-000000001181', 'owner',
         'admin.session.check', 'info', 'Client supplied context reason.')
    $sql$,
    '23514'
  ),
  'session check should require the fixed system reason'
);

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

select ok(
  pg_temp.statement_rejected(
    $sql$
      insert into public.admin_audit_events
        (request_id, admin_auth_user_id, admin_role, action, severity, reason)
      values
        ('00000000-0000-0000-0002-000000000001',
         '00000000-0000-0000-0000-000000001181', 'owner',
         'admin.user.resolve', 'info', 'Investigate account-managed history.')
    $sql$,
    '23505'
  ),
  'duplicate request id should be rejected'
);

select is(
  (
    select count(*)
    from public.admin_audit_events
    where request_id in (
      '00000000-0000-0000-0002-000000000001',
      '00000000-0000-0000-0002-000000000002'
    )
  ),
  2::bigint,
  'service_role should append and read valid audit events'
);

select is(
  (
    select role
    from public.admin_users
    where user_id = '00000000-0000-0000-0000-000000001181'
  ),
  'owner',
  'test identity A should be owner'
);

select is(
  (
    select role
    from public.admin_users
    where user_id = '00000000-0000-0000-0000-000000001182'
  ),
  'support',
  'test identity B should be support'
);

select is(
  (
    select count(*)
    from public.admin_users
    where user_id = '00000000-0000-0000-0000-000000001183'
  ),
  0::bigint,
  'test identity C should remain an ordinary account'
);

select ok(
  not has_table_privilege('authenticated', 'public.admin_users', 'SELECT'),
  'owner A should not gain direct frontend table access'
);

select ok(
  not has_table_privilege('authenticated', 'public.admin_users', 'SELECT'),
  'support B should not gain direct frontend table access'
);

select ok(
  not has_table_privilege('authenticated', 'public.admin_users', 'SELECT'),
  'ordinary C should not gain direct frontend table access'
);

select ok(
  not has_table_privilege('service_role', 'public.admin_users', 'UPDATE'),
  'service_role should not update administrator identities'
);

select ok(
  not has_table_privilege('service_role', 'public.admin_users', 'DELETE'),
  'service_role should not delete administrator identities'
);

select ok(
  not has_table_privilege('service_role', 'public.admin_audit_events', 'UPDATE'),
  'service_role should not update audit events'
);

select ok(
  not has_table_privilege('service_role', 'public.admin_audit_events', 'DELETE'),
  'service_role should not delete audit events'
);

update public.admin_users
set enabled = false
where user_id = '00000000-0000-0000-0000-000000001182';

select ok(
  exists (
    select 1
    from public.admin_users
    where user_id = '00000000-0000-0000-0000-000000001182'
      and updated_at > created_at
  ),
  'operator update should refresh admin_users.updated_at'
);

select is(
  (
    select count(*)
    from auth.users
    where id in (
      '00000000-0000-0000-0000-000000001181',
      '00000000-0000-0000-0000-000000001182',
      '00000000-0000-0000-0000-000000001183'
    )
  ),
  3::bigint,
  'A/B/C fixtures should exist only inside the test transaction'
);

select * from finish();

rollback;
