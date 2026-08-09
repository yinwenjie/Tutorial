-- Fail-closed preflight for deploying migrations to the hosted Supabase project.
--
-- Migrations 001-018 were historically executed through the Dashboard SQL
-- Editor. Before CLI deployment is enabled, their versions must be reconciled
-- with supabase_migrations.schema_migrations. This script never repairs history
-- and never mutates application data.

do $$
declare
  v_required_versions constant text[] := array[
    '001', '002', '003', '004', '005', '006',
    '007', '008', '009', '010', '011', '012',
    '013', '014', '015', '016', '017', '018'
  ];
  v_missing_versions text[];
  v_019_recorded boolean;
  v_admin_users_exists boolean;
  v_admin_audit_exists boolean;
begin
  if to_regclass('supabase_migrations.schema_migrations') is null then
    raise exception using
      errcode = 'P0001',
      message = 'Remote migration history is missing. Audit the existing schema and repair versions 001-018 before deployment.';
  end if;

  select array_agg(required_version order by required_version)
  into v_missing_versions
  from unnest(v_required_versions) as required_version
  where not exists (
    select 1
    from supabase_migrations.schema_migrations history
    where history.version = required_version
  );

  if v_missing_versions is not null then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Remote migration history is missing required versions: %s. Do not run db push or --include-all.',
        array_to_string(v_missing_versions, ', ')
      );
  end if;

  if to_regclass('public.sync_spaces') is null
    or to_regclass('public.home_spaces') is null
    or to_regclass('public.home_space_snapshots') is null
    or to_regclass('public.public_home_shares') is null
    or to_regprocedure('public.upsert_public_home_share(uuid,text,jsonb)') is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'Remote schema does not contain the required 001-018 baseline objects. Do not repair history automatically.';
  end if;

  select exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '019'
  ) into v_019_recorded;

  v_admin_users_exists := to_regclass('public.admin_users') is not null;
  v_admin_audit_exists := to_regclass('public.admin_audit_events') is not null;

  if v_admin_users_exists <> v_admin_audit_exists then
    raise exception using
      errcode = 'P0001',
      message = 'Phase 1.18.1 schema is partial: admin tables do not exist as a pair.';
  end if;

  if v_019_recorded <> (v_admin_users_exists and v_admin_audit_exists) then
    raise exception using
      errcode = 'P0001',
      message = 'Migration 019 history and administrator schema are out of sync. Stop and reconcile them manually.';
  end if;
end;
$$;

select 'remote_migration_history_baseline_ok' as verification_result;
