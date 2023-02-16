import fs from 'fs-extra';
import path from 'node:path';
import rimraf from 'rimraf';
import chalk from 'chalk';

import BaseCommand from '../base-command';
import { getRoot } from '../utils/config-getters';

export class Reset extends BaseCommand {
	static description = 'Fix some package mismatch issues'

	// hidden from help command
	static hidden = true

	async run(): Promise<void> {
		const root: string = getRoot();

		rimraf.sync(path.join(root, 'node_modules'));
		console.log(chalk.green('Deleted ' + path.join(root, 'node_modules')));
		rimraf.sync(path.join(root, 'package-lock.json'));
		console.log(chalk.green('Deleted ' + path.join(root, 'package-lock.json')));
		rimraf.sync(path.join(root, 'yarn.lock'));
		console.log(chalk.green('Deleted ' + path.join(root, 'yarn.lock')));
		rimraf.sync(path.join(root, 'package.json'));
		console.log(chalk.green('Deleted ' + path.join(root, 'package.json')));

		const packageJsonContents: object = fs.readJsonSync(path.join(__dirname, '..', 'assets', 'packageJsonTemplate.json'));

		fs.writeFileSync(`${root}/package.json`, JSON.stringify(packageJsonContents, null, '\t'));
		console.log(chalk.green('Created new ' + path.join(root, 'package.json')));
	}
}
