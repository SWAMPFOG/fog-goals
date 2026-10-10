# Client identity and goal preservation — reviewed proposal

This is a design proposal only. No database migration or data modification is included.

## Verified columns

- `clients.id` is a required UUID primary key; `clients.name` is required text.
- `client_monthly_must_targets.client_id` is a required UUID foreign key to `clients.id`, with ON DELETE CASCADE.
- `client_monthly_must_targets.must_sales` is a required bigint; `target_month` is a required date.
- `client_sales.client_name` is required text; `client_sales.client_id` is nullable UUID.
- `daily_results.sales` is required bigint with default 0. Other daily counters are separate columns.

## Preservation strategy

For a separately authorized, reviewed privacy operation, retaining `clients.id` and the row while replacing personally identifying `clients.name` with a non-reversible, non-identifying placeholder would avoid the client-target FK cascade. The client-specific target remains tied to its existing client ID. This is a *proposal*, not an implemented operation.

A predictable placeholder such as a name-derived hash is not suitable; it can reveal or link identities. Any placeholder design needs a privacy review and a defined policy for historical identifiers and re-identification risk.

Sales histories also contain a separate `client_name` field. Protecting only `clients.name` is insufficient. The daily sales aggregate is a separate field from the non-sales counters.

## Important unresolved product question

Does preserving `client_monthly_must_targets.must_sales` count as preserving a goal, or does it count as retaining sensitive sales information? These requirements conflict unless clarified. The current read-only preview warns about this dependency.

## Verification checklist

- The number of client-target records is unchanged.
- Each target still references an existing client.
- Team/member IDs and organization structure are unchanged.
- All monthly/team/department/store goal records remain unchanged.
- All non-sales daily counters remain unchanged.
- No names survive in other fields, logs, exports or unrelated records within the agreed scope.
- Authorization, approval, retention, backups and auditability are independently reviewed.

No destructive endpoint or SQL is included in this document.
