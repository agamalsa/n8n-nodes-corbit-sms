import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	INode,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

export const MAX_MESSAGE_LENGTH = 1600;
export const MAX_IDEMPOTENCY_KEY_LENGTH = 255;

type Context = IExecuteFunctions | ILoadOptionsFunctions;

export interface CorbitRequestExtras {
	qs?: IDataObject;
	headers?: IDataObject;
	itemIndex?: number;
}

/**
 * Turns a phone number into the digits-only international format the API expects.
 * Accepts "+966 50 123 4567", "00966501234567", "966501234567", and the Saudi local
 * forms "0501234567" and "501234567". Any other number that starts with a single 0
 * is a local number of an unknown country, so it is rejected rather than guessed.
 * Returns undefined when the number cannot be used.
 */
export function normalizeNumber(raw: unknown): string | undefined {
	if (raw === null || raw === undefined) return undefined;
	let digits = String(raw).replace(/\D/g, '');
	if (digits.startsWith('00')) digits = digits.slice(2);
	else if (/^05\d{8}$/.test(digits)) digits = '966' + digits.slice(1);
	else if (/^5\d{8}$/.test(digits)) digits = '966' + digits;
	else if (digits.startsWith('0')) return undefined;
	return /^[1-9]\d{7,14}$/.test(digits) ? digits : undefined;
}

/** Splits a list given as text (commas, semicolons or new lines) or as an array. */
export function splitNumbers(value: unknown): string[] {
	if (Array.isArray(value)) return value.flatMap((v) => splitNumbers(v));
	if (value === null || value === undefined) return [];
	return String(value)
		.split(/[,;\r\n]+/)
		.map((v) => v.trim())
		.filter((v) => v !== '');
}

/**
 * Checks the SMS text and returns it as a string. Expressions can return numbers
 * (for example an OTP code), so the value is converted first.
 */
export function checkMessage(node: INode, raw: unknown, itemIndex: number): string {
	const message = raw === null || raw === undefined ? '' : String(raw);
	if (message.trim() === '') {
		throw new NodeOperationError(node, "'Message' is empty", {
			itemIndex,
			description: 'Enter the text of the SMS.',
		});
	}
	if (message.length > MAX_MESSAGE_LENGTH) {
		throw new NodeOperationError(
			node,
			`'Message' is ${message.length} characters; the limit is ${MAX_MESSAGE_LENGTH}`,
			{ itemIndex },
		);
	}
	return message;
}

const CODE_HINTS: Record<string, string> = {
	INSUFFICIENT_BALANCE: 'Your Corbit SMS balance is not enough. Top up at sms.corbit.sa and run the node again.',
	SENDER_NOT_ALLOWED:
		"This sender name is not approved on your account. Pick one from the 'Sender Name' list.",
	DUPLICATE:
		"The same text was sent to the same number within the last hour. Turn on 'Allow Duplicate' to send it again on purpose.",
	IDEMPOTENCY_IN_PROGRESS:
		'A request with the same idempotency key is still being processed. Wait a moment and try again.',
	IDEMPOTENCY_KEY_REUSED:
		"This idempotency key was already used for a different message. Use a different 'Idempotency Key' for each message, for example with an expression.",
};

function errorFromBody(
	node: INode,
	statusCode: number,
	body: IDataObject,
	headers: IDataObject,
	itemIndex?: number,
): NodeApiError {
	const apiMessage = typeof body.message === 'string' && body.message ? body.message : '';
	const code = typeof body.code === 'string' ? body.code : '';
	let description = code ? CODE_HINTS[code] ?? `Corbit SMS code: ${code}` : undefined;
	if (statusCode === 401) {
		description = "The API token was rejected. Check 'API Token' in the Corbit SMS credential.";
	} else if (statusCode === 429 || code === 'RATE_LIMIT') {
		const retryAfter = headers['retry-after'];
		description = `Too many requests. ${
			retryAfter ? `Try again in ${String(retryAfter)} seconds. ` : ''
		}You can turn on 'Retry On Fail' in the node settings.`;
	}
	return new NodeApiError(node, body as JsonObject, {
		message: apiMessage || `Corbit SMS returned HTTP ${statusCode}`,
		description,
		...(statusCode >= 400 ? { httpCode: String(statusCode) } : {}),
		itemIndex,
	});
}

/**
 * Calls the Corbit SMS API with the stored credential.
 * Throws a NodeApiError with the API's own message when the call fails.
 */
export async function corbitApiRequest(
	this: Context,
	method: IHttpRequestMethods,
	path: string,
	body?: IDataObject,
	extras: CorbitRequestExtras = {},
): Promise<IDataObject> {
	const credentials = await this.getCredentials('corbitSmsApi');
	const baseUrl = String(credentials.baseUrl || 'https://api.corbit.sa').replace(/\/+$/, '');

	const options: IHttpRequestOptions = {
		method,
		url: `${baseUrl}${path}`,
		headers: { Accept: 'application/json', ...(extras.headers ?? {}) },
		json: true,
		returnFullResponse: true,
		ignoreHttpStatusErrors: true,
	};
	if (body !== undefined) options.body = body;
	if (extras.qs !== undefined) options.qs = extras.qs;

	let response: { statusCode: number; body: unknown; headers?: IDataObject };
	try {
		response = (await this.helpers.httpRequestWithAuthentication.call(
			this,
			'corbitSmsApi',
			options,
		)) as typeof response;
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: extras.itemIndex });
	}

	const statusCode = Number(response.statusCode);
	let data = response.body;
	if (typeof data === 'string') {
		try {
			data = JSON.parse(data);
		} catch {
			data = { message: data };
		}
	}
	const parsed: IDataObject =
		data && typeof data === 'object' && !Array.isArray(data) ? (data as IDataObject) : {};

	if (statusCode >= 400 || parsed.status === 'Error') {
		throw errorFromBody(this.getNode(), statusCode, parsed, response.headers ?? {}, extras.itemIndex);
	}
	if (Array.isArray(data)) return { data } as IDataObject;
	return parsed;
}

/**
 * Reads the sender names page by page. Stops after `maxItems` names when given,
 * when the last page is reached, or when the API keeps returning the same page.
 */
export async function getAllSenderNames(this: Context, maxItems?: number): Promise<IDataObject[]> {
	const perPage = 50;
	const all: IDataObject[] = [];
	let previousFirst: string | undefined;
	for (let page = 1; page <= 100; page++) {
		const response = await corbitApiRequest.call(this, 'GET', '/api/v1/sendernames', undefined, {
			qs: { per_page: perPage, page },
		});
		const items = Array.isArray(response.data) ? (response.data as IDataObject[]) : [];
		if (items.length === 0) break;
		const first = JSON.stringify(items[0]);
		if (page > 1 && first === previousFirst) break;
		previousFirst = first;
		all.push(...items);
		if (maxItems !== undefined && all.length >= maxItems) break;
		const pagination = (response.pagination ?? {}) as IDataObject;
		const total = Number(pagination.total);
		const currentPage = Number(pagination.current_page);
		const pageSize = Number(pagination.per_page) || perPage;
		if (Number.isFinite(total) && all.length >= total) break;
		if (!Number.isFinite(total) && items.length < pageSize) break;
		// Stop if the API ignores the page parameter, so we never loop on the same page.
		if (Number.isFinite(currentPage) && currentPage !== page) break;
	}
	return maxItems === undefined ? all : all.slice(0, maxItems);
}
