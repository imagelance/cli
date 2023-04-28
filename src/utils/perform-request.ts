import axios, { AxiosRequestConfig } from 'axios';
import chalk from 'chalk';

import { getAccessToken, getCommand } from './config-getters';

const pkg = require('../../package.json');

export async function performRequest(config: AxiosRequestConfig, appendAuthorization = true): Promise<any> {
	if (!config.method) {
		config.method = 'GET';
	}

	const headers: { [key: string]: string } = {
		Accept: 'application/json',
		'X-Cli': pkg.name,
		'X-Cli-Version': pkg.version,
	};

	if (appendAuthorization) {
		const accessToken = getAccessToken();

		if (!accessToken) {
			throw new Error(`Invalid user, please use "${getCommand('login')}" command first`);
		}

		headers.Authorization = accessToken;
	}

	config.headers = {
		...headers,
		...config.headers,
	};

	try {
		return await axios.create().request(config);
	} catch (error: any) {
		if (error.name === 'CancelledError') {
			return;
		}

		const { response } = error;

		if (response && response.data && response.data.type === 'ERR_CLI_VERSION_NOT_ALLOWED') {
			const { minimalCliVersion } = response.data.data;

			console.error(chalk.red(`Cannot connect to devstack. Required CLI version is ${minimalCliVersion}, installed CLI version is ${pkg.version}. Please run "${chalk.bold.underline(`${pkg.oclif.bin} update`)}" command`));
			process.exit(1);
		}

		// waterfall error
		throw error;
	}
}
