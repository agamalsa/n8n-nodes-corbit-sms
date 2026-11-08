# n8n-nodes-corbit-sms

This is an n8n community node for [Corbit SMS](https://sms.corbit.sa), an SMS gateway in Saudi Arabia. Use it to send SMS messages from your workflows, check whether they were delivered, and read your balance and sender names.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

- [Installation](#installation)
- [Operations](#operations)
- [Credentials](#credentials)
- [Usage](#usage)
- [Example workflow](#example-workflow)
- [Compatibility](#compatibility)
- [Resources](#resources)

## Installation

In n8n, open **Settings → Community Nodes → Install**, enter `n8n-nodes-corbit-sms` and confirm. For more details, see the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n documentation.

## Operations

| Resource | Operation | What it does |
|---|---|---|
| SMS | Send | Sends an SMS to one mobile number |
| SMS | Send Bulk | Sends the same SMS to many numbers in one request |
| SMS | Get Status | Returns the current status of a sent message |
| SMS | Get Delivery Report | Returns the delivery result for each recipient |
| Account | Get Balance | Returns the remaining SMS balance |
| Sender Name | Get Many | Lists your sender names and their approval status |

The node can also be used as a tool by the n8n AI Agent.

## Credentials

You need a Corbit SMS account and an API token.

1. Sign in at [sms.corbit.sa](https://sms.corbit.sa).
2. Open the API settings and copy your API token.
3. In n8n, create a **Corbit SMS API** credential and paste the token.

Keep **Base URL** as `https://api.corbit.sa` unless Corbit support gives you another address. n8n checks the credential by reading your balance.

## Usage

**Phone numbers.** Use the international format, for example `966501234567`. Spaces, dashes, brackets, a leading `+` or `00` are removed, and Arabic digits are accepted. Saudi local numbers (`05XXXXXXXX`) are converted to `9665XXXXXXXX`. Anything that could turn into a wrong number is rejected and nothing is sent: local numbers of other countries (starting with `0`; write them in international format), decimals such as `9.66501E+11` from a spreadsheet, and extra text such as `ext 12`.

**Sender name.** Open the list to pick one of your approved sender names (it loads when you open it), or switch to **By Name** and type the name. You can also use an expression.

**Send Bulk.** Enter the numbers separated by commas or new lines, or pass a list with an expression. Duplicates are removed. If any number is invalid, the node stops before sending, because Corbit SMS rejects the whole request.

**Message length.** Up to 1600 characters.

**Duplicate protection.** Corbit SMS blocks the same text to the same number within one hour. To send it again on purpose (for example an OTP resend), turn on **Allow Duplicate** under **Options**.

**Safe retries.** Set an **Idempotency Key** under **Options**, with a different value for each message (for example `{{ $execution.id }}-{{ $json.orderId }}`). If the request is retried with the same key, Corbit SMS returns the first result and does not send again. Don't use one fixed key for many items.

**Rate limit.** 1000 requests per minute per token. If you hit it, turn on **Retry On Fail** in the node settings.

**Output.** Send returns `messageId`, `status`, `to` and `senderName`; Send Bulk also returns `numbers` and `recipients`. Use `messageId` with Get Status or Get Delivery Report. Get Delivery Report returns one item per recipient.

**AI agents.** The node can be used as a tool by the n8n AI Agent. Set **Sender Name** to a fixed value when you use it as a tool, so the agent doesn't have to guess it.

## Example workflow

[`examples/send-otp-and-check-delivery.json`](examples/send-otp-and-check-delivery.json) sends a one-time code and checks that it was delivered. Import it in n8n with **Workflow menu → Import from File**.

1. **Webhook** (POST `/send-otp`) receives `{ "phone": "966501234567", "code": "4821" }`.
2. **Corbit SMS → Send** sends `Your verification code is 4821` to the phone. **Allow Duplicate** is on, so a resend of the same code is not blocked, and the execution ID is the idempotency key, so a retry of the same execution never sends twice.
3. **Wait** 30 seconds.
4. **Corbit SMS → Get Status** reads the delivery status of the message.

Before you run it, choose your Corbit SMS credential in both Corbit SMS nodes and replace `YourSender` with one of your approved sender names.

## Compatibility

Tested with n8n 2.46.6 on Node.js 24.

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [Corbit SMS API documentation](https://api.corbit.sa/doc)
- [Corbit support](https://corbit.zohodesk.sa/portal/en/newticket) · support@corbit.sa · 920006900
