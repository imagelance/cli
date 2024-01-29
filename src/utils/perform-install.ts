import chalk from 'chalk';
import inquirer from 'inquirer';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { getRoot, getUsername, setConfig, setIsInstalled } from './config-getters';

export async function performInstall(): Promise<void> {
	const currentRoot = getRoot();

	if (currentRoot) {
		const shouldChangeRootLocation = await inquirer.prompt({
			default: false,
			message: `Root folder for templates is already set to ${currentRoot}. Do you want to change it's location?`,
			name: 'answer',
			type: 'confirm',
		});

		if (!shouldChangeRootLocation.answer) {
			process.exit(1);
		}
	}

	const homeDir = path.join(os.homedir(), 'imagelance-templates', getUsername());
	const projectsDir = path.join(os.homedir(), 'Projects', 'imagelance-templates', getUsername());
	const cwdNestDir = path.join(process.cwd(), 'imagelance-templates', getUsername());

	const choices = [
		{ name: `${homeDir} (~/imagelance-templates/${getUsername()})`, value: 'homeDir' },
		{ name: `${projectsDir} (~/Projects/imagelance-templates/${getUsername()})`, value: 'projectsDir' },
		{
			name: `${cwdNestDir} (Create folder /imagelance-templates/${getUsername()} in current folder)`,
			value: 'cwdNestDir',
		},
	];

	const rootAnswer = await inquirer.prompt({
		choices,
		message: 'Select root directory location for template synchronization',
		name: 'root',
		type: 'list',
	});

	let dir;

	switch (rootAnswer.root) {
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
	}

	if (dir) {
		const root = dir.toString().split(path.sep).join('/');

		setConfig('root', root);
		console.log('Root folder for templates set to:', chalk.blue(dir));
	}

	setIsInstalled();
}
