import BaseCommand from '../base-command';
import { performLogin } from '../utils/perform-login';

export class Login extends BaseCommand {
	static description = 'Authorize CLI against web application';

	async run(): Promise<void> {
		const { flags } = await this.parse(Login);

		await performLogin(flags);

		await this.exitHandler();
	}
}
