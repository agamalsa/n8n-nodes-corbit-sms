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

type Context = IExecuteFunctions | ILoadOptionsFunctions;

export interface CorbitRequestExtras {
	qs?: IDataObject;
	headers?: IDataObject;
	itemIndex?: number;
}

/**
 * Turns a phone number into the digits-only international format the API expects.
 * Accepts "+966 50 123 4567", "00966501234567", "0501234567" and "501234567".
 * Returns undefined when the result is not 8–15 digits.
 */
export function normalizeNumber(raw: unknown): string | undefined {
	if (raw === null || raw === undefined) return undefined;
	let digits = String(raw).replace(/\D/g, '');
	if (digits.startsWith('00')) digits = digits.slice(2);
	if (/^05\d{8}$/.test(digits)) digits = '966' + digits.slice(1);
	else if (/^5\d{8}$/.test(digits)) digits = '966' + digits;
	return /^\d{8,15}$/.test(digits) ? digits : undefined;
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

export function checkMessage(node: INode, message: string, itemIndex: number): void {
	if (message.trim() === '') {
		throw new NodeOperationError(node, 'The message is empty', { itemIndex });
	}
	if (message.length > MAX_MESSAGE_LENGTH) {
		throw new NodeOperationError(
			node,
			`The message is ${message.length} characters; the limit is ${MAX_MESSAGE_LENGTH}`,
			{ itemIndex },
		);
	}
}

function errorFromBody(
	node: INode,
	statusCode: number,
	body: IDataObject,
	headers: IDataObject,
	itemIndex?: number,
): NodeApiError {
	const apiMessage = typeof body.message === 'string' && body.message ? body.message : '';
	const code = typeof body.code === 'string' ? body.code : '';
	let description = code ? `Error code: ${code}` : undefined;
	if (statusCode === 401) {
		description = 'The API token was rejected. Check the token in the Corbit SMS credential.';
	} else if (statusCode === 429) {
		const retryAfter = headers['retry-after'];
		description = `Too many requests. ${
			retryAfter ? `Try again in ${String(retryAfter)} seconds. ` : ''
		}You can turn on "Retry On Fail" in the node settings.`;
	} else if (code === 'DUPLICATE') {
		description =
			'The same text was sent to the same number within the last hour. Turn on "Allow Duplicate" to send it again on purpose.';
	}
	return new NodeApiError(node, body as JsonObject, {
		message: apiMessage || `Corbit SMS returned HTTP ${statusCode}`,
		description,
		httpCode: String(statusCode),
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
		throw errorFromBody(
			this.getNode(),
			statusCode >= 400 ? statusCode : 400,
			parsed,
			response.headers ?? {},
			extras.itemIndex,
		);
	}
	if (Array.isArray(data)) return { data } as IDataObject;
	return parsed;
}

/** Reads every page of sender names. */
export async function getAllSenderNames(this: Context): Promise<IDataObject[]> {
	const perPage = 50;
	const all: IDataObject[] = [];
	for (let page = 1; page <= 100; page++) {
		const response = await corbitApiRequest.call(this, 'GET', '/api/v1/sendernames', undefined, {
			qs: { per_page: perPage, page },
		});
		const items = Array.isArray(response.data) ? (response.data as IDataObject[]) : [];
		all.push(...items);
		const pagination = (response.pagination ?? {}) as IDataObject;
		const total = Number(pagination.total);
		const currentPage = Number(pagination.current_page);
		const pageSize = Number(pagination.per_page) || perPage;
		if (items.length === 0) break;
		if (Number.isFinite(total) && all.length >= total) break;
		if (!Number.isFinite(total) && items.length < pageSize) break;
		// Stop if the API ignores the page parameter, so we never loop on the same page.
		if (Number.isFinite(currentPage) && currentPage !== page) break;
	}
	return all;
}
