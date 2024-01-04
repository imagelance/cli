import * as Sentry from '@sentry/node';
import chalk from 'chalk';
import fs from 'fs-extra';

import { ValidatorEntry } from '../types/validation';
import devstackUrl from './devstack-url';
import { performRequest } from './perform-request';

export default async function checkSchema(schemaPath: string, state: any): Promise<boolean> {
	if (!fs.existsSync(schemaPath)) {
		console.error(chalk.red('schema.json does not exist!'));
		return false;
	}

	const schemaContents = fs.readJsonSync(schemaPath);

	if (!schemaContents) {
		console.error(chalk.red('schema.json is not valid JSON'));
		return false;
	}

	try {
		const { data } = await performRequest({
			data: {
				schema: schemaContents,
			},
			method: 'POST',
			url: devstackUrl('public/bundle-validator/schema'),
		}, false);

		state.schema = data;

		const { isValid, log } = state.schema;

		const errors = log.filter((entry: ValidatorEntry) => entry.level === 'error');
		const warnings = log.filter((entry: ValidatorEntry) => entry.level === 'warning');

		if (warnings.length > 0) {
			console.log(chalk.yellow('Warnings when validating schema file:'));

			warnings.forEach((warning: ValidatorEntry) => {
				console.log(chalk.yellow(warning.message));
			});
		}

		if (errors.length > 0) {
			console.log(chalk.red('Errors when validating schema file:'));

			errors.forEach((error: ValidatorEntry) => {
				console.log(chalk.red(error.message));
			});
		}

		return isValid;
	} catch (error: any) {
		Sentry.captureException(error);
		console.log(chalk.red('An error occurred while validating schema file'));
		console.error(error);

		return false;
	}
}
