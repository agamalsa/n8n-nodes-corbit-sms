// Programmatic style: the node normalizes phone numbers, validates the message
// before any request, pages through sender names and turns the API's error
// body into clear messages — logic that the declarative routing cannot express.
import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodeListSearchResult,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import {
	checkMessage,
	corbitApiRequest,
	getAllSenderNames,
	normalizeNumber,
	splitNumbers,
} from './GenericFunctions';
import { nodeProperties } from './CorbitSmsDescription';

/** Reads the sender from a resource locator ({ mode, value }) or a plain string from older workflows. */
export function senderValue(raw: unknown): string {
	if (raw && typeof raw === 'object' && 'value' in raw) {
		return String((raw as IDataObject).value ?? '').trim();
	}
	return raw === null || raw === undefined ? '' : String(raw).trim();
}

export class CorbitSms implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Corbit SMS',
		name: 'corbitSms',
		icon: { light: 'file:../../icons/corbit.svg', dark: 'file:../../icons/corbit.dark.svg' },
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Send SMS messages and check delivery with Corbit SMS',
		defaults: {
			name: 'Corbit SMS',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'corbitSmsApi',
				required: true,
			},
		],
		properties: nodeProperties,
	};

	methods = {
		listSearch: {
			async searchSenderNames(
				this: ILoadOptionsFunctions,
				filter?: string,
			): Promise<INodeListSearchResult> {
				const wanted = (filter ?? '').trim().toLowerCase();
				const senders = await getAllSenderNames.call(this);
				const results = senders
					.filter((s) => String(s.status).toLowerCase() === 'approved')
					.map((s) => ({ name: String(s.name), value: String(s.name) }))
					.filter((s) => wanted === '' || s.name.toLowerCase().includes(wanted))
					.sort((a, b) => a.name.localeCompare(b.name));
				return { results };
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const node = this.getNode();

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;

				if (resource === 'sms' && (operation === 'send' || operation === 'sendBulk')) {
					const senderName = senderValue(this.getNodeParameter('senderName', i));
					const message = this.getNodeParameter('message', i) as string;
					const options = this.getNodeParameter('options', i, {}) as IDataObject;
					if (senderName === '') {
						throw new NodeOperationError(node, 'Choose a sender name', { itemIndex: i });
					}
					checkMessage(node, message, i);

					const headers: IDataObject = { 'Content-Type': 'application/json' };
					if (options.idempotencyKey) headers['Idempotency-Key'] = String(options.idempotencyKey);
					if (options.allowDuplicate === true) headers['X-Allow-Duplicate'] = 'true';

					if (operation === 'send') {
						const raw = this.getNodeParameter('to', i) as string;
						const number = normalizeNumber(raw);
						if (!number) {
							throw new NodeOperationError(
								node,
								`"${raw}" is not a valid mobile number (use the international format, e.g. 9665XXXXXXXX)`,
								{ itemIndex: i },
							);
						}
						const response = await corbitApiRequest.call(
							this,
							'POST',
							'/api/v1/send',
							{ senderName, number, messageBody: message, sendAtOption: 'NOW' },
							{ headers, itemIndex: i },
						);
						const sent = ((response.data as IDataObject)?.message ?? {}) as IDataObject;
						returnData.push({
							json: { messageId: sent.id, status: sent.status, to: number, senderName },
							pairedItem: { item: i },
						});
					} else {
						const raw = splitNumbers(this.getNodeParameter('numbers', i));
						const invalid = raw.filter((n) => !normalizeNumber(n));
						if (invalid.length > 0) {
							throw new NodeOperationError(
								node,
								`Invalid mobile number(s): ${invalid.slice(0, 5).join(', ')}${
									invalid.length > 5 ? ` and ${invalid.length - 5} more` : ''
								}`,
								{
									itemIndex: i,
									description:
										'Corbit SMS rejects the whole request if any number is invalid, so nothing was sent.',
								},
							);
						}
						const numbers = [...new Set(raw.map((n) => normalizeNumber(n) as string))];
						if (numbers.length === 0) {
							throw new NodeOperationError(node, 'Add at least one mobile number', {
								itemIndex: i,
							});
						}
						const response = await corbitApiRequest.call(
							this,
							'POST',
							'/api/v1/send-bulk',
							{ senderName, numbers, messageBody: message, sendAtOption: 'Now' },
							{ headers, itemIndex: i },
						);
						const sent = ((response.data as IDataObject)?.message ?? {}) as IDataObject;
						returnData.push({
							json: {
								messageId: sent.id,
								status: sent.status,
								recipients: numbers.length,
								numbers,
								senderName,
							},
							pairedItem: { item: i },
						});
					}
				} else if (resource === 'sms' && (operation === 'getStatus' || operation === 'getReport')) {
					const messageId = String(this.getNodeParameter('messageId', i)).trim();
					if (messageId === '') {
						throw new NodeOperationError(node, 'Enter the message ID', { itemIndex: i });
					}
					const path =
						operation === 'getStatus' ? '/api/v1/message-status/' : '/api/v1/message-report/';
					const response = await corbitApiRequest.call(
						this,
						'POST',
						path + encodeURIComponent(messageId),
						undefined,
						{ itemIndex: i },
					);
					if (operation === 'getStatus') {
						const data = (response.data ?? {}) as IDataObject;
						returnData.push({
							json: { messageId, status: data.status },
							pairedItem: { item: i },
						});
					} else {
						returnData.push({ json: { messageId, ...response }, pairedItem: { item: i } });
					}
				} else if (resource === 'account' && operation === 'getBalance') {
					const response = await corbitApiRequest.call(
						this,
						'POST',
						'/api/v1/get-balance',
						undefined,
						{
							itemIndex: i,
						},
					);
					const data = (response.data ?? {}) as IDataObject;
					returnData.push({ json: { balance: data.balance }, pairedItem: { item: i } });
				} else if (resource === 'senderName' && operation === 'getAll') {
					const returnAll = this.getNodeParameter('returnAll', i) as boolean;
					const filters = this.getNodeParameter('filters', i, {}) as IDataObject;
					let senders = await getAllSenderNames.call(this);
					if (filters.status) {
						const wanted = String(filters.status).toLowerCase();
						senders = senders.filter((s) => String(s.status).toLowerCase() === wanted);
					}
					if (!returnAll) {
						const limit = this.getNodeParameter('limit', i) as number;
						senders = senders.slice(0, limit);
					}
					returnData.push(...senders.map((s) => ({ json: s, pairedItem: { item: i } })));
				} else {
					throw new NodeOperationError(
						node,
						`The operation "${operation}" is not supported for "${resource}"`,
						{ itemIndex: i },
					);
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				// Both constructors hand back an error that is already of their type.
				if (error instanceof NodeApiError) {
					throw new NodeApiError(node, error as unknown as JsonObject, { itemIndex: i });
				}
				throw new NodeOperationError(node, error as Error, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
