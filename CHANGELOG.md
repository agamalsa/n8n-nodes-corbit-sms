# Changelog

## 1.0.2 (2026-11-08)

- Fix: the Sender Name list no longer shows "Error fetching options" when a Send node is first added. It is now a list that loads when opened, with a **By Name** option to type the sender.
- Existing workflows that saved the sender as plain text keep working.

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
