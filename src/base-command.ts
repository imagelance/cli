import { Command, Flags } from '@oclif/core';
import * as Sentry from '@sentry/node';
import axios, { AxiosRequestConfig, CancelToken } from 'axios';
import chalk from 'chalk';
import * as inquirer from 'inquirer';
import dns from 'node:dns';
// @ts-ignore
import inquirerSearchList from 'inquirer-search-list';

import { CancelTokens } from './types/base-command';
import { isInstalled } from './utils/config-getters';
import devstackUrl from './utils/devstack-url';
import { performInstall } from './utils/perform-install';
import { performRequest } from './utils/perform-request';
import { reportError } from './utils/report-error';

export default abstract class BaseCommand extends Command {
	static baseFlags = {
		debug: Flags.boolean({ char: 'd', default: false, description: 'Debug mode', required: false }),
		local: Flags.boolean({
			char: 'a',
			default: false,
			description: 'Against local apis',
			hidden: true,
			required: false,
		}),
	};

	cancelTokens: CancelTokens = {};

	// region Hooks

	async catch(error: any): Promise<void> {
		Sentry.captureException(error);
		super.catch(error);
	}

	exitHandler(code = 0): void {
		// implement custom exit handling
		process.exit(code);
	}

	async finally(): Promise<void> {
		Sentry.close();
	}

	// endregion

	// region Custom hooks

	getCancelToken(name: string): CancelToken {
		if (this.cancelTokens[name]) {
			this.cancelTokens[name].cancel();
		}

		this.cancelTokens[name] = axios.CancelToken.source();

		return this.cancelTokens[name].token;
	}

	// endregion

	// region Helpers

	async init(): Promise<void> {
		const { flags } = await this.parse(BaseCommand);
		const { debug } = flags;

		// Validate whether computer is online
		await this.isOnline();
		// Validate whether install command was called
		await this.wasInstallCommandCalled();
		// Check whether devstack is available
		await this.isDevstackHealthy(debug);

		// Bind exit handler
		process.on('exit', this.exitHandler.bind(this));
		process.on('SIGINT', this.exitHandler.bind(this));
		process.on('SIGUSR1', this.exitHandler.bind(this));
		process.on('SIGUSR2', this.exitHandler.bind(this));
		process.on('SIGTERM', this.exitHandler.bind(this));

		// Init sentry
		Sentry.init({
			dsn: 'https://02902c9ddb584992a780788c71ba5cd7@o562268.ingest.sentry.io/6384635',

			environment: process.env.NODE_ENV,
			release: `imagelance-cli@${this.config.pjson.version}`,
			// @ts-expect-error for whatever reason this doesn't seem to appear in options
			tags: { version: this.config.pjson.version },
		});

		// Register custom prompts for inquirer
		inquirer.registerPrompt('search-list', inquirerSearchList);
	}

	// region Utilities
	async isDevstackHealthy(debug: boolean): Promise<void> {
		try {
			const config = {
				cancelToken: this.getCancelToken('isDevstackHealthy'),
				method: 'GET',
				url: devstackUrl('/public/health'),
			};

			await this.performRequest(config, false);
		} catch (error: any) {
			Sentry.captureException(error);
			console.error(chalk.red('Devstack unavailable. Please try again later.'));

			if (debug) {
				console.error(error);
			}

			await this.exitHandler(1);
		}
	}

	async isOnline() {
		const isOnline = Boolean(await dns.promises.resolve('google.com').catch(() => {
			// do nothing
		}));

		if (!isOnline) {
			console.error(chalk.red('📡 You are currently offline. Please connect to the internet to use imagelance-cli.'));

			await this.exitHandler(1);
		}
	}

	async performRequest(config: AxiosRequestConfig, appendAuthorization = true): Promise<any> {
		return performRequest(config, appendAuthorization);
	}

	// endregion

	reportError(error: any): void {
		reportError(error);
	}

	private async wasInstallCommandCalled(): Promise<void> {
		if (this.id === 'install' || isInstalled()) {
			return;
		}

		const shouldRunInstallCommand = await inquirer.prompt({
			choices: [
				'Yes',
				'No',
			],
			message: chalk.yellow(`Before running any command, you need to run "${this.config.bin} install". Do you wish to run this command now?`),
			name: 'answer',
			type: 'list',
		});

		if (shouldRunInstallCommand.answer === 'No') {
			console.log(chalk.blue(`Take your time! When you're ready, just call the "${this.config.bin} install" command.`));
			return this.exitHandler(1);
		}

		await performInstall();
	}

	// endregion
}
