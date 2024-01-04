import { Flags } from '@oclif/core';

import AuthenticatedCommand from '../authenticated-command';
import { performSync } from '../utils/perform-sync';

export class Sync extends AuthenticatedCommand {
	static description = 'Download all synced templates';

	static flags = {
		shallow: Flags.boolean({ char: 's', default: false, description: 'Perform shallow fetch', required: false }),
	};

	async run(): Promise<void> {
		const { flags } = await this.parse(Sync);

		await performSync(flags);
	}
}
