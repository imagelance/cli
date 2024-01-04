import * as Sentry from '@sentry/node';

import BaseCommand from '../base-command';

export class TestSentry extends BaseCommand {
	static description = 'Test whether Sentry error reporting is working';

	// hide the command from help
	static hidden = true;

	async run(): Promise<void> {
		Sentry.captureMessage('Test');
		console.log('OK');
		throw new Error('Hello');
	}
}
