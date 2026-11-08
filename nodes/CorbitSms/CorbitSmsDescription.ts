import type { INodeProperties } from 'n8n-workflow';

const sendOps = ['send', 'sendBulk'];

export const nodeProperties: INodeProperties[] = [
	{
		displayName: 'Resource',
		name: 'resource',
		type: 'options',
		noDataExpression: true,
		options: [
			{ name: 'Account', value: 'account' },
			{ name: 'Sender Name', value: 'senderName' },
			{ name: 'SMS', value: 'sms' },
		],
		default: 'sms',
	},

	// ----------------------------------
	//         Operations
	// ----------------------------------
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['sms'] } },
		options: [
			{
				name: 'Get Delivery Report',
				value: 'getReport',
				action: 'Get delivery report of message',
				description: 'Get the delivery result for each recipient of a message, one item per recipient',
			},
			{
				name: 'Get Status',
				value: 'getStatus',
				action: 'Get status of message',
				description: 'Get the current status of a sent message',
			},
			{
				name: 'Send',
				value: 'send',
				action: 'Send SMS',
				description: 'Send an SMS to one mobile number',
			},
			{
				name: 'Send Bulk',
				value: 'sendBulk',
				action: 'Send SMS to many numbers',
				description: 'Send the same SMS to many mobile numbers in one request',
			},
		],
		default: 'send',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['account'] } },
		options: [
			{
				name: 'Get Balance',
				value: 'getBalance',
				action: 'Get account balance',
				description: 'Get the remaining SMS balance of the account',
			},
		],
		default: 'getBalance',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['senderName'] } },
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many sender names',
				description: 'Get the sender names on the account and their approval status',
			},
		],
		default: 'getAll',
	},

	// ----------------------------------
	//         sms: send / sendBulk
	// ----------------------------------
	{
		// A resource locator loads the list only when it is opened, after n8n has
		// attached the credential, so a newly added node never shows a loading error.
		displayName: 'Sender Name',
		name: 'senderName',
		type: 'resourceLocator',
		required: true,
		default: { mode: 'list', value: '' },
		displayOptions: { show: { resource: ['sms'], operation: sendOps } },
		description:
			'Sender name the message is sent from. It must exactly match a sender name that is approved on your Corbit SMS account.',
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				typeOptions: { searchListMethod: 'searchSenderNames', searchable: true },
			},
			{
				displayName: 'By Name',
				name: 'name',
				type: 'string',
				placeholder: 'e.g. MyBrand',
			},
		],
	},
	{
		displayName: 'To',
		name: 'to',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. 966501234567',
		displayOptions: { show: { resource: ['sms'], operation: ['send'] } },
		description:
			'Mobile number in international format, e.g. 966501234567. Saudi local numbers (05XXXXXXXX) are converted automatically; numbers from other countries must use the international format.',
	},
	{
		displayName: 'Numbers',
		name: 'numbers',
		type: 'string',
		typeOptions: { rows: 4 },
		required: true,
		default: '',
		placeholder: 'e.g. 966501234567, 966551234567',
		displayOptions: { show: { resource: ['sms'], operation: ['sendBulk'] } },
		description:
			'Comma-separated mobile numbers in international format (new lines also work). If any number is invalid, nothing is sent.',
	},
	{
		displayName: 'Message',
		name: 'message',
		type: 'string',
		typeOptions: { rows: 4 },
		required: true,
		default: '',
		displayOptions: { show: { resource: ['sms'], operation: sendOps } },
		description: 'Text of the SMS, up to 1600 characters',
		placeholder: 'e.g. Your verification code is 4821',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { resource: ['sms'], operation: sendOps } },
		options: [
			{
				displayName: 'Allow Duplicate',
				name: 'allowDuplicate',
				type: 'boolean',
				default: false,
				description:
					'Whether to send the message even if the same text went to the same number in the last hour (for example an OTP resend)',
			},
			{
				displayName: 'Idempotency Key',
				name: 'idempotencyKey',
				type: 'string',
				default: '',
				description:
					'A unique value per message (up to 255 characters), for example an expression that combines the execution ID with the ID of the item. If the same request is retried with the same key, the first result is returned and nothing is sent again. Do not use one fixed key for many items.',
			},
		],
	},

	// ----------------------------------
	//         sms: getStatus / getReport
	// ----------------------------------
	{
		displayName: 'Message ID',
		name: 'messageId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['sms'], operation: ['getStatus', 'getReport'] } },
		description: 'The message ID returned by the Send or Send Bulk operation',
	},

	// ----------------------------------
	//         senderName: getAll
	// ----------------------------------
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		displayOptions: { show: { resource: ['senderName'], operation: ['getAll'] } },
		description: 'Whether to return all results or only up to a given limit',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 50,
		displayOptions: {
			show: { resource: ['senderName'], operation: ['getAll'], returnAll: [false] },
		},
		description: 'Max number of results to return',
	},
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: ['senderName'], operation: ['getAll'] } },
		options: [
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				options: [
					{ name: 'Approved', value: 'approved' },
					{ name: 'Expired', value: 'expired' },
					{ name: 'Pending', value: 'pending' },
					{ name: 'Rejected', value: 'rejected' },
				],
				default: 'approved',
				description: 'Return only sender names with this status',
			},
		],
	},
];
