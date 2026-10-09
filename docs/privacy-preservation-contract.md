# FOG GOALS — privacy impact preservation contract

Status: design and read-only verification only. No production mutation is authorized by this document.

## Scope and invariants

- Keep authentication accounts, profiles, members, teams and their hierarchy unchanged.
- Keep monthly, team, department and store goals unchanged.
- Keep non-sales counters in daily results unchanged.
- Client-specific monthly targets must remain linked to valid client IDs unless an explicit product decision changes their treatment.
- Never modify other applications' tables or shared JSON state in the same database.
- Do not present an RLS-filtered preview count as a definitive store-wide count.
- Preserve required auditability and applicable retention requirements.

## Confirmed database dependencies (read-only inspection)

- client_sales.client_id -> clients.id: ON DELETE CASCADE.
- client_monthly_must_targets.client_id -> clients.id: ON DELETE CASCADE.
- clients.member_id -> members.id: ON DELETE CASCADE.
- clients.team_id -> teams.id: ON DELETE CASCADE.
- daily_results.member_id -> members.id: ON DELETE CASCADE.
- daily_results.team_id -> teams.id: ON DELETE CASCADE.

Therefore, removing client records would also remove their client-specific monthly target rows. That conflicts with the requirement to preserve goals. Client identity and linked targets need a separate reviewed design. The current implementation deliberately does not perform any mutations.

## Acceptance criteria for the preview

1. Unauthenticated requests receive HTTP 401.
2. Inactive or non-privileged accounts receive HTTP 403.
3. Authorized requests return nonnegative integer counts with an explicit RLS-visible scope label.
4. Errors do not display stale counts.
5. No request path in the preview changes any database row.
6. Preview functionality cannot be mistaken for a store-wide authoritative count.

## Release gates

- Confirm actual product semantics of client-specific targets after identity protection.
- Review every foreign-key dependency and RLS policy.
- Validate with isolated test data and authorized test accounts.
- Run automated checks and manual role-based tests.
- Obtain explicit approval for any irreversible production action.
