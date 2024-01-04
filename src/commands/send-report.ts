import * as Sentry from '@sentry/node';

import BaseCommand from '../base-command';
import config from '../utils/config';

export class SendReport extends BaseCommand {
	static description = 'Send report about current configuration to Sentry';

	// hidden from help command
	static hidden = true;

	async run(): Promise<void> {
		const report: any = {
			config: config.all,
			env: process.env,
		};

		report.config.lastSyncResponseData = '<skipped>';
		report.config.lastSyncResponseDataSazka = undefined;

		const reportJSON = JSON.stringify(report);

		Sentry.captureException(new Error('Report'), { extra: report });
		console.log(reportJSON);
	}
}
