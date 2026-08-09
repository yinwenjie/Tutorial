begin;

-- Phase 1.18.1: administrator identity and append-only audit foundation.
-- No administrator is initialized by this migration. Administrator lifecycle
-- changes remain explicit operations performed by a trusted database operator.

create table if not exists public.admin_users (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  role text not null,
  enabled boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_users_role_valid check (role in ('owner', 'admin', 'support')),
  constraint admin_users_timestamps_valid check (updated_at >= created_at)
);

create index if not exists admin_users_enabled_role_idx
  on public.admin_users(enabled, role)
  where enabled;

drop trigger if exists admin_users_set_updated_at on public.admin_users;
create trigger admin_users_set_updated_at
before update on public.admin_users
for each row execute function public.set_updated_at();

create table if not exists public.admin_audit_events (
  id uuid primary key default extensions.gen_random_uuid(),
  request_id uuid not null unique,
  admin_user_id uuid references public.admin_users(id) on delete set null,
  admin_auth_user_id uuid not null,
  admin_role text not null,
  action text not null,
  severity text not null,
  reason text not null,
  target_user_id uuid,
  target_home_space_id uuid,
  target_sync_space_id uuid,
  target_snapshot_id uuid,
  result_count integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint admin_audit_events_admin_role_valid
    check (admin_role in ('owner', 'admin', 'support')),
  constraint admin_audit_events_action_valid check (action in (
    'admin.session.check',
    'admin.user.resolve',
    'admin.home_space.list',
    'admin.snapshot.list',
    'admin.snapshot.preview',
    'admin.home_audit.list',
    'admin.audit.list'
  )),
  constraint admin_audit_events_severity_valid
    check (severity in ('info', 'warning', 'danger')),
  constraint admin_audit_events_reason_trimmed
    check (reason = btrim(reason)),
  constraint admin_audit_events_reason_size
    check (char_length(reason) between 8 and 500),
  constraint admin_audit_events_reason_no_sensitive_shape check (
    reason !~* '[[:alnum:]_.%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}'
    and reason !~* '(https?://|www\.)'
    and reason !~ '(^|[^A-Za-z0-9_-])[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}([^A-Za-z0-9_-]|$)'
    and reason !~* '(^|[^[:alnum:]_])hp1_[^[:space:]]+'
    and reason !~* '(bearer|token|secret|authorization|sync[ _-]?code)[[:space:]]*[:=][[:space:]]*[^[:space:]]+'
  ),
  constraint admin_audit_events_session_reason_fixed check (
    (action = 'admin.session.check') = (reason = 'System administrator context check.')
  ),
  constraint admin_audit_events_result_count_valid
    check (result_count is null or result_count between 0 and 50),
  constraint admin_audit_events_metadata_object
    check (jsonb_typeof(metadata) = 'object'),
  constraint admin_audit_events_metadata_size
    check (octet_length(metadata::text) <= 1024),
  constraint admin_audit_events_metadata_keys_valid check (
    (metadata - array[
      'api_version',
      'page_direction',
      'access_mode',
      'result_status'
    ]::text[]) = '{}'::jsonb
  ),
  constraint admin_audit_events_metadata_values_valid check (
    (
      not (metadata ? 'api_version')
      or (
        jsonb_typeof(metadata -> 'api_version') = 'number'
        and metadata ->> 'api_version' = '1'
      )
    )
    and (
      not (metadata ? 'page_direction')
      or (
        jsonb_typeof(metadata -> 'page_direction') = 'string'
        and metadata ->> 'page_direction' in ('initial', 'next', 'previous')
      )
    )
    and (
      not (metadata ? 'access_mode')
      or (
        jsonb_typeof(metadata -> 'access_mode') = 'string'
        and metadata ->> 'access_mode' in (
          'sync-code',
          'account-managed',
          'password-protected'
        )
      )
    )
    and (
      not (metadata ? 'result_status')
      or (
        jsonb_typeof(metadata -> 'result_status') = 'string'
        and metadata ->> 'result_status' in ('ok', 'empty')
      )
    )
  )
);

create index if not exists admin_audit_events_admin_created_idx
  on public.admin_audit_events(admin_auth_user_id, created_at desc, id desc);
create index if not exists admin_audit_events_target_user_created_idx
  on public.admin_audit_events(target_user_id, created_at desc, id desc)
  where target_user_id is not null;
create index if not exists admin_audit_events_target_home_space_created_idx
  on public.admin_audit_events(target_home_space_id, created_at desc, id desc)
  where target_home_space_id is not null;
create index if not exists admin_audit_events_target_sync_space_created_idx
  on public.admin_audit_events(target_sync_space_id, created_at desc, id desc)
  where target_sync_space_id is not null;
create index if not exists admin_audit_events_target_snapshot_created_idx
  on public.admin_audit_events(target_snapshot_id, created_at desc, id desc)
  where target_snapshot_id is not null;
create index if not exists admin_audit_events_action_created_idx
  on public.admin_audit_events(action, created_at desc, id desc);
create index if not exists admin_audit_events_created_idx
  on public.admin_audit_events(created_at desc, id desc);

alter table public.admin_users enable row level security;
alter table public.admin_audit_events enable row level security;

revoke all on table public.admin_users from public, anon, authenticated, service_role;
revoke all on table public.admin_audit_events from public, anon, authenticated, service_role;

grant select on table public.admin_users to service_role;
grant select, insert on table public.admin_audit_events to service_role;

commit;
