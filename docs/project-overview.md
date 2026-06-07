# ABSignal Project Overview

## Vision

ABSignal explores a focused idea: structured finance surveillance should understand the deal, not just display the numbers.

Data center ABS transactions sit at the intersection of hard infrastructure, operating performance and legal covenant mechanics. A credit analyst needs to know whether occupancy, DSCR, LTV, tenant concentration or reserve balances are merely moving, or whether they are approaching a specific contractual consequence.

The long-term vision for ABSignal is a deal-aware credit intelligence layer for asset-backed securities, starting with data center ABS.

## Problem

ABS surveillance workflows are often fragmented:

- Deal documents contain the binding rules, but they are dense and difficult to operationalize.
- Performance data arrives as periodic reporting, often detached from the language that defines trigger consequences.
- Credit teams must manually connect metrics to thresholds, lookback periods, watch zones and waterfall effects.
- Investor communication depends on clear explanations of what changed, why it matters and what happens next.

This fragmentation creates room for slow analysis, inconsistent interpretation and missed early-warning signals.

## Product Concept

ABSignal is a prototype of a surveillance platform that connects:

- ABS transaction documents
- Operational data center performance metrics
- Structured finance analytics

The prototype demonstrates how a deal can be represented as structured rules, evaluated against monthly performance snapshots and translated into credit consequences such as cash trap risk or early amortisation watch states.

The current implementation includes:

- A synthetic data center ABS demo deal
- Structured trigger and covenant rules
- DSCR, occupancy, LTV and tenant concentration analytics
- Safe, watch and breach status monitoring
- A cash-flow waterfall visualization
- CSV export for surveillance summaries

The project is intentionally scoped as a hackathon prototype. It prioritizes product clarity and concept validation over production completeness.

## Why It Matters

Data center ABS is a useful wedge because the collateral is operationally complex and increasingly relevant to infrastructure finance. Credit performance depends on both financing structure and operating behavior: leasing, power usage, tenant mix, reserve coverage and refinancing pressure.

A deal-aware interface can help analysts move from raw reporting toward a more direct question:

> What is the credit consequence of the latest performance data under this specific deal?

## Long-Term Roadmap

Potential future development areas:

- Broader document extraction for offering memoranda, indentures and surveillance reports
- Versioned rule review with analyst approvals and audit history
- Multi-deal portfolio monitoring
- Scenario analysis for DSCR, occupancy and refinancing stress
- Investor-facing surveillance exports
- Alerting for watch-zone movement and covenant deterioration
- Support for additional ABS verticals beyond data centers
- Integration with structured data feeds and document repositories

## Current Status

ABSignal is suitable as a portfolio and research project showing:

- Product thinking in a specialized financial domain
- Full-stack prototype implementation
- Data modeling for structured credit workflows
- Frontend dashboard and visualization design
- Supabase-backed demo seeding and persistence
- Test coverage around deterministic trigger and waterfall logic

It is not a production financial system and should not be used for real investment decisions.
