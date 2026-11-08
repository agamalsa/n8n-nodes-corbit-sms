# n8n-nodes-corbit-sms

This is an n8n community node for [Corbit SMS](https://sms.corbit.sa), an SMS gateway in Saudi Arabia. Use it to send SMS messages from your workflows, check whether they were delivered, and read your balance and sender names.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

- [Installation](#installation)
- [Operations](#operations)
- [Credentials](#credentials)
- [Usage](#usage)
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

**Phone numbers.** Use the international format, for example `9665XXXXXXXX`. Spaces, dashes, a leading `+` or `00` are removed. Saudi local numbers such as `05XXXXXXXX` are converted to `9665XXXXXXXX`.

**Sender name.** Only approved sender names appear in the list. You can also enter one with an expression.

**Send Bulk.** Enter the numbers separated by commas or new lines, or pass an array with an expression. Duplicates are removed. If any number is invalid, the node stops before sending, because Corbit SMS rejects the whole request.

**Message length.** Up to 1600 characters.

**Duplicate protection.** Corbit SMS blocks the same text to the same number within one hour. To send it again on purpose (for example an OTP resend), turn on **Allow Duplicate** under **Options**.

**Safe retries.** Set an **Idempotency Key** under **Options** (for example `{{ $execution.id }}-{{ $json.orderId }}`). If the request is retried with the same key, Corbit SMS returns the first result and does not send again.

**Rate limit.** 1000 requests per minute per token. If you hit it, turn on **Retry On Fail** in the node settings.

**Output.** Send returns `messageId`, `status`, `to` and `senderName`. Use `messageId` with Get Status or Get Delivery Report.

## Compatibility

Tested with n8n 2.46.6 on Node.js 24.

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [Corbit SMS API documentation](https://api.corbit.sa/doc)
- [Corbit support](https://corbit.zohodesk.sa/portal/en/newticket) · support@corbit.sa · 920006900
