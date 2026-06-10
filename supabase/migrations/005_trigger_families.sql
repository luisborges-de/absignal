alter table public.trigger_rules drop constraint if exists trigger_rules_family_check;

alter table public.trigger_rules add constraint trigger_rules_family_check check (family in (
  'DSCR_CASH_TRAP','DSCR_EARLY_AMORTISATION','DSCR_SENIOR_CASH_TRAP','LTV_SWEEP',
  'OCCUPANCY_RESERVE','TENANT_CONCENTRATION','WART_RESERVE','WALT_CASH_TRAP',
  'PUE_EFFICIENCY','POWER_COST','SERVICER_TERMINATION','ADDITIONAL_ISSUANCE',
  'ARD_MATURITY','EXPENSE_RESERVE','INTEREST_RESERVE'
));
