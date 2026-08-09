begin;

select plan(10);

select has_table('public', 'sync_spaces', 'sync_spaces should exist after migration replay');
select has_table('public', 'profiles', 'profiles should exist after migration replay');
select has_table('public', 'home_spaces', 'home_spaces should exist after migration replay');
select has_table(
  'public',
  'home_space_snapshots',
  'home_space_snapshots should exist after migration replay'
);
select has_table(
  'public',
  'home_space_audit_events',
  'home_space_audit_events should exist after migration replay'
);
select has_table(
  'public',
  'product_analytics_events',
  'product_analytics_events should exist after migration replay'
);
select has_table(
  'public',
  'client_error_events',
  'client_error_events should exist after migration replay'
);
select has_table(
  'public',
  'public_home_shares',
  'public_home_shares should exist after migration replay'
);
select has_function(
  'public',
  'upsert_public_home_share',
  array['uuid', 'text', 'jsonb'],
  'upsert_public_home_share should exist after migration replay'
);
select has_function(
  'public',
  'read_public_home_share',
  array['text'],
  'read_public_home_share should exist after migration replay'
);

select * from finish();

rollback;
