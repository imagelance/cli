import AuthenticatedCommand from '../authenticated-command';
import { performInstall } from '../utils/perform-install';

export class Install extends AuthenticatedCommand {
	static description = 'Set home directory for templates and prepare dev environment';

	async run(): Promise<void> {
		await performInstall();
	}
}
