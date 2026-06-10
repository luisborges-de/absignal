alter table public.deals
  add column if not exists market text not null default 'NORTHERN_VIRGINIA'
  check (market in ('NORTHERN_VIRGINIA','SILICON_VALLEY','CHICAGO','DALLAS','PHOENIX'));
