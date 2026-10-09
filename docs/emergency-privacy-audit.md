# Emergency privacy workflow — read-only audit (2026-10-09)

Status: design and read-only inspection only. No production records modified.

## Existing schema
- `public.client_sales`: client name, amount, visit date, member/team references.
- `public.clients`: client names and member/team references.
- `public.daily_results`: sales plus non-sales performance counters.
- `public.client_monthly_must_targets`: client-specific target linked by client_id.
- `public.monthly_goals`, `team_goals`, `department_goals`, `store_goals`: target values to retain.

## Read-only findings
- Client screen reads `client_sales`, `clients`, `client_monthly_must_targets` and writes to those tables.
- Member detail screen also reads these tables.
- Removing client records without addressing dependent target references would break client-specific goals.
- UI-only role checks cannot authorize server actions. Role checks must use authenticated server identity and active profile.
- Existing UI labels `team_manager` as 部責. Higher roles include department_manager, business_manager, company_manager, chairman.

## Required checks before enabling any destructive operation
1. Map all database dependencies, triggers, policies, functions and client-side caches.
2. Define explicit retention semantics for client-linked target rows.
3. Implement an authorization-controlled read-only impact preview and verify it against actual schema.
4. Test with synthetic records in a separate test environment.
5. Ensure operations are auditable and backups/exports are accounted for.
6. Keep production execution disabled pending a separate approval and verified rollback/recovery plan.

This file documents an audit only; it contains no delete commands or production secrets.
