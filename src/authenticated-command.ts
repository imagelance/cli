import * as inquirer from 'inquirer';
import chalk from 'chalk';

import BaseCommand from './base-command';
import accountsUrl from './utils/accounts-url';
import { getAccessToken, isLocal, setUser } from './utils/config-getters';
import { User } from './types/authenticated-command';
import { performLogin } from './utils/perform-login';

export default abstract class AuthenticatedCommand extends BaseCommand {
	protected user: User | null = null

	async init(): Promise<void> {
		// Call BaseCommand initializer
		await super.init();

		// Validate, whether login command was run
		await this.wasLoginCommandRun();

		try {
			const { data: user } = await this.performRequest({
				url: accountsUrl('user'),
				method: 'GET',
			});

			this.user = user as User;

			setUser(this.user);
		} catch {
			console.log(chalk.red(`Invalid user, please use "${this.config.bin} login" command to try and log in again.`));

			return this.exitHandler(1);
		}
	}

	private async wasLoginCommandRun(): Promise<void> {
		if (this.id === 'login' || getAccessToken() !== null) {
			return;
		}

		const shouldRunLoginCommand = await inquirer.prompt({
			type: 'list',
			name: 'answer',
			message: chalk.yellow(`Before running an authenticated command, you need to run "${this.config.bin} login". Do you wish to run this command now?`),
			choices: [
				'Yes',
				'No',
			],
		});

		if (shouldRunLoginCommand.answer === 'No') {
			console.log(chalk.blue(`Take your time! When you're ready, just call the "${this.config.bin} login" command.`));
			return this.exitHandler(1);
		}

		await performLogin({ local: isLocal() });
	}
}
