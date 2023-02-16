import chalk from 'chalk';
import * as Sentry from '@sentry/node';

import BaseCommand from '../base-command';
import accountsUrl from '../utils/accounts-url';

export class TestAccounts extends BaseCommand {
	static description = 'Test whether CLI Controller in app is working'

	// hide the command from help
	static hidden = true

	async run(): Promise<void> {
		const { flags } = await this.parse(TestAccounts);
		const { debug } = flags;

		try {
			const { data } = await this.performRequest({
				url: accountsUrl('/public/ping'),
				method: 'GET',
			}, false);

			if (data.message && data.message === 'pong') {
				console.log(chalk.green.bold('PONG!'));
			}
		} catch (error: any) {
			Sentry.captureException(error);

			if (debug) {
				this.reportError(error);
			}
		}
	}
}
