// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import inquirerSearchList from 'inquirer-search-list';
import * as inquirer from 'inquirer';
import axios, { AxiosRequestConfig, CancelToken } from 'axios';
import { Command, Flags } from '@oclif/core';
import * as Sentry from '@sentry/node';
import chalk from 'chalk';

import { CancelTokens } from './types/base-command';
import { environment, isInstalled } from './utils/config-getters';
import { performInstall } from './utils/perform-install';
import { performRequest } from './utils/perform-request';
import { reportError } from './utils/report-error';

export default abstract class BaseCommand extends Command {
	cancelTokens: CancelTokens = {}

	static baseFlags = {
		debug: Flags.boolean({ char: 'd', description: 'Debug mode', required: false, default: false }),
		local: Flags.boolean({ char: 'a', description: 'Against local apis', required: false, default: false }),
		env: Flags.string({
			char: 'e',
			description: 'Which environment to use for API calls',
			required: false,
			options: ['client', 'uat', 'rainy', 'sunny', 'cloudy', 'local', 'sazka', 'sazkauat'],
			default: 'client',
		}),
	}

	// region Hooks

	async init(): Promise<void> {
		// Validate whether install command was called
		await this.wasInstallCommandCalled();

		// Bind exit handler
		process.on('exit', this.exitHandler.bind(this));
		process.on('SIGINT', this.exitHandler.bind(this));
		process.on('SIGUSR1', this.exitHandler.bind(this));
		process.on('SIGUSR2', this.exitHandler.bind(this));
		process.on('SIGTERM', this.exitHandler.bind(this));

		// Init sentry
		Sentry.init({
			dsn: 'https://02902c9ddb584992a780788c71ba5cd7@o562268.ingest.sentry.io/6384635',
			release: `imagelance-cli@${this.config.pjson.version}`,
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore
			tags: { version: this.config.pjson.version },
			environment: process.env.NODE_ENV,
			config: {
				captureUnhandledRejections: true,
			},
		});

		// Register custom prompts for inquirer
		inquirer.registerPrompt('search-list', inquirerSearchList);

		// Log info
		if (environment() !== 'client') {
			console.log(chalk.blue(`Using ${chalk.blue.underline.bold(environment())} environment`));
		}
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

	exitHandler(code = 0): void {
		// implement custom exit handling
		process.exit(code);
	}

	// endregion

	// region Helpers

	reportError(error: any): void {
		reportError(error);
	}

	getCancelToken(name: string): CancelToken {
		if (this.cancelTokens[name]) {
			this.cancelTokens[name].cancel();
		}

		this.cancelTokens[name] = axios.CancelToken.source();

		return this.cancelTokens[name].token;
	}

	async performRequest(config: AxiosRequestConfig, appendAuthorization = true): Promise<any> {
		return performRequest(config, appendAuthorization);
	}

	// endregion

	// region Utilities

	private async wasInstallCommandCalled(): Promise<void> {
		if (this.id === 'install' || isInstalled()) {
			return;
		}

		const shouldRunInstallCommand = await inquirer.prompt({
			type: 'list',
			name: 'answer',
			message: chalk.yellow(`Before running any command, you need to run "${this.config.bin} install". Do you wish to run this command now?`),
			choices: [
				'Yes',
				'No',
			],
		});

		if (shouldRunInstallCommand.answer === 'No') {
			console.log(chalk.blue(`Take your time! When you're ready, just call the "${this.config.bin} install" command.`));
			return this.exitHandler(1);
		}

		await performInstall();
	}

	// endregion
}
