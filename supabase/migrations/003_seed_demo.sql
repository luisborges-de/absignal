insert into public.deals (
  id, user_id, name, issuer, closing_date, ar_date, total_issuance, asset_count,
  collateral_description, rating_agency, rating, ltv, is_demo, status
) values (
  'a1b2c3d4-0000-0000-0000-ce47e53a4a2e',
  null,
  'Centersquare Issuer LLC, Series 2025-2',
  'Centersquare Investment Management',
  '2025-03-15',
  '2029-10-15',
  940000000,
  26,
  '26 colocation data centers across 10 U.S. markets, about 485 MW total capacity',
  'KBRA',
  'A- (sf)',
  0.6100,
  true,
  'ACTIVE'
) on conflict (id) do update set
  name = excluded.name,
  issuer = excluded.issuer,
  closing_date = excluded.closing_date,
  ar_date = excluded.ar_date,
  total_issuance = excluded.total_issuance,
  asset_count = excluded.asset_count,
  collateral_description = excluded.collateral_description,
  rating_agency = excluded.rating_agency,
  rating = excluded.rating,
  ltv = excluded.ltv,
  is_demo = excluded.is_demo,
  status = excluded.status;

-- The 8 trigger rules, 12 monthly snapshots, and 96 evaluations are inserted
-- idempotently by POST /api/seed-demo with ENABLE_DEMO_SEED=true.
