import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class CorbitSmsApi implements ICredentialType {
	name = 'corbitSmsApi';

	displayName = 'Corbit SMS API';

	icon: Icon = { light: 'file:../icons/corbit.svg', dark: 'file:../icons/corbit.dark.svg' };

	documentationUrl = 'https://api.corbit.sa/doc';

	properties: INodeProperties[] = [
		{
			displayName: 'API Token',
			name: 'apiToken',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			description:
				'The API token from your Corbit SMS account at sms.corbit.sa',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.corbit.sa',
			description: 'Leave as it is unless Corbit support gives you another address',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiToken}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl.replace(/\\/+$/, "")}}',
			url: '/api/v1/get-balance',
			method: 'POST',
			headers: {
				Accept: 'application/json',
			},
		},
	};
}
