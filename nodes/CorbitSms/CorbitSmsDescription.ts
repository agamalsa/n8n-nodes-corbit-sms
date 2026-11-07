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
				action: 'Get the delivery report of a message',
				description: 'Get the delivery result for each recipient of a message',
			},
			{
				name: 'Get Status',
				value: 'getStatus',
				action: 'Get the status of a message',
				description: 'Get the current status of a sent message',
			},
			{
				name: 'Send',
				value: 'send',
				action: 'Send an SMS',
				description: 'Send an SMS to one mobile number',
			},
			{
				name: 'Send Bulk',
				value: 'sendBulk',
				action: 'Send an SMS to many numbers',
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
				action: 'Get the account balance',
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
		displayName: 'Sender Name or ID',
		name: 'senderName',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getSenderNames' },
		required: true,
		default: '',
		displayOptions: { show: { resource: ['sms'], operation: sendOps } },
		description:
			'Approved sender name the message is sent from. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	},
	{
		displayName: 'To',
		name: 'to',
		type: 'string',
		required: true,
		default: '',
		placeholder: '9665XXXXXXXX',
		displayOptions: { show: { resource: ['sms'], operation: ['send'] } },
		description:
			'Mobile number in international format. Saudi local numbers such as 05XXXXXXXX are converted automatically.',
	},
	{
		displayName: 'Numbers',
		name: 'numbers',
		type: 'string',
		typeOptions: { rows: 4 },
		required: true,
		default: '',
		placeholder: '9665XXXXXXXX, 9665YYYYYYYY',
		displayOptions: { show: { resource: ['sms'], operation: ['sendBulk'] } },
		description:
			'Mobile numbers separated by commas or new lines, or an array from an expression. If any number is invalid nothing is sent.',
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
					'A unique value (up to 255 characters). If the request is retried with the same key, the first result is returned and nothing is sent again.',
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
