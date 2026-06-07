alter table public.deals enable row level security;
alter table public.trigger_rules enable row level security;
alter table public.performance_snapshots enable row level security;
alter table public.trigger_evaluations enable row level security;

create policy "own_deals" on public.deals
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "read_demo_deals" on public.deals
  for select using (is_demo = true and auth.role() = 'authenticated');

create policy "own_trigger_rules" on public.trigger_rules for all using (
  deal_id in (select id from public.deals where user_id = auth.uid() or is_demo = true)
);

create policy "own_snapshots" on public.performance_snapshots for all using (
  deal_id in (select id from public.deals where user_id = auth.uid() or is_demo = true)
);

create policy "own_evaluations" on public.trigger_evaluations for all using (
  rule_id in (
    select id from public.trigger_rules where deal_id in (
      select id from public.deals where user_id = auth.uid() or is_demo = true
    )
  )
);
