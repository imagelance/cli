import BaseCommand from '../base-command';
import { performInstall } from '../utils/perform-install';

export class Install extends BaseCommand {
	static description = 'Set home directory for templates and prepare dev environment';

	async run(): Promise<void> {
		await performInstall();
	}
}
