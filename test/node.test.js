// Unit tests for the compiled node (run `npm run build` first, then `npm test`).
// A fake n8n context records every HTTP call; no real request is made.
const test = require('node:test');
const assert = require('node:assert/strict');
const { CorbitSms } = require('../dist/nodes/CorbitSms/CorbitSms.node.js');
const { CorbitSmsApi } = require('../dist/credentials/CorbitSmsApi.credentials.js');
const G = require('../dist/nodes/CorbitSms/GenericFunctions.js');

function ctx({ params = [{}], responses = [], continueOnFail = false, baseUrl } = {}) {
	const calls = [];
	const queue = [...responses];
	const c = {
		calls,
		getInputData: () => params.map(() => ({ json: {} })),
		getNodeParameter: (name, i, fallback) => {
			const p = params[i] ?? {};
			if (name in p) return p[name];
			if (fallback !== undefined) return fallback;
			throw new Error(`missing parameter ${name}`);
		},
		getNode: () => ({ name: 'Corbit SMS', type: 'n8n-nodes-corbit-sms.corbitSms', typeVersion: 1, parameters: {} }),
		getCredentials: async () => ({ apiToken: 'TEST', baseUrl: baseUrl ?? 'https://api.corbit.sa/' }),
		continueOnFail: () => continueOnFail,
		helpers: {
			httpRequestWithAuthentication: async (cred, options) => {
				calls.push({ cred, ...options });
				const next = queue.shift();
				if (next instanceof Error) throw next;
				return next ?? { statusCode: 200, body: { status: 'Success', data: {} }, headers: {} };
			},
		},
	};
	return c;
}
const ok = (body, headers = {}) => ({ statusCode: 200, body, headers });
const fail = (statusCode, body, headers = {}) => ({ statusCode, body, headers });
const run = (c) => new CorbitSms().execute.call(c);

// ---------- helpers ----------
test('normalizeNumber handles international, 00, Saudi local and junk', () => {
	assert.equal(G.normalizeNumber('+966 50 123 4567'), '966501234567');
	assert.equal(G.normalizeNumber('00966501234567'), '966501234567');
	assert.equal(G.normalizeNumber('0501234567'), '966501234567');
	assert.equal(G.normalizeNumber('501234567'), '966501234567');
	assert.equal(G.normalizeNumber('201001234567'), '201001234567');
	assert.equal(G.normalizeNumber(966501234567), '966501234567');
	assert.equal(G.normalizeNumber('12'), undefined);
	assert.equal(G.normalizeNumber('1234567890123456'), undefined);
	assert.equal(G.normalizeNumber(''), undefined);
	assert.equal(G.normalizeNumber(null), undefined);
	assert.equal(G.normalizeNumber(undefined), undefined);
});

test('splitNumbers accepts text with any separator and nested arrays', () => {
	assert.deepEqual(G.splitNumbers('1, 2;3\n4\r\n+966 55 000 0000'), ['1', '2', '3', '4', '+966 55 000 0000']);
	assert.deepEqual(G.splitNumbers(['1', ['2, 3']]), ['1', '2', '3']);
	assert.deepEqual(G.splitNumbers(null), []);
	assert.deepEqual(G.splitNumbers(''), []);
});

// ---------- credential ----------
test('credential sends a Bearer token and tests with get-balance', () => {
	const cred = new CorbitSmsApi();
	assert.equal(cred.name, 'corbitSmsApi');
	assert.equal(cred.authenticate.properties.headers.Authorization, '=Bearer {{$credentials.apiToken}}');
	assert.equal(cred.test.request.url, '/api/v1/get-balance');
	assert.equal(cred.test.request.method, 'POST');
	const token = cred.properties.find((p) => p.name === 'apiToken');
	assert.equal(token.typeOptions.password, true);
});

// ---------- description ----------
test('node description is valid for n8n', () => {
	const d = new CorbitSms().description;
	assert.equal(d.name, 'corbitSms');
	assert.equal(d.usableAsTool, true);
	assert.equal(d.credentials[0].name, 'corbitSmsApi');
	const ops = d.properties.filter((p) => p.name === 'operation').flatMap((p) => p.options.map((o) => o.value));
	assert.deepEqual(ops.sort(), ['getAll', 'getBalance', 'getReport', 'getStatus', 'send', 'sendBulk']);
});

// ---------- send ----------
test('send: posts the right body and returns the message ID', async () => {
	const c = ctx({
		params: [{ resource: 'sms', operation: 'send', senderName: 'Mobile.SA', to: '0501234567', message: 'Hello', options: {} }],
		responses: [ok({ status: 'Success', message: null, data: { message: { id: 'abc', status: 'pending' } } })],
	});
	const [out] = await run(c);
	assert.deepEqual(out[0].json, { messageId: 'abc', status: 'pending', to: '966501234567', senderName: 'Mobile.SA' });
	assert.deepEqual(out[0].pairedItem, { item: 0 });
	const call = c.calls[0];
	assert.equal(call.cred, 'corbitSmsApi');
	assert.equal(call.method, 'POST');
	assert.equal(call.url, 'https://api.corbit.sa/api/v1/send');
	assert.deepEqual(call.body, { senderName: 'Mobile.SA', number: '966501234567', messageBody: 'Hello', sendAtOption: 'NOW' });
	assert.equal(call.headers['Idempotency-Key'], undefined);
	assert.equal(call.headers['X-Allow-Duplicate'], undefined);
	assert.equal(call.ignoreHttpStatusErrors, true);
});

test('send: passes Idempotency-Key and X-Allow-Duplicate', async () => {
	const c = ctx({
		params: [{ resource: 'sms', operation: 'send', senderName: 'S', to: '966501234567', message: 'Hi', options: { idempotencyKey: 'k-1', allowDuplicate: true } }],
		responses: [ok({ status: 'Success', data: { message: { id: 'x', status: 'pending' } } })],
	});
	await run(c);
	assert.equal(c.calls[0].headers['Idempotency-Key'], 'k-1');
	assert.equal(c.calls[0].headers['X-Allow-Duplicate'], 'true');
});

test('send: custom base URL is used without a double slash', async () => {
	const c = ctx({
		baseUrl: 'http://127.0.0.1:8413///',
		params: [{ resource: 'account', operation: 'getBalance' }],
		responses: [ok({ status: 'Success', data: { balance: 5 } })],
	});
	await run(c);
	assert.equal(c.calls[0].url, 'http://127.0.0.1:8413/api/v1/get-balance');
});

test('send: invalid number, empty or too long message and empty sender fail before any request', async () => {
	const base = { resource: 'sms', operation: 'send', senderName: 'S', to: '966501234567', message: 'Hi', options: {} };
	for (const [patch, re] of [
		[{ to: '12' }, /not a valid mobile number/],
		[{ message: '   ' }, /message is empty/],
		[{ message: 'x'.repeat(1601) }, /1601 characters; the limit is 1600/],
		[{ senderName: ' ' }, /Choose a sender name/],
	]) {
		const c = ctx({ params: [{ ...base, ...patch }] });
		await assert.rejects(run(c), re);
		assert.equal(c.calls.length, 0);
	}
	const c = ctx({ params: [{ ...base, message: 'x'.repeat(1600) }], responses: [ok({ status: 'Success', data: { message: { id: '1' } } })] });
	await run(c);
	assert.equal(c.calls.length, 1);
});

test('send: API error message, code and HTTP status reach the user', async () => {
	const c = ctx({
		params: [{ resource: 'sms', operation: 'send', senderName: 'S', to: '966501234567', message: 'Hi', options: {} }],
		responses: [fail(402, { status: 'Error', message: 'Insufficient balance (0). Please top up to continue sending.', code: 'INSUFFICIENT_BALANCE' })],
	});
	await assert.rejects(run(c), (e) => {
		assert.equal(e.name, 'NodeApiError');
		assert.match(e.message, /Insufficient balance/);
		assert.equal(e.httpCode, '402');
		assert.match(e.description, /INSUFFICIENT_BALANCE/);
		return true;
	});
});

test('send: 401, 429 and DUPLICATE get helpful descriptions', async () => {
	const params = [{ resource: 'sms', operation: 'send', senderName: 'S', to: '966501234567', message: 'Hi', options: {} }];
	await assert.rejects(run(ctx({ params, responses: [fail(401, { status: 'Error', message: 'Unauthenticated.' })] })), (e) => /API token was rejected/.test(e.description));
	await assert.rejects(
		run(ctx({ params, responses: [fail(429, { status: 'Error', message: 'Rate limit exceeded', code: 'RATE_LIMIT' }, { 'retry-after': '30' })] })),
		(e) => /Try again in 30 seconds/.test(e.description) && e.httpCode === '429',
	);
	await assert.rejects(run(ctx({ params, responses: [fail(429, { status: 'Error', message: 'x' })] })), (e) => /Too many requests\. You can/.test(e.description));
	await assert.rejects(
		run(ctx({ params, responses: [fail(409, { status: 'Error', message: 'Duplicate request blocked', code: 'DUPLICATE' })] })),
		(e) => /Allow Duplicate/.test(e.description),
	);
});

test('send: status Error inside HTTP 200, text bodies and empty bodies are errors', async () => {
	const params = [{ resource: 'sms', operation: 'send', senderName: 'S', to: '966501234567', message: 'Hi', options: {} }];
	await assert.rejects(run(ctx({ params, responses: [ok({ status: 'Error', message: 'Sender not approved' })] })), /Sender not approved/);
	await assert.rejects(run(ctx({ params, responses: [fail(503, 'Service Unavailable')] })), /Service Unavailable/);
	await assert.rejects(run(ctx({ params, responses: [fail(500, '{"status":"Error","message":"boom"}')] })), /boom/);
	await assert.rejects(run(ctx({ params, responses: [fail(502, null)] })), /HTTP 502/);
});

test('send: network failure becomes a NodeApiError', async () => {
	const params = [{ resource: 'sms', operation: 'send', senderName: 'S', to: '966501234567', message: 'Hi', options: {} }];
	await assert.rejects(run(ctx({ params, responses: [new Error('getaddrinfo ENOTFOUND api.corbit.sa')] })), (e) => e.name === 'NodeApiError');
});

test('continueOnFail returns the error per item and keeps going', async () => {
	const c = ctx({
		continueOnFail: true,
		params: [
			{ resource: 'sms', operation: 'send', senderName: 'S', to: 'bad', message: 'Hi', options: {} },
			{ resource: 'sms', operation: 'send', senderName: 'S', to: '966501234567', message: 'Hi', options: {} },
		],
		responses: [ok({ status: 'Success', data: { message: { id: 'm2', status: 'pending' } } })],
	});
	const [out] = await run(c);
	assert.equal(out.length, 2);
	assert.match(out[0].json.error, /not a valid mobile number/);
	assert.deepEqual(out[0].pairedItem, { item: 0 });
	assert.equal(out[1].json.messageId, 'm2');
	assert.deepEqual(out[1].pairedItem, { item: 1 });
});

// ---------- send bulk ----------
test('sendBulk: normalizes, removes duplicates and uses sendAtOption Now', async () => {
	const c = ctx({
		params: [{ resource: 'sms', operation: 'sendBulk', senderName: 'S', numbers: '0501234567, 966501234567\n+966 55 000 0000', message: 'Bulk', options: {} }],
		responses: [ok({ status: 'Success', data: { message: { id: 'b1', status: 'pending' } } })],
	});
	const [out] = await run(c);
	assert.deepEqual(c.calls[0].body, { senderName: 'S', numbers: ['966501234567', '966550000000'], messageBody: 'Bulk', sendAtOption: 'Now' });
	assert.equal(c.calls[0].url, 'https://api.corbit.sa/api/v1/send-bulk');
	assert.deepEqual(out[0].json, { messageId: 'b1', status: 'pending', recipients: 2, numbers: ['966501234567', '966550000000'], senderName: 'S' });
});

test('sendBulk: accepts an array from an expression', async () => {
	const c = ctx({
		params: [{ resource: 'sms', operation: 'sendBulk', senderName: 'S', numbers: ['966501234567', '966550000000'], message: 'B', options: {} }],
		responses: [ok({ status: 'Success', data: { message: { id: 'b' } } })],
	});
	await run(c);
	assert.deepEqual(c.calls[0].body.numbers, ['966501234567', '966550000000']);
});

test('sendBulk: any invalid number stops the whole send, empty list too', async () => {
	const base = { resource: 'sms', operation: 'sendBulk', senderName: 'S', message: 'B', options: {} };
	let c = ctx({ params: [{ ...base, numbers: '966501234567, 12, abc' }] });
	await assert.rejects(run(c), (e) => /Invalid mobile number\(s\): 12, abc$/.test(e.message) && /nothing was sent/.test(e.description));
	assert.equal(c.calls.length, 0);
	c = ctx({ params: [{ ...base, numbers: '1,2,3,4,5,6,7' }] });
	await assert.rejects(run(c), /1, 2, 3, 4, 5 and 2 more/);
	c = ctx({ params: [{ ...base, numbers: ' , ' }] });
	await assert.rejects(run(c), /at least one mobile number/);
});

// ---------- status / report ----------
test('getStatus and getReport call the right paths', async () => {
	let c = ctx({
		params: [{ resource: 'sms', operation: 'getStatus', messageId: ' id/1 ' }],
		responses: [ok({ status: 'Success', message: null, data: { status: 'delivered' } })],
	});
	let [out] = await run(c);
	assert.equal(c.calls[0].url, 'https://api.corbit.sa/api/v1/message-status/id%2F1');
	assert.equal(c.calls[0].method, 'POST');
	assert.equal(c.calls[0].body, undefined);
	assert.deepEqual(out[0].json, { messageId: 'id/1', status: 'delivered' });

	const report = { jobId: 'moe-1', msgs: [{ destAddress: '966501234567', status: 'delivered', accepted: true }] };
	c = ctx({ params: [{ resource: 'sms', operation: 'getReport', messageId: 'm1' }], responses: [ok(report)] });
	[out] = await run(c);
	assert.equal(c.calls[0].url, 'https://api.corbit.sa/api/v1/message-report/m1');
	assert.deepEqual(out[0].json, { messageId: 'm1', ...report });

	c = ctx({ params: [{ resource: 'sms', operation: 'getStatus', messageId: '' }] });
	await assert.rejects(run(c), /Enter the message ID/);
	assert.equal(c.calls.length, 0);
});

test('getStatus: unknown message gives the API message', async () => {
	const c = ctx({
		params: [{ resource: 'sms', operation: 'getStatus', messageId: 'nope' }],
		responses: [fail(404, { status: 'Error', message: 'Message not found.', code: 'NOT_FOUND' })],
	});
	await assert.rejects(run(c), /Message not found/);
});

// ---------- account ----------
test('getBalance returns the balance', async () => {
	const c = ctx({ params: [{ resource: 'account', operation: 'getBalance' }], responses: [ok({ status: 'Success', message: null, data: { balance: 183 } })] });
	const [out] = await run(c);
	assert.deepEqual(out[0].json, { balance: 183 });
	assert.equal(c.calls[0].method, 'POST');
});

// ---------- sender names ----------
const page = (data, total, current, per = 50) => ok({ status: 'Success', data, pagination: { total, per_page: per, current_page: current } });
const senders = (n, from = 0) => Array.from({ length: n }, (_, k) => ({ name: `S${from + k}`, status: (from + k) % 3 === 0 ? 'approved' : 'rejected' }));

test('sender names: reads every page until total', async () => {
	const c = ctx({ params: [{ resource: 'senderName', operation: 'getAll', returnAll: true, filters: {} }], responses: [page(senders(50), 70, 1), page(senders(20, 50), 70, 2)] });
	const [out] = await run(c);
	assert.equal(out.length, 70);
	assert.deepEqual(c.calls.map((x) => x.qs), [{ per_page: 50, page: 1 }, { per_page: 50, page: 2 }]);
	assert.equal(c.calls[0].method, 'GET');
});

test('sender names: stops when the API ignores page, on empty pages and with no pagination', async () => {
	let c = ctx({ params: [{ resource: 'senderName', operation: 'getAll', returnAll: true, filters: {} }], responses: [page(senders(50), 999, 1), page(senders(50), 999, 1)] });
	let [out] = await run(c);
	assert.equal(c.calls.length, 2);
	assert.equal(out.length, 100);

	c = ctx({ params: [{ resource: 'senderName', operation: 'getAll', returnAll: true, filters: {} }], responses: [page([], 0, 1)] });
	[out] = await run(c);
	assert.equal(out.length, 0);

	c = ctx({ params: [{ resource: 'senderName', operation: 'getAll', returnAll: true, filters: {} }], responses: [ok({ status: 'Success', data: senders(3) })] });
	[out] = await run(c);
	assert.equal(c.calls.length, 1);
	assert.equal(out.length, 3);

	c = ctx({ params: [{ resource: 'senderName', operation: 'getAll', returnAll: true, filters: {} }], responses: [ok([{ name: 'A', status: 'approved' }])] });
	[out] = await run(c);
	assert.deepEqual(out[0].json, { name: 'A', status: 'approved' });
});

test('sender names: status filter and limit', async () => {
	let c = ctx({ params: [{ resource: 'senderName', operation: 'getAll', returnAll: true, filters: { status: 'approved' } }], responses: [page(senders(9), 9, 1)] });
	let [out] = await run(c);
	assert.deepEqual(out.map((o) => o.json.name), ['S0', 'S3', 'S6']);
	c = ctx({ params: [{ resource: 'senderName', operation: 'getAll', returnAll: false, limit: 2, filters: {} }], responses: [page(senders(9), 9, 1)] });
	[out] = await run(c);
	assert.equal(out.length, 2);
});

test('sender list (resource locator) shows approved names only, sorted, and filters by search', async () => {
	const list = [{ name: 'Zeta', status: 'approved' }, { name: 'Beta', status: 'rejected' }, { name: 'Alpha', status: 'Approved' }, { name: 'Old', status: 'expired' }];
	let c = ctx({ responses: [page(list, 4, 1)] });
	let res = await new CorbitSms().methods.listSearch.searchSenderNames.call(c);
	assert.deepEqual(res, { results: [{ name: 'Alpha', value: 'Alpha' }, { name: 'Zeta', value: 'Zeta' }] });
	c = ctx({ responses: [page(list, 4, 1)] });
	res = await new CorbitSms().methods.listSearch.searchSenderNames.call(c, ' ze ');
	assert.deepEqual(res, { results: [{ name: 'Zeta', value: 'Zeta' }] });
});

test('sender field is a resource locator with list and by-name modes', () => {
	const p = new CorbitSms().description.properties.find((x) => x.name === 'senderName');
	assert.equal(p.type, 'resourceLocator');
	assert.deepEqual(p.modes.map((m) => m.name), ['list', 'name']);
	assert.equal(p.modes[0].typeOptions.searchListMethod, 'searchSenderNames');
	assert.deepEqual(p.default, { mode: 'list', value: '' });
});

test('send accepts the sender as a resource locator value, and old plain strings', async () => {
	for (const sender of [{ __rl: true, mode: 'list', value: 'OT.SA' }, { __rl: true, mode: 'name', value: '  OT.SA ' }, 'OT.SA']) {
		const c = ctx({
			params: [{ resource: 'sms', operation: 'send', senderName: sender, to: '966501234567', message: 'Hi', options: {} }],
			responses: [ok({ status: 'Success', data: { message: { id: 'm', status: 'pending' } } })],
		});
		await run(c);
		assert.equal(c.calls[0].body.senderName, 'OT.SA');
	}
	const c = ctx({ params: [{ resource: 'sms', operation: 'send', senderName: { __rl: true, mode: 'list', value: '' }, to: '966501234567', message: 'Hi', options: {} }] });
	await assert.rejects(run(c), /Choose a sender name/);
	assert.equal(c.calls.length, 0);
	const n = ctx({ params: [{ resource: 'sms', operation: 'send', senderName: null, to: '966501234567', message: 'Hi', options: {} }] });
	await assert.rejects(run(n), /Choose a sender name/);
});

test('unknown operation is reported', async () => {
	await assert.rejects(run(ctx({ params: [{ resource: 'sms', operation: 'nope' }] })), /not supported/);
});
