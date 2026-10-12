# Search text retention (module 19, KN-29)

Status: decision recorded by the CONTENT agent, 2026-10-12, agreed with ACCOUNTS (owner of analytics).

## What the site stores

Each search writes one `search_query` row to `analytics_events` with props:

| Prop | Meaning |
|---|---|
| `query` | The search text, lower-cased with whitespace collapsed, **or null** |
| `queryLength` | Length of the trimmed text in characters (always recorded) |
| `resultCount` | Number of results returned |

`query` is null when the text is longer than 64 characters, or contains an email address, a URL, or a run of six or more digits (a phone, ID or roll number). The rule lives in `src/lib/search-query-log.ts` and is unit-tested. The row also carries the user id when signed in and the anonymous visit id, as every analytics event does.

## Why

People paste their own name, email address or phone number into search boxes. The only legitimate uses of the text are to see which topics return nothing and which terms matter; both survive the rule above. The raw string that a visitor typed is never stored when it looks like personal data.

## Retention

- Intended retention for `search_query` rows: 90 days, then delete. Counts by day should be kept as aggregates before deletion if a longer trend is wanted.
- No purge job exists yet. `analytics_events` has no scheduled cleanup at all today, so this is an operations decision to action with the rest of the log (approver: the privacy owner, HD-06). Until then the table grows and the privacy notice must not promise a period it does not yet enforce.
- The query text is not shown outside the staff analytics area and is not used to personalise anything.
