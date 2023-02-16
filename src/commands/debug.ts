import BaseCommand from '../base-command';
import config from '../utils/config';

export class Debug extends BaseCommand {
	static description = 'Debug information'

	// hide from help command
	static hidden = true

	async run(): Promise<void> {
		console.log(config.all);
	}
}
