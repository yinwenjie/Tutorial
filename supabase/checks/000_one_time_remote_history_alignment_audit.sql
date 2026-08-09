-- One-time, read-only schema audit before reconciling manually applied
-- migrations 001-019 with Supabase CLI migration history.
--
-- This file must never repair history or modify application data. The
-- temporary protected workflow runs the rollback-scoped 021 verification
-- separately before it invokes `supabase migration repair`.

do $$
declare
  v_required_tables constant text[] := array[
    'sync_spaces',
    'profiles',
    'account_preferences',
    'home_spaces',
    'home_space_credentials',
    'home_space_snapshots',
    'home_space_audit_events',
    'product_analytics_events',
    'client_error_events',
    'public_home_shares',
    'admin_users',
    'admin_audit_events'
  ];
  v_required_functions constant text[] := array[
    'next_sync_revision',
    'check_sync_space_revision',
    'create_sync_space',
    'pull_sync_space',
    'push_sync_space',
    'force_push_sync_space',
    'revoke_sync_space',
    'activate_home_space',
    'create_account_managed_home_space',
    'migrate_sync_code_home_space_to_account_managed',
    'rename_home_space',
    'set_default_home_space',
    'remove_home_space_from_account',
    'create_account_managed_home_space_v2',
    'migrate_sync_code_home_space_to_account_managed_v2',
    'push_account_managed_sync_space',
    'force_push_account_managed_sync_space',
    'record_product_event',
    'delete_product_analytics_events_older_than',
    'record_client_error_event',
    'delete_client_error_events_older_than',
    'upsert_public_home_share',
    'get_public_home_share_metadata',
    'revoke_public_home_share',
    'read_public_home_share'
  ];
  v_required_columns constant text[] := array[
    'account_preferences.locale',
    'account_preferences.font_family',
    'account_preferences.density',
    'account_preferences.default_search_engine',
    'account_preferences.default_space_id',
    'home_spaces.access_mode',
    'home_space_credentials.access_token',
    'home_space_credentials.encryption_key',
    'home_space_snapshots.document_json',
    'home_space_audit_events.event_type',
    'product_analytics_events.properties',
    'client_error_events.properties',
    'public_home_shares.document_json',
    'public_home_shares.token_hash',
    'admin_users.role',
    'admin_audit_events.metadata'
  ];
  v_missing text[];
  v_history_count bigint;
  v_upsert_definition text;
begin
  -- The authorized repair applies only to the known empty-history state seen
  -- in dry-run 31321863144. Refuse partial or unexpected histories.
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    execute 'select count(*) from supabase_migrations.schema_migrations'
      into v_history_count;

    if v_history_count <> 0 then
      raise exception using
        errcode = 'P0001',
        message = format(
          'One-time alignment expected empty migration history but found %s row(s).',
          v_history_count
        );
    end if;
  end if;

  select array_agg(required_name order by required_name)
  into v_missing
  from unnest(v_required_tables) as required_name
  where to_regclass(format('public.%I', required_name)) is null;

  if v_missing is not null then
    raise exception 'Missing required 001-019 tables: %', array_to_string(v_missing, ', ');
  end if;

  select array_agg(required_name order by required_name)
  into v_missing
  from unnest(v_required_functions) as required_name
  where not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = required_name
  );

  if v_missing is not null then
    raise exception 'Missing required 001-018 functions: %', array_to_string(v_missing, ', ');
  end if;

  select array_agg(required_name order by required_name)
  into v_missing
  from unnest(v_required_columns) as required_name
  where not exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name || '.' || c.column_name = required_name
  );

  if v_missing is not null then
    raise exception 'Missing required 001-019 columns: %', array_to_string(v_missing, ', ');
  end if;

  if (
    select count(*)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = any(v_required_tables)
      and c.relkind = 'r'
      and c.relrowsecurity
  ) <> cardinality(v_required_tables) then
    raise exception 'One or more required 001-019 public tables do not have RLS enabled';
  end if;

  if public.next_sync_revision(998) <> 999
    or public.next_sync_revision(999) <> 0
  then
    raise exception 'Migration 003 revision range behavior is missing';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.sync_spaces'::regclass
      and conname = 'sync_spaces_revision_range'
      and pg_get_constraintdef(oid) like '%revision >= 0%revision <= 999%'
  ) then
    raise exception 'Migration 003 sync_spaces revision constraint is missing';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.account_preferences'::regclass
      and conname = 'account_preferences_default_search_engine_allowed'
      and pg_get_constraintdef(oid) like '%yandex%'
  ) then
    raise exception 'Migration 011 Yandex search-engine constraint is missing';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.account_preferences'::regclass
      and conname = 'account_preferences_locale_allowed'
      and pg_get_constraintdef(oid) like '%system%'
      and pg_get_constraintdef(oid) like '%it-IT%'
  ) then
    raise exception 'Migration 016 locale constraint is missing';
  end if;

  if not exists (
    select 1
    from storage.buckets
    where id = 'home-assets'
      and public = false
      and file_size_limit = 5242880
  ) then
    raise exception 'Migration 012 private home-assets bucket configuration is missing';
  end if;

  if (
    select count(*)
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname in (
        'home assets insert own folder',
        'home assets read own folder',
        'home assets update own folder',
        'home assets delete own folder'
      )
  ) <> 4 then
    raise exception 'Migration 012 home-assets policy set is incomplete';
  end if;

  if to_regprocedure('public.upsert_public_home_share(uuid,text,jsonb)') is null
    or to_regprocedure('public.read_public_home_share(text)') is null
  then
    raise exception 'Migration 017 public-share function signatures are missing';
  end if;

  select pg_get_functiondef('public.upsert_public_home_share(uuid,text,jsonb)'::regprocedure)
  into v_upsert_definition;

  if position(
    'on conflict on constraint public_home_shares_one_per_home_space'
    in lower(v_upsert_definition)
  ) = 0 then
    raise exception 'Migration 018 public-share conflict fix is missing';
  end if;

  if has_function_privilege('anon', 'public.upsert_public_home_share(uuid,text,jsonb)', 'EXECUTE')
    or not has_function_privilege(
      'authenticated',
      'public.upsert_public_home_share(uuid,text,jsonb)',
      'EXECUTE'
    )
    or not has_function_privilege('anon', 'public.read_public_home_share(text)', 'EXECUTE')
  then
    raise exception 'Migration 017/018 public-share execute grants differ from the contract';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in (
        'product_analytics_events',
        'client_error_events',
        'public_home_shares',
        'admin_users',
        'admin_audit_events'
      )
      and grantee in ('anon', 'authenticated', 'PUBLIC')
  ) then
    raise exception 'A protected 014-019 table has a frontend direct grant';
  end if;
end;
$$;

select 'one_time_remote_history_alignment_schema_ok' as verification_result;
