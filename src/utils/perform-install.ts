import inquirer from 'inquirer';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import chalk from 'chalk';
import { existsSync, readJsonSync } from 'fs-extra';
import rimraf from 'rimraf';

import { getRoot, isSazka, setConfig, setIsInstalled } from './config-getters';

export async function performInstall(): Promise<void> {
	const currentRoot = getRoot();

	if (currentRoot) {
		const confirm = await inquirer.prompt({
			type: 'confirm',
			name: 'confirm',
			message: `Root folder for templates is already set to ${currentRoot}. Do you want to change the location?`,
			default: false,
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
			} catch {
				// do nothing
			}

			dir = cwdNestDir;
			break;
		case 'homeDir':
			try {
				await fs.promises.mkdir(path.join(os.homedir(), 'imagelance-templates'));
			} catch {
				// do nothing
			}

			dir = homeDir;
			break;
		case 'projectsDir':
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
		case 'sazkaDir':
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
