import chalk from 'chalk';
import fs from 'fs-extra';
import * as Sentry from '@sentry/node';

import devstackUrl from './devstack-url';
import { performRequest } from './perform-request';
import { ValidatorEntry } from '../types/validation';

export default async function checkConfig(configPath: string, outputCategory: string | null = null): Promise<boolean> {
	if (!fs.existsSync(configPath)) {
		console.error(chalk.red('config.json does not exist!'));
		return false;
	}

	const configContents = fs.readJsonSync(configPath);

	if (!configContents) {
		console.error(chalk.red('File config.json is not valid JSON'));
		return false;
	}

	try {
		const { data } = await performRequest({
			url: devstackUrl('public/bundle-validator/config'),
			method: 'POST',
			data: {
				config: configContents,
				outputCategory,
			},
		}, false);

		const { isValid, log } = data;

		const errors = log.filter((entry: ValidatorEntry) => entry.level === 'error');
		const warnings = log.filter((entry: ValidatorEntry) => entry.level === 'warning');

		if (warnings.length > 0) {
			console.log(chalk.yellow('Warnings when validating config file:'));

			warnings.forEach((warning: ValidatorEntry) => {
				console.log(chalk.yellow(warning.message));
			});
		}

		if (errors.length > 0) {
			console.log(chalk.red('Errors when validating config file:'));

			errors.forEach((error: ValidatorEntry) => {
				console.log(chalk.red(error.message));
			});
		}

		return isValid;
	} catch (error: any) {
		Sentry.captureException(error);
		console.log(chalk.red('An error occurred while validating config file'));
		console.log(chalk.red(JSON.stringify(error)));

		return false;
	}
}
