# Changelog

## 1.1.2 (2026-11-08)

- Lists of numbers are read like the Corbit SMS app: the Arabic comma and semicolon (« ، » « ؛ », typed by the Arabic iPhone keyboard) and tabs (from a spreadsheet) separate numbers too, and numbers separated only by spaces are read one by one. A number copied from phone contacts with spaces, such as `+966 50 123 4567`, stays one number.

## 1.1.1 (2026-11-08)

- Phone numbers are checked more strictly, so a messy value can never turn into a different, valid-looking number. Values such as `9.66501E+11` (a number exported from a spreadsheet), `966501234567.0` or `+966 50 123 4567 ext 12` are now rejected with an error instead of being sent.
- Arabic-Indic digits (٠٥٠١٢٣٤٥٦٧) and `+966 (0)50…` are accepted.

## 1.1.0 (2026-11-08)

- Fix: a Message that comes from an expression as a number (for example an OTP code) no longer stops the node.
- Change: Get Delivery Report returns one item per recipient (with `messageId` and `jobId` on each).
- Change: local numbers of other countries that start with `0` are rejected instead of being treated as Saudi numbers. Saudi local numbers (`05XXXXXXXX`) are still converted.
- Clearer errors: they name the field ('To', 'Numbers', 'Message', 'Message ID', 'Sender Name') and add a hint for Corbit codes such as low balance, duplicate message, rate limit and idempotency key reuse. With "Continue On Fail" the hint is in a `description` field.
- Idempotency Key is checked against the 255-character limit.
- Get Many sender names stops paging once the limit is reached.
- Action names, placeholders and descriptions follow the n8n UX guidelines; descriptions are clearer for AI agents.
- README: example workflow (`examples/send-otp-and-check-delivery.json`).

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
