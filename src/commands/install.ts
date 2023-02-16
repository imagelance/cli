import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import inquirer from 'inquirer';
import chalk from 'chalk';
import rimraf from 'rimraf';
import { existsSync, readJsonSync } from 'fs-extra';

import BaseCommand from '../base-command';
import { isSazka, getRoot, setConfig } from '../utils/config-getters';

export class Install extends BaseCommand {
	static description = 'Set home directory for templates and prepare dev environment'

	async run(): Promise<void> {
		const currentRoot = getRoot();

		if (currentRoot) {
			const confirm = await inquirer.prompt({
				type: 'confirm',
				name: 'confirm',
				message: `Root folder for templates is already set to ${currentRoot}. Do you want to change the location?`,
				default: false,
			});

			if (!confirm.confirm) {
				process.exit();
			}
		}

		const homeDir = path.join(os.homedir(), 'imagelance-templates');
		const projectsDir = path.join(os.homedir(), 'Projects', 'imagelance-templates');
		const sazkaDir = path.join(os.homedir(), 'Projects', 'imagelance-templates-sazka');
		const cwdDir = process.cwd();
		const cwdNestDir = path.join(process.cwd(), 'imagelance-templates');

		const choices = isSazka() ?
			[
				{ value: 'sazkaDir', name: `${sazkaDir} (~/Projects/imagelance-templates-sazka)` },
				{ value: 'cwdDir', name: `${cwdDir} (Current folder)` },
			] :
			[
				{ value: 'homeDir', name: `${homeDir} (~/imagelance-templates)` },
				{ value: 'projectsDir', name: `${projectsDir} (~/Projects/imagelance-templates)` },
				{ value: 'cwdDir', name: `${cwdDir} (Current folder)` },
				{ value: 'cwdNestDir', name: `${cwdNestDir} (Create folder /imagelance-templates in current folder)` },
			];

		const rootAnswer = await inquirer.prompt({
			type: 'list',
			name: 'root',
			message: 'Where should be templates synchronized on disk?',
			choices,
		});

		let dir;

		switch (rootAnswer.root) {
		case 'cwdDir':
			dir = cwdDir;
			break;
		case 'cwdNestDir':
			try {
				await fs.promises.mkdir(path.join('.', 'imagelance-templates'));
			} catch {}

			dir = cwdNestDir;
			break;
		case 'homeDir':
			try {
				await fs.promises.mkdir(path.join(os.homedir(), 'imagelance-templates'));
			} catch {}

			dir = homeDir;
			break;
		case 'projectsDir':
			try {
				await fs.promises.mkdir(path.join(os.homedir(), 'Projects'));
			} catch {}

			try {
				await fs.promises.mkdir(path.join(os.homedir(), 'Projects', 'imagelance-templates'));
			} catch {}

			dir = projectsDir;
			break;
		case 'sazkaDir':
			try {
				await fs.promises.mkdir(path.join(os.homedir(), 'Projects'));
			} catch {}

			try {
				await fs.promises.mkdir(path.join(os.homedir(), 'Projects', 'imagelance-templates-sazka'));
			} catch {}

			dir = sazkaDir;
			break;
		}

		if (dir) {
			const root = dir.toString().split(path.sep).join('/');

			setConfig('root', root);
			console.log('Root folder for templates set to:', chalk.blue(dir));

			// replace wrong package json, that could contain bad version of postcss with custom one
			const packageJsonPath = path.join(root, 'package.json');

			if (existsSync(packageJsonPath)) {
				rimraf.sync(packageJsonPath);
				console.log(`Deleted old ${path.join(root, 'package.json')}`);
			}

			const packageJsonContents = readJsonSync(path.join(__dirname, '..', 'assets', 'packageJsonTemplate.json'));

			fs.writeFileSync(packageJsonPath, JSON.stringify(packageJsonContents, null, '\t'));
			console.log(`Created new ${packageJsonPath}`);
		}
	}
}
