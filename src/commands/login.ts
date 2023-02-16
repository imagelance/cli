import { Flags } from '@oclif/core';

import BaseCommand from '../base-command';
import { performLogin } from '../utils/perform-login';

export class Login extends BaseCommand {
	static description = 'Authorize CLI against web application'

	static flags = {
		debug: Flags.boolean({ char: 'd', description: 'Debug mode', required: false, default: false }),
		local: Flags.boolean({ char: 'l', description: 'Local', required: false, default: false }),
	}

	async run(): Promise<void> {
		const { flags } = await this.parse(Login);

		await performLogin(flags);
	}
}
