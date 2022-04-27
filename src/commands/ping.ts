import chalk from 'chalk';

import BaseCommand from '../BaseCommand';

export class Ping extends BaseCommand {
	static description = 'Ping the CLI';

	// hidden from help command
	static hidden = true;

	async run(): Promise<void> {
		console.log(chalk.blue(`Pong`));
	}
}
