import axios, { AxiosRequestConfig, AxiosRequestHeaders } from 'axios';

import { getAccessToken } from './config-getters';

export async function performRequest(config: AxiosRequestConfig, appendAuthorization = true): Promise<any> {
	const headers: AxiosRequestHeaders = {
		Accept: 'application/json',
	};

	if (appendAuthorization) {
		const accessToken = getAccessToken();

		if (!accessToken) {
			throw new Error(`User not logged in, please use the login command first`);
		}

		headers.Authorization = accessToken;
	}

	config.headers = {
		...headers,
		...config.headers,
	};

	try {
		return await axios.request(config);
	} catch (error: any) {
		if (error.name === 'CancelledError') {
			return;
		}

		// waterfall error
		throw error;
	}
}
