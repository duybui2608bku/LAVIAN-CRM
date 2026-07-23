-- Add Sales to the user department catalog.
-- This handles both a fresh migration replay (where the original enum migration
-- sorts later) and an existing database that already has user_department.
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'user_department'
  ) then
    create type public.user_department as enum (
      'customer_care',
      'technician',
      'sales'
    );
  else
    alter type public.user_department add value if not exists 'sales';
  end if;
end
$$;
