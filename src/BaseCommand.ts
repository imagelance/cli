// @ts-ignore
import inquirerSearchList from 'inquirer-search-list';
import inquirer from 'inquirer';
import axios, { AxiosRequestConfig, CancelToken } from 'axios';
import { Command } from '@oclif/core';
import { CancelTokens } from './types/baseCommand';
import { getAccessToken } from './utils/configGetters';
import * as Sentry from '@sentry/node';

export default abstract class BaseCommand extends Command {
	cancelTokens: CancelTokens = {};

	// region Hooks

	async init(): Promise<void> {
		// Bind exit handler

		process.on('exit', this.exitHandler.bind(this));
		process.on('SIGINT', this.exitHandler.bind(this));
		process.on('SIGUSR1', this.exitHandler.bind(this));
		process.on('SIGUSR2', this.exitHandler.bind(this));
		process.on('SIGTERM', this.exitHandler.bind(this));

		// Init sentry

		Sentry.init({
			dsn: 'https://02902c9ddb584992a780788c71ba5cd7@o562268.ingest.sentry.io/6384635',
			release: `ddm-cli@${this.config.pjson.version}`,
			// @ts-ignore
			tags: { version: this.config.pjson.version },
			environment: process.env.NODE_ENV,
			config: {
				captureUnhandledRejections: true
			},
		});

		// register custom prompts for inquirer
		inquirer.registerPrompt('search-list', inquirerSearchList);
	}

	async catch(error: any): Promise<void> {
		Sentry.captureException(error);
		super.catch(error);
	}

	async finally(): Promise<void> {
		Sentry.close();
	}

	// endregion

	// region Custom hooks

	async exitHandler(code: number = 0): Promise<void> {
		// implement custom exit handling
		process.exit(code);
	}

	// endregion

	// region Helpers

	reportError(error: any) {
		if (error.response && error.response.data) {
			console.error(error.response.data);
		} else {
			console.error(error);
		}
	}

	getCancelToken(name: string): CancelToken {
		if (this.cancelTokens[name]) {
			this.cancelTokens[name].cancel();
		}

		this.cancelTokens[name] = axios.CancelToken.source();

		return this.cancelTokens[name].token;
	}

	async performRequest(config: AxiosRequestConfig, appendAuthorization: boolean = true): Promise<any> {
		const headers: any = {
			Accept: 'application/json',
		};

		if (appendAuthorization) {
			const accessToken = getAccessToken();

			if (!accessToken) {
				throw new Error(`User not logged in, please use the "${this.config.bin} login" command first`);
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

	// endregion
};
