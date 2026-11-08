# Changelog

## 1.0.1 (2026-11-08)

- Docs: clearer install steps (Settings → Community Nodes) and support contacts in the README.
- Release: published from GitHub Actions with npm trusted publishing (no long-lived token).

## 1.0.0 (2026-11-07)

- First release.
- SMS: Send, Send Bulk, Get Status, Get Delivery Report.
- Account: Get Balance.
- Sender Name: Get Many (with a status filter).
- Phone numbers are normalized to the international format; Saudi local numbers (05XXXXXXXX) are converted.
- Optional Idempotency-Key and Allow Duplicate for safe retries.
