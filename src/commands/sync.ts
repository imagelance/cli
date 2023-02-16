import { Flags } from '@oclif/core';

import AuthenticatedCommand from '../authenticated-command';
import { performSync } from '../utils/perform-sync';

export class Sync extends AuthenticatedCommand {
	static description = 'Download all synced templates'

	static flags = {
		debug: Flags.boolean({ char: 'd', description: 'Debug mode', required: false, default: false }),
		shallow: Flags.boolean({ char: 's', description: 'Perform shallow fetch', required: false, default: false }),
	}

	async run(): Promise<void> {
		const { flags } = await this.parse(Sync);

		await performSync(flags);
	}
}
