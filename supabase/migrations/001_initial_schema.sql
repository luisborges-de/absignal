create extension if not exists "pgcrypto";

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  issuer text not null,
  closing_date date not null,
  ar_date date not null,
  total_issuance bigint not null,
  asset_count int not null default 1,
  collateral_description text,
  rating_agency text,
  rating text,
  ltv numeric(5,4),
  is_demo boolean default false,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','ARCHIVED','DRAFT')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.trigger_rules (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references public.deals(id) on delete cascade not null,
  family text not null check (family in (
    'DSCR_CASH_TRAP','DSCR_EARLY_AMORTISATION','LTV_SWEEP',
    'OCCUPANCY_RESERVE','TENANT_CONCENTRATION','WART_RESERVE',
    'SERVICER_TERMINATION','ADDITIONAL_ISSUANCE','ARD_MATURITY','EXPENSE_RESERVE'
  )),
  name text not null,
  description text,
  metric_key text not null,
  operator text not null check (operator in ('LT','GT','LTE','GTE','EQ','BINARY')),
  threshold numeric(12,4),
  threshold_unit text,
  lookback_periods int not null default 1,
  consequence text not null check (consequence in (
    'CASH_TRAP','EARLY_AMORTISATION','ENHANCED_RESERVE',
    'MANDATORY_DELEVERAGING','TURBO_AMORTISATION',
    'RATE_STEP_UP','MANAGER_REMOVAL','ISSUANCE_BLOCKED'
  )),
  section_reference text,
  source_text text,
  extraction_status text not null default 'PENDING'
    check (extraction_status in ('PENDING','EXTRACTED','APPROVED','REJECTED')),
  extraction_confidence numeric(3,2),
  watch_buffer numeric(4,3) default 0.10,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.performance_snapshots (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references public.deals(id) on delete cascade not null,
  period_date date not null,
  occupancy_rate numeric(5,4),
  leased_capacity_mw numeric(10,2),
  total_capacity_mw numeric(10,2),
  contracted_revenue bigint,
  gross_revenue bigint,
  operating_expenses bigint,
  net_cash_flow bigint,
  scheduled_debt_service bigint,
  senior_debt_service bigint,
  dscr numeric(7,4),
  senior_dscr numeric(7,4),
  ltv numeric(5,4),
  pue_ratio numeric(5,3),
  power_cost_per_kwh numeric(6,4),
  top_tenant_revenue_pct numeric(5,4),
  tenant_count int,
  weighted_avg_remaining_lease_term numeric(6,2),
  outstanding_balance bigint,
  appraised_value bigint,
  senior_interest_reserve_balance bigint,
  expense_reserve_balance bigint,
  required_reserve_balance bigint,
  source text default 'MANUAL' check (source in ('MANUAL','CSV_IMPORT','DEMO')),
  notes text,
  created_at timestamptz default now(),
  unique (deal_id, period_date)
);

create table public.trigger_evaluations (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid references public.trigger_rules(id) on delete cascade not null,
  snapshot_id uuid references public.performance_snapshots(id) on delete cascade not null,
  status text not null check (status in ('SAFE','WATCH','BREACH','N/A')),
  current_value numeric(12,4),
  threshold numeric(12,4),
  distance_to_breach_pct numeric(8,4),
  lookback_values jsonb,
  evaluated_at timestamptz default now(),
  unique (rule_id, snapshot_id)
);

create index on public.trigger_rules (deal_id);
create index on public.performance_snapshots (deal_id, period_date desc);
create index on public.trigger_evaluations (snapshot_id);
create index on public.trigger_evaluations (rule_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger set_updated_at_deals
  before update on public.deals for each row execute function public.set_updated_at();
create trigger set_updated_at_rules
  before update on public.trigger_rules for each row execute function public.set_updated_at();
