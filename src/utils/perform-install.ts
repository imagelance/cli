import chalk from 'chalk';
import { existsSync, readJsonSync } from 'fs-extra';
import inquirer from 'inquirer';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import rimraf from 'rimraf';

import { getRoot, setConfig, setIsInstalled } from './config-getters';

export async function performInstall(): Promise<void> {
	const currentRoot = getRoot();

	if (currentRoot) {
		const confirm = await inquirer.prompt({
			default: false,
			message: `Root folder for templates is already set to ${currentRoot}. Do you want to change the location?`,
			name: 'confirm',
			type: 'confirm',
		});

		if (!confirm.confirm) {
			process.exit(1);
		}
	}

	const homeDir = path.join(os.homedir(), 'imagelance-templates');
	const projectsDir = path.join(os.homedir(), 'Projects', 'imagelance-templates');
	const sazkaDir = path.join(os.homedir(), 'Projects', 'imagelance-templates-sazka');
	const cwdDir = process.cwd();
	const cwdNestDir = path.join(process.cwd(), 'imagelance-templates');

	const choices = [
		{ name: `${homeDir} (~/imagelance-templates)`, value: 'homeDir' },
		{ name: `${projectsDir} (~/Projects/imagelance-templates)`, value: 'projectsDir' },
		{ name: `${cwdDir} (Current folder)`, value: 'cwdDir' },
		{ name: `${cwdNestDir} (Create folder /imagelance-templates in current folder)`, value: 'cwdNestDir' },
	];

	const rootAnswer = await inquirer.prompt({
		choices,
		message: 'Where should be templates synchronized on disk?',
		name: 'root',
		type: 'list',
	});

	let dir;

	switch (rootAnswer.root) {
		case 'cwdDir': {
			dir = cwdDir;
			break;
		}

		case 'cwdNestDir': {
			try {
				await fs.promises.mkdir(path.join('.', 'imagelance-templates'));
			} catch {
				// do nothing
			}

			dir = cwdNestDir;
			break;
		}

		case 'homeDir': {
			try {
				await fs.promises.mkdir(path.join(os.homedir(), 'imagelance-templates'));
			} catch {
				// do nothing
			}

			dir = homeDir;
			break;
		}

		case 'projectsDir': {
			try {
				await fs.promises.mkdir(path.join(os.homedir(), 'Projects'));
			} catch {
				// do nothing
			}

			try {
				await fs.promises.mkdir(path.join(os.homedir(), 'Projects', 'imagelance-templates'));
			} catch {
				// do nothing
			}

			dir = projectsDir;
			break;
		}

		case 'sazkaDir': {
			try {
				await fs.promises.mkdir(path.join(os.homedir(), 'Projects'));
			} catch {
				// do nothing
			}

			try {
				await fs.promises.mkdir(path.join(os.homedir(), 'Projects', 'imagelance-templates-sazka'));
			} catch {
				// do nothing
			}

			dir = sazkaDir;
			break;
		}
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

	setIsInstalled();
}
